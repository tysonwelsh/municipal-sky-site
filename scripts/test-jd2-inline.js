#!/usr/bin/env node
// test-jd2-inline.js — the inline parse (2026-10-02) in a real (headless)
// browser. Dev-only: scripts/** is deploy-excluded.
//
//   JD_DEV_MOCK=1 PHP_CLI_SERVER_WORKERS=6 php -S 127.0.0.1:8000 router.php &
//   NODE_PATH=<dir holding playwright> node scripts/test-jd2-inline.js
//
// The fixture passes api/jd-svg-sanitizer.php (checked first, through php) —
// byte-identical until 2026-10-03; since harness v5 the sanitizer strips the
// <desc> from the SERVED drawing (normalized title_desc_stripped), which
// closes this gap server-side too, but a row filed before the strip still
// serves the raw bytes until jd2-resanitize --recheck=ok re-serves it, so
// the client half is tested on the raw text. Inlined with innerHTML, the
// HTML parser opens a <style> at the self-closed <style/> inside <desc> and
// reads the rest as CSS, which can fetch a remote URL. The test inlines it both ways on the drawer page:
//   OLD — innerHTML of JD_svgInst's text (what the drawer did before)
//   NEW — JD_svgSlot + JD_svgMount, and JD_svgNode (what it does now)
// and asserts: OLD makes an HTML <style> in the page and a request to
// example.invalid; NEW makes neither, and the rect still renders. Every
// request that is not loopback is aborted, so nothing leaves the machine.
// Prints one PASS/FAIL line per check; exit 0 iff all pass.
'use strict';
const path = require('path');
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
const ROOT = path.resolve(__dirname, '..');

// the brief's fixture, verbatim. Under innerHTML its swallowed CSS is ONE
// rule whose selector is `<rect width="10" height="10"/><text>x` — invalid,
// so CSS error recovery drops it and Chromium fetches nothing: it proves the
// <style> appears, not the fetch.
const FIXTURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><desc><style/></desc>' +
  '<rect width="10" height="10"/><text>x{background:url(https://example.invalid/pixel)}</text></svg>';
// the ARMED variant: a dummy rule absorbs the junk prelude, then a valid
// `*{…}` rule matches every element, so innerHTML's <style> really fetches.
const ARMED = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><desc><style/></desc>' +
  '<rect width="10" height="10"/><text>x{} *{background:url(https://example.invalid/pixel)}</text></svg>';

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || detail === undefined ? '' : '\n      ' + detail));
  if (!ok) failed++;
}

// 0. the sanitizer's verdict, from the app's own function
function sanitize(svg) {
  return JSON.parse(execFileSync('php', ['-r',
    'require "api/jd-svg-sanitizer.php"; $f = getenv("JD_FX"); $r = jd_sanitize_svg($f); ' +
    'echo json_encode(["ok" => $r["ok"], "reason" => $r["reason"] ?? null, "identical" => ($r["svg"] ?? null) === $f, ' +
    '"normalized" => $r["normalized"] ?? null, "servedDesc" => str_contains($r["svg"] ?? "", "<desc")]);'],
  { cwd: ROOT, env: Object.assign({}, process.env, { JD_FX: svg }), encoding: 'utf8' }));
}
for (const [name, svg] of [['the fixture', FIXTURE], ['the armed variant', ARMED]]) {
  const v = sanitize(svg);
  check(name + ' passes the sanitizer, its <desc> stripped from the served svg (normalized title_desc_stripped: 1; before 2026-10-03 it passed byte-identical — the gap was real)',
    v.ok === true && v.identical === false && v.servedDesc === false && JSON.stringify(v.normalized) === '{"title_desc_stripped":1}', JSON.stringify(v));
}

