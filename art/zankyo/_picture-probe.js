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
//   node _picture-probe.js all            (perf + repeat; identity is P0's)
//
// P1 MODES (PLAN-SIGNAL-PICTURE §6.3 items 1–4, §7 row P1, §11.2)
//   node _picture-probe.js draws
//       node only: the character draw over 500 receptions per seed set
//       (3042, 17, 7, 8891, 101–136): archetype and tier shares against §4.1,
//       distinct kind combinations, and the SEEN-BEFORE rate (a reception
//       whose character vector sits within one JND of any of the previous 10).
//       The JND comes from the render mode's calibration (render.json in
//       --out, or --jnd <file>); without one it says so and uses 0.1.
//   node _picture-probe.js render
//       §6.3.2, fail by name: every P1 kind forced ALONE (median axes, sev 0.5
//       and 1.0) on a plain hold, three texture seeds each, against the clean
//       reference; its metric must move beyond 3× the clean's spread over the
//       same texture seeds and beyond P0's unseeded spread for that metric.
//       Writes render.json (per-kind slope → the JND for `draws`).
//   node _picture-probe.js legibility [--n 16]
//       §6.3.3 + §11.2: drawn characters over n reception seeds × 3 reels (a
//       plain hold with dropouts), tree AND rc.91 (the base, by interception)
//       on the same fixtures and seeds, each against its own pipeline's clean
//       render. Median of per-reception median hold SSIM ≥ rc.91's; ≤ 1 in 8
//       receptions below the buried line; EVERY reception surfaces (≥ 0.6 s
//       above the surfacing line in any 5 s of hold); plus 遠 and 嵐 forced at
//       their worst (sev 1), 12 seeds each, which must surface too.
//   node _picture-probe.js perfp1
//       the step's cost per archetype (forced, 3 receptions each), the tree
//       overall against rc.91's, dpr 1 and 2, and the full-size tube.
//   node _picture-probe.js crack
//       光: the glow layer's content on an idle and a dead tube (must be 0 in
//       every channel, every frame) and on a bright picture (must light), and
//       a DOM screenshot of the idle tube: the crack's pixels may carry no
//       more green than the tube's own pixels beside them.
//   node _picture-probe.js phases
//       the frames each phase gets, every fixture shape, tree vs rc.91: equal,
//       except the 断 tail (hold now, not loss — the P1 fix).
//   node _picture-probe.js lull
//       (critic P1 r1) how far and how often the §11.2 surfacing lifts the
//       picture: 遠/嵐 at sev 1 must surface without coming up near clean for
//       long, the gate must fail with the lull off, and the share of drawn
//       receptions carrying a lull is held to LULL_SHARE
//   node _picture-probe.js p1             render, draws, legibility, perfp1, crack, lull, phases
//   node _picture-probe.js lullcal        (dev, r2) drawn receptions with the lull forced off: who fails
//       to surface without one — the data ZP.burial / BURY_LINE were fitted on
//   node _picture-probe.js strip          (r2) one reception's hold as a captioned film strip
//   node _picture-probe.js sheets
//       contact sheets into --out: 12 drawn receptions on each of 3 reels, the
//       8 archetypes side by side, and the crack on an idle and a lit tube.
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
const LULLK = JSON.parse(opt("lullk", "null"));   // dev only: LULL constants tried in-page (never in a gate run)
const SEED = 3042;                      // the night: fixes the crack pattern and the idle timings
const FPS = 30;

// the kinds the probe knows how to see, and the metric each must move (§6.3.2)
const KIND_METRIC = { "雪": "snowTV", "裂": "lineVar", "影": "ghostAmp", "霞": "washDev", "伸": "scaleDev" };

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
  // P1: a clean switch (window.__zkClean: no snow, no tear, no ghost — the
  // base's own clean reference, so each side's SSIM is against its own
  // pipeline) and a per-reception texture reseed
  const all = (a, b, n) => { const c = s.split(a).length - 1; if (c !== n) throw new Error("base shim: expected " + n + "× — " + a.slice(0, 60) + " (found " + c + ")"); s = s.split(a).join(b); };
  all("snow * snow * 0.85 + snow * 0.08", "(window.__zkClean ? 0 : snow * snow * 0.85 + snow * 0.08)", 3);
  all("fcx.globalAlpha = 0.16 + 0.14 * (1 - strength);", "fcx.globalAlpha = (window.__zkClean ? 0 : 0.16 + 0.14 * (1 - strength));", 1);
  all("var off = tearAmt * (", "var off = (window.__zkClean ? 0 : tearAmt) * (", 1);
  patch('    _dev: {\n',
        '    _dev: {\n      seedTexture: function (n) { rnd = n == null ? Math.random : (function (n) { var a = (n >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(+n); },\n');
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
    if (o.lullk && window.ZankyoPicture) Object.assign(window.ZankyoPicture.LULL, o.lullk);   // dev: --lullk '{"lift":0.12}' tries LULL constants without an edit
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
  let best = 0, at = 0;
  const d0 = new Float64Array(W * H); for (let p = 0; p < W * H; p++) d0[p] = x[p] - c[p];
  for (let d = 2; d <= 40; d++) {
    let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0, n = 0;
    for (let y = 0; y < H; y++) for (let i = d; i < W; i++) { const a = d0[y * W + i], b = c[y * W + i - d]; sa += a; sb += b; sab += a * b; saa += a * a; sbb += b * b; n++; }
    const r = (sab - sa * sb / n) / Math.sqrt(Math.max(1e-9, (saa - sa * sa / n) * (sbb - sb * sb / n)));
    if (Math.abs(r) > Math.abs(best)) { best = r; at = d; }   // P1: a negative ghost is a ghost
  }
  return { r: Math.abs(best), sign: Math.sign(best), at };
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
const CLEAN_FORCE = { clean: true };                   // P1: the character library's own clean reference
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

// ============================================================================
// P1 — THE CHARACTER'S INSTRUMENTS (§6.3 items 1–4, §11.2)
// ============================================================================
const SEED_SETS = [3042, 17, 7, 8891].concat(Array.from({ length: 36 }, (_, i) => 101 + i));
const P1_KINDS = ["雪", "影", "裂", "霞", "伸"];
// the plain hold every P1 per-reception measure runs on (critic P0 r1 item 2:
// "does it render" and the legibility floor on a PLAIN hold, never a holed one)
const PLAIN = FIXTURES[0];
// P0's unseeded spreads on the plain hold (handoff/phase-P0-coder-r1.md §4,
// critic r1 §4: the larger of the two runs) — a kind must move beyond these
const P0_SPREAD = { snowTV: 1.16, lineVar: 0.0245 };   // (ghostAmp is new at P1: its floor is the clean's own spread)
// the legibility lines (§11.2), calibrated against rc.91 on the plain hold:
// its hold SSIM runs ~0.57 median with dropout dips to ~0.23 (P0 §4)
const BURIED = 0.2, SURF = 0.4, SURF_RUN = 0.6, SURF_WIN = 5;

