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
// prompt → four drawings → THE PREVIEW (0.15.0: the sitting's first step,
// the drawings in a 2×2 in seat order with their blind letters, a click or
// Enter enlarging one, next going to drawing A's first axis; above the fold
// at 1280×800, 2×2 at 390) → ONE QUESTION A CARD (0.18.0: each drawing's
// six cards — the five live axes, then the grade — each answered by a tap
// that only selects (0.18.1), then NEXT; a tap never advances, a second tap
// re-selects; back across and within drawings; the keyboard; the
// layout at 390×844 and 1280×800; the filing's ratings and the judgment rows
// exactly the cards' answers) → the podium → THE
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
// slips), the failures dealt by the mock's [fail:<provider>] tokens — each
// opening on a preview of two / three cells, the rest empty and saying the
// drawing didn't survive. Then it
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
const TAX_FILE = JSON.parse(fs.readFileSync(path.join(ROOT, 'art/junk-drawer/taxonomy.json'), 'utf8'));

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
  const judgments = q('SELECT g.slot, j.kind, j.axis_id, j.value FROM jd2_judgments j JOIN jd2_generations g ON g.id = j.generation_id ' +
    'WHERE j.session_id = ?', [sid]).map((r) => r.kind === 'grade' ? r.slot + ':grade:' + Number(r.value)
    : r.slot + ':axis:' + r.axis_id + ':' + Number(r.value)).sort();
  return { ranking, pairs, judgments };
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
// question card answered, and the podium filled in the row's order
async function toPodium(pg, text, tag, shots, opts) {
  await openTurn(pg);
  await pg.fill('#jd-turn-prompt', text);
  const intakeAnswered = pg.waitForResponse((r) => /\/api\/jd2-intake\.php/.test(r.url()) && r.status() === 200,
    { timeout: 30000 });
  await pg.click('[data-act="generate"]');
  await pg.waitForSelector('[data-act="rate"]', { timeout: 60000 });
  const intake = await (await intakeAnswered).json();
  if (shots) await shot(pg, tag + '-1-results');
  await pg.click('[data-act="rate"]');
  // ALL FOUR (0.15.0): the sitting opens on the preview — every drawing in
  // the 2×2, in the seat order the docket deals, blind letters pencilled
  await pg.waitForSelector('.jd-turn[data-view="preview"] .jd-preview', { timeout: 10000 });
  await pg.waitForTimeout(300);
  const preview = await previewState(pg);
  if (shots) await shot(pg, tag + '-1b-preview');
  // a click on a print opens the card's own enlargement (the shared zoom
  // layer, captioned by the blind letter); Escape peels it
  const firstSeat = preview.cells[0] && preview.cells[0].seat;
  await pg.click('.jd-preview-cell[data-cell="' + firstSeat + '"] .jd-turn-plate');
  await pg.waitForSelector('.jd-record-zoom.is-on .rc-zoom-cap-t', { timeout: 5000 }).catch(() => {});
  preview.zoomClick = await zoomCap(pg);
  await pg.waitForTimeout(500);   // the layer fades in
  if (shots) await shot(pg, tag + '-1c-preview-enlarged');
  await pg.keyboard.press('Escape');
  await pg.waitForFunction(() => !document.querySelector('.jd-record-zoom.is-on'), null, { timeout: 5000 }).catch(() => {});
  preview.zoomClosed = await pg.evaluate(() => !document.querySelector('.jd-record-zoom.is-on') &&
    document.querySelector('.jd-turn').getAttribute('data-view') === 'preview');
  // …and the keyboard: a cell's print takes focus, Enter enlarges it
  const lastSeat = preview.cells[preview.cells.length - 1].seat;
  await pg.focus('.jd-preview-cell[data-cell="' + lastSeat + '"] .jd-turn-plate');
  await pg.keyboard.press('Enter');
  await pg.waitForSelector('.jd-record-zoom.is-on .rc-zoom-cap-t', { timeout: 5000 }).catch(() => {});
  preview.zoomKey = await zoomCap(pg);
  await pg.keyboard.press('Escape');
  await pg.waitForFunction(() => !document.querySelector('.jd-record-zoom.is-on'), null, { timeout: 5000 }).catch(() => {});
  // next goes on to the first drawing's first question card
  await pg.click('.jd-turn-actions [data-act="next"]');
  await pg.waitForSelector('.jd-q-opts', { timeout: 10000 });
  await pg.waitForTimeout(450);   // the card settles into its layout first
  preview.after = await pg.evaluate(() => ({
    view: document.querySelector('.jd-turn').getAttribute('data-view'),
    title: (document.querySelector('.jd-turn-title') || {}).textContent,
    firstAxis: (document.querySelector('.jd-q-opts') || { getAttribute: () => null }).getAttribute('data-q'),
    back: !!document.querySelector('.jd-turn-actions [data-act="back"]'),
    previewDone: !!document.querySelector('.jd-rail-step[data-step="preview"].is-done')
  }));
  // ONE QUESTION A CARD (0.18.0): every drawing's six cards, answered in
  // turn by a tap that only selects and then NEXT; the walk back and
  // forward, the keyboard and reduced motion are tried on the way
  await qLogInstall(pg);
  const drawings = [];
  let nav = null;
  for (let d = 0; ; d++) {
    if (d === 1) {
      // across drawings: back from drawing B's first card is drawing A's
      // grade, its answer pre-selected and nothing advancing; next returns
      nav = { at: await qState(pg) };
      await pg.click('.jd-turn-actions [data-act="back"]');
      await pg.waitForFunction(() => /· 6 of 6$/.test((document.querySelector('.jd-q-step > span') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
      await pg.waitForTimeout(400);
      nav.back = await qState(pg);
      if (shots) await shot(pg, tag + '-2c-grade-selected');
      await pg.click('.jd-turn-actions [data-act="next"]');
      await qTo(pg, nav.at.step).catch(() => {});
      nav.fwd = await qState(pg);
    }
    const dr = await answerDrawing(pg, d, tag, shots, opts || {});
    drawings.push(dr);
    if (dr.after !== 'bench') break;   // the last grade went on to the ranking
  }
  await pg.waitForSelector('.jd-pod-tier[data-rank="1"]');
  const order = await pg.$$eval('.jd-pod-tray .jd-pod-print', (els) => els.map((e) => e.getAttribute('data-pod')));
  for (let k = 1; k <= order.length; k++) {
    await pg.click('.jd-pod-tier[data-rank="' + k + '"] .jd-pod-block');
    await pg.click('.jd-pod-print[data-pod="' + order[k - 1] + '"]');
  }
  return { intake, order, drawings, nav, preview };
}
// ---- ONE QUESTION A CARD (0.18.0; a tap only selects since 0.18.1) ---------
// the question card as drawn: which drawing and question, the words, the
// options (label, description, value, radio state, ramp class, box), the
// house rule, the plate, the buttons, where focus is, and the layout facts —
// `vis` is the card's visible band: the scroller, cut by the card's foot and
// by the bench strip when one is mounted
const qState = (pg) => pg.evaluate(() => {
  const q = document.querySelector('.jd-q');
  const card = document.querySelector('.jd-turn');
  const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
    return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), h: Math.round(r.height) }; };
  if (!q) return { view: card && card.getAttribute('data-view'), none: true };
  const g = q.querySelector('.jd-q-opts');
  const rule = q.querySelector('.jd-turn-rule');
  const ask = q.querySelector('.jd-q-ask');
  const sumEl = q.querySelector('.jd-q-sum');
  const more = q.querySelector('.jd-q-more');
  const desc = q.querySelector('.jd-q-desc');
  const go = document.querySelector('.jd-turn-actions .jd-turn-go');
  const backEl = document.querySelector('.jd-turn-actions [data-act="back"]');
  const fig = document.querySelector('.jd-turn-pin .jd-turn-plate');
  const act = document.activeElement;
  const sc = document.querySelector('.jd-turn-scroll').getBoundingClientRect();
  const cr = card.getBoundingClientRect();
  const bar = document.querySelector('.jd-bench-bar');
  const barTop = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect().top : Infinity;
  const stepEl = q.querySelector('.jd-q-step > span');
  const lab = g && (g.getAttribute('aria-labelledby') || '').split(' ');
  const dsc = g && g.getAttribute('aria-describedby');
  const asn = q.querySelector('.jd-turn-assign');
  return {
    view: card.getAttribute('data-view'),
    title: (document.querySelector('.jd-turn-title') || {}).textContent,
    slot: q.getAttribute('data-slot'),
    step: stepEl ? stepEl.textContent : null,
    echo: (q.querySelector('.jd-q-echo') || {}).textContent || null,
    defs: q.classList.contains('is-defs'),
    q: g && g.getAttribute('data-q'), group: g && g.getAttribute('role'),
    named: !!(lab && lab.length === 2 && lab[0] === (stepEl && stepEl.id) && document.getElementById(lab[1]) &&
      document.getElementById(lab[1]).classList.contains('jd-q-label')),
    described: dsc ? (document.getElementById(dsc) || {}).textContent : null,
    label: (q.querySelector('.jd-q-label') || {}).textContent,
    sum: sumEl ? [...sumEl.childNodes].filter((n) => n.nodeType === 3 || n.tagName === 'SPAN').map((n) => n.textContent).join('').trim() : null,
    more: more ? { text: more.textContent, expanded: more.getAttribute('aria-expanded'), box: box(more) } : null,
    desc: desc ? { hidden: desc.hidden, text: desc.textContent, paras: [...desc.querySelectorAll('p')].map((p) => p.textContent),
      font: getComputedStyle(desc).fontFamily } : null,
    opts: g ? [...g.querySelectorAll('.jd-q-opt')].map((o) => ({ v: o.getAttribute('data-v'), role: o.getAttribute('role'),
      checked: o.getAttribute('aria-checked'), on: o.classList.contains('is-on'), cls: o.getAttribute('data-cls'),
      klass: o.className, bar: (o.querySelector('.rc-bar') || {}).className || '',
      label: (o.querySelector('b') || {}).textContent, desc: (o.querySelector('small') || {}).textContent || '',
      descShown: !!(o.querySelector('small') && getComputedStyle(o.querySelector('small')).display !== 'none'),
      last: (o.querySelector('.jd-q-last') || {}).textContent || null,
      tab: o.tabIndex, box: box(o) })) : [],
    rule: rule ? rule.textContent : null,
    ruleAbove: !!(rule && ask && (rule.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING)),
    pruned: (q.querySelector('.jd-turn-pruned:not(.jd-turn-mapped)') || {}).textContent || null,
    mapped: (q.querySelector('.jd-turn-mapped') || {}).textContent || null,
    brief: asn ? { open: asn.classList.contains('is-open'), fit: asn.classList.contains('is-fit'), h: box(asn).h,
      pv: (asn.querySelector('.jd-turn-pv') || {}).textContent } : null,
    plate: box(fig), plateTag: fig ? (fig.querySelector('.jd-pair-tag') || {}).textContent : null,
    plateZoom: !!(fig && fig.getAttribute('role') === 'button' && fig.getAttribute('tabindex') === '0'),
    selects: document.querySelectorAll('.jd-turn select').length,
    go: go ? { act: go.getAttribute('data-act'), disabled: go.disabled, text: go.textContent, box: box(go) } : null,
    back: !!backEl, backBox: box(backEl),
    focus: act && act.classList && act.classList.contains('jd-q-opt') ? act.getAttribute('data-v') : null,
    vis: { t: Math.round(sc.top), b: Math.round(Math.min(sc.bottom, cr.bottom, barTop)) },
    vw: window.innerWidth, vh: window.innerHeight,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    stamps: document.querySelectorAll('.jd-turn [class*="stamp"]').length,
    text: card.textContent
  };
});
// every press on an option, logged as the card stood just after it handled
// it (a document listener runs after the card's own, before the beat ends)
const qLogInstall = (pg) => pg.evaluate(() => {
  if (window.__qlog) return;
  window.__qlog = [];
  document.addEventListener('click', (e) => {
    const o = e.target.closest && e.target.closest('.jd-q-opt');
    if (!o || !o.parentNode) return;
    const g = o.parentNode;
    window.__qlog.push({ q: g.getAttribute('data-q'), v: o.getAttribute('data-v'), klass: o.className,
      checked: [...g.querySelectorAll('.jd-q-opt')].map((x) => x.getAttribute('aria-checked')),
      next: ((document.querySelector('.jd-turn-actions [data-act="next"]') || {}).disabled === false) });
  });
});
const qLogLast = (pg) => pg.evaluate(() => (window.__qlog || []).slice(-1)[0] || null);
// wait for the card to stand somewhere other than `step` (the beat's advance)
const qMoved = (pg, step) => pg.waitForFunction((s) => {
  const e = document.querySelector('.jd-q-step > span');
  return !e || e.textContent !== s;
}, step, { timeout: 5000 });
const qTo = (pg, step) => pg.waitForFunction((s) => {
  const e = document.querySelector('.jd-q-step > span');
  return !!e && e.textContent === s;
}, step, { timeout: 5000 });
// does every option row and the back control stand inside the card's
// visible band (no scrolling)?
const qFits = (c) => !!(c && c.opts.length && c.opts.every((o) => o.box.t >= c.vis.t && o.box.b <= c.vis.b) &&
  (!c.back || (c.backBox.t >= c.vis.t && c.backBox.b <= c.vis.b)));
