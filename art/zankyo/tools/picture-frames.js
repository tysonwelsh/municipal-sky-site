// ============================================================================
// ZANKYŌ — tools/picture-frames.js: single tube frames at full size, and what
// the viewer actually receives from them (critic P2 r1). Dev tool; never
// loaded by a page.
//
// The probe's metrics read the 192×144 luma BEFORE the P39 ramp; a strip tile
// is ~240 px wide. Neither says whether a kind is visible on the tube as the
// owner sees it. This drives one reception exactly as `_picture-probe.js
// strip` does (virtual clock, seeded texture, frame-stepped at 30 fps, the
// reel paused on its frame) and, at each requested hold time, saves the whole
// tube canvas as a PNG and reads it back in the page:
//   rowG    the displayed green channel's mean per canvas row, 48 bands
//           (帯's bar as the eye gets it, after the ramp)
//   mint    share of the picture's pixels at the ramp's pale top (R ≥ 190:
//           the P39 LUT gives R ≥ 190 only for luma ≥ ~245) — how much of
//           the tube reads mint-white
// The clean reference (force {clean:true}) is run first on the same reel,
// texture and times, so every number has its own baseline.
//
//   node tools/picture-frames.js --force '{"impairment":"帯","sev":0.8}' --reel 1 --ats 1,2,3 --out <dir> [--name 帯]
//   (--url http://127.0.0.1:8141/art/zankyo/, --texture 3, --seed 5, --hold 6)
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const { launch, sleep } = require("./picture-cdp.js");

