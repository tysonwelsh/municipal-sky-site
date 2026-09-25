// ============================================================================
// ZANKYŌ Q0 — the critic's second opinion on _rx-probe.js (dev tool only).
// PLAN-SIGNAL-PICTURE §7 row Q0, §8 (the critic re-runs, and checks that a
// gate CAN fail).
//
// _rx-probe.js watches the HEAD — the raw reel before the band, the gate and
// the envelope. The owner hears the BUS. And the ledge's 受信 button has a
// standing owner rule (rc.77: "play a clip 100 % when pushed right when
// pushed") that no gap count can see. So this adds three readings the coder's
// gate does not take, over the SAME capture format (it injects the same
// tools/rxrec.js, so `_rx-probe.js analyze` reads its runs too):
//
//   1. THE PRESS. Every 受信 press's answer (dial()'s return), what the tube
//      did, and how long until a reel was audible. A press answered "live"
//      while nothing is on the air is a press that did nothing.
//   2. LIP SYNC. In ?reels=buffer mode (the default since rc.93) the sound is
//      a BufferSource on the audio clock and the picture is a muted element
//      started by a timer. Nothing ties them together after the cue. Per
//      reception: the picture's position (the 50 ms poll) against the sound's
//      (desc.head, integrated at the piece's rate), over the hold.
//   3. THE BUS. Where the reel is loud at the head, the envelope is open and
//      no drop, hole or gap is scheduled, the bus should carry it. A bus that
//      falls away there is a chop the head cannot see.
//
//   node tools/rx-critic.js run --seed N --secs S --mode press|natural
//        [--throttle none|slow4g|host] [--port 8063] [--query "&x=y"] --out DIR
//   node tools/rx-critic.js analyze DIR [DIR …]
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const { launch, clickSelector, sleep } = require("./cdp.js");

const ZK = path.join(__dirname, "..");
const argv = process.argv.slice(2);
function opt(n, d) { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; }
const THROTTLE = {
  none: null,
  slow4g: { offline: false, latency: 562.5, downloadThroughput: 1.6e6 / 8 * 0.9, uploadThroughput: 750e3 / 8 * 0.9 },
  host: { offline: false, latency: 200, downloadThroughput: 500e3, uploadThroughput: 250e3 },
};

// the press log and the tube's phase, in the page, on the audio clock
const HOOK = `(function(){
  var C = window.__crit = { dial: [], phase: [] };
  function t(){ try { var c = ZankyoAudio.getAudioContext(); return c ? +c.currentTime.toFixed(3) : null; } catch(e){ return null; } }
  function hook(){
    var Z = window.ZankyoAudio; if (!Z || !Z.dial) return setTimeout(hook, 50);
    if (Z.__crit) return; Z.__crit = 1;
    var od = Z.dial;
    Z.dial = function(a, w, f){ var at = t(); var r = od.apply(this, arguments); if (f) { var st = null; try { st = ZankyoBroadcast.getState(); } catch(e){} C.dial.push({ t: at, r: r, live: !!(st && st.live), armed: st && st.armed ? st.armed.map(function(q){ return q.t0 != null ? q.t0 : (q.wantT0 != null ? q.wantT0 : null); }) : null }); } return r; };
  }
  hook();
  var last = null;
  setInterval(function(){ try { var s = window.ZankyoSet && ZankyoSet.getState && ZankyoSet.getState(); var p = s && s.phase; if (p !== last) { C.phase.push([t(), p]); last = p; } } catch(e){} }, 50);
})();`;