// one drawing's question cards, each read, then answered by a TAP (the
// value (i + d) mod n, varied) — which only selects — and then NEXT (0.18.1:
// nothing advances by itself). On the way: each drawing's first tap is
// watched for half a second to show the card stays; drawing B's third card
// walks back and forward; on the desk, drawing C's first card is answered
// by the keyboard (↓ moves, Enter selects, Enter again goes on); drawing
// D's first card is tapped twice (the second tap re-selects); with
// opts.instant (reduced motion), a tap does not advance either.
async function answerDrawing(pg, d, tag, shots, opts) {
  const out = { cards: [], chosen: {}, slot: null, after: null };
  for (let i = 0; i < 12; i++) {
    const c = await qState(pg);
    if (c.none || (out.slot && c.slot !== out.slot)) break;
    out.slot = c.slot;
    if (d === 1 && i === 2) {
      // back within a drawing: the card before, answered and armed; next returns
      await pg.click('.jd-turn-actions [data-act="back"]');
      await qMoved(pg, c.step).catch(() => {});
      out.backIn = await qState(pg);
      await pg.click('.jd-turn-actions [data-act="next"]');
      await qMoved(pg, out.backIn.step).catch(() => {});
      out.fwdIn = await qState(pg);
    }
    const k = (i + d) % Math.max(1, c.opts.length);
    out.cards.push(c);
    if (tag === 'phone' && d === 2 && i === 0) {
      // the phone's two unfoldings, kept from card to card: "show full
      // prompt" (work.briefOpen) and "definitions" (remembered on the device)
      await pg.click('.jd-q .jd-turn-pv');
      await pg.click('.jd-q-defs');
      out.unfolded = await qState(pg);
    }
    if (tag === 'phone' && d === 2 && i === 1) {
      c.unfoldedByTest = true;          // (its fit is the folded cards' business)
      out.kept = c;
      await pg.click('.jd-q-defs');
      await pg.click('.jd-q .jd-turn-pv');
      out.refolded = await qState(pg);
    }
    if (shots && d === 0 && i === 0) await shot(pg, tag + '-2-question');
    if (shots && d === 0 && c.q === 'grade') await shot(pg, tag + '-2b-grade');
    let advanced = false;
    if (opts.instant && d === 0 && i === 0) {
      // reduced motion: a tap selects and the card stays, as anywhere else
      c.instant = await pg.evaluate((n) => {
        const step = () => (document.querySelector('.jd-q-step > span') || {}).textContent || null;
        const before = step();
        document.querySelectorAll('.jd-q-opt')[n].click();
        return { before, after: step(),
          checked: [...document.querySelectorAll('.jd-q-opt')].filter((o) => o.getAttribute('aria-checked') === 'true').map((o) => o.getAttribute('data-v')) };
      }, k);
      await pg.waitForTimeout(500);
      c.instant.later = (await qState(pg)).step;
    } else if (tag === 'desk' && d === 2 && i === 0) {
      // the keyboard: focus is on the group's tab stop; ↓ moves it without
      // choosing; Enter selects (the card stays); Enter on the selected row
      // goes on
      c.kbd = { start: c.focus };
      await pg.keyboard.press('ArrowDown');
      c.kbd.moved = await pg.evaluate(() => ({ focus: document.activeElement.getAttribute('data-v'),
        checked: [...document.querySelectorAll('.jd-q-opt')].filter((o) => o.getAttribute('aria-checked') === 'true').length }));
      await pg.keyboard.press('Enter');
      c.picked = await qLogLast(pg);
      await pg.waitForTimeout(450);
      c.kbd.selected = await qState(pg);
      await pg.keyboard.press('Enter');
      await qMoved(pg, c.step).catch(() => {});
      c.kbd.after = (await qState(pg)).step;
      advanced = true;
    } else {
      await pg.click('.jd-q-opt:nth-child(' + (k + 1) + ')');
      c.picked = await qLogLast(pg);
    }
    if (d === 3 && i === 0) {
      // A SECOND TAP RE-SELECTS: another row, the first one let go, the card
      // still standing
      const k2 = (k + 1) % c.opts.length;
      await pg.click('.jd-q-opt:nth-child(' + (k2 + 1) + ')');
      c.picked = await qLogLast(pg);
      out.retap = await qState(pg);
      out.retapFirst = c.opts[k].v;
    }
    if (!advanced && i === 0) {
      // the tap does not advance: half a second later the card still stands,
      // answered, NEXT armed
      await pg.waitForTimeout(500);
      c.stay = await qState(pg);
      if (shots && d === 0) await shot(pg, tag + '-2s-selected');
    }
    out.chosen[c.q] = c.picked ? Number(c.picked.v) : (c.instant ? Number(c.opts[k].v) : null);
    if (!advanced) {
      await pg.click('.jd-turn-actions [data-act="next"]');
      await qMoved(pg, c.step).catch(() => {});
    }
  }
  await pg.waitForTimeout(150);
  out.after = await pg.evaluate(() => document.querySelector('.jd-turn').getAttribute('data-view'));
  return out;
}
// the question cards' checks, shared by the phone and desk turns
function checkQuestions(tag, T, taxonomy, models) {
  const live = taxonomy.axes.filter((a) => !a.defunct);
  const lt = (s) => String(s == null ? '' : s).replace(/_([^_]+)_/g, '$1');
  const byRankDesc = (l) => l.slice().sort((a, b) => b.rank - a.rank);
  const order = live.map((a) => a.id).concat(['grade']);
  const ruled = taxonomy.houseRuleAxes || [];
  const D = T.drawings;
  const A = D[0] || { cards: [] };
  check(tag + ': every drawing is six question cards — the live axes in taxonomy order, then the overall grade last (' + order.join(', ') + ')',
    D.length === 4 && D.every((dr) => JSON.stringify(dr.cards.map((c) => c.q)) === JSON.stringify(order)),
    JSON.stringify(D.map((dr) => [dr.slot, dr.cards.map((c) => c.q)])));
  check(tag + ': each card\'s progress line reads "Drawing X · k of 6", under the heading "Grade drawing X"',
    D.every((dr) => dr.cards.every((c, i) => c.step === 'Drawing ' + dr.slot.toUpperCase() + ' · ' + (i + 1) + ' of ' + order.length &&
      c.title === 'Grade drawing ' + dr.slot.toUpperCase())), JSON.stringify(A.cards.map((c) => [c.step, c.title])));
  const label = (c, v) => { const ax = live.find((a) => a.id === c.q);
    const l = (ax ? ax.values : taxonomy.grades).find((x) => String(x.rank) === String(v)); return l ? lt(l.label) : null; };
  check(tag + ': no card echoes the card before (0.18.1: with NEXT doing the moving, a "✓" there would read as this card\'s answer)',
    D.every((dr) => dr.cards.every((c) => c.echo === null)), JSON.stringify(D.map((dr) => dr.cards.map((c) => c.echo))));
  check(tag + ': each axis card asks its label as the heading and its summary as the question; its description waits behind "more", ' +
    'in the body face — and for ' + ruled.join(', ') + ' the house rule after it',
    A.cards.slice(0, live.length).every((c, i) => c.label === lt(live[i].label) && c.sum === live[i].summary &&
      (live[i].description ? (c.more && c.more.text === 'more' && c.more.expanded === 'false' && c.desc && c.desc.hidden &&
        c.desc.paras[0] === live[i].description && !/mono|courier/i.test(c.desc.font) &&
        (ruled.indexOf(live[i].id) !== -1 ? c.desc.paras[1] === taxonomy.houseRule : c.desc.paras.length === 1)) : !c.more)),
    JSON.stringify(A.cards.map((c) => [c.label, c.sum, c.more && c.more.text, c.desc && [c.desc.hidden, c.desc.paras.length, c.desc.font]])));
  check(tag + ': "more" is a finger\'s target (at least 48×48)', A.cards.filter((c) => c.more).every((c) => c.more.box.h >= 48 && c.more.box.r - c.more.box.l >= 48),
    JSON.stringify(A.cards.map((c) => c.more && c.more.box)));
  const G = A.cards[live.length] || { opts: [] };
  const grades = byRankDesc(taxonomy.grades);
  const gq = taxonomy.gradeQuestion || {};
  check(tag + ': the grade card is last, named and asked by the taxonomy\'s gradeQuestion, offering the five grades best first with their descriptions',
    G.q === 'grade' && !!gq.label && G.label === gq.label && G.sum === gq.summary && !G.more &&
    JSON.stringify(G.opts.map((o) => [o.label, Number(o.v), o.desc])) === JSON.stringify(grades.map((g) => [lt(g.label), g.rank, g.description])),
    JSON.stringify([G.label, G.sum, G.opts.map((o) => [o.label, o.v])]));
  check(tag + ': each axis card offers its values best first, label over description, in the taxonomy\'s words',
    A.cards.slice(0, live.length).every((c, i) => JSON.stringify(c.opts.map((o) => [o.label, Number(o.v), o.desc])) ===
      JSON.stringify(byRankDesc(live[i].values).map((v) => [lt(v.label), v.rank, v.description || '']))),
    JSON.stringify(A.cards.map((c) => c.opts.map((o) => o.label))));
  check(tag + ': each card is a real radio group (role=radiogroup named by its progress line and question, described by the question alone; role=radio rows, aria-checked, one tab stop) and no select anywhere',
    D.every((dr) => dr.cards.every((c) => c.group === 'radiogroup' && c.named && c.described === c.sum && c.opts.every((o) => o.role === 'radio' &&
      (o.checked === 'true' || o.checked === 'false')) && c.opts.filter((o) => o.tab === 0).length === 1 && c.selects === 0)),
    JSON.stringify(A.cards.map((c) => [c.group, c.named, c.described, c.opts.map((o) => o.role + o.checked + o.tab), c.selects])));
  check(tag + ': a fresh card has nothing chosen, its next disarmed, and the keyboard on its first row',
    A.cards.every((c) => c.opts.every((o) => o.checked === 'false') && c.go && c.go.disabled && c.focus === c.opts[0].v),
    JSON.stringify(A.cards.map((c) => [c.go, c.focus])));
  const ramp = (c, o) => (c.q === 'grade' ? 'rc-g' : c.opts.length === 4 ? 'rc-q' : 'rc-r') + o.v;
  check(tag + ': every row carries its rank pencil — rc-q on the 4-point axes, rc-r on Je ne sais quoi, rc-g on the grade (JD_axisCls) — on its gauge',
    A.cards.every((c) => c.opts.every((o) => o.cls === ramp(c, o) && new RegExp('\\b' + ramp(c, o) + '\\b').test(o.bar))),
    JSON.stringify(A.cards.map((c) => c.opts.map((o) => o.cls))));
  const picks = [].concat(...D.map((dr) => dr.cards.filter((c) => c.picked)));
  check(tag + ': a press checks that row alone (aria-checked), lights it in its pencil, arms next — recorded at once',
    picks.length >= 20 && picks.every((c) => {
      const i = c.opts.findIndex((o) => o.v === c.picked.v);
      return i >= 0 && c.picked.checked.every((x, j) => x === (j === i ? 'true' : 'false')) &&
        /\bis-on\b/.test(c.picked.klass) && new RegExp('\\b' + ramp(c, c.opts[i]) + '\\b').test(c.picked.klass) && c.picked.next;
    }), JSON.stringify(picks.slice(0, 3).map((c) => c.picked)));
  const stays = [].concat(...D.map((dr) => dr.cards.filter((c) => c.stay)));
  check(tag + ': A TAP DOES NOT ADVANCE — half a second after it the card still stands, its row checked, NEXT armed',
    stays.length >= 3 && stays.every((c) => c.stay.step === c.step && c.stay.go && !c.stay.go.disabled &&
      c.stay.opts.filter((o) => o.checked === 'true').length === 1),
    JSON.stringify(stays.map((c) => [c.step, c.stay.step, c.stay.go && c.stay.go.disabled])));
  check(tag + ': NEXT is what goes on — card to card, drawing to drawing, and from the last grade to the ranking',
    D.every((dr, k) => dr.cards.length === order.length && dr.after === (k < D.length - 1 ? 'bench' : 'call')),
    JSON.stringify(D.map((dr) => [dr.slot, dr.cards.length, dr.after])));
  const RT = (D[3] || {}).retap;
  check(tag + ': A SECOND TAP RE-SELECTS — another row checked alone, the first let go, the card still standing',
    !!(RT && RT.step === 'Drawing ' + D[3].slot.toUpperCase() + ' · 1 of 6' &&
      RT.opts.filter((o) => o.checked === 'true').map((o) => o.v).join() === String(D[3].chosen[RT.q]) &&
      String(D[3].chosen[RT.q]) !== String(D[3].retapFirst)),
    JSON.stringify(RT && [RT.step, RT.opts.map((o) => o.checked), D[3].retapFirst]));
  check(tag + ': the house rule is on no question card (it is the preview\'s, and in the "more" of the axes it governs)',
    D.every((dr) => dr.cards.every((c) => c.rule === null)), JSON.stringify(D.map((dr) => dr.cards.map((c) => !!c.rule))));
  check(tag + ': the drawing tops every card, its blind letter pencilled on, the enlarge control',
    D.every((dr) => dr.cards.every((c) => c.plateTag === 'Drawing ' + dr.slot.toUpperCase() && c.plateZoom && c.plate &&
      (tag === 'phone' ? c.plate.b <= c.opts[0].box.t : c.plate.r <= c.opts[0].box.l))),
    JSON.stringify(A.cards.map((c) => [c.plateTag, c.plate, c.opts[0] && c.opts[0].box])));
  check(tag + ': the drawing stands still — the same place and size on every card of every drawing',
    D.every((dr) => dr.cards.every((c) => JSON.stringify(c.plate) === JSON.stringify(A.cards[0].plate))),
    JSON.stringify(D.map((dr) => dr.cards.map((c) => c.plate && [c.plate.t, c.plate.h]))));
  check(tag + ': nothing on a question card names a model, carries a stamp, or is pruned on a visitor turn',
    D.every((dr) => dr.cards.every((c) => !models.some((m) => m && c.text.indexOf(m) !== -1) && c.stamps === 0 && !c.pruned && !c.mapped)));
  const C0 = A.cards[0] || { opts: [] };
  if (tag === 'phone') {
    check('phone 390×844: no sideways scroll on any card; every option row is at least 48px tall and keeps a 16px gutter',
      D.every((dr) => dr.cards.every((c) => !c.overflow && c.opts.every((o) => o.box.h >= 48 && o.box.l >= 16 && o.box.r <= c.vw - 16))),
      JSON.stringify(C0.opts.map((o) => o.box)));
    check('phone 390×844: on ALL six cards of every drawing, every option row and back stand inside the card\'s visible area — no scrolling',
      D.every((dr) => dr.cards.every((c) => c.unfoldedByTest || qFits(c))),
      JSON.stringify(D.map((dr) => dr.cards.filter((c) => !qFits(c)).map((c) => [c.step, c.vis, c.opts.map((o) => o.box.b), c.backBox]))));
    check('phone: a row is its label and gauge — no description shown on a fresh card (definitions off)',
      A.cards.every((c) => !c.defs && c.opts.every((o) => !o.descShown)), JSON.stringify(A.cards.map((c) => c.opts.map((o) => o.descShown))));
    check('phone: the prompt stands on one line (with "show full prompt")',
      !!(C0.brief && !C0.brief.open && !C0.brief.fit && C0.brief.h <= 44 && C0.brief.pv === 'show full prompt'), JSON.stringify(C0.brief));
    const Cd = D[2] || {};
    const U = Cd.unfolded, Kp = Cd.kept, R = Cd.refolded;
    check('phone: "show full prompt" opens it and "definitions" shows every row\'s description — and the next card keeps both; both fold again',
      !!(U && U.brief.open && U.brief.pv === 'hide' && U.brief.h > C0.brief.h && U.defs && U.opts.every((o) => o.descShown) &&
        Kp && Kp.brief.open && Kp.defs && Kp.opts.every((o) => o.descShown) &&
        R && !R.brief.open && !R.defs && R.opts.every((o) => !o.descShown || o.checked === 'true')),
      JSON.stringify({ u: U && [U.brief, U.defs], k: Kp && [Kp.brief, Kp.defs], r: R && [R.brief, R.defs] }));
  } else {
    check('desk 1280×800: the drawing sits left of the question, and every option and the buttons stand above the fold',
      D.every((dr) => dr.cards.every((c) => !c.overflow && c.plate.r <= c.opts[0].box.l && c.opts.every((o) => o.box.b <= c.vh && o.box.h >= 48) &&
        c.go && c.go.box.b <= c.vh)), JSON.stringify(D.map((dr) => dr.cards.map((c) => [c.opts.length && c.opts[c.opts.length - 1].box.b, c.go && c.go.box.b]))));
    check('desk: every row shows its description', A.cards.every((c) => c.opts.every((o) => o.descShown)));
    const K = (D[2] || { cards: [] }).cards[0] || {};
    check('desk: the keyboard — ↓ moves between rows without choosing, Enter selects (the card stays), Enter on the selected row goes on',
      !!(K.kbd && K.kbd.start === K.opts[0].v && K.kbd.moved.focus === K.opts[1].v && K.kbd.moved.checked === 0 &&
        K.picked && K.picked.v === K.opts[1].v && K.kbd.selected.step === K.step &&
        K.kbd.selected.opts.filter((o) => o.checked === 'true').map((o) => o.v).join() === K.opts[1].v &&
        K.kbd.after === K.step.replace('1 of 6', '2 of 6')), JSON.stringify(K.kbd && [K.kbd.start, K.kbd.moved, K.kbd.selected && K.kbd.selected.step, K.kbd.after]));
  }
  const N = T.nav || {};
  check(tag + ': back from drawing B\'s first card is drawing A\'s grade, its answer pre-selected (its description shown), next armed toward drawing B; next returns',
    !!(N.back && N.back.slot === A.slot && N.back.q === 'grade' && N.back.step === 'Drawing ' + A.slot.toUpperCase() + ' · 6 of 6' &&
      N.back.opts.filter((o) => o.checked === 'true').map((o) => Number(o.v)).join() === String(A.chosen.grade) &&
      N.back.opts.filter((o) => o.checked === 'true').every((o) => o.descShown) &&
      N.back.go && !N.back.go.disabled && /next — drawing/.test(N.back.go.text) &&
      N.fwd && N.fwd.step === N.at.step && N.fwd.q === order[0]),
    JSON.stringify({ at: N.at && N.at.step, back: N.back && [N.back.step, N.back.q, N.back.go], fwd: N.fwd && N.fwd.step }));
  const B = D[1] || {};
  check(tag + ': back within a drawing returns to the card before, answered and armed (nothing advances), and next goes on',
    !!(B.backIn && B.backIn.q === order[1] && B.backIn.opts.filter((o) => o.checked === 'true').map((o) => Number(o.v)).join() ===
      String(B.chosen[order[1]]) && B.backIn.go && !B.backIn.go.disabled && B.fwdIn && B.fwdIn.q === order[2]),
    JSON.stringify({ backIn: B.backIn && [B.backIn.q, B.backIn.go], fwdIn: B.fwdIn && B.fwdIn.q }));
}
// what the question cards chose, as jd2-rate's ratings (by slot)
function ratingsOf(drawings) {
  const out = [];
  drawings.forEach((dr) => Object.keys(dr.chosen).forEach((qid) => {
    out.push(qid === 'grade' ? dr.slot + ':grade:' + dr.chosen[qid] : dr.slot + ':axis:' + qid + ':' + dr.chosen[qid]);
  }));
  return out.sort();
}
const wireRatings = (body) => (body.ratings || []).map((r) =>
  r.kind === 'grade' ? r.slot + ':grade:' + r.value : r.slot + ':axis:' + r.axis_id + ':' + r.value).sort();