const argv = process.argv.slice(2);
function opt(name, def) { const i = argv.indexOf("--" + name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; }
const URL0 = opt("url", "http://127.0.0.1:8141/art/zankyo/");
const OUT = opt("out", "."); fs.mkdirSync(OUT, { recursive: true });
const REELS = [{ id: "john-cage-interview", at: 20.0 }, { id: "bbc1-testcard-news-1979", at: 12.0 }, { id: "ddr1-aktuelle-kamera-1986", at: 30.0 }];
const o = { force: JSON.parse(opt("force", "null")), reel: +opt("reel", "0"), seed: +opt("seed", "5"), texture: +opt("texture", "3"),
  hold: +opt("hold", "6"), ats: opt("ats", "1,2,3").split(",").map(Number) };
const NAME = opt("name", "frame");

function PAGE(reels, o) {
  return (async function () {
    var ZS = window.ZankyoSet, D = ZS._dev, tm = D.clock(), dt = 1000 / 30, out = [];
    var v = document.createElement("video"); v.muted = true; v.preload = "auto";
    await new Promise(function (r) { v.addEventListener("loadeddata", r, { once: true }); v.src = "broadcast/reels/" + reels[o.reel].id + ".mp4"; });
    await new Promise(function (r) { v.addEventListener("seeked", r, { once: true }); v.currentTime = reels[o.reel].at; });
    D.seedTexture(o.texture); var fr = D.force(o.force || null); if (!fr.ok) throw new Error("force refused: " + fr.why);
    tm += dt; D.step(tm);
    var t0 = tm / 1000 + 0.2, P = { body: "jou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 1.2, segments: [{ onS: o.hold, lockS: 0, atS: 0.4, lockAtS: 0.4 }], gaps: [], holes: [], glimpses: null, lossAtS: 0.4 + o.hold, spanS: 1.6 + o.hold, presenceS: o.hold };
    ZS.signal({ t0: t0, holdS: o.hold, lossD: 1.2, drops: [], seed: o.seed, id: "frames", rx: P, video: v });
    var cv = document.getElementById("zankyo-set"), k = 0;
    while (tm / 1000 < t0 + 0.4 + o.hold - 0.05 && k < o.ats.length) {
      tm += dt; var st = D.step(tm), e = tm / 1000 - t0 - 0.4;
      if (st.phase === "hold" && e >= o.ats[k]) {
        var w = cv.width, h = cv.height, c2 = document.createElement("canvas"); c2.width = w; c2.height = h;
        var x2 = c2.getContext("2d"); x2.drawImage(cv, 0, 0); var d = x2.getImageData(0, 0, w, h).data;
        // the picture's own area: the middle 80 % each way (clear of the bezel)
        var xa = Math.floor(w * 0.1), xb = Math.floor(w * 0.9), ya = Math.floor(h * 0.1), yb = Math.floor(h * 0.9);
        var bands = 48, rowG = new Array(bands).fill(0), rowN = new Array(bands).fill(0), mint = 0, n = 0;
        for (var y = ya; y < yb; y++) { var b = Math.floor((y - ya) / (yb - ya) * bands);
          for (var x = xa; x < xb; x++) { var i = (y * w + x) * 4; rowG[b] += d[i + 1]; rowN[b]++; n++; if (d[i] >= 190) mint++; } }
        var gb = new Uint8Array((xb - xa) * (yb - ya)), q = 0; for (y = ya; y < yb; y++) for (x = xa; x < xb; x++) gb[q++] = d[(y * w + x) * 4 + 1];
        var bs = ""; for (q = 0; q < gb.length; q += 8192) bs += String.fromCharCode.apply(null, gb.subarray(q, q + 8192));
        out.push({ at: +e.toFixed(2), png: cv.toDataURL("image/png"), g: btoa(bs), rowG: rowG.map(function (s, j) { return +(s / rowN[j]).toFixed(1); }), mint: +(mint / n).toFixed(4), strength: +st.strength.toFixed(3) });
        k++;
      }
    }
    var ch = D.character();
    var guard = 0; while (ZS.getState().phase !== "idle" && guard++ < 600) { tm += dt; D.step(tm); }
    D.force(null);
    return { frames: out, ch: ch };
  })();
}

(async function main() {
  const browser = await launch();
  const run = async (force, tag) => {
    const page = await browser.newPage();
    try {
      await page.send("Page.enable"); await page.send("Runtime.enable");
      await page.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.ZK_SET_DEV = " + JSON.stringify({ manual: true, clock: 0 }) + ";" });
      await page.send("Page.navigate", { url: URL0 + "?seed=3042" });
      await page.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });   // after navigate (repo lesson)
      let ready = false;
      for (let k = 0; k < 300 && !ready; k++) { await sleep(100); try { ready = await page.eval("!!(window.ZankyoSet && ZankyoSet._dev && ZankyoSet._dev.step && ZankyoSet.getState().tube[0] > 8 && document.readyState === 'complete')"); } catch (e) {} }
      if (!ready) throw new Error("page never ready");
      const r = await page.eval("(" + PAGE.toString() + ")(" + JSON.stringify(REELS) + "," + JSON.stringify(Object.assign({}, o, { force })) + ")", 600000);
      r.frames.forEach((f) => { f.gKeep = f.g; fs.writeFileSync(path.join(OUT, NAME + "-" + tag + "-" + f.at + "s.png"), Buffer.from(f.png.split(",")[1], "base64")); delete f.png; });
      return r;
    } finally { await page.closeTarget(); }
  };
  try {
    // --ref: the reference force (default the clean render); PEPPER = the share
    // of the picture's pixels the reference shows bright (G ≥ 100) that the
    // frame shows at under half that — black holes punched into a lit picture
    const REF = JSON.parse(opt("ref", '{"clean":true}'));
    const clean = await run(REF, "ref"), imp = await run(o.force, "kind");
    const pepper = (a, b) => { const A = Buffer.from(a, "base64"), B = Buffer.from(b, "base64"); let n = 0, lit = 0; for (let i = 0; i < A.length; i++) if (B[i] >= 100) { lit++; if (A[i] < 0.5 * B[i]) n++; } return { share: n / A.length, ofLit: n / Math.max(1, lit) }; };
    const report = { reel: REELS[o.reel].id, force: o.force, ch: imp.ch && { archetype: imp.ch.archetype, kinds: imp.ch.kinds, hum: imp.ch.hum, agc: imp.ch.agc }, clean: clean.frames, kind: imp.frames };
    fs.writeFileSync(path.join(OUT, NAME + ".json"), JSON.stringify(report, (k, v) => (k === "g" || k === "gKeep" ? undefined : v), 1));
    for (let i = 0; i < imp.frames.length; i++) {
      const f = imp.frames[i], c = clean.frames[i] || clean.frames[clean.frames.length - 1];
      const dG = f.rowG.map((g, j) => g - c.rowG[j]), lo = Math.min(...dG), hi = Math.max(...dG);
      console.log(NAME + " @" + f.at + " s · displayed G per band minus clean: min " + lo.toFixed(1) + " max " + hi.toFixed(1) + " (clean band mean " + (c.rowG.reduce((a, b) => a + b, 0) / c.rowG.length).toFixed(1) + ") · mint share " + f.mint + " (clean " + c.mint + ")");
      console.log("    ΔG by band: " + dG.map((x) => x.toFixed(0)).join(" "));
      const pp = pepper(f.g, c.g); console.log("    pepper: " + (pp.share * 100).toFixed(2) + " % of the picture (" + (pp.ofLit * 100).toFixed(2) + " % of its lit pixels)");
    }
  } finally { await browser.close(); }
})();
