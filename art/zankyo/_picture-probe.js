// ============================================================================
// ZANKYŌ — _picture-probe.js: the second set's instrument (PLAN-SIGNAL-PICTURE
// §6.3). Dev tool; never loaded by a page.
//
// Headless Chrome over CDP (tools/picture-cdp.js). It never trusts rAF: every
// run loads the real page with window.ZK_SET_DEV = { manual, clock: 0,
// texture } set before any script, so the set is frozen on a virtual clock
// from its first line, and then STEPS it — ZankyoSet._dev.step(ms) at 30
// virtual fps — through a scripted night: idle, then one reception built from
// a fixture plan in the receiver's own grammar (planTimes, cloned below from
// zk-broadcast.js). The reels are real files, paused on a fixed frame, so the
// source picture is a still and every pixel is reproducible.
//
// MODES
//   node _picture-probe.js identity [--base 2baf87e]
//       THE P0 GATE. Each fixture runs twice — once on this tree, once with
//       zk-set.js swapped (by request interception, nothing else) for the
//       base commit's, patched with the SAME dev shim (virtual clock, seeded
//       texture, frame-step, the no-filter switch). Every frame of the tube
//       canvas is hashed; the gate is every hash equal. Also the no-filter
//       (older Safari) path and a devicePixelRatio-2 run.
//   node _picture-probe.js perf [--base 2baf87e] [--reps 3]
//       the step's cost (tick + five passes + crack), base vs tree,
//       alternated, in-page performance.now() around each step.
//   node _picture-probe.js repeat
//       the metrics' repeatability (§6.3: "the probe's own repeatability is
//       measured first"): 3 texture seeds × 3 fresh pages, plus 3 unseeded
//       (Math.random) pages, on two reels; each metric's spread is reported.
//       Also calibrates the legibility floor on today's look (§6.3.3).
//   node _picture-probe.js all
//
// OPTIONS  --url http://127.0.0.1:8141/art/zankyo/   --out <dir for PNGs/JSON>
//
// THE METRICS (on the pre-crack frame, box-downsampled to 192×144, green):
//   ssim        mean SSIM (8×8 windows) against a CLEAN render of the same
//               reel — the same pipeline with the character forced clean
//               (no snow, no tear, no ghosts) — the legibility number
//   snowTV      total variation per pixel, impaired − clean (snow raises it)
//   lineVar     variance across rows of each row's best horizontal shift
//               against the clean row (±24 px) — the tear, the offset map
//   ghostPeak   max over delay 2–40 px of corr(impaired − clean, clean
//               shifted by the delay) — a ghost shows as a peak at its delay
//   humPeak     largest DFT magnitude, bins 1–6, of the row means of
//               (impaired − clean) — hum bars (P2)
//   clip        share of pixels ≥ 250 — AGC crush (P2)
//   corrClean   Pearson r of impaired vs clean — negative = inverted (P2)
// Each impairment KIND the character library knows must move its metric
// beyond these spreads (§6.3.2, fail by name) — P1 adds that check; the
// kind → metric table is KIND_METRIC below, and a kind missing from it is a
// failure, not a skip (the _cover.js rule).
//
// Exit 0 = the gates of the modes run are green. Exit 1 = a gate failed.
// ============================================================================
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { launch, sleep } = require("./tools/picture-cdp.js");

