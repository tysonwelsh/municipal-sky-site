#!/usr/bin/env node
// test-jd2-card.js — the v2 turn card end to end in a real (headless) browser
// (PLAN-V2 Phase 4a). Dev-only: scripts/** is deploy-excluded.
//
//   JD_DEV_MOCK=1 PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8000 router.php &
//   NODE_PATH=<dir holding playwright> node scripts/test-jd2-card.js [outDir]
//
// Against a LOCAL server only (the origin allowlist admits 127.0.0.1:8000 in
// dev): it refuses any base URL that is not loopback. With the mock provider
// it takes two visitor turns, one at 390×844 (phone) and one at 1280×800 —
// prompt → four drawings → the four grading panels → the podium → every
// head-to-head card → the size → file → the unveil — screenshotting each
// kind of card; then reloads the phone page, finds the item in the pile
// once, opens its report card and reads the strip's head-to-head line; then opens it under ?admin with
// the dev box's bench key (read from config/secrets.php by php, never
// printed): on that VISITOR-rated item SAVE RATINGS refuses and links the
// bench (a visitor's ranking and pairs are never re-filed as the owner's);
// then an owner-rated prompt is filed through the endpoints with the key, and
// on it an edited grade saves, which files a NEW owner session.
// Prints one PASS/FAIL line per check and the prompt id; exit 0 iff all pass.
'use strict';
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

function requireGlobal(name) {
  try { return require(name); } catch (e) { /* fall through */ }
  const dirs = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    try { return require(require.resolve(name, { paths: [d] })); } catch (e) { /* next */ }
  }
  throw new Error(`cannot resolve '${name}' — set NODE_PATH to a node_modules holding it`);
}
const { chromium } = requireGlobal('playwright');

const BASE = process.env.JD_BASE || 'http://127.0.0.1:8000';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) {
  console.error('Refusing: JD_BASE must be a loopback dev server.');
  process.exit(2);
}
const OUT = process.argv[2] || path.join(require('os').tmpdir(), 'jd2-card');
fs.mkdirSync(OUT, { recursive: true });
const ROOT = path.resolve(__dirname, '..');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (detail ? '\n      ' + detail : '')); }
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });

async function openTurn(page) {
  await page.waitForFunction(() => window.JD_turn && window.JD_record && window.JD_record.ready(),
    null, { timeout: 20000 });
  await page.evaluate(() => window.JD_turn.open());
  await page.waitForSelector('#jd-turn-prompt', { timeout: 10000 });
}