// ---- one page, many receptions (a page load costs 20–70 s on this machine;
// a reception costs ~1 s): load once, run a list, return per-reception data
function PAGE_MULTI(items, reels, o) {
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
  function ssim(x, y) {
    var W = 192, H = 144, C1 = 6.5025, C2 = 58.5225, sum = 0, n = 0;
    for (var by = 0; by + 8 <= H; by += 4) for (var bx = 0; bx + 8 <= W; bx += 4) {
      var mx = 0, my = 0, i, j, p;
      for (j = 0; j < 8; j++) for (i = 0; i < 8; i++) { p = (by + j) * W + bx + i; mx += x[p]; my += y[p]; }
      mx /= 64; my /= 64;
      var vx = 0, vy = 0, cxy = 0;
      for (j = 0; j < 8; j++) for (i = 0; i < 8; i++) { p = (by + j) * W + bx + i; var a = x[p] - mx, b = y[p] - my; vx += a * a; vy += b * b; cxy += a * b; }
      vx /= 63; vy /= 63; cxy /= 63;
      sum += ((2 * mx * my + C1) * (2 * cxy + C2)) / ((mx * mx + my * my + C1) * (vx + vy + C2)); n++;
    }
    return sum / n;
  }
  // REGISTERED SSIM (P1): legibility is not position. A picture the vertical
  // hold has slipped by a few lines (a roll dropout — the whole frame moved,
  // wrapped, with its blanking bar) is as legible as one in place, and plain
  // SSIM scores it as buried. So the clean is first aligned to the frame by
  // the best CYCLIC vertical shift (row-mean profiles; the roll wraps) and the
  // best horizontal shift within ±12 px (column-mean profiles). Per-line
  // offsets — the tear — are NOT registered away. Both numbers are returned.
  var shifted = new Float64Array(192 * 144);
  function prof(a, rows) { var W = 192, H = 144, out = new Float64Array(rows ? H : W), i, j; for (j = 0; j < H; j++) for (i = 0; i < W; i++) out[rows ? j : i] += a[j * W + i]; return out; }
  function bestShift(px, pc, cyclic, range) {
    var n = px.length, best = 0, bestV = -Infinity, mx = 0, mc = 0, i; for (i = 0; i < n; i++) { mx += px[i]; mc += pc[i]; } mx /= n; mc /= n;
    for (var k = -range; k <= range; k++) { var v = 0, m = 0; for (i = 0; i < n; i++) { var q = i - k; if (cyclic) q = ((q % n) + n) % n; else if (q < 0 || q >= n) continue; v += (px[i] - mx) * (pc[q] - mc); m++; } v /= m; if (v > bestV) { bestV = v; best = k; } }
    return best;
  }
  // (r2) and for SIZE: 伸 breathes the raster with the beam current (up to
  // ~4 % larger), and a picture drawn 3 % larger is as legible as one in
  // place — plain SSIM scored 嵐 at sev 1 (伸 1.0) as buried through every
  // lull. The clean is first scaled about the centre by the set's OWN scale
  // that frame (geo.sc × geo.sy from _dev.buffers(), over the clean's own —
  // read, not searched), then registered for position as above.
  var scaled = new Float64Array(192 * 144);
  function scaleBy(c, k) {
    for (var j = 0; j < 144; j++) { var v = (j + 0.5 - 72) / k + 72 - 0.5, v0 = Math.max(0, Math.min(143, Math.floor(v))), v1 = Math.min(143, v0 + 1), fv = Math.max(0, Math.min(1, v - v0));
      for (var i = 0; i < 192; i++) { var u = (i + 0.5 - 96) / k + 96 - 0.5, u0 = Math.max(0, Math.min(191, Math.floor(u))), u1 = Math.min(191, u0 + 1), fu = Math.max(0, Math.min(1, u - u0));
        scaled[j * 192 + i] = (c[v0 * 192 + u0] * (1 - fu) + c[v0 * 192 + u1] * fu) * (1 - fv) + (c[v1 * 192 + u0] * (1 - fu) + c[v1 * 192 + u1] * fu) * fv; } }
    return scaled;
  }
  function ssimReg(x, c, k) {
    if (k && Math.abs(k - 1) > 0.002) c = scaleBy(c, k);
    var ky = bestShift(prof(x, true), prof(c, true), true, 72), kx = bestShift(prof(x, false), prof(c, false), false, 12);
    for (var j = 0; j < 144; j++) { var sj = (((j - ky) % 144) + 144) % 144; for (var i = 0; i < 192; i++) { var si = i - kx; shifted[j * 192 + i] = si >= 0 && si < 192 ? c[sj * 192 + si] : c[sj * 192 + (si < 0 ? 0 : 191)]; } }
    return ssim(x, shifted);
  }
  function once(el, ev) { return new Promise(function (res, rej) { el.addEventListener(ev, res, { once: true }); el.addEventListener("error", function () { rej(new Error("video error " + (el.error && el.error.code))); }, { once: true }); }); }
  return (async function () {
    var ZS = window.ZankyoSet, D = ZS._dev;
    if (!D.frozen()) throw new Error("the set is not frozen — ZK_SET_DEV was not honoured");
    if (o.lullk && window.ZankyoPicture) Object.assign(window.ZankyoPicture.LULL, o.lullk);   // dev: --lullk '{"lift":0.12}' tries LULL constants without an edit
    await document.fonts.ready;
    try { await document.fonts.load('700 7px "Orbitron"'); await document.fonts.load('6px "Shippori Mincho"', "映像管 試験"); } catch (e) {}
    var vids = {};
    async function vid(ri) {
      if (ri == null) return null;
      var R = reels[ri], k = R.id + "@" + R.at; if (vids[k]) return vids[k];
      var v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.playsInline = true;
      var p = once(v, "loadeddata"); v.src = "broadcast/reels/" + R.id + ".mp4"; await p;
      var q = once(v, "seeked"); v.currentTime = R.at; await q;
      vids[k] = v; return v;
    }
    var g = document.createElement("canvas"); g.width = 192; g.height = 144;
    var gcx = g.getContext("2d", { willReadFrequently: true }); gcx.imageSmoothingEnabled = true; gcx.imageSmoothingQuality = "high";
    function gray() { gcx.clearRect(0, 0, 192, 144); gcx.drawImage(D.buffers().frame, 0, 0, 192, 144); var d = gcx.getImageData(0, 0, 192, 144).data, gr = new Float64Array(192 * 144); for (var j = 0, pp = 1; j < gr.length; j++, pp += 4) gr[j] = d[pp]; return gr; }
    function b64(gr) { var bin = ""; for (var i = 0; i < gr.length; i++) bin += String.fromCharCode(gr[i]); return btoa(bin); }
    var cleans = {}, cleanK = {}, lastK = 1, out = [], dt = 1000 / o.fps, tm = D.clock ? D.clock() : 0;
    var cv = document.getElementById("zankyo-set");
    for (var ii = 0; ii < items.length; ii++) {
      var it = items[ii], v = await vid(it.reel);
      if (D.seedTexture) D.seedTexture(it.texture == null ? null : it.texture);
      window.__zkClean = !!it.clean;
      if (D.force) { var fr = D.force(it.clean ? { clean: true } : (it.force || null)); if (fr && !fr.ok) throw new Error("force refused: " + fr.why); }
      var P = planTimes(JSON.parse(JSON.stringify(it.rx)));
      for (var h = 0; h < P.holes.length; h++) P.holes[h].atS = +(P.segments[0].atS + P.holes[h].relS).toFixed(3);
      tm += dt; D.step(tm);
      var t0 = tm / 1000 + 0.2;
      var drops = it.drops.map(function (d) { return [t0 + P.entryS + d[0], d[1]]; });
      if (!ZS.signal({ t0: t0, holdS: P.presenceS, lossD: P.exitS, drops: drops, seed: it.seed, id: it.label || "probe", rx: P, video: v })) throw new Error("signal refused at " + it.label);
      var rec = { label: it.label, seed: it.seed, reel: it.reel, ssim: [], ssimRaw: [], tHold: [], inHole: [], times: [], phases: {}, grays: [], character: D.character ? D.character() : null, pngs: [], glow: [] };
      var endS = t0 + P.spanS + 0.42 + 0.32 + 1.6 + 0.3, n = 0, lastGray = null;
      var clean = cleans[it.reel != null ? it.reel : "card"];
      while (tm / 1000 < endS) {
        tm += dt; var a = performance.now(); var st = D.step(tm); rec.times.push(performance.now() - a);
        rec.phases[st.phase] = (rec.phases[st.phase] || 0) + 1; n++;
        if (it.glow && D.glow) { var gl = D.glow(); rec.glow.push([st.phase, Math.max(gl.max[0], gl.max[1], gl.max[2])]); }
        if (st.phase === "hold" && n % (it.every || 3) === 0) {
          var e = tm / 1000 - t0, gr = gray(); lastGray = gr;
          var hole = 0; for (var hh = 0; hh < P.holes.length; hh++) if (e >= P.holes[hh].atS - 0.1 && e < P.holes[hh].atS + P.holes[hh].durS + 0.5) hole = 1;
          rec.tHold.push(+e.toFixed(3)); rec.inHole.push(hole);
          var geo = D.buffers().geo || {}, kk = (geo.sc || 1) * (geo.sy || 1), kc = cleanK[it.reel != null ? it.reel : "card"] || 1;
          if (it.clean) lastK = kk;
          if (clean && !it.clean) { rec.ssimRaw.push(+ssim(gr, clean).toFixed(4)); rec.ssim.push(+Math.max(rec.ssimRaw[rec.ssimRaw.length - 1], ssimReg(gr, clean, kk / kc)).toFixed(4)); }
          if (it.grays && rec.grays.length < (it.maxGrays || 40)) rec.grays.push(b64(gr));
        }
        if (it.pngAt != null && !rec.pngs.length && st.phase === "hold" && tm / 1000 - t0 - P.segments[0].atS >= it.pngAt) rec.pngs.push(cv.toDataURL("image/png"));
      }
      var guard = 0; while (ZS.getState().phase !== "idle" && guard++ < 600) { tm += dt; D.step(tm); }
      if (it.clean) { cleans[it.reel != null ? it.reel : "card"] = lastGray; cleanK[it.reel != null ? it.reel : "card"] = lastK; rec.cleanB64 = lastGray ? b64(lastGray) : null; }
      out.push(rec);
    }
    window.__zkClean = false;
    return out;
  })();
}