// the preview card, read off the page: the view and heading, the docket's
// stations, each cell's seat, pencilled letter and enlarge fitting, the
// empty cells, the line, the button, and anything that could name a model
const previewState = (pg) => pg.evaluate(() => {
  const go = document.querySelector('.jd-turn-actions .jd-turn-go');
  const grid = document.querySelector('.jd-preview');
  const cs = grid && getComputedStyle(grid);
  return {
    view: document.querySelector('.jd-turn').getAttribute('data-view'),
    title: (document.querySelector('.jd-turn-title') || {}).textContent,
    rail: [...document.querySelectorAll('.jd-rail-step')].map((b) => ({ step: b.getAttribute('data-step'),
      current: b.classList.contains('is-current'), word: (b.querySelector('.jd-rail-word') || {}).textContent })),
    cells: [...document.querySelectorAll('.jd-preview-cell:not(.is-empty)')].map((c) => {
      const f = c.querySelector('.jd-turn-plate');
      const r = c.getBoundingClientRect();
      return { seat: c.getAttribute('data-cell'), tag: (c.querySelector('.jd-pair-tag') || {}).textContent,
        button: !!f && f.getAttribute('role') === 'button' && f.getAttribute('tabindex') === '0',
        svg: !!c.querySelector('.jd-turn-art-in svg'), box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.bottom)] };
    }),
    empty: [...document.querySelectorAll('.jd-preview-cell.is-empty')].map((c) => c.textContent),
    rule: (document.querySelector('.jd-turn[data-view="preview"] .jd-turn-rule') || {}).textContent || null,
    cols: cs ? cs.gridTemplateColumns.split(' ').length : 0,
    line: (document.querySelector('.jd-preview-line') || {}).textContent,
    go: go ? { act: go.getAttribute('data-act'), disabled: go.disabled, text: go.textContent } : null,
    back: !!document.querySelector('.jd-turn-actions [data-act="back"]'),
    titles: document.querySelectorAll('.jd-preview [title]').length,
    stamps: document.querySelectorAll('.jd-turn [class*="stamp"]').length,
    text: document.querySelector('.jd-turn').textContent,
    vh: window.innerHeight, overflow: document.documentElement.scrollWidth > window.innerWidth
  };
});
const zoomCap = (pg) => pg.evaluate(() => {
  const c = document.querySelector('.jd-record-zoom.is-on .rc-zoom-cap-t');
  return c ? c.textContent : null;
});
// the preview's checks, shared by every turn the test takes
function checkPreview(tag, P, n, models) {
  const seats = P.rail.filter((r) => /^[a-d]$/.test(r.step)).map((r) => r.step);
  const words = { 4: 'all four', 3: 'all three', 2: 'both' }[n];
  check(tag + ': the sitting opens on the preview — the docket\'s FIRST station, current, before the first drawing',
    P.view === 'preview' && P.rail[0] && P.rail[0].step === 'preview' && P.rail[0].current &&
    P.rail[0].word === words && P.rail[1] && P.rail[1].step === seats[0] &&
    P.title.toLowerCase() === words, JSON.stringify({ view: P.view, title: P.title, rail: P.rail }));
  check(tag + ': ' + n + ' cells in the dealt seat order, each a drawing with its blind letter pencilled over it',
    P.cells.length === n && P.cells.map((c) => c.seat).join() === seats.join() &&
    P.cells.every((c) => c.svg && c.tag === 'Drawing ' + c.seat.toUpperCase()),
    JSON.stringify({ cells: P.cells.map((c) => [c.seat, c.tag, c.svg]), seats }));
  check(tag + ': ' + (4 - n) + ' empty cell' + (4 - n === 1 ? '' : 's') + (n < 4 ? ', each saying the drawing didn\'t survive' : ''),
    P.empty.length === 4 - n && P.empty.every((t) => t === 'didn’t survive'), JSON.stringify(P.empty));
  check(tag + ': the one-line instruction, no back, next armed toward drawing ' + (seats[0] || '').toUpperCase(),
    P.line === words.charAt(0).toUpperCase() + words.slice(1) + ', side by side. Click one to enlarge.' &&
    !P.back && P.go && P.go.act === 'next' && !P.go.disabled &&
    P.go.text.indexOf('drawing ' + (seats[0] || '').toUpperCase()) !== -1, JSON.stringify({ line: P.line, go: P.go, back: P.back }));
  check(tag + ': nothing on the preview names a model, carries a tooltip or a stamp',
    !models.some((m) => m && P.text.indexOf(m) !== -1) && P.titles === 0 && P.stamps === 0,
    JSON.stringify({ hit: models.filter((m) => m && P.text.indexOf(m) !== -1), titles: P.titles, stamps: P.stamps }));
  check(tag + ': every print is the enlarge control (role=button, focusable)', P.cells.every((c) => c.button));
  check(tag + ': the preview carries the house rule (taxonomy.json houseRule) — once per sitting, before the first question',
    !!TAX_FILE.houseRule && P.rule === TAX_FILE.houseRule, String(P.rule));
  check(tag + ': a click on a print enlarges it (the card\'s own zoom, blind caption); Escape shrinks it back to the preview',
    !!P.zoomClick && / · drawing [A-D]$/.test(P.zoomClick) && P.zoomClick.slice(-1) === P.cells[0].seat.toUpperCase() &&
    P.zoomClosed, JSON.stringify({ cap: P.zoomClick, closed: P.zoomClosed }));
  check(tag + ': Enter on a focused print enlarges it',
    !!P.zoomKey && P.zoomKey.slice(-1) === P.cells[P.cells.length - 1].seat.toUpperCase(), String(P.zoomKey));
  check(tag + ': next goes to the first drawing\'s first question card (its first axis), with back to the preview',
    P.after.view === 'bench' && P.after.title === 'Grade drawing ' + (seats[0] || '').toUpperCase() &&
    P.after.firstAxis === 'understanding-assignment' && P.after.back && P.after.previewDone, JSON.stringify(P.after));
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
  // every name the registry knows, for the preview's blindness check
  const models = [];
  (taxonomy.models || []).forEach((m) => [m.label, m.id, m.api_model, m.vendor, m.provider].forEach((x) => {
    if (typeof x === 'string' && x.length > 2) models.push(x);
  }));
  for (const [pg, tag] of [[page, 'phone'], [deskPage, 'desk']]) {
    await pg.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
    const t = await toPodium(pg, prompt + ' ' + tag, tag, true);
    const intake = t.intake;
    checkPreview(tag, t.preview, 4, models);
    const PV = t.preview;
    if (tag === 'phone') {
      // 2×2 at 390px: two columns, the second row under the first
      check('phone: the preview stacks 2×2 at 390px, no sideways scroll',
        PV.cols === 2 && PV.cells.length === 4 && PV.cells[0].box[1] === PV.cells[1].box[1] &&
        PV.cells[2].box[1] > PV.cells[0].box[3] && !PV.overflow, JSON.stringify({ cols: PV.cols, boxes: PV.cells.map((c) => c.box) }));
    } else {
      check('desk: all four stand above the fold at 1280×800 (2×2)',
        PV.cols === 2 && PV.cells.every((c) => c.box[3] <= PV.vh) && PV.cells[0].box[1] === PV.cells[1].box[1],
        JSON.stringify({ cols: PV.cols, boxes: PV.cells.map((c) => c.box), vh: PV.vh }));
    }
    // THE RATING CARD, ONE QUESTION AT A TIME (0.18.0) over the five live
    // axes (taxonomy v36: Layering is the 4-point layering-2) and the grade
    const live = taxonomy.axes.filter((a) => !a.defunct);
    check(tag + ': the live axes are UA, SC-2, layering-2, paintwork, jnsq — Layering on four points (taxonomy v36)',
      JSON.stringify(live.map((a) => [a.id, a.values.length])) === JSON.stringify([['understanding-assignment', 4],
        ['structural-coherence-2', 4], ['layering-2', 4], ['paintwork', 4], ['jnsq', 3]]), JSON.stringify(live.map((a) => a.id)));
    checkQuestions(tag, t, taxonomy, models);
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
    check(tag + ': the filing carries exactly the cards\' answers — a grade and every live axis per drawing, by slot (jd2-rate\'s shape)',
      JSON.stringify(wireRatings(body)) === JSON.stringify(ratingsOf(t.drawings)) && body.ratings.length === 4 * (live.length + 1) &&
      body.ratings.every((r) => (r.kind === 'grade' && !('axis_id' in r)) || (r.kind === 'axis' && typeof r.axis_id === 'string')) &&
      ['run_id', 'client_ref', 'client', 'title', 'suppress', 'ratings', 'ranking', 'pairs'].every((k) => k in body),
      JSON.stringify({ wire: wireRatings(body).slice(0, 8), cards: ratingsOf(t.drawings).slice(0, 8), keys: Object.keys(body) }));
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
    check(tag + ': SQLite holds one judgment row per answer, as the cards gave them',
      !!(sit && JSON.stringify(sit.judgments) === JSON.stringify(ratingsOf(t.drawings))), JSON.stringify(sit && sit.judgments.slice(0, 8)));
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
    // the three-drawing turn runs under prefers-reduced-motion: a tap still
    // only selects
    if (n === 3) await pg.emulateMedia({ reducedMotion: 'reduce' });
    const tn = await toPodium(pg, 'a tin whistle on a red cord ' + fails + ' (jd2 card test n=' + n + ' ' + Date.now() + ')', 'n' + n, n === 3,
      { instant: n === 3 });
    if (n === 3) await pg.emulateMedia({ reducedMotion: null });
    checkPreview('n=' + n, tn.preview, n, models);
    const I = (tn.drawings[0] || { cards: [] }).cards[0] || {};
    check('n=' + n + ': ' + n + ' drawings of six question cards each, the last grade going on to the ranking',
      tn.drawings.length === n && tn.drawings.every((dr) => dr.cards.length === 6) && tn.drawings[n - 1].after === 'call',
      JSON.stringify(tn.drawings.map((dr) => [dr.slot, dr.cards.length, dr.after])));
    if (n === 3) {
      check('n=3, reduced motion: a tap selects and the card stays — at once and half a second later',
        !!(I.instant && /^Drawing [A-D] · 1 of 6$/.test(I.instant.before) && I.instant.after === I.instant.before &&
          I.instant.later === I.instant.before && I.instant.checked.length === 1), JSON.stringify(I.instant));
    }
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

  // n = 1 (three machines fail) on the phone: no preview, no ranking; six
  // cards; the grade's press files nothing by itself — it brings "file the
  // grades" into view, and that button files
  {
    const pg = page;
    await pg.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
    await openTurn(pg);
    await pg.fill('#jd-turn-prompt', 'a tin whistle [fail:kimi] [fail:google] [fail:openai] (jd2 card test n=1 ' + Date.now() + ')');
    const intake1 = pg.waitForResponse((r) => /\/api\/jd2-intake\.php/.test(r.url()) && r.status() === 200, { timeout: 30000 });
    await pg.click('[data-act="generate"]');
    await pg.waitForSelector('[data-act="rate"]', { timeout: 60000 });
    await intake1.catch(() => {});
    await pg.click('[data-act="rate"]');
    await pg.waitForSelector('.jd-q-opts', { timeout: 10000 });
    await qLogInstall(pg);
    const cards1 = [];
    for (let i = 0; i < 6; i++) {
      const c = await qState(pg);
      cards1.push(c);
      await pg.click('.jd-q-opt:nth-child(1)');
      if (i < 5) {
        await pg.click('.jd-turn-actions [data-act="next"]');
        await qMoved(pg, c.step).catch(() => {});
      }
    }
    await pg.waitForTimeout(800);
    const end1 = await qState(pg);
    await shot(pg, 'n1-grade-file');
    check('n=1: no preview and no ranking — six cards, the first with no back, the grade last',
      cards1.length === 6 && !cards1[0].back && cards1[5].q === 'grade' &&
      (await pg.$$('.jd-rail-step[data-step="preview"], .jd-rail-step[data-step="call"]')).length === 0,
      JSON.stringify(cards1.map((c) => [c.step, c.q, c.back])));
    check('n=1: the grade\'s tap does not file: the card stands, answered, its "file the grades" armed and in view',
      end1.step === cards1[5].step && end1.opts[0].checked === 'true' && end1.go && end1.go.act === 'file' && !end1.go.disabled &&
      end1.go.box.t >= end1.vis.t && end1.go.box.b <= end1.vis.b, JSON.stringify({ step: end1.step, go: end1.go, vis: end1.vis }));
    const b1p = rateBody(pg);
    await pg.click('.jd-turn-actions [data-act="file"]');
    const b1 = await b1p;
    check('n=1: "file the grades" files one drawing\'s six answers, no ranking and no pairs',
      (b1.ratings || []).length === 6 && b1.ranking === null && b1.pairs === null, JSON.stringify({ n: (b1.ratings || []).length, ranking: b1.ranking, pairs: b1.pairs }));
    await pg.waitForSelector('[data-act="done"]', { timeout: 20000 }).catch(() => {});
    await pg.click('[data-act="done"]').catch(() => {});
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
