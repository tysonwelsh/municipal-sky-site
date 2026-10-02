// KOLOB tools — a local server and a MUTED headless Chrome over CDP.
//
// The owner's rule (SCORE §7, "silent testing"): an agent's browser must make
// no sound on the owner's speakers. Every Chrome this file launches carries
// --mute-audio, and launch() refuses to start one without it. Taps inside
// the page still hear the signal; the speakers do not.
//
// No packages: Node's built-in WebSocket speaks CDP.
"use strict";
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

// The Chrome to launch: KOLOB_CHROME if set, else the first of these that
// exists (the owner's Mac; a Playwright chromium on a Linux box or in CI;
// the distro's own). (2026-10-01: it was the Mac path alone.)
const os = require("os");
const CHROME_CANDIDATES = [
  process.env.KOLOB_CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  process.env.PLAYWRIGHT_BROWSERS_PATH && (function () {
    try { const d = fs.readdirSync(process.env.PLAYWRIGHT_BROWSERS_PATH).filter((n) => /^chromium-\d+$/.test(n)).sort().pop(); return d && path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, d, "chrome-linux", "chrome"); } catch (e) { return null; }
  })(),
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } }) || CHROME_CANDIDATES[0];
const DEFAULT_CHROME_PORT = 9423;
const DEFAULT_PROFILE = path.join(os.tmpdir(), "kolob-r2-tools-chrome");
const DEFAULT_HTTP_PORT = 8113;
const REPO = path.resolve(__dirname, "..", "..", "..", "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const bufs = [];
      res.on("data", (c) => bufs.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(bufs) }));
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs || 3000, () => req.destroy(new Error("timeout")));
  });
}

// Serve the worktree on 127.0.0.1:<port> — or use what is already there, but
// only if it serves THIS tree (the engine's bytes must match), never another
// worktree's by accident.
async function ensureServer(opts) {
  const port = opts.port || DEFAULT_HTTP_PORT, root = opts.root || REPO;
  const base = "http://127.0.0.1:" + port;
  const probe = "/art/kolob/kolob-core.js";
  const local = fs.readFileSync(path.join(root, probe));
  try {
    const r = await get(base + probe, 1500);
    if (r.status === 200 && Buffer.compare(r.body, local) === 0) return { base, proc: null, reused: true };
    throw new Error("port " + port + " is serving a different tree (its kolob-core.js differs from " + root + "); pick another --port");
  } catch (e) {
    if (/different tree/.test(e.message)) throw e;
  }
  const proc = spawn("php", ["-S", "127.0.0.1:" + port, "-t", root], { stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  proc.stderr.on("data", (d) => { err += d; if (err.length > 4000) err = err.slice(-4000); });
  for (let i = 0; i < 40; i++) {
    await sleep(150);
    try { const r = await get(base + probe, 1000); if (r.status === 200) return { base, proc, reused: false }; } catch (e) { /* not up yet: ask again */ }
  }
  proc.kill();
  throw new Error("php -S did not come up on " + port + ": " + err.slice(-300));
}

// The profile follows the port unless one is named: two runs on two ports
// never share a profile (a second Chrome on a profile in use hands itself to
// the first and quits, and the run waits for a browser that never comes).
function profileFor(port, named) {
  if (named && named !== true) return path.resolve(String(named));
  return port === DEFAULT_CHROME_PORT ? DEFAULT_PROFILE : DEFAULT_PROFILE + "-" + port;
}
// Is another Chrome holding this profile? (its SingletonLock names host-pid)
function profileHolder(profile) {
  try {
    const pid = +String(fs.readlinkSync(path.join(profile, "SingletonLock"))).split("-").pop();
    if (pid > 0) { process.kill(pid, 0); return pid; }
  } catch (e) { /* no lock, or its holder is gone: nobody holds it */ }
  return null;
}

async function launch(opts) {
  const port = (opts && opts.port) || DEFAULT_CHROME_PORT;
  const profile = profileFor(port, opts && opts.profile);
  const args = [
    "--headless=new", "--mute-audio", "--autoplay-policy=no-user-gesture-required",
    "--remote-debugging-port=" + port, "--user-data-dir=" + profile,
    "--no-first-run", "--no-default-browser-check", "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
  ];
  // (Chrome will not run its sandbox as root — a CI runner or a container; a
  // muted headless page of our own is safe to run without it)
  if (process.getuid && process.getuid() === 0) args.push("--no-sandbox");
  if (!args.includes("--mute-audio")) throw new Error("refusing to launch Chrome without --mute-audio");
  try { await get("http://127.0.0.1:" + port + "/json/version", 800); throw new Error("port " + port + " already has a Chrome on it; stop it or pass --chrome-port"); }
  catch (e) { if (/already has/.test(e.message)) throw e; }
  const holder = profileHolder(profile);
  if (holder) throw new Error("the Chrome profile " + profile + " is in use by process " + holder + "; pass --profile <dir> (or another --chrome-port, which brings its own profile)");
  const chrome = spawn(CHROME, args.concat(["about:blank"]), { stdio: ["ignore", "ignore", "pipe"] });
  chrome.stderr.on("data", () => {});
  let list = null;
  for (let i = 0; i < 60 && !list; i++) {
    await sleep(250);
    try { list = JSON.parse((await get("http://127.0.0.1:" + port + "/json", 800)).body.toString()); } catch (e) { list = null; }
  }
  if (!list) { chrome.kill(); throw new Error("Chrome did not come up on port " + port); }
  const page = list.find((t) => t.type === "page");
  const b = await connect(page.webSocketDebuggerUrl);
  b.chrome = chrome;
  b.port = port;
  b.args = args;
  b.profile = profile;
  b.kill = () => { try { b.ws.close(); } catch (e) { /* gone already */ } try { chrome.kill("SIGTERM"); } catch (e) { /* gone already */ } };
  return b;
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pend = {}, listeners = {};
  ws.onmessage = (m) => {
    const j = JSON.parse(m.data);
    if (j.id && pend[j.id]) { pend[j.id](j); delete pend[j.id]; }
    else if (j.method && listeners[j.method]) listeners[j.method].forEach((fn) => fn(j.params));
  };
  const send = (method, params) => new Promise((res, rej) => {
    const i = ++id;
    pend[i] = (j) => (j.error ? rej(new Error(method + ": " + JSON.stringify(j.error))) : res(j.result));
    ws.send(JSON.stringify({ id: i, method, params: params || {} }));
  });
  const on = (method, fn) => { (listeners[method] = listeners[method] || []).push(fn); };
  const evalJS = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("page: " + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text).slice(0, 400));
    return r.result.value;
  };
  return { ws, send, on, evalJS };
}

