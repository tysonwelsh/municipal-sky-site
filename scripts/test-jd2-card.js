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
// prompt → four drawings → the four grading panels → the podium → THE
// PEDESTAL CARD ("by how much", owner 2026-10-02) → file → the unveil —
// screenshotting each (the INTAKE clerk sizes a visitor's turn, so there is
// NO size step: the rail carries no size node, the pedestal card files, and
// the won record and the drawer carry the clerk's tier, size_by 'model').
// On the pedestal card it answers by ballot click, by drag and by keyboard;
// checks the brief's §8 pins — heights for 2/negligibly/negligibly (phone),
// gaps [2,0,3] complete (desk), the restore round trip (the jd2-turn
// record and JD_turn.pedestal.restore), back/forward, re-ranking clears
// every gap — asserts the filed ranking carries the gaps with `pairs: null`,
// and reads the SQLite (through php, as the bench test does) for six
// DERIVED pairs with the right signed scores; then a two-drawing turn (one
// question, the button files straight on) and a three-drawing turn (two
// slips), the failures dealt by the mock's [fail:<provider>] tokens. Then it
// reloads the phone page, finds the item in the pile
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

// the dev database, read through the app's own jd_db() (the server under
// test runs this checkout with JD_DEV_MOCK=1, so it is the same SQLite)
function q(sql, args) {
  const out = execFileSync('php', ['-r', 'require "api/jd2-config.php"; ' +
    'if (!JD_DEV_MODE) { fwrite(STDERR, "not dev"); exit(2); } ' +
    '$r = json_decode(getenv("JD_Q"), true); $s = jd_db()->prepare($r["sql"]); ' +
    '$s->execute($r["args"]); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));'],
  { cwd: ROOT, env: Object.assign({}, process.env, { JD_DEV_MOCK: '1', JD_Q: JSON.stringify({ sql, args: args || [] }) }),
    encoding: 'utf8' });
  return JSON.parse(out);
}
// the filed sitting on a run: its ranking (slot, rank, gap_after) and its pairs by slot
function filedSitting(runId) {
  const sess = q("SELECT id FROM jd2_sessions WHERE run_id = ? AND rater_role = 'visitor' ORDER BY filed_at DESC, id DESC", [runId]);
  if (!sess.length) return null;
  const sid = sess[0].id;
  const ranking = q('SELECT g.slot, k.rank_pos, k.gap_after FROM jd2_rankings k JOIN jd2_generations g ON g.id = k.generation_id ' +
    'WHERE k.session_id = ? ORDER BY k.rank_pos', [sid]).map((r) => ({ slot: r.slot, rank: Number(r.rank_pos),
    gap: r.gap_after == null ? null : Number(r.gap_after) }));
  const pairs = q('SELECT ga.slot AS a, gb.slot AS b, p.score, p.source, p.method FROM jd2_pairs p ' +
    'JOIN jd2_generations ga ON ga.id = p.gen_a JOIN jd2_generations gb ON gb.id = p.gen_b WHERE p.session_id = ? ORDER BY ga.slot, gb.slot', [sid])
    .map((r) => ({ a: r.a, b: r.b, score: Number(r.score), source: r.source, method: r.method }));
  return { ranking, pairs };
}
// spaced-rank-v1 by hand, for the check: places i < j score the sum of the
// gaps between them, capped at 3, signed from the canonically first slot
function expectPairs(ranking) {
  const out = {};
  for (let i = 0; i < ranking.length; i++) {
    let sum = 0;
    for (let j = i + 1; j < ranking.length; j++) {
      sum += ranking[j - 1].gap;
      const hi = ranking[i].slot, lo = ranking[j].slot, sc = Math.min(sum, 3);
      const a = hi < lo ? hi : lo, b = hi < lo ? lo : hi;
      out[a + b] = sc === 0 ? 0 : (a === hi ? sc : -sc);
    }
  }
  return out;
}

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