// one fresh page (tree, or the base by interception), frozen, sized
async function openPage(browser, o) {
  const page = await browser.newPage();
  await page.send("Page.enable"); await page.send("Runtime.enable"); await page.send("Network.enable");
  await page.send("Network.setCacheDisabled", { cacheDisabled: true });
  const cfg = { manual: true, clock: 0 };
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
  let ready = false;
  for (let k = 0; k < 300 && !ready; k++) {
    await sleep(100);
    try { ready = await page.eval("!!(window.ZankyoSet && ZankyoSet._dev && ZankyoSet._dev.step && ZankyoSet.getState().tube[0] > 8 && document.readyState === 'complete')"); } catch (e) {}
  }
  if (!ready) { await page.closeTarget(); throw new Error("the page never came up (errors: " + errors.join(" | ") + ")"); }
  await sleep(400);
  if (o.baseSrc) {
    const hasCh = await page.eval("!!ZankyoSet._dev.character");
    if (served < 1 || hasCh) { await page.closeTarget(); throw new Error("the base page is not the base (zk-set.js intercepted " + served + "×, character hook " + (hasCh ? "PRESENT" : "absent") + ")"); }
  }
  page.errors = errors;
  return page;
}
async function runMulti(browser, items, o) {
  const page = await openPage(browser, o);
  try {
    const res = await page.eval("(" + PAGE_MULTI.toString() + ")(" + JSON.stringify(items) + "," + JSON.stringify(REELS) + "," + JSON.stringify({ fps: FPS, lullk: LULLK }) + ")", 1800000);
    res.errors = page.errors;
    return res;
  } finally { await page.closeTarget(); }
}
const plainItem = (reel, seed, extra) => Object.assign({ reel, seed, texture: Math.round(seed * 7) % 100000 + 1, rx: PLAIN.rx, drops: PLAIN.drops, label: (reel == null ? "card" : REELS[reel].id) + "·" + seed }, extra || {});
const cleanItem = (reel) => ({ reel, seed: 1, texture: 1, clean: true, rx: { body: "jou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 2, segments: [{ onS: 6, lockS: 0 }], gaps: [], holes: [], glimpses: null }, drops: [], label: "clean" });

// ---- the §11.2 surfacing measure, per reception: in every 5 s window of
// hold (hole frames excluded — a 断 hole is a planned loss of the carrier,
// audio too), a contiguous run ≥ 0.6 s at or above the surfacing line.
// A hold shorter than 5 s needs one run of min(0.6, hold/2).
function surfacing(rec) {
  const T = [], V = [];
  for (let i = 0; i < rec.ssim.length; i++) if (!rec.inHole[i]) { T.push(rec.tHold[i]); V.push(rec.ssim[i]); }
  if (T.length < 3) return { ok: true, why: "too short", worst: null };
  const step = T.length > 1 ? T[1] - T[0] : 0.1;
  const runs = []; let s0 = -1;
  for (let i = 0; i <= T.length; i++) {
    const up = i < T.length && V[i] >= SURF && (s0 < 0 || T[i] - T[i - 1] < step * 1.6);
    if (up && s0 < 0) s0 = i;
    if ((!up || i === T.length) && s0 >= 0) { const e = up ? i : i - 1; runs.push([T[s0], T[e] + step]); s0 = up ? -1 : (i < T.length && V[i] >= SURF ? i : -1); }
  }
  const span = T[T.length - 1] - T[0] + step;
  if (span < SURF_WIN) { const need = Math.min(SURF_RUN, span / 2); const best = Math.max(0, ...runs.map((r) => r[1] - r[0])); return { ok: best >= need - 1e-6, worst: +best.toFixed(2), span: +span.toFixed(2) }; }
  let worst = Infinity;
  for (let w = T[0]; w + SURF_WIN <= T[0] + span + 1e-6; w += step) {
    let best = 0;
    for (const r of runs) { const a = Math.max(r[0], w), b = Math.min(r[1], w + SURF_WIN); if (b - a > best) best = b - a; }
    if (best < worst) worst = best;
  }
  return { ok: worst >= SURF_RUN - 1e-6, worst: +worst.toFixed(2), span: +span.toFixed(2) };
}

// ---- 1. THE DRAW (node only) ----
function loadRand() {
  const vm = require("vm"), ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "prosperos-jukebox-v2", "pj2-rand.js"), "utf8"), ctx);
  return ctx.PJ2.Rand;
}
async function draws() {
  delete require.cache[require.resolve("./zk-picture.js")];
  const ZP = require("./zk-picture.js"), Rand = loadRand();
  let jnd = null, jndSrc = "default 0.1 (no render.json)";
  const jf = opt("jnd", path.join(OUT, "render.json"));
  if (fs.existsSync(jf)) { const r = JSON.parse(fs.readFileSync(jf, "utf8")); if (r.jnd) { jnd = r.jnd; jndSrc = jf; } }
  const JFLOOR = 0.1;                                       // a JND is never under a tenth of a kind's range, whatever the instrument can see
  const J = {}; P1_KINDS.forEach((k) => { J[k] = Math.max(JFLOOR, jnd && jnd[k] != null ? jnd[k] : JFLOOR); });
  const want = {}; ZP.ARCHETYPES.forEach((a) => { want[a.id] = a.w; });
  const tot = {}, tiers = {}, combos = new Set(); let seen = 0, N = 0; const perSet = [];
  for (const S of SEED_SETS) {
    const m = Rand.stream(S), dsr = Rand.stream(S).fork("probe:desc"), cnt = {}, hist = []; let sseen = 0;
    for (let r = 0; r < 500; r++) {
      const ch = ZP.drawCharacter(m.fork("set:rx:" + dsr.next() * 1000), {});
      cnt[ch.archetype] = (cnt[ch.archetype] || 0) + 1; tot[ch.archetype] = (tot[ch.archetype] || 0) + 1; tiers[ch.tier] = (tiers[ch.tier] || 0) + 1;
      const v = P1_KINDS.map((k) => ch.kinds[k] || 0);
      combos.add(ch.archetype + ":" + P1_KINDS.filter((k, i) => v[i] > 0).join(""));
      if (hist.some((h) => h.every((x, i) => Math.abs(x - v[i]) < J[P1_KINDS[i]]))) { seen++; sseen++; }
      hist.push(v); if (hist.length > 10) hist.shift();
      N++;
    }
    perSet.push({ S, seen: sseen / 500, shares: cnt });
  }
  console.log("  " + N + " draws over " + SEED_SETS.length + " seed sets × 500 (3042, 17, 7, 8891, 101–136)");
  let ok = true; const rows = [];
  for (const a of ZP.ARCHETYPES) {
    const got = (tot[a.id] || 0) / N, rel = got / a.w - 1;
    const setShares = perSet.map((p) => (p.shares[a.id] || 0) / 500);
    const inBand = Math.abs(rel) <= 0.25; ok = ok && inBand;
    rows.push({ a: a.id, want: a.w, got: +got.toFixed(4), rel: +(rel * 100).toFixed(1), setMin: Math.min(...setShares), setMax: Math.max(...setShares) });
    console.log("  " + (inBand ? "✓" : "✗") + " " + a.id + " want " + a.w.toFixed(2) + " got " + got.toFixed(4) + " (" + (rel >= 0 ? "+" : "") + (rel * 100).toFixed(1) + " %) · per 500-draw set " + Math.min(...setShares).toFixed(3) + "–" + Math.max(...setShares).toFixed(3));
  }
  const unc = (tiers.uncommon || 0) / N, uncOk = Math.abs(unc / ZP.SEV.uncommonP - 1) <= 0.25; ok = ok && uncOk;
  console.log("  " + (uncOk ? "✓" : "✗") + " tier uncommon " + unc.toFixed(4) + " (want " + ZP.SEV.uncommonP.toFixed(4) + "; rare and very rare tiers are P4's, §7)");
  console.log("  distinct archetype·kind combinations: " + combos.size);
  const sb = seen / N, sbMax = Math.max(...perSet.map((p) => p.seen)), sbOk = sb <= 0.30; ok = ok && sbOk;
  console.log("  " + (sbOk ? "✓" : "✗") + " seen-before (within one JND of any of the previous 10): " + (sb * 100).toFixed(2) + " % (worst set " + (sbMax * 100).toFixed(1) + " %) — gate ≤ 30 %; JND " + JSON.stringify(J) + " from " + jndSrc);
  // can it fail? the same measure over a draw that ignores its fork (today's one look) must read 100 %
  { const hist = []; let s2 = 0; for (let r = 0; r < 200; r++) { const ch = ZP.drawCharacter(null, {}); const v = P1_KINDS.map((k) => ch.kinds[k] || 0); if (hist.some((h) => h.every((x, i) => Math.abs(x - v[i]) < J[P1_KINDS[i]]))) s2++; hist.push(v); if (hist.length > 10) hist.shift(); }
    const blind = s2 / 199 < 0.99; ok = ok && !blind;
    console.log("  " + (blind ? "✗" : "✓") + " sensitivity: 今 drawn 200× reads seen-before " + (s2 / 199 * 100).toFixed(1) + " % (must be ~100 %)"); }
  fs.writeFileSync(path.join(OUT, "draws.json"), JSON.stringify({ N, rows, tiers, combos: combos.size, seenBefore: sb, J, jndSrc, perSet }, null, 1));
  return { ok, seenBefore: sb, rows, combos: combos.size };
}