async function main() {
  const browser = await chromium.launch();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await phone.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // the desk layout gets a turn of its own, driven by the same steps
  const deskPage = await desk.newPage();
  deskPage.on('pageerror', (e) => errors.push('desk: ' + String(e)));

  const prompt = 'a brass pocket compass with a cracked glass face (jd2 card test ' + Date.now() + ')';
  const filed = {};
  for (const [pg, tag] of [[page, 'phone'], [deskPage, 'desk']]) {
    await pg.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
    await openTurn(pg);
    await pg.fill('#jd-turn-prompt', prompt + ' ' + tag);
    await pg.click('[data-act="generate"]');
    await pg.waitForSelector('[data-act="rate"]', { timeout: 60000 });
    await shot(pg, tag + '-1-results');
    await pg.click('[data-act="rate"]');

    // the four grading panels: every select answered (varied values)
    for (let d = 0; d < 4; d++) {
      await pg.waitForSelector('.jd-bench', { timeout: 10000 });
      const sels = await pg.$$('.jd-bench select.jd-turn-select');
      for (let i = 0; i < sels.length; i++) {
        const n = await sels[i].evaluate((s) => s.options.length);
        await sels[i].selectOption({ index: 1 + ((i + d) % (n - 1)) });
      }
      if (d === 0) await shot(pg, tag + '-2-bench');
      await pg.click('.jd-turn-actions [data-act="next"]');
    }

    // the podium: arm each step, then press the drawing for it
    await pg.waitForSelector('.jd-pod-tier[data-rank="1"]');
    const order = await pg.$$eval('.jd-pod-tray .jd-pod-print', (els) => els.map((e) => e.getAttribute('data-pod')));
    for (let k = 1; k <= order.length; k++) {
      await pg.click('.jd-pod-tier[data-rank="' + k + '"] .jd-pod-block');
      await pg.click('.jd-pod-print[data-pod="' + order[k - 1] + '"]');
    }
    await shot(pg, tag + '-3-podium');
    check(tag + ': the podium is full and its button reads head to head',
      await pg.$eval('.jd-turn-actions [data-act="next"]', (b) => !b.disabled && /head to head/i.test(b.textContent)));
    await pg.click('.jd-turn-actions [data-act="next"]');

    // the head to head: six cards, each gated until answered
    let cards = 0;
    const pairs = [];
    for (;;) {
      const view = await pg.$eval('.jd-turn', (c) => c.getAttribute('data-view'));
      if (view !== 'pair') break;
      cards++;
      const title = await pg.$eval('.jd-turn-title', (h) => h.textContent);
      const gated = await pg.$eval('.jd-turn-actions .jd-turn-go', (b) => b.disabled);
      const labels = await pg.$$eval('.jd-pair-tag', (t) => t.map((x) => x.textContent));
      const stops = await pg.$$eval('.jd-pair-stop', (s) => s.map((x) => x.getAttribute('aria-label')));
      if (cards === 1) {
        check(tag + ': pair card shows two drawings by blind letter', labels.length === 2 &&
          labels.every((l) => /^Drawing [A-D]$/.test(l)), labels.join(','));
        check(tag + ': seven stops labelled from the taxonomy', stops.length === 7 &&
          stops[0] === 'First much better' && stops[3] === 'About the same' && stops[6] === 'Second much better',
          stops.join(' | '));
        check(tag + ': the card is gated until answered', gated);
        check(tag + ': the rail carries one head-to-head node with a count',
          await pg.$eval('.jd-rail-step--pairs', (b) => /1\/6/.test(b.textContent)));
        await shot(pg, tag + '-4-pair');
      }
      // alternate the input: number keys + Enter, arrows + Enter, a click
      const mode = cards % 3;
      if (mode === 1) {
        await pg.keyboard.press(String(1 + (cards % 7)));
        await pg.keyboard.press('Enter');
      } else if (mode === 2) {
        await pg.locator('.jd-pair-stop[data-score="0"]').focus();
        await pg.keyboard.press('ArrowLeft');
        await pg.keyboard.press('Enter');
      } else {
        await pg.click('.jd-pair-stop[data-score="-2"]');
        if (cards === 3) await shot(pg, tag + '-5-pair-answered');
        await pg.click('.jd-turn-actions .jd-turn-go');
      }
      pairs.push(title);
      await pg.waitForFunction((t) => {
        const h = document.querySelector('.jd-turn-title');
        return h && h.textContent !== t;
      }, title, { timeout: 5000 });
    }
    check(tag + ': six head-to-head cards', cards === 6, String(cards) + ' ' + pairs.join(' / '));

    // the size, then file
    await pg.waitForSelector('[data-act="size"][data-size="m"]');
    await pg.click('[data-act="size"][data-size="m"]');
    await pg.click('.jd-turn-actions [data-act="file"]');
    await pg.waitForSelector('.jd-pod--said', { timeout: 20000 });
    await pg.waitForTimeout(1200);
    await shot(pg, tag + '-6-unveil');
    const names = await pg.$$eval('.jd-pod-who b', (b) => b.map((x) => x.textContent));
    const h2h = await pg.$$eval('.jd-pod-h2h li', (l) => l.map((x) => x.textContent));
    check(tag + ': the unveil names four models', names.length === 4, names.join(', '));
    check(tag + ': the unveil states each net head-to-head result', h2h.length === 4 &&
      h2h.every((t) => /preferred over \d of 3/.test(t)), h2h.join(' / '));
    const rec = await pg.evaluate(() => {
      try { return JSON.parse(sessionStorage.getItem('jd2-user-items'))[0]; } catch (e) { return null; }
    });
    filed[tag] = rec;
    check(tag + ': the won record carries run_id, prompt_id and pairs',
      !!(rec && rec.run_id && rec.prompt_id && Object.keys(rec.pairs || {}).length === 6));
    await pg.click('[data-act="done"]');
  }

  // reload: the item is in the pile ONCE, under its prompt id
  const id = filed.phone && filed.phone.prompt_id;
  console.log('prompt_id (phone turn): ' + id);
  console.log('prompt_id (desk turn):  ' + (filed.desk && filed.desk.prompt_id));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.JD_record && window.JD_record.ready(), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const copies = await page.$$eval('.jd-item[data-id="' + id + '"]', (e) => e.length);
  check('reload: the turn is in the pile exactly once, under its prompt id', copies === 1, String(copies));
  const served = await page.evaluate((pid) => fetch('/art/junk-drawer/data.php?item=' + pid)
    .then((r) => r.json()).then((j) => j.item), id);
  check('data.php serves the item live with six direct pairs', !!(served && !served.hidden &&
    served.pairs.length === 6 && served.pairs.every((p) => p.source === 'direct')));
  await page.evaluate((pid) => window.JD_record.open(pid), id);
  await page.waitForSelector('.rc-alt', { timeout: 10000 });
  await page.waitForTimeout(500);
  const strip = await page.$$eval('.rc-alt-h2h', (s) => s.map((x) => x.textContent + ' [' + x.title + ']'));
  check('report card: the strip carries a head-to-head line per drawing', strip.length === 4, strip.join(' / '));
  await shot(page, 'phone-7-report-card');
  await deskPage.goto(BASE + '/art/junk-drawer/#' + filed.desk.prompt_id, { waitUntil: 'load' });
  await deskPage.waitForSelector('.rc-alt-h2h', { timeout: 20000 }).catch(() => {});
  await deskPage.waitForTimeout(600);
  await shot(deskPage, 'desk-7-report-card');

  // ?admin on the VISITOR's item: the editor refuses and points at the bench
  const key = execFileSync('php', ['-r', 'require "api/jd2-config.php"; echo jd_bench_key_expected() ?? "keyless";'],
    { cwd: ROOT, env: Object.assign({}, process.env, { JD_DEV_MOCK: '1' }), encoding: 'utf8' });
  const admin = await desk.newPage();
  admin.on('pageerror', (e) => errors.push('admin: ' + String(e)));
  await admin.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
  await admin.evaluate((k) => localStorage.setItem('jd-admin-key', k), key);
  const servedRole = served && served.display_role;
  check("data.php names the visitor's item display_role 'visitor'", servedRole === 'visitor', String(servedRole));
  await admin.goto(BASE + '/art/junk-drawer/?admin#' + id, { waitUntil: 'load' });
  await admin.waitForSelector('[data-rc="save"]', { timeout: 20000 });
  const vBefore = await admin.$eval('select.rc-edit[data-grade]', (s) => s.value);
  await admin.selectOption('select.rc-edit[data-grade]', vBefore === '5' ? '4' : '5');
  await admin.click('[data-rc="save"]');
  await admin.waitForFunction(() => {
    const st = document.querySelector('.rc-edit-status');
    return st && /rated by a visitor/.test(st.textContent);
  }, null, { timeout: 10000 }).catch(() => {});
  const refusal = await admin.evaluate(() => {
    const st = document.querySelector('.rc-edit-status');
    const a = st && st.querySelector('a');
    return { open: document.documentElement.classList.contains('jd-record-open'),
      text: st ? st.textContent : '', href: a ? a.getAttribute('href') : null };
  });
  await shot(admin, 'desk-8-admin-refuses-visitor');
  check("admin: on a visitor's item SAVE RATINGS refuses, says why, and links the bench",
    refusal.open && /this item is rated by a visitor — rate it on the bench to file your own sitting/.test(refusal.text) &&
    refusal.href === 'index.php?bench&prompt=' + id, JSON.stringify(refusal));
  const still = await admin.evaluate((pid) => fetch('/art/junk-drawer/data.php?item=' + pid)
    .then((r) => r.json()).then((j) => j.item), id);
  check("admin: nothing was filed — the item still stands on the visitor's sitting",
    !!(still && still.display_role === 'visitor' && served &&
      JSON.stringify(still.responses.map((r) => r.grade)) === JSON.stringify(served.responses.map((r) => r.grade))),
    JSON.stringify(still && still.display_role));

  // an OWNER-rated prompt, filed through the endpoints with the key (the
  // bench's wire: four slots on one client_ref, then one keyed sitting with
  // every cell, a strict ranking and six DIRECT pairs)
  const ownerId = await admin.evaluate(async (k) => {
    const H = { 'Content-Type': 'application/json', 'X-Bench-Key': k };
    const post = (p, b) => fetch(p, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json());
    const ref = JD_uuid();
    let g = null;
    for (const slot of ['a', 'b', 'c', 'd']) {
      g = await post('/api/jd2-generate.php', { client_ref: ref, slot, prompt: 'a tin wind-up mouse (jd2 card test, owner ' + Date.now() + ')', website: '' });
      if (!g.ok) return 'generate: ' + JSON.stringify(g);
    }
    const tax = (await fetch('/art/junk-drawer/data.php?item=' + g.prompt_id).then((r) => r.json())).taxonomy;
    const ratings = [];
    ['a', 'b', 'c', 'd'].forEach((slot, i) => {
      ratings.push({ slot, kind: 'grade', value: 4 - (i % 3) });
      JD_liveAxes(tax).forEach((ax) => ratings.push({ slot, kind: 'axis', axis_id: ax.id, value: ax.values[0].rank }));
    });
    const r = await post('/api/jd2-rate.php', { run_id: g.run_id, client: 'web', ratings,
      ranking: [{ slot: 'a', rank: 1 }, { slot: 'b', rank: 2 }, { slot: 'c', rank: 3 }, { slot: 'd', rank: 4 }],
      pairs: [{ slot_a: 'a', slot_b: 'b', score: 1 }, { slot_a: 'a', slot_b: 'c', score: 2 }, { slot_a: 'a', slot_b: 'd', score: 3 },
              { slot_a: 'b', slot_b: 'c', score: 1 }, { slot_a: 'b', slot_b: 'd', score: 2 }, { slot_a: 'c', slot_b: 'd', score: 1 }] });
    return r.ok && r.complete ? g.prompt_id : 'rate: ' + JSON.stringify(r);
  }, key);
  check('an owner-rated prompt files complete through the endpoints (key, direct pairs)', /^[0-9A-HJKMNP-TV-Z]{26}$/.test(ownerId), ownerId);

  // ?admin on the OWNER's item: the editor files a NEW owner session (a fresh
  // load — a hash-only goto would stay on the open visitor card)
  await admin.goto('about:blank');
  await admin.goto(BASE + '/art/junk-drawer/?admin#' + ownerId, { waitUntil: 'load' });
  await admin.waitForSelector('[data-rc="save"]', { timeout: 20000 });
  const before = await admin.$eval('select.rc-edit[data-grade]', (s) => s.value);
  const next = before === '5' ? '4' : '5';
  await admin.selectOption('select.rc-edit[data-grade]', next);
  await shot(admin, 'desk-9-admin-editor');
  await admin.click('[data-rc="save"]');
  await admin.waitForFunction(() => {
    const st = document.querySelector('.rc-edit-status');
    return !document.documentElement.classList.contains('jd-record-open') ||
      (st && /not saved|incomplete|visitor/.test(st.textContent));
  }, null, { timeout: 15000 }).catch(() => {});
  const status = await admin.evaluate(() => {
    const st = document.querySelector('.rc-edit-status');
    return { open: document.documentElement.classList.contains('jd-record-open'), text: st ? st.textContent : '' };
  });
  check("admin: on the owner's item SAVE RATINGS filed and the card came down", !status.open, JSON.stringify(status));
  const after = await admin.evaluate((pid) => fetch('/art/junk-drawer/data.php?item=' + pid)
    .then((r) => r.json()).then((j) => j.item), ownerId);
  const primary = after && after.responses.find((r) => r.rid === after.primary);
  check('admin: the drawer now stands on the new owner session (grade ' + next + ' on the shown drawing)',
    !!(primary && String(primary.grade) === next && after.pairs.length === 6 && after.display_role === 'owner'),
    JSON.stringify(primary && primary.grade));

  check('no page errors', errors.length === 0, errors.join('\n'));
  await browser.close();
  console.log('\n' + passed + ' passed, ' + failed + ' failed — screenshots in ' + OUT);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