// a turn up to the podium: the prompt, the wait (and the intake clerk's
// answer, which a real visitor's time on the grades always outlasts), every
// grading panel answered, and the podium filled in the row's order
async function toPodium(pg, text, tag, shots) {
  await openTurn(pg);
  await pg.fill('#jd-turn-prompt', text);
  const intakeAnswered = pg.waitForResponse((r) => /\/api\/jd2-intake\.php/.test(r.url()) && r.status() === 200,
    { timeout: 30000 });
  await pg.click('[data-act="generate"]');
  await pg.waitForSelector('[data-act="rate"]', { timeout: 60000 });
  const intake = await (await intakeAnswered).json();
  if (shots) await shot(pg, tag + '-1-results');
  await pg.click('[data-act="rate"]');
  let panel = null;
  for (let d = 0; ; d++) {
    await pg.waitForSelector('.jd-bench', { timeout: 10000 });
    const sels = await pg.$$('.jd-bench select.jd-turn-select');
    for (let i = 0; i < sels.length; i++) {
      const k = await sels[i].evaluate((s) => s.options.length);
      await sels[i].selectOption({ index: 1 + ((i + d) % (k - 1)) });
    }
    // the first panel as drawn: the house rule above it (text, lines), the
    // axis rows in order with their step counts, and each answered gauge's ramp
    if (d === 0) {
      await pg.waitForTimeout(450);   // the card widens into its bench layout first
      panel = await pg.evaluate(() => {
        const r = document.querySelector('.jd-turn-rule');
        const lh = r ? parseFloat(getComputedStyle(r).lineHeight) : 0;
        const axes = [...document.querySelectorAll('.jd-bench select[data-role="axis"]')].map((sel) => {
          const bar = sel.parentNode.querySelector('.rc-bar');
          return { id: sel.getAttribute('data-axis'), steps: sel.options.length - 1,
            cls: bar ? bar.className : '' };
        });
        const benchEl = document.querySelector('.jd-bench');
        return { rule: r ? r.textContent : null, lines: r && lh ? Math.round(r.getBoundingClientRect().height / lh) : 0,
          above: !!(r && benchEl && (r.compareDocumentPosition(benchEl) & Node.DOCUMENT_POSITION_FOLLOWING)),
          axes, pruned: !!document.querySelector('.jd-turn-pruned'),
          overflow: document.documentElement.scrollWidth > window.innerWidth };
      });
    }
    if (d === 0 && shots) await shot(pg, tag + '-2-bench');
    const nextTo = await pg.$eval('.jd-turn-actions [data-act="next"]', (b) => b.textContent);
    await pg.click('.jd-turn-actions [data-act="next"]');
    if (/ranking/.test(nextTo)) break;
  }
  await pg.waitForSelector('.jd-pod-tier[data-rank="1"]');
  const order = await pg.$$eval('.jd-pod-tray .jd-pod-print', (els) => els.map((e) => e.getAttribute('data-pod')));
  for (let k = 1; k <= order.length; k++) {
    await pg.click('.jd-pod-tier[data-rank="' + k + '"] .jd-pod-block');
    await pg.click('.jd-pod-print[data-pod="' + order[k - 1] + '"]');
  }
  return { intake, order, panel };
}
// the pedestal card's state, read off the DOM and the hooks
const ped = (pg) => pg.evaluate(() => {
  const root = document.querySelector('.jd-ped');
  const cs = root && getComputedStyle(root);
  const go = document.querySelector('.jd-turn-actions .jd-turn-go');
  const back = document.querySelector('.jd-turn-actions .jd-turn-alt');
  return {
    view: document.querySelector('.jd-turn').getAttribute('data-view'),
    title: (document.querySelector('.jd-turn-title') || {}).textContent,
    tab: (document.querySelector('.jd-ped-q-tab') || {}).textContent,
    slips: [...document.querySelectorAll('.jd-ped-slip .jd-ped-w')].map((x) => x.textContent),
    on: [...document.querySelectorAll('.jd-ped-slip')].findIndex((x) => x.classList.contains('is-on')),
    ballot: [...document.querySelectorAll('.jd-ped-qo .jd-ped-qo-l')].map((x) => x.textContent),
    ticked: [...document.querySelectorAll('.jd-ped-qo')].filter((x) => x.getAttribute('aria-pressed') === 'true')
      .map((x) => x.getAttribute('data-gap')),
    heights: [...document.querySelectorAll('.jd-ped-block')].map((b) => parseFloat(b.style.height)),
    tok: cs ? { b: parseFloat(cs.getPropertyValue('--b')), notch: parseFloat(cs.getPropertyValue('--notch')),
      shim: parseFloat(cs.getPropertyValue('--shim')) } : null,
    shims: document.querySelectorAll('.jd-ped-course.is-shim').length,
    go: go ? { act: go.getAttribute('data-act'), disabled: go.disabled, text: go.textContent } : null,
    back: back ? back.getAttribute('data-act') : null,
    text: root ? root.textContent : '',
    live: (document.querySelector('.jd-ped-live') || {}).textContent,
    answer: window.JD_turn.pedestal.answer()
  };
});
// raise (dy < 0) or lower (dy > 0) the pedestal at place r by dragging its block
async function dragPed(pg, r, dy) {
  const box = await pg.$eval('.jd-ped-tier[data-r="' + r + '"] .jd-ped-block', (b) => {
    b.scrollIntoView({ block: 'center' });
    const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
  });
  await pg.mouse.move(box.x, box.y);
  await pg.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) await pg.mouse.move(box.x, box.y + (dy * i) / steps);
  await pg.mouse.up();
}
// the filing's request body, caught on the wire
function rateBody(pg) {
  return pg.waitForRequest((r) => /\/api\/jd2-rate\.php/.test(r.url()) && r.method() === 'POST', { timeout: 15000 })
    .then((r) => JSON.parse(r.postData() || '{}'));
}
const rankingWire = (body) => (body.ranking || []).map((p) => p.slot + p.rank + ':' + ('gap' in p ? p.gap : '-')).join(' ');

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
  const taxonomy = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/junk-drawer/taxonomy.json'), 'utf8'));
  const gapLabels = taxonomy.gaps.values.slice().sort((x, y) => x.value - y.value).map((v) => v.label);
  const near = (a, b) => Math.abs(a - b) < 0.6;
  const gapsOf = (ans) => (ans && ans.ranking || []).slice(0, -1).map((p) => p.gap).join(',');
  const filed = {};
  for (const [pg, tag] of [[page, 'phone'], [deskPage, 'desk']]) {
    await pg.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
    const t = await toPodium(pg, prompt + ' ' + tag, tag, true);
    const intake = t.intake;
    // THE FIVE-AXIS RATING CARD (taxonomy v35) and the house rule over it
    const live = taxonomy.axes.filter((a) => !a.defunct);
    const P = t.panel || { axes: [] };
    check(tag + ': the rating panel asks every live axis in taxonomy order, each on its own scale (' +
      live.map((a) => a.id + ' ' + a.values.length).join(', ') + ')',
      JSON.stringify(P.axes.map((a) => [a.id, a.steps])) === JSON.stringify(live.map((a) => [a.id, a.values.length])),
      JSON.stringify(P.axes));
    check(tag + ': a 4-point axis pencils on the rc-q ramp and a 3-point one on rc-r (JD_axisCls)',
      P.axes.length === live.length && P.axes.every((a) => new RegExp('\\brc-' + (a.steps === 4 ? 'q' : 'r') + '[1-4]\\b').test(a.cls)),
      JSON.stringify(P.axes));
    check(tag + ': the house rule renders above the panel from taxonomy.json houseRule, ' +
      (tag === 'phone' ? 'in at most three lines at 390px' : 'on one line at 1280px'),
      typeof taxonomy.houseRule === 'string' && taxonomy.houseRule.length > 0 && P.rule === taxonomy.houseRule && P.above &&
      P.lines >= 1 && P.lines <= (tag === 'phone' ? 3 : 1), JSON.stringify({ rule: P.rule, lines: P.lines, above: P.above }));
    check(tag + ': a visitor turn has nothing pruned and no sideways scroll', !P.pruned && !P.overflow,
      JSON.stringify({ pruned: P.pruned, overflow: P.overflow }));
    check(tag + ': the intake clerk answered the turn (title, size, headings)',
      !!(intake.ok && !intake.fallback && intake.title && intake.size_class && intake.tags), JSON.stringify(intake));
    await shot(pg, tag + '-3-podium');
    check(tag + ': the podium is full and its button reads by how much',
      await pg.$eval('.jd-turn-actions [data-act="next"]', (b) => !b.disabled && /by how much/i.test(b.textContent)));
    await pg.click('.jd-turn-actions [data-act="next"]');

    // THE PEDESTAL CARD
    await pg.waitForSelector('.jd-ped', { timeout: 10000 });
    let st = await ped(pg);
    const rail = await pg.$$eval('.jd-rail-step', (b) => b.map((x) => x.getAttribute('data-step')));
    check(tag + ': the pedestal card follows the podium — one rail station, no pair cards',
      st.view === 'gaps' && /by how much/i.test(st.title) && rail.filter((x) => x === 'gaps').length === 1 &&
      !rail.some((x) => x === 'pairs' || /^pair:/.test(x)), JSON.stringify({ view: st.view, title: st.title, rail }));
    check(tag + ': three slips (not yet), "Question 1 of 3", NEXT gated, BACK to the podium',
      st.slips.length === 3 && st.slips.every((w) => w === 'not yet') && /Question 1 of 3/i.test(st.tab) &&
      st.go.disabled && st.go.act === 'gapnext' && st.back === 'back', JSON.stringify(st.slips) + st.tab + JSON.stringify(st.go));
    check(tag + ': the ballot reads the taxonomy\'s gap labels (Negligibly better …) and never "about the same"',
      JSON.stringify(st.ballot) === JSON.stringify(gapLabels) && st.ballot[0] === 'Negligibly better' &&
      !/about the same/i.test(st.text), JSON.stringify(st.ballot));
    check(tag + ': the owner\'s notch and shim (' + (tag === 'phone' ? '14/5' : '22/6') + 'px)',
      st.tok && st.tok.notch === (tag === 'phone' ? 14 : 22) && st.tok.shim === (tag === 'phone' ? 5 : 6), JSON.stringify(st.tok));
    const sliders = await pg.$$eval('.jd-ped-tier[role="slider"]', (t) => t.length);
    check(tag + ': three pedestals are sliders (the 4th is the floor) and the heights start flat',
      sliders === 3 && st.heights.every((h) => near(h, st.tok.b)), String(sliders) + ' ' + JSON.stringify(st.heights));

    if (tag === 'phone') {
      // Q1 by a BALLOT CLICK: better
      await pg.click('.jd-ped-qo[data-gap="2"]');
      st = await ped(pg);
      check('phone: a ballot click answers Q1 — ticked, the slip pencilled, NEXT armed, announced',
        st.ticked.join() === '2' && st.slips[0] === 'better' && !st.go.disabled && /better than Model/.test(st.live),
        JSON.stringify([st.ticked, st.slips, st.go, st.live]));
      // back/forward keeps it
      await pg.click('.jd-turn-actions [data-act="back"]');
      await pg.waitForSelector('.jd-turn[data-view="call"]');
      await pg.click('.jd-turn-actions [data-act="next"]');
      await pg.waitForSelector('.jd-ped');
      st = await ped(pg);
      check('phone: back to the podium and forward again keeps the answer', st.slips[0] === 'better' &&
        st.answer.ranking[0].gap === 2, JSON.stringify(st.slips));
      // §8 check 5: re-ranking clears every gap
      await pg.click('.jd-turn-actions [data-act="back"]');
      await pg.waitForSelector('.jd-turn[data-view="call"]');
      const second = await pg.$eval('.jd-pod-tier[data-rank="2"] .jd-pod-print', (e) => e.getAttribute('data-pod'));
      await pg.click('.jd-pod-tier[data-rank="1"] .jd-pod-block');
      await pg.click('.jd-pod-print[data-pod="' + second + '"]');
      await pg.click('.jd-turn-actions [data-act="next"]');
      await pg.waitForSelector('.jd-ped');
      st = await ped(pg);
      check('§8 check 5 — re-ranking after answering clears every gap', st.slips.every((w) => w === 'not yet') &&
        /Question 1 of 3/.test(st.tab) && st.go.disabled && st.answer.ranking[0].slot === second &&
        st.answer.ranking.slice(0, 3).every((p) => p.gap === null), JSON.stringify(st.answer));
      await pg.click('.jd-ped-qo[data-gap="2"]');
      await pg.click('.jd-turn-actions .jd-turn-go');
      st = await ped(pg);
      check('phone: NEXT moves to Question 2 of 3, gated again, BACK now walks the pairs',
        /Question 2 of 3/.test(st.tab) && st.on === 1 && st.go.disabled && st.back === 'gapback', st.tab);
      await pg.waitForTimeout(1300);   // the slip's flash settles
      await pg.$eval('.jd-turn-scroll', (el) => { el.scrollTop = 0; });
      await shot(pg, 'phone-4-pedestal-mid');
      // Q2 by a DRAG: lowered → negligibly (the brass shim)
      await dragPed(pg, 1, 16);
      st = await ped(pg);
      check('phone: a drag answers Q2 — lowered, it snaps to negligibly: the brass shim',
        st.slips[1] === '≈ negligibly' && st.shims === 2 && st.answer.ranking[1].gap === 0 && !st.go.disabled,
        JSON.stringify([st.slips, st.shims]));
      await pg.click('.jd-turn-actions .jd-turn-go');
      // Q3 by the KEYBOARD: ↓ from unset → negligibly (no second shim)
      await pg.focus('.jd-ped-tier[data-r="2"]');
      await pg.keyboard.press('ArrowDown');
      st = await ped(pg);
      check('phone: the keyboard answers Q3 — ↓ from unset is negligibly, and shims never stack',
        st.slips[2] === '≈ negligibly' && st.shims === 2 && /Question 3 of 3/.test(st.tab), JSON.stringify([st.slips, st.shims]));
      const H = st.heights, k = st.tok;
      check('§8 check 1 — heights: 1st = base + 2 notches + one shim, 2nd = base + shim, 3rd = 4th = base',
        near(H[0], k.b + 2 * k.notch + k.shim) && near(H[1], k.b + k.shim) && near(H[2], k.b) && near(H[3], k.b),
        JSON.stringify({ H, k }));
      check('§8 check 1 — answer(): gaps [2, 0, 0], complete', st.answer.complete && gapsOf(st.answer) === '2,0,0',
        JSON.stringify(st.answer));
      // §8 check 3: the restore round trip
      const stored = await pg.evaluate(() => JSON.parse(sessionStorage.getItem('jd2-turn')).pedestal);
      check('the jd2-turn record carries the card\'s answer in the contract shape',
        JSON.stringify(stored) === JSON.stringify(st.answer.ranking), JSON.stringify(stored));
      const was = st;
      const restored = await pg.evaluate((r) => window.JD_turn.pedestal.restore(r), st.answer.ranking);
      await pg.waitForSelector('.jd-ped');
      st = await ped(pg);
      check('§8 check 3 — restore(answer().ranking) reproduces the same answer, the same slips and heights',
        restored === true && JSON.stringify(st.answer) === JSON.stringify(was.answer) &&
        st.slips.join('|') === was.slips.join('|') && st.heights.join() === was.heights.join(),
        JSON.stringify([st.answer, st.slips, st.heights]));
      await pg.click('.jd-ped-slip[data-m="2"]');
      st = await ped(pg);
      check('phone: a slip jumps to its pair; the last pair\'s button files (no size step)',
        /Question 3 of 3/.test(st.tab) && st.go.act === 'file' && !st.go.disabled && /file the grades/.test(st.go.text),
        JSON.stringify(st.go));
    } else {
      // Q1 by a DRAG: raised two notches (26px of travel a notch at least)
      await dragPed(pg, 0, -2 * Math.max(st.tok.notch, 26));
      st = await ped(pg);
      check('desk: a drag answers Q1 — raised two notches: better',
        st.slips[0] === 'better' && st.answer.ranking[0].gap === 2 && near(st.heights[0], st.tok.b + 2 * st.tok.notch) &&
        /better than Model/.test(st.live), JSON.stringify([st.slips, st.heights, st.live]));
      await pg.click('.jd-turn-actions .jd-turn-go');
      st = await ped(pg);
      check('desk: NEXT moves to Question 2 of 3', /Question 2 of 3/.test(st.tab) && st.go.disabled, st.tab);
      await pg.waitForTimeout(1300);   // the slip's flash settles
      await pg.$eval('.jd-turn-scroll', (el) => { el.scrollTop = 0; });
      await shot(pg, 'desk-4-pedestal-mid');
      // Q2 by a BALLOT CLICK: negligibly
      await pg.click('.jd-ped-qo[data-gap="0.5"]');
      st = await ped(pg);
      check('desk: a ballot click answers Q2 — negligibly better: the shim',
        st.slips[1] === '≈ negligibly' && st.ticked.join() === '0.5' && st.shims === 2, JSON.stringify([st.slips, st.ticked]));
      await pg.click('.jd-turn-actions .jd-turn-go');
      // Q3 by the KEYBOARD: ↑ from unset is slightly, then better, then much better
      await pg.focus('.jd-ped-tier[data-r="2"]');
      await pg.keyboard.press('ArrowUp');
      const one = (await ped(pg)).slips[2];
      await pg.keyboard.press('ArrowUp');
      await pg.keyboard.press('ArrowUp');
      st = await ped(pg);
      check('desk: the keyboard answers Q3 — ↑ from unset is slightly, ↑↑ more is much better',
        one === 'slightly' && st.slips[2] === 'much better', JSON.stringify([one, st.slips]));
      check('§8 check 2 — answers 2, negligibly, much better: complete, gaps [2, 0, 3]',
        st.answer.complete === true && gapsOf(st.answer) === '2,0,3', JSON.stringify(st.answer));
      check('desk: the last pair\'s button files (no size step)', st.go.act === 'file' && !st.go.disabled, JSON.stringify(st.go));
    }
    await pg.waitForTimeout(1300);   // the flashes and "rides along" settle
    await shot(pg, tag + '-5-pedestal-answered');
    const answer = st.answer;
    const bodyP = rateBody(pg);
    await pg.click('.jd-turn-actions .jd-turn-go');
    const body = await bodyP;
    const last = (body.ranking || [])[3] || {};
    check(tag + ': the filed ranking carries the gaps (every place but the last) and pairs is null',
      body.pairs === null && Array.isArray(body.ranking) && body.ranking.length === 4 &&
      body.ranking.slice(0, 3).every((p, i) => p.gap === answer.ranking[i].gap && p.slot === answer.ranking[i].slot) &&
      !('gap' in last), rankingWire(body) + ' pairs=' + JSON.stringify(body.pairs));

    // NO size step (the intake clerk sized the turn): the pedestal card filed
    await pg.waitForSelector('.jd-pod--said', { timeout: 20000 }).catch(async (e) => {
      await shot(pg, tag + '-6-stuck');
      const at = await pg.evaluate(() => ({ view: (document.querySelector('.jd-turn') || {}).getAttribute
        && document.querySelector('.jd-turn').getAttribute('data-view'),
        title: (document.querySelector('.jd-turn-title') || {}).textContent,
        buttons: [...document.querySelectorAll('.jd-turn-actions button')].map((b) => b.textContent) }));
      throw new Error('no unveil after the pedestal card: ' + JSON.stringify(at) + ' ' + e.message);
    });
    check(tag + ': no size card and no size node on the rail — the pedestal card filed',
      (await pg.$$('[data-act="size"]')).length === 0 && (await pg.$$('.jd-rail-step[data-step="size"]')).length === 0);
    await pg.waitForTimeout(1200);
    await shot(pg, tag + '-6-unveil');
    const names = await pg.$$eval('.jd-pod-who b', (b) => b.map((x) => x.textContent));
    const h2h = await pg.$$('.jd-pod-h2h li');
    check(tag + ': the unveil names four models', names.length === 4, names.join(', '));
    check(tag + ': the unveil is today\'s (no head-to-head list: the pairs are the server\'s to derive)', h2h.length === 0);
    const rec = await pg.evaluate(() => {
      try { return JSON.parse(sessionStorage.getItem('jd2-user-items'))[0]; } catch (e) { return null; }
    });
    filed[tag] = rec;
    check(tag + ': the won record carries run_id and prompt_id, and no direct pairs',
      !!(rec && rec.run_id && rec.prompt_id && Object.keys(rec.pairs || {}).length === 0));
    // the SQLite: the ranking with its gaps, and six DERIVED pairs
    const sit = rec && filedSitting(rec.run_id);
    check(tag + ': SQLite holds the ranking with gap_after as answered (the last place none)',
      !!(sit && sit.ranking.map((p) => p.slot + p.rank + ':' + p.gap).join() ===
        answer.ranking.map((p) => p.slot + p.rank + ':' + (p.gap == null ? null : p.gap)).join()),
      JSON.stringify(sit && sit.ranking));
    const exp = expectPairs(answer.ranking);
    check(tag + ': SQLite holds six DERIVED pairs (spaced-rank-v1) with the right signed scores',
      !!(sit && sit.pairs.length === 6 && sit.pairs.every((p) => p.source === 'derived' && p.method === 'spaced-rank-v1' &&
        p.score === exp[p.a + p.b])), JSON.stringify({ got: sit && sit.pairs, exp }));
    if (tag === 'phone' && sit) {
      const top = answer.ranking[0].slot;
      check('§8 check 1 — derived: the 1st over each of the others = 2, the other three = 0',
        sit.pairs.every((p) => (p.a === top ? p.score === 2 : p.b === top ? p.score === -2 : p.score === 0)),
        'top ' + top + ' ' + JSON.stringify(sit.pairs));
    }
    // the size is the clerk's: the won record's tier is the one intake filed
    // on the prompt (size_by model), and the mock's tier is a pure function of
    // the prompt's length, so it is checked against that too
    const pi = rec && await pg.evaluate((pid) => fetch('/art/junk-drawer/data.php?item=' + pid)
      .then((r) => r.json()).then((j) => j.item), rec.prompt_id);
    const tiers = ['xs', 's', 'm', 'l', 'xl'];
    const want = tiers[[...(prompt + ' ' + tag)].length % tiers.length];
    check(tag + ": the won item's size is the model's (" + want + ', size_by model) and it carries the clerk\'s headings',
      !!(rec && pi && rec.sizeClass === want && pi.sizeClass === want && pi.size_by === 'model' &&
        pi.tags && Array.isArray(pi.tags.subject) && pi.tags.subject.length >= 1),
      JSON.stringify({ rec: rec && rec.sizeClass, item: pi && [pi.sizeClass, pi.size_by, pi.tags], want }));
    await pg.click('[data-act="done"]');
  }

  // §8 check 4: n = 2 (one question, the button moves straight on) and n = 3
  // (two slips) — the mock provider's [fail:<provider>] tokens deal the losses
  for (const [fails, n, answers] of [['[fail:kimi] [fail:google]', 2, ['1']], ['[fail:google]', 3, ['3', '0.5']]]) {
    const pg = deskPage;
    await pg.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
    await toPodium(pg, 'a tin whistle on a red cord ' + fails + ' (jd2 card test n=' + n + ' ' + Date.now() + ')', 'n' + n, false);
    await pg.click('.jd-turn-actions [data-act="next"]');
    await pg.waitForSelector('.jd-ped', { timeout: 10000 });
    let s2 = await ped(pg);
    check('§8 check 4 — n=' + n + ': ' + (n - 1) + ' slip' + (n > 2 ? 's' : '') + ', "Question 1 of ' + (n - 1) + '", ' + n + ' pedestals',
      s2.slips.length === n - 1 && new RegExp('Question 1 of ' + (n - 1)).test(s2.tab) && s2.heights.length === n,
      JSON.stringify([s2.slips, s2.tab, s2.heights]));
    if (n === 2) {
      check('§8 check 4 — n=2: the one question\'s button moves straight on (files), gated until answered',
        s2.go.act === 'file' && s2.go.disabled && /file the grades/.test(s2.go.text) && s2.back === 'back', JSON.stringify(s2.go));
      await shot(pg, 'desk-n2-pedestal');
    }
    for (let i = 0; i < answers.length; i++) {
      await pg.click('.jd-ped-qo[data-gap="' + answers[i] + '"]');
      if (i < answers.length - 1) await pg.click('.jd-turn-actions .jd-turn-go');
    }
    s2 = await ped(pg);
    const bp = rateBody(pg);
    await pg.click('.jd-turn-actions .jd-turn-go');
    const b2 = await bp;
    check('n=' + n + ': files ' + n + ' places with ' + (n - 1) + ' gap' + (n > 2 ? 's' : '') + ' and pairs null',
      b2.pairs === null && b2.ranking.length === n && b2.ranking.slice(0, -1).every((p) => p.gap != null) &&
      !('gap' in b2.ranking[n - 1]) && s2.answer.complete, rankingWire(b2));
    await pg.waitForSelector('.jd-pod--said', { timeout: 20000 });
    const rec2 = await pg.evaluate(() => JSON.parse(sessionStorage.getItem('jd2-user-items'))[0]);
    const sit2 = filedSitting(rec2.run_id);
    const exp2 = expectPairs(s2.answer.ranking);
    check('n=' + n + ': SQLite holds ' + (n * (n - 1) / 2) + ' derived pair' + (n > 2 ? 's' : '') + ' with the right scores',
      !!(sit2 && sit2.pairs.length === n * (n - 1) / 2 && sit2.pairs.every((p) => p.source === 'derived' && p.score === exp2[p.a + p.b])),
      JSON.stringify({ got: sit2 && sit2.pairs, exp2 }));
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
  check('data.php serves the item live with six DERIVED pairs (from the pedestal card\'s gaps)', !!(served && !served.hidden &&
    served.pairs.length === 6 && served.pairs.every((p) => p.source === 'derived')), JSON.stringify(served && served.pairs));
  await page.evaluate((pid) => window.JD_record.open(pid), id);
  await page.waitForSelector('.rc-alt', { timeout: 10000 });
  await page.waitForTimeout(500);
  const strip = await page.$$eval('.rc-alt-h2h', (s) => s.map((x) => x.textContent + ' [' + x.title + ']'));
  check('report card: the strip carries a head-to-head line per drawing', strip.length === 4, strip.join(' / '));
  const rcRule = await page.evaluate(() => {
    const r = document.querySelector('.rc-rule'), t = document.querySelector('table.rc-subj');
    return { text: r ? r.textContent : null,
      before: !!(r && t && (r.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)),
      rows: [...document.querySelectorAll('table.rc-subj tbody .rc-subj-name')].map((x) => x.textContent) };
  });
  check('report card: the house rule (taxonomy.json houseRule) sits above the grades table, which lists every live axis in order',
    rcRule.text === taxonomy.houseRule && rcRule.before &&
    JSON.stringify(rcRule.rows) === JSON.stringify(taxonomy.axes.filter((a) => !a.defunct).map((a) => a.label)),
    JSON.stringify(rcRule));
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