const argv = process.argv.slice(2);
const MODE = (argv[0] && !argv[0].startsWith("--")) ? argv[0] : "identity";
function opt(name, def) { const i = argv.indexOf("--" + name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; }
const URL0 = opt("url", "http://127.0.0.1:8141/art/zankyo/");
const BASE = opt("base", "2baf87e");
const REPS = +opt("reps", "3");
const OUT = opt("out", "") || fs.mkdtempSync(path.join(os.tmpdir(), "zk-picture-probe-"));
fs.mkdirSync(OUT, { recursive: true });
const SEED = 3042;                      // the night: fixes the crack pattern and the idle timings
const FPS = 30;

// the kinds the probe knows how to see, and the metric each must move (§6.3.2)
const KIND_METRIC = { "雪": "snowTV", "裂": "lineVar", "影": "ghostPeak" };

// ---- THE REELS: real files, paused on a fixed frame ----
const REELS = [
  { id: "john-cage-interview", at: 20.0 },          // a face
  { id: "bbc1-testcard-news-1979", at: 12.0 },      // a card / a studio
  { id: "ddr1-aktuelle-kamera-1986", at: 30.0 },    // a newsreader
];
// ---- THE FIXTURES: one reception each, in the receiver's plan grammar.
// Times relative to t0 (s); drops are [rel, dur]. Every phase the set knows
// appears in at least one: tuning, hunting, drifting, hold (drops, holes),
// lost, sweeping, relock, loss, collapse, burst, dead — and the idle before.
const FIXTURES = [
  { name: "即常切", reel: 0, seed: 211.7,
    rx: { body: "jou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 2.2,
          segments: [{ onS: 8, lockS: 0 }], gaps: [], holes: [], glimpses: null },
    drops: [[1.9, 0.2], [3.7, 0.33], [5.2, 0.14], [7.1, 0.26]] },
  { name: "探戻残", reel: 1, seed: 604.2,
    rx: { body: "modori", entry: "tan", exit: "zan", entryS: 5, exitS: 7,
          segments: [{ onS: 5, lockS: 0 }, { onS: 4, lockS: 0.2 }], gaps: [{ durS: 2.2, sweep: false }], holes: [],
          glimpses: [[1.1, 0.5], [2.4, 0.7], [3.9, 0.45]] },
    drops: [[6.3, 0.22], [13.4, 0.3]] },
  { name: "浮断絶", reel: 2, seed: 87.9,
    rx: { body: "dan", entry: "fu", exit: "zetsu", entryS: 7, exitS: 0.3,
          segments: [{ onS: 9, lockS: 0, holeS: 2.5 }], gaps: [], holes: [{ relS: 3, durS: 1.5 }, { relS: 6.5, durS: 1.0 }], glimpses: null },
    drops: [[8.2, 0.2], [14.9, 0.3]] },
  { name: "即走切·card", reel: null, seed: 950.1,
    rx: { body: "sou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 2,
          segments: [{ onS: 4, lockS: 0 }, { onS: 4, lockS: 0 }], gaps: [{ durS: 1.5, sweep: true }], holes: [], glimpses: null },
    drops: [[1.5, 0.2]] },
];
const T0_S = 15;                        // idle first: the test card surfaces at 6–14 s, Paik's line at 9–19 s

// ---- the base commit's zk-set.js, with the SAME dev shim the tree carries natively ----
function baseSetSource(ref) {
  let s = execFileSync("git", ["show", ref + ":art/zankyo/zk-set.js"], { cwd: path.join(__dirname, "..", ".."), encoding: "utf8", maxBuffer: 1 << 26 });
  const patch = (a, b) => { if (s.indexOf(a) < 0) throw new Error("base shim: marker not found — " + a.slice(0, 70)); s = s.replace(a, b); };
  patch('  var now = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };',
        '  var __D = window.ZK_SET_DEV || null, __vc = (__D && __D.manual) ? (+__D.clock || 0) : null;\n' +
        '  var now = function () { return __vc != null ? __vc : ((window.performance && performance.now) ? performance.now() : Date.now()); };');
  patch('  var atime = function () { var c',
        '  var atime = function () { if (__vc != null) return __vc / 1000; var c');
  // mulberry32 — the same stream zk-picture.js textureRng() gives, written out
  // again here so the base does not borrow the tree's code for its texture
  patch('  var rnd = Math.random;',
        '  var rnd = (__D && __D.texture != null) ? (function (n) { var a = (n >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(+__D.texture) : Math.random;');
  patch('  var hasFilter = (typeof fcx.filter === "string");',
        '  var hasFilter = (typeof fcx.filter === "string") && !(__D && __D.noFilter);');
  patch('  function loop() {\n    var t = now();',
        '  function loop() {\n    if (__vc != null) return;\n    var t = now();');
  patch('    _dev: {\n',
        '    _dev: {\n      step: function (ms) { __vc = +ms; var t = now(); frameN++; tickSignal(t); if (TW > 8) { renderSource(t); drawFrame(t); compose(); } return { t: t, phase: S.phase, strength: S.strength }; },\n' +
        '      frozen: function () { return __vc != null; },\n' +
        '      buffers: function () { return { frame: frame }; },\n');
  return s;
}

// ---- the in-page runner (stringified into the page) ----
function PAGE_RUN(fx, reels, o) {
  // the receiver's planTimes, cloned (zk-broadcast.js) — the fixture is a plan
  function planTimes(P) {
    var cur = P.entryS, on = 0, i;
    for (i = 0; i < P.segments.length; i++) {
      var s = P.segments[i];
      if (i > 0) { P.gaps[i - 1].atS = cur; cur += P.gaps[i - 1].durS; }
      s.lockAtS = cur; cur += (s.lockS || 0);
      s.atS = cur;
      cur += s.onS + (s.holeS || 0); on += s.onS;
    }
    P.lossAtS = cur; P.spanS = cur + P.exitS; P.presenceS = on;
    return P;
  }
  function fnv(buf) {
    var u = new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength >> 2), h = 0x811c9dc5;
    for (var i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; }
    return h.toString(16);
  }
  function once(el, ev) { return new Promise(function (res, rej) { el.addEventListener(ev, res, { once: true }); el.addEventListener("error", function () { rej(new Error("video error " + (el.error && el.error.code))); }, { once: true }); }); }
  return (async function () {
    var ZS = window.ZankyoSet, D = ZS._dev;
    if (!D.frozen()) throw new Error("the set is not frozen — ZK_SET_DEV was not honoured");
    await document.fonts.ready;
    try { await document.fonts.load('700 7px "Orbitron"'); await document.fonts.load('6px "Shippori Mincho"', "映像管 試験"); } catch (e) {}
    var video = null;
    if (fx.reel != null) {
      var R = reels[fx.reel];
      video = document.createElement("video");
      video.muted = true; video.preload = "auto"; video.playsInline = true;
      var p = once(video, "loadeddata");
      video.src = "broadcast/reels/" + R.id + ".mp4";
      await p;
      var q = once(video, "seeked"); video.currentTime = R.at; await q;
    }
    if (o.force) D.force && D.force(o.force);
    var P = planTimes(JSON.parse(JSON.stringify(fx.rx)));
    for (var h = 0; h < P.holes.length; h++) P.holes[h].atS = +(P.segments[0].atS + P.holes[h].relS).toFixed(3);
    var t0 = o.t0S, dt = 1000 / o.fps;
    var endMs = (t0 + P.spanS + 0.42 + 0.32 + 1.6 + 1.0) * 1000, N = Math.ceil(endMs / dt);
    var cv = document.getElementById("zankyo-set"), cx = cv.getContext("2d");
    var samples = {}, sampleIdx = {}, hashes = [], phases = [], times = [], grays = [];
    for (var k = 0; k < o.nSamples; k++) sampleIdx[Math.round((k + 0.5) * N / o.nSamples)] = 1;
    var sent = false, g = null, gcx = null;
    if (o.gray) { g = document.createElement("canvas"); g.width = 192; g.height = 144; gcx = g.getContext("2d", { willReadFrequently: true }); gcx.imageSmoothingEnabled = true; gcx.imageSmoothingQuality = "high"; }
    for (var i = 0; i <= N; i++) {
      var tm = i * dt;
      if (!sent && tm >= (t0 - 0.1) * 1000) {
        var drops = fx.drops.map(function (d) { return [t0 + P.entryS + d[0], d[1]]; });
        var ok = ZS.signal({ t0: t0, holdS: P.presenceS, lossD: P.exitS, drops: drops, seed: fx.seed, id: fx.name, rx: P, video: video });
        if (!ok) throw new Error("signal refused");
        sent = true;
      }
      var a = performance.now(); var st = D.step(tm); times.push(performance.now() - a);
      phases.push(st.phase);
      if (o.hash) hashes.push(fnv(cx.getImageData(0, 0, cv.width, cv.height).data));
      if (o.gray && (st.phase === "hold") && i % o.grayEvery === 0) {
        gcx.clearRect(0, 0, 192, 144); gcx.drawImage(D.buffers().frame, 0, 0, 192, 144);
        var d = gcx.getImageData(0, 0, 192, 144).data, gr = new Uint8Array(192 * 144);
        for (var j = 0, pp = 1; j < gr.length; j++, pp += 4) gr[j] = d[pp];
        var bin = ""; for (var b = 0; b < gr.length; b++) bin += String.fromCharCode(gr[b]);
        grays.push({ i: i, b64: btoa(bin) });
      }
      if (o.png && sampleIdx[i]) samples[i] = { phase: st.phase, png: cv.toDataURL("image/png") };
    }
    return { N: N, size: [cv.width, cv.height], hashes: hashes, phases: phases, times: times, samples: samples, grays: grays,
             state: ZS.getState(), character: D.character ? D.character() : null };
  })();
}

