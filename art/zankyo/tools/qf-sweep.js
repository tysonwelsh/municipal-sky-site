// ============================================================================
// ZANKYŌ QF — the final bug hunt's driver (PLAN-SIGNAL-PICTURE §7 row QF,
// §11.4). Dev tool only; never loaded by a page. One headless Chrome, the real
// page, real clicks — and it only listens: every console error, uncaught
// exception and unhandled rejection is logged with the step it landed in.
//
// Owner rulings (2026-09-24/25): short runs only, no identity or REPRO. So
// each step is seconds, and the whole sweep is a few minutes.
//
//   node tools/qf-sweep.js play  [--port 8097] [--seed 3042] [--secs 150] [--lowpower] [--out DIR]
//   node tools/qf-sweep.js phone [--port 8097] [--seed 3042] [--out DIR]
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const { launch, clickSelector, sleep } = require("./cdp.js");

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes("--" + n);
const PORT = opt("port", "8097"), SEED = opt("seed", "3042");
const OUT = opt("out", path.join(require("os").tmpdir(), "zk-qf"));
fs.mkdirSync(OUT, { recursive: true });

// unhandled rejections and window errors, from inside the page; the hidden
// switch lets a step flip document.hidden and fire visibilitychange
const HOOK = `(function(){
  var E = window.__qf = { err: [] };
  window.addEventListener("error", function (e) { E.err.push("error: " + (e.message || e) + " @" + (e.filename || "") + ":" + (e.lineno || "")); });
  window.addEventListener("unhandledrejection", function (e) { var r = e.reason; E.err.push("rejection: " + (r && (r.stack || r.message) || r)); });
  var hid = false;
  try {
    Object.defineProperty(document, "hidden", { configurable: true, get: function () { return hid; } });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: function () { return hid ? "hidden" : "visible"; } });
  } catch (e) {}
  window.__qfHide = function (h) { hid = !!h; document.dispatchEvent(new Event("visibilitychange")); };
  ${flag("lowpower") ? 'try { Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: function () { return 2; } }); } catch (e) {}' : ""}
})();`;

async function open(b, w, h, mobile) {
  const page = await b.newPage();
  const log = []; let step = "load";
  page.setStep = (s) => { step = s; process.stderr.write("[qf] " + s + "\n"); };
  await page.send("Runtime.enable"); await page.send("Page.enable");
  page.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error" || p.type === "warning" || p.type === "assert") log.push({ step, type: p.type, text: (p.args || []).map((a) => a.value != null ? String(a.value) : (a.description || "")).join(" ").slice(0, 400) }); });
  page.on("Runtime.exceptionThrown", (p) => log.push({ step, type: "exception", text: (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text || "").slice(0, 600) }));
  page.on("Log.entryAdded", (p) => { if (p.entry.level === "error") log.push({ step, type: "log:" + p.entry.source, text: (p.entry.text + " " + (p.entry.url || "")).slice(0, 300) }); });
  await page.send("Log.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: mobile ? 3 : 1, mobile: !!mobile });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
  await page.send("Page.navigate", { url: "http://127.0.0.1:" + PORT + "/art/zankyo/?seed=" + SEED });
  for (let i = 0; i < 120; i++) { if (await page.eval("!!(window.ZankyoBroadcast && ZankyoBroadcast.getState().pool === 'ready')").catch(() => false)) break; await sleep(500); }
  page.log = log;
  return page;
}

const ST = "(function(){var s=ZankyoSet.getState(),b=ZankyoBroadcast.getState();return {ph:s.phase,st:+(s.strength||0).toFixed(2),live:b.live,armed:b.queueDepth,fms:s.frameMs,worst:s.worstMs,lp:s.lowPower,playing:document.getElementById('zankyo-play').getAttribute('aria-pressed'),seed:(document.getElementById('zankyo-seed')||{}).textContent,t:(ZankyoAudio.getAudioContext()?+ZankyoAudio.getAudioContext().currentTime.toFixed(2):null)}})()";

async function shot(page, sel, file) {
  const r = await page.eval("(function(){var e=document.querySelector(" + JSON.stringify(sel) + ");e.scrollIntoView({block:'center'});var r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}})()");
  const s = await page.send("Page.captureScreenshot", { format: "png", clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 2 } });
  fs.writeFileSync(path.join(OUT, file), Buffer.from(s.data, "base64"));
}

// wait (up to s seconds) for the set to leave idle/dead — a reception on the tube
async function waitOnAir(page, s) {
  for (let i = 0; i < s * 2; i++) { const st = await page.eval(ST); if (st.live || !/idle|dead|off/.test(st.ph)) return st; await sleep(500); }
  return page.eval(ST);
}

