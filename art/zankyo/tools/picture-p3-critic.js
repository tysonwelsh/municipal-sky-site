// ============================================================================
// ZANKYŌ — tools/picture-p3-critic.js: full-size tube frames of any bench
// reception at any moment (every phase, not only the hold), and whether each
// frame's colours are on the P39 ramp (critic P3 r1). Dev tool; never loaded
// by a page.
//
// Why: §11.1 (the owner) — the tint drifts but is ALWAYS green: never amber,
// white or blue. Everything that goes through ZP.tubePass is on the ramp by
// construction; what is added AFTER it on the frame canvas (the bloom, the
// Paik line, P3's afterglow) is not, and the probe reads the 192×144 luma
// before the ramp, so no gate sees it.
//
// GREY: the share of the picture's pixels (the middle 80 % each way) whose
// green is 40–215 and whose red stands ≥ 35 above the ramp's red at that
// green. The ramp there is saturated (luma at G 150 gives R ≈ 40); the ramp's
// own pale top (G ≥ 226, R ≥ 120) is excluded by the G cap. A near-white
// ramp colour SCALED down (×α, as a 'lighter' add at alpha does) keeps R ≈ G
// and lands here: a dim grey, i.e. dim white, off the green family.
// DESAT (the sharper one): of the pixels with green 30–215, the share whose
// saturation (G − max(R,B)) / G falls more than 0.2 below the ramp's own at
// that green. rc.91's squash reads 0–6.7 % over its collapse, burst and dead
// (the Paik line's persistence); P3's 残 afterglow read 7–86 % (critic r1).
// A job file for that comparison: tools/picture-p3-critic-afterglow.jobs.json.
//
//   node tools/picture-p3-critic.js --jobs <jobs.json> --out <dir>
//   jobs: [{ name, reel (0..2 | null = test card), seed, texture, force,
//            rx (the probe's plan grammar), ats: [s from t0], drops }]
//   (--url http://127.0.0.1:8141/art/zankyo/)
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const { launch, sleep } = require("./picture-cdp.js");

