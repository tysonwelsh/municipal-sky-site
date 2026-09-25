// ============================================================================
// ZANKYŌ — tools/picture-p4.js: P4's instrument (PLAN-SIGNAL-PICTURE §7 row
// P4, §5.3, §3.4, §4.3). Dev tool; never loaded by a page. Short runs only
// (owner, 2026-09-25: no long real-time recordings, no music-identity runs).
//
//   node tools/picture-p4.js draws
//       node only: 20 000 characters per night kind, the tier and archetype
//       shares on a home night (d 0) and a far one (d 0.9) against §4.3/§4.1,
//       every rarity variant seen, the generated pictures' archetypes, and the
//       coherence reads landing where they should (hum speed = lfoHz, the
//       dark bar's phase on the audio trough, pump rate, echo flutter).
//   node tools/picture-p4.js hum [--lfos 0.5,2.4]
//       headless Chrome, frame-stepped at 30 virtual fps (the set's dev
//       hooks; rAF never trusted): 帯 alone on the test card, the reception
//       carrying lfoHz. The hum bars' period MEASURED off the picture (the
//       mid-frame band's mean luma, the strongest line of its spectrum over
//       0.2–4 Hz) against 1/lfoHz — gate: within 10 % — and the dark bar's
//       arrival at mid-frame against the audio gain's trough. Writes a strip
//       per lfoHz (--out): the same 1.2 s at both rates, each tile captioned
//       with the audio's gain at that instant.
//   node tools/picture-p4.js tubes
//       a contact sheet of nights' tubes: the same clean frame of a reel on
//       rc.104's tube and eight nights' (their tint, gamma, persistence,
//       focus, tilt, keystone and dim band in the caption), and the ramp's
//       hue range per tube (§11.1: inside the green family).
//   node tools/picture-p4.js rare
//       strips of the rarities the eye has to see move: the takeover, the
//       slow roll with its sync bar, the other reel under ours.
//   (--url http://127.0.0.1:8097/art/zankyo/, --out <dir>)
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const MODE = process.argv[2] || "draws";
const argv = process.argv.slice(3);
function opt(name, def) { const i = argv.indexOf("--" + name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; }
const URL0 = opt("url", "http://127.0.0.1:8097/art/zankyo/");
const OUT = opt("out", path.join(__dirname, "..", "handoff", "picture-sheets"));
const ROOT = path.join(__dirname, "..");

function loadRand() {
  const vm = require("vm"), ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "..", "prosperos-jukebox-v2", "pj2-rand.js"), "utf8"), ctx);
  return ctx.PJ2.Rand;
}
function hue(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return null; let h; if (mx === g) h = 60 * ((b - r) / (mx - mn)) + 120; else if (mx === r) h = 60 * ((g - b) / (mx - mn)); else h = 60 * ((r - g) / (mx - mn)) + 240; return (h + 360) % 360; }