// ---- one fresh page: load, freeze, run a fixture ----
async function runPage(browser, fx, o) {
  const page = await browser.newPage();
  try {
    await page.send("Page.enable"); await page.send("Runtime.enable"); await page.send("Network.enable");
    await page.send("Network.setCacheDisabled", { cacheDisabled: true });
    const cfg = { manual: true, clock: 0 };
    if (o.texture != null) cfg.texture = o.texture;
    if (o.noFilter) cfg.noFilter = true;
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.ZK_SET_DEV = " + JSON.stringify(cfg) + ";" });
    const errors = [];
    page.on("Runtime.exceptionThrown", (e) => errors.push((e.exceptionDetails.exception && e.exceptionDetails.exception.description) || e.exceptionDetails.text));
    let served = 0;
    if (o.baseSrc) {
      await page.send("Fetch.enable", { patterns: [{ urlPattern: "*zk-set.js*", requestStage: "Request" }] });
      page.on("Fetch.requestPaused", (e) => {
        served++;
        page.send("Fetch.fulfillRequest", { requestId: e.requestId, responseCode: 200,
          responseHeaders: [{ name: "Content-Type", value: "application/javascript; charset=utf-8" }],
          body: Buffer.from(o.baseSrc, "utf8").toString("base64") }).catch((err) => errors.push("the base zk-set.js was not served: " + (err && err.message)));
      });
    }
    await page.send("Page.navigate", { url: URL0 + "?seed=" + SEED });
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: o.dpr || 1, mobile: false });
    // wait on the clock, never on frames: the set exists, has sized its tube, and is frozen
    let ready = false;
    for (let k = 0; k < 200 && !ready; k++) {
      await sleep(100);
      try { ready = await page.eval("!!(window.ZankyoSet && ZankyoSet._dev && ZankyoSet._dev.step && ZankyoSet.getState().tube[0] > 8 && document.readyState === 'complete')"); } catch (e) {}
    }
    if (!ready) throw new Error("the page never came up (errors: " + errors.join(" | ") + ")");
    await sleep(400);                                            // let the metrics override's resize land
    const res = await page.eval("(" + PAGE_RUN.toString() + ")(" + JSON.stringify(fx) + "," + JSON.stringify(REELS) + "," + JSON.stringify({
      t0S: T0_S, fps: FPS, hash: !!o.hash, png: !!o.png, nSamples: 20, gray: !!o.gray, grayEvery: o.grayEvery || 3, force: o.force || null }) + ")", 600000);
    res.errors = errors;
    // THE BASE MUST BE THE BASE (critic P0 r1). If the interception ever
    // failed silently, the "base" page would load this tree's zk-set.js, the
    // identity gate would compare the tree with itself and pass, and the
    // sensitivity check (which moves only the tree) would still pass — a
    // green gate for the wrong reason. So a base page must prove it: the
    // request was intercepted, and the page lacks the tree's character hook
    // (rc.91's _dev has none; the shim does not add one).
    if (o.baseSrc && (served < 1 || res.character != null))
      throw new Error("the base page is not the base (zk-set.js intercepted " + served + "×, character hook " + (res.character != null ? "PRESENT" : "absent") + ")");
    return res;
  } finally { await page.closeTarget(); }
}