(async () => {
  const browser = await chromium.launch();
  try {
    // one fresh page per path, so a request or a <style> from one cannot be
    // credited to the other
    async function run(mode, svg) {
      const page = await browser.newPage();
      const offsite = [];
      await page.route('**/*', (route) => {
        const u = route.request().url();
        if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u) || u.startsWith('data:')) return route.continue();
        offsite.push(u);
        return route.abort();
      });
      await page.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
      await page.waitForFunction(() => !!(window.JD_svgInst && window.JD_svgSlot && window.JD_svgMount && window.JD_svgNode));
      const XHTML = 'http://www.w3.org/1999/xhtml';
      const htmlStyles = () => page.evaluate((ns) => Array.prototype.filter.call(document.getElementsByTagName('*'),
        (el) => el.localName === 'style' && el.namespaceURI === ns).length, XHTML);
      const styleBefore = await htmlStyles();
      const out = await page.evaluate(({ svg, mode }) => {
        const host = document.createElement('div');
        host.id = 'jd-inline-probe';
        host.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:100px';
        document.body.appendChild(host);
        if (mode === 'old') {
          host.innerHTML = window.JD_svgInst(svg, 'pp_');
        } else if (mode === 'slot') {
          host.innerHTML = '<div class="holder">' + window.JD_svgSlot(svg, 'pp_') + '</div>';
          window.JD_svgMount(host);
        } else {
          const n = window.JD_svgNode(svg, 'pp_');
          if (n) host.appendChild(n);
        }
        const htmlStyles = Array.prototype.filter.call(host.querySelectorAll('*'),
          (el) => el.localName === 'style' && el.namespaceURI === 'http://www.w3.org/1999/xhtml');
        const rect = host.querySelector('rect');
        let w = 0;
        try { w = rect ? rect.getBBox().width : 0; } catch (e) { w = -1; }
        const svgStyle = Array.prototype.filter.call(host.querySelectorAll('*'),
          (el) => el.localName === 'style' && el.namespaceURI === 'http://www.w3.org/2000/svg')[0];
        return {
          htmlStyleInHost: htmlStyles.length,
          svgStyleText: svgStyle ? svgStyle.textContent : null,
          svgRoot: !!host.querySelector('svg'),
          rectWidth: w,
          slotsLeft: host.querySelectorAll('template[data-jd-svg]').length
        };
      }, { svg, mode });
      out.styleDelta = (await htmlStyles()) - styleBefore;   // XHTML <style> elements, page-wide
      await page.waitForTimeout(800);   // let any CSS-driven fetch go out
      out.exampleInvalid = offsite.filter((u) => u.indexOf('example.invalid') >= 0).length;
      await page.close();
      return out;
    }

    for (const [fx, svg] of [['fixture', FIXTURE], ['armed', ARMED]]) {
      const oldR = await run('old', svg);
      console.log('      OLD (innerHTML), ' + fx + ': ' + JSON.stringify(oldR));
      check('OLD, ' + fx + ': innerHTML puts an HTML <style> element in the page', oldR.htmlStyleInHost > 0 && oldR.styleDelta > 0,
        JSON.stringify(oldR));
      if (fx === 'armed') {
        check('OLD, armed: the page attempts a request to example.invalid', oldR.exampleInvalid > 0, JSON.stringify(oldR));
      } else {
        console.log('      (OLD, fixture: example.invalid requests = ' + oldR.exampleInvalid +
          ' — its swallowed CSS is one invalid-selector rule; see the armed variant)');
      }
      for (const mode of ['slot', 'node']) {
        const r = await run(mode, svg);
        const label = (mode === 'slot' ? 'NEW (JD_svgSlot + JD_svgMount)' : 'NEW (JD_svgNode)') + ', ' + fx;
        console.log('      ' + label + ': ' + JSON.stringify(r));
        check(label + ': no HTML <style> anywhere in the page; the drawing\'s SVG <style/> stays empty',
          r.htmlStyleInHost === 0 && r.styleDelta === 0 && r.svgStyleText === '', JSON.stringify(r));
        check(label + ': no request to example.invalid', r.exampleInvalid === 0, JSON.stringify(r));
        check(label + ': the drawing is mounted and the rect renders (10 wide)', r.svgRoot && r.rectWidth === 10 && r.slotsLeft === 0,
          JSON.stringify(r));
      }
    }

    // a drawing that will not parse leaves its holder empty, no slot behind
    const bad = await (async () => {
      const page = await browser.newPage();
      await page.route('**/*', (route) => (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(route.request().url())
        ? route.continue() : route.abort()));
      await page.goto(BASE + '/art/junk-drawer/', { waitUntil: 'load' });
      await page.waitForFunction(() => !!window.JD_svgMount);
      const r = await page.evaluate(() => {
        const h = document.createElement('div');
        h.innerHTML = '<div class="holder">' + window.JD_svgSlot('<svg xmlns="http://www.w3.org/2000/svg"><g></svg>', 'x_') + '</div>';
        window.JD_svgMount(h);
        return { node: window.JD_svgNode('<svg><rect/></svg>', 'y_') === null, holder: h.querySelector('.holder').innerHTML };
      });
      await page.close();
      return r;
    })();
    check('a drawing that will not parse (or is not SVG-namespaced) mounts nothing', bad.node && bad.holder === '', JSON.stringify(bad));
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed} failed` : '\nall passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