// ---- draws (node) ----
function draws() {
  const ZP = require(path.join(ROOT, "zk-picture.js")), Rand = loadRand(), N = 20000;
  let ok = true;
  const say = (pass, s) => { ok = ok && pass; console.log("  " + (pass ? "✓" : "✗") + " " + s); };
  for (const d of [0, 0.9]) {
    const m = Rand.stream(3042), ds = Rand.stream(3042).fork("p4:desc"), tiers = {}, rar = {}, arch = {};
    for (let i = 0; i < N; i++) {
      const lfo = 0.4 + ds.next() * 2.6, desc = { lfoHz: lfo, band: 0.5, flutter: 0.5, grit: 0.5, d: d, rx: null };
      const ch = ZP.drawCharacter(m.fork("set:rx:" + ds.next() * 1000), { desc: desc });
      tiers[ch.tier] = (tiers[ch.tier] || 0) + 1; if (ch.rarity) rar[ch.rarity] = (rar[ch.rarity] || 0) + 1; arch[ch.archetype] = (arch[ch.archetype] || 0) + 1;
    }
    const T = ZP.TIERS, want = { uncommon: T.unc * (1 + T.far.unc * d), rare: T.rare * (1 + T.far.rare * d), "very rare": T.vrare * (1 + T.far.vrare * d) };
    console.log("d " + d + " · " + N + " receptions");
    for (const k of ["uncommon", "rare", "very rare"]) {
      const got = (tiers[k] || 0) / N, tol = k === "very rare" ? 0.3 : 0.15;
      say(Math.abs(got / want[k] - 1) <= tol, "tier " + k.padEnd(9) + " " + got.toFixed(4) + " (want " + want[k].toFixed(4) + ", ±" + tol * 100 + " %)");
    }
    const all = T.rareKinds.concat(T.vrareKinds);
    say(all.every((k) => rar[k] > 0), "every rarity seen: " + all.map((k) => k + " " + (rar[k] || 0)).join(" · "));
    console.log("    archetypes: " + ZP.ARCHETYPES.map((a) => a.id + " " + ((arch[a.id] || 0) / N).toFixed(3) + "/" + a.w).join("  "));
  }
  // the generated pictures
  const m2 = Rand.stream(17);
  for (const [gp, allow] of [["static", ["遠", "嵐"]], ["line", ["同"]], ["wave", ["同"]]]) {
    const got = {}; let wave = 0, n = 0;
    for (let i = 0; i < 2000; i++) { const ch = ZP.drawCharacter(m2.fork("set:rx:" + gp + i), { desc: { genPic: gp, lfoHz: 1 } }); if (ch.rarity && ZP.TIERS.arch[ch.rarity]) continue; n++; got[ch.archetype] = (got[ch.archetype] || 0) + 1; if (ch.wave) wave++; }
    say(Object.keys(got).every((a) => allow.indexOf(a) >= 0), "genPic " + gp.padEnd(6) + " → " + Object.keys(got).map((a) => a + " " + got[a]).join(" · ") + (gp === "wave" ? " · 捩 on " + wave + "/" + n : ""));
  }
  // the coherence reads
  const m3 = Rand.stream(7); let hum = 0, humOk = 0, agc = 0, agcOk = 0, gh = 0, ghOk = 0, fade = 0;
  for (let i = 0; i < 4000; i++) {
    const f = 0.4 + (i % 27) / 10, ch = ZP.drawCharacter(m3.fork("set:rx:c" + i), { desc: { lfoHz: f } });
    if (ch.hum) {
      hum++; const H = ch.hum, re = (H.sign < 0 ? 0.75 : 0.25) / f;           // the audio's trough (a dark bar) or crest (a light one)
      let u = H.n * 0.5 - H.speed * re + H.ph; u -= Math.round(u);
      if (Math.abs(Math.abs(H.speed) - f) < 1e-3 && Math.abs(u) < 1e-3 && H.lock) humOk++;
    }
    if (ch.agc) { agc++; if (ch.agc.pumpHz === f && ch.agc.lock) agcOk++; }
    ch.ghosts.forEach((g) => { if (g.flut > 0) { gh++; if (g.lock && (Math.abs(g.flut - f) < 1e-3 || Math.abs(g.flut - f / 3) < 1e-3)) ghOk++; } });
    if (ch.fade && ch.fade.hz === f) fade++;
  }
  say(hum > 0 && humOk === hum, "帯 locked: " + humOk + "/" + hum + " roll at lfoHz, the bar mid-frame on the audio's trough");
  say(agc > 0 && agcOk === agc, "飽 pump at lfoHz: " + agcOk + "/" + agc);
  say(gh > 0 && ghOk === gh, "影 flutter at lfoHz (or a third): " + ghOk + "/" + gh);
  say(fade === 4000, "the carrier breathes at lfoHz on " + fade + "/4000");
  // no descriptor fields: rc.104's draw (the bench's fixtures)
  const R0 = ZP.drawCharacter(Rand.stream(5).fork("set:rx:5"), {}), R1 = ZP.drawCharacter(Rand.stream(5).fork("set:rx:5"), { desc: { rx: null } });
  say(JSON.stringify(R0) === JSON.stringify(R1) && !R0.fade, "a descriptor without the reads draws as before");
  // the night's tube stays green (§11.1), over 2000 nights
  let lo = 999, hi = -1, notG = 0;
  for (let s = 1; s <= 2000; s++) {
    const L = ZP.tubeLUT(ZP.drawTube(Rand.stream(s).fork("set:tube")));
    for (let i = 0; i < 256; i++) { if (L.G[i] < 20) continue; const h = hue(L.R[i], L.G[i], L.B[i]); if (h == null) continue; lo = Math.min(lo, h); hi = Math.max(hi, h); if (!(L.G[i] > L.R[i] && L.G[i] > L.B[i])) notG++; }
  }
  say(lo >= 98.5 && hi <= 159.5 && notG === 0, "2000 nights' ramps (the LUT truncates to bytes: ±1.5°): hue " + lo.toFixed(1) + "–" + hi.toFixed(1) + "° (green the largest channel at every lit step: " + (notG ? notG + " misses" : "all") + ")");
  console.log(ok ? "P4 DRAWS: PASS" : "P4 DRAWS: FAIL");
  return ok;
}