function savePngs(res, tag) {
  const dir = path.join(OUT, tag); fs.mkdirSync(dir, { recursive: true });
  for (const [i, s] of Object.entries(res.samples)) fs.writeFileSync(path.join(dir, String(i).padStart(4, "0") + "-" + s.phase + ".png"), Buffer.from(s.png.split(",")[1], "base64"));
  return dir;
}
function stats(a) {
  const s = a.slice().sort((x, y) => x - y), n = s.length, m = s.reduce((p, q) => p + q, 0) / (n || 1);
  return { n, mean: +m.toFixed(3), p50: +(s[n >> 1] || 0).toFixed(3), p95: +(s[Math.floor(n * 0.95)] || 0).toFixed(3), worst: +(s[n - 1] || 0).toFixed(3) };
}

// ============================================================================
// IDENTITY
// ============================================================================
async function identity(browser) {
  const baseSrc = baseSetSource(BASE);
  const runs = [];
  for (let f = 0; f < FIXTURES.length; f++) runs.push({ fx: FIXTURES[f], texture: 7 + f, label: FIXTURES[f].name });
  runs.push({ fx: FIXTURES[3], texture: 31, noFilter: true, label: FIXTURES[3].name + " · no-filter" });
  runs.push({ fx: FIXTURES[0], texture: 32, noFilter: true, label: FIXTURES[0].name + " · no-filter" });
  runs.push({ fx: FIXTURES[1], texture: 33, dpr: 2, label: FIXTURES[1].name + " · dpr 2" });
  let allOk = true;
  const rows = [];
  for (const r of runs) {
    const o = { texture: r.texture, noFilter: r.noFilter, dpr: r.dpr, hash: true, png: true };
    process.stdout.write("  … " + r.label + "\r");
    const tree = await runPage(browser, r.fx, o);
    const base = await runPage(browser, r.fx, Object.assign({ baseSrc }, o));
    let same = 0, first = -1;
    for (let i = 0; i < tree.hashes.length; i++) { if (tree.hashes[i] === base.hashes[i]) same++; else if (first < 0) first = i; }
    const phases = {}; tree.phases.forEach((p) => { phases[p] = (phases[p] || 0) + 1; });
    const phaseSame = tree.phases.join() === base.phases.join();
    const ok = same === tree.hashes.length && tree.hashes.length === base.hashes.length && phaseSame && !tree.errors.length && !base.errors.length;
    allOk = allOk && ok;
    const dir = savePngs(tree, "identity-" + runs.indexOf(r) + "-" + r.label.replace(/[\s·\/]+/g, "_"));
    if (first >= 0) {
      // save the first differing frame pair for the eye
      fs.writeFileSync(path.join(dir, "FIRST-DIFF-" + first + ".json"), JSON.stringify({ frame: first, phase: tree.phases[first], tree: tree.hashes[first], base: base.hashes[first] }));
    }
    rows.push({ fixture: r.label, frames: tree.hashes.length, identical: same, firstDiff: first, phasesMatch: phaseSame, size: tree.size.join("×"),
                phases: Object.keys(phases).map((k) => k + ":" + phases[k]).join(" "), errors: tree.errors.concat(base.errors).length, ok });
    console.log((ok ? "  ✓ " : "  ✗ ") + r.label.padEnd(22) + " " + same + "/" + tree.hashes.length + " frames identical · canvas " + tree.size.join("×") +
                (first >= 0 ? " · first diff at frame " + first + " (" + tree.phases[first] + ")" : "") + (phaseSame ? "" : " · PHASES DIFFER") +
                (tree.errors.length + base.errors.length ? " · page errors: " + tree.errors.concat(base.errors).join(" | ") : ""));
    console.log("      phases: " + rows[rows.length - 1].phases);
  }
  // CAN THIS GATE FAIL? (the W4 lesson: a gate that cannot fail is worse than
  // none). The same fixture, the tree's ghost moved a quarter of a tube pixel
  // through the bench's force hook — it MUST be caught, and never before the
  // tune-in (the idle has no ghost). If it is not caught, the gate is blind: red.
  {
    const fx = FIXTURES[0], o = { texture: 7, hash: true };
    const tree = await runPage(browser, fx, Object.assign({ force: { axes: { ghosts: [{ dx: 5.25, wob: 3, per: 900, dy: 1, a0: 0.16, a1: 0.14 }] } } }, o));
    const base = await runPage(browser, fx, Object.assign({ baseSrc }, o));
    let diff = 0; const where = {};
    for (let i = 0; i < tree.hashes.length; i++) if (tree.hashes[i] !== base.hashes[i]) { diff++; where[tree.phases[i]] = (where[tree.phases[i]] || 0) + 1; }
    // nothing may differ before the ghost first exists (the idle before the
    // tune-in); after it, the persistence carries it on, so anything goes
    const firstGhost = tree.phases.indexOf("tuning");
    const outside = []; for (let i = 0; i < firstGhost; i++) if (tree.hashes[i] !== base.hashes[i]) { outside.push("frame " + i); break; }
    const seen = diff > 0 && !outside.length;
    allOk = allOk && seen;
    console.log((seen ? "  ✓ " : "  ✗ ") + "sensitivity: ghost dx 5 → 5.25 px caught in " + diff + "/" + tree.hashes.length + " frames " + JSON.stringify(where) +
                (outside.length ? " — AND before any ghost existed (" + outside[0] + ")" : "") + (diff ? "" : " — THE GATE IS BLIND"));
    rows.push({ fixture: "sensitivity (ghost +0.25 px)", frames: tree.hashes.length, differing: diff, where, ok: seen });
  }
  return { ok: allOk, rows };
}