async function run() {
  const seed = parseInt(opt("seed", "101"), 10), secs = parseFloat(opt("secs", "600")), mode = opt("mode", "press");
  const thr = opt("throttle", "none"), port = opt("port", "8063"), query = opt("query", ""), out = opt("out");
  fs.mkdirSync(out, { recursive: true });
  const url = "http://127.0.0.1:" + port + "/art/zankyo/?seed=" + seed + query;
  const rec = fs.readFileSync(path.join(__dirname, "rxrec.js"), "utf8");
  const b = await launch({ tmp: path.dirname(out) });
  const log = [];
  let page;
  try {
    page = await b.newPage();
    await page.send("Runtime.enable"); await page.send("Page.enable"); await page.send("Network.enable");
    page.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error" || p.type === "warning") log.push({ type: p.type, text: (p.args || []).map((a) => a.value != null ? String(a.value) : (a.description || "")).join(" ").slice(0, 400) }); });
    page.on("Runtime.exceptionThrown", (p) => log.push({ type: "exception", text: (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text || "").slice(0, 600) }));
    if (THROTTLE[thr]) await page.send("Network.emulateNetworkConditions", THROTTLE[thr]);
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: rec });
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
    await page.send("Page.navigate", { url });
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    for (let i = 0; i < 120; i++) { if (await page.eval("!!(window.ZankyoBroadcast && ZankyoBroadcast.getState().pool === 'ready')").catch(() => false)) break; await sleep(500); }
    await clickSelector(page, "#zankyo-play");
    await sleep(1500);
    let rnd = seed >>> 0; const nr = () => { rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 4294967296; };
    const tStart = Date.now(); let presses = 0, nextPress = Date.now() + 8000;
    while ((Date.now() - tStart) / 1000 < secs) {
      await sleep(1000);
      if (mode === "press" && Date.now() >= nextPress) { await clickSelector(page, "#zankyo-push").catch(() => {}); presses++; nextPress = Date.now() + (6 + nr() * 34) * 1000; }
    }
    const meta = { seed, secs, mode, throttle: thr, url, started: new Date(tStart).toISOString(), presses, forced: 0 };
    const rx = await page.eval("(function(){var R=__rx;return {pulledAt: ZankyoAudio.getAudioContext().currentTime, glide: R.glide||null, sr:R.sr, block:R.block, ev:R.ev, calls:R.calls, media:R.media, polls:R.polls, clk:R.clk, err:R.err, bus:R.bus, heads:R.heads, spMiss:R.spMiss, spN:R.spN, route:R.route, state: ZankyoBroadcast.getState()}})()", 300000);
    const p = await page.eval("__rx.pullRows(0)", 300000);
    fs.writeFileSync(path.join(out, "rows.f32"), Buffer.from(p.b64, "base64"));
    rx.w = p.w; rx.srcs = p.srcs; rx.console = log;
    fs.writeFileSync(path.join(out, "rx.json"), JSON.stringify(rx));
    fs.writeFileSync(path.join(out, "meta.json"), JSON.stringify(meta, null, 1));
    fs.writeFileSync(path.join(out, "crit.json"), JSON.stringify(await page.eval("window.__crit")));
    process.stderr.write("[crit] wrote " + out + "\n");
  } finally { try { page && page.close(); } catch (e) {} await b.close(); }
}

