#!/usr/bin/env node
// KOLOB tools — screens.js: the staff at 860 and 390 px, and what a frame costs.
//
// A seeded meeting in muted headless Chrome (--mute-audio, always): the
// engraved staff captured at chosen moments of the meeting at each width,
// then the page's frame time with the CPU throttled 4× (PLAN-EXECUTION §4.2,
// the Eye; PLAN-COMPOSITION §2.6 "an engraving smoke test"; §12 "Budget").
//
//   node tools/screens.js [--seed 1847] [--times 20,60,120] [--widths 860,390]
//        [--section hymn] [--fps-secs 20] [--throttle 4] [--full] [--ives] [--latin]
//        [--port 8113] [--chrome-port 9423] [--profile <dir>] [--out <dir>]
//
// Times are seconds of the meeting (the audio clock, from the moment PLAY was
// pressed); with --section, from the moment the meeting was jumped there.
// Headless Chrome may pace requestAnimationFrame slowly (~1 fps on some
// machines), so frames are judged by what each one costs, not by how many came.
// What a frame costs also rises with what else the machine is doing (other
// crews' Chromes, harness batteries): the report prints the load average
// beside the frame times, and says when it was too high to trust p99 and max.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const U = require("./lib/util.js");
const C = require("./lib/chrome.js");

const HELP = `screens.js — muted headless screenshots of the staff + frame time under CPU throttling
  --seed 1847            the meeting (default 1847)
  --times 20,60,120      meeting seconds to capture at (default 20,60,120)
  --widths 860,390       viewport widths (default 860,390; 390 is emulated as a phone, DPR 3)
  --section <type>       jump there first (dev jump: prelude invocation hymn testimony sacrament doxology postlude)
  --fps-secs 20          seconds of frame timing under throttle (default 20; 0 to skip)
  --throttle 4           CPU throttling rate for the frame timing (default 4)
  --full                 also capture the whole page
  --ives / --latin       arm the Ives switch / show Latin letters
  --port 8113            the local PHP server (started if nothing serves this tree there)
  --chrome-port 9423     Chrome's debugging port (another port brings its own profile)
  --profile <dir>        Chrome profile (default /private/tmp/claude-501/kolob-r2-tools-chrome[-<port>])
  --out <dir>            (default tools/out/screens-<seed>-<stamp>)`;

const INSTRUMENT = (o) => `(function(){
  try {
    localStorage.setItem("kolobIves", ${o.ives ? '"1"' : '"0"'});
    localStorage.setItem("kolobLatin", ${o.latin ? '"1"' : '"0"'});
    localStorage.setItem("kolobCumulative", "natural");
  } catch (e) {}
  var S = window.__frames = { on: false, cb: [] };
  var orig = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    return orig(function (ts) {
      var t0 = performance.now();
      try { cb(ts); } finally { if (S.on) S.cb.push([ts, performance.now() - t0]); }
    });
  };
  window.__long = [];
  try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { if (S.on) window.__long.push(e.duration); }); }).observe({ entryTypes: ["longtask"] }); } catch (e) {}
})();`;

const VIEW = {
  860: { width: 860, height: 1300, deviceScaleFactor: 2, mobile: false },
  390: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
};