// ---- 2. DOES IT RENDER (§6.3.2), and the JND calibration ----
function washDev(x, c) {
  const sd = (a) => { let m = 0; for (let i = 0; i < a.length; i++) m += a[i]; m /= a.length; let v = 0; for (let i = 0; i < a.length; i++) v += (a[i] - m) * (a[i] - m); return Math.sqrt(v / a.length); };
  const p5 = (a) => { const s = Array.from(a).sort((p, q) => p - q); return s[Math.floor(s.length * 0.05)]; };
  return Math.abs(1 - sd(x) / Math.max(1e-6, sd(c))) + Math.abs(p5(x) - p5(c)) / 64;
}
function scaleDev(x, c) {
  // the scale about the centre that best maps the clean onto x (bilinear), in %
  let best = 1, bestE = Infinity;
  for (let s = 0.97; s <= 1.0601; s += 0.0025) {
    let e = 0;
    for (let y = 20; y < 124; y += 2) for (let i = 24; i < 168; i += 2) {
      const u = (i - 96) / s + 96, v = (y - 72) / s + 72, u0 = Math.floor(u), v0 = Math.floor(v), fu = u - u0, fv = v - v0;
      const q = c[v0 * W + u0] * (1 - fu) * (1 - fv) + c[v0 * W + u0 + 1] * fu * (1 - fv) + c[(v0 + 1) * W + u0] * (1 - fu) * fv + c[(v0 + 1) * W + u0 + 1] * fu * fv;
      const d = x[y * W + i] - q; e += d * d;
    }
    if (e < bestE) { bestE = e; best = s; }
  }
  return Math.abs(best - 1) * 100;
}
// 影, P1: the echo's AMPLITUDE. The residual (impaired − clean) first loses
// its linear part in the clean (a·clean + b — what 霞 or a drive change
// leaves), so only what the clean cannot explain at zero delay is left; then
// the delay (±2..40 px, a pre-ghost included) whose shifted clean explains it
// best, and the regression amplitude there. P0's ghostPeak (a correlation)
// saturates at ~0.77 and reads 霞 as a ghost once its sign is ignored.
function ghostAmp(x, c) {
  const n = W * H; let sc = 0, scc = 0, sr = 0, src = 0;
  const r = new Float64Array(n); for (let p = 0; p < n; p++) { r[p] = x[p] - c[p]; sc += c[p]; scc += c[p] * c[p]; sr += r[p]; src += r[p] * c[p]; }
  const beta = (src - sr * sc / n) / Math.max(1e-9, scc - sc * sc / n), alpha = (sr - beta * sc) / n;
  for (let p = 0; p < n; p++) r[p] -= alpha + beta * c[p];
  let best = 0, bestR = 0;
  for (let d = -3; d <= 40; d++) {
    if (d > -2 && d < 2) continue;
    let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0, m = 0;
    for (let y = 0; y < H; y++) for (let i = Math.max(0, d); i < Math.min(W, W + d); i++) { const a = r[y * W + i], b = c[y * W + i - d]; sa += a; sb += b; sab += a * b; saa += a * a; sbb += b * b; m++; }
    const cov = sab - sa * sb / m, vb = sbb - sb * sb / m, rr = cov / Math.sqrt(Math.max(1e-9, (saa - sa * sa / m) * vb));
    if (Math.abs(rr) > Math.abs(bestR)) { bestR = rr; best = Math.abs(cov / Math.max(1e-9, vb)); }
  }
  return best;
}
const METRIC_FN = { snowTV: (x, c) => tv(x) - tv(c), lineVar: lineVar, ghostAmp: ghostAmp, washDev: washDev, scaleDev: scaleDev };
async function render(browser) {
  const TEX = [3, 17, 101], SEVS = [0.5, 1.0];
  const items = [cleanItem(0)];
  const hold6 = { body: "jou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 1, segments: [{ onS: 6, lockS: 0 }], gaps: [], holes: [], glimpses: null };
  for (const tex of TEX) items.push({ reel: 0, seed: 5, texture: tex, force: { clean: true }, rx: hold6, drops: [], grays: true, every: 3, maxGrays: 60, label: "clean·" + tex });
  for (const k of P1_KINDS) for (const sv of SEVS) for (const tex of TEX) items.push({ reel: 0, seed: 5, texture: tex, force: { impairment: k, sev: sv }, rx: hold6, drops: [], grays: true, every: 3, maxGrays: 60, label: k + "·" + sv + "·" + tex });
  const res = await runMulti(browser, items, {});
  const clean = dec(res[0].cleanB64);
  const mean = (a) => a.reduce((p, q) => p + q, 0) / (a.length || 1);
  const val = {};                                           // label → { metric → mean over frames }
  for (const r of res.slice(1)) { val[r.label] = {}; for (const m in METRIC_FN) val[r.label][m] = mean(r.grays.map((b) => METRIC_FN[m](dec(b), clean))); }
  let ok = true; const out = {}, jnd = {};
  // every kind the library names must have a metric (the _cover.js rule)
  const ZP = require("./zk-picture.js");
  const missing = ZP.IMPAIRMENTS.filter((k) => !KIND_METRIC[k]);
  if (missing.length) { ok = false; console.log("  ✗ kinds with no metric: " + missing.join(" ")); }
  for (const k of P1_KINDS) {
    const m = KIND_METRIC[k];
    const cl = TEX.map((t) => val["clean·" + t][m]), clSpread = Math.max(...cl) - Math.min(...cl), clMean = mean(cl);
    const floor = 3 * Math.max(clSpread, P0_SPREAD[m] || 0, 1e-4);
    const at = {}; for (const sv of SEVS) { const v = TEX.map((t) => val[k + "·" + sv + "·" + t][m]); at[sv] = { mean: mean(v), min: Math.min(...v), spread: Math.max(...v) - Math.min(...v) }; }
    const moved = at[0.5].min - clMean, pass = moved > floor;
    ok = ok && pass;
    // the JND in severity units: the severity step that moves the metric by
    // its own noise floor (the larger of the clean's and the kind's spread)
    const slope = (at[1.0].mean - at[0.5].mean) / 0.5, noise = Math.max(clSpread, at[0.5].spread, P0_SPREAD[m] || 0, 1e-4);
    jnd[k] = slope > 0 ? +(noise / slope).toFixed(4) : 1;
    out[k] = { metric: m, clean: +clMean.toFixed(4), cleanSpread: +clSpread.toFixed(4), floor: +floor.toFixed(4), at05: +at[0.5].mean.toFixed(4), min05: +at[0.5].min.toFixed(4), at10: +at[1.0].mean.toFixed(4), spread05: +at[0.5].spread.toFixed(4), moved: +moved.toFixed(4), pass, jnd: jnd[k] };
    console.log("  " + (pass ? "✓" : "✗ DOES NOT RENDER:") + " " + k + " alone → " + m + ": clean " + clMean.toFixed(4) + " (spread " + clSpread.toFixed(4) + ") · sev 0.5 " + at[0.5].mean.toFixed(4) + " (min " + at[0.5].min.toFixed(4) + ", spread " + at[0.5].spread.toFixed(4) + ") · sev 1 " + at[1.0].mean.toFixed(4) + " · moved " + moved.toFixed(4) + " vs floor " + floor.toFixed(4) + " · JND " + jnd[k]);
  }
  // cross-talk table: every kind's every metric (so a kind that moves the wrong metric shows)
  console.log("  every metric under every kind at sev 0.5 (mean of 3 textures):");
  console.log("    " + "".padEnd(8) + Object.keys(METRIC_FN).map((m) => m.padStart(11)).join(""));
  console.log("    " + "clean".padEnd(8) + Object.keys(METRIC_FN).map((m) => mean(TEX.map((t) => val["clean·" + t][m])).toFixed(4).padStart(11)).join(""));
  for (const k of P1_KINDS) console.log("    " + k.padEnd(7) + Object.keys(METRIC_FN).map((m) => mean(TEX.map((t) => val[k + "·0.5·" + t][m])).toFixed(4).padStart(11)).join(""));
  if (res.errors.length) { ok = false; console.log("  ✗ page errors: " + res.errors.join(" | ")); }
  fs.writeFileSync(path.join(OUT, "render.json"), JSON.stringify({ kinds: out, jnd }, null, 1));
  return { ok, kinds: out, jnd };
}

// ---- 3. LEGIBILITY + SURFACING (§6.3.3, §11.2), tree vs rc.91 ----
function legRows(res) {
  return res.filter((r) => r.label !== "clean").map((r) => {
    const s = surfacing(r);
    return { label: r.label, arch: r.character ? r.character.archetype : "rc.91", sev: r.character ? r.character.sev : null, med: +median(r.ssim).toFixed(4), medRaw: +median(r.ssimRaw).toFixed(4), p10: +pct(r.ssim, 0.1).toFixed(4), surf: s.ok, surfWorst: s.worst, n: r.ssim.length, trace: r.tHold.map((t, i) => [t, r.ssim[i], r.inHole[i]]), ch: r.character };
  });
}
async function legibility(browser) {
  const NS = +opt("n", "16"), seeds = Array.from({ length: NS }, (_, i) => 101 + i + 0.37);
  const items = [];
  for (let r = 0; r < REELS.length; r++) { items.push(cleanItem(r)); for (const s of seeds) items.push(plainItem(r, s + 100 * r)); }   // a different character on every tube: 3 × n distinct receptions
  const baseSrc = baseSetSource(BASE);
  const tree = legRows(await runMulti(browser, items, {}));
  const base = legRows(await runMulti(browser, items, { baseSrc }));
  const worst = [cleanItem(0)];
  for (const a of ["遠", "嵐"]) for (let i = 0; i < 12; i++) worst.push(plainItem(0, 501 + i + 0.37, { force: { archetype: a, sev: 1 }, label: a + "·sev1·" + i }));
  const wr = legRows(await runMulti(browser, worst, {}));
  const tm = median(tree.map((r) => r.med)), bm = median(base.map((r) => r.med));
  const buried = tree.filter((r) => r.med < BURIED).length, noSurf = tree.filter((r) => !r.surf), baseNoSurf = base.filter((r) => !r.surf), wNoSurf = wr.filter((r) => !r.surf);
  const byArch = {}; tree.forEach((r) => { (byArch[r.arch] = byArch[r.arch] || []).push(r.med); });
  console.log("  fixture: " + PLAIN.name + " (8 s plain hold, 4 dropouts) × reels " + REELS.map((r) => r.id).join(", ") + " × " + NS + " reception seeds each (101.37…, 201.37…, 301.37…); texture seeded per reception; every 3rd hold frame");
  console.log("  per-reception median hold SSIM (registered: the clean aligned for the roll and a global horizontal shift; see PAGE_MULTI) — tree median " + tm.toFixed(4) + " · rc.91 median " + bm.toFixed(4) + " (each against its own pipeline's clean render)");
  console.log("    unregistered, for the record: tree " + median(tree.map((r) => r.medRaw)).toFixed(4) + " · rc.91 " + median(base.map((r) => r.medRaw)).toFixed(4));
  for (const a in byArch) console.log("    " + a + " n=" + byArch[a].length + " median " + median(byArch[a]).toFixed(4) + " range " + Math.min(...byArch[a]).toFixed(3) + "–" + Math.max(...byArch[a]).toFixed(3));
  const g1 = tm >= bm, g2 = buried <= tree.length / 8, g3 = noSurf.length === 0, g4 = wNoSurf.length === 0;
  console.log("  " + (g1 ? "✓" : "✗") + " the median reception is at least as legible as rc.91's (" + tm.toFixed(4) + " ≥ " + bm.toFixed(4) + ")");
  console.log("  " + (g2 ? "✓" : "✗") + " below the buried line (" + BURIED + "): " + buried + "/" + tree.length + " (≤ 1 in 8)");
  console.log("  " + (g3 ? "✓" : "✗") + " every drawn reception surfaces (≥ " + SURF_RUN + " s at SSIM ≥ " + SURF + " in any " + SURF_WIN + " s of hold): " + (tree.length - noSurf.length) + "/" + tree.length + (noSurf.length ? " — FAILS: " + noSurf.map((r) => r.label + " " + r.arch + " worst " + r.surfWorst).join(", ") : "") + " · worst window " + Math.min(...tree.map((r) => r.surfWorst)).toFixed(2) + " s");
  console.log("    rc.91 on the same measure: " + (base.length - baseNoSurf.length) + "/" + base.length + " surface · worst window " + Math.min(...base.map((r) => r.surfWorst)).toFixed(2) + " s");
  console.log("  " + (g4 ? "✓" : "✗") + " 遠 and 嵐 at their worst (sev 1, 12 each) surface: " + (wr.length - wNoSurf.length) + "/" + wr.length + " · medians " + wr.map((r) => r.med.toFixed(2)).join(" ") + " · worst window " + Math.min(...wr.map((r) => r.surfWorst)).toFixed(2) + " s");
  fs.writeFileSync(path.join(OUT, "legibility.json"), JSON.stringify({ tree, base, worst: wr, tm, bm, lines: { BURIED, SURF, SURF_RUN, SURF_WIN } }, null, 1));
  return { ok: g1 && g2 && g3 && g4, treeMedian: tm, baseMedian: bm, buried, noSurf: noSurf.length };
}

// ---- 4. PERF per archetype (§6.3.4) ----
async function perfp1(browser) {
  const ZP = require("./zk-picture.js"), A = ZP.ARCHETYPES.map((a) => a.id);
  const items = [];
  for (const a of A) for (let i = 0; i < 3; i++) items.push(plainItem(0, 700 + i + 0.37, { force: { archetype: a }, label: a + "·" + i }));
  const drawnItems = []; for (let i = 0; i < 12; i++) drawnItems.push(plainItem(0, 800 + i + 0.37));
  const baseSrc = baseSetSource(BASE);
  const res = { tree: await runMulti(browser, items.concat(drawnItems), {}), base: await runMulti(browser, drawnItems, { baseSrc }),
                dpr2: await runMulti(browser, drawnItems.slice(0, 6), { dpr: 2 }), base2: await runMulti(browser, drawnItems.slice(0, 6), { baseSrc, dpr: 2 }) };
  const st = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return { n, mean: +(s.reduce((p, q) => p + q, 0) / n).toFixed(3), p95: +s[Math.floor(n * 0.95)].toFixed(2), p99: +s[Math.floor(n * 0.99)].toFixed(2), worst: +s[n - 1].toFixed(2) }; };
  const per = {}; res.tree.forEach((r) => { const k = r.label.split("·")[0]; if (A.indexOf(k) < 0) return; (per[k] = per[k] || []).push(...r.times.slice(1)); });
  console.log("  step cost per archetype, ms (tick + 5 passes + crack + glow; 3 receptions each, john-cage, dpr 1):");
  let ok = true;
  for (const k of A) { const s = st(per[k]); console.log("    " + k + " " + JSON.stringify(s)); }
  const all = (L) => L.flatMap((r) => r.times.slice(1));
  const T = st(all(res.tree.filter((r) => A.indexOf(r.label.split("·")[0]) < 0))), Bs = st(all(res.base)), T2 = st(all(res.dpr2)), B2 = st(all(res.base2));
  console.log("  drawn, dpr 1: tree " + JSON.stringify(T) + " · rc.91 " + JSON.stringify(Bs));
  console.log("  drawn, dpr 2: tree " + JSON.stringify(T2) + " · rc.91 " + JSON.stringify(B2));
  const worstArch = Math.max(...A.map((k) => st(per[k]).mean));
  // the plan's "≤ 6 ms worst" is a laptop figure; on this machine under load
  // rc.91 itself misses it, so the tail gate is p99 ≤ 6 ms OR within 10 % of
  // rc.91's p99 measured in the same run (stated in the handoff)
  const g1 = Math.max(T.mean, T2.mean, worstArch) <= 2.5, g2 = T.p99 <= Math.max(6, Bs.p99 * 1.1) && T2.p99 <= Math.max(6, B2.p99 * 1.1);
  ok = g1 && g2;
  console.log("  " + (g1 ? "✓" : "✗") + " mean ≤ 2.5 ms (worst archetype " + worstArch.toFixed(3) + ", drawn dpr1 " + T.mean + ", dpr2 " + T2.mean + ")");
  console.log("  " + (g2 ? "✓" : "✗") + " p99 ≤ 6 ms or ≤ 1.1 × rc.91's in the same run (dpr1 " + T.p99 + " vs " + Bs.p99 + ", dpr2 " + T2.p99 + " vs " + B2.p99 + "); single worst frames " + T.worst + " / " + T2.worst + " vs rc.91's " + Bs.worst + " / " + B2.worst + " under the same load (os.loadavg " + os.loadavg().map((x) => x.toFixed(0)).join(" ") + ")");
  console.log("  the low-power path: the same step at half rate (zk-set.js loop: frameN % 2) — its per-step cost is the figure above; nothing new runs only there");
  return { ok, T, Bs, T2, B2, per: Object.fromEntries(A.map((k) => [k, st(per[k])])) };
}

