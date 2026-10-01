#!/usr/bin/env node
// compare.js — diff two jd-regress captures (see README.md).
//
//   node scripts/jd-regress/compare.js <baseline-dir> <candidate-dir> [--report <dir>] [--cross-checkout]
//
// Every artifact is identical / different / missing-in-one, with a one-line
// reason. Exit 0 only when every artifact is identical (which includes "no
// new console errors"); 1 otherwise; 2 on bad usage.
//   shots/*.png      byte-equal, else decoded and counted pixel by pixel
//                    (any differing pixel is a difference — no tolerance);
//                    --report writes <name>.diff.png (red = differs)
//   markup/*.html    normalised text (normalised at capture), diffed per tag
//   styles/*.json    one element per line, diffed per element
//   payloads/*.json  stored RAW; normalised here (lib.normPayload), then
//                    pretty-printed with sorted keys and diffed
//   surface.json, console.json (new errors called out), manifest scene list
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const lib = require('./lib');

function usage(msg) {
  if (msg) console.error('compare.js: ' + msg + '\n');
  console.error('usage: node scripts/jd-regress/compare.js <baseline-dir> <candidate-dir> [--report <dir>] [--cross-checkout]');
  process.exit(2);
}
const argv = process.argv.slice(2);
const pos = [];
let REPORT = null, CROSS = false, MAXLINES = 40;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--report') REPORT = argv[++i];
  else if (argv[i] === '--cross-checkout') CROSS = true;
  else if (argv[i] === '--lines') MAXLINES = +argv[++i] || 40;
  else if (argv[i].startsWith('--')) usage('unknown option ' + argv[i]);
  else pos.push(argv[i]);
}
if (pos.length !== 2) usage();
const A = path.resolve(pos[0]), B = path.resolve(pos[1]);
for (const d of [A, B]) if (!fs.existsSync(path.join(d, 'manifest.json'))) usage(d + ' is not a capture (no manifest.json)');
if (REPORT) { REPORT = path.resolve(REPORT); lib.mkdirp(REPORT); }

const mA = lib.readJSON(path.join(A, 'manifest.json'), {});
const mB = lib.readJSON(path.join(B, 'manifest.json'), {});
// a capture taken with --scenes holds only part of the catalogue: an
// artifact the subset never produced is "not captured", not a failure
const subsetOf = (m) => { const a = m.args || []; const i = a.indexOf('--scenes'); return i >= 0 ? a[i + 1] : null; };
const SUB_A = subsetOf(mA), SUB_B = subsetOf(mB);
const pagesOf = (m) => new Set((m.scenes || []).map((x) => x.page).filter(Boolean));
const PNG = lib.loadPNG();

// the pristine ULIDs, from each side's own pristine payloads (identical when
// both captures started from the same pristine DB — checked below)
function knownIds(dir) {
  const set = new Set();
  const pd = path.join(dir, 'payloads');
  if (fs.existsSync(pd)) {
    for (const f of fs.readdirSync(pd)) if (!f.startsWith('after-') && f.endsWith('.json')) {
      lib.collectUlids(fs.readFileSync(path.join(pd, f), 'utf8'), set);
    }
  }
  return set;
}
const knownA = knownIds(A), knownB = knownIds(B);
const known = new Set([...knownA].filter((u) => knownB.has(u)));

// ---------------------------------------------------------------------------
const results = [];   // { kind, name, status: identical|different|missing-in-baseline|missing-in-candidate, reason, detail }
const notes = [];
function add(kind, name, status, reason, detail) { results.push({ kind, name, status, reason: reason || '', detail: detail || '' }); }

