#!/usr/bin/env node
/* test-jd-legacy.js — the legacy exhibit is UNCHANGED and still works
   (owner, 2026-10-03). art/junk-drawer/legacy/ is the frozen v1 drawer, the
   owner's backup if a v2 instrument change is ever regretted. Nothing in it
   is ever edited; but it still LEANS on a few shared files outside it —
   includes/header.php + footer.php, css/style.css, api/jd-config.php,
   api/jd-analytics.php (which reads legacy/taxonomy.json since 2026-10-03),
   api/jd-gen-svg.php, api/jd-usage.php, api/page-event-tracking.php — and an
   edit to any of those can bend the exhibit without touching its folder
   (v35 and v36 did, through jd-analytics). This test:
     1. checks every file under legacy/ against legacy/CHECKSUMS.sha256 —
        a byte change in the exhibit fails here unless the manifest was
        regenerated on purpose (the command is in README-LEGACY.md);
     2. starts the dev server (JD_DEV_MOCK=1, the shared SQLite — the v1
        tables are empty there, so data.php serves the files-only exhibit)
        and loads /art/junk-drawer/legacy/ in Playwright: no page errors,
        the pile holds every unretired item, the title says legacy, ?bench never
        turns the key gate on;
     3. asks legacy/data.php and /api/jd-analytics.php as the page would and
        checks the rubric they answer with is v1's — taxonomy 26, the four
        v1 axes in order — whatever the live taxonomy.json says.
   Run ONE AT A TIME with the other suites (shared SQLite, port 8000):
     NODE_PATH=/Users/tysonwelsh/Desktop/kimi-music-generator/node_modules node scripts/test-jd-legacy.js */
'use strict';
const fs = require('fs'), path = require('path'), net = require('net'), crypto = require('crypto');
const { spawn } = require('child_process');
function requireGlobal(name) {
  const dirs = [process.cwd()].concat((process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean));
  for (const d of dirs) { try { return require(require.resolve(name, { paths: [d] })); } catch (e) { /* next */ } }
  throw new Error(`cannot resolve '${name}' — set NODE_PATH to a node_modules holding it`);
}
const { chromium } = requireGlobal('playwright');
const HOST = '127.0.0.1', PORT = 8000, BASE = `http://${HOST}:${PORT}`;
const ROOT = path.resolve(__dirname, '..');
const LEGACY = path.join(ROOT, 'art/junk-drawer/legacy');
const ENV = Object.assign({}, process.env, { JD_DEV_MOCK: '1' });
let pass = 0, fail = 0;
function check(name, ok, detail) { if (ok) { pass++; console.log('PASS  ' + name); } else { fail++; console.log('FAIL  ' + name + (detail ? '\n      ' + String(detail).slice(0, 600) : '')); } }
function waitPort(port) { return new Promise((resolve) => { let n = 0; (function tick() { const c = net.connect(port, HOST, () => { c.end(); resolve(true); }); c.once('error', () => { if (++n > 100) resolve(false); else setTimeout(tick, 100); }); })(); }); }

(async () => {
  // 1. the manifest
  const manifest = fs.readFileSync(path.join(LEGACY, 'CHECKSUMS.sha256'), 'utf8').split('\n').filter(Boolean)
    .map((l) => { const m = l.match(/^([0-9a-f]{64}) [ *](.+)$/); return m ? { sum: m[1], rel: m[2].replace(/^\.\//, '') } : null; }).filter(Boolean);
  const onDisk = [];
  (function walk(dir, rel) { for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) walk(path.join(dir, e.name), r); else if (e.name !== 'CHECKSUMS.sha256') onDisk.push(r); } })(LEGACY, '');
  const listed = new Set(manifest.map((m) => m.rel));
  const changed = manifest.filter((m) => { const f = path.join(LEGACY, m.rel); if (!fs.existsSync(f)) return true; return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') !== m.sum; }).map((m) => m.rel);
  const unlisted = onDisk.filter((r) => !listed.has(r));
  check(`legacy/: every one of the ${manifest.length} fingerprinted files is byte-identical to the manifest`, manifest.length > 60 && changed.length === 0, 'changed or missing: ' + changed.join(', '));
  check('legacy/: no file has appeared that the manifest does not know', unlisted.length === 0, 'unlisted: ' + unlisted.join(', '));
  // 2. the server
  const server = spawn('php', ['-S', `${HOST}:${PORT}`, 'router.php'], { cwd: ROOT, env: Object.assign({}, ENV, { PHP_CLI_SERVER_WORKERS: '4' }), stdio: ['ignore', 'ignore', 'pipe'], detached: true });
  const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch (e) { /* gone */ } };
  process.on('exit', stop);
  if (!(await waitPort(PORT))) { console.log('FAIL  the dev server did not come up'); process.exit(1); }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE + '/art/junk-drawer/legacy/', { waitUntil: 'load' });
    await page.waitForFunction(() => document.querySelectorAll('.jd-item[data-id]').length > 10, null, { timeout: 30000 }).catch(() => {});
    const n = await page.$$eval('.jd-item[data-id]', (els) => els.filter((e) => !e.dataset.turn && !e.dataset.folder && !e.dataset.sheet).length);
    check('the legacy page loads with no script errors', errors.length === 0, errors.join(' | '));
    check('…its title says legacy', /legacy/i.test(await page.title()), await page.title());
    // the files-only exhibit shows every entry.json that is not `retired`
    // (the rated v1 turns live in the v1 tables and show only with the
    // database behind the page; the dev SQLite's v1 tables are empty)
    const expected = fs.readdirSync(path.join(LEGACY, 'items')).filter((d) => { try { return !JSON.parse(fs.readFileSync(path.join(LEGACY, 'items', d, 'entry.json'), 'utf8')).retired; } catch (e) { return false; } }).length;
    check(`…and the pile holds the frozen v1 items (${expected} not retired, files only)`, n === expected && expected > 40, 'items on the pile: ' + n);
    const bench = await browser.newPage();
    await bench.goto(BASE + '/art/junk-drawer/legacy/?bench', { waitUntil: 'load' });
    await bench.waitForTimeout(800);
    check('?bench on the exhibit never turns the key gate on', (await bench.evaluate(() => !!(window.JD_admin && window.JD_admin.on))) === false && (await bench.$('.jd-bench-bar')) === null);
    // 3. the rubric the exhibit's readers answer with
    const data = await (await fetch(BASE + '/art/junk-drawer/legacy/data.php')).json();
    check('legacy/data.php answers with the frozen taxonomy (v26) and the same items', data && data.taxonomy && data.taxonomy.version === 26 && Array.isArray(data.items) && data.items.length === expected, JSON.stringify({ v: data && data.taxonomy && data.taxonomy.version, items: data && data.items && data.items.length }));
    const an = await (await fetch(BASE + '/api/jd-analytics.php', { headers: { Origin: BASE } })).json();
    const axes = (an && an.axes || []).map((a) => a.axis_id);
    check("/api/jd-analytics.php answers with v1's four axes in v1's order, whatever the live rubric says", JSON.stringify(axes) === JSON.stringify(['understanding-assignment', 'structural-coherence', 'layering', 'jnsq']), JSON.stringify(an && (an.axes || an.error)));
    const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/junk-drawer/taxonomy.json'), 'utf8'));
    check('(the live rubric is indeed different, so the check above means something)', live.version > 26 && live.axes.some((a) => a.id === 'paintwork'));
  } finally { await browser.close(); stop(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('FAIL  ' + e.message); process.exit(1); });