// ---- 5. 光 THE CRACK'S LIGHT ----
// Four things, each with a proof that it can fail (d. below, r2):
//  a. the glow layer (what compose() adds along the crack) against the
//     picture it is lifted from, every frame of an idle tube (test card and
//     Paik's line included), a reception and the dead tube after it: where the
//     picture under the crack is dark (G ≤ 30 of 255) the glow is 0 in every
//     channel; everywhere it is at most the cube of the picture (×1.03 + 4 for
//     the 8-bit rounding of two multiplies); on a bright picture it lights.
//  b. the canvas on an idle tube: the crack's pixels carry no more green than
//     the tube beside them; rc.91's constant stroke, put back, is caught.
//  c. the SVG alone (canvas, scanlines and glass hidden, the tube black): the
//     glass's room light has no green in it; C's original green-white, put
//     back, is caught.
function PAGE_CRACK(reels) {
  return (async function () {
    var ZS = window.ZankyoSet, D = ZS._dev, out = [], tm = D.clock(), dt = 1000 / 30;
    function rec(tag) { var g = D.glow(); out.push([tag, ZS.getState().phase, g.max[0], g.max[1], g.max[2], g.pic, D.idle.lineAt >= 0 ? 1 : 0, D.idle.cardAt >= 0 ? 1 : 0]); }
    for (var i = 0; i < 20 * 30; i++) { tm += dt; D.step(tm); rec("idle"); }
    var v = document.createElement("video"); v.muted = true; v.preload = "auto";
    await new Promise(function (r) { v.addEventListener("loadeddata", r, { once: true }); v.src = "broadcast/reels/" + reels[1].id + ".mp4"; });
    await new Promise(function (r) { v.addEventListener("seeked", r, { once: true }); v.currentTime = reels[1].at; });
    D.seedTexture(9); D.force(null);
    var t0 = tm / 1000 + 0.2, P = { body: "jou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 1.2, segments: [{ onS: 5, lockS: 0, atS: 0.4, lockAtS: 0.4 }], gaps: [], holes: [], glimpses: null, lossAtS: 5.4, spanS: 6.6, presenceS: 5 };
    ZS.signal({ t0: t0, holdS: 5, lossD: 1.2, drops: [], seed: 42, id: "crack", rx: P, video: v });
    while (tm / 1000 < t0 + 6.6 + 0.42 + 0.32 + 1.6 + 1.5) { tm += dt; D.step(tm); rec("rx"); }
    return out;
  })();
}
// green excess G − max(R,B) on the crack's core vs within 6 px beside it, from
// a PNG (a DOM screenshot) or from the tube canvas itself
function PAGE_CHROMA(b64) {
  function measure(d, w, h) {
    var m = ZankyoSet._dev.buffers().mask, mc = m.getContext("2d").getImageData(0, 0, m.width, m.height).data;
    var W = Math.min(w, m.width), H = Math.min(h, m.height), near = new Uint8Array(W * H), y, i;
    for (y = 0; y < H; y++) for (i = 0; i < W; i++) if (mc[(y * m.width + i) * 4 + 3] > 200) { for (var dy = -6; dy <= 6; dy++) for (var dx = -6; dx <= 6; dx++) { var yy = y + dy, xx = i + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) near[yy * W + xx] = 1; } }
    var cs = 0, cn = 0, ns = 0, nn = 0, cmax = -1e9, cl = 0, nl = 0;
    for (y = 0; y < H; y++) for (i = 0; i < W; i++) {
      var q = (y * w + i) * 4, a = mc[(y * m.width + i) * 4 + 3], ge = d[q + 1] - Math.max(d[q], d[q + 2]);
      if (a > 200) { cs += ge; cn++; cl += d[q + 1]; if (ge > cmax) cmax = ge; }
      else if (a === 0 && near[y * W + i]) { ns += ge; nn++; nl += d[q + 1]; }
    }
    return { crackExcess: cs / cn, nearExcess: ns / nn, crackMaxExcess: cmax, crackG: cl / cn, nearG: nl / nn, nCrack: cn, nNear: nn };
  }
  if (!b64) { var cv = document.getElementById("zankyo-set"); return Promise.resolve(measure(cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height)); }
  return new Promise(function (res) {
    var img = new Image();
    img.onload = function () { var c = document.createElement("canvas"); c.width = img.width; c.height = img.height; var x = c.getContext("2d"); x.drawImage(img, 0, 0); res(measure(x.getImageData(0, 0, c.width, c.height).data, c.width, c.height)); };
    img.src = "data:image/png;base64," + b64;
  });
}
// d. (critic P1 r1 item 2) the mask follows the run weights: for every
//    dead-end hairline (crack i ≥ 4) the mask's mean alpha along its LAST run
//    is ≤ MASK_TIP × that along its FIRST run — sampled every 0.5 px along the
//    run's own centreline, nearest mask pixel. rc.P1's one-weight mask, put
//    back (_dev.maskFlat), must fail it.
const MASK_TIP = 0.3;
function PAGE_MASKRUNS() {
  var D = ZankyoSet._dev, m = D.buffers().mask, md = m.getContext("2d").getImageData(0, 0, m.width, m.height).data, out = [];
  function along(pts) {
    var s = 0, n = 0;
    for (var j = 1; j < pts.length; j++) {
      var a = pts[j - 1], b = pts[j], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / 0.5));
      for (var q = (j === 1 ? 0 : 1); q <= k; q++) { var x = Math.round(a[0] + (b[0] - a[0]) * q / k - 0.5), y = Math.round(a[1] + (b[1] - a[1]) * q / k - 0.5); if (x >= 0 && y >= 0 && x < m.width && y < m.height) { s += md[(y * m.width + x) * 4 + 3] / 255; n++; } }
    }
    return n ? s / n : 0;
  }
  D.crackRuns().forEach(function (rs, i) { if (rs[0].deep) return; out.push({ i: i, n: rs.length, first: along(rs[0].pts), last: along(rs[rs.length - 1].pts), wFirst: rs[0].w, wLast: rs[rs.length - 1].w }); });
  return out;
}
async function crack(browser) {
  const page = await openPage(browser, {});
  let ok = true;
  const say = (g, s) => { ok = ok && g; console.log("  " + (g ? "✓" : "✗") + " " + s); };
  try {
    // d. the mask follows the run weights (every pattern), and the proof it can fail
    const night = await page.eval("ZankyoSet.getState().pattern");
    for (const flat of [false, true]) {
      const rows = [];
      for (let pi = 0; pi < 4; pi++) { await page.eval("ZankyoSet._dev.maskFlat(" + flat + ");ZankyoSet._dev.setPattern(" + pi + ")"); (await page.eval("(" + PAGE_MASKRUNS.toString() + ")()")).forEach((r) => rows.push(Object.assign({ pat: "ABCD"[pi] }, r))); }
      const ratio = (r) => r.last / Math.max(1e-9, r.first), worst = Math.max(...rows.map(ratio));
      const txt = rows.map((r) => r.pat + r.i + " " + r.first.toFixed(3) + "→" + r.last.toFixed(3) + " (" + ratio(r).toFixed(2) + ")").join(" · ");
      if (!flat) say(worst <= MASK_TIP, "the light follows the run weights: every dead-end hairline's last run carries ≤ " + MASK_TIP + " × its first run's mean mask alpha — worst " + worst.toFixed(3) + " over " + rows.length + " hairlines in 4 patterns: " + txt);
      else say(worst > MASK_TIP, "sensitivity: rc.P1's one-weight mask put back → worst ratio " + worst.toFixed(3) + " — " + (worst > MASK_TIP ? "caught" : "THE CHECK IS BLIND") + ": " + txt);
    }
    await page.eval("ZankyoSet._dev.maskFlat(false);ZankyoSet._dev.setPattern(" + night + ")");   // a. runs on the night's own pattern, as before
    await page.eval("ZankyoSet._dev.seedTexture(3)");
    const r = await page.eval("(" + PAGE_CRACK.toString() + ")(" + JSON.stringify(REELS) + ")", 600000);
    // a. the glow against its source
    const dark = r.filter((f) => f[5] <= 30), darkMax = Math.max(0, ...dark.map((f) => Math.max(f[2], f[3], f[4])));
    const over = r.filter((f) => f[3] > 255 * Math.pow(f[5] / 255, 3) * 1.03 + 4);   // 8-bit rounding in two multiplies: +3 %, +4
    const idleDark = r.filter((f) => f[0] === "idle" && f[5] <= 30).length, idleN = r.filter((f) => f[0] === "idle").length;
    const deadF = r.filter((f) => f[1] === "dead"), deadDark = deadF.filter((f) => f[5] <= 30);
    const hold = r.filter((f) => f[1] === "hold"), holdLit = hold.filter((f) => f[3] > 0).length, holdMax = Math.max(...hold.map((f) => f[3]));
    say(darkMax === 0, "a dark picture under the crack (G ≤ 30) lifts no light: " + dark.length + " such frames, the glow's largest value in any channel " + darkMax + " (must be 0) — idle " + idleDark + "/" + idleN + " frames dark (the rest carry the test card or Paik's line and its afterglow), dead " + deadDark.length + "/" + deadF.length + " (the rest still hold the burst's afterglow)");
    if (over.length) console.log("    over: " + JSON.stringify(over.slice(0, 8)));
    say(over.length === 0, "the glow never exceeds the cube of the picture it is lifted from (×1.03 + 4, the 8-bit rounding of two multiplies): " + over.length + " frames over, of " + r.length);
    say(holdLit === hold.length && holdMax >= 64, "a bright picture (bbc1 @12 s) lights the break on " + holdLit + "/" + hold.length + " hold frames, max G " + holdMax + " (≥ 64)");
    const rect = async () => page.eval("(function(){var r=document.getElementById('zankyo-set').getBoundingClientRect();return {x:r.left+window.scrollX,y:r.top+window.scrollY,w:r.width,h:r.height};})()");
    const shoot = async (name) => { await page.eval("document.getElementById('zankyo-set').scrollIntoView({block:'center'})"); const rr = await rect(); const sh = await page.send("Page.captureScreenshot", { format: "png", clip: { x: rr.x, y: rr.y, width: rr.w, height: rr.h, scale: 1 }, captureBeyondViewport: true }); if (name) fs.writeFileSync(path.join(OUT, name), Buffer.from(sh.data, "base64")); return sh.data; };
    const settle = (extra) => page.eval("(function(){var D=ZankyoSet._dev;D.idle.nextLine=1e12;D.idle.nextCard=1e12;D.idle.lineAt=-1;D.idle.cardAt=-1;" + (extra || "") + "var t=D.clock();for(var i=0;i<45;i++){t+=33.3;D.step(t);}})()");
    // b. the canvas, idle, every pattern
    for (let pi = 0; pi < 4; pi++) {
      await settle("D.setPattern(" + pi + ");");
      const c = await page.eval("(" + PAGE_CHROMA.toString() + ")(null)");
      await shoot("crack-idle-" + "ABCD"[pi] + ".png");
      say(c.crackExcess <= c.nearExcess + 0.5, "pattern " + "ABCD"[pi] + ", idle canvas: green excess on the crack " + c.crackExcess.toFixed(2) + " vs beside it " + c.nearExcess.toFixed(2) + " (mean G " + c.crackG.toFixed(1) + " vs " + c.nearG.toFixed(1) + ", " + c.nCrack + " crack pixels)");
    }
    await settle("D.setPattern(0);D.setGlow('rc91');");
    { const c = await page.eval("(" + PAGE_CHROMA.toString() + ")(null)"); await shoot("crack-idle-A-rc91-stroke.png");
      say(c.crackExcess > c.nearExcess + 0.5, "sensitivity: rc.91's green stroke put back → the idle canvas's crack " + c.crackExcess.toFixed(2) + " vs beside " + c.nearExcess.toFixed(2) + " (mean G " + c.crackG.toFixed(1) + " vs " + c.nearG.toFixed(1) + ") — " + (c.crackExcess > c.nearExcess + 0.5 ? "caught" : "THE CHECK IS BLIND")); }
    await settle("D.setGlow(true);");
    // c. the SVG alone
    const hideRest = "(function(){var t=document.getElementById('zankyo-tube');t.dataset.bg=t.style.background;t.style.background='#000';t.style.boxShadow='none';Array.prototype.forEach.call(t.children,function(c){if(!c.classList.contains('zk-crack'))c.style.visibility='hidden';});})()";
    const showRest = "(function(){var t=document.getElementById('zankyo-tube');t.style.background='';t.style.boxShadow='';Array.prototype.forEach.call(t.children,function(c){c.style.visibility='';});})()";
    await page.eval(hideRest);
    for (let pi = 0; pi < 4; pi++) {
      await page.eval("ZankyoSet._dev.setPattern(" + pi + ")");
      const c = await page.eval("(" + PAGE_CHROMA.toString() + ")(" + JSON.stringify(await shoot("crack-svg-alone-" + "ABCD"[pi] + ".png")) + ")", 120000);
      say(c.crackMaxExcess <= 1 && c.crackExcess <= c.nearExcess + 0.5, "pattern " + "ABCD"[pi] + ", the SVG alone on black: green excess on the crack mean " + c.crackExcess.toFixed(2) + ", max " + c.crackMaxExcess + " (≤ 1) · beside " + c.nearExcess.toFixed(2));
    }
    await page.eval("ZankyoSet._dev.setPattern(0);ZankyoSet._dev.crackColors('235,250,240','230,245,235','120,140,120')");
    { const c = await page.eval("(" + PAGE_CHROMA.toString() + ")(" + JSON.stringify(await shoot("crack-svg-alone-A-mockup-C-colours.png")) + ")", 120000);
      say(c.crackMaxExcess > 1, "sensitivity: C's original green-white put back → the SVG's crack excess mean " + c.crackExcess.toFixed(2) + ", max " + c.crackMaxExcess + " — " + (c.crackMaxExcess > 1 ? "caught" : "THE CHECK IS BLIND")); }
    await page.eval("ZankyoSet._dev.crackColors('236,240,242','226,230,232','128,132,134')");
    await page.eval(showRest);
    if (page.errors.length) { ok = false; console.log("  ✗ page errors: " + page.errors.join(" | ")); }
    return { ok, darkMax, holdMax, over: over.length };
  } finally { await page.closeTarget(); }
}

