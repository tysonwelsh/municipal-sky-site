#!/usr/bin/env node
// capture-drawer-poster.js — the picture of the pile that /art/junk-drawer/about/
// shows in scene 1 (see "THE POSTER" in about/index.php and about/about.css).
//
// Opens the about page with the FULL live pile (?live), lets the drawer
// scatter and settle, hides the one object the page keeps live (the specimen)
// and the layers the page paints live over the picture (wall shade, varnish,
// vignette), and screenshots the drawer's floor — the .jd-well — at 1x and
// 2x. The craquelure STAYS in the picture: it is the floor's own aging and
// lies UNDER the objects, so it is baked in beneath them, and the page keeps
// the live craquelure on the frame only. It also records the scatter the
// picture was taken from and where the specimen lay in it, so the page can
// hand the drawer that same layout and the live specimen lands in the space
// the picture left for it.
//
//   node scripts/capture-drawer-poster.js [BASE_URL] [--reuse]
//
// BASE_URL defaults to http://127.0.0.1:8047 — any local server that serves
// this working copy with data.php behind it, e.g.
//   php -S 127.0.0.1:8047 -t . local-dev/router.php
// --reuse keeps the layout of the current poster (only new drawings get a
// fresh spot) instead of shuffling the whole pile. Re-run when the collection
// changes enough that the picture looks stale; commit the three files it
// writes (drawer-poster.webp, drawer-poster@2x.webp, drawer-poster.json).
// Needs Node 22+ (global WebSocket) and Google Chrome.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');

const BASE = (process.argv.slice(2).find(a => !a.startsWith('--')) || 'http://127.0.0.1:8047').replace(/\/$/, '');
const REUSE = process.argv.includes('--reuse');
const OUT = path.join(__dirname, '..', 'art', 'junk-drawer', 'about');
const SPECIMEN = '2026-07-28-desktop-succulent';   // SPECIMEN in about-scenes.js
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// a big desktop pane, so the 2x file is sharp on the largest drawer the page
// draws (the stage caps at 1000px tall); the 1x file serves everything else
const VIEW = { width: 1920, height: 1200 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const port = 9600 + Math.floor(Math.random() * 300);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jd-poster-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let page;
  for (let i = 0; i < 80 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page'); }
    catch (e) { await sleep(250); }
  }
  if (!page) throw new Error('Chrome did not start');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = {};
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pend[i] = d => d.error ? rej(new Error(method + ': ' + d.error.message)) : res(d.result);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' in: ' + expr.slice(0, 80));
    return r.result.value;
  };

  try {
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { ...VIEW, deviceScaleFactor: 2, mobile: false });
    if (REUSE) {
      const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'drawer-poster.json'), 'utf8'));
      await send('Page.addScriptToEvaluateOnNewDocument', {
        source: `try{sessionStorage.setItem('jd-scatter-v2', ${JSON.stringify(JSON.stringify(prev.scatter))})}catch(e){}`
      });
    }
    await send('Page.navigate', { url: `${BASE}/art/junk-drawer/about/?live` });

    // the pile is ready when its count stops changing and every drawing has
    // its svg (furniture — the turn plate, the sheet, the folder — arrives
    // on its own fetches, after the collection)
    let last = -1, stable = 0;
    for (let i = 0; i < 120 && stable < 8; i++) {
      await sleep(250);
      const n = await ev(`document.querySelectorAll('.jd-pile .jd-item svg').length`).catch(() => 0);
      stable = (n > 0 && n === last) ? stable + 1 : 0; last = n;
    }
    if (last <= 0) throw new Error('the pile never loaded — is data.php answering at ' + BASE + '?');
    await sleep(1500);   // fitView / applySize / the turn corner settle

    const rec = await ev(`(() => {
      window.scrollTo(0, 0);
      const it = document.querySelector('.jd-pile [data-id="${SPECIMEN}"]');
      if (!it) return { error: 'specimen ${SPECIMEN} is not in the pile' };
      let scatter = null;
      try { scatter = JSON.parse(sessionStorage.getItem('jd-scatter-v2')); } catch (e) {}
      const s = document.createElement('style');
      s.textContent =
        '.jd-pile [data-id="${SPECIMEN}"], .jd-wallshade, .jd-varnish, .jd-vignette,' +
        '.jd-itemtag, .jd-rope, .jd-timeline { visibility: hidden !important; }' +
        '* { transition: none !important; animation: none !important; outline: none !important; }';
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      document.head.appendChild(s);
      const w = document.querySelector('.jd-pane .jd-well, #jd-about-pane .jd-well');
      const r = w.getBoundingClientRect();
      return {
        scatter,
        place: { left: it.style.left, top: it.style.top,
                 rot: it.style.getPropertyValue('--rot').trim() },
        items: document.querySelectorAll('.jd-pile .jd-item').length,
        clip: { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }
      };
    })()`);
    if (rec.error) throw new Error(rec.error);
    if (!rec.scatter || !rec.scatter[SPECIMEN]) throw new Error('no stored scatter covering the specimen');
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });   // no hover lift
    await sleep(600);

    const files = {};
    for (const [scale, name] of [[2, 'drawer-poster@2x.webp'], [1, 'drawer-poster.webp']]) {
      await send('Emulation.setDeviceMetricsOverride', { ...VIEW, deviceScaleFactor: scale, mobile: false });
      await sleep(900);
      const shot = await send('Page.captureScreenshot', {
        format: 'webp', quality: scale === 2 ? 78 : 84, clip: { ...rec.clip, scale: 1 }, fromSurface: true });
      const buf = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(path.join(OUT, name), buf);
      files[name] = Math.round(buf.length / 1024) + ' KB';
    }
    const meta = {
      captured: new Date().toISOString(),
      source: `${BASE}/art/junk-drawer/about/?live`,
      items: rec.items,
      well: { width: Math.round(rec.clip.width), height: Math.round(rec.clip.height) },
      specimen: SPECIMEN,
      place: rec.place,
      scatter: rec.scatter
    };
    fs.writeFileSync(path.join(OUT, 'drawer-poster.json'), JSON.stringify(meta) + '\n');
    console.log(`poster: ${rec.items} objects, well ${meta.well.width}x${meta.well.height} CSS px`, files);
  } finally {
    ws.close();
    await new Promise(r => { chrome.once('exit', r); chrome.kill(); setTimeout(r, 3000); });
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
}
main().catch(e => { console.error('capture-drawer-poster:', e.message); process.exit(1); });