// ============================================================================
// PERF
// ============================================================================
async function perf(browser) {
  const baseSrc = baseSetSource(BASE);
  const acc = { tree: [], base: [] };
  for (let r = 0; r < REPS; r++) for (const which of (r % 2 ? ["base", "tree"] : ["tree", "base"])) {
    for (const f of [0, 1]) {
      const res = await runPage(browser, FIXTURES[f], { texture: 5, baseSrc: which === "base" ? baseSrc : null });
      // the step includes the reception's tick; frames before the canvas is sized are none here (ready-gated)
      acc[which].push.apply(acc[which], res.times);
    }
  }
  const T = stats(acc.tree), B = stats(acc.base);
  console.log("  step cost, ms (" + REPS + " reps × 2 fixtures, alternated):");
  console.log("    base " + JSON.stringify(B));
  console.log("    tree " + JSON.stringify(T));
  // no worse: mean within 10 % or 0.1 ms of the base, p95 likewise (headless timing noise, stated)
  const ok = T.mean <= Math.max(B.mean * 1.10, B.mean + 0.1) && T.p95 <= Math.max(B.p95 * 1.10, B.p95 + 0.1);
  console.log("  " + (ok ? "✓" : "✗") + " perf no worse (mean and p95 within max(10 %, 0.1 ms) of base)");
  return { ok, base: B, tree: T };
}

