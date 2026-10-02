#!/usr/bin/env node
// test-jd2-bench.js — the owner's bench on the v2 queue, end to end in a real
// (headless) browser (PLAN-V2 Phase 4b). Dev-only: scripts/** is deploy-excluded.
//
//   NODE_PATH=<dir holding playwright> node scripts/test-jd2-bench.js [outDir]
//
// HERMETIC, in the PHP tests' pattern: it starts its OWN `php -S` on
// 127.0.0.1:8000 (the one dev origin jd-origin.php admits) from this checkout
// with JD_DEV_MOCK=1, and refuses to run when that port is already taken (so
// it can never drive a server from another checkout). It EMPTIES the jd2_*
// tables of local-dev/jd-dev.sqlite first (the v1 jd_* tables are not
// touched) — run it on its own, never alongside another jd2 test. The bench
// key is whatever config/secrets.php holds (read by php, never printed);
// keyless when there is none.
//
// The checks, in order:
//   seed   two owner prompts through jd2-generate (bench profile, four slots
//          one after another on one client_ref each)
//   rate   ?bench seats the newest; the card is rated end to end — four
//          grading panels, the podium, six head-to-head cards, the size, the
//          "notes for the record" — and filed; the unveil names the models
//          from the filing's reveal; DONE advances the queue to the other
//          prompt; SQLite holds ONE owner session, blind, with the note and
//          six DIRECT pairs, and the prompt went live
//   direct ?bench&prompt=<id> seats the closed prompt with its prefill
//          (opens on the podium, every scale answered); ?bench&item= too
//   scrap  hides it (visibility hidden) and the bench moves on
//   hidden HIDDEN ITEMS lists it from the ledger; SHOW returns it live — and
//          a jd2-curate answer naming another build (the response rewritten
//          in flight) trips the strip's "a deploy landed" line
//   new    NEW PROMPT draws under the bench profile through the darkroom with
//          the mock provider, files title and category, and seats the new
//          run for rating
//   rerun  RERUN draws a new bench run of that prompt and seats it; the
//          drawer's ?rerun=<id> door does the same through the owner path
//   gate   without the key, JD_turn.rerun refuses (a rerun is never a
//          visitor turn) and the strip shows only the key gate
// One PASS/FAIL line per check; exit 0 iff all pass.
'use strict';
const path = require('path');
const fs = require('fs');
const net = require('net');
const crypto = require('crypto');
const { execFileSync, spawn } = require('child_process');

function requireGlobal(name) {
  try { return require(name); } catch (e) { /* fall through */ }
  const dirs = (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    try { return require(require.resolve(name, { paths: [d] })); } catch (e) { /* next */ }
  }
  throw new Error(`cannot resolve '${name}' — set NODE_PATH to a node_modules holding it`);
}
const { chromium } = requireGlobal('playwright');

const HOST = '127.0.0.1', PORT = 8000;
const BASE = `http://${HOST}:${PORT}`;
const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(require('os').tmpdir(), 'jd2-bench');
fs.mkdirSync(OUT, { recursive: true });
const ENV = Object.assign({}, process.env, { JD_DEV_MOCK: '1', JD_DEV_LATENCY_MS: '500' });

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('PASS  ' + name); }
  else { failed++; console.log('FAIL  ' + name + (detail ? '\n      ' + String(detail).slice(0, 1500) : '')); }
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });

// --- php helpers: the dev database, read through the app's own jd_db() -------
function php(code, extraEnv) {
  return execFileSync('php', ['-r', 'require "api/jd2-config.php"; ' + code],
    { cwd: ROOT, env: Object.assign({}, ENV, extraEnv || {}), encoding: 'utf8' });
}
function q(sql, args) {
  const out = php('if (!JD_DEV_MODE) { fwrite(STDERR, "not dev"); exit(2); } ' +
    '$r = json_decode(getenv("JD_Q"), true); $s = jd_db()->prepare($r["sql"]); ' +
    '$s->execute($r["args"]); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));',
  { JD_Q: JSON.stringify({ sql, args: args || [] }) });
  return JSON.parse(out);
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, HOST);
  });
}
async function waitPort(port) {
  for (let i = 0; i < 100; i++) {
    const ok = await new Promise((resolve) => {
      const c = net.connect(port, HOST, () => { c.end(); resolve(true); });
      c.once('error', () => resolve(false));
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

let KEY = '';
async function api(method, p, body) {
  const headers = { Origin: BASE, 'X-Bench-Key': KEY };
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}
// an owner prompt the way the bench files one: four slots, one after another
async function seedPrompt(text) {
  const ref = crypto.randomUUID();
  let last = null;
  for (const slot of ['a', 'b', 'c', 'd']) {
    last = await api('POST', '/api/jd2-generate.php',
      { client_ref: ref, slot, prompt: text, client: 'web', website: '', profile: 'bench' });
    if (!last.ok) throw new Error('seed failed: ' + JSON.stringify(last));
  }
  return { prompt_id: last.prompt_id, run_id: last.run_id };
}

// --- the page helpers ----------------------------------------------------------
const view = (pg) => pg.evaluate(() => {
  const c = document.querySelector('.jd-turn');
  return window.JD_turn && window.JD_turn.isOpen() && c ? c.getAttribute('data-view') : null;
});
async function seated(pg, promptId, timeout) {
  await pg.waitForFunction((id) => window.JD_bench && window.JD_bench.current() === id &&
    window.JD_turn.isOpen() && document.querySelector('.jd-turn[data-view="bench"], .jd-turn[data-view="call"]'),
  promptId, { timeout: timeout || 30000 });
}
const barText = (pg) => pg.$eval('.jd-bench-bar', (b) => b.textContent);

async function rateThrough(pg, note) {
  // the four grading panels: every select answered (varied values)
  for (let d = 0; d < 4; d++) {
    await pg.waitForSelector('.jd-bench', { timeout: 10000 });
    const sels = await pg.$$('.jd-bench select.jd-turn-select');
    for (let i = 0; i < sels.length; i++) {
      const n = await sels[i].evaluate((s) => s.options.length);
      await sels[i].selectOption({ index: 1 + ((i + d) % (n - 1)) });
    }
    if (d === 0) await shot(pg, '2-bench');
    await pg.click('.jd-turn-actions [data-act="next"]');
  }
  // the podium: arm each step, then press the drawing for it
  await pg.waitForSelector('.jd-pod-tier[data-rank="1"]');
  const order = await pg.$$eval('.jd-pod-tray .jd-pod-print', (els) => els.map((e) => e.getAttribute('data-pod')));
  for (let k = 1; k <= order.length; k++) {
    await pg.click('.jd-pod-tier[data-rank="' + k + '"] .jd-pod-block');
    await pg.click('.jd-pod-print[data-pod="' + order[k - 1] + '"]');
  }
  await shot(pg, '3-podium');
  await pg.click('.jd-turn-actions [data-act="next"]');
  // the head to head: six cards
  let cards = 0;
  for (;;) {
    if ((await view(pg)) !== 'pair') break;
    cards++;
    const title = await pg.$eval('.jd-turn-title', (h) => h.textContent);
    await pg.click('.jd-pair-stop[data-score="' + [-3, -1, 0, 1, 2, 3][cards - 1] + '"]');
    await pg.click('.jd-turn-actions .jd-turn-go');
    await pg.waitForFunction((t) => {
      const h = document.querySelector('.jd-turn-title');
      return h && h.textContent !== t;
    }, title, { timeout: 5000 });
  }
  // the size card: the tier, and the notes for the record
  await pg.waitForSelector('[data-act="size"][data-size="m"]');
  const hasNote = !!(await pg.$('textarea[data-role="sitting-note"]'));
  await pg.click('[data-act="size"][data-size="m"]');
  if (hasNote) await pg.fill('textarea[data-role="sitting-note"]', note);
  await shot(pg, '4-size-note');
  await pg.click('.jd-turn-actions [data-act="file"]');
  return { cards, hasNote };
}

async function main() {
  if (!(await portFree(PORT))) {
    console.error(`Refusing: ${HOST}:${PORT} is already in use — stop that server first (this test starts its own).`);
    process.exit(2);
  }
  // the dev database: the runner, then the jd2 tables emptied
  const setup = execFileSync('php', ['api/setup-jd2-tables.php'], { cwd: ROOT, env: ENV, encoding: 'utf8' });
  if (!/All tables present and migrated\./.test(setup)) {
    console.error('The jd2 runner did not finish cleanly:\n' + setup);
    process.exit(2);
  }
  php('if (!JD_DEV_MODE) { exit(2); } $db = jd_db(); ' +
    '$db->exec("UPDATE jd2_prompts SET shown_run_id = NULL, pinned_generation_id = NULL"); ' +
    'foreach (["jd2_pairs","jd2_rankings","jd2_judgments","jd2_sessions","jd2_generations","jd2_runs","jd2_prompts"] as $t) { $db->exec("DELETE FROM $t"); }');
  KEY = php('echo jd_bench_key_expected() ?? "keyless-dev-checkout";').trim();

  // its own process group: PHP_CLI_SERVER_WORKERS forks workers that outlive
  // a signal to the parent alone, so the whole group is stopped at the end
  const server = spawn('php', ['-S', `${HOST}:${PORT}`, 'router.php'], {
    cwd: ROOT, env: Object.assign({}, ENV, { PHP_CLI_SERVER_WORKERS: '6' }),
    stdio: ['ignore', 'ignore', 'pipe'], detached: true
  });
  let serverLog = '';
  server.stderr.on('data', (d) => { serverLog = (serverLog + d).slice(-20000); });
  const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch (e) { /* gone */ } };
  process.on('exit', stop);
  if (!(await waitPort(PORT))) throw new Error('the dev server did not come up');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  try {
    // --- seed --------------------------------------------------------------
    const stamp = Date.now();
    const P1 = await seedPrompt('a tin wind-up mouse with a brass key (bench test one ' + stamp + ')');
    await new Promise((r) => setTimeout(r, 1100));   // a later `created`, so P2 heads the queue
    const P2 = await seedPrompt('a glass inkwell with a dried blue crust (bench test two ' + stamp + ')');
    check('seed: two owner prompts, bench profile, four drawings each',
      q("SELECT COUNT(*) AS n FROM jd2_runs WHERE profile = 'bench' AND requested_by = 'owner'")[0].n == 2 &&
      q("SELECT COUNT(*) AS n FROM jd2_generations WHERE status = 'ok'")[0].n == 8);

    // --- rate --------------------------------------------------------------
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
    await page.evaluate((k) => localStorage.setItem('jd-admin-key', k), KEY);
    await page.goto(BASE + '/art/junk-drawer/?bench', { waitUntil: 'load' });
    await seated(page, P2.prompt_id);
    await shot(page, '1-seated');
    const bar1 = await barText(page);
    check('?bench seats the newest prompt first, blind, with "2 to go"', /2 to go/.test(bar1), bar1);
    check('the build stamp prints tax v<taxonomy> · instr <instrument>', /tax v\d+ · instr \S+/.test(bar1), bar1);
    const blind = await page.evaluate(() => (window.JD_bench.queue().items || [])
      .every((it) => it.responses.every((r) => !('model_id' in r))));
    check('the queue was read blind (no model_id without ?reveal=1)', blind);

    const NOTE = 'b and d missed the dried crust; a reads as an inkwell at a glance';
    const r = await rateThrough(page, NOTE);
    check('the card ran six head-to-head cards', r.cards === 6, String(r.cards));
    check('the size card carries "notes for the record" on the bench', r.hasNote);
    await page.waitForSelector('.jd-pod--said', { timeout: 20000 });
    await page.waitForTimeout(800);
    await shot(page, '5-unveil');
    const names = await page.$$eval('.jd-pod-who b', (b) => b.map((x) => x.textContent.trim()));
    check('the unveil names four models from the filing\'s reveal', names.length === 4 && names.every(Boolean), names.join(', '));
    await page.click('[data-act="done"]');
    await seated(page, P1.prompt_id);
    const bar2 = await barText(page);
    check('DONE advances the queue to the other prompt ("1 to go")', /1 to go/.test(bar2), bar2);
    // jd2-rate answers `build`; the same deploy as the queue's is not stale
    const filedBuild = await page.evaluate(() => !document.querySelector('.jd-bench-build.is-stale'));
    check("the filing's build matches the queue's (no stale-deploy line)", filedBuild);

    const sess = q('SELECT s.id, s.rater_role, s.blind, s.note, s.status FROM jd2_sessions s WHERE s.run_id = ?', [P2.run_id]);
    check('SQLite: one owner session on the run, blind, filed', sess.length === 1 && sess[0].rater_role === 'owner' &&
      Number(sess[0].blind) === 1 && sess[0].status === 'filed', JSON.stringify(sess));
    check('SQLite: the sitting carries the note', sess.length === 1 && sess[0].note === NOTE, JSON.stringify(sess[0] && sess[0].note));
    const prs = sess.length ? q('SELECT source, method, shown_left FROM jd2_pairs WHERE session_id = ?', [sess[0].id]) : [];
    check('SQLite: six DIRECT pairs, each with shown_left', prs.length === 6 &&
      prs.every((p) => p.source === 'direct' && p.method === null && p.shown_left), JSON.stringify(prs));
    const cells = sess.length ? q("SELECT COUNT(*) AS n FROM jd2_judgments WHERE session_id = ? AND kind = 'grade'", [sess[0].id])[0].n : 0;
    const ranks = sess.length ? q('SELECT rank_pos FROM jd2_rankings WHERE session_id = ? ORDER BY rank_pos', [sess[0].id]) : [];
    check('SQLite: four grades and a strict ranking 1..4', Number(cells) === 4 &&
      ranks.map((x) => Number(x.rank_pos)).join() === '1,2,3,4', cells + ' / ' + JSON.stringify(ranks));
    const p2row = q('SELECT visibility, size_class FROM jd2_prompts WHERE id = ?', [P2.prompt_id])[0];
    check('the complete sitting made the prompt live, sized m', p2row.visibility === 'live' && p2row.size_class === 'm', JSON.stringify(p2row));

    // --- direct ------------------------------------------------------------
    await page.goto(BASE + '/art/junk-drawer/?bench&prompt=' + P2.prompt_id, { waitUntil: 'load' });
    await seated(page, P2.prompt_id);
    const v = await view(page);
    const full = await page.$eval('.jd-turn-actions [data-act="next"]', (b) => !b.disabled).catch(() => false);
    check('?bench&prompt=<closed id> seats it on the podium, full (prefilled ranks)', v === 'call' && full, v);
    await page.click('.jd-rail-step[data-step="a"]');
    await page.waitForSelector('.jd-bench select.jd-turn-select');
    const answered = await page.$$eval('.jd-bench select.jd-turn-select', (s) => s.length > 0 && s.every((x) => x.value !== ''));
    check('…and every scale on its drawings comes up answered (prefilled grades and axes)', answered);
    const pairsPrefilled = await page.$eval('.jd-rail-step--pairs', (b) => !b.disabled).catch(() => false);
    await shot(page, '6-direct-prefill');
    // the pairs prefill: the podium's button leads on, and the first pair card shows an answer
    await page.click('.jd-rail-step[data-step="call"]');
    await page.click('.jd-turn-actions [data-act="next"]');
    await page.waitForSelector('.jd-turn[data-view="pair"]');
    const pairAnswered = await page.$eval('.jd-turn-actions .jd-turn-go', (b) => !b.disabled);
    check('…and its head-to-head answers come back prefilled', pairAnswered, String(pairsPrefilled));

    // --- scrap ---------------------------------------------------------------
    await page.click('.jd-bench-bar [data-bench="scrap"]');
    await seated(page, P1.prompt_id);
    await page.waitForFunction(() => /filed/.test(document.querySelector('.jd-bench-bar').textContent), null, { timeout: 5000 }).catch(() => {});
    const vis1 = q('SELECT visibility, hidden_by FROM jd2_prompts WHERE id = ?', [P2.prompt_id])[0];
    check('scrap hides the prompt (hidden, by the owner) and the bench moves on', vis1.visibility === 'hidden' && vis1.hidden_by === 'owner', JSON.stringify(vis1));

    // --- hidden --------------------------------------------------------------
    await page.click('.jd-bench-bar [data-bench="hidden"]');
    await page.waitForSelector('.jd-bench-sheet [data-show="' + P2.prompt_id + '"]', { timeout: 10000 });
    const to = await page.$eval('.jd-bench-sheet [data-show="' + P2.prompt_id + '"]', (b) => b.getAttribute('data-to'));
    await shot(page, '7-hidden-items');
    check('HIDDEN ITEMS lists it from the ledger, to come back live', to === 'live', to);
    // the SHOW's jd2-curate answer is rewritten in flight to name another
    // build, as if a deploy had landed under the page
    await page.route('**/api/jd2-curate.php', async (route) => {
      const resp = await route.fetch();
      const j = await resp.json();
      if (j && j.ok) j.build = 'zzzzzz';
      await route.fulfill({ response: resp, json: j });
    });
    await page.click('.jd-bench-sheet [data-show="' + P2.prompt_id + '"]');
    await page.waitForFunction((id) => !document.querySelector('.jd-bench-sheet [data-show="' + id + '"]'), P2.prompt_id, { timeout: 10000 });
    const vis2 = q('SELECT visibility, hidden_by FROM jd2_prompts WHERE id = ?', [P2.prompt_id])[0];
    check('SHOW returns it live', vis2.visibility === 'live' && vis2.hidden_by === null, JSON.stringify(vis2));
    await page.waitForSelector('.jd-bench-build.is-stale', { timeout: 5000 }).catch(() => {});
    const staleText = await page.$eval('.jd-bench-build.is-stale', (e) => e.textContent).catch(() => '');
    check('a jd2-curate answer naming another build trips "a deploy landed"', /a deploy landed/.test(staleText), staleText);
    await page.unroute('**/api/jd2-curate.php');

    // --- new ------------------------------------------------------------------
    const NEWTEXT = 'a cracked porcelain doorknob, white with a gold rim (bench new prompt ' + stamp + ')';
    await page.click('.jd-bench-bar [data-bench="new"]');
    await page.waitForSelector('.jd-bench-sheet form.jd-bench-new textarea');
    await page.fill('.jd-bench-sheet [name="prompt"]', NEWTEXT);
    await page.fill('.jd-bench-sheet [name="title"]', 'Porcelain Doorknob');
    await page.fill('.jd-bench-sheet [name="category"]', 'hardware');
    await shot(page, '8-new-prompt-form');
    await page.click('.jd-bench-sheet button[type="submit"]');
    await page.waitForSelector('.jd-turn[data-view="darkroom"]', { timeout: 10000 });
    await shot(page, '9-darkroom');
    check('NEW PROMPT draws in the darkroom', true);
    await page.waitForFunction((t) => {
      const it = window.JD_bench && window.JD_bench.queue() && window.JD_bench.queue().items
        .filter((x) => x.prompt === t)[0];
      return it && window.JD_bench.current() === it.prompt_id && window.JD_turn.isOpen() &&
        document.querySelector('.jd-turn[data-view="bench"]');
    }, NEWTEXT, { timeout: 60000 });
    await shot(page, '10-new-seated');
    const np = q('SELECT id, origin, title, category, visibility FROM jd2_prompts WHERE text = ?', [NEWTEXT]);
    const nr = np.length ? q('SELECT id, kind, requested_by, profile FROM jd2_runs WHERE prompt_id = ?', [np[0].id]) : [];
    const ng = nr.length ? q("SELECT COUNT(*) AS n FROM jd2_generations WHERE run_id = ? AND status = 'ok'", [nr[0].id])[0].n : 0;
    check('NEW PROMPT filed an owner prompt with its title and category', np.length === 1 && np[0].origin === 'owner' &&
      np[0].title === 'Porcelain Doorknob' && np[0].category === 'hardware' && np[0].visibility === 'draft', JSON.stringify(np));
    check('…as one bench-profile run of four ok drawings (mock provider)', nr.length === 1 && nr[0].kind === 'initial' &&
      nr[0].requested_by === 'owner' && nr[0].profile === 'bench' && Number(ng) === 4, JSON.stringify(nr) + ' ok=' + ng);
    const cur = await page.evaluate(() => window.JD_bench.current());
    check('…and it is seated for rating at once', np.length === 1 && cur === np[0].id, cur);

    // --- rerun ------------------------------------------------------------------
    await page.click('.jd-bench-bar [data-bench="rerun"]');
    await page.waitForSelector('.jd-turn[data-view="darkroom"]', { timeout: 10000 });
    await page.waitForFunction((id) => {
      const it = window.JD_bench.queue().items.filter((x) => x.prompt_id === id)[0];
      return it && it.runs === 2 && window.JD_bench.current() === id && window.JD_turn.isOpen() &&
        document.querySelector('.jd-turn[data-view="bench"]');
    }, np[0].id, { timeout: 60000 });
    const runs = q('SELECT id, kind, profile, requested_by FROM jd2_runs WHERE prompt_id = ? ORDER BY created DESC, id DESC', [np[0].id]);
    const seatedRun = await page.evaluate((id) => window.JD_bench.queue().items.filter((x) => x.prompt_id === id)[0].run_id, np[0].id);
    check('RERUN draws a new bench run of the prompt and seats it', runs.length === 2 && runs[0].kind === 'rerun' &&
      runs[0].profile === 'bench' && runs[0].requested_by === 'owner' && seatedRun === runs[0].id, JSON.stringify(runs) + ' seated ' + seatedRun);

    // --- the ?item= alias --------------------------------------------------------
    await page.goto(BASE + '/art/junk-drawer/?bench&item=' + P1.prompt_id, { waitUntil: 'load' });
    await seated(page, P1.prompt_id);
    check('?bench&item=<id> still seats that prompt (alias for one release)', true);

    // --- ?rerun= ----------------------------------------------------------------------
    // the drawer's ?rerun=<id> door: with the key it is the owner path, and the
    // page lands on the bench seated on the new run
    await page.goto(BASE + '/art/junk-drawer/?rerun=' + P2.prompt_id, { waitUntil: 'load' });
    await page.waitForURL(/[?&]bench&prompt=/, { timeout: 60000 });
    await seated(page, P2.prompt_id);
    const p2runs = q('SELECT id, kind, profile, requested_by FROM jd2_runs WHERE prompt_id = ? ORDER BY created DESC, id DESC', [P2.prompt_id]);
    const p2seated = await page.evaluate((id) => window.JD_bench.queue().items.filter((x) => x.prompt_id === id)[0].run_id, P2.prompt_id);
    check('?rerun=<id> draws an owner bench rerun and lands on the bench seated on it', p2runs.length === 2 &&
      p2runs[0].kind === 'rerun' && p2runs[0].profile === 'bench' && p2runs[0].requested_by === 'owner' &&
      p2seated === p2runs[0].id, JSON.stringify(p2runs));

    // --- gate ---------------------------------------------------------------------
    const anon = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ap = await anon.newPage();
    ap.on('pageerror', (e) => errors.push('anon: ' + String(e)));
    await ap.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
    await ap.waitForFunction(() => window.JD_turn && window.JD_record && window.JD_record.ready(), null, { timeout: 20000 });
    const refused = await ap.evaluate((id) => window.JD_turn.rerun({ prompt_id: id, redirect: false }), P2.prompt_id);
    check('without the key, JD_turn.rerun refuses (never a visitor turn)', refused === false && !(await ap.evaluate(() => window.JD_turn.isOpen())));
    await ap.goto(BASE + '/art/junk-drawer/?bench', { waitUntil: 'load' });
    await ap.waitForSelector('.jd-bench-gate input', { timeout: 10000 });
    const anonBar = await ap.$$eval('.jd-bench-bar [data-bench]', (b) => b.map((x) => x.getAttribute('data-bench')));
    check('without the key the strip is only the gate (no NEW PROMPT)', anonBar.length === 0, anonBar.join(','));
    await anon.close();

    check('no page errors', errors.length === 0, errors.join('\n'));
  } finally {
    await browser.close();
    stop();
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed — screenshots in ' + OUT);
  if (failed) console.log('\n-- server log (tail) --\n' + serverLog.slice(-3000));
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