(async () => {
  const a = U.parseArgs(process.argv.slice(2), ["help", "full", "ives", "latin"]);
  if (a.help) { console.log(HELP); return; }
  const seed = +a.seed || 1847;
  const times = U.parseList(a.times, ["20", "60", "120"], Number).sort((x, y) => x - y);
  const widths = U.parseList(a.widths, ["860", "390"], Number);
  const fpsSecs = a["fps-secs"] != null ? +a["fps-secs"] : 20, throttle = +a.throttle || 4;
  const out = a.out ? U.outDir(a) : U.outDir({}, "screens-" + seed);

  const server = await C.ensureServer({ port: +a.port || C.DEFAULT_HTTP_PORT });
  const b = await C.launch({ port: +a["chrome-port"] || C.DEFAULT_CHROME_PORT, profile: a.profile });
  C.cleanupOnExit([b, server.proc]);
  const logs = C.collectConsole(b);
  await C.prepare(b);
  await b.send("Page.addScriptToEvaluateOnNewDocument", { source: INSTRUMENT({ ives: !!a.ives, latin: !!a.latin }) });

  const url = server.base + "/art/kolob/?seed=" + seed;
  const results = [];
  for (const w of widths) {
    const view = VIEW[w] || { width: w, height: 1200, deviceScaleFactor: 2, mobile: w < 500 };
    const errs0 = logs.length;
    await b.send("Emulation.setDeviceMetricsOverride", view);
    await b.send("Page.navigate", { url });
    await C.waitFor(b, "document.readyState === 'complete' && !!window.KolobAudio && !!document.getElementById('kolob-play')", 30000);
    await b.send("Emulation.setDeviceMetricsOverride", view);
    await C.sleep(800);
    await b.evalJS("document.getElementById('kolob-play').click(), 1");
    await C.waitFor(b, "KolobAudio.isPlaying() && KolobAudio.getAudioTime() > 0", 10000, 50);
    let t0 = await b.evalJS("KolobAudio.getAudioTime()");
    let jumped = null;
    if (a.section) {
      await C.sleep(1500);
      const ok = await b.evalJS("KolobAudio.skipToSection(" + JSON.stringify(String(a.section)) + ")");
      if (!ok) console.error("screens.js: no '" + a.section + "' in this meeting's plan; times count from PLAY");
      else { t0 = await b.evalJS("KolobAudio.getAudioTime()"); jumped = a.section; }
    }
    const shots = [];
    for (const T of times) {
      const target = t0 + T;
      for (;;) {
        const now = await b.evalJS("KolobAudio.getAudioTime()");
        if (now >= target) break;
        await C.sleep(Math.min(1000, Math.max(50, (target - now) * 1000 - 50)));
      }
      const st = await b.evalJS("(function(){var c=KolobAudio.getConductor(),r=document.getElementById('kolob-viz').getBoundingClientRect();return {t:KolobAudio.getAudioTime(),section:c.section,meeting:c.meeting,x:r.x,y:r.y+scrollY,w:r.width,h:r.height}})()");
      const file = "staff-" + w + "-t" + String(Math.round(T)).padStart(3, "0") + ".png";
      const s = await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: st.x, y: st.y, width: st.w, height: st.h, scale: 1 } });
      fs.writeFileSync(path.join(out, file), Buffer.from(s.data, "base64"));
      let full = null;
      if (a.full) {
        full = "page-" + w + "-t" + String(Math.round(T)).padStart(3, "0") + ".png";
        const f = await b.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        fs.writeFileSync(path.join(out, full), Buffer.from(f.data, "base64"));
      }
      if (Math.abs(st.t - t0 - T) > 2) throw new Error("shot at " + T + " s was taken at " + (st.t - t0).toFixed(1) + " s");
      shots.push({ T, at: st.t - t0, section: st.section, meeting: st.meeting, file, full, size: Math.round(st.w) + "×" + Math.round(st.h) });
      process.stderr.write(w + "px @" + T + "s ");
    }
    // frame time, CPU throttled
    let fps = null;
    if (fpsSecs > 0) {
      await b.evalJS("window.__frames.cb.length = 0, window.__long.length = 0, window.__frames.on = true, 1");
      await b.send("Emulation.setCPUThrottlingRate", { rate: throttle });
      const w0 = Date.now(), a0 = await b.evalJS("KolobAudio.getAudioTime()"), load0 = os.loadavg()[0];
      await C.sleep(fpsSecs * 1000);
      const load1 = os.loadavg()[0];
      const raw = await b.evalJS("(window.__frames.on = false, JSON.stringify({cb: window.__frames.cb, long: window.__long, a: KolobAudio.getAudioTime(), section: KolobAudio.getConductor().section}))");
      await b.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      const r = JSON.parse(raw);
      const frames = new Map();
      r.cb.forEach(([ts, d]) => frames.set(ts, (frames.get(ts) || 0) + d));
      const ft = [...frames.values()], tss = [...frames.keys()].sort((x, y) => x - y);
      const fi = [];
      for (let i = 1; i < tss.length; i++) fi.push(tss[i] - tss[i - 1]);
      fps = {
        frames: ft.length, wall: (Date.now() - w0) / 1000, audio: r.a - a0, section: r.section,
        p50: U.quantile(ft, 0.5), p90: U.quantile(ft, 0.9), p99: U.quantile(ft, 0.99), max: ft.length ? Math.max(...ft) : null,
        interval: U.median(fi), long: r.long.length, longMs: U.sum(r.long),
        load: Math.max(load0, load1),
      };
    }
    await b.evalJS("document.getElementById('kolob-stop') && document.getElementById('kolob-stop').click(), 1");
    await C.sleep(300);
    results.push({ w, view, shots, fps, jumped, errors: logs.slice(errs0) });
    process.stderr.write("\n");
  }

  // ---- report ----
  const L = [];
  L.push("# Screens — seed " + seed);
  L.push("");
  L.push("- " + url.replace(server.base, "") + (a.ives ? " · Ives switch armed" : "") + (a.latin ? " · Latin" : "") + (a.section ? " · jumped to " + a.section : "") + " · muted headless Chrome (" + b.args.filter((x) => /mute|headless/.test(x)).join(" ") + ") · " + new Date().toISOString().slice(0, 16).replace("T", " "));
  let version = "";
  try { version = fs.readFileSync(path.join(C.REPO, "art/kolob/VERSION"), "utf8").trim().split(" — ")[0]; } catch (e) {}
  L.push("- build " + version + " · served by " + (server.reused ? "an existing" : "a fresh") + " php -S on " + server.base);
  L.push("");
  L.push("## Frame time, CPU throttled " + throttle + "×");
  L.push("");
  L.push("A frame's time is everything its requestAnimationFrame callbacks cost (the staff, the wheel). 16.7 ms is the whole budget of a 60 fps frame; the throttle makes this machine behave like a slower phone.");
  L.push("");
  L.push(U.table(["width", "frames", "p50 ms", "p90 ms", "p99 ms", "max ms", "rAF interval (median)", "long tasks", "section", "load avg"],
    results.map((r) => r.fps ? [r.w + " px", String(r.fps.frames), U.fmt(r.fps.p50, 2), U.fmt(r.fps.p90, 2), U.fmt(r.fps.p99, 2), U.fmt(r.fps.max, 1),
      U.fmt(r.fps.interval, 1) + " ms", r.fps.long + (r.fps.long ? " (" + r.fps.longMs.toFixed(0) + " ms)" : ""), r.fps.section, r.fps.load.toFixed(1)] : [r.w + " px", "—", "", "", "", "", "", "", "", ""])));
  const timed = results.filter((r) => r.fps && r.fps.frames);
  const notes = [];
  // a real display paces rAF at ~16.7 ms; anything past ~25 ms is headless pacing
  const slow = timed.filter((r) => r.fps.interval > 25);
  if (slow.length) notes.push("Headless Chrome paced requestAnimationFrame at about " + slow.map((r) => (1000 / r.fps.interval).toFixed(1)).join(" and ") + " fps here (" + slow.map((r) => r.w + " px").join(", ") + "), so the frame count says nothing about a real display; the per-frame cost is still what each frame would take.");
  if (timed.length) {
    notes.push("p99 rests on the worst hundredth of the frames — " + timed.map((r) => Math.max(1, Math.round(r.fps.frames / 100)) + " of " + r.fps.frames + " at " + r.w + " px").join(", ") + ": read it, and max, as the worst moments of this window, not as a steady rate.");
    const cores = os.cpus().length, busy = timed.filter((r) => r.fps.load > cores / 2);
    if (busy.length) notes.push("**⚠ The machine was busy** (load average " + busy.map((r) => r.fps.load.toFixed(1)).join(" / ") + " on " + cores + " cores during " + busy.map((r) => r.w + " px").join(", ") + "): other processes took the throttled CPU's time, and p99, max and the long tasks run high under load. Re-run on a quiet machine before reading them as the page's.");
  }
  notes.forEach((t) => { L.push(""); L.push(/^\*\*/.test(t) ? t : "*" + t + "*"); });
  L.push("");
  results.forEach((r) => {
    L.push("## " + r.w + " px (" + r.view.width + "×" + r.view.height + ", DPR " + r.view.deviceScaleFactor + (r.view.mobile ? ", phone" : "") + ")");
    L.push("");
    L.push(U.table(["meeting time", "section", "staff", "file"], r.shots.map((s) => [s.at.toFixed(1) + " s", s.section, s.size + " CSS px", "`" + s.file + "`" + (s.full ? " · `" + s.full + "`" : "")])));
    L.push("");
    r.shots.forEach((s) => L.push("![" + r.w + " px at " + Math.round(s.T) + " s, " + s.section + "](" + s.file + ")"));
    L.push("");
    L.push("Console: " + (r.errors.length ? r.errors.length + " error(s) — " + r.errors.slice(0, 6).map((e) => e.kind + ": " + e.text).join(" · ") : "no errors or warnings ✓"));
    L.push("");
  });
  fs.writeFileSync(path.join(out, "report.md"), L.join("\n"));
  b.kill();
  if (server.proc) server.proc.kill();
  console.log(path.join(out, "report.md"));
  process.exit(0);
})().catch((e) => { console.error("screens.js: " + (e.refusal ? e.message : e.stack || e.message)); process.exit(1); });