// ============================================================================
// METRICS (node side, on 192×144 greens)
// ============================================================================
const W = 192, H = 144;
function dec(b64) { return new Float64Array(Buffer.from(b64, "base64")); }
function ssim(x, y) {
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2; let sum = 0, n = 0;
  for (let by = 0; by + 8 <= H; by += 4) for (let bx = 0; bx + 8 <= W; bx += 4) {
    let mx = 0, my = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const p = (by + j) * W + bx + i; mx += x[p]; my += y[p]; }
    mx /= 64; my /= 64;
    let vx = 0, vy = 0, cxy = 0;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const p = (by + j) * W + bx + i, a = x[p] - mx, b = y[p] - my; vx += a * a; vy += b * b; cxy += a * b; }
    vx /= 63; vy /= 63; cxy /= 63;
    sum += ((2 * mx * my + C1) * (2 * cxy + C2)) / ((mx * mx + my * my + C1) * (vx + vy + C2)); n++;
  }
  return sum / n;
}
function tv(x) { let s = 0; for (let y = 0; y < H; y++) for (let i = 0; i < W - 1; i++) s += Math.abs(x[y * W + i + 1] - x[y * W + i]); for (let y = 0; y < H - 1; y++) for (let i = 0; i < W; i++) s += Math.abs(x[(y + 1) * W + i] - x[y * W + i]); return s / (W * H); }
function lineVar(x, c) {
  const sh = [];
  for (let y = 0; y < H; y++) {
    let best = 0, bestE = Infinity;
    for (let d = -24; d <= 24; d++) { let e = 0, n = 0; for (let i = 30; i < W - 30; i++) { const q = i - d; e += Math.abs(x[y * W + i] - c[y * W + q]); n++; } e /= n; if (e < bestE) { bestE = e; best = d; } }
    sh.push(best);
  }
  const m = sh.reduce((a, b) => a + b, 0) / H; return sh.reduce((a, b) => a + (b - m) * (b - m), 0) / H;
}
function ghostPeak(x, c) {
  let best = -1, at = 0;
  const d0 = new Float64Array(W * H); for (let p = 0; p < W * H; p++) d0[p] = x[p] - c[p];
  for (let d = 2; d <= 40; d++) {
    let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0, n = 0;
    for (let y = 0; y < H; y++) for (let i = d; i < W; i++) { const a = d0[y * W + i], b = c[y * W + i - d]; sa += a; sb += b; sab += a * b; saa += a * a; sbb += b * b; n++; }
    const r = (sab - sa * sb / n) / Math.sqrt(Math.max(1e-9, (saa - sa * sa / n) * (sbb - sb * sb / n)));
    if (r > best) { best = r; at = d; }
  }
  return { r: best, at };
}
function humPeak(x, c) {
  const m = []; for (let y = 0; y < H; y++) { let s = 0; for (let i = 0; i < W; i++) s += x[y * W + i] - c[y * W + i]; m.push(s / W); }
  let best = 0; for (let k = 1; k <= 6; k++) { let re = 0, im = 0; for (let y = 0; y < H; y++) { re += m[y] * Math.cos(2 * Math.PI * k * y / H); im -= m[y] * Math.sin(2 * Math.PI * k * y / H); } best = Math.max(best, Math.hypot(re, im) / H); }
  return best;
}
function clip(x) { let n = 0; for (let p = 0; p < W * H; p++) if (x[p] >= 250) n++; return n / (W * H); }
function corr(x, c) { let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0; const n = W * H; for (let p = 0; p < n; p++) { sa += x[p]; sb += c[p]; sab += x[p] * c[p]; saa += x[p] * x[p]; sbb += c[p] * c[p]; } return (sab - sa * sb / n) / Math.sqrt(Math.max(1e-9, (saa - sa * sa / n) * (sbb - sb * sb / n))); }
function median(a) { const s = a.slice().sort((p, q) => p - q); return s.length ? s[s.length >> 1] : NaN; }
function pct(a, q) { const s = a.slice().sort((p, r) => p - r); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; }