function udiff(aText, bText, label) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jdr-'));
  const fa = path.join(tmp, 'baseline'), fb = path.join(tmp, 'candidate');
  fs.writeFileSync(fa, aText); fs.writeFileSync(fb, bText);
  const r = spawnSync('diff', ['-u', '--label', 'baseline/' + label, '--label', 'candidate/' + label, fa, fb], { encoding: 'utf8', maxBuffer: 1 << 28 });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.error) {
    // no diff(1): first differing line only
    const la = aText.split('\n'), lb = bText.split('\n');
    let i = 0; while (i < la.length && i < lb.length && la[i] === lb[i]) i++;
    return `first difference at line ${i + 1}:\n- ${(la[i] || '').slice(0, 300)}\n+ ${(lb[i] || '').slice(0, 300)}\n`;
  }
  return r.stdout;
}
function truncDiff(d) {
  const lines = d.split('\n').map((l) => (l.length > 400 ? l.slice(0, 400) + ` …(+${l.length - 400} chars)` : l));
  if (lines.length <= MAXLINES) return lines.join('\n');
  return lines.slice(0, MAXLINES).join('\n') + `\n… (${lines.length - MAXLINES} more diff lines; --report writes them all)`;
}
function diffStats(d) {
  let plus = 0, minus = 0;
  for (const l of d.split('\n')) {
    if (l.startsWith('+') && !l.startsWith('+++')) plus++;
    else if (l.startsWith('-') && !l.startsWith('---')) minus++;
  }
  return { plus, minus };
}
function writeReport(rel, text) {
  if (!REPORT) return null;
  const f = path.join(REPORT, rel);
  lib.mkdirp(path.dirname(f));
  fs.writeFileSync(f, text);
  return f;
}

// markup: one tag per line so a diff points at the element, not at a 400 KB line
function markupLines(s) { return s.replace(/></g, '>\n<'); }

function compareText(kind, rel, aText, bText, toLines) {
  if (aText === bText) return add(kind, rel, 'identical');
  const la = toLines ? toLines(aText) : aText, lb = toLines ? toLines(bText) : bText;
  const d = udiff(la, lb, rel);
  const s = diffStats(d);
  writeReport(rel + '.diff', d);
  add(kind, rel, 'different', `${s.minus} line(s) removed, ${s.plus} added`, truncDiff(d));
}

// ---- PNG ------------------------------------------------------------------
function comparePNG(rel) {
  const a = fs.readFileSync(path.join(A, rel)), b = fs.readFileSync(path.join(B, rel));
  if (a.equals(b)) return add('shot', rel, 'identical');
  if (!PNG) return add('shot', rel, 'different', 'PNG bytes differ (no PNG decoder available for a pixel count)');
  let ia, ib;
  try { ia = PNG.sync.read(a); ib = PNG.sync.read(b); } catch (e) { return add('shot', rel, 'different', 'PNG bytes differ and one does not decode: ' + e.message); }
  if (ia.width !== ib.width || ia.height !== ib.height) {
    return add('shot', rel, 'different', `size ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`);
  }
  const w = ia.width, h = ia.height, n = w * h;
  const out = REPORT ? new PNG({ width: w, height: h }) : null;
  let diff = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const same = ia.data[o] === ib.data[o] && ia.data[o + 1] === ib.data[o + 1] &&
      ia.data[o + 2] === ib.data[o + 2] && ia.data[o + 3] === ib.data[o + 3];
    if (!same) {
      diff++;
      const x = i % w, y = (i / w) | 0;
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    if (out) {
      if (same) {
        const g = 255 - ((255 - ((ia.data[o] * 0.3 + ia.data[o + 1] * 0.59 + ia.data[o + 2] * 0.11) | 0)) * 0.25 | 0);
        out.data[o] = out.data[o + 1] = out.data[o + 2] = g; out.data[o + 3] = 255;
      } else {
        out.data[o] = 255; out.data[o + 1] = 0; out.data[o + 2] = 0; out.data[o + 3] = 255;
      }
    }
  }
  if (!diff) return add('shot', rel, 'identical', 'pixel-identical (PNG encodings differ)');
  let f = null;
  if (out) {
    f = path.join(REPORT, rel.replace(/\.png$/, '.diff.png'));
    lib.mkdirp(path.dirname(f));
    fs.writeFileSync(f, PNG.sync.write(out));
  }
  add('shot', rel, 'different', `${diff} of ${n} px differ (${(100 * diff / n).toFixed(3)}%), bbox x${x0} y${y0} ${x1 - x0 + 1}x${y1 - y0 + 1}` +
    (f ? ` — ${path.relative(process.cwd(), f)}` : ''));
}