// ---- the browser ----
async function openPage(b) {
  const { sleep } = require("./picture-cdp.js");
  const p = await b.newPage();
  await p.send("Page.enable"); await p.send("Runtime.enable");
  const errors = []; p.on("Runtime.exceptionThrown", (e) => errors.push((e.exceptionDetails.exception && e.exceptionDetails.exception.description) || e.exceptionDetails.text));
  await p.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.ZK_SET_DEV = {manual:true,clock:0};" });
  await p.send("Page.navigate", { url: URL0 + "?seed=3042" });
  await p.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  let ok = false; for (let k = 0; k < 300 && !ok; k++) { await sleep(100); try { ok = await p.eval("!!(window.ZankyoSet && ZankyoSet._dev && ZankyoSet.getState().tube[0] > 8 && document.readyState==='complete')"); } catch (e) {} }
  if (!ok) throw new Error("the page never came up: " + errors.join(" | "));
  await sleep(300);
  p.errors = errors;
  return p;
}
// in the page: a contact sheet from tiles [{png, cap}]
const SHEET = `function (tiles, cols, label, scale) {
  var imgs = tiles.map(function (t) { var i = new Image(); i.src = t.png; return { i: i, cap: t.cap }; });
  return Promise.all(imgs.map(function (o) { return new Promise(function (r) { if (o.i.complete) r(); else o.i.onload = r; }); })).then(function () {
    var w = Math.round(imgs[0].i.width * scale), h = Math.round(imgs[0].i.height * scale), rows = Math.ceil(imgs.length / cols);
    var c = document.createElement("canvas"); c.width = w * cols; c.height = h * rows + 18; var x = c.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
    imgs.forEach(function (o, k) { x.drawImage(o.i, (k % cols) * w, Math.floor(k / cols) * h, w, h); x.fillStyle = "rgba(200,255,210,0.9)"; x.font = "11px monospace";
      String(o.cap).split("\\n").forEach(function (ln, j) { x.fillText(ln, (k % cols) * w + 5, Math.floor(k / cols) * h + 13 + 12 * j); }); });
    x.fillStyle = "#9a9"; x.fillText(label, 6, h * rows + 13);
    return c.toDataURL("image/jpeg", 0.86);
  });
}`;
function saveJpeg(dataUrl, name) { fs.mkdirSync(OUT, { recursive: true }); const f = path.join(OUT, name); fs.writeFileSync(f, Buffer.from(dataUrl.split(",")[1], "base64")); console.log("  wrote " + f); }

// in the page: open a reel (paused on a frame) for a still source
const REEL = `async function (id, at) {
  var v = document.createElement("video"); v.muted = true; v.preload = "auto";
  await new Promise(function (r) { v.addEventListener("loadeddata", r, { once: true }); v.src = "broadcast/reels/" + id + ".mp4"; });
  await new Promise(function (r) { v.addEventListener("seeked", r, { once: true }); v.currentTime = at; });
  return v;
}`;