// ---- 5b. THE PHASE MACHINE: frame counts per phase, every fixture shape, tree
// vs rc.91. The one intended difference is the 断 fix (a piece occupies
// onS + holeS: its last holeS seconds are HOLD now, not loss); every other
// phase of every shape must match rc.91 to the frame (the receiver's timings
// do not move, §2.3).
async function phases(browser) {
  const items = FIXTURES.map((fx, i) => ({ reel: fx.reel, seed: fx.seed, texture: 5 + i, rx: fx.rx, drops: fx.drops, label: fx.name }));
  const tree = await runMulti(browser, items, {}), base = await runMulti(browser, items, { baseSrc: baseSetSource(BASE) });
  let ok = true;
  for (let i = 0; i < items.length; i++) {
    const t = tree[i].phases, b = base[i].phases, keys = Array.from(new Set(Object.keys(t).concat(Object.keys(b))));
    const diff = keys.filter((k) => (t[k] || 0) !== (b[k] || 0));
    const dan = items[i].rx.body === "dan";
    const expect = dan ? diff.every((k) => k === "hold" || k === "loss") && (t.loss || 0) < (b.loss || 0) && (t.hold || 0) - (b.hold || 0) === (b.loss || 0) - (t.loss || 0) : diff.length === 0;
    ok = ok && expect;
    console.log("  " + (expect ? "✓" : "✗") + " " + items[i].label.padEnd(12) + " tree " + keys.map((k) => k + ":" + (t[k] || 0)).join(" ") + (diff.length ? "  · rc.91 differs on " + diff.map((k) => k + " " + (b[k] || 0)).join(", ") + (dan ? " — the 断 tail, now hold (loss " + (b.loss || 0) + " → " + (t.loss || 0) + " frames; the plan's exit is " + items[i].rx.exitS + " s = " + Math.round(items[i].rx.exitS * FPS) + ")" : "") : "  · identical to rc.91"));
  }
  return { ok };
}

