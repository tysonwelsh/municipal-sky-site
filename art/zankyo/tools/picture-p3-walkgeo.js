// ============================================================================
// ZANKYŌ — tools/picture-p3-walkgeo.js (critic P3 r1): does 浮's walk-down
// reach the offset-map kinds? An 8 s drift-in, test card, texture 5, forced
// archetype at sev 0.9 and entry fade, walk 3 against walk 1; the per-row
// offset map's variance (px²) averaged per 2 s of the drift, and the set's
// S.env as the buffers report it. 同's kinds are all geometry (旗 捩 裂), 反's
// are not (the control). Dev tool; never loaded by a page.
//   node tools/picture-p3-walkgeo.js   (--url fixed to :8141, this worktree)
// ============================================================================
const { launch, sleep } = require("./picture-cdp.js");
(async () => {
  const b = await launch();
  try {
    const p = await b.newPage();
    await p.send("Page.enable"); await p.send("Runtime.enable");
    await p.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.ZK_SET_DEV = {manual:true,clock:0};" });
    await p.send("Page.navigate", { url: "http://127.0.0.1:8141/art/zankyo/?seed=3042" });
    await p.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    let ok = false; for (let k = 0; k < 300 && !ok; k++) { await sleep(100); try { ok = await p.eval("!!(window.ZankyoSet && ZankyoSet._dev && ZankyoSet.getState().tube[0] > 8 && document.readyState==='complete')"); } catch (e) {} }
    const r = await p.eval(`(async function(){
      var ZS=ZankyoSet, D=ZS._dev, dt=1000/30, tm=D.clock(), out={};
      for (const [arch, walk] of [["同",3],["同",1],["反",3],["反",1]]) {
        D.seedTexture(5); var f=D.force({archetype:arch, sev:0.9, entry:"fade", axes:{entry:{walk:walk}}}); if(!f.ok) throw new Error(f.why);
        tm=(Math.ceil(tm/1000)+1)*1000; D.step(tm); var base=tm, t0=tm/1000+0.2;
        var P={body:"jou",entry:"fu",exit:"setsu",entryS:8,exitS:1.6,segments:[{onS:3,lockS:0,lockAtS:8,atS:8}],gaps:[],holes:[],glimpses:null,lossAtS:11,spanS:12.6,presenceS:3};
        ZS.signal({t0:t0,holdS:3,lossD:1.6,drops:[],seed:5,id:"w",rx:P,video:null});
        var sums=[0,0,0,0], ns=[0,0,0,0], k=0, envs=[];
        while (tm/1000 < t0+8) { k++; tm=base+k*dt; var st=D.step(tm), e=tm/1000-t0, B=D.buffers(); var q=Math.min(3,Math.floor(e/2));
          if (st.phase==="drifting") { var m=B.map, mu=0; for (var y=0;y<m.length;y++) mu+=m[y]; mu/=m.length; var v=0; for (y=0;y<m.length;y++) v+=(m[y]-mu)*(m[y]-mu); sums[q]+= B.mapLive ? v/m.length : 0; ns[q]++; if (k%60===0) envs.push(JSON.stringify(B.env).slice(0,80)); } }
        out[arch+"·walk"+walk]={ mapVarByQuarter: sums.map((s,i)=>+(s/Math.max(1,ns[i])).toFixed(2)), env: envs.slice(0,2), kinds: D.character().kinds };
        var g=0; while (ZS.getState().phase!=="idle" && g++<900) { tm+=dt; D.step(tm); }
      }
      D.force(null); return out; })()`, 600000);
    console.log(JSON.stringify(r, null, 1));
  } finally { await b.close(); }
})();