async function hum(b) {
  const lfos = opt("lfos", "0.5,2.4").split(",").map(Number);
  const p = await openPage(b);
  let ok = true; const strips = [];
  for (const f of lfos) {
    const r = await p.eval(`(async function () {
      var ZS = ZankyoSet, D = ZS._dev, dt = 1000 / 30, tm = (Math.ceil(D.clock() / 1000) + 1) * 1000, f = ${f};
      D.seedTexture(3); var fr = D.force({ impairment: "帯", sev: 1, axes: { hum: { depth: 0.5 } } }); if (!fr.ok) throw new Error(fr.why);
      D.step(tm);
      var t0 = tm / 1000 + 0.2, hold = 8.4, P = { body: "jou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 1.2, segments: [{ onS: hold, lockS: 0, atS: 0.4, lockAtS: 0.4 }], gaps: [], holes: [], glimpses: null, lossAtS: 0.4 + hold, spanS: 1.6 + hold, presenceS: hold };
      ZS.signal({ t0: t0, holdS: hold, lossD: 1.2, drops: [], seed: 9, id: "hum", rx: P, video: null, lfoHz: f, band: 0.5, flutter: 0.5, grit: 0.5 });
      var cv = document.getElementById("zankyo-set"), series = [], gainS = [], ts = [], tiles = [], k = 0, ch = null, tileAt = 1.0, depth = 0.1 + 0.4 * 0.5;
      while (tm / 1000 < t0 + 0.4 + hold - 0.05) {
        k++; tm += dt; var st = D.step(tm), re = tm / 1000 - t0;
        if (st.phase !== "hold") continue;
        if (!ch) ch = D.character();
        var B = D.buffers(), L = B.luma, s = 0;
        for (var y = 64; y < 80; y++) for (var x = 0; x < 192; x++) s += L[y * 192 + x];
        series.push(s / (16 * 192)); gainS.push(B.hum ? B.hum[72] : 1); ts.push(re);
        var ag = 1 - depth / 2 + depth / 2 * Math.sin(6.2832 * f * re);
        if (re - 0.4 >= tileAt && tiles.length < 10) { tiles.push({ png: cv.toDataURL("image/png"), cap: "lfo " + f + " Hz · " + (re - 0.4).toFixed(2) + " s\\naudio gain " + ag.toFixed(3) }); tileAt += 0.12; }
      }
      var g = 0; while (ZS.getState().phase !== "idle" && g++ < 400) { tm += dt; D.step(tm); }
      D.force(null);
      return { series: series, gainS: gainS, ts: ts, tiles: tiles, hum: ch && ch.hum };
    })()`, 600000);
    // the period off the picture: the strongest line of the band's spectrum, 0.2–4 Hz
    const x = r.series, n = x.length, mu = x.reduce((a, v) => a + v, 0) / n, T = r.ts;
    let best = 0, bf = 0;
    for (let q = 0.2; q <= 4.0001; q += 0.005) { let re = 0, im = 0; for (let i = 0; i < n; i++) { re += (x[i] - mu) * Math.cos(6.2832 * q * T[i]); im += (x[i] - mu) * Math.sin(6.2832 * q * T[i]); } const pw = re * re + im * im; if (pw > best) { best = pw; bf = q; } }
    const per = 1 / bf, want = 1 / f, dev = Math.abs(per / want - 1);
    // the dark bar's arrival at mid-frame (the row gain's minima) against the audio trough (f·re ≡ ¾)
    const g = r.gainS, mins = []; for (let i = 1; i < g.length - 1; i++) if (g[i] < g[i - 1] && g[i] <= g[i + 1] && g[i] < 0.99) mins.push(T[i]);
    const off = mins.map((t) => { let u = f * t - 0.75; u -= Math.round(u); return Math.abs(u / f); });
    const worstOff = off.length ? Math.max.apply(null, off) : NaN;
    const pass = dev <= 0.1 && off.length > 0 && worstOff <= 1 / 30 + 1e-6;
    ok = ok && pass;
    console.log("  " + (pass ? "✓" : "✗") + " lfoHz " + f + ": the bars' period off the picture " + per.toFixed(3) + " s (1/lfoHz " + want.toFixed(3) + " s, " + (dev * 100).toFixed(1) + " % off; gate 10 %) · bars per field " + (r.hum && r.hum.n) +
      " · " + off.length + " dark bars crossed mid-frame, worst " + (worstOff * 1000).toFixed(0) + " ms from the audio's trough (a frame is 33 ms)");
    strips.push(r.tiles);
  }
  for (let i = 0; i < strips.length; i++) {
    const url = await p.eval("(" + SHEET + ")(" + JSON.stringify(strips[i]) + ", 10, " + JSON.stringify("P4 帯 locked to the audio LFO · lfoHz " + lfos[i] + " · a tile every 0.12 s from 1.0 s into the hold · the dark bar crosses mid-frame at the audio gain's trough") + ", 0.5)");
    saveJpeg(url, "P4-hum-lfo-" + lfos[i] + ".jpg");
  }
  if (p.errors.length) { ok = false; console.log("  ✗ page errors: " + p.errors.join(" | ")); }
  console.log(ok ? "P4 HUM: PASS" : "P4 HUM: FAIL");
  return ok;
}

