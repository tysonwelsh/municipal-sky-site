#!/usr/bin/env node
// KOLOB tools — pageload.js: the page's load, and the load guard in a browser.
//
// index.php hashes the assets for their ?v= and the build stamp (kolob_v(),
// each file once a request, or not at all with APCu), and prints the page's
// scripts deferred, the load guard among them as a module script that the
// browser runs after the rooms and before kolob-ui.js (PLAN-REFACTOR §4.1).
// This serves a build with php -S and loads it in muted headless Chrome
// (--mute-audio, always; PLAY is never pressed):
//   · php — the page fetched --requests times in a row: the median and p90 of
//     a request's wall time
//   · load — --runs cold loads (the browser's cache off; the Google Fonts
//     blocked, so the times are this server's and the browser's alone): the
//     medians of parsed (domInteractive), DOMContentLoaded, load, first paint
//     and first contentful paint, from the Performance API, counted from the
//     navigation's start
//   · whole — the page as served: KOLOB._broken unset, PLAY enabled, the
//     minutes waiting for PLAY, no console error
//   · <room> missing — the same page with one room answering 404 (a router
//     in front of php -S): the console says KOLOB AUDIO ENGINE FAILED TO LOAD
//     naming it, KOLOB._broken holds it, PLAY stays disabled and the minutes
//     say the engine failed to load
//
//   node tools/pageload.js [--root <dir>] [--missing kolob-calendar.js] [--runs 5] [--requests 200]
//        [--latency <ms> --kbps <n>] [--no-apcu] [--port 8117] [--chrome-port 9441]
//
// --root serves another tree for the before: a commit's page unpacked from
// `git archive <ref> art/kolob art/prosperos-jukebox-v2 art/background-audio.js
// includes css fonts`. --no-apcu serves without APCu (php -d apc.enabled=0),
// so the per-request cache is the one timed. --latency and --kbps emulate a
// slower network for the cold loads. Exit 1 when the guard does not do what it
// should, on either page.
"use strict";
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const U = require("./lib/util.js");
const C = require("./lib/chrome.js");

const HELP = `pageload.js — the page's load (PHP time, the browser's timings) and the load guard in muted headless Chrome
  --root <dir>             the tree to serve (default this repo); its art/kolob/ is the page
  --missing <room>         the room made to answer 404 for the guard's check (default kolob-calendar.js)
  --runs 5                 cold loads timed (default 5; 0 to skip)
  --requests 200           page requests timed against PHP (default 200; 0 to skip)
  --latency <ms> --kbps <n>  a slower network for the cold loads (Network.emulateNetworkConditions)
  --no-apcu                serve with php -d apc.enabled=0
  --port 8117              php -S for the page; the router for the missing room takes the next port
  --chrome-port 9441       Chrome's debugging port (another port brings its own profile)`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fetchOnce(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { agent: false }, (res) => {
      const bufs = [];
      res.on("data", (c) => bufs.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(bufs).toString("utf8") }));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error("timeout")));
  });
}

// php -S on the tree, with a router when a room is to be missing (the router
// answers 404 for it and hands every other request back to the server)
async function serve(root, port, phpArgs, missing) {
  const args = phpArgs.concat(["-S", "127.0.0.1:" + port, "-t", root]);
  if (missing) {
    const router = path.join(__dirname, "out", "pageload-router.php");
    fs.mkdirSync(path.dirname(router), { recursive: true });
    fs.writeFileSync(router, "<?php\n// tools/pageload.js: the room named in KOLOB_MISSING answers 404, as a file that is not there\n" +
      "if (basename(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)) === getenv('KOLOB_MISSING')) { http_response_code(404); echo 'missing'; return true; }\nreturn false;\n");
    args.push(router);
  }
  const proc = spawn("php", args, { stdio: ["ignore", "ignore", "pipe"], env: Object.assign({}, process.env, { KOLOB_MISSING: missing || "" }) });
  let err = "";
  proc.stderr.on("data", (d) => { err = (err + d).slice(-2000); });
  const base = "http://127.0.0.1:" + port;
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    try { if ((await fetchOnce(base + "/art/kolob/kolob-core.js")).status === 200) return { base, proc }; } catch (e) { /* not up yet: ask again */ }
  }
  proc.kill();
  throw new Error("php -S did not come up on " + port + " (is the port taken?): " + err.slice(-300));
}