// ---- styles: count elements whose standard vs custom properties moved -------
function styleSummary(aText, bText) {
  const parse = (t) => { try { return JSON.parse(t).elements || []; } catch (e) { return null; } };
  const ea = parse(aText), eb = parse(bText);
  if (!ea || !eb) return '';
  const ma = new Map(ea.map((e) => [e.at + ' ' + e.el, e])), mb = new Map(eb.map((e) => [e.at + ' ' + e.el, e]));
  let std = 0, vars = 0, only = 0;
  const props = new Map();
  for (const [k, e] of ma) {
    const o = mb.get(k);
    if (!o) { only++; continue; }
    const sa = JSON.stringify(e.style) + JSON.stringify(e.pseudo || {}), sb = JSON.stringify(o.style) + JSON.stringify(o.pseudo || {});
    if (sa === sb) continue;
    const keys = new Set([...Object.keys(e.style), ...Object.keys(o.style)]);
    let s = false, v = false;
    for (const p of keys) if (e.style[p] !== o.style[p]) { if (p.startsWith('--')) v = true; else s = true; props.set(p, (props.get(p) || 0) + 1); }
    if (JSON.stringify(e.pseudo || {}) !== JSON.stringify(o.pseudo || {})) s = true;
    if (s) std++; else if (v) vars++;
  }
  for (const k of mb.keys()) if (!ma.has(k)) only++;
  const top = [...props.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([p, c]) => `${p}×${c}`).join(', ');
  return `${std} element(s) differ in standard properties/pseudo-elements, ${vars} only in custom properties, ${only} present on one side only` + (top ? `; most-changed: ${top}` : '');
}

