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
//   preview  the sitting opens on THE PREVIEW (0.15.0): first docket station,
//          four cells A–D carrying every drawing of the run once, the
//          eight-station docket on one line, a click enlarging a print; the
//          grading panels then show the same seats; a ?bench&prompt= resume
//          opens on it too and its next goes on to the podium; 2×2 at 390
//   rate   ?bench seats the newest; the card is rated end to end — four
//          grading panels, the podium, THE PEDESTAL CARD (gaps 1, 0, 2 by
//          ballot), the size, the "notes for the record" — and filed with
//          the gaps on the ranking and `pairs: null`; the unveil names the
//          models from the filing's reveal; DONE advances the queue to the
//          other prompt; SQLite holds ONE owner session, blind, with the
//          note, gap_after 1/0/2 and six DERIVED pairs, and the prompt went
//          live
//   direct ?bench&prompt=<id> seats the closed prompt with its prefill
//          (opens on the podium, every scale answered, and the pedestal card
//          comes up with the filed gaps — the reload round trip, through the
//          server); ?bench&item= too
//   pruned P2's sitting with a retired cell (structural-coherence, no
//          successor) and layering-2 off its scale: the reopen drops both,
//          says prefill_pruned and the card's one-line note
//   mapped P2's sitting as a v35 sitting (Layering on the 3-point
//          `layering`, required_cells naming it): the reopen carries every
//          answer onto layering-2 through the taxonomy's `successor` map
//          (prefill_mapped; the card's note; the rc-q ramp), the report card
//          shows ONE Layering row at the mapped value, marked "mapped from
//          the 3-point scale", and the judgment rows do not move
//   scrap  hides it (visibility hidden) and the bench moves on
//   hidden HIDDEN ITEMS lists it from the ledger; SHOW returns it live — and
//          a jd2-curate answer naming another build (the response rewritten
//          in flight) trips the strip's "a deploy landed" line
//   intake the intake clerk (the mock) files P2's heading, tier and headings;
//          the bench's closing card (the catalogue entry) OPENS ON THE
//          CLERK'S TIER (pre-selected); the owner's pick files size_by owner
//   new    NEW PROMPT draws under the bench profile through the darkroom with
//          the mock provider, files title and category, runs the intake
//          clerk (title given, size left open: the owner's title stands, the
//          clerk's tier and headings are filed), and seats the new run for
//          rating
//   rerun  RERUN draws a new bench run of that prompt and seats it; the
//          drawer's ?rerun=<id> door does the same through the owner path
//   audit  ?bench&prompt=<id>&pairs=1 runs the six side-by-side head-to-head
//          cards in the pedestal card's place and files DIRECT pairs with a
//          ranking that carries no gaps
//   entry  THE CATALOGUE ENTRY (0.13.0) closes P2's sitting: the clerk's
//          heading, tier (pre-selected) and headings, every chip's tooltip
//          its scope note, the reasons and the intake stamp; the last
//          subject chip will not come off; the heading edited, a subject
//          swapped, a treatment added and the size changed file through
//          jd2-curate BEFORE jd2-rate (which carries no size); SQLite, the
//          queue and the ledger hold the edits with size_by owner; the
//          ?bench&prompt= reopen shows them; on a 390×844 phone the entry
//          fits and a long press shows a scope note without filing it
//   untouched  the rerun filed with the entry untouched sends no jd2-curate
//          and the clerk's size stays size_by model
//   fallback  a prompt whose intake failed shows "intake failed", no chips,
//          no tier; subject's minimum holds the file button; its first
//          headings and size file as the owner's
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

// the rubric as the card reads it: the facets' live headings and scope notes
const TAX = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/junk-drawer/taxonomy.json'), 'utf8'));
const FACETS = TAX.facets.map((f) => Object.assign({}, f, { headings: f.headings.filter((h) => !h.defunct) }));
const scopeOf = (f, h) => FACETS.find((x) => x.id === f).headings.find((x) => x.id === h).scope;
const plain = (t) => String(t).replace(/\*([^*]+)\*/g, '$1');
const sameSet = (a, b) => (a || []).slice().sort().join('|') === (b || []).slice().sort().join('|');

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
    window.JD_turn.isOpen() &&
    document.querySelector('.jd-turn[data-view="preview"], .jd-turn[data-view="bench"], .jd-turn[data-view="call"]'),
  promptId, { timeout: timeout || 30000 });
}
const barText = (pg) => pg.$eval('.jd-bench-bar', (b) => b.textContent);

// the pedestal card's slips, its answer and its button, read off the page
const pedState = (pg) => pg.evaluate(() => {
  const go = document.querySelector('.jd-turn-actions .jd-turn-go');
  return {
    tab: (document.querySelector('.jd-ped-q-tab') || {}).textContent,
    slips: [...document.querySelectorAll('.jd-ped-slip .jd-ped-w')].map((x) => x.textContent),
    answer: window.JD_turn.pedestal.answer(),
    go: go ? { act: go.getAttribute('data-act'), disabled: go.disabled } : null
  };
});

// THE PREVIEW (0.15.0), read off the page: the view, the docket's stations,
// each cell's seat, pencilled letter and frame key (data-fit = the
// generation), the empties, and the button
const previewState = (pg) => pg.evaluate(() => {
  const go = document.querySelector('.jd-turn-actions .jd-turn-go');
  return {
    view: document.querySelector('.jd-turn').getAttribute('data-view'),
    title: (document.querySelector('.jd-turn-title') || {}).textContent,
    rail: [...document.querySelectorAll('.jd-rail-step')].map((b) => ({ step: b.getAttribute('data-step'),
      current: b.classList.contains('is-current'), reached: !b.disabled })),
    cells: [...document.querySelectorAll('.jd-preview-cell:not(.is-empty)')].map((c) => ({ seat: c.getAttribute('data-cell'),
      tag: (c.querySelector('.jd-pair-tag') || {}).textContent,
      fit: (c.querySelector('.jd-turn-art-in') || { getAttribute: () => null }).getAttribute('data-fit'),
      svg: !!c.querySelector('.jd-turn-art-in svg') })),
    empty: document.querySelectorAll('.jd-preview-cell.is-empty').length,
    // the docket inside the sheet's printed border (inset 5px), on one line
    railFits: (() => {
      const card = document.querySelector('.jd-turn').getBoundingClientRect();
      const st = [...document.querySelectorAll('.jd-rail-step')].map((b) => b.getBoundingClientRect());
      return st.length > 0 && st.every((r) => r.left >= card.left + 6 && r.right <= card.right - 6) &&
        new Set(st.map((r) => Math.round(r.top))).size === 1;
    })(),
    go: go ? { act: go.getAttribute('data-act'), text: go.textContent, disabled: go.disabled } : null,
    text: document.querySelector('.jd-turn').textContent
  };
});
const benchFit = (pg) => pg.$eval('.jd-bench .jd-turn-pin .jd-turn-art-in', (e) => e.getAttribute('data-fit'));