// ---------------------------------------------------------------------------
function analyze(dirs) {
  const man = {}; for (const r of JSON.parse(fs.readFileSync(path.join(ZK, "broadcast", "manifest.json"), "utf8"))) man[r.id] = r;
  const T = { presses: 0, answers: {}, deadPress: 0, deadWait: [], sync: [], syncBad: 0, syncN: 0, busChops: 0, busChopMs: 0, busN: 0 };
  for (const d of dirs) {
    const rx = JSON.parse(fs.readFileSync(path.join(d, "rx.json"), "utf8"));
    const meta = JSON.parse(fs.readFileSync(path.join(d, "meta.json"), "utf8"));
    const crit = fs.existsSync(path.join(d, "crit.json")) ? JSON.parse(fs.readFileSync(path.join(d, "crit.json"), "utf8")) : null;
    const rb = fs.readFileSync(path.join(d, "rows.f32")); const rows = new Float32Array(rb.buffer, rb.byteOffset, rb.length / 4);
    const W = rx.w || 4, sr = rx.sr, bps = 8192 / 256, dtB = 256 / sr, nRows = rows.length / W;
    const rowT = (r) => rx.clk[Math.floor(r / bps)] + (r % bps) * dtB;
    const rowAt = (t) => { let lo = 0, hi = rx.clk.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (rx.clk[m] <= t) lo = m; else hi = m - 1; } return Math.max(0, Math.min(nRows - 1, lo * bps + Math.max(0, Math.floor((t - rx.clk[lo]) / dtB)))); };
    const buf = rx.route && rx.route.reelsMode === "buffer";
    const recs = rx.ev.filter((e) => /受信$/.test(e.label) && e.signal && e.signal.rx);
    const lastT = rx.pulledAt;
    console.log("\n== " + path.basename(d) + " · " + meta.mode + " seed " + meta.seed + " · " + meta.throttle + " · reels " + (rx.route && rx.route.reelsMode) + " · " + recs.length + " receptions/auditions");
    // ---- 1. the press ----
    if (crit && crit.dial.length) {
      for (const p of crit.dial) {
        if (p.t == null || p.t > lastT - 40) continue;
        T.presses++; T.answers[p.r] = (T.answers[p.r] || 0) + 1;
        const onAir = recs.some((e) => e.signal.t0 - 4.5 <= p.t && p.t <= e.signal.t0 + e.signal.rx.spanS + 0.8);
        const next = recs.map((e) => e.signal.t0).filter((t0) => t0 > p.t - 0.01).sort((a, b) => a - b)[0];
        const wait = next != null ? next - p.t : Infinity;
        // dead: nothing on the air at the press and no reel within 6 s, WHATEVER dial() answered
        // (an "audition" whose late decode is then refused by airClash is also a dead press)
        const dead = !onAir && wait > 6;
        if (dead) { T.deadPress++; T.deadWait.push(wait); }
        console.log("   press @" + p.t.toFixed(1) + " → " + p.r + (p.live ? " (a broadcast live)" : "") + (p.armed && p.armed.length ? " armed t0 " + p.armed.map((x) => x == null ? "?" : (x - p.t).toFixed(1) + "s").join(",") : "") +
          " · on air at press " + (onAir ? "yes" : "no") + " · next reel t0 +" + (isFinite(wait) ? wait.toFixed(1) : "∞") + " s" + (dead ? "   ← A PRESS THAT DID NOTHING" : ""));
      }
    }
    // ---- 2. lip sync (buffer mode) and 3. the bus ----
    for (const ev of recs) {
      const s = ev.signal, P = s.rx, t0 = s.t0;
      if (t0 + P.spanS > lastT || !s.head) continue;
      const others = recs.some((o) => o !== ev && o.signal.t0 < t0 + P.spanS + 1 && o.signal.t0 + o.signal.rx.spanS + 1 > t0);
      const tun = rx.ev.find((x) => x.label === "同調" && Math.abs(x.t - (t0 + 0.4)) < 0.05 && /rate ([0-9.]+)/.test(x.detail || ""));
      const rate = tun ? parseFloat(/rate ([0-9.]+)/.exec(tun.detail)[1]) : 1;
      const sndPos = (t) => { const rel = t - t0; let k = 0; for (let j = 0; j < s.head.length; j++) if (rel >= s.head[j].at - 0.01) k = j; return s.head[k].pos + rate * (t - t0 - s.head[k].at); };
      const pieceOf = (rel) => { let k = 0; for (let j = 0; j < s.head.length; j++) if (rel >= s.head[j].at - 0.01) k = j; return k; };
      const line = [];
      if (buf && !rx.glide) {
        const pl = rx.polls.filter((q) => q[1] === s.vid && q[0] >= t0 + P.segments[0].atS + 0.5 && q[0] <= t0 + P.presenceS + P.entryS);
        const offs = [];
        for (let i = 1; i < pl.length; i++) {
          const rel = pl[i][0] - t0, k = pieceOf(rel), sg = P.segments[k];
          if (rel < sg.atS + 0.5 || rel > sg.atS + sg.onS) continue;     // settled pieces only, not inside a relock
          offs.push(pl[i][2] - sndPos(pl[i][0]));
        }
        if (offs.length > 10) {
          const so = offs.slice().sort((a, b) => a - b), med = so[so.length >> 1], worst = so[0] < -so[so.length - 1] ? so[0] : so[so.length - 1];
          const bad = offs.filter((o) => Math.abs(o) > 0.15).length / offs.length;
          T.sync.push(med); T.syncN++; if (bad > 0.1) T.syncBad++;
          line.push("pic−snd median " + (med * 1000).toFixed(0) + " ms, worst " + (worst * 1000).toFixed(0) + " ms, " + (bad * 100).toFixed(0) + " % of hold > 150 ms off");
        }
      }
      // the bus against the head: chops where the head is loud, the envelope
      // is open and nothing is scheduled
      const ch = buf ? 0 : s.ch;
      if (ch != null && ch >= 0 && !others) {
        const quiet = [];
        for (const dr of s.drops || []) quiet.push([dr[0] - t0 - 0.05, dr[0] - t0 + dr[1] + 0.12]);
        for (const h of P.holes || []) quiet.push([h.atS - 0.1, h.atS + h.durS + 0.3]);
        for (let i = 1; i < P.segments.length; i++) quiet.push([P.segments[i].atS - P.gaps[i - 1].durS - 0.1, P.segments[i].atS + P.segments[i].lockS + 0.3]);
        const a = P.segments[0].atS + 0.4, b = P.presenceS + P.entryS - 0.3;
        const ratio = [];
        for (let r = rowAt(t0 + a); r <= rowAt(t0 + b); r++) {
          const rel = rowT(r) - t0; if (quiet.some((q) => rel >= q[0] && rel <= q[1])) continue;
          const h = rows[r * W + ch], bu = rows[r * W + (W - 1)];
          if (h > 3e-3) ratio.push([rel, bu / h]);
        }
        if (ratio.length > 200) {
          const sv = ratio.map((x) => x[1]).sort((p, q) => p - q), med = sv[sv.length >> 1];
          let run = null, chops = [];
          for (const [rel, v] of ratio) {
            if (v < 0.15 * med) { if (!run) run = [rel, rel]; else if (rel - run[1] < 0.02) run[1] = rel; else { chops.push(run); run = [rel, rel]; } }
            else if (run) { chops.push(run); run = null; }
          }
          if (run) chops.push(run);
          chops = chops.filter((c) => c[1] - c[0] >= 0.025);
          T.busN++; T.busChops += chops.length; for (const c of chops) T.busChopMs += (c[1] - c[0] + dtB) * 1000;
          if (chops.length) line.push("BUS CHOPS " + chops.length + ": " + chops.slice(0, 6).map((c) => "@" + c[0].toFixed(2) + "s " + ((c[1] - c[0] + dtB) * 1000).toFixed(0) + "ms").join(", "));
        }
      }
      const dropTime = (s.drops || []).reduce((acc, dr) => acc + dr[1], 0);
      console.log("  " + ev.label + " t0 " + t0.toFixed(1) + " " + s.id + " " + P.entry + "/" + P.body + "/" + P.exit + " on " + P.presenceS.toFixed(1) + " s · drops " + (s.drops || []).length + " (" + (100 * dropTime / Math.max(1, P.presenceS)).toFixed(0) + " % of presence ducked)" + (line.length ? " · " + line.join(" · ") : ""));
    }
    const cons = (rx.console || []).filter((c) => !/TUNED reel/.test(c.text));
    if (cons.length || (rx.err || []).length) console.log("   console: " + cons.length + " · page errors: " + (rx.err || []).length + " " + JSON.stringify(cons.concat(rx.err || []).slice(0, 4)));
  }
  const sm = T.sync.slice().sort((a, b) => a - b);
  console.log("\n== TOTAL: presses " + T.presses + " " + JSON.stringify(T.answers) + " · presses that did nothing " + T.deadPress + (T.deadWait.length ? " (waits " + T.deadWait.map((w) => isFinite(w) ? w.toFixed(1) : "∞").join(", ") + " s)" : ""));
  if (T.syncN) console.log("   lip sync (buffer mode): " + T.syncN + " receptions · median pic−snd " + (sm[sm.length >> 1] * 1000).toFixed(0) + " ms (range " + (sm[0] * 1000).toFixed(0) + " … " + (sm[sm.length - 1] * 1000).toFixed(0) + ") · " + T.syncBad + " with >10 % of the hold more than 150 ms off");
  console.log("   bus chops (head loud, envelope open, nothing scheduled): " + T.busChops + " over " + T.busN + " receptions, " + T.busChopMs.toFixed(0) + " ms");
}

(async () => {
  if (argv[0] === "run") await run();
  else if (argv[0] === "analyze") analyze(argv.slice(1).filter((a) => !a.startsWith("--")));
  else { console.error("usage: node tools/rx-critic.js run|analyze …"); process.exit(2); }
})().catch((e) => { console.error(e); process.exit(2); });