async function tubes(b) {
  const p = await openPage(b);
  const nights = [null, 1, 2, 3, 5, 8, 13, 21, 3042];
  const r = await p.eval(`(async function () {
    var ZS = ZankyoSet, D = ZS._dev, dt = 1000 / 30, tm = (Math.ceil(D.clock() / 1000) + 1) * 1000, tiles = [], rows = [];
    var v = await (${REEL})("john-cage-interview", 20.0);
    var nights = ${JSON.stringify(nights)};
    for (var i = 0; i < nights.length; i++) {
      var T = D.tube(nights[i] == null ? "base" : nights[i]);
      D.seedTexture(4); D.force({ clean: true });
      tm = (Math.ceil(tm / 1000) + 1) * 1000; D.step(tm);
      var t0 = tm / 1000 + 0.2, hold = 2, P = { body: "jou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 1.2, segments: [{ onS: hold, lockS: 0, atS: 0.4, lockAtS: 0.4 }], gaps: [], holes: [], glimpses: null, lossAtS: 0.4 + hold, spanS: 1.6 + hold, presenceS: hold };
      ZS.signal({ t0: t0, holdS: hold, lossD: 1.2, drops: [], seed: 4, id: "tube", rx: P, video: v });
      var got = false;
      while (!got && tm / 1000 < t0 + 3) { tm += dt; var st = D.step(tm); if (st.phase === "hold" && tm / 1000 - t0 - 0.4 >= 1.2) { got = true;
        var cap = nights[i] == null ? "rc.104's tube (base)" : "night " + nights[i] + " · tint " + T.tint.toFixed(2) + " · γ " + T.gamma.toFixed(2);
        cap += "\\npersist ×" + T.persist.toFixed(2) + " · focus " + T.focus.toFixed(2) + " px · tilt " + T.tilt.toFixed(2) + "°";
        cap += "\\nkeystone " + (T.trap * 100).toFixed(1) + " % · pin " + (T.pin * 100).toFixed(1) + " %" + (T.dim ? " · dim band at " + Math.round(T.dim.y * 100) + " %" : "");
        tiles.push({ png: document.getElementById("zankyo-set").toDataURL("image/png"), cap: cap }); rows.push(T); } }
      var g = 0; while (ZS.getState().phase !== "idle" && g++ < 400) { tm += dt; D.step(tm); }
    }
    D.force(null); D.tube(null);
    return { tiles: tiles, rows: rows };
  })()`, 600000);
  const ZP = require(path.join(ROOT, "zk-picture.js"));
  let ok = true;
  r.rows.forEach((T, i) => {
    const L = ZP.tubeLUT(T); let lo = 999, hi = -1;
    for (let k = 0; k < 256; k++) { if (L.G[k] < 20) continue; const h = hue(L.R[k], L.G[k], L.B[k]); if (h != null) { lo = Math.min(lo, h); hi = Math.max(hi, h); } }
    const pass = lo >= 98.5 && hi <= 159.5; ok = ok && pass;
    console.log("  " + (pass ? "✓" : "✗") + " " + (nights[i] == null ? "base" : "night " + nights[i]).padEnd(10) + " ramp hue " + lo.toFixed(0) + "–" + hi.toFixed(0) + "° · top (" + L.R[255] + "," + L.G[255] + "," + L.B[255] + ")");
  });
  const url = await p.eval("(" + SHEET + ")(" + JSON.stringify(r.tiles) + ", 3, " + JSON.stringify("P4 管 the night's tube · the same clean frame (john-cage, 1.2 s into the hold) on rc.104's tube and eight nights' · owner §11.1: the tint drifts, always green") + ", 0.75)");
  saveJpeg(url, "P4-tubes.jpg");
  if (p.errors.length) { ok = false; console.log("  ✗ page errors: " + p.errors.join(" | ")); }
  console.log(ok ? "P4 TUBES: PASS" : "P4 TUBES: FAIL");
  return ok;
}