// mode 'gaps' (the instrument) answers the pedestal card by ballot with
// `gaps` (the card's stops: 0.5 = negligibly); mode 'pairs' (?pairs=1) runs
// the six side-by-side cards
async function rateThrough(pg, note, mode, gaps, atEntry) {
  // every sitting opens on THE PREVIEW (0.15.0): read it, then next
  await pg.waitForSelector('.jd-turn[data-view="preview"] .jd-preview', { timeout: 10000 });
  const preview = await previewState(pg);
  await pg.click('.jd-turn-actions [data-act="next"]');
  const fits = [];
  // the four grading panels: every select answered (varied values)
  for (let d = 0; d < 4; d++) {
    await pg.waitForSelector('.jd-bench', { timeout: 10000 });
    fits.push(await benchFit(pg));
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
  await shot(pg, mode === 'pairs' ? '3-podium-audit' : '3-podium');
  await pg.click('.jd-turn-actions [data-act="next"]');
  let cards = 0, ped = null;
  const rail = await pg.$$eval('.jd-rail-step', (b) => b.map((x) => x.getAttribute('data-step')));
  if (mode === 'pairs') {
    // the audit's head to head: six cards
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
  } else {
    // the pedestal card: one question per adjacent pair, by ballot
    await pg.waitForSelector('.jd-turn[data-view="gaps"] .jd-ped', { timeout: 10000 });
    for (let i = 0; i < gaps.length; i++) {
      await pg.click('.jd-ped-qo[data-gap="' + gaps[i] + '"]');
      if (i === gaps.length - 1) {
        await pg.waitForTimeout(1200);
        await shot(pg, '3b-pedestal');
        ped = await pedState(pg);
      }
      await pg.click('.jd-turn-actions .jd-turn-go');
    }
  }
  // the closing card (the catalogue entry on the bench): the tier, and the
  // notes for the record — or whatever the caller's atEntry does there
  await pg.waitForSelector('[data-act="size"][data-size="m"]');
  const preset = await pg.$$eval('.jd-size-tier.is-on', (b) => b.map((x) => x.getAttribute('data-size')));
  const hasNote = !!(await pg.$('textarea[data-role="sitting-note"]'));
  const entry = await entryState(pg);
  let edits = null;
  if (atEntry) edits = await atEntry(pg);
  else await pg.click('[data-act="size"][data-size="m"]');
  if (hasNote) await pg.fill('textarea[data-role="sitting-note"]', note);
  await shot(pg, '4-size-note');
  await pg.click('.jd-turn-actions [data-act="file"]');
  return { cards, hasNote, preset, ped, rail, entry, edits, preview, fits };
}

// the catalogue entry card, read off the page: its heading, the view, the
// rail's last station, the title field, the chips (on, locked, their
// tooltips), the scope lines, the reasons, the footnote and the file button
const entryState = (pg) => pg.evaluate(() => {
  const card = document.querySelector('.jd-turn');
  const go = document.querySelector('.jd-turn-actions [data-act="file"]');
  const steps = [...document.querySelectorAll('.jd-rail-step')];
  const last = steps[steps.length - 1];
  const chips = {};
  document.querySelectorAll('.jd-cat-chip').forEach((c) => {
    const f = c.getAttribute('data-facet');
    (chips[f] = chips[f] || []).push({ id: c.getAttribute('data-heading'), on: c.classList.contains('is-on'),
      locked: c.getAttribute('aria-disabled') === 'true', title: c.getAttribute('title') });
  });
  const ti = document.querySelector('.jd-cat-title');
  return {
    view: card && card.getAttribute('data-view'),
    heading: (document.querySelector('.jd-turn-title') || {}).textContent,
    station: last ? { step: last.getAttribute('data-step'), word: (last.querySelector('.jd-rail-word') || {}).textContent,
      label: last.getAttribute('aria-label') } : null,
    title: ti ? ti.value : null,
    placeholder: ti ? ti.getAttribute('placeholder') : null,
    chips,
    on: Object.fromEntries(Object.entries(chips).map(([f, l]) => [f, l.filter((x) => x.on).map((x) => x.id)])),
    scope: Object.fromEntries([...document.querySelectorAll('.jd-cat-scope')].map((x) => [x.getAttribute('data-scope-for'), x.textContent])),
    why: [...document.querySelectorAll('.jd-cat-why')].map((x) => x.textContent),
    who: (document.querySelector('[data-role="size-who"]') || {}).textContent,
    foot: (document.querySelector('.jd-cat-foot') || {}).textContent,
    go: go ? { disabled: go.disabled, text: go.textContent } : null
  };
});
// the pedestal card's own button walks its questions, then hands on: press
// it until the card has moved on to the catalogue entry
async function throughGaps(pg) {
  for (let i = 0; i < 6 && (await view(pg)) === 'gaps'; i++) {
    await pg.click('.jd-turn-actions .jd-turn-go');
    await pg.waitForTimeout(250);
  }
  await pg.waitForSelector('.jd-turn[data-view="entry"] .jd-cat');
  await pg.waitForTimeout(400);   // the sheet's width transition settles
}
const chip = (f, h) => '.jd-cat-chip[data-facet="' + f + '"][data-heading="' + h + '"]';

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
    // the intake clerk on P2, the way NEW PROMPT and the batch runner call it
    const P2intake = await api('POST', '/api/jd2-intake.php', { prompt_id: P2.prompt_id });
    const tiersAll = ['xs', 's', 'm', 'l', 'xl'];
    const P2tier = tiersAll[[...('a glass inkwell with a dried blue crust (bench test two ' + stamp + ')')].length % 5];
    check('intake: the clerk filed P2 (mock): its tier, size_by model, headings',
      P2intake.ok && !P2intake.fallback && P2intake.size_class === P2tier && P2intake.size_by === 'model' &&
      !!(P2intake.tags && P2intake.tags.subject && P2intake.tags.subject.length), JSON.stringify(P2intake));
    check('seed: two owner prompts, bench profile, four drawings each',
      q("SELECT COUNT(*) AS n FROM jd2_runs WHERE profile = 'bench-medium' AND requested_by = 'owner'")[0].n == 2 &&
      q("SELECT COUNT(*) AS n FROM jd2_generations WHERE status = 'ok'")[0].n == 8);

    // --- rate --------------------------------------------------------------
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
    await page.evaluate((k) => localStorage.setItem('jd-admin-key', k), KEY);
    await page.goto(BASE + '/art/junk-drawer/?bench', { waitUntil: 'load' });
    await seated(page, P2.prompt_id);
    await page.waitForTimeout(400);   // the sheet's width transition settles
    await shot(page, '1-seated');
    // THE PREVIEW (0.15.0): the bench sitting opens on it — the same card a
    // visitor gets — every drawing in the 2×2 in the card's blind seat order
    const pv1 = await previewState(page);
    const qItem = await page.evaluate((id) => window.JD_bench.queue().items.filter((x) => x.prompt_id === id)[0], P2.prompt_id);
    const gens = (qItem ? qItem.responses : []).map((r) => 'gen:' + r.generation_id).sort();
    check('?bench opens the sitting on the preview: first docket station, current; drawing A (the resume point) next, the rest unreached',
      pv1.view === 'preview' && pv1.rail[0] && pv1.rail[0].step === 'preview' && pv1.rail[0].current &&
      pv1.rail[1].step === 'a' && pv1.rail.slice(2).every((r) => !r.reached), JSON.stringify({ view: pv1.view, rail: pv1.rail }));
    check('…four cells, seats A–D pencilled "Drawing A…D", every one of the run\'s drawings once, nothing empty',
      pv1.cells.map((c) => c.seat).join() === 'a,b,c,d' && pv1.cells.every((c) => c.svg && c.tag === 'Drawing ' + c.seat.toUpperCase()) &&
      pv1.cells.map((c) => c.fit).sort().join() === gens.join() && pv1.empty === 0,
      JSON.stringify({ cells: pv1.cells, gens }));
    check('…its eight-station docket (preview … catalogue entry) stands on one line inside the sheet at 1280px', pv1.railFits);
    check('…and its next leads to drawing A, armed', pv1.go && pv1.go.act === 'next' && !pv1.go.disabled &&
      /next — drawing A/.test(pv1.go.text), JSON.stringify(pv1.go));
    await page.click('.jd-preview-cell[data-cell="c"] .jd-turn-plate');
    const pvZoom = await page.waitForSelector('.jd-record-zoom.is-on .rc-zoom-cap-t', { timeout: 5000 })
      .then((e) => e.textContent()).catch(() => null);
    await page.waitForTimeout(500);   // the layer fades in
    await shot(page, '1c-preview-enlarged');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.jd-record-zoom.is-on'), null, { timeout: 5000 }).catch(() => {});
    check('…a click on a print enlarges it with the blind caption (drawing C), and Escape peels it',
      !!pvZoom && / · drawing C$/.test(pvZoom) && (await view(page)) === 'preview', String(pvZoom));
    const bar1 = await barText(page);
    check('?bench seats the newest prompt first, blind, with "2 to go"', /2 to go/.test(bar1), bar1);
    check('the build stamp prints tax v<taxonomy> · instr <instrument>', /tax v\d+ · instr \S+/.test(bar1), bar1);
    const blind = await page.evaluate(() => (window.JD_bench.queue().items || [])
      .every((it) => it.responses.every((r) => !('model_id' in r))));
    check('the queue was read blind (no model_id without ?reveal=1)', blind);

    const NOTE = 'b and d missed the dried crust; a reads as an inkwell at a glance';
    // every POST to the two writers, in the order the page sent them
    const posts = [];
    page.on('request', (rq) => {
      if (rq.method() === 'POST' && /\/api\/jd2-(curate|rate)\.php/.test(rq.url())) {
        posts.push({ to: /curate/.test(rq.url()) ? 'curate' : 'rate', body: JSON.parse(rq.postData() || '{}') });
      }
    });
    const filing = page.waitForRequest((rq) => /\/api\/jd2-rate\.php/.test(rq.url()) && rq.method() === 'POST', { timeout: 120000 })
      .then((rq) => JSON.parse(rq.postData() || '{}'));
    filing.catch(() => { /* awaited below; a failure inside rateThrough is the error to report */ });
    // THE CATALOGUE ENTRY on P2: read it as the clerk filed it, try to take
    // the only subject off (refused), point at a probe (its scope note), then
    // edit the heading, swap subject object → creature, add treatment retro,
    // and change the size to m
    const P2TITLE = 'Inkwell, glass, crust dried blue';
    let p2min = null, p2hover = null;
    const r = await rateThrough(page, NOTE, 'gaps', ['1', '0.5', '2'], async (pg) => {
      await pg.waitForTimeout(500);   // the sheet's width transition settles
      await shot(pg, '4a-entry-as-filed');
      await pg.$eval('.jd-turn-scroll', (el) => { el.scrollTop = el.scrollHeight; });
      await shot(pg, '4a-entry-as-filed-foot');
      // aria-disabled: a real press still lands (force), and must change nothing
      await pg.click(chip('subject', 'object'), { force: true });
      p2min = await entryState(pg);
      await pg.hover(chip('probe', 'transparency'));
      p2hover = (await entryState(pg)).scope.probe;
      await pg.fill('.jd-cat-title', P2TITLE);
      await pg.click(chip('subject', 'creature'));
      await pg.click(chip('subject', 'object'));
      await pg.click(chip('treatment', 'retro'));
      await pg.click('[data-act="size"][data-size="m"]');
      const after = await entryState(pg);
      await shot(pg, '4b-entry-edited');
      return after;
    });
    const e0 = r.entry;
    check('the preview dealt the same seats the grading panels use (each panel\'s drawing is its preview cell\'s)',
      r.fits.length === 4 && r.fits.join() === r.preview.cells.map((c) => c.fit).join() &&
      r.rail[0] === 'preview', JSON.stringify({ fits: r.fits, cells: r.preview.cells.map((c) => c.fit), rail: r.rail }));
    check('the closing card is THE CATALOGUE ENTRY (heading, data-view, its rail station replacing the size\'s)',
      e0.heading === 'The catalogue entry' && e0.view === 'entry' && e0.station && e0.station.step === 'size' &&
      /catalogue entry/.test(e0.station.word) && !r.rail.some((x) => x === 'entry'), JSON.stringify([e0.heading, e0.view, e0.station]));
    check("…it shows the clerk's heading in the title field, the clerk's tier pre-selected and the clerk's headings on",
      e0.title === P2intake.title && r.preset.join() === P2tier &&
      ['subject', 'treatment', 'probe'].every((f) => sameSet(e0.on[f], (P2intake.tags || {})[f])),
      JSON.stringify({ title: e0.title, preset: r.preset, on: e0.on, clerk: P2intake.tags }));
    const tipsOk = FACETS.every((f) => (e0.chips[f.id] || []).length === f.headings.length &&
      f.headings.every((h) => (e0.chips[f.id].find((c) => c.id === h.id) || {}).title === h.label + ' — ' + plain(h.scope)));
    check('…every heading of every facet is a chip whose tooltip is its scope note (taxonomy.json)', tipsOk,
      JSON.stringify(e0.chips.subject && e0.chips.subject[0]));
    check("…pointing at a chip puts its scope note in the line under its facet",
      typeof p2hover === 'string' && p2hover.indexOf(plain(scopeOf('probe', 'transparency')).slice(0, 60)) !== -1, p2hover);
    check("…the clerk's reasons are small print and the intake's version and model the footnote",
      e0.why.length === 2 && /The mock sizes by the prompt/.test(e0.why[0]) && /first subject heading/.test(e0.why[1]) &&
      e0.foot.indexOf(String(P2intake.intake_version)) !== -1 && /mock/.test(e0.foot) && /the clerk’s/.test(e0.who),
      JSON.stringify({ why: e0.why, foot: e0.foot, who: e0.who }));
    check('min: the last subject chip cannot come off (stays on, locked, the facet line says why)',
      !!p2min && sameSet(p2min.on.subject, ['object']) &&
      p2min.chips.subject.find((c) => c.id === 'object').locked && /Subject needs at least 1 heading/.test(p2min.scope.subject),
      JSON.stringify(p2min && { on: p2min.on.subject, scope: p2min.scope.subject }));
    const ed = r.edits;
    check('…the edits show on the card: the new heading, creature + retro on, object off, m pressed — "yours"',
      ed.title === P2TITLE && sameSet(ed.on.subject, ['creature']) && sameSet(ed.on.treatment, ['retro']) &&
      sameSet(ed.on.probe, []) && /yours/.test(ed.who) && !ed.go.disabled, JSON.stringify(ed.on) + ' ' + ed.who);
    check('the card ran the pedestal card — one rail station, no head-to-head cards',
      r.cards === 0 && r.rail.filter((x) => x === 'gaps').length === 1 && !r.rail.some((x) => x === 'pairs'),
      JSON.stringify(r.rail));
    check('…answered 1, negligibly, 2: the slips say so and its last button hands on to the size',
      !!(r.ped && r.ped.slips.join('|') === 'slightly|≈ negligibly|better' && r.ped.answer.complete &&
        r.ped.go.act === 'next' && !r.ped.go.disabled), JSON.stringify(r.ped));
    const body = await filing;
    check('the bench files the ranking with gaps 1/0/2 (none on the last) and pairs null',
      body.pairs === null && Array.isArray(body.ranking) && body.ranking.map((p) => p.gap).join() === '1,0,2,' &&
      !('gap' in body.ranking[3]), JSON.stringify({ ranking: body.ranking, pairs: body.pairs }));
    check('the catalogue entry carries "notes for the record" on the bench', r.hasNote);
    check("the bench's catalogue entry opens on the clerk's tier (" + P2tier + ', pre-selected)',
      r.preset.length === 1 && r.preset[0] === P2tier, JSON.stringify(r.preset));
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
    const prs = sess.length ? q('SELECT source, method, shown_left, score FROM jd2_pairs WHERE session_id = ?', [sess[0].id]) : [];
    check('SQLite: six DERIVED pairs (spaced-rank-v1), none with shown_left', prs.length === 6 &&
      prs.every((p) => p.source === 'derived' && p.method === 'spaced-rank-v1' && p.shown_left === null), JSON.stringify(prs));
    const gapsFiled = sess.length ? q('SELECT rank_pos, gap_after FROM jd2_rankings WHERE session_id = ? ORDER BY rank_pos', [sess[0].id]) : [];
    check('SQLite: the ranking carries gap_after 1, 0, 2 and none on the last place',
      gapsFiled.map((x) => x.gap_after === null ? '-' : String(x.gap_after)).join() === '1,0,2,-', JSON.stringify(gapsFiled));
    // spaced-rank-v1: 1st›2nd 1, 2nd›3rd 0, 3rd›4th 2, 1st›3rd 1, 2nd›4th 2, 1st›4th 3
    check('SQLite: the derived magnitudes are the summed gaps, capped at 3 (1,0,2,1,2,3)',
      prs.map((p) => Math.abs(Number(p.score))).sort().join() === [1, 0, 2, 1, 2, 3].sort().join(), JSON.stringify(prs));
    const cells = sess.length ? q("SELECT COUNT(*) AS n FROM jd2_judgments WHERE session_id = ? AND kind = 'grade'", [sess[0].id])[0].n : 0;
    const ranks = sess.length ? q('SELECT rank_pos FROM jd2_rankings WHERE session_id = ? ORDER BY rank_pos', [sess[0].id]) : [];
    check('SQLite: four grades and a strict ranking 1..4', Number(cells) === 4 &&
      ranks.map((x) => Number(x.rank_pos)).join() === '1,2,3,4', cells + ' / ' + JSON.stringify(ranks));
    const p2row = q('SELECT visibility, title, size_class, size_by, tags FROM jd2_prompts WHERE id = ?', [P2.prompt_id])[0];
    check('the complete sitting made the prompt live, sized m — the owner\'s size (size_by owner)',
      p2row.visibility === 'live' && p2row.size_class === 'm' && p2row.size_by === 'owner', JSON.stringify(p2row));
    // ONE PATH: the entry's edits through jd2-curate, FIRST, only what changed;
    // the sitting through jd2-rate with no size
    const cPosts = posts.filter((x) => x.to === 'curate'), rPosts = posts.filter((x) => x.to === 'rate');
    const cb = cPosts[0] && cPosts[0].body;
    check('filing sends jd2-curate the heading, the size and the headings — and nothing else — before jd2-rate',
      cPosts.length === 1 && rPosts.length === 1 && posts.indexOf(cPosts[0]) < posts.indexOf(rPosts[0]) &&
      Object.keys(cb).sort().join() === 'prompt_id,size_class,tags,title' && cb.title === P2TITLE && cb.size_class === 'm' &&
      sameSet(cb.tags.subject, ['creature']) && sameSet(cb.tags.treatment, ['retro']) && sameSet(cb.tags.probe, []),
      JSON.stringify(posts.map((x) => [x.to, Object.keys(x.body)])));
    check('…and jd2-rate carries no size (the entry is curate\'s)', !('size' in body) && !('title' in body), Object.keys(body).join());
    let p2tags = null;
    try { p2tags = JSON.parse(p2row.tags); } catch (e) { /* null */ }
    check('SQLite: jd2_prompts holds the owner\'s heading and headings',
      p2row.title === P2TITLE && p2tags && sameSet(p2tags.subject, ['creature']) && sameSet(p2tags.treatment, ['retro']) &&
      sameSet(p2tags.probe, []), JSON.stringify(p2row));
    const qP2 = await api('GET', '/api/jd2-queue.php?prompt=' + P2.prompt_id);
    const qi = qP2.items && qP2.items[0];
    check('the queue reflects the edits: title, title_on_file, size m by the owner, the headings',
      !!qi && qi.title === P2TITLE && qi.title_on_file === P2TITLE && qi.size_class === 'm' && qi.size_by === 'owner' &&
      sameSet(qi.tags.subject, ['creature']) && sameSet(qi.tags.treatment, ['retro']) && Array.isArray(qP2.facets) && qP2.facets.length === 3,
      JSON.stringify(qi && { title: qi.title, size: qi.size_class, by: qi.size_by, tags: qi.tags }));
    const led = await api('GET', '/api/jd2-ledger.php');
    const li = (led.items || []).find((x) => x.prompt_id === P2.prompt_id);
    check('the ledger reflects the edits: title, size m by the owner, the headings',
      !!li && li.title === P2TITLE && li.size_class === 'm' && li.size_by === 'owner' &&
      sameSet((li.tags || {}).subject, ['creature']) && sameSet((li.tags || {}).treatment, ['retro']),
      JSON.stringify(li && { title: li.title, size: li.size_class, by: li.size_by, tags: li.tags }));

    // --- direct ------------------------------------------------------------
    await page.goto(BASE + '/art/junk-drawer/?bench&prompt=' + P2.prompt_id, { waitUntil: 'load' });
    await seated(page, P2.prompt_id);
    // a resume opens on the PREVIEW too (a glance, not a question); its next
    // goes where the resume would have opened — the podium, full
    const v0 = await previewState(page);
    await shot(page, '6a-direct-preview');
    check('?bench&prompt=<closed id> opens on the preview, every answered station reachable, next toward the ranking',
      v0.view === 'preview' && v0.rail[0].step === 'preview' && v0.rail[0].current &&
      v0.rail.filter((x) => x.step !== 'size').every((x) => x.reached) &&
      v0.cells.length === 4 && v0.go && /next — ranking/.test(v0.go.text), JSON.stringify({ view: v0.view, rail: v0.rail, go: v0.go }));
    await page.click('.jd-turn-actions [data-act="next"]');
    await page.waitForSelector('.jd-turn[data-view="call"]', { timeout: 10000 });
    const v = await view(page);
    const full = await page.$eval('.jd-turn-actions [data-act="next"]', (b) => !b.disabled).catch(() => false);
    check('…and its next lands on the podium, full (prefilled ranks)', v === 'call' && full, v);
    await page.click('.jd-rail-step[data-step="a"]');
    await page.waitForSelector('.jd-bench select.jd-turn-select');
    const answered = await page.$$eval('.jd-bench select.jd-turn-select', (s) => s.length > 0 && s.every((x) => x.value !== ''));
    check('…and every scale on its drawings comes up answered (prefilled grades and axes)', answered);
    const gapsReached = await page.$eval('.jd-rail-step--gaps', (b) => !b.disabled).catch(() => false);
    await shot(page, '6-direct-prefill');
    // the gaps prefill: the podium's button leads on, and the pedestal card
    // comes up with every margin the owner filed (seats are re-dealt, so the
    // gaps are compared in place order)
    await page.click('.jd-rail-step[data-step="call"]');
    await page.click('.jd-turn-actions [data-act="next"]');
    await page.waitForSelector('.jd-turn[data-view="gaps"] .jd-ped');
    const pre = await pedState(page);
    await shot(page, '6b-direct-pedestal');
    check('…and the pedestal card comes up with the filed gaps (1, negligibly, 2), complete, its rail station reached',
      gapsReached && pre.slips.join('|') === 'slightly|≈ negligibly|better' && pre.answer.complete &&
      pre.answer.ranking.slice(0, 3).map((p) => p.gap).join() === '1,0,2' && !pre.go.disabled,
      JSON.stringify({ gapsReached, pre }));
    // …and on to the catalogue entry: the owner's edits, not the clerk's originals
    await throughGaps(page);
    const re = await entryState(page);
    const rePreset = await page.$$eval('.jd-size-tier.is-on', (b) => b.map((x) => x.getAttribute('data-size')));
    await shot(page, '6c-direct-entry');
    check('a reopen (?bench&prompt=) shows the owner\'s edits on the catalogue entry: heading, m ("yours"), creature + retro',
      re.title === P2TITLE && rePreset.join() === 'm' && /on file: yours/.test(re.who) &&
      sameSet(re.on.subject, ['creature']) && sameSet(re.on.treatment, ['retro']) && sameSet(re.on.probe, []),
      JSON.stringify({ title: re.title, preset: rePreset, who: re.who, on: re.on }));

    // --- phone ------------------------------------------------------------------
    // the same reopen at 390×844 (touch): the entry stacks, and a LONG PRESS
    // on a chip shows its scope note without filing or unfiling it
    const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const ph = await phoneCtx.newPage();
    ph.on('pageerror', (e) => errors.push('phone: ' + String(e)));
    await ph.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
    await ph.evaluate((k) => localStorage.setItem('jd-admin-key', k), KEY);
    await ph.goto(BASE + '/art/junk-drawer/?bench&prompt=' + P2.prompt_id, { waitUntil: 'load' });
    await seated(ph, P2.prompt_id);
    // the preview at 390×844: 2×2, nothing off the sheet
    await ph.waitForSelector('.jd-turn[data-view="preview"] .jd-preview');
    await ph.waitForTimeout(300);
    await shot(ph, '12-preview-390');
    const phPv = await ph.evaluate(() => {
      const cells = [...document.querySelectorAll('.jd-preview-cell')].map((c) => c.getBoundingClientRect());
      return { n: cells.length, cols: getComputedStyle(document.querySelector('.jd-preview')).gridTemplateColumns.split(' ').length,
        rows: new Set(cells.map((r) => Math.round(r.top))).size,
        inside: cells.every((r) => r.left >= 0 && r.right <= window.innerWidth),
        wide: document.documentElement.scrollWidth <= window.innerWidth };
    });
    check('phone: the bench preview stacks 2×2 at 390px, every print on the sheet', phPv.n === 4 && phPv.cols === 2 &&
      phPv.rows === 2 && phPv.inside && phPv.wide, JSON.stringify(phPv));
    await ph.click('.jd-turn-actions [data-act="next"]');
    await ph.waitForSelector('.jd-turn[data-view="call"]');
    await ph.click('.jd-turn-actions [data-act="next"]');
    await ph.waitForSelector('.jd-turn[data-view="gaps"] .jd-ped');
    await throughGaps(ph);
    await shot(ph, '12-entry-390');
    // the long press: pointerdown (touch), held 700ms, lifted, and the click it trails
    const held = await ph.$eval(chip('probe', 'layering'), async (b) => {
      b.scrollIntoView({ block: 'center' });
      await new Promise((res) => setTimeout(res, 100));
      const r = b.getBoundingClientRect();
      const o = { bubbles: true, pointerType: 'touch', clientX: r.left + 5, clientY: r.top + 5, isPrimary: true };
      b.dispatchEvent(new PointerEvent('pointerdown', o));
      await new Promise((res) => setTimeout(res, 700));
      b.dispatchEvent(new PointerEvent('pointerup', o));
      b.click();
      return { on: b.classList.contains('is-on'),
        scope: document.querySelector('.jd-cat-scope[data-scope-for="probe"]').textContent };
    });
    await shot(ph, '12b-entry-390-longpress');
    check('phone: a long press on a chip shows its scope note and files nothing',
      held.on === false && held.scope.indexOf(plain(scopeOf('probe', 'layering')).slice(0, 50)) !== -1, JSON.stringify(held));
    await ph.$eval('.jd-turn-scroll', (el) => { el.scrollTop = el.scrollHeight; });
    await shot(ph, '12c-entry-390-foot');
    const phWide = await ph.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth &&
      [...document.querySelectorAll('.jd-cat-chip, .jd-cat-title')].every((el) => el.getBoundingClientRect().right <= window.innerWidth));
    check('phone: the catalogue entry fits 390px (no sideways scroll, every chip on the sheet)', phWide);
    await phoneCtx.close();

    // --- the pruned prefill (taxonomy v35) --------------------------------------
    // P2's owner sitting as if an older rubric had filed it: a cell on the
    // RETIRED structural-coherence (no successor) and every layering-2 value
    // off its current 4-point scale (5). The reopen must carry neither into
    // the new sitting, and the card says so in one line above the rows.
    const sid2 = q("SELECT id FROM jd2_sessions WHERE run_id = ? AND rater_role = 'owner' ORDER BY filed_at DESC, id DESC", [P2.run_id])[0].id;
    const keepLayering = q("SELECT id, axis_id, value FROM jd2_judgments WHERE session_id = ? AND axis_id = 'layering-2' ORDER BY generation_id", [sid2]);
    const keepCells = q('SELECT required_cells FROM jd2_sessions WHERE id = ?', [sid2])[0].required_cells;
    const restoreP2 = () => php('if (!JD_DEV_MODE) { exit(2); } $db = jd_db(); $sid = getenv("JD_SID"); ' +
      '$db->prepare("DELETE FROM jd2_judgments WHERE session_id = ? AND axis_id = \'structural-coherence\'")->execute([$sid]); ' +
      '$u = $db->prepare("UPDATE jd2_judgments SET axis_id = ?, value = ? WHERE id = ?"); ' +
      'foreach (json_decode(getenv("JD_KEEP"), true) as $r) { $u->execute([$r["axis_id"], $r["value"], $r["id"]]); } ' +
      '$db->prepare("UPDATE jd2_sessions SET required_cells = ? WHERE id = ?")->execute([getenv("JD_CELLS"), $sid]);',
    { JD_SID: sid2, JD_CELLS: keepCells,
      JD_KEEP: JSON.stringify(keepLayering.map((x) => ({ id: x.id, axis_id: x.axis_id, value: Number(x.value) }))) });
    php('if (!JD_DEV_MODE) { exit(2); } $db = jd_db(); $sid = getenv("JD_SID"); ' +
      '$g = $db->prepare("SELECT DISTINCT generation_id FROM jd2_judgments WHERE session_id = ?"); $g->execute([$sid]); ' +
      '$ins = $db->prepare("INSERT INTO jd2_judgments (id, session_id, generation_id, kind, axis_id, value) VALUES (?, ?, ?, \'axis\', \'structural-coherence\', 2)"); ' +
      'foreach ($g->fetchAll(PDO::FETCH_COLUMN) as $gid) { $ins->execute([jd_ulid(), $sid, $gid]); } ' +
      '$db->prepare("UPDATE jd2_judgments SET value = 5 WHERE session_id = ? AND axis_id = \'layering-2\'")->execute([$sid]);',
    { JD_SID: sid2 });
    await page.goto(BASE + '/art/junk-drawer/?bench&prompt=' + P2.prompt_id, { waitUntil: 'load' });
    await seated(page, P2.prompt_id);
    const qp = await page.evaluate((id) => window.JD_bench.queue().items.filter((x) => x.prompt_id === id)[0], P2.prompt_id);
    check('pruned: the queue drops the retired axis and the off-scale values from the prefill and says prefill_pruned (nothing mapped)',
      qp.prefill_pruned === true && qp.prefill_mapped === false && qp.responses.every((x) => x.prefill &&
        !('structural-coherence' in x.prefill.axes) && !('layering-2' in x.prefill.axes) && Object.keys(x.prefill.axes).length > 0),
      JSON.stringify(qp.responses.map((x) => x.prefill && x.prefill.axes)));
    await page.click('.jd-rail-step[data-step="a"]');
    await page.waitForSelector('.jd-bench select.jd-turn-select');
    const pr = await page.evaluate(() => ({
      note: (document.querySelector('.jd-turn-pruned:not(.jd-turn-mapped)') || {}).textContent || null,
      mapped: !!document.querySelector('.jd-turn-mapped'),
      layering: (document.querySelector('.jd-bench select[data-axis="layering-2"]') || {}).value,
      others: [...document.querySelectorAll('.jd-bench select.jd-turn-select')]
        .filter((x) => x.getAttribute('data-axis') !== 'layering-2').every((x) => x.value !== ''),
      gate: (document.querySelector('.jd-turn-actions [data-act="next"]') || {}).disabled
    }));
    await shot(page, '12d-pruned-prefill');
    check('pruned: the card notes it in one line, leaves Layering unanswered (gate shut) and keeps the rest',
      pr.note === 'earlier answers on a retired or rescaled axis were not carried over' && !pr.mapped && pr.layering === '' &&
      pr.others && pr.gate === true, JSON.stringify(pr));
    restoreP2();

    // --- the mapped prefill (taxonomy v36) --------------------------------------
    // P2's owner sitting as the campaign's v35 sittings were filed: Layering
    // on the 3-point `layering` (Small, Big, Small, No by generation order)
    // and required_cells naming it. `layering` is defunct with successor
    // layering-2 (3→4, 2→3, 1→1): the reopen carries every answer onto
    // layering-2 through the map, says so where it says "pruned", and the
    // report card shows it under Layering, marked — the rows stay as filed.
    const layOld = [2, 1, 2, 3], layNew = { 3: 4, 2: 3, 1: 1 };
    const genOld = {};
    keepLayering.forEach((x, i) => { genOld[x.id] = layOld[i % 4]; });
    php('if (!JD_DEV_MODE) { exit(2); } $db = jd_db(); $sid = getenv("JD_SID"); ' +
      '$u = $db->prepare("UPDATE jd2_judgments SET axis_id = \'layering\', value = ? WHERE id = ?"); ' +
      'foreach (json_decode(getenv("JD_OLD"), true) as $id => $v) { $u->execute([$v, $id]); } ' +
      '$cells = json_decode(getenv("JD_CELLS"), true); $cells[array_search("layering-2", $cells, true)] = "layering"; ' +
      '$db->prepare("UPDATE jd2_sessions SET required_cells = ? WHERE id = ?")->execute([json_encode($cells), $sid]);',
    { JD_SID: sid2, JD_CELLS: keepCells, JD_OLD: JSON.stringify(genOld) });
    const filedOld = q("SELECT generation_id, axis_id, value FROM jd2_judgments WHERE session_id = ? AND axis_id IN ('layering', 'layering-2') ORDER BY generation_id", [sid2]);
    const wantOf = {};
    filedOld.forEach((x) => { wantOf[x.generation_id] = layNew[Math.round(Number(x.value))]; });
    await page.goto(BASE + '/art/junk-drawer/?bench&prompt=' + P2.prompt_id, { waitUntil: 'load' });
    await seated(page, P2.prompt_id);
    const qm = await page.evaluate((id) => window.JD_bench.queue().items.filter((x) => x.prompt_id === id)[0], P2.prompt_id);
    check('mapped: the queue carries layering 2 / 1 / 2 / 3 onto layering-2 at 3 / 1 / 3 / 4, says prefill_mapped and prunes nothing; the sitting stays complete',
      qm.prefill_mapped === true && qm.prefill_pruned === false && qm.complete === true && filedOld.length === 4 &&
      qm.responses.every((x) => x.prefill && !('layering' in x.prefill.axes) &&
        Number(x.prefill.axes['layering-2']) === wantOf[x.generation_id]),
      JSON.stringify(qm.responses.map((x) => [x.generation_id, x.prefill && x.prefill.axes, wantOf[x.generation_id]])));
    await page.click('.jd-rail-step[data-step="a"]');
    await page.waitForSelector('.jd-bench select.jd-turn-select');
    const pm = await page.evaluate(() => {
      const sel = document.querySelector('.jd-bench select[data-axis="layering-2"]');
      const bar = sel && sel.parentNode.querySelector('.rc-bar');
      return {
        note: (document.querySelector('.jd-turn-mapped') || {}).textContent || null,
        pruned: !!document.querySelector('.jd-turn-pruned:not(.jd-turn-mapped)'),
        value: sel ? sel.value : null, cls: bar ? bar.className : '',
        all: [...document.querySelectorAll('.jd-bench select.jd-turn-select')].every((x) => x.value !== ''),
        gate: (document.querySelector('.jd-turn-actions [data-act="next"]') || {}).disabled
      };
    });
    await shot(page, '12e-mapped-prefill');
    check('mapped: the card says so in the same place ("earlier Layering answers were carried onto its new 4-point scale"), seats a mapped Layering on the rc-q ramp, gate open',
      pm.note === 'earlier Layering answers were carried onto its new 4-point scale' && !pm.pruned &&
      ['1', '3', '4'].indexOf(pm.value) !== -1 && new RegExp('\\brc-q' + pm.value + '\\b').test(pm.cls) && pm.all && pm.gate === false,
      JSON.stringify(pm));
    // the report card: the drawer's own card, opened on P2 — in a fresh
    // context, since data.php's ETag (rightly) ignores a judgment edited in
    // place, which only this fixture does, and the bench's cache would 304
    const rcCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const rcPage = await rcCtx.newPage();
    rcPage.on('pageerror', (e) => errors.push('rc: ' + String(e)));
    await rcPage.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
    await rcPage.waitForFunction(() => window.JD_record && window.JD_record.ready(), null, { timeout: 20000 });
    await rcPage.evaluate((pid) => window.JD_record.open(pid), P2.prompt_id);
    await rcPage.waitForSelector('table.rc-subj', { timeout: 10000 });
    const rcm = await rcPage.evaluate(() => {
      const rows = [...document.querySelectorAll('table.rc-subj tbody tr:not(.rc-axdesc)')].map((tr) => ({
        name: (tr.querySelector('.rc-subj-name') || {}).textContent,
        mark: (tr.querySelector('.rc-mark-word') || {}).textContent,
        bar: (tr.querySelector('.rc-bar') || {}).className || '',
        mapped: (tr.querySelector('.rc-mapped') || {}).textContent || null,
        tip: (tr.querySelector('.rc-mapped') || { getAttribute: () => null }).getAttribute('title')
      }));
      return { rows, marks: document.querySelectorAll('.rc-mapped').length };
    });
    await shot(rcPage, '12f-report-card-mapped');
    const lay = rcm.rows.filter((r) => r.name === 'Layering');
    const tax4 = TAX.axes.filter((a) => a.id === 'layering-2')[0];
    const lab4 = {};
    tax4.values.forEach((v) => { lab4[v.label] = v.rank; });
    check('report card: ONE Layering row, at a mapped 4-point value on the rc-q ramp, marked "mapped from the 3-point scale" with the filed answer in its tooltip',
      lay.length === 1 && rcm.marks === 1 && lay[0].mapped === 'mapped from the 3-point scale' &&
      [1, 3, 4].indexOf(lab4[lay[0].mark]) !== -1 && new RegExp('\\brc-q' + lab4[lay[0].mark] + '\\b').test(lay[0].bar) &&
      /^Rated “(No|Small|Big) problems” on the 3-point scale/.test(lay[0].tip || ''),
      JSON.stringify(rcm));
    await rcCtx.close();
    check('mapped: reading moved nothing — the four judgments are still axis layering at 2 / 1 / 2 / 3',
      JSON.stringify(q("SELECT generation_id, axis_id, value FROM jd2_judgments WHERE session_id = ? AND axis_id IN ('layering', 'layering-2') ORDER BY generation_id", [sid2])) ===
      JSON.stringify(filedOld));
    restoreP2();
    // put P2's sitting back as it was filed (the rest of the run reads it)
    check('P2\'s sitting is back as filed (layering-2, its own required_cells)',
      JSON.stringify(q("SELECT id, axis_id, value FROM jd2_judgments WHERE session_id = ? AND axis_id IN ('layering', 'layering-2') ORDER BY generation_id", [sid2])
        .map((x) => [x.id, x.axis_id, Number(x.value)])) === JSON.stringify(keepLayering.map((x) => [x.id, x.axis_id, Number(x.value)])) &&
      q('SELECT required_cells FROM jd2_sessions WHERE id = ?', [sid2])[0].required_cells === keepCells);

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
        document.querySelector('.jd-turn[data-view="preview"]');
    }, NEWTEXT, { timeout: 60000 });
    await shot(page, '10-new-seated');
    const np = q('SELECT id, origin, title, category, visibility, size_class, size_by, tags, intake_model, intake_at FROM jd2_prompts WHERE text = ?', [NEWTEXT]);
    const nr = np.length ? q('SELECT id, kind, requested_by, profile FROM jd2_runs WHERE prompt_id = ?', [np[0].id]) : [];
    const ng = nr.length ? q("SELECT COUNT(*) AS n FROM jd2_generations WHERE run_id = ? AND status = 'ok'", [nr[0].id])[0].n : 0;
    check('NEW PROMPT filed an owner prompt with its title and category', np.length === 1 && np[0].origin === 'owner' &&
      np[0].title === 'Porcelain Doorknob' && np[0].category === 'hardware' && np[0].visibility === 'draft', JSON.stringify(np));
    check('…as one bench-profile run of four ok drawings (mock provider)', nr.length === 1 && nr[0].kind === 'initial' &&
      nr[0].requested_by === 'owner' && nr[0].profile === 'bench-medium' && Number(ng) === 4, JSON.stringify(nr) + ' ok=' + ng);
    check('NEW PROMPT ran the intake clerk: the owner\'s title stands, the clerk\'s tier and headings are filed',
      np.length === 1 && np[0].title === 'Porcelain Doorknob' && np[0].size_by === 'model' && !!np[0].size_class &&
      np[0].intake_model === 'mock' && !!np[0].intake_at && /"subject":\["object"\]/.test(String(np[0].tags)), JSON.stringify(np[0]));
    const seatedSize = await page.evaluate(() => {
      const it = window.JD_bench.queue().items.filter((x) => x.prompt_id === window.JD_bench.current())[0];
      return it ? [it.size_class, it.size_by, !!it.tags] : null;
    });
    check("…and the queue item carries the clerk's size_by and tags", !!(seatedSize && np.length &&
      seatedSize[0] === np[0].size_class && seatedSize[1] === 'model' && seatedSize[2]), JSON.stringify(seatedSize));
    const cur = await page.evaluate(() => window.JD_bench.current());
    check('…and it is seated for rating at once', np.length === 1 && cur === np[0].id, cur);

    // --- rerun ------------------------------------------------------------------
    await page.click('.jd-bench-bar [data-bench="rerun"]');
    await page.waitForSelector('.jd-turn[data-view="darkroom"]', { timeout: 10000 });
    await page.waitForFunction((id) => {
      const it = window.JD_bench.queue().items.filter((x) => x.prompt_id === id)[0];
      return it && it.runs === 2 && window.JD_bench.current() === id && window.JD_turn.isOpen() &&
        document.querySelector('.jd-turn[data-view="preview"]');
    }, np[0].id, { timeout: 60000 });
    const runs = q('SELECT id, kind, profile, requested_by FROM jd2_runs WHERE prompt_id = ? ORDER BY created DESC, id DESC', [np[0].id]);
    const seatedRun = await page.evaluate((id) => window.JD_bench.queue().items.filter((x) => x.prompt_id === id)[0].run_id, np[0].id);
    check('RERUN draws a new bench run of the prompt and seats it', runs.length === 2 && runs[0].kind === 'rerun' &&
      runs[0].profile === 'bench-medium' && runs[0].requested_by === 'owner' && seatedRun === runs[0].id, JSON.stringify(runs) + ' seated ' + seatedRun);

    // --- untouched ----------------------------------------------------------------
    // the rerun rated through and filed WITHOUT touching the entry: no
    // jd2-curate at all, and the clerk's size stands as size_by model
    posts.length = 0;
    const npBefore = q('SELECT title, size_class, size_by, tags FROM jd2_prompts WHERE id = ?', [np[0].id])[0];
    const ru = await rateThrough(page, '', 'gaps', ['2', '1', '0.5'], async () => null);
    await page.waitForSelector('.jd-pod--said', { timeout: 20000 });
    const npAfter = q('SELECT title, size_class, size_by, tags FROM jd2_prompts WHERE id = ?', [np[0].id])[0];
    check("filing the entry untouched sends no jd2-curate and leaves the clerk's size as the model's",
      ru.entry.title === 'Porcelain Doorknob' && posts.filter((x) => x.to === 'curate').length === 0 &&
      posts.filter((x) => x.to === 'rate').length === 1 && !('size' in posts.filter((x) => x.to === 'rate')[0].body) &&
      npAfter.size_by === 'model' && npAfter.size_class === npBefore.size_class && npAfter.tags === npBefore.tags &&
      npAfter.title === npBefore.title, JSON.stringify({ npBefore, npAfter, posts: posts.map((x) => x.to) }));

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
      p2runs[0].kind === 'rerun' && p2runs[0].profile === 'bench-medium' && p2runs[0].requested_by === 'owner' &&
      p2seated === p2runs[0].id, JSON.stringify(p2runs));

    // --- audit ----------------------------------------------------------------------
    // ?pairs=1: the six side-by-side cards run in the pedestal card's place
    // and file DIRECT pairs, the ranking without gaps — never both
    await page.goto(BASE + '/art/junk-drawer/?bench&prompt=' + P1.prompt_id + '&pairs=1', { waitUntil: 'load' });
    await seated(page, P1.prompt_id);
    const auditFiling = page.waitForRequest((rq) => /\/api\/jd2-rate\.php/.test(rq.url()) && rq.method() === 'POST', { timeout: 120000 })
      .then((rq) => JSON.parse(rq.postData() || '{}'));
    const ra = await rateThrough(page, 'audit sitting: the side-by-side cards', 'pairs');
    check('?pairs=1 runs the six side-by-side cards and no pedestal card',
      ra.cards === 6 && !ra.rail.includes('gaps') && ra.rail.includes('pairs'), JSON.stringify(ra.rail) + ' cards=' + ra.cards);
    const ab = await auditFiling;
    check('…and files six direct pairs with a ranking that carries no gaps',
      Array.isArray(ab.pairs) && ab.pairs.length === 6 && ab.ranking.length === 4 && ab.ranking.every((p) => !('gap' in p)),
      JSON.stringify({ ranking: ab.ranking, pairs: ab.pairs && ab.pairs.length }));
    await page.waitForSelector('.jd-pod--said', { timeout: 20000 });
    const as = q("SELECT id FROM jd2_sessions WHERE run_id = ? AND rater_role = 'owner' ORDER BY filed_at DESC, id DESC", [P1.run_id]);
    const apairs = as.length ? q('SELECT source, method, shown_left FROM jd2_pairs WHERE session_id = ?', [as[0].id]) : [];
    const ag = as.length ? q('SELECT gap_after FROM jd2_rankings WHERE session_id = ?', [as[0].id]) : [];
    check('SQLite: the audit sitting holds six DIRECT pairs with shown_left and no gap_after anywhere',
      as.length === 1 && apairs.length === 6 && apairs.every((p) => p.source === 'direct' && p.method === null && p.shown_left) &&
      ag.length === 4 && ag.every((x) => x.gap_after === null), JSON.stringify({ apairs, ag }));

    // --- fallback ---------------------------------------------------------------------
    // a prompt whose intake FAILED (the mock told to fail, its record filed
    // the way jd2-intake files a failure): the entry says "intake failed",
    // every chip is off, no tier is chosen; a treatment alone leaves subject
    // short and the file button says so; a subject and a size file it
    const P3TEXT = "a ship's bell, green with verdigris (bench fallback " + stamp + ')';
    const P3 = await seedPrompt(P3TEXT);
    php('require_once "api/jd2-intake-prompt.php"; if (!JD_DEV_MODE) { exit(2); } ' +
      '$t = jd_taxonomy(); $id = getenv("JD_P3"); $q = jd_db()->prepare("SELECT text FROM jd2_prompts WHERE id = ?"); $q->execute([$id]); ' +
      '$res = jd2_intake_answer($t, (string) $q->fetchColumn(), true); if ($res["ok"]) { exit(3); } ' +
      'jd_db()->prepare("UPDATE jd2_prompts SET intake_json = ? WHERE id = ? AND intake_at IS NULL")' +
      '->execute([json_encode($res["record"] + ["at" => jd_now()]), $id]);',
    { JD_P3: P3.prompt_id, JD_INTAKE_MOCK_FAIL: 'provider' });
    await page.goto(BASE + '/art/junk-drawer/?bench&prompt=' + P3.prompt_id, { waitUntil: 'load' });
    await seated(page, P3.prompt_id);
    posts.length = 0;
    const rf = await rateThrough(page, 'fallback sitting', 'gaps', ['1', '1', '1'], async (pg) => {
      await pg.waitForTimeout(500);
      await pg.$eval('.jd-turn-scroll', (el) => { el.scrollTop = el.scrollHeight; });
      await shot(pg, '11a-entry-fallback-as-arrived');
      await pg.click('[data-act="size"][data-size="s"]');
      await pg.click(chip('treatment', 'retro'));
      const short = await entryState(pg);
      await pg.click(chip('subject', 'object'));
      const ready = await entryState(pg);
      await shot(pg, '11-entry-fallback');
      return { short, ready };
    });
    const f0 = rf.entry;
    const allOff = Object.values(f0.on).every((l) => l.length === 0) && Object.keys(f0.on).length === 3;
    check('fallback: the entry says "intake failed", every chip is off, no heading and no tier on file',
      /intake failed \(provider_failed\)/.test(f0.foot) && allOff && f0.title === '' && rf.preset.length === 0 &&
      f0.why.length === 0 && f0.go.disabled && /choose a size first/.test(f0.go.text),
      JSON.stringify({ foot: f0.foot, on: f0.on, title: f0.title, preset: rf.preset, go: f0.go }));
    check('…a treatment alone leaves subject short: the file button is held and says why',
      rf.edits.short.go.disabled && /subject takes 1–6 headings/.test(rf.edits.short.go.text) && !rf.edits.ready.go.disabled,
      JSON.stringify([rf.edits.short.go, rf.edits.ready.go]));
    await page.waitForSelector('.jd-pod--said', { timeout: 20000 });
    const p3row = q('SELECT title, size_class, size_by, tags, intake_at FROM jd2_prompts WHERE id = ?', [P3.prompt_id])[0];
    let p3tags = null;
    try { p3tags = JSON.parse(p3row.tags); } catch (e) { /* null */ }
    const p3c = posts.filter((x) => x.to === 'curate');
    check('…and files its first headings and the owner\'s size through jd2-curate (no title: none was typed)',
      p3c.length === 1 && !('title' in p3c[0].body) && p3row.title === null && p3row.size_class === 's' &&
      p3row.size_by === 'owner' && p3tags && sameSet(p3tags.subject, ['object']) && sameSet(p3tags.treatment, ['retro']) &&
      sameSet(p3tags.probe, []) && p3row.intake_at === null, JSON.stringify({ p3row, body: p3c[0] && p3c[0].body }));

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
