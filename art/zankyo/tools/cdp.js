// ============================================================================
// ZANKYŌ — a headless Chrome over CDP, with no packages (dev tool, never
// loaded by the page).
//
// The method this repo has proven (memory: headless-chrome-cdp-measurement):
// Google Chrome headless, driven over the DevTools protocol with Node's
// built-in WebSocket. The flags are not decoration:
//   --mute-audio                            standing policy on every launch
//   --autoplay-policy=no-user-gesture-required
//   --disable-background-timer-throttling   throttling reaches the scheduler,
//   --disable-renderer-backgrounding        not just rAF (phase-W4-coder.md) —
//   --disable-backgrounding-occluded-windows a starved run reports a normal
//                                            audio clock and commits a fraction
//                                            of the notes
// Headless rAF runs at about 1 fps and CSS animations never advance, so
// anything that waits here waits on the clock, never on frames. Nothing in
// this file activates a window: it cannot disturb the owner's screen.
//
//   const { launch } = require("./tools/cdp.js");
//   const b = await launch({ port: 0 });             // a fresh profile
//   const page = await b.newPage();                  // { send, on, eval, close }
//   await page.send("Page.navigate", { url });
//   const v = await page.eval("1 + 1");
//   await b.close();
// ============================================================================
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CHROME = process.env.ZK_CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function guard(ms) { return new Promise((r) => { const h = setTimeout(r, ms); if (h.unref) h.unref(); }); }   // a timer that never keeps the process alive

async function launch(opts) {
  opts = opts || {};
  const prof = fs.mkdtempSync(path.join(opts.tmp || os.tmpdir(), "zk-cdp-"));
  const args = [
    "--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + prof,
    "--autoplay-policy=no-user-gesture-required", "--mute-audio",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows", "--no-first-run", "--no-default-browser-check",
    "--window-size=" + (opts.width || 1280) + "," + (opts.height || 900),
  ].concat(opts.args || []).concat(["about:blank"]);
  const proc = spawn(CHROME, args, { stdio: ["ignore", "ignore", "pipe"] });
  // The DevTools URL arrives on stderr; nothing else there matters.
  const wsUrl = await new Promise((res, rej) => {
    let buf = "";
    const to = setTimeout(() => rej(new Error("chrome did not announce a DevTools port")), 20000);
    proc.stderr.on("data", (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(to); res(m[1]); }
    });
    proc.on("exit", (c) => rej(new Error("chrome exited " + c)));
  });
  const httpBase = wsUrl.replace(/^ws:/, "http:").replace(/\/devtools\/browser\/.*$/, "");
  async function newPage() {
    const r = await fetch(httpBase + "/json/new?about:blank", { method: "PUT" });
    const t = await r.json();
    return connect(t.webSocketDebuggerUrl);
  }
  async function close() {
    try { proc.kill("SIGTERM"); } catch (e) {}
    await sleep(300);
    try { proc.kill("SIGKILL"); } catch (e) {}
    try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) {}
  }
  return { newPage, close, proc, httpBase };
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
      } else if (msg.method) {
        const hs = handlers.get(msg.method) || [];
        for (const h of hs) { try { h(msg.params); } catch (e) {} }
      }
    };
    ws.onerror = (e) => rej(e);
    ws.onopen = () => {
      const send = (method, params) => new Promise((r2, j2) => {
        const i = ++id; pending.set(i, { res: r2, rej: j2 });
        ws.send(JSON.stringify({ id: i, method, params: params || {} }));
      });
      const on = (method, fn) => { if (!handlers.has(method)) handlers.set(method, []); handlers.get(method).push(fn); };
      // An expression evaluated in the page, its value returned by value.
      // Promises are awaited. A thrown error comes back as a rejection here.
      const evaluate = async (expr, timeoutMs) => {
        // (bounded here too: `timeout` limits the page's execution, not an
        // answer that never comes back)
        const r = await Promise.race([send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true, timeout: timeoutMs || 60000 }),
          guard((timeoutMs || 60000) + 15000).then(() => { throw new Error("cdp: no answer to Runtime.evaluate in " + Math.round(((timeoutMs || 60000) + 15000) / 1000) + " s"); })]);
        if (r.exceptionDetails) throw new Error("page: " + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
        return r.result ? r.result.value : undefined;
      };
      const close = () => { try { ws.close(); } catch (e) {} };
      res({ send, on, eval: evaluate, close });
    };
  });
}

// Click the centre of an element by selector, through real input events —
// which is what satisfies the page's user-gesture policy.
async function clickSelector(page, sel) {
  const box = await page.eval("(function(){var e=document.querySelector(" + JSON.stringify(sel) + ");if(!e)return null;e.scrollIntoView({block:'center'});var r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
  if (!box) throw new Error("no element " + sel);
  // (Q0 r3: bounded. Under a load of ~55 a headless renderer once never
  // acknowledged the input, and the probe waited on it for good — two 600 s
  // runs still waiting at 30 min, their pages playing on.)
  for (const type of ["mousePressed", "mouseReleased"]) {
    await Promise.race([page.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 }), guard(15000)]);
  }
  return box;
}

module.exports = { launch, connect, clickSelector, sleep, CHROME };