async function rare(b) {
  const p = await openPage(b);
  const jobs = [
    { name: "takeover", hold: 9, every: 0.75, from: 0.5, force: { archetype: undefined, rarity: "takeover" } },
    { name: "syncbar", hold: 6, every: 0.5, from: 0.5, force: { rarity: "syncbar" } },
    { name: "otherreel", hold: 6, every: 0.5, from: 0.5, force: { rarity: "otherreel" } },
  ];
  let ok = true;
  for (const j of jobs) {
    const r = await p.eval(`(async function () {
      var ZS = ZankyoSet, D = ZS._dev, dt = 1000 / 30, tm = (Math.ceil(D.clock() / 1000) + 1) * 1000, tiles = [], j = ${JSON.stringify(j)};
      // one reel at a time: php -S serves one request at a time, and a
      // second element's fetch waits behind the first's open stream
      var prev = await (${REEL})("bbc1-testcard-news-1979", 12.0), v = null;
      function plan(hold) { return { body: "jou", entry: "soku", exit: "setsu", entryS: 0.4, exitS: 1.2, segments: [{ onS: hold, lockS: 0, atS: 0.4, lockAtS: 0.4 }], gaps: [], holes: [], glimpses: null, lossAtS: 0.4 + hold, spanS: 1.6 + hold, presenceS: hold }; }
      // the last reception: another reel, so the frame memory holds it
      D.seedTexture(6); D.force({ clean: true }); D.step(tm);
      var t0 = tm / 1000 + 0.2; ZS.signal({ t0: t0, holdS: 2, lossD: 1.2, drops: [], seed: 1, id: "prev", rx: plan(2), video: prev });
      var g = 0; while ((ZS.getState().phase !== "idle" || tm / 1000 < t0 + 1) && g++ < 600) { tm += dt; D.step(tm); }
      prev.removeAttribute("src"); prev.load();
      v = await (${REEL})("ddr1-aktuelle-kamera-1986", 30.0);
      var fr = D.force({ rarity: j.force.rarity }); if (!fr.ok) throw new Error(fr.why);
      tm = (Math.ceil(tm / 1000) + 1) * 1000; D.step(tm);
      t0 = tm / 1000 + 0.2; ZS.signal({ t0: t0, holdS: j.hold, lossD: 1.2, drops: [], seed: 7, id: "rare", rx: plan(j.hold), video: v, lfoHz: 1.1 });
      var next = j.from, ch = null, takes = [];
      while (tm / 1000 < t0 + 0.4 + j.hold - 0.05) { tm += dt; var st = D.step(tm), e = tm / 1000 - t0 - 0.4;
        if (st.phase !== "hold") continue; if (!ch) ch = D.character(); var B = D.buffers(); takes.push(B.take);
        if (e >= next) { tiles.push({ png: document.getElementById("zankyo-set").toDataURL("image/png"), cap: j.name + " · " + e.toFixed(2) + " s" + (ch.take ? " · take " + B.take.toFixed(2) : "") + (ch.roll ? " · roll " + B.rollPx.toFixed(0) + " px" : "") + (B.xt ? " · 混 on" : "") }); next += j.every; } }
      g = 0; while (ZS.getState().phase !== "idle" && g++ < 400) { tm += dt; D.step(tm); }
      D.force(null); v.removeAttribute("src"); v.load();
      return { tiles: tiles, tier: ch.tier, rarity: ch.rarity, arch: ch.archetype, take: ch.take || null, roll: ch.roll || null, xt: ch.xtalk ? { src: ch.xtalk.src, depth: ch.xtalk.depth } : null, maxTake: Math.max.apply(null, takes) };
    })()`, 600000);
    const pass = r.rarity === j.force.rarity && (j.name !== "takeover" || r.maxTake >= 0.999) && (j.name !== "syncbar" || !!r.roll) && (j.name !== "otherreel" || (r.xt && r.xt.src === "mem"));
    ok = ok && pass;
    console.log("  " + (pass ? "✓" : "✗") + " " + j.name + ": tier " + r.tier + " · " + r.arch + (r.take ? " · take at " + r.take.at + " of the piece over " + r.take.dur + " s, reached " + r.maxTake.toFixed(2) : "") + (r.roll ? " · rolling " + r.roll.hz + " frames/s" : "") + (r.xt ? " · other picture " + r.xt.src + " at " + r.xt.depth : ""));
    const url = await p.eval("(" + SHEET + ")(" + JSON.stringify(r.tiles) + ", 6, " + JSON.stringify("P4 稀 " + j.name + " (forced) · ddr1 at 30 s, the last reception bbc1 at 12 s") + ", 0.5)");
    saveJpeg(url, "P4-rare-" + j.name + ".jpg");
  }
  if (p.errors.length) { ok = false; console.log("  ✗ page errors: " + p.errors.join(" | ")); }
  console.log(ok ? "P4 RARE: PASS" : "P4 RARE: FAIL");
  return ok;
}

(async () => {
  if (MODE === "draws") { process.exitCode = draws() ? 0 : 1; return; }
  const { launch } = require("./picture-cdp.js");
  const b = await launch();
  let ok = false;
  try {
    if (MODE === "hum") ok = await hum(b);
    else if (MODE === "tubes") ok = await tubes(b);
    else if (MODE === "rare") ok = await rare(b);
    else throw new Error("no mode " + MODE);
  } finally { await b.close(); }
  process.exitCode = ok ? 0 : 1;
})().catch((e) => { console.error(e); process.exitCode = 2; });