// the clean reference: the same reel through the same pipeline, the character
// forced clean, a plain hold (no drops), sampled once the persistence has
// converged — one still per reel (the reels are paused)
const CLEAN_FORCE = { axes: { snow: { sq: 0, lin: 0 }, tear: { amp: 0, jump: 0 }, ghosts: [] } };
async function cleanFor(browser, reel) {
  const fx = { name: "clean", reel, seed: 1, drops: [],
    rx: { body: "jou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 2, segments: [{ onS: 6, lockS: 0 }], gaps: [], holes: [], glimpses: null } };
  const res = await runPage(browser, fx, { texture: 1, gray: true, grayEvery: 1, force: CLEAN_FORCE });
  // the last hold frame, after ~5 s of hold: the persistence has long converged
  return dec(res.grays[res.grays.length - 1].b64);
}
function metricsOf(res, clean) {
  const out = { ssim: [], snowTV: [], lineVar: [], ghostPeak: [], humPeak: [], clip: [], corrClean: [] };
  const tvc = tv(clean);
  for (const g of res.grays) {
    const x = dec(g.b64);
    out.ssim.push(ssim(x, clean)); out.snowTV.push(tv(x) - tvc); out.lineVar.push(lineVar(x, clean));
    out.ghostPeak.push(ghostPeak(x, clean).r); out.humPeak.push(humPeak(x, clean)); out.clip.push(clip(x)); out.corrClean.push(corr(x, clean));
  }
  const m = {}; for (const k in out) m[k] = +median(out[k]).toFixed(4);
  m.ssimP10 = +pct(out.ssim, 0.1).toFixed(4); m.n = res.grays.length;
  return m;
}
async function repeat(browser) {
  // the fixtures with a reel and a long hold: 即常切 (reel 0) and 浮断絶 (reel 2)
  const FX = [0, 2];
  const table = {};
  let allOk = true;
  for (const f of FX) {
    const fx = FIXTURES[f], clean = await cleanFor(browser, fx.reel);
    const rows = [];
    for (const tex of [3, 17, 101]) for (let r = 0; r < 3; r++) rows.push(Object.assign({ texture: tex, run: r }, metricsOf(await runPage(browser, fx, { texture: tex, gray: true }), clean)));
    for (let r = 0; r < 3; r++) rows.push(Object.assign({ texture: "Math.random", run: r }, metricsOf(await runPage(browser, fx, { gray: true }), clean)));
    table[fx.name] = rows;
    console.log("  " + fx.name + " (reel " + REELS[fx.reel].id + "), hold frames every 3rd step:");
    const keys = ["ssim", "ssimP10", "snowTV", "lineVar", "ghostPeak", "humPeak", "clip", "corrClean"];
    console.log("    " + "texture".padEnd(12) + "run " + keys.map((k) => k.padStart(10)).join(""));
    for (const row of rows) console.log("    " + String(row.texture).padEnd(12) + String(row.run).padEnd(4) + keys.map((k) => String(row[k]).padStart(10)).join(""));
    // the instrument's own repeatability: the same seed on a fresh page must give the same numbers
    for (const tex of [3, 17, 101]) {
      const same = rows.filter((x) => x.texture === tex);
      const exact = keys.every((k) => same.every((x) => x[k] === same[0][k]));
      allOk = allOk && exact;
      console.log("    seed " + tex + ": 3 fresh pages " + (exact ? "IDENTICAL ✓" : "DIFFER ✗"));
    }
    const spread = {};
    for (const k of keys) { const v = rows.map((x) => x[k]); spread[k] = +(Math.max.apply(null, v) - Math.min.apply(null, v)).toFixed(4); }
    console.log("    spread across all 12 (seeds + Math.random): " + JSON.stringify(spread));
    table[fx.name + " spread"] = spread;
  }
  // THE LEGIBILITY FLOOR (§6.3.3, §11.2), calibrated on today's look: the
  // median of the per-run median hold SSIM over every run above.
  const all = []; for (const k in table) if (Array.isArray(table[k])) table[k].forEach((r) => all.push(r.ssim));
  const floor = +median(all).toFixed(4);
  console.log("  legibility floor (today's look, median hold SSIM over " + all.length + " runs): " + floor);
  // every kind the library names must have a metric to move (the _cover.js rule)
  const ZP = require("./zk-picture.js");
  const missing = ZP.IMPAIRMENTS.filter((k) => !KIND_METRIC[k]);
  if (missing.length) { allOk = false; console.log("  ✗ kinds with no metric: " + missing.join(" ")); }
  else console.log("  ✓ every library kind has a metric (" + (ZP.IMPAIRMENTS.length ? ZP.IMPAIRMENTS.join(" ") : "none yet at P0; today's look is measured as 雪 snowTV / 裂 lineVar / 影 ghostPeak") + ")");
  fs.writeFileSync(path.join(OUT, "repeat.json"), JSON.stringify({ table, floor }, null, 1));
  return { ok: allOk, floor, table };
}

(async function main() {
  console.log("_picture-probe " + MODE + " · " + URL0 + " · base " + BASE + " · out " + OUT);
  const browser = await launch();
  let ok = true;
  const report = {};
  try {
    if (MODE === "identity" || MODE === "all") { console.log("IDENTITY (pixel hashes of every frame, tree vs base, seeded texture)"); report.identity = await identity(browser); ok = ok && report.identity.ok; }
    if (MODE === "perf" || MODE === "all") { console.log("PERF"); report.perf = await perf(browser); ok = ok && report.perf.ok; }
    if (MODE === "repeat" || MODE === "all") { console.log("REPEATABILITY + LEGIBILITY FLOOR"); report.repeat = await repeat(browser); ok = ok && report.repeat.ok; }
  } catch (e) { console.error("PROBE FAILED: " + (e && e.stack || e)); ok = false; }
  finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, "report-" + MODE + ".json"), JSON.stringify(report, null, 1));
  console.log(ok ? "GATE GREEN" : "GATE RED");
  process.exit(ok ? 0 : 1);
})();
