// ============================================================================
// ZANKYŌ — tools/picture-crack-ab.js: the crack's light as the owner sees it
// (critic P1 r1). Dev tool; never loaded by a page.
//
// Two identical deterministic runs of the whole page (seeded texture, frozen
// clock, the same steps), one with the glow on and one with it off
// (ZankyoSet._dev.setGlow), each shot as a DOM screenshot of #zankyo-tube —
// canvas, crack SVG, scanlines and glass together. Their difference is
// exactly what the glow adds, wherever it lands. The owner's rule
// (2026-09-24): on a dark tube, NO green along the crack at all.
//   idle (card and Paik's line held off), dead, idle again: must differ in 0 px
//   a lit hold (john-cage @20 s, bbc1 @12 s): must differ, green-dominant
//   darkDiffPx/darkMax: pixels whose glow-off G ≤ 30 that the glow touched
//   (a bright neighbour's light, resampled; expect a few, a few levels)
// Usage: node tools/picture-crack-ab.js [url] [outDir] [pattern 0-3] [on|rc91]
//   rc91 puts rc.91's constant green stroke back: idle must then DIFFER
//   (the proof this check can fail).
// ============================================================================
"use strict";
const fs = require("fs"), path = require("path");
const { launch, sleep } = require("./picture-cdp.js");
const URL0 = process.argv[2] || "http://127.0.0.1:8141/art/zankyo/";
const OUT = process.argv[3] || ".";
const PAT = +(process.argv[4] || 0);
const MODE = process.argv[5] || "on";   // "on" | "rc91" for the sensitivity
async function openPage(b) {
  const page = await b.newPage();
  await page.send("Page.enable"); await page.send("Runtime.enable");
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.ZK_SET_DEV = {manual:true, clock:0};" });
  await page.send("Page.navigate", { url: URL0 + "?seed=3042" });
  await page.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  for (let k = 0; k < 400; k++) { await sleep(150); try { if (await page.eval("!!(window.ZankyoSet&&ZankyoSet._dev&&ZankyoSet.getState().tube[0]>8&&document.readyState==='complete')")) break; } catch (e) {} }
  await sleep(500);
  return page;
}
function SCRIPT(glow, pat) {
  return `(async function(){
    var ZS=ZankyoSet,D=ZS._dev; D.seedTexture(3); D.setPattern(${pat}); D.setGlow(${JSON.stringify(glow)});
    D.idle.nextLine=1e12;D.idle.nextCard=1e12;D.idle.lineAt=-1;D.idle.cardAt=-1;
    window.__tm=D.clock(); window.__st=function(n){for(var i=0;i<n;i++){__tm+=1000/30;D.step(__tm);} return ZS.getState().phase;};
    __st(60);
    window.__vid=async function(id,at){var v=document.createElement("video");v.muted=true;v.preload="auto";
      await new Promise(function(r){v.addEventListener("loadeddata",r,{once:true});v.src="broadcast/reels/"+id+".mp4";});
      await new Promise(function(r){v.addEventListener("seeked",r,{once:true});v.currentTime=at;}); return v;};
    window.__rx=function(v,seed){var t0=__tm/1000+0.1,P={body:"jou",entry:"soku",exit:"setsu",entryS:0.4,exitS:1.2,segments:[{onS:6,lockS:0,atS:0.4,lockAtS:0.4}],gaps:[],holes:[],glimpses:null,lossAtS:6.4,spanS:7.6,presenceS:6};
      D.force({archetype:"清",sev:0.3}); ZS.signal({t0:t0,holdS:6,lossD:1.2,drops:[],seed:seed,id:"crit",rx:P,video:v});};
    return ZS.getState().phase; })()`;
}
async function shoot(page, name) {
  const r = await page.eval("(function(){var e=document.getElementById('zankyo-tube');e.scrollIntoView({block:'center'});var r=e.getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,w:r.width,h:r.height};})()");
  // (r2) a STABLE shot: under load (average 30–40) the compositor can hand
  // back a frame from before the last steps — two runs then differed over the
  // whole idle tube (175,917 px, the idle raster's breathing a few steps
  // apart). Shoot until two consecutive shots, 400 ms apart, are identical.
  let prev = null, data = null, tries = 0;
  for (; tries < 8; tries++) {
    await sleep(400);
    data = (await page.send("Page.captureScreenshot", { format: "png", clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 }, captureBeyondViewport: true })).data;
    if (prev !== null && data === prev) break;
    prev = data;
  }
  if (tries >= 8) console.error("  (" + name + ": no two consecutive shots agreed in 8 tries)");
  fs.writeFileSync(path.join(OUT, name), Buffer.from(data, "base64"));
  return data;
}
async function drive(page, glow, tag) {
  const shots = {};
  await page.eval(SCRIPT(glow, PAT));
  shots.idle = await shoot(page, tag + "-idle.png");
  await page.eval("(async function(){var v=await __vid('john-cage-interview',20);__rx(v,11.5);__st(3+12+90);})()");
  shots.cage = await shoot(page, tag + "-hold-cage.png");
  // to the dead tube: the rest of the hold, loss 1.2, collapse .42, burst .32, 0.8 s into dead
  await page.eval("(function(){var n=0;while(ZankyoSet.getState().phase!=='dead'&&n++<600)__st(1);__st(24);return ZankyoSet.getState().phase;})()");
  shots.dead = await shoot(page, tag + "-dead.png");
  await page.eval("(function(){var n=0;while(ZankyoSet.getState().phase!=='idle'&&n++<600)__st(1);__st(30);})()");
  shots.idle2 = await shoot(page, tag + "-idle2.png");
  await page.eval("(async function(){var v=await __vid('bbc1-testcard-news-1979',12);__rx(v,22.5);__st(3+12+90);})()");
  shots.bbc = await shoot(page, tag + "-hold-bbc.png");
  shots.phase = await page.eval("ZankyoSet.getState().phase");
  return shots;
}
function PAGE_DIFF(A, B) {
  function load(b64) { return new Promise(function (res) { var i = new Image(); i.onload = function () { var c = document.createElement("canvas"); c.width = i.width; c.height = i.height; var x = c.getContext("2d"); x.drawImage(i, 0, 0); res(x.getImageData(0, 0, c.width, c.height)); }; i.src = "data:image/png;base64," + b64; }); }
  return Promise.all([load(A), load(B)]).then(function (im) {
    var a = im[0].data, b = im[1].data, n = a.length / 4, diffPx = 0, maxD = [0, 0, 0], sumD = [0, 0, 0], darkDiff = 0, darkMax = 0, darkN = 0, brightDiffPx = 0, brightN = 0;
    for (var p = 0; p < n; p++) {
      var q = p * 4, d0 = a[q] - b[q], d1 = a[q + 1] - b[q + 1], d2 = a[q + 2] - b[q + 2];
      var any = d0 || d1 || d2;
      if (any) { diffPx++; sumD[0] += d0; sumD[1] += d1; sumD[2] += d2; }
      maxD[0] = Math.max(maxD[0], Math.abs(d0)); maxD[1] = Math.max(maxD[1], Math.abs(d1)); maxD[2] = Math.max(maxD[2], Math.abs(d2));
      // the underlying picture: the glow-OFF shot (B)
      if (b[q + 1] <= 30) { darkN++; if (any) { darkDiff++; darkMax = Math.max(darkMax, Math.abs(d0), Math.abs(d1), Math.abs(d2)); } }
      if (b[q + 1] >= 150) { brightN++; if (any) brightDiffPx++; }
    }
    return { w: im[0].width, h: im[0].height, diffPx: diffPx, maxD: maxD, meanD: sumD.map(function (s) { return diffPx ? +(s / diffPx).toFixed(2) : 0; }), darkN: darkN, darkDiffPx: darkDiff, darkMax: darkMax, brightN: brightN, brightDiffPx: brightDiffPx };
  });
}
(async () => {
  const b = await launch({});
  try {
    const pOn = await openPage(b);
    const on = await drive(pOn, MODE === "rc91" ? "rc91" : true, "on" + PAT + MODE);
    await pOn.closeTarget();
    const pOff = await openPage(b);
    const off = await drive(pOff, false, "off" + PAT);
    console.log("phase at end", on.phase, off.phase);
    for (const k of ["idle", "cage", "dead", "idle2", "bbc"]) {
      const r = await pOff.eval("(" + PAGE_DIFF.toString() + ")(" + JSON.stringify(on[k]) + "," + JSON.stringify(off[k]) + ")", 120000);
      console.log(k.padEnd(6), JSON.stringify(r));
    }
  } finally { await b.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
