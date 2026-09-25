// ============================================================================
// ZANKYŌ — tools/picture-cdp.js: headless Chrome over the DevTools protocol,
// for the picture crew's probe (_picture-probe.js). Dev tool; never loaded by
// a page. No packages: Node's built-in WebSocket and fetch.
//
// Named picture-cdp.js, not cdp.js, on purpose: the audio crew keeps its own
// tools/cdp.js on another branch, and two different files at one path would
// collide at the merge.
//
// The flags are the repo's proven set (memory: headless-chrome-cdp-measurement):
// --mute-audio always; autoplay without a gesture; and the three background
// flags, because throttling reaches the scheduler and not only rAF. Headless
// rAF still runs at ~1 fps and CSS animations never advance — so the probe
// never waits on frames: it freezes the set and steps it (ZankyoSet._dev).
// Nothing here activates a window.
// ============================================================================
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.ZK_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(opts) {
  opts = opts || {};
  const prof = fs.mkdtempSync(path.join(opts.tmp || os.tmpdir(), "zk-pic-"));
  const args = [
    "--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + prof,
    "--autoplay-policy=no-user-gesture-required", "--mute-audio",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows", "--no-first-run", "--no-default-browser-check",
    "--window-size=1280,900",
  ].concat(opts.args || []).concat(["about:blank"]);
  const proc = spawn(CHROME, args, { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((res, rej) => {
    let buf = "";
    // a loaded machine can take tens of seconds to start Chrome; on a timeout
    // the half-started browser is killed, never left running
    const to = setTimeout(() => { try { proc.kill("SIGKILL"); } catch (e) {} rej(new Error("chrome did not announce a DevTools port in 60 s")); }, 60000);
    proc.stderr.on("data", (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(to); res(m[1]); }
    });
    proc.on("exit", (c) => rej(new Error("chrome exited " + c)));
  });
  const http = wsUrl.replace(/^ws:/, "http:").replace(/\/devtools\/browser\/.*$/, "");
  async function newPage() {
    const r = await fetch(http + "/json/new?about:blank", { method: "PUT" });
    const t = await r.json();
    const page = await connect(t.webSocketDebuggerUrl);
    page.targetId = t.id;
    page.closeTarget = async () => { page.close(); try { await fetch(http + "/json/close/" + t.id); } catch (e) {} };
    return page;
  }
  async function close() {
    try { proc.kill("SIGTERM"); } catch (e) {}
    await sleep(300);
    try { proc.kill("SIGKILL"); } catch (e) {}
    try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  }
  return { newPage, close };
}

function connect(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map(), handlers = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(typeof m.data === "string" ? m.data : m.data.toString());
      if (msg.id != null && pending.has(msg.id)) {
        const p = pending.get(msg.id); pending.delete(msg.id);
        if (msg.error) p.rej(new Error(msg.error.message + (msg.error.data ? " " + msg.error.data : ""))); else p.res(msg.result);
      } else if (msg.method) (handlers.get(msg.method) || []).forEach((h) => { try { h(msg.params); } catch (e) {} });
    };
    ws.onerror = (e) => rej(e);
    ws.onopen = () => {
      const send = (method, params) => new Promise((r2, j2) => {
        const i = ++id; pending.set(i, { res: r2, rej: j2 });
        ws.send(JSON.stringify({ id: i, method, params: params || {} }));
      });
      const on = (method, fn) => { if (!handlers.has(method)) handlers.set(method, []); handlers.get(method).push(fn); };
      // evaluate in the page, by value, promises awaited; a throw rejects here
      const evaluate = async (expr, timeoutMs) => {
        const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true, timeout: timeoutMs || 120000 });
        if (r.exceptionDetails) throw new Error("page: " + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
        return r.result ? r.result.value : undefined;
      };
      res({ send, on, eval: evaluate, close: () => { try { ws.close(); } catch (e) {} } });
    };
  });
}

module.exports = { launch, connect, sleep, CHROME };