// ---- 6. CONTACT SHEETS ----
function PAGE_SHEET(tiles, cols, label) {
  return (function () {
    var imgs = tiles.map(function (t) { var i = new Image(); i.src = t.png; return { i: i, cap: t.cap }; });
    return Promise.all(imgs.map(function (o) { return new Promise(function (r) { if (o.i.complete) r(); else o.i.onload = r; }); })).then(function () {
      var w = Math.round(imgs[0].i.width / 2), h = Math.round(imgs[0].i.height / 2), rows = Math.ceil(imgs.length / cols);
      var c = document.createElement("canvas"); c.width = w * cols; c.height = h * rows + 18; var x = c.getContext("2d");
      x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
      imgs.forEach(function (o, k) { x.drawImage(o.i, (k % cols) * w, Math.floor(k / cols) * h, w, h); x.fillStyle = "rgba(200,255,210,0.85)"; x.font = "11px monospace"; x.fillText(o.cap, (k % cols) * w + 6, Math.floor(k / cols) * h + 14); });
      x.fillStyle = "#9a9"; x.fillText(label, 6, h * rows + 13);
      return c.toDataURL("image/jpeg", 0.86);
    });
  })();
}
async function sheets(browser) {
  const ZP = require("./zk-picture.js");
  const items = [];
  for (let r = 0; r < REELS.length; r++) for (let s = 0; s < 12; s++) items.push(plainItem(r, 211 + s + 0.37, { pngAt: 3 }));
  ZP.ARCHETYPES.forEach((a, k) => items.push(plainItem(0, 311.37 + k, { force: { archetype: a.id, sev: 0.65 }, pngAt: 3.6, label: a.id })));
  const res = await runMulti(browser, items, {});
  const page = await openPage(browser, {});
  try {
    for (let r = 0; r < REELS.length; r++) {
      const tiles = res.filter((x) => x.reel === r && !ZP.ARCHETYPES.some((a) => a.id === x.label)).map((x) => ({ png: x.pngs[0], cap: "seed " + x.seed + " · " + x.character.archetype + (x.character.tier === "uncommon" ? " +" : "") }));
      const j = await page.eval("(" + PAGE_SHEET.toString() + ")(" + JSON.stringify(tiles) + ",4," + JSON.stringify("P1 · " + REELS[r].id + " @" + REELS[r].at + " s · 12 drawn receptions, 3 s into the hold · texture seeded") + ")", 120000);
      fs.writeFileSync(path.join(OUT, "P1-drawn-" + REELS[r].id + ".jpg"), Buffer.from(j.split(",")[1], "base64"));
    }
    const at = res.filter((x) => ZP.ARCHETYPES.some((a) => a.id === x.label)).map((x) => ({ png: x.pngs[0], cap: x.label + " · sev " + x.character.sev.toFixed(2) }));
    const j = await page.eval("(" + PAGE_SHEET.toString() + ")(" + JSON.stringify(at) + ",4," + JSON.stringify("P1 · the 8 archetypes, forced at sev 0.65, john-cage-interview, seeds 311.37 + k, 3.6 s into the hold") + ")", 120000);
    fs.writeFileSync(path.join(OUT, "P1-archetypes.jpg"), Buffer.from(j.split(",")[1], "base64"));
    // the crack, the whole DOM stack, on a lit picture (bbc1 @12 s and john-cage @20 s), patterns A and D
    for (const [ri, pi] of [[1, 0], [1, 3], [0, 0], [0, 3]]) {
      await page.eval("(async function(){var D=ZankyoSet._dev,ZS=ZankyoSet;D.setPattern(" + pi + ");D.seedTexture(4);D.force({archetype:'清'});var v=document.createElement('video');v.muted=true;v.preload='auto';await new Promise(function(r){v.addEventListener('loadeddata',r,{once:true});v.src='broadcast/reels/" + REELS[ri].id + ".mp4';});await new Promise(function(r){v.addEventListener('seeked',r,{once:true});v.currentTime=" + REELS[ri].at + ";});var tm=D.clock()+33.3;D.step(tm);var t0=tm/1000+0.2;var P={body:'jou',entry:'soku',exit:'setsu',entryS:0.4,exitS:1,segments:[{onS:4,lockS:0,atS:0.4,lockAtS:0.4}],gaps:[],holes:[],glimpses:null,lossAtS:4.4,spanS:5.4,presenceS:4};ZS.signal({t0:t0,holdS:4,lossD:1,drops:[],seed:7,id:'lit',rx:P,video:v});while(tm/1000<t0+2.4){tm+=33.3;D.step(tm);}})()", 120000);
      await page.eval("document.getElementById('zankyo-set').scrollIntoView({block:'center'})");
      const rr = await page.eval("(function(){var r=document.getElementById('zankyo-set').getBoundingClientRect();return {x:r.left+window.scrollX,y:r.top+window.scrollY,w:r.width,h:r.height};})()");
      const sh = await page.send("Page.captureScreenshot", { format: "png", clip: { x: rr.x, y: rr.y, width: rr.w, height: rr.h, scale: 1 }, captureBeyondViewport: true });
      fs.writeFileSync(path.join(OUT, "crack-lit-" + "ABCD"[pi] + "-" + REELS[ri].id + ".png"), Buffer.from(sh.data, "base64"));
      await page.eval("(function(){var D=ZankyoSet._dev;D.force(null);var t=D.clock();for(var i=0;i<200&&ZankyoSet.getState().phase!=='idle';i++){t+=33.3;D.step(t);}})()");
    }
  } finally { await page.closeTarget(); }
  console.log("  sheets written to " + OUT);
  return { ok: true };
}

// ---- 5c. THE LULL'S SHAPE (critic P1 r1, required item 1). §11.2 asks that
// even the most buried reception lets "a face or a shape" rise "out of the
// noise for a moment and sink back" — a surfacing, not a clearing. The
// legibility mode proves the picture comes up; this mode measures HOW FAR and
// HOW OFTEN, and proves the surfacing gate is live:
//  · as built — 遠 and 嵐 forced at sev 1 (legibility's 24): every one must
//    still surface, and the median share of hold frames at SSIM ≥ NEAR_CLEAN
//    (a picture you would call clean) must be ≤ NEAR_CLEAN_SHARE;
//  · lull off (force axes { lull: null }) — the sensitivity: surfacing must
//    FAIL somewhere, or the surfacing gate is not measuring the lull;
//  · incidence — the share of drawn receptions (20,000, node) that carry a
//    lull, reported against LULL_SHARE (a lull on a reception that surfaces
//    without one only makes every tube pulse alike).
// rc.P1 (8fcd38a) as the critic measured it: near-clean median 0.38, max
// 0.90; lull off 10/24 surface (the gate is live); incidence 68.5 %.
// r2 adds: the CV of successive lull gaps over one 30 s hold (median ≥
// LULL_CV over every lulled drawn reception; rc.P1's fixed period reads 0),
// and the schedule's own guarantee (≥ 0.6 s of lull flat in every 5 s),
// both node-side from ZP.lullSchedule; --axes merges dev axes over both
// variants. In p1 since r2.
const NEAR_CLEAN = 0.7, NEAR_CLEAN_SHARE = 0.15, LULL_SHARE = 0.35, LULL_CV = 0.25;
async function lullShape(browser) {
  let ok = true;
  const say = (g, s) => { ok = ok && g; console.log("  " + (g ? "✓" : "✗") + " " + s); };
  const extra = JSON.parse(opt("axes", "{}"));                // dev: axes merged over both variants (e.g. '{"swell":{"amt":0}}')
  const variants = [["as built", Object.assign({}, extra)], ["lull off", Object.assign({}, extra, { lull: null })]], out = {};
  for (const [name, axes] of variants) {
    const items = [cleanItem(0)];
    for (const a of ["遠", "嵐"]) for (let i = 0; i < 12; i++) items.push(plainItem(0, 501 + i + 0.37, { force: { archetype: a, sev: 1, axes: axes }, label: a + "·sev1·" + i }));
    const rows = legRows(await runMulti(browser, items, {}));
    const hi = rows.map((r) => { const v = r.trace.filter((t) => !t[2]).map((t) => t[1]); return v.filter((x) => x >= NEAR_CLEAN).length / Math.max(1, v.length); });
    const fails = rows.filter((r) => !r.surf);
    out[name] = { surfaced: rows.length - fails.length, n: rows.length, worst: Math.min(...rows.map((r) => r.surfWorst)), nearCleanMedian: median(hi), nearCleanMax: Math.max(...hi) };
    fs.writeFileSync(path.join(OUT, "lull-" + (name === "as built" ? "built" : "off") + ".json"), JSON.stringify(rows, null, 1));
    if (fails.length) console.log("    not surfacing: " + fails.map((r) => r.label + " worst " + r.surfWorst + " med " + r.med).join(", "));
    console.log("  " + name + ": " + out[name].surfaced + "/" + rows.length + " surface · worst window " + out[name].worst.toFixed(2) + " s · share of hold at SSIM ≥ " + NEAR_CLEAN + ": median " + median(hi).toFixed(2) + ", max " + Math.max(...hi).toFixed(2));
  }
  say(out["as built"].surfaced === out["as built"].n, "遠 and 嵐 at sev 1 all surface (" + out["as built"].surfaced + "/" + out["as built"].n + ")");
  say(out["as built"].nearCleanMedian <= NEAR_CLEAN_SHARE, "a surfacing, not a clearing: median share of hold near clean (SSIM ≥ " + NEAR_CLEAN + ") " + out["as built"].nearCleanMedian.toFixed(2) + " (≤ " + NEAR_CLEAN_SHARE + ")");
  say(out["lull off"].surfaced < out["lull off"].n, "sensitivity: with the lull off the surfacing gate fails (" + out["lull off"].surfaced + "/" + out["lull off"].n + " surface) — " + (out["lull off"].surfaced < out["lull off"].n ? "the gate is live" : "THE GATE IS BLIND"));
  delete require.cache[require.resolve("./zk-picture.js")];
  const ZP = require("./zk-picture.js"), Rand = loadRand();
  let withL = 0, N = 0; const by = {}, cvRest = [], cvStart = [], perHold = []; let worstFlat = Infinity;
  const cv = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length) / m; };
  for (const S of SEED_SETS) { const m = Rand.stream(S), dsr = Rand.stream(S).fork("probe:desc"); for (let r = 0; r < 500; r++) {
    const ch = ZP.drawCharacter(m.fork("set:rx:" + dsr.next() * 1000), {}); N++;
    by[ch.archetype] = by[ch.archetype] || [0, 0]; by[ch.archetype][1]++;
    if (!ch.lull) continue;
    withL++; by[ch.archetype][0]++;
    // the timing over one 30 s hold: the gaps (one lull's end to the next's
    // start), the start-to-start intervals, and the guarantee (≥ 0.6 s of
    // flat in every 5 s window), from the schedule itself
    const all = ZP.lullSchedule(ch.lull, 30), sc = all.filter((e) => e[0] < 30), rest = [], iv = [];
    for (let i = 1; i < sc.length; i++) { rest.push(sc[i][0] - sc[i - 1][3]); iv.push(sc[i][0] - sc[i - 1][0]); }
    cvRest.push(cv(rest)); cvStart.push(cv(iv)); perHold.push(sc.length);
    for (let w = 0; w + 5 <= 30; w += 0.05) { let b = 0; for (const e of all) { const a = Math.max(e[1], w), z = Math.min(e[2], w + 5); if (z - a > b) b = z - a; } if (b < worstFlat) worstFlat = b; }
  } }
  say(withL / N <= LULL_SHARE, "incidence: " + (withL / N * 100).toFixed(1) + " % of " + N + " drawn receptions carry a lull (≤ " + (LULL_SHARE * 100) + " %) — " + Object.keys(by).map((k) => k + " " + (by[k][0] / by[k][1] * 100).toFixed(0) + " %").join(" · "));
  const md = median(cvRest), p5 = pct(cvRest, 0.05);
  say(md >= LULL_CV, "irregular: CV of successive lull gaps over one 30 s hold, " + cvRest.length + " lulled receptions — median " + md.toFixed(3) + ", p5 " + p5.toFixed(3) + ", min " + Math.min(...cvRest).toFixed(3) + " (median ≥ " + LULL_CV + "); start-to-start intervals median " + median(cvStart).toFixed(3) + ", p5 " + pct(cvStart, 0.05).toFixed(3) + "; lulls per 30 s " + Math.min(...perHold) + "–" + Math.max(...perHold) + " (median " + median(perHold) + ")");
  say(worstFlat >= SURF_RUN - 1e-9, "the schedule's guarantee: every 5 s window of the first 30 s of hold holds ≥ " + SURF_RUN + " s of lull flat — worst " + worstFlat.toFixed(2) + " s over " + cvRest.length + " receptions");
  // can the CV check fail? rc.P1's metronome (one period, one flat) reads 0
  { const T = 3.8, F = 1, rest = []; for (let i = 1; i < 8; i++) rest.push(T - F - 0.7); const c0 = rest.length > 1 ? cv(rest) : 0; say(!(c0 >= LULL_CV), "sensitivity: rc.P1's fixed period reads a gap CV of " + c0.toFixed(3) + " — " + (c0 >= LULL_CV ? "THE CHECK IS BLIND" : "caught")); }
  return Object.assign({ ok, incidence: withL / N, cvRestMedian: md, cvRestP5: p5, worstFlat }, out);
}