// Console errors and exceptions, for the report.
function collectConsole(b) {
  const out = [];
  b.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error" || p.type === "warning") out.push({ kind: "console." + p.type, text: p.args.map((a) => (a.value !== undefined ? String(a.value) : a.description || a.type)).join(" ").slice(0, 300) }); });
  b.on("Runtime.exceptionThrown", (p) => out.push({ kind: "exception", text: ((p.exceptionDetails.exception && p.exceptionDetails.exception.description) || p.exceptionDetails.text || "").slice(0, 300) }));
  b.on("Log.entryAdded", (p) => { if (p.entry.level === "error") out.push({ kind: "log.error", text: (p.entry.text + " " + (p.entry.url || "")).slice(0, 300) }); });
  return out;
}

// Page analytics and the newsletter endpoint must not count test visits.
async function prepare(b) {
  await b.send("Runtime.enable");
  await b.send("Log.enable");
  await b.send("Page.enable");
  await b.send("Network.enable");
  await b.send("Network.setBlockedURLs", { urls: ["*page-event-tracking*", "*subscribe.php*", "*googletagmanager*", "*google-analytics*"] });
}

async function waitFor(b, expr, timeoutMs, stepMs) {
  const t0 = Date.now();
  for (;;) {
    let v = null;
    try { v = await b.evalJS(expr); } catch (e) { /* the page not ready yet: ask again */ }
    if (v) return v;
    if (Date.now() - t0 > (timeoutMs || 20000)) throw new Error("timed out waiting for: " + expr);
    await sleep(stepMs || 200);
  }
}

// Kill what we started, whatever happens.
function cleanupOnExit(things) {
  const done = () => things.forEach((t) => { try { if (t && t.kill) t.kill(); } catch (e) { /* gone already */ } });
  process.on("exit", done);
  ["SIGINT", "SIGTERM"].forEach((s) => process.on(s, () => { done(); process.exit(130); }));
}

module.exports = { ensureServer, launch, profileFor, connect, collectConsole, prepare, waitFor, sleep, cleanupOnExit, DEFAULT_CHROME_PORT, DEFAULT_PROFILE, DEFAULT_HTTP_PORT, REPO };