// ---- payloads ---------------------------------------------------------------
function comparePayload(rel) {
  const name = path.basename(rel, '.json');
  const ra = fs.readFileSync(path.join(A, rel), 'utf8'), rb = fs.readFileSync(path.join(B, rel), 'utf8');
  if (name === 'headers') return compareHeaders(rel, ra, rb);
  const na = lib.normPayload(name, ra, { known, root: mA.root }), nb = lib.normPayload(name, rb, { known, root: mB.root });
  for (const k of ['build', 'generated']) {
    const sa = JSON.stringify(na.stamps[k]), sb = JSON.stringify(nb.stamps[k]);
    if (k === 'build' && sa !== sb) notes.push(`${rel}: tooling build stamp ${sa} -> ${sb} (normalised; moves whenever a file in api/jd-build.php jd_build_files() changes)`);
  }
  if (ra === rb) return add('payload', rel, 'identical');
  // the RAW bytes, with only the normalised fields blanked in place: equal
  // means the bodies differ in nothing but those fields
  const xa = rawNorm(ra, na.stamps, { known, root: mA.root }), xb = rawNorm(rb, nb.stamps, { known, root: mB.root });
  if (xa === xb) return add('payload', rel, 'identical', 'identical after normalisation');
  if (na.text === nb.text) {
    // same JSON value, different bytes: key order, escaping or whitespace
    const d = udiff(xa.replace(/,"/g, ',\n"'), xb.replace(/,"/g, ',\n"'), rel);
    writeReport(rel + '.diff', d);
    return add('payload', rel, 'different', 'the same JSON value, but the bytes differ (key order, escaping, number format or whitespace)', truncDiff(d));
  }
  compareText('payload', rel, na.text, nb.text);
}
// blank exactly the values normPayload blanked, in place, by their literal
// "key":"value" pair (stamp values carry no characters JSON would escape)
function rawNorm(raw, stamps, ctx) {
  let t = raw;
  const blank = (key, val) => {
    if (typeof val !== 'string') return;
    t = t.split(JSON.stringify(key) + ':' + JSON.stringify(val)).join(JSON.stringify(key) + ':"~' + key + '~"');
  };
  blank('generated', stamps.generated);
  if (stamps.build) for (const k of ['version', 'build', 'deployed']) blank(k, stamps.build[k]);
  return lib.normText(t, { known: ctx.known, root: ctx.root, ulidMap: new Map() }, true);
}
function compareHeaders(rel, ra, rb) {
  const ha = JSON.parse(ra), hb = JSON.parse(rb);
  if (CROSS) {
    for (const h of [ha, hb]) for (const k of Object.keys(h)) if (h[k] && h[k].etag) h[k].etag = '~etag (--cross-checkout)~';
    if (mA.root !== mB.root) notes.push('headers.json: ETags not compared (--cross-checkout): data.php hashes absolute paths + mtimes, which differ between checkouts');
  } else if (mA.root !== mB.root) {
    notes.push(`headers.json: the two captures come from different checkouts (${mA.root} vs ${mB.root}); data.php's ETag hashes absolute paths + mtimes and WILL differ — compare captures of the same checkout, or pass --cross-checkout`);
  }
  if (SUB_A || SUB_B) commonKeys(ha, hb);
  const ta = lib.stableStringify(ha), tb = lib.stableStringify(hb);
  if (ta === tb) return add('payload', rel, 'identical');
  compareText('payload', rel, ta, tb);
}
// subset comparison: keep only the top-level keys both sides have
function commonKeys(a, b) {
  for (const k of Object.keys(a)) if (!(k in b)) delete a[k];
  for (const k of Object.keys(b)) if (!(k in a)) delete b[k];
}

// ---- console ----------------------------------------------------------------
function compareConsole() {
  let ca = lib.readJSON(path.join(A, 'console.json'), null), cb = lib.readJSON(path.join(B, 'console.json'), null);
  if (!ca && !cb) return;
  if (!ca || !cb) return add('console', 'console.json', ca ? 'missing-in-candidate' : 'missing-in-baseline');
  if (SUB_A || SUB_B) {
    // only the pages both captures actually opened are comparable
    const both = new Set([...pagesOf(mA)].filter((p) => pagesOf(mB).has(p)));
    ca = ca.filter((e) => both.has(e.page)); cb = cb.filter((e) => both.has(e.page));
  }
  const key = (e) => `[${e.page}] ${e.type}: ${e.text}${e.url ? ' @ ' + e.url : ''}`;
  const count = (list) => { const m = new Map(); for (const e of list) m.set(key(e), (m.get(key(e)) || 0) + 1); return m; };
  const xa = count(ca), xb = count(cb);
  const added = [], removed = [];
  for (const [k, n] of xb) { const d = n - (xa.get(k) || 0); if (d > 0) added.push(d > 1 ? `${k} (×${d})` : k); }
  for (const [k, n] of xa) { const d = n - (xb.get(k) || 0); if (d > 0) removed.push(d > 1 ? `${k} (×${d})` : k); }
  if (!added.length && !removed.length) return add('console', 'console.json', 'identical', `${cb.length} message(s), same as baseline`);
  const detail = (added.length ? 'NEW in candidate:\n' + added.map((s) => '  + ' + s).join('\n') + '\n' : '') +
    (removed.length ? 'gone from candidate:\n' + removed.map((s) => '  - ' + s).join('\n') + '\n' : '');
  writeReport('console.json.diff', detail);
  add('console', 'console.json', 'different', `${added.length} new error/warning(s), ${removed.length} gone`, detail);
}

// ---- run ----------------------------------------------------------------------
function kindOf(rel) {
  if (rel.startsWith('shots/') && rel.endsWith('.png')) return 'shot';
  if (rel.startsWith('markup/')) return 'markup';
  if (rel.startsWith('styles/')) return 'styles';
  if (rel.startsWith('payloads/')) return 'payload';
  if (rel === 'surface.json') return 'surface';
  return null;
}
const filesA = new Set(lib.listFiles(A).filter(kindOf)), filesB = new Set(lib.listFiles(B).filter(kindOf));
const all = [...new Set([...filesA, ...filesB])].sort();
for (const rel of all) {
  const kind = kindOf(rel);
  if (!filesA.has(rel)) { add(kind, rel, SUB_A ? 'not-captured' : 'missing-in-baseline', SUB_A ? 'baseline is a --scenes subset' : ''); continue; }
  if (!filesB.has(rel)) { add(kind, rel, SUB_B ? 'not-captured' : 'missing-in-candidate', SUB_B ? 'candidate is a --scenes subset' : ''); continue; }
  if (kind === 'shot') comparePNG(rel);
  else if (kind === 'payload') comparePayload(rel);
  else {
    const ta = fs.readFileSync(path.join(A, rel), 'utf8'), tb = fs.readFileSync(path.join(B, rel), 'utf8');
    if (kind === 'surface') {
      const sa = JSON.parse(ta), sb = JSON.parse(tb);
      if (SUB_A || SUB_B) commonKeys(sa, sb);
      compareText(kind, rel, lib.stableStringify(sa), lib.stableStringify(sb));
    }
    else if (kind === 'markup') compareText(kind, rel, ta, tb, markupLines);
    else {
      compareText(kind, rel, ta, tb);
      const r = results[results.length - 1];
      if (r.status === 'different') r.reason += ' — ' + styleSummary(ta, tb);
    }
  }
}
compareConsole();

// manifests: scene list, pristine DB, determinism, stamps (informational)
{
  const sa = (mA.scenes || []).map((s) => s.name), sb = (mB.scenes || []).map((s) => s.name);
  const onlyA = sa.filter((n) => !sb.includes(n)), onlyB = sb.filter((n) => !sa.includes(n));
  if (SUB_A || SUB_B) {
    add('manifest', 'manifest.json scenes', 'identical', `subset comparison (--scenes ${SUB_A || '*'} vs ${SUB_B || '*'}): ${sa.filter((n) => sb.includes(n)).length} scenes in common`);
    notes.push(`subset comparison: artifacts only one side captured are reported as not-captured and do not fail the run`);
  } else if (onlyA.length || onlyB.length) {
    add('manifest', 'manifest.json scenes', 'different', `scenes only in baseline: [${onlyA.join(', ')}]; only in candidate: [${onlyB.join(', ')}]`);
  } else add('manifest', 'manifest.json scenes', 'identical', `${sa.length} scenes`);
  const da = mA.determinism || {}, db = mB.determinism || {};
  if (da.pristine_sha256 !== db.pristine_sha256) notes.push('the two captures started from DIFFERENT pristine databases — payload and turn differences may come from that');
  for (const k of ['chromium', 'playwright']) if (da[k] !== db[k]) notes.push(`${k} differs: ${da[k]} vs ${db[k]} — pixel differences may be the browser's`);
  for (const k of Object.keys({ ...(mA.stamps || {}), ...(mB.stamps || {}) })) {
    if ((SUB_A || SUB_B) && (!(k in (mA.stamps || {})) || !(k in (mB.stamps || {})))) continue;
    if ((mA.stamps || {})[k] !== (mB.stamps || {})[k]) notes.push(`build stamp ${k}: "${(mA.stamps || {})[k]}" -> "${(mB.stamps || {})[k]}" (blanked in shots/markup; expected to move when the assets it fingerprints change)`);
  }
  if (mA.error) notes.push('BASELINE capture ended in an error: ' + mA.error);
  if (mB.error) notes.push('CANDIDATE capture ended in an error: ' + mB.error);
  for (const w of (mB.warnings || [])) notes.push('candidate warning: ' + w);
}

// ---- report ---------------------------------------------------------------------
const kinds = ['shot', 'markup', 'styles', 'payload', 'surface', 'console', 'manifest'];
const tally = {};
for (const k of kinds) tally[k] = { identical: 0, different: 0, missing: 0, uncaptured: 0 };
for (const r of results) {
  const t = tally[r.kind];
  if (r.status === 'identical') t.identical++;
  else if (r.status === 'different') t.different++;
  else if (r.status === 'not-captured') t.uncaptured++;
  else t.missing++;
}
let out = '';
const bad = results.filter((r) => r.status !== 'identical' && r.status !== 'not-captured');
for (const r of bad) {
  out += `\n${r.status.toUpperCase().padEnd(20)} ${r.kind.padEnd(8)} ${r.name}${r.reason ? ' — ' + r.reason : ''}\n`;
  if (r.detail) out += r.detail.replace(/^/gm, '    ') + '\n';
}
out += `\nbaseline : ${A}  (${mA.git && mA.git.head ? mA.git.head.slice(0, 10) : '?'}${mA.git && mA.git.dirty && mA.git.dirty.length ? ', dirty' : ''})\n`;
out += `candidate: ${B}  (${mB.git && mB.git.head ? mB.git.head.slice(0, 10) : '?'}${mB.git && mB.git.dirty && mB.git.dirty.length ? ', dirty' : ''})\n\n`;
const anyUncaptured = kinds.some((k) => tally[k].uncaptured);
out += 'kind      identical  different  missing' + (anyUncaptured ? '  not-captured' : '') + '\n';
for (const k of kinds) {
  const t = tally[k];
  if (!t.identical && !t.different && !t.missing && !t.uncaptured) continue;
  out += `${k.padEnd(9)} ${String(t.identical).padStart(9)}  ${String(t.different).padStart(9)}  ${String(t.missing).padStart(7)}` +
    (anyUncaptured ? `  ${String(t.uncaptured).padStart(12)}` : '') + '\n';
}
if (notes.length) out += '\nnotes:\n' + notes.map((n) => '  · ' + n).join('\n') + '\n';
const ok = bad.length === 0;
out += ok ? '\nRESULT: IDENTICAL — every artifact matches.\n' : `\nRESULT: ${bad.length} artifact(s) NOT identical.\n`;
process.stdout.write(out);
if (REPORT) {
  fs.writeFileSync(path.join(REPORT, 'report.txt'), out);
  lib.writeJSON(path.join(REPORT, 'report.json'), { baseline: A, candidate: B, ok, tally, notes, results: results.map(({ detail, ...r }) => r) });
}
process.exit(ok ? 0 : 1);