async function play() {
  const b = await launch({ tmp: OUT });
  const trace = [];
  const note = async (page, tag) => { const st = await page.eval(ST).catch((e) => ({ err: String(e) })); trace.push([tag, st]); process.stderr.write("   " + tag + " " + JSON.stringify(st) + "\n"); return st; };
  try {
    const page = await open(b, 1280, 900, false);
    page.setStep("idle"); await note(page, "loaded");
    await shot(page, "#zankyo-tube", "idle-tube.png");
    page.setStep("play"); await clickSelector(page, "#zankyo-play"); await sleep(4000); await note(page, "playing");
    await shot(page, "#zankyo-tube", "playing-dark-tube.png");
    page.setStep("push1"); await clickSelector(page, "#zankyo-push"); await note(page, "pushed");
    await note(page, "on-air?" ); await waitOnAir(page, 20); await note(page, "after-wait");
    await sleep(3000); await note(page, "mid");
    await shot(page, "#zankyo-tube", "reception.png");
    page.setStep("stop-mid"); await clickSelector(page, "#zankyo-stop"); await sleep(2500); await note(page, "stopped");
    await shot(page, "#zankyo-tube", "stopped-tube.png");
    page.setStep("replay"); await clickSelector(page, "#zankyo-play"); await sleep(3000); await note(page, "replayed");
    page.setStep("push-spam");
    for (let i = 0; i < 8; i++) { await clickSelector(page, "#zankyo-push"); await sleep(150); }
    await note(page, "spammed"); await waitOnAir(page, 15); await note(page, "spam-on-air");
    page.setStep("rocker-during");
    for (let i = 0; i < 4; i++) { await clickSelector(page, ".zk-hit-r"); await sleep(250); }
    await clickSelector(page, ".zk-hit-l"); await sleep(300);
    await clickSelector(page, "#zankyo-push"); await sleep(400);
    await note(page, "rocked+pushed");
    page.setStep("hidden"); await page.eval("__qfHide(true)"); await sleep(6000); await note(page, "hidden");
    page.setStep("restored"); await page.eval("__qfHide(false)"); await sleep(3000); await note(page, "restored");
    page.setStep("far-switch"); const s0 = (await page.eval(ST)).seed;
    await clickSelector(page, "#zankyo-far-sw"); await sleep(2500); const s1 = await note(page, "far-on");
    await clickSelector(page, "#zankyo-far-sw"); await sleep(2500); const s2 = await note(page, "far-off");
    trace.push(["seedline", { before: s0, farOn: s1.seed, farOff: s2.seed }]);
    const secs = parseFloat(opt("secs", "150"));
    page.setStep("natural"); const t0 = Date.now(); let n = 0;
    while ((Date.now() - t0) / 1000 < secs) {
      await sleep(10000); n++;
      if (n % 3 === 0) { await clickSelector(page, "#zankyo-push").catch(() => {}); }
      if (n % 5 === 0) await note(page, "natural+" + Math.round((Date.now() - t0) / 1000));
    }
    await note(page, "end");
    const inpage = await page.eval("window.__qf.err");
    const out = { lowpower: flag("lowpower"), trace, console: page.log, inpage };
    fs.writeFileSync(path.join(OUT, "play" + (flag("lowpower") ? "-lp" : "") + ".json"), JSON.stringify(out, null, 1));
    console.log(JSON.stringify({ console: page.log, inpage }, null, 1));
  } finally { await b.close(); }
}

async function phone() {
  const b = await launch({ tmp: OUT });
  try {
    for (const w of [390, 375, 360]) {
      const page = await open(b, w, 844, true);
      await sleep(1500);
      const r = await page.eval(`(function(){
        var de=document.documentElement, W=de.clientWidth, bad=[];
        document.querySelectorAll('body *').forEach(function(e){ var r=e.getBoundingClientRect(); if(r.width&&(r.right>W+0.5||r.left<-0.5)){ var cs=getComputedStyle(e); bad.push({el:e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\\s+/).join('.'):''),l:+r.left.toFixed(1),r:+r.right.toFixed(1),w:+r.width.toFixed(1),pos:cs.position}); }});
        return {W:W, scrollW:de.scrollWidth, bodyScrollW:document.body.scrollWidth, bad:bad.slice(0,40)};
      })()`);
      console.log(w, JSON.stringify(r, null, 1));
      if (w === 390) { const s = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); fs.writeFileSync(path.join(OUT, "phone-390.png"), Buffer.from(s.data, "base64")); }
      console.log("console", JSON.stringify(page.log));
      page.close();
    }
  } finally { await b.close(); }
}

(argv[0] === "phone" ? phone : play)().catch((e) => { console.error(e); process.exit(1); });