// the guard's word, PLAY and the minutes, once the page has loaded
const STATE = "(function(){var K=window.KOLOB||{},p=document.getElementById('kolob-play'),m=document.querySelector('#kolob-log .kolob-log-empty');" +
  "return {broken:K._broken||null,facade:!!window.KolobAudio,play:p?(p.disabled?'disabled':'enabled'):'absent',minutes:m?m.textContent:null}})()";
const TIMES = "(function(){var n=performance.getEntriesByType('navigation')[0],p={};performance.getEntriesByType('paint').forEach(function(e){p[e.name]=e.startTime;});" +
  "return n&&n.loadEventStart>0?{parsed:n.domInteractive,dcl:n.domContentLoadedEventStart,load:n.loadEventStart,fp:p['first-paint'],fcp:p['first-contentful-paint']}:null})()";

// PHP: the page, one request after another (five first, to warm up)
async function phpTimes(url, n) {
  const ms = [];
  for (let i = 0; i < n + 5; i++) {
    const t0 = process.hrtime.bigint();
    const r = await fetchOnce(url);
    if (r.status !== 200) throw new Error("the page answered " + r.status);
    if (i >= 5) ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return "median " + U.fmt(U.median(ms), 2) + " ms, p90 " + U.fmt(U.quantile(ms, 0.9), 2) + " ms, min " + U.fmt(Math.min(...ms), 2) + ", max " + U.fmt(Math.max(...ms), 2);
}

// the browser: cold loads, timed (net: Network.emulateNetworkConditions, or null)
async function coldLoads(b, url, runs, net) {
  await b.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (net) await b.send("Network.emulateNetworkConditions", net);
  const got = [];
  for (let i = 0; i < runs; i++) {
    await b.send("Page.navigate", { url });
    await C.waitFor(b, "document.readyState === 'complete' && " + TIMES, 120000, 100);
    await sleep(300);                                 // (the paint entries land after the frame)
    got.push(await b.evalJS(TIMES));
  }
  if (net) await b.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await b.send("Network.setCacheDisabled", { cacheDisabled: false });
  const med = (k) => U.fmt(U.median(got.map((g) => g[k]).filter((x) => x != null)), 1) + " ms";
  return "parsed " + med("parsed") + " · DOMContentLoaded " + med("dcl") + " · load " + med("load") + " · first paint " + med("fp") + " · first contentful paint " + med("fcp");
}

// the page loaded, and what it says: the guard's word, PLAY, the minutes, the console
async function look(b, logs, url) {
  const from = logs.length;
  await b.send("Page.navigate", { url });
  await C.waitFor(b, "document.readyState === 'complete'", 30000, 100);
  await sleep(500);
  return { st: await b.evalJS(STATE), said: logs.slice(from) };
}
const brokenOf = (st) => (st.broken ? "= [" + st.broken.join(", ") + "]" : "unset");

// the switches, read
function options(argv) {
  const a = U.parseArgs(argv, ["help", "no-apcu"]);
  const lat = +a.latency || 0, kbps = +a.kbps || 0;
  return {
    help: !!a.help,
    root: path.resolve(a.root && a.root !== true ? String(a.root) : C.REPO),
    missing: a.missing && a.missing !== true ? String(a.missing) : "kolob-calendar.js",
    runs: a.runs != null ? +a.runs : 5, requests: a.requests != null ? +a.requests : 200,
    port: +a.port || 8117, chromePort: +a["chrome-port"] || 9441,
    phpArgs: a["no-apcu"] ? ["-d", "apc.enabled=0"] : [],
    net: lat || kbps ? { offline: false, latency: lat, downloadThroughput: kbps ? kbps * 125 : -1, uploadThroughput: kbps ? kbps * 125 : -1 } : null,
    netSaid: [lat ? lat + " ms latency" : "", kbps ? kbps + " kbit/s" : ""].filter(Boolean).join(", "),
  };
}

// the guard's verdict: the whole page (w) and the page with a room missing (g)
function judge(w, g, missing, L, fails) {
  // (not the page's: the fonts blocked here, and the browser's own ask for a favicon the site does not have)
  const wErr = w.said.filter((l) => l.kind !== "console.warning" && !/fonts\.googleapis|fonts\.gstatic|ERR_BLOCKED_BY_CLIENT|\/favicon\.ico/.test(l.text));
  L.push("  whole: KOLOB._broken " + brokenOf(w.st) + " · PLAY " + w.st.play + " · the minutes: " + JSON.stringify(w.st.minutes) + " · " + (wErr.length ? wErr.length + " console error(s): " + wErr.map((l) => l.text).join(" | ").slice(0, 300) : "no console error"));
  if (w.st.broken || !w.st.facade || w.st.play !== "enabled" || wErr.length) fails.push("the whole page did not load clean (KOLOB._broken unset, the facade up, PLAY enabled, no console error)");
  const told = g.said.find((l) => /KOLOB AUDIO ENGINE FAILED TO LOAD/.test(l.text));
  L.push("  " + missing + " missing: the console: " + (told ? JSON.stringify(told.text) : "no KOLOB AUDIO ENGINE FAILED TO LOAD") + " · KOLOB._broken " + brokenOf(g.st) + " · PLAY " + g.st.play + " · the minutes: " + JSON.stringify(g.st.minutes));
  const stopped = !!told && told.text.indexOf(missing) >= 0 && (g.st.broken || []).indexOf(missing) >= 0 && g.st.play === "disabled" && /ENGINE FAILED TO LOAD/i.test(g.st.minutes || "");
  if (!stopped) fails.push("with " + missing + " missing the guard did not stop PLAY (the console line naming it, KOLOB._broken holding it, PLAY disabled, the minutes saying the engine failed)");
}

(async () => {
  const o = options(process.argv.slice(2));
  if (o.help) { console.log(HELP); return; }
  if (!fs.existsSync(path.join(o.root, "art/kolob/index.php"))) { console.error("pageload.js: no art/kolob/index.php under " + o.root); process.exit(2); }
  const page = "/art/kolob/?seed=22&latin=1";         // (Latin: the minutes in words this can read)
  const whole = await serve(o.root, o.port, o.phpArgs, null), gone = await serve(o.root, o.port + 1, o.phpArgs, o.missing);
  const b = await C.launch({ port: o.chromePort });
  C.cleanupOnExit([b, whole.proc, gone.proc]);
  const logs = C.collectConsole(b);
  await C.prepare(b);
  // (and the Google Fonts: the timings are this server's and the browser's,
  // not a third party's — a box that cannot reach them waits on a refusal)
  await b.send("Network.setBlockedURLs", { urls: ["*page-event-tracking*", "*subscribe.php*", "*googletagmanager*", "*google-analytics*", "*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
  const fails = [], L = [];
  L.push("kolob pageload — " + o.root + " (php -S" + (o.phpArgs.length ? " " + o.phpArgs.join(" ") : "") + ", muted headless Chrome)");
  if (o.requests > 0) L.push("  php: " + o.requests + " requests of " + page + " — " + await phpTimes(whole.base + page, o.requests));
  if (o.runs > 0) L.push("  load: " + o.runs + " cold loads" + (o.net ? " (" + o.netSaid + ")" : "") + ", medians from the navigation's start — " + await coldLoads(b, whole.base + page, o.runs, o.net));
  judge(await look(b, logs, whole.base + page), await look(b, logs, gone.base + page), o.missing, L, fails);
  b.kill(); whole.proc.kill(); gone.proc.kill();
  if (fails.length) { L.push("  FAILED:"); fails.forEach((f) => L.push("   - " + f)); }
  else L.push("  ALL GREEN");
  console.log(L.join("\n"));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("pageload.js: " + (e.stack || e.message)); process.exit(2); });