const argv = process.argv.slice(2);
function opt(name, def) { const i = argv.indexOf("--" + name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; }
const URL0 = opt("url", "http://127.0.0.1:8141/art/zankyo/");
const OUT = opt("out", "."); fs.mkdirSync(OUT, { recursive: true });
const JOBS = JSON.parse(fs.readFileSync(opt("jobs"), "utf8"));
const REELS = [{ id: "john-cage-interview", at: 20.0 }, { id: "bbc1-testcard-news-1979", at: 12.0 }, { id: "ddr1-aktuelle-kamera-1986", at: 30.0 }];

function PAGE(reels, jobs) {
  function planTimes(P) {
    var cur = P.entryS, on = 0, i;
    for (i = 0; i < P.segments.length; i++) {
      var s = P.segments[i];
      if (i > 0) { P.gaps[i - 1].atS = cur; cur += P.gaps[i - 1].durS; }
      s.lockAtS = cur; cur += (s.lockS || 0); s.atS = cur;
      cur += s.onS + (s.holeS || 0); on += s.onS;
    }
    P.lossAtS = cur; P.spanS = cur + P.exitS; P.presenceS = on;
    for (var h = 0; h < P.holes.length; h++) P.holes[h].atS = +(P.segments[0].atS + P.holes[h].relS).toFixed(3);
    return P;
  }
  return (async function () {
    var ZS = window.ZankyoSet, D = ZS._dev, ZP = window.ZankyoPicture, dt = 1000 / 30, tm = D.clock(), out = [];
    var LUT = ZP.tubeLUT(D.tube ? D.tube() : ZP.TUBE),   // (P4) the night's ramp
        rOfG = new Int16Array(256).fill(-1);
    for (var l = 0; l < 256; l++) if (rOfG[LUT.G[l]] < 0) rOfG[LUT.G[l]] = LUT.R[l];
    for (var gq = 1; gq < 256; gq++) if (rOfG[gq] < 0) rOfG[gq] = rOfG[gq - 1];
    // the ramp's saturation at each green, (G − max(R,B)) / G
    var satOfG = new Float32Array(256).fill(-1);
    for (l = 0; l < 256; l++) if (satOfG[LUT.G[l]] < 0 && LUT.G[l] > 0) satOfG[LUT.G[l]] = (LUT.G[l] - Math.max(LUT.R[l], LUT.B[l])) / LUT.G[l];
    for (gq = 1; gq < 256; gq++) if (satOfG[gq] < 0) satOfG[gq] = satOfG[gq - 1];
    var cv = document.getElementById("zankyo-set"), vids = {};
    for (var ji = 0; ji < jobs.length; ji++) {
      var J = jobs[ji], v = null;
      if (J.reel != null) {
        var R = reels[J.reel], key = R.id;
        if (!vids[key]) {
          v = document.createElement("video"); v.muted = true; v.preload = "auto";
          await new Promise(function (r) { v.addEventListener("loadeddata", r, { once: true }); v.src = "broadcast/reels/" + R.id + ".mp4"; });
          await new Promise(function (r) { v.addEventListener("seeked", r, { once: true }); v.currentTime = R.at; });
          vids[key] = v;
        }
        v = vids[key];
      }
      D.seedTexture(J.texture == null ? 21 : J.texture);
      var fr = D.force(J.force || null); if (fr && !fr.ok) throw new Error("force refused: " + fr.why);
      tm = (Math.ceil(tm / 1000) + 1) * 1000; D.step(tm);
      var base = tm, t0 = tm / 1000 + 0.2, P = planTimes(JSON.parse(JSON.stringify(J.rx)));
      var drops = (J.drops || []).map(function (d) { return [t0 + P.entryS + d[0], d[1]]; });
      if (!ZS.signal({ t0: t0, holdS: P.presenceS, lossD: P.exitS, drops: drops, seed: J.seed, id: J.name, rx: P, video: v })) throw new Error("signal refused " + J.name);
      var ch = D.character(), frames = [], k = 0, ai = 0;
      var endS = t0 + P.spanS + 0.42 + 0.32 + 1.6 + 0.3;
      while (tm / 1000 < endS && k < 20000) {
        k++; tm = base + k * dt; var st = D.step(tm), e = tm / 1000 - t0;
        if (ai < J.ats.length && e >= J.ats[ai]) {
          var w = cv.width, h = cv.height, c2 = document.createElement("canvas"); c2.width = w; c2.height = h;
          var x2 = c2.getContext("2d"); x2.drawImage(cv, 0, 0); var d = x2.getImageData(0, 0, w, h).data;
          var xa = Math.floor(w * 0.1), xb = Math.floor(w * 0.9), ya = Math.floor(h * 0.1), yb = Math.floor(h * 0.9), n = 0, grey = 0, lit = 0, meanG = 0, sumR = 0, sumG = 0, n30 = 0, desat = 0;
          for (var y = ya; y < yb; y++) for (var x = xa; x < xb; x++) {
            var i = (y * w + x) * 4, rr = d[i], gg = d[i + 1]; n++; meanG += gg;
            if (gg >= 40) { lit++; sumR += rr; sumG += gg; if (gg <= 215 && rr >= rOfG[gg] + 35) grey++; }
            if (gg >= 30 && gg <= 215) { var sat = (gg - Math.max(rr, d[i + 2])) / gg; n30++; if (sat < satOfG[gg] - 0.2) desat++; }
          }
          var B = D.buffers();
          frames.push({ at: +e.toFixed(2), ph: st.phase, s: +st.strength.toFixed(3), grey: +(grey / n).toFixed(4), greyOfLit: +(grey / Math.max(1, lit)).toFixed(4), meanG: +(meanG / n).toFixed(1), RoverG: +(sumR / Math.max(1, sumG)).toFixed(3), aftA: +(B.aftA || 0).toFixed(3), desat: +(desat / Math.max(1, n30)).toFixed(4), png: cv.toDataURL("image/png") });
          ai++;
        }
      }
      out.push({ name: J.name, ch: { archetype: ch.archetype, entry: ch.entry && ch.entry.mode, walk: ch.entry && ch.entry.walk, exit: ch.exit && ch.exit.mode, burn: ch.burn, ghosts: ch.ghosts }, frames: frames });
      var guard = 0; while (ZS.getState().phase !== "idle" && guard++ < 900) { tm += dt; D.step(tm); }
    }
    D.force(null);
    return out;
  })();
}

(async function main() {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.send("Page.enable"); await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.ZK_SET_DEV = " + JSON.stringify({ manual: true, clock: 0 }) + ";" });
    await page.send("Page.navigate", { url: URL0 + "?seed=3042" });
    await page.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });   // after navigate (repo lesson)
    let ready = false;
    for (let k = 0; k < 300 && !ready; k++) { await sleep(100); try { ready = await page.eval("!!(window.ZankyoSet && ZankyoSet._dev && ZankyoSet._dev.step && ZankyoSet.getState().tube[0] > 8 && document.readyState === 'complete')"); } catch (e) {} }
    if (!ready) throw new Error("page never ready");
    const res = await page.eval("(" + PAGE.toString() + ")(" + JSON.stringify(REELS) + "," + JSON.stringify(JOBS) + ")", 1200000);
    for (const r of res) {
      console.log(r.name + " · " + JSON.stringify({ arch: r.ch.archetype, entry: r.ch.entry, walk: r.ch.walk, exit: r.ch.exit, burn: r.ch.burn, ghosts: (r.ch.ghosts || []).map((g) => [+g.d.toFixed(1), +g.a.toFixed(3)]) }));
      for (const f of r.frames) {
        fs.writeFileSync(path.join(OUT, r.name + "-" + f.at.toFixed(2) + "s.png"), Buffer.from(f.png.split(",")[1], "base64"));
        console.log("   @" + f.at.toFixed(2) + " " + f.ph.padEnd(9) + " s " + f.s + " · meanG " + f.meanG + " · R/G of lit " + f.RoverG + " · GREY " + (f.grey * 100).toFixed(2) + " % of the picture (" + (f.greyOfLit * 100).toFixed(1) + " % of lit) · DESAT " + (f.desat * 100).toFixed(1) + " % of G 30–215 · aftA " + f.aftA);
      }
    }
    await page.closeTarget();
  } finally { await browser.close(); }
})();