// ---- 6b. A STRIP (r2): one reception's hold as a 6-column film strip, a
// tile every --every s, each captioned with its time into the hold, the lull
// level (S.lull) and the carrier strength — so a strip shows WHEN the picture
// surfaces, and how far. The tube canvas as the page draws it (crack
// included), texture seeded, frame-stepped at 30 fps.
//   node _picture-probe.js strip --force '{"archetype":"遠","sev":1}' --reel 0 --seed 505.37 --hold 12 --every 0.5 --name P1-strip-far-遠
function PAGE_STRIP(reels, o) {
  return (async function () {
    var ZS = window.ZankyoSet, D = ZS._dev, tm = D.clock(), dt = 1000 / 30, tiles = [];
    var v = null;
    if (o.reel != null) {
      v = document.createElement("video"); v.muted = true; v.preload = "auto";
      await new Promise(function (r) { v.addEventListener("loadeddata", r, { once: true }); v.src = "broadcast/reels/" + reels[o.reel].id + ".mp4"; });
      await new Promise(function (r) { v.addEventListener("seeked", r, { once: true }); v.currentTime = reels[o.reel].at; });
    }
    D.seedTexture(o.texture); var fr = D.force(o.force || null); if (!fr.ok) throw new Error("force refused: " + fr.why);
    tm += dt; D.step(tm);
    var t0 = tm / 1000 + 0.2, P = { body: "jou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 1.2, segments: [{ onS: o.hold, lockS: 0, atS: 0.4, lockAtS: 0.4 }], gaps: [], holes: [], glimpses: null, lossAtS: 0.4 + o.hold, spanS: 1.6 + o.hold, presenceS: o.hold };
    var drops = (o.drops || []).map(function (d) { return [t0 + 0.4 + d[0], d[1]]; });
    ZS.signal({ t0: t0, holdS: o.hold, lossD: 1.2, drops: drops, seed: o.seed, id: "strip", rx: P, video: v });
    var cv = document.getElementById("zankyo-set"), next = 0.25;
    while (tm / 1000 < t0 + 0.4 + o.hold - 0.05) {
      tm += dt; var st = D.step(tm), e = tm / 1000 - t0 - 0.4;
      if (st.phase === "hold" && e >= next) { tiles.push({ png: cv.toDataURL("image/png"), cap: e.toFixed(1) + " s · lull " + D.buffers().lull.toFixed(2) + " · carrier " + st.strength.toFixed(2) }); next += o.every; }
    }
    var ch = D.character();
    var guard = 0; while (ZS.getState().phase !== "idle" && guard++ < 600) { tm += dt; D.step(tm); }
    D.force(null);
    return { tiles: tiles, ch: ch };
  })();
}
async function strip(browser) {
  const o = { force: JSON.parse(opt("force", "null")), reel: opt("reel", "0") === "card" ? null : +opt("reel", "0"), seed: +opt("seed", "505.37"), texture: +opt("texture", "11"), hold: +opt("hold", "12"), every: +opt("every", "0.5"), drops: JSON.parse(opt("drops", "[[1.9,0.2],[3.7,0.33],[5.2,0.14],[7.1,0.26]]")) };
  const name = opt("name", "strip");
  const page = await openPage(browser, {});
  try {
    const r = await page.eval("(" + PAGE_STRIP.toString() + ")(" + JSON.stringify(REELS) + "," + JSON.stringify(o) + ")", 600000);
    const c = r.ch, label = name + " · " + (o.reel == null ? "card" : REELS[o.reel].id + " @" + REELS[o.reel].at + " s") + " · seed " + o.seed + " · force " + JSON.stringify(o.force) + " · " + c.archetype + " sev " + c.sev + " · lull " + (c.lull ? "on (key " + c.lull.key + ")" : "none") + " · a tile every " + o.every + " s of hold";
    const j = await page.eval("(" + PAGE_SHEET.toString() + ")(" + JSON.stringify(r.tiles) + ",6," + JSON.stringify(label) + ")", 120000);
    fs.writeFileSync(path.join(OUT, name + ".jpg"), Buffer.from(j.split(",")[1], "base64"));
    console.log("  " + r.tiles.length + " tiles → " + path.join(OUT, name + ".jpg") + "\n  " + r.tiles.map((t) => t.cap).join(" | "));
    return { ok: true };
  } finally { await page.closeTarget(); }
}

// ---- 5d. THE LULL'S CALIBRATION (dev; r2): which receptions fail to surface
// WITHOUT a lull? Drawn receptions (calibration seeds, not the gates' own)
// on all three reels, and 遠/嵐 at sev 0.7–1, every one with the lull forced
// off; each row carries its character, so the rule that hands out lulls
// (ZP.needsLull) can be fitted and then checked against the gates' seeds.
async function lullcal(browser) {
  // --built: the lull as the rule hands it out (a VALIDATION run on fresh
  // seeds, --seed0 2001: every reception must surface); default: lull off
  const n = +opt("n", "40"), s0 = +opt("seed0", "1001"), built = argv.indexOf("--built") >= 0, items = [];
  const fz = (f) => built ? (Object.keys(f).length ? f : null) : Object.assign({}, f, { axes: { lull: null } });
  for (let r = 0; r < REELS.length; r++) { items.push(cleanItem(r)); for (let i = 0; i < n; i++) items.push(plainItem(r, s0 + i + 100 * r + 0.37, { force: fz({}) })); }
  for (const a of ["遠", "嵐"]) for (let i = 0; i < 12; i++) items.push(plainItem(i % 3, s0 + 600 + i + 0.37, { force: fz({ archetype: a, sev: 0.7 + 0.3 * (i % 4) / 3 }), label: a + "·cal·" + i }));
  const rows = legRows(await runMulti(browser, items, {}));
  delete require.cache[require.resolve("./zk-picture.js")];
  const ZP = require("./zk-picture.js");
  const out = rows.map((r) => ({ label: r.label, arch: r.arch, sev: r.sev, med: r.med, surf: r.surf, worst: r.surfWorst, need: ZP.needsLull ? ZP.needsLull(r.ch) : null, bury: ZP.burial ? +ZP.burial(r.ch).toFixed(4) : null, ch: r.ch }));
  fs.writeFileSync(path.join(OUT, "lullcal.json"), JSON.stringify(out, null, 1));
  const fail = out.filter((r) => !r.surf), missed = built ? fail : fail.filter((r) => r.need === false);
  if (built) console.log("  VALIDATION (--built, seeds from " + s0 + "): " + (out.length - fail.length) + "/" + out.length + " surface · worst window " + Math.min(...out.map((r) => r.worst)) + " s · lulled " + out.filter((r) => r.ch && r.ch.lull).length + "/" + out.length);
  console.log("  " + out.length + " receptions, " + (built ? "lull as the rule hands it out" : "lull off") + ": " + fail.length + " fail to surface" + (ZP.needsLull ? " · needsLull covers " + (fail.length - missed.length) + "/" + fail.length + (missed.length ? " — MISSED: " + missed.map((r) => r.label + " " + r.arch + " bury " + r.bury).join(", ") : "") + " · hands a lull to " + out.filter((r) => r.need).length + "/" + out.length : ""));
  for (const r of out.slice().sort((a, b) => (b.bury || 0) - (a.bury || 0))) console.log("    " + (r.surf ? "  " : "✗ ") + r.label.padEnd(34) + " " + r.arch + " sev " + (r.sev != null ? r.sev.toFixed(2) : "-") + " med " + r.med.toFixed(3) + " worst " + r.worst + " bury " + r.bury + " need " + r.need);
  return { ok: missed.length === 0, fail: fail.length, missed: missed.length };
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
    if (MODE === "render" || MODE === "p1") { console.log("P1 · DOES EACH KIND RENDER (§6.3.2) + the JND"); report.render = await render(browser); ok = ok && report.render.ok; }
    if (MODE === "draws" || MODE === "p1") { console.log("P1 · THE CHARACTER DRAW (§6.3.1)"); report.draws = await draws(); ok = ok && report.draws.ok; }
    if (MODE === "legibility" || MODE === "p1") { console.log("P1 · LEGIBILITY AND SURFACING (§6.3.3, §11.2)"); report.legibility = await legibility(browser); ok = ok && report.legibility.ok; }
    if (MODE === "perfp1" || MODE === "p1") { console.log("P1 · PERF (§6.3.4)"); report.perfp1 = await perfp1(browser); ok = ok && report.perfp1.ok; }
    if (MODE === "crack" || MODE === "p1") { console.log("P1 · 光 THE CRACK'S LIGHT"); report.crack = await crack(browser); ok = ok && report.crack.ok; }
    if (MODE === "lullcal") { console.log("P1 · THE LULL'S CALIBRATION (dev)"); report.lullcal = await lullcal(browser); ok = ok && report.lullcal.ok; }
    if (MODE === "lull" || MODE === "p1") { console.log("P1 · THE LULL'S SHAPE (§11.2; critic P1 r1 item 1)"); report.lull = await lullShape(browser); ok = ok && report.lull.ok; }
    if (MODE === "phases" || MODE === "p1") { console.log("P1 · THE PHASE MACHINE (the 断 tail fix, the relock; every fixture shape, tree vs rc.91)"); report.phases = await phases(browser); ok = ok && report.phases.ok; }
    if (MODE === "strip") { console.log("P1 · A STRIP"); report.strip = await strip(browser); }
    if (MODE === "sheets") { console.log("P1 · CONTACT SHEETS"); report.sheets = await sheets(browser); }
  } catch (e) { console.error("PROBE FAILED: " + (e && e.stack || e)); ok = false; }
  finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, "report-" + MODE + ".json"), JSON.stringify(report, null, 1));
  console.log(ok ? "GATE GREEN" : "GATE RED");
  process.exit(ok ? 0 : 1);
})();
