#!/usr/bin/env node
// capture.js — THE JUNK DRAWER REGRESSION CAPTURE (Phase 0 of
// art/junk-drawer/REFACTOR-PLAN.md). Dev-only; scripts/** never deploys.
//
//   node scripts/jd-regress/capture.js --root <checkout> --out <dir>
//        [--scenes a,b,c] [--keep-server] [--list]
//
// Serves <checkout> with `JD_DEV_MOCK=1 php -S 127.0.0.1:8000 router.php`,
// drives the real app in headless Chromium through a fixed script of scenes
// and writes, per scene, a screenshot, the normalised markup and the computed
// styles of the surfaces it shows — plus the raw API payloads, the window.JD_*
// surface and every console error. compare.js diffs two such directories.
// README.md (next to this file) is the contract: scenes, normalisations,
// determinism measures, known gaps. Read it before trusting a result.
'use strict';
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawn, spawnSync, execFileSync } = require('child_process');
const lib = require('./lib');

// ---------------------------------------------------------------------------
// fixed facts
const HOME = process.env.JD_REGRESS_HOME || '/home/user/municipal-sky-site';
const LOCK = process.env.JD_REGRESS_LOCK ||
  '/tmp/claude-0/-home-user-municipal-sky-site/73afab42-72a9-574d-bf62-24b22cdb37f2/scratchpad/jd-regress.lock';
const LOCK_WAIT_S = 2700;                       // 45 minutes
const PORT = 8000;                              // api/jd-origin.php admits only :8000
const ORIGIN = 'http://127.0.0.1:' + PORT;
const STATE_DIR = path.join(HOME, 'local-dev', 'jd-regress');
const PRISTINE = path.join(STATE_DIR, 'pristine.sqlite');
const EPOCH = 1790856000;                       // 2026-10-01T12:00:00Z — server AND browser clock
const SEED = 20261001;                          // Math.random / crypto / server CSPRNG seed
const CURATED_ITEM = '2026-07-28-desktop-succulent';   // 5 responses (data.php?item=, report card)
const SINGLE_ITEM = '2026-07-27-crystal-ball';          // the second report card, and the picked specimen
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, mobile: false },
  tablet: { width: 768, height: 1024, mobile: false },
  phone: { width: 390, height: 844, mobile: true },
};
const PROMPTS = {
  desktop: 'a brass doorknob with a worn green patina',
  phone: 'a chipped enamel coffee mug',
  apology: 'a ceramic owl [fail]',             // jd-mock-provider.php: [fail] fails every slot
  api: 'a tin wind-up robot with a key in its back',
};

// ---------------------------------------------------------------------------
// the scene catalogue — name, group, what it shows. Groups run in this order;
// `after` needs the DB writes of `turn`, `turn-phone` and `apology`.
const SCENES = [
  ['payloads', 'payloads', 'raw bodies of data.php (full, slim, ?item=curated), jd-analytics, jd-bench-queue, jd-ledger, jd-inventory, jd-admin-check + headers.json — pristine DB, before any write; always captured'],
  ['drawer-desktop', 'drawer', 'the drawer page at 1440x900 after the pile settles (full page); .jd-pile markup/styles, every artwork walked; surface.json'],
  ['drawer-tablet', 'drawer', 'the drawer page at 768x1024 (full page); .jd-pile'],
  ['drawer-phone', 'drawer', 'the drawer page at 390x844, mobile+touch (full page); .jd-pile'],
  ['notes-desktop', 'drawer', 'the field notes section #notes at 1440 (element shot); #notes'],
  ['notes-phone', 'drawer', 'the field notes section #notes at 390 (element shot); #notes'],
  ['drawer-desktop-motion', 'motion', 'the drawer at 1440 with prefers-reduced-motion: no-preference, after every finite animation has finished (full page); .jd-pile'],
  ['pick-desktop', 'pick', SINGLE_ITEM + ' picked by a real click on its ink: tag + rope + lifted item (viewport)'],
  ['sheet-desktop', 'pick', 'the instructions sheet picked by a click and unfolded (viewport); .jd-item--sheet'],
  ['pick-phone', 'pick', SINGLE_ITEM + ' picked by a tap at 390 (viewport)'],
  ['sheet-phone', 'pick', 'the instructions sheet tapped and unfolded at 390 (viewport)'],
  ['record-single-desktop', 'record', 'report card of ' + SINGLE_ITEM + ' (paged shots of the card scroller); .jd-record'],
  ['record-multi-desktop', 'record', 'report card of ' + CURATED_ITEM + ' (5 responses): alternatives strip, graph paper'],
  ['record-multi-alt-desktop', 'record', 'the same card after pressing the second thumbnail in the alternatives strip'],
  ['record-multi-blueprint-desktop', 'record', 'the same card after the paper button (.rc-paper) swaps to blueprint'],
  ['record-multi-zoom-desktop', 'record', 'the enlargement layer (.jd-record-zoom.is-on) opened from the plate'],
  ['record-multi-phone', 'record', 'report card of ' + CURATED_ITEM + ' at 390 (paged)'],
  ['folder-desktop', 'folder', 'the analytics folder dialog (JD_folder.open()), paged; pristine DB (no turns yet)'],
  ['folder-phone', 'folder', 'the analytics folder at 390, paged'],
  ['admin-strip-desktop', 'admin', 'index.php?admin, key verified (keyless dev): the strip at the viewport foot'],
  ['admin-card-desktop', 'admin', 'index.php?admin with the report card of ' + CURATED_ITEM + ' open in edit mode (grade/axis selects), paged'],
  ['bench-strip-desktop', 'bench', 'index.php?bench with the queue loaded: the strip'],
  ['bench-curate-desktop', 'bench', 'index.php?bench: the first workable item seated in curate mode on the turn card (where the bench resumes it), paged'],
  ['about-desktop', 'about', '/art/junk-drawer/about/ at 1440, initial view (full page); pane + steps'],
  ['about-phone', 'about', '/art/junk-drawer/about/ at 390, initial view (full page)'],
  ['turn-form-desktop', 'turn', 'turn card opened by clicking the PUSH button: data-view=form (the brief)'],
  ['turn-form-filled-desktop', 'turn', 'the brief with the prompt typed'],
  ['turn-darkroom-desktop', 'turn', 'data-view=darkroom, all four generations held in flight (fixed client_ref => fixed indicator deal)'],
  ['turn-darkroom-landed-desktop', 'turn', 'the darkroom after slot A (and the title) landed'],
  ['turn-plates-desktop', 'turn', 'data-view=plates: the four mock drawings'],
  ['turn-bench-a-desktop', 'turn', 'data-view=bench, drawing A, unrated'],
  ['turn-bench-a-def-desktop', 'turn', 'bench A with the first row definition unfolded'],
  ['turn-bench-a-rated-desktop', 'turn', 'bench A with grade + every live axis answered'],
  ['turn-bench-b-desktop', 'turn', 'bench, drawing B, unrated'],
  ['turn-bench-c-desktop', 'turn', 'bench, drawing C, unrated'],
  ['turn-bench-d-desktop', 'turn', 'bench, drawing D, unrated'],
  ['turn-call-desktop', 'turn', 'data-view=call: the empty podium'],
  ['turn-call-ranked-desktop', 'turn', 'the podium with all four placed (C, A, D, B)'],
  ['turn-size-desktop', 'turn', 'data-view=size, nothing chosen'],
  ['turn-size-chosen-desktop', 'turn', 'the size card with Medium chosen'],
  ['turn-said-desktop', 'turn', 'data-view=said: the unveil after jd-rate.php filed'],
  ['won-pile-desktop', 'turn', 'the pile after closing the card: the won drawing dropped in (full page); .jd-pile, every artwork walked'],
  ['won-tag-desktop', 'turn', 'the won item picked by a click: its specimen tag (viewport)'],
  ['won-card-desktop', 'turn', 'JD_record.open(<won generation id>): the won item\'s report card, paged'],
  ['turn-form-phone', 'turn-phone', 'the turn card at 390: the brief'],
  ['turn-darkroom-phone', 'turn-phone', 'darkroom at 390, all four held'],
  ['turn-plates-phone', 'turn-phone', 'plates at 390, paged'],
  ['turn-bench-a-phone', 'turn-phone', 'bench A at 390, rated, paged'],
  ['turn-call-ranked-phone', 'turn-phone', 'podium at 390 with all four placed, paged'],
  ['turn-size-chosen-phone', 'turn-phone', 'size card at 390, Medium chosen, paged'],
  ['turn-said-phone', 'turn-phone', 'unveil at 390, paged'],
  ['turn-apology-desktop', 'apology', 'a turn whose four slots all fail ([fail] mock token): the apology card (data-view=form)'],
  ['drawer-after-desktop', 'after', 'a fresh visitor after the turns: data.php now serves the rated turns (full page); .jd-pile'],
  ['folder-after-desktop', 'after', 'the analytics folder after the turns (turn, cost, grade and axis charts populated), paged'],
  ['folder-after-row-desktop', 'after', 'that folder after pressing the first category row (.fx-row): its readout'],
  ['payloads-after', 'after', 'payloads after the turns: data.php, data.php?item=<won turn>, jd-analytics, jd-bench-queue, jd-ledger, jd-inventory'],
];
const GROUP_ORDER = ['payloads', 'drawer', 'motion', 'pick', 'record', 'folder', 'admin', 'bench', 'about',
  'turn', 'turn-phone', 'apology', 'turn-api', 'after'];
// turn-api writes no artifacts: it files a third rated turn straight through
// the API, because the folder's grade and category charts only plot a model
// once it holds three ratings on visitor turns
const GROUP_NEEDS = { after: ['turn', 'turn-phone', 'apology', 'turn-api'] };

// ---------------------------------------------------------------------------
// CLI
function usage(msg) {
  if (msg) console.error('capture.js: ' + msg + '\n');
  console.error('usage: node scripts/jd-regress/capture.js --root <checkout> --out <dir> [--scenes a,b,c] [--keep-server]\n' +
    '       node scripts/jd-regress/capture.js --list');
  process.exit(2);
}
function parseArgs(argv) {
  const a = { scenes: null, keepServer: false, list: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--root') a.root = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--scenes') a.scenes = argv[++i];
    else if (k === '--keep-server') a.keepServer = true;
    else if (k === '--list') a.list = true;
    else if (k === '-h' || k === '--help') usage();
    else usage('unknown argument ' + k);
  }
  return a;
}
const ARGS = parseArgs(process.argv.slice(2));
if (ARGS.list) {
  for (const [n, g, d] of SCENES) console.log(n.padEnd(32) + g.padEnd(12) + d);
  process.exit(0);
}
if (!ARGS.root || !ARGS.out) usage('--root and --out are required');
const ROOT = path.resolve(ARGS.root);
const OUT = path.resolve(ARGS.out);
if (!fs.existsSync(path.join(ROOT, 'router.php')) || !fs.existsSync(path.join(ROOT, 'art', 'junk-drawer', 'index.php'))) {
  usage(ROOT + ' does not look like a municipal-sky-site checkout (no router.php / art/junk-drawer/index.php)');
}

// scene selection: exact names, group names, or globs with *
function makeSelector(spec) {
  if (!spec) return () => true;
  const pats = spec.split(',').map((s) => s.trim()).filter(Boolean).map((p) =>
    new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));
  return (name, group) => pats.some((re) => re.test(name) || re.test(group));
}
const SELECTED = makeSelector(ARGS.scenes);
if (ARGS.scenes) {
  const hit = SCENES.filter(([n, g]) => SELECTED(n, g));
  if (!hit.length) usage('--scenes matched nothing (see --list)');
}

// ---------------------------------------------------------------------------
// THE LOCK. Port 8000 is shared by every checkout and worktree on this
// machine, so the whole start-server → capture → stop-server span runs under
// flock(1). The script re-executes itself under flock; JD_REGRESS_LOCKED marks
// the inner run.
if (process.env.JD_REGRESS_LOCKED !== '1') {
  lib.mkdirp(path.dirname(LOCK));
  console.error(`[jd-regress] taking the port-${PORT} lock ${LOCK} (waits up to ${LOCK_WAIT_S / 60} min)…`);
  const r = spawnSync('flock', ['-w', String(LOCK_WAIT_S), '-E', '75', LOCK,
    process.execPath, __filename, ...process.argv.slice(2)], {
    stdio: 'inherit', env: { ...process.env, JD_REGRESS_LOCKED: '1' },
  });
  if (r.error) { console.error('[jd-regress] could not run flock: ' + r.error.message); process.exit(1); }
  if (r.status === 75) { console.error(`[jd-regress] gave up waiting ${LOCK_WAIT_S}s for ${LOCK}`); process.exit(75); }
  process.exit(r.status == null ? 1 : r.status);
}

// ---------------------------------------------------------------------------
// everything below runs holding the lock
const log = (...m) => console.error('[jd-regress]', ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
let server = null;
let browser = null;
let serverLog = '';

function killServer() {
  if (server && server.exitCode == null && !server.killed) {
    try { server.kill('SIGKILL'); } catch (e) {}
  }
}
process.on('exit', killServer);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { log('caught ' + sig + ', stopping the server'); killServer(); process.exit(130); });
}

function portBusy() {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port: PORT });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
    s.setTimeout(1000, () => { s.destroy(); resolve(true); });
  });
}
function whoHasPort() {
  const tries = [['ss', ['-ltnp', `sport = :${PORT}`]], ['lsof', ['-nP', `-iTCP:${PORT}`, '-sTCP:LISTEN']], ['fuser', ['-v', `${PORT}/tcp`]]];
  for (const [cmd, args] of tries) {
    try {
      const r = spawnSync(cmd, args, { encoding: 'utf8' });
      const out = ((r.stdout || '') + (r.stderr || '')).trim();
      if (!r.error && out) return out;
    } catch (e) {}
  }
  return '(could not identify the listener: no ss/lsof/fuser output)';
}

// the faketime shim (faketime.c), compiled once per source hash
function buildShim() {
  const src = path.join(__dirname, 'faketime.c');
  const hash = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex').slice(0, 12);
  const dir = path.join(STATE_DIR, 'bin');
  const so = path.join(dir, 'jd-faketime-' + hash + '.so');
  if (fs.existsSync(so)) return so;
  lib.mkdirp(dir);
  const cc = ['cc', 'gcc', 'clang'].find((c) => spawnSync('which', [c]).status === 0);
  if (!cc) throw new Error('no C compiler (cc/gcc/clang) to build faketime.c — the server clock cannot be frozen');
  const tmp = so + '.' + process.pid;
  execFileSync(cc, ['-shared', '-fPIC', '-O2', '-o', tmp, src, '-ldl']);
  fs.renameSync(tmp, so);
  return so;
}

function sha256File(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }

// the database every capture starts from
function preparePristine() {
  lib.mkdirp(STATE_DIR);
  if (!fs.existsSync(PRISTINE)) {
    const src = path.join(HOME, 'local-dev', 'jd-dev.sqlite');
    if (!fs.existsSync(src)) {
      throw new Error('no pristine DB and no ' + src + ' to make one from. In ' + HOME + ' run:\n' +
        '  JD_DEV_MOCK=1 php api/setup-jd-tables.php && JD_DEV_MOCK=1 php api/jd-backfill-curated.php');
    }
    fs.copyFileSync(src, PRISTINE);
    log('created the pristine DB ' + PRISTINE + ' from ' + src);
  }
  const ld = path.join(ROOT, 'local-dev');
  lib.mkdirp(ld);
  const dst = path.join(ld, 'jd-dev.sqlite');
  for (const ext of ['', '-wal', '-shm', '-journal']) { try { fs.unlinkSync(dst + ext); } catch (e) {} }
  fs.copyFileSync(PRISTINE, dst);
  // the mock provider's fixtures (api/jd-mock-provider.php reads
  // local-dev/jd-mock/*.svg; nothing in git carries them)
  const fx = path.join(__dirname, 'fixtures', 'jd-mock');
  const fd = path.join(ld, 'jd-mock');
  lib.mkdirp(fd);
  for (const f of fs.readdirSync(fx)) fs.copyFileSync(path.join(fx, f), path.join(fd, f));
  return sha256File(PRISTINE);
}

// one server per group, its CSPRNG seeded from the group's name: a group's
// minted ids never depend on which groups ran before it (so a --scenes subset
// mints exactly what a full run mints), and two groups never mint the same id
function seedFor(group) {
  let h = 2166136261;
  for (const ch of group) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return String(SEED * 1000 + (h % 1000));
}
function stopServer() {
  return new Promise((resolve) => {
    if (!server || server.exitCode != null) { server = null; return resolve(); }
    const s = server;
    s.once('exit', () => resolve());
    try { s.kill('SIGTERM'); } catch (e) { resolve(); }
    setTimeout(() => { try { s.kill('SIGKILL'); } catch (e) {} }, 2000);
  }).then(async () => {
    server = null;
    for (let i = 0; i < 50 && await portBusy(); i++) await sleep(100);
  });
}
async function startServer(shim, seed) {
  if (await portBusy()) {
    throw new Error(`port ${PORT} is already in use — another server is running outside the lock.\n` +
      whoHasPort() + '\nStop it (it is not ours to kill) and run again.');
  }
  const env = { ...process.env, JD_DEV_MOCK: '1', JD_DEV_LATENCY_MS: '1',
    JD_REGRESS_EPOCH: String(EPOCH), JD_REGRESS_SEED: seed };
  delete env.PHP_CLI_SERVER_WORKERS;            // one worker: requests are served in arrival order
  delete env.JD_REGRESS_LOCKED;
  if (shim) env.LD_PRELOAD = shim;
  server = spawn('php', ['-S', '127.0.0.1:' + PORT, 'router.php'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  serverLog += `---- php -S (seed ${seed}) ----\n`;
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode != null) throw new Error('php -S exited at start:\n' + serverLog);
    if (await portBusy()) return;
    await sleep(100);
  }
  throw new Error('php -S did not start listening on ' + PORT + '\n' + serverLog);
}

// ---------------------------------------------------------------------------
// output
const DIRS = ['shots', 'markup', 'styles', 'payloads'];
function prepareOut() {
  if (fs.existsSync(OUT)) {
    const ents = fs.readdirSync(OUT);
    if (ents.length && !ents.includes('manifest.json')) {
      throw new Error(OUT + ' exists, is not empty and is not a previous capture — refusing to write into it');
    }
    for (const d of DIRS) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
    for (const f of ['manifest.json', 'surface.json', 'console.json', 'server.log']) fs.rmSync(path.join(OUT, f), { force: true });
  }
  for (const d of DIRS) lib.mkdirp(path.join(OUT, d));
}

const manifest = {
  harness: lib.HARNESS_VERSION,
  root: ROOT,
  git: {},
  started: new Date().toISOString(),
  args: process.argv.slice(2),
  determinism: {},
  stamps: {},
  scenes: [],
  skipped: [],
  warnings: [],
  normalisations: [
    'markup/styles/console: ?v=<8 hex> cache tokens -> ?v=~v~',
    'markup/styles/console: ?t=<epoch ms> cache busters -> ?t=~t~',
    'markup/styles/console: ISO-8601 date-times (YYYY-MM-DDThh:mm:ss…) -> ~iso-time~',
    'all text: the checkout path -> <ROOT>',
    'all text: ULIDs not present in the pristine payloads -> ~ulid-N~ (numbered by first appearance within each file)',
    'DOM before every capture: text of .jd-build and .jd-bench-build (build stamps) -> runs of ■■■ (raw values kept in manifest.stamps)',
    'payloads (compare-time only; stored raw): top-level "generated"; tooling build stamp build.{version,build,deployed} / build+version strings',
    'styles: the `d` property (SVG path data) is omitted — it mirrors the d attribute captured in markup/',
  ],
};
const consoleLog = [];
const blockedOrigins = new Set();
const surface = {};
let knownUlids = new Set();
const pageState = new WeakMap();

function ctxFor() { return { known: knownUlids, root: ROOT, ulidMap: new Map() }; }

// Chromium flags. --disable-partial-raster is the one that matters most:
// with partial raster on, a tile that was re-rastered piecemeal while
// something animated (the report card's filmstrip parks 800+ paused Web
// Animations) keeps anti-aliasing that depends on the paint history, and two
// runs of the same card differed by 1–15 levels along filtered strokes. The
// rest pin the raster/compositor pipeline to one deterministic path.
const CHROME_ARGS = ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none',
  '--disable-lcd-text', '--disable-partial-raster', '--num-raster-threads=1', '--disable-gpu',
  '--disable-gpu-rasterization', '--run-all-compositor-stages-before-draw', '--disable-threaded-animation'];

// ---------------------------------------------------------------------------
// the init script: runs in every frame before any page script
// seeds are per PAGE LABEL: every context is a fresh visitor, and two
// visitors must not share a device code or a turn's client_ref (the server
// would fold the second turn into the first)
function labelSeed(label) {
  let h = 2166136261;
  for (const ch of label) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function initScript(label) {
  const k = labelSeed(label);
  return `(() => {
  // seeded Math.random (xorshift32), crypto.getRandomValues / randomUUID from
  // a second fixed stream, and a clock that starts at the fixed epoch and
  // then runs in real time (timers and performance.now are untouched)
  var s = ${((SEED ^ k) >>> 0) || 1} >>> 0, c = ${(((SEED * 7 + 13) ^ (k * 31)) >>> 0) || 7} >>> 0;
  function x32(v) { v ^= v << 13; v >>>= 0; v ^= v >>> 17; v ^= v << 5; return v >>> 0; }
  Math.random = function random() { s = x32(s); return s / 4294967296; };
  function nextByte() { c = x32(c); return c & 255; }
  try {
    var C = window.crypto;
    C.getRandomValues = function getRandomValues(a) {
      var u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      for (var i = 0; i < u.length; i++) u[i] = nextByte();
      return a;
    };
    C.randomUUID = function randomUUID() {
      var b = new Uint8Array(16); C.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
      var h = Array.prototype.map.call(b, function (x) { return (x + 0x100).toString(16).slice(1); }).join('');
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    };
  } catch (e) {}
  var RealDate = Date, offset = ${EPOCH * 1000} - RealDate.now();
  function FakeDate(a, b, cc, d, e, f, g) {
    var n = arguments.length;
    if (!(this instanceof FakeDate)) return new RealDate(RealDate.now() + offset).toString();
    if (n === 0) return new RealDate(RealDate.now() + offset);
    if (n === 1) return new RealDate(a);
    return new RealDate(a, b, n > 2 ? cc : 1, n > 3 ? d : 0, n > 4 ? e : 0, n > 5 ? f : 0, n > 6 ? g : 0);
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = function now() { return RealDate.now() + offset; };
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  window.Date = FakeDate;
  // counts resize events (a full-page screenshot fires one) for manifest.json
  window.__jdrResizes = 0;
  window.addEventListener('resize', function () { window.__jdrResizes++; });
})();`;
}

const FURNITURE_ART = /\/art\/junk-drawer\/(turn-object|instructions-object|analytics-folder)\.svg$/;

async function newPage(label, vpName, opts = {}) {
  const vp = VIEWPORTS[vpName];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    reducedMotion: opts.motion || 'reduce',
    colorScheme: 'light',
    forcedColors: 'none',
    locale: 'en-US',
    timezoneId: 'UTC',
    serviceWorkers: 'block',
    acceptDownloads: false,
  });
  await context.addInitScript({ content: initScript(label) });
  const page = await context.newPage();
  const st = { label, vp: vpName, inflight: new Map(), heldReqs: new Set(), held: [], holds: [], dcl: false, artInflight: 0, blocked: new Set() };
  pageState.set(page, st);
  await context.route('**/*', async (route) => {
    const req = route.request();
    let url;
    try { url = new URL(req.url()); } catch (e) { return route.abort(); }
    if (url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
    if (url.hostname !== '127.0.0.1' || url.port !== String(PORT)) {
      // fonts.googleapis.com et al: never fetched, so text renders in the
      // same fallback fonts on every run
      st.blocked.add(url.origin);
      blockedOrigins.add(url.origin);
      return route.abort();
    }
    for (const h of st.holds) {
      if (h.test(url, req)) {
        const item = { route, req, url, tag: h.tag };
        st.held.push(item);
        st.heldReqs.add(req);
        return;
      }
    }
    // ?bench: the queue answers only once the pile (and its furniture) has
    // been laid — curate mode shuffles the seated responses with
    // Math.random, and that draw must come after the scatter's, every run
    if (url.pathname === '/api/jd-bench-queue.php') {
      let resp;
      try { resp = await route.fetch(); } catch (e) { return route.abort(); }
      const ok = await page.waitForFunction(() => !!document.querySelector('.jd-pile .jd-item--folder') &&
        !!document.querySelector('.jd-pile .jd-item--sheet'), null, { timeout: 30000, polling: 50 }).then(() => true, () => false);
      if (!ok) manifest.warnings.push(`[${label}] the pile never finished before the bench queue was answered`);
      return route.fulfill({ response: resp });
    }
    // data.php waits for the furniture artwork already requested, so the
    // pile loader always finds the turn button / sheet / folder art in hand
    // (their seats draw from Math.random — arrival order must not vary)
    if (url.pathname === '/art/junk-drawer/data.php' && req.resourceType() === 'fetch') {
      let resp;
      try { resp = await route.fetch(); } catch (e) { return route.abort(); }
      for (let i = 0; i < 400 && (!st.dcl || st.artInflight > 0); i++) await sleep(25);
      return route.fulfill({ response: resp });
    }
    return route.continue();
  });
  page.on('request', (r) => {
    st.inflight.set(r, Date.now());
    if (FURNITURE_ART.test(new URL(r.url()).pathname)) st.artInflight++;
  });
  const done = (r) => {
    st.inflight.delete(r);
    try { if (FURNITURE_ART.test(new URL(r.url()).pathname)) st.artInflight--; } catch (e) {}
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  page.on('domcontentloaded', () => { st.dcl = true; });
  page.on('console', (m) => {
    const t = m.type();
    if (t !== 'error' && t !== 'warning') return;
    const loc = m.location() || {};
    consoleLog.push({ page: label, type: t, text: lib.normText(m.text(), ctxFor()),
      url: loc.url ? lib.normText(loc.url, ctxFor()) : '' });
  });
  page.on('pageerror', (e) => {
    consoleLog.push({ page: label, type: 'pageerror', text: lib.normText(String(e && e.stack || e), ctxFor()), url: '' });
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  return { context, page, st };
}

async function goto(page, p) {
  const st = pageState.get(page);
  st.dcl = false;
  await page.goto(ORIGIN + p, { waitUntil: 'load', timeout: 60000 });
}

// ---------------------------------------------------------------------------
// SETTLING: network idle (held requests excepted), webfonts, every finite
// animation finished, no DOM mutation for `quiet` ms, two frames.
async function netIdle(page, quietMs, timeout) {
  const st = pageState.get(page);
  const end = Date.now() + timeout;
  let since = Date.now();
  const busy = () => [...st.inflight.keys()].filter((r) => !st.heldReqs.has(r));
  while (Date.now() < end) {
    if (busy().length) since = Date.now();
    else if (Date.now() - since >= quietMs) return true;
    await sleep(25);
  }
  const pend = busy().map((r) => r.method() + ' ' + r.url()).join(', ');
  throw new Error(`[${st.label}] network never went idle: ${pend}`);
}
async function settle(page, opts = {}) {
  const quiet = opts.quiet || 400;
  const timeout = opts.timeout || 30000;
  await netIdle(page, opts.netQuiet || 300, timeout);
  const res = await page.evaluate(async ({ quiet, timeout }) => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    if (!window.__jdrMO) {
      window.__jdrLast = performance.now();
      window.__jdrMO = new MutationObserver(function () { window.__jdrLast = performance.now(); });
      window.__jdrMO.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    }
    const end = performance.now() + timeout;
    let ok = false, running = [];
    while (performance.now() < end) {
      running = document.getAnimations().filter(function (a) {
        if (a.playState !== 'running') return false;
        const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
        return !!t && isFinite(t.endTime);
      });
      if (!running.length && performance.now() - window.__jdrLast >= quiet) { ok = true; break; }
      await new Promise(function (r) { setTimeout(r, 40); });
    }
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
    return { ok, running: running.map(function (a) { return a.animationName || (a.effect && a.effect.target && a.effect.target.className) || 'anim'; }).slice(0, 5) };
  }, { quiet, timeout });
  await netIdle(page, 200, timeout);
  if (!res.ok) {
    const st = pageState.get(page);
    manifest.warnings.push(`[${st.label}] settle timed out (animations: ${JSON.stringify(res.running)})`);
  }
  return res.ok;
}

// ---------------------------------------------------------------------------
// CAPTURE
function sceneMeta(name) {
  const s = SCENES.find(([n]) => n === name);
  if (!s) throw new Error('scene not in the catalogue: ' + name);
  return s;
}
async function blankStamps(page) {
  return page.evaluate(() => {
    const raw = [];
    document.querySelectorAll('.jd-build, .jd-bench-build').forEach(function (el) {
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      if (text.indexOf('\u25a0') < 0) raw.push({ cls: el.className, text: text });
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const ts = [];
      while (w.nextNode()) ts.push(w.currentNode);
      ts.forEach(function (t) {
        const v = t.nodeValue.replace(/[^\s·■]+/g, '■■■');
        if (v !== t.nodeValue) t.nodeValue = v;
      });
    });
    return raw;
  });
}

// the outerHTML of every match of each selector, normalised
async function markupOf(page, selectors) {
  const parts = await page.evaluate((sels) => sels.map(function (s) {
    const els = Array.prototype.slice.call(document.querySelectorAll(s));
    return { sel: s, html: els.map(function (e) { return e.outerHTML; }) };
  }), selectors);
  const ctx = ctxFor();
  let out = '';
  for (const p of parts) {
    if (!p.html.length) { out += `<!-- jd-regress surface ${p.sel}: NO MATCH -->\n`; continue; }
    p.html.forEach((h, i) => {
      out += `<!-- jd-regress surface ${p.sel} [${i + 1}/${p.html.length}] -->\n` + lib.normText(h, ctx) + '\n';
    });
  }
  return out;
}

// every element of each surface in document order: the root's full computed
// style, then each element's DIFFERENCE from its parent's computed style
// (null = the parent has the property, the element doesn't — never happens
// for standard properties). full(el) = full(parent) + delta(el), so the file
// pins every property of every element while staying readable. Pseudo-
// elements (::before/::after when generated, ::marker on list items,
// ::placeholder on fields) are stored as deltas from their element.
// ARTWORK. An inlined drawing (an <svg> with >= ART_MIN descendant elements)
// is walked in full only where the scene says `artwork: 'all'` (the pile
// scenes); elsewhere ('first') only the FIRST drawing per holder context
// (its parent's class list) is walked in full and every later one records
// its root <svg> plus `"art": <n>` — the number of descendants not walked.
// The drawing's own bytes are in markup/ and its pixels in shots/; the walk
// that is kept per context is what pins rules that reach inside artwork
// (e.g. `.jd-item svg * { pointer-events: visiblePainted }`).
const ART_MIN = 25;
async function stylesOf(page, selectors, artwork) {
  const res = await page.evaluate(({ sels, artwork, ART_MIN }) => {
    const OMIT = { d: 1 };
    const walkedCtx = {};
    function artCount(el) {
      if (el.localName !== 'svg' || (el.parentElement && el.parentElement.closest('svg'))) return 0;
      const n = el.getElementsByTagName('*').length;
      return n >= ART_MIN ? n : 0;
    }
    function snap(cs) {
      const o = {};
      for (let i = 0; i < cs.length; i++) {
        const n = cs[i];
        if (OMIT[n]) continue;
        o[n] = cs.getPropertyValue(n);
      }
      return o;
    }
    // keys sorted: Chromium enumerates custom properties in an order that
    // varies run to run
    function delta(cur, base) {
      const keys = Object.keys(cur);
      for (const k in base) if (!(k in cur)) keys.push(k);
      keys.sort();
      const d = {};
      for (const k of keys) {
        if (!(k in cur)) d[k] = null;
        else if (cur[k] !== base[k]) d[k] = cur[k];
      }
      return d;
    }
    function label(el) {
      let s = el.localName;
      if (el.id) s += '#' + el.id;
      const c = el.getAttribute('class');
      if (c) s += '.' + c.trim().split(/\s+/).join('.');
      return s;
    }
    const out = [];
    const surfaces = [];
    sels.forEach(function (sel, si) {
      const roots = Array.prototype.slice.call(document.querySelectorAll(sel));
      surfaces.push({ selector: sel, count: roots.length });
      roots.forEach(function (root, ri) {
        (function walk(el, base, p) {
          const cs = getComputedStyle(el);
          const s = snap(cs);
          const rec = { at: si + ':' + ri + ':' + p, el: label(el), style: delta(s, base) };
          const ps = {};
          ['::before', '::after'].forEach(function (pe) {
            const pcs = getComputedStyle(el, pe);
            const content = pcs.getPropertyValue('content');
            if (content && content !== 'none' && content !== 'normal') ps[pe] = delta(snap(pcs), s);
          });
          if (s.display === 'list-item') ps['::marker'] = delta(snap(getComputedStyle(el, '::marker')), s);
          if ((el.localName === 'input' || el.localName === 'textarea') && el.hasAttribute('placeholder')) {
            ps['::placeholder'] = delta(snap(getComputedStyle(el, '::placeholder')), s);
          }
          if (Object.keys(ps).length) rec.pseudo = ps;
          out.push(rec);
          const art = artwork === 'all' ? 0 : artCount(el);
          if (art) {
            const pc = el.parentElement ? (el.parentElement.getAttribute('class') || el.parentElement.localName) : '';
            const ctx = pc.trim().split(/\s+/).sort().join('.') + '>' + (el.getAttribute('class') || '');
            if (walkedCtx[ctx]) { rec.art = art; return; }
            walkedCtx[ctx] = true;
          }
          const kids = el.children;
          for (let i = 0; i < kids.length; i++) walk(kids[i], s, p + '.' + i);
        })(root, {}, '0');
      });
    });
    return { surfaces, elements: out };
  }, { sels: selectors, artwork: artwork || 'first', ART_MIN });
  const ctx = ctxFor();
  const lines = res.elements.map((e) => lib.normText(JSON.stringify(e), ctx));
  return '{"surfaces":' + JSON.stringify(res.surfaces) + ',"elements":[\n' + lines.join(',\n') + '\n]}\n';
}

// the scroller a dialog's content lives in (null: the document scrolls)
async function scrollerHandle(page, sel) {
  const h = await page.evaluateHandle((sel) => {
    let el = document.querySelector(sel);
    while (el && el !== document.body) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return el;
      el = el.parentElement;
    }
    return null;
  }, sel);
  const el = h.asElement();
  if (!el) { await h.dispose(); return null; }
  return el;
}

const MAX_PAGES = 8;
async function shoot(page, name, shot) {
  const files = [];
  const base = path.join(OUT, 'shots', name);
  const opts = { animations: 'disabled', caret: 'hide', scale: 'css', timeout: 60000 };
  if (shot === 'full' || shot === 'viewport') {
    await page.screenshot({ ...opts, path: base + '.png', fullPage: shot === 'full' });
    files.push('shots/' + name + '.png');
  } else if (shot && shot.element) {
    // an element that fits the viewport is shot as a viewport clip (no
    // resize event); a taller one falls back to Playwright's element shot
    const el = await page.$(shot.element);
    if (!el) throw new Error(`[${name}] no element ${shot.element} to shoot`);
    await el.scrollIntoViewIfNeeded();
    await settle(page, { quiet: 200, netQuiet: 150 });
    const box = await el.boundingBox();
    const vp = page.viewportSize();
    if (box && box.y >= 0 && box.x >= 0 && box.y + box.height <= vp.height && box.x + box.width <= vp.width) {
      await page.screenshot({ ...opts, path: base + '.png', clip: box });
    } else {
      await el.screenshot({ ...opts, path: base + '.png' });
    }
    files.push('shots/' + name + '.png');
  } else if (shot && shot.scroller) {
    const sc = await scrollerHandle(page, shot.scroller);
    if (!sc) {
      await page.screenshot({ ...opts, path: base + '.png', fullPage: false });
      files.push('shots/' + name + '.png');
    } else {
      const info = await sc.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, st: el.scrollTop }));
      const n = Math.min(MAX_PAGES, Math.max(1, Math.ceil(info.sh / info.ch)));
      if (Math.ceil(info.sh / info.ch) > MAX_PAGES) manifest.warnings.push(`[${name}] scroller taller than ${MAX_PAGES} pages; later pages not shot`);
      for (let k = 0; k < n; k++) {
        await sc.evaluate((el, y) => { el.scrollTop = y; }, Math.min(k * info.ch, info.sh - info.ch));
        await settle(page, { quiet: 250, netQuiet: 150 });
        const f = k ? name + '@' + (k + 1) : name;
        await page.screenshot({ ...opts, path: path.join(OUT, 'shots', f + '.png'), fullPage: false });
        files.push('shots/' + f + '.png');
      }
      await sc.evaluate((el, y) => { el.scrollTop = y; }, info.st);
      await settle(page, { quiet: 250, netQuiet: 150 });
      await sc.dispose();
    }
  }
  return files;
}

async function capture(page, name, spec) {
  const [, group] = sceneMeta(name);
  if (!SELECTED(name, group)) return false;
  const t = Date.now();
  const split = {};
  let lap = Date.now();
  const mark = (k) => { split[k] = Date.now() - lap; lap = Date.now(); };
  await park(page);
  await settle(page, spec.settle || {});
  mark('settle');
  // infinite animations (the PUSH button's pulse when motion is allowed) are
  // cancelled for the whole capture and restarted after it — the same thing
  // Playwright's screenshot({animations:'disabled'}) does — so markup, styles
  // and pixels all read the un-animated state
  const frozen = await page.evaluate(() => {
    const list = document.getAnimations().filter(function (a) {
      const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
      return t && t.iterations === Infinity && a.playState !== 'idle';
    });
    list.forEach(function (a) { a.cancel(); });
    window.__jdrFrozen = list;
    return list.length;
  });
  if (frozen) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const raw = await blankStamps(page);
  for (const r of raw) {
    const key = r.cls.indexOf('jd-bench-build') >= 0 ? 'tooling_strip' : 'drawer_colophon';
    if (!(key in manifest.stamps)) manifest.stamps[key] = r.text;
  }
  // markup and styles FIRST: a full-page (or taller-than-viewport) screenshot
  // fires a window `resize`, and the drawer answers resize (it drops the
  // specimen tag, re-seats furniture) — the DOM is read before any shot
  const files = [];
  if (spec.surfaces && spec.surfaces.length) {
    fs.writeFileSync(path.join(OUT, 'markup', name + '.html'), await markupOf(page, spec.surfaces));
    files.push('markup/' + name + '.html');
    mark('markup');
    if (spec.styles !== false) {
      fs.writeFileSync(path.join(OUT, 'styles', name + '.json'), await stylesOf(page, spec.surfaces, spec.artwork));
      files.push('styles/' + name + '.json');
      mark('styles');
    }
  }
  const r0 = await page.evaluate(() => window.__jdrResizes || 0);
  if (spec.shot) files.push(...await shoot(page, name, spec.shot));
  mark('shot');
  const resizes = (await page.evaluate(() => window.__jdrResizes || 0)) - r0;
  if (frozen) await page.evaluate(() => { (window.__jdrFrozen || []).forEach(function (a) { try { a.play(); } catch (e) {} }); window.__jdrFrozen = null; });
  const st = pageState.get(page);
  manifest.scenes.push({ name, group, viewport: st.vp, page: st.label, surfaces: spec.surfaces || [], files, ms: Date.now() - t, split,
    shot: spec.shot || null, resize_events_from_shot: resizes, infinite_animations_frozen: frozen });
  log(`  ${name} (${files.length} files, ${((Date.now() - t) / 1000).toFixed(1)}s: ${Object.entries(split).map(([k, v]) => k + ' ' + (v / 1000).toFixed(1)).join(', ')})`);
  return true;
}

// ---------------------------------------------------------------------------
// interaction helpers
// the mouse goes to the page's top-left corner (the site banner) so no
// :hover state lingers into a capture; on the phone only once the mouse has
// actually been used there
async function park(page) {
  const st = pageState.get(page);
  if (!VIEWPORTS[st.vp].mobile || st.mouseUsed) await page.mouse.move(1, 1);
}
// a point on the element's own painted ink (elementFromPoint lands inside it),
// nearest the centre, after scrolling it into view
async function inkPoint(page, sel) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const N = 31, pts = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      pts.push([r.left + r.width * (i + 0.5) / N, r.top + r.height * (j + 0.5) / N]);
    }
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    pts.sort(function (a, b) {
      return (Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy)) || (a[0] - b[0]) || (a[1] - b[1]);
    });
    for (let k = 0; k < pts.length; k++) {
      const x = Math.round(pts[k][0]), y = Math.round(pts[k][1]);
      if (x < 1 || y < 1 || x >= innerWidth - 1 || y >= innerHeight - 1) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) return { x, y };
    }
    return null;
  }, sel);
}
async function press(page, sel, what) {
  const st = pageState.get(page);
  await settle(page, { quiet: 200 });
  const p = await inkPoint(page, sel);
  if (!p) throw new Error(`[${st.label}] nothing of ${sel} is hittable${what ? ' (' + what + ')' : ''}`);
  if (VIEWPORTS[st.vp].mobile) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  return p;
}
// a press on a control: a tap on the phone, a mouse click elsewhere.
// { mouse: true } forces the mouse — the podium on the phone, where a tap's
// trailing click lands on whatever the re-seat slid under the finger (see
// README, "Known gaps")
async function click(page, sel, opts = {}) {
  const st = pageState.get(page);
  const loc = page.locator(sel).first();
  if (VIEWPORTS[st.vp].mobile && !opts.mouse) await loc.tap({ timeout: 15000 });
  else { st.mouseUsed = true; await loc.click({ timeout: 15000 }); }
}
async function waitFor(page, fn, arg, what, timeout = 30000) {
  try {
    await page.waitForFunction(fn, arg, { timeout, polling: 50 });
  } catch (e) {
    throw new Error(`[${pageState.get(page).label}] timed out waiting for ${what}`);
  }
}
async function pileReady(page) {
  await waitFor(page, () => {
    const n = document.querySelectorAll('.jd-pile .jd-item').length;
    const t = performance.now();
    if (window.__jdrN !== n) { window.__jdrN = n; window.__jdrT = t; return false; }
    return n > 0 && t - window.__jdrT > 800 &&
      !!document.querySelector('.jd-pile .jd-item--turn');
  }, null, 'the pile to load', 60000);
}

// ---------------------------------------------------------------------------
// PAYLOADS (Node fetch, Referer set so jd-origin.php admits it)
async function getRaw(p) {
  const r = await fetch(ORIGIN + p, { headers: { Referer: ORIGIN + '/art/junk-drawer/' } });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, headers: Object.fromEntries(r.headers.entries()), body: buf };
}
async function payloads(prefix, list, headersOut) {
  for (const [name, p] of list) {
    const r = await getRaw(p);
    fs.writeFileSync(path.join(OUT, 'payloads', prefix + name + '.json'), r.body);
    headersOut[prefix + name] = { path: p, status: r.status, 'content-type': r.headers['content-type'] || null };
    if (/data\.php/.test(p)) {
      headersOut[prefix + name].etag = r.headers.etag || null;
      headersOut[prefix + name]['cache-control'] = r.headers['cache-control'] || null;
    }
  }
}

// ---------------------------------------------------------------------------
// THE GROUPS
async function groupPayloads() {
  const t = Date.now();
  const list = [
    ['data', '/art/junk-drawer/data.php'],
    ['data-slim', '/art/junk-drawer/data.php?slim=1'],
    ['data-item-curated', '/art/junk-drawer/data.php?item=' + CURATED_ITEM],
    ['jd-analytics', '/api/jd-analytics.php'],
    ['jd-bench-queue', '/api/jd-bench-queue.php'],
    ['jd-ledger', '/api/jd-ledger.php'],
    ['jd-inventory', '/api/jd-inventory.php'],
    ['jd-admin-check', '/api/jd-admin-check.php'],
  ];
  const headers = {};
  await payloads('', list, headers);
  // the ETag must revalidate: a conditional GET with it answers 304
  const etag = headers.data.etag;
  const r304 = await fetch(ORIGIN + '/art/junk-drawer/data.php', { headers: { 'If-None-Match': etag || '' } });
  headers.data.revalidates_304 = r304.status === 304;
  // pristine ULIDs: every id the untouched DB serves (they never change)
  for (const [name] of list) lib.collectUlids(fs.readFileSync(path.join(OUT, 'payloads', name + '.json'), 'utf8'), knownUlids);
  // a turn item from the pristine DB, if it has any (it has none today)
  const data = JSON.parse(fs.readFileSync(path.join(OUT, 'payloads', 'data.json'), 'utf8'));
  const turnItem = (data.items || []).find((i) => i.fromTurn);
  if (turnItem) {
    await payloads('', [['data-item-turn', '/art/junk-drawer/data.php?item=' + encodeURIComponent(turnItem.id)]], headers);
  } else {
    manifest.skipped.push('payload data-item-turn (pre): the pristine DB holds no rated turn; see payloads/after-data-item-turn.json for the turn branch');
  }
  lib.writeJSON(path.join(OUT, 'payloads', 'headers.json'), headers);
  // always kept, whatever --scenes says: they are cheap, and compare.js
  // reads the pristine ULID set from them
  manifest.scenes.push({ name: 'payloads', group: 'payloads', files: fs.readdirSync(path.join(OUT, 'payloads')).map((f) => 'payloads/' + f), ms: Date.now() - t });
  log('  payloads');
}

async function surfaceOf(page) {
  return page.evaluate(() => {
    const keys = Object.keys(window).filter(function (k) { return /^JD_/.test(k); }).sort();
    const members = {};
    const types = {};
    keys.forEach(function (k) {
      const v = window[k];
      types[k] = v === null ? 'null' : typeof v;
      if (v && (typeof v === 'object' || typeof v === 'function')) {
        try { members[k] = Object.keys(v).sort(); } catch (e) { members[k] = ['<unreadable>']; }
      }
    });
    const scripts = Array.prototype.map.call(document.querySelectorAll('script[src]'), function (s) {
      return new URL(s.src, location.href).pathname.split('/').pop();
    });
    const htmlClasses = document.documentElement.className.split(/\s+/).filter(Boolean).sort();
    return { keys, types, members, scripts, htmlClasses };
  });
}

async function groupDrawer() {
  for (const vp of ['desktop', 'tablet', 'phone']) {
    const want = ['drawer-' + vp, 'notes-' + vp].filter((n) => SCENES.find(([s]) => s === n));
    if (!want.some((n) => SELECTED(n, 'drawer'))) continue;
    const { context, page } = await newPage('drawer-' + vp, vp);
    await goto(page, '/art/junk-drawer/');
    await pileReady(page);
    await park(page);
    await capture(page, 'drawer-' + vp, { shot: 'full', surfaces: ['.jd-pile'], artwork: vp === 'desktop' ? 'all' : 'first' });
    if (vp === 'desktop' && SELECTED('drawer-desktop', 'drawer')) surface.drawer = await surfaceOf(page);
    if (SCENES.find(([s]) => s === 'notes-' + vp)) {
      await capture(page, 'notes-' + vp, { shot: { element: '#notes' }, surfaces: ['#notes'] });
    }
    await context.close();
  }
}

async function groupMotion() {
  const { context, page } = await newPage('drawer-desktop-motion', 'desktop', { motion: 'no-preference' });
  await goto(page, '/art/junk-drawer/');
  await pileReady(page);
  await park(page);
  await capture(page, 'drawer-desktop-motion', { shot: 'full', surfaces: ['.jd-pile'], settle: { quiet: 800, timeout: 45000 } });
  await context.close();
}

async function groupPick() {
  for (const vp of ['desktop', 'phone']) {
    if (!SELECTED('pick-' + vp, 'pick') && !SELECTED('sheet-' + vp, 'pick')) continue;
    const { context, page } = await newPage('pick-' + vp, vp);
    await goto(page, '/art/junk-drawer/');
    await pileReady(page);
    await settle(page);
    await press(page, `.jd-pile .jd-item[data-id="${SINGLE_ITEM}"]`, 'the specimen');
    await waitFor(page, () => !!document.querySelector('.jd-itemtag.is-on') && !!document.querySelector('.jd-rope.is-on'), null, 'the specimen tag');
    await park(page);
    await capture(page, 'pick-' + vp, { shot: 'viewport', surfaces: ['.jd-itemtag', '.jd-rope', '.jd-well > .jd-item.is-picked'] });
    await page.keyboard.press('Escape');
    await settle(page);
    await press(page, '.jd-item--sheet', 'the instructions sheet');
    await waitFor(page, () => !!document.querySelector('.jd-item--sheet.is-picked'), null, 'the sheet to unfold');
    await park(page);
    await capture(page, 'sheet-' + vp, { shot: 'viewport', surfaces: ['.jd-item--sheet'] });
    await context.close();
  }
}

async function openRecord(page, id) {
  await page.evaluate((id) => window.JD_record.open(id), id);
  await waitFor(page, () => !!document.querySelector('.jd-record-scrim.is-on .jd-record'), null, 'the report card');
}

async function groupRecord() {
  const { context, page } = await newPage('record-desktop', 'desktop');
  await goto(page, '/art/junk-drawer/');
  await pileReady(page);
  await settle(page);
  await openRecord(page, SINGLE_ITEM);
  await park(page);
  await capture(page, 'record-single-desktop', { shot: { scroller: '.jd-record .rc-scroll' }, surfaces: ['.jd-record-scrim'] });
  await page.keyboard.press('Escape');
  await settle(page);
  await openRecord(page, CURATED_ITEM);
  await waitFor(page, () => document.querySelectorAll('.jd-record .rc-alt').length > 1, null, 'the alternatives strip');
  await park(page);
  await capture(page, 'record-multi-desktop', { shot: { scroller: '.jd-record .rc-scroll' }, surfaces: ['.jd-record-scrim'] });
  await click(page, '.jd-record .rc-alt[data-resp="1"]');
  await park(page);
  await capture(page, 'record-multi-alt-desktop', { shot: { scroller: '.jd-record .rc-scroll' }, surfaces: ['.jd-record-scrim'] });
  await click(page, '.jd-record .rc-paper');
  await park(page);
  await capture(page, 'record-multi-blueprint-desktop', { shot: { scroller: '.jd-record .rc-scroll' }, surfaces: ['.jd-record-scrim'] });
  await page.locator('.jd-record .rc-plate').first().scrollIntoViewIfNeeded();
  await press(page, '.jd-record .rc-plate .rc-plate-art', 'the plate');
  await waitFor(page, () => !!document.querySelector('.jd-record-zoom.is-on'), null, 'the enlargement');
  await park(page);
  await capture(page, 'record-multi-zoom-desktop', { shot: 'viewport', surfaces: ['.jd-record-zoom'] });
  await context.close();

  if (SELECTED('record-multi-phone', 'record')) {
    const p2 = await newPage('record-phone', 'phone');
    await goto(p2.page, '/art/junk-drawer/');
    await pileReady(p2.page);
    await settle(p2.page);
    await openRecord(p2.page, CURATED_ITEM);
    await waitFor(p2.page, () => document.querySelectorAll('.jd-record .rc-alt').length > 1, null, 'the alternatives strip');
    await capture(p2.page, 'record-multi-phone', { shot: { scroller: '.jd-record .rc-scroll' }, surfaces: ['.jd-record-scrim'] });
    await p2.context.close();
  }
}

async function openFolder(page) {
  await page.evaluate(() => window.JD_folder.open());
  await waitFor(page, () => !!document.querySelector('.jd-folder-scrim.is-on .jd-folder-scroll') &&
    !document.querySelector('.jd-folder-scroll .fx-stuck'), null, 'the analytics folder');
}
async function groupFolder(pre = 'folder', vps = ['desktop', 'phone']) {
  for (const vp of vps) {
    const names = [pre + '-' + vp, pre + '-row-' + vp].filter((n) => SCENES.find(([s]) => s === n));
    if (!names.some((n) => SELECTED(n, pre === 'folder' ? 'folder' : 'after'))) continue;
    const { context, page } = await newPage(pre + '-' + vp, vp);
    await goto(page, '/art/junk-drawer/');
    await pileReady(page);
    await settle(page);
    await openFolder(page);
    await park(page);
    await capture(page, pre + '-' + vp, { shot: { scroller: '.jd-folder-scroll' }, surfaces: ['.jd-folder-scrim'] });
    if (SCENES.find(([s]) => s === pre + '-row-' + vp)) {
      const row = await page.$('.jd-folder-scroll .fx-row');
      if (row) {
        await row.scrollIntoViewIfNeeded();
        await click(page, '.jd-folder-scroll .fx-row');
        await park(page);
        await capture(page, pre + '-row-' + vp, { shot: 'viewport', surfaces: ['.jd-folder-scrim'] });
      } else {
        manifest.skipped.push(`${pre}-row-${vp}: the folder rendered no .fx-row to press`);
      }
    }
    await context.close();
  }
}

async function groupAdmin() {
  const { context, page } = await newPage('admin-desktop', 'desktop');
  await goto(page, '/art/junk-drawer/?admin');
  await pileReady(page);
  await waitFor(page, () => document.documentElement.classList.contains('jd-admin-on') &&
    !!document.querySelector('.jd-bench-bar') && !/checking the key/.test(document.querySelector('.jd-bench-bar').textContent),
  null, 'the admin key to verify');
  await park(page);
  await capture(page, 'admin-strip-desktop', { shot: 'viewport', surfaces: ['.jd-bench-bar', '.jd-bench-sheet'] });
  await openRecord(page, CURATED_ITEM);
  await waitFor(page, () => !!document.querySelector('.jd-record select.rc-edit'), null, 'the admin editor');
  await park(page);
  await capture(page, 'admin-card-desktop', { shot: { scroller: '.jd-record .rc-scroll' }, surfaces: ['.jd-record-scrim', '.jd-bench-bar'] });
  await context.close();
}

async function groupBench() {
  const { context, page } = await newPage('bench-desktop', 'desktop');
  await goto(page, '/art/junk-drawer/?bench');
  await pileReady(page);
  await waitFor(page, () => {
    const bar = document.querySelector('.jd-bench-bar');
    if (!bar) return false;
    const t = bar.textContent;
    if (/checking the key|loading the queue/.test(t)) return false;
    return !!document.querySelector('.jd-turn-scrim.is-on .jd-turn[data-view]') || /backlog clear/.test(t);
  }, null, 'the bench queue', 60000);
  let seated = await page.evaluate(() => !!document.querySelector('.jd-turn-scrim.is-on'));
  if (!seated) {
    manifest.warnings.push('bench: the queue seated nothing (backlog clear) — addressing ' + CURATED_ITEM + ' directly');
    await goto(page, '/art/junk-drawer/?bench&item=' + CURATED_ITEM);
    await pileReady(page);
    await waitFor(page, () => !!document.querySelector('.jd-turn-scrim.is-on .jd-turn[data-view]'), null, 'the directly addressed item', 60000);
  }
  await park(page);
  await capture(page, 'bench-strip-desktop', { shot: 'viewport', surfaces: ['.jd-bench-bar'] });
  await capture(page, 'bench-curate-desktop', { shot: { scroller: '.jd-turn-scroll' }, surfaces: ['.jd-turn-scrim', '.jd-bench-bar'] });
  if (SELECTED('bench-strip-desktop', 'bench')) surface.bench = await surfaceOf(page);
  await context.close();
}

async function groupAbout() {
  for (const vp of ['desktop', 'phone']) {
    if (!SELECTED('about-' + vp, 'about')) continue;
    const { context, page } = await newPage('about-' + vp, vp);
    await goto(page, '/art/junk-drawer/about/');
    await waitFor(page, () => document.querySelectorAll('.jd-pile .jd-item').length > 0, null, 'the about page drawer', 60000);
    await settle(page, { quiet: 600 });
    await park(page);
    await capture(page, 'about-' + vp, { shot: 'full', surfaces: ['.jd-about-pane', '.jd-about-notes'] });
    if (vp === 'desktop') surface.about = await surfaceOf(page);
    await context.close();
  }
}

// ---- the turn ---------------------------------------------------------------
const GEN = '/api/jd-generate.php', TITLE = '/api/jd-title.php';
function holdTurnRequests(st) {
  st.holds = [
    { tag: 'gen', test: (u, r) => u.pathname === GEN && r.method() === 'POST' },
    { tag: 'title', test: (u, r) => u.pathname === TITLE && r.method() === 'POST' },
  ];
}
async function waitHeld(page, gens, titles) {
  const st = pageState.get(page);
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    const g = st.held.filter((h) => h.tag === 'gen').length, t = st.held.filter((h) => h.tag === 'title').length;
    if (g >= gens && t >= titles) return;
    await sleep(25);
  }
  throw new Error(`[${st.label}] the turn's requests never arrived (held: ${st.held.map((h) => h.tag).join(',')})`);
}
// release one held request and wait until the page has its answer
async function release(page, item) {
  const st = pageState.get(page);
  st.held.splice(st.held.indexOf(item), 1);
  st.heldReqs.delete(item.req);
  const fin = page.waitForEvent('requestfinished', { predicate: (r) => r === item.req, timeout: 60000 });
  await item.route.continue();
  await fin;
}
function slotOf(item) {
  try { return JSON.parse(item.req.postData() || '{}').slot || ''; } catch (e) { return ''; }
}
// release the generations in slot order — a, the title, b, c, d (or, with
// titleLast, a b c d then the title) — each only after the previous one has
// answered, so the single-worker server mints every id in the same order on
// every run. The title is released ONCE: a retry (jd-turn.js re-asks after
// 4 s when no submission row exists yet) stays held until the page closes,
// so a late timer can never reach the server at a run-dependent moment.
async function releaseTurn(page, opts = {}) {
  const st = pageState.get(page);
  const gens = st.held.filter((h) => h.tag === 'gen').sort((x, y) => slotOf(x).localeCompare(slotOf(y)));
  const title = st.held.find((h) => h.tag === 'title');
  for (let i = 0; i < gens.length; i++) {
    await release(page, gens[i]);
    if (i === 0 && !opts.titleLast) {
      if (title) await release(page, title);
      if (opts.onFirst) await opts.onFirst();
    }
  }
  if (opts.titleLast && title) await release(page, title);
  st.holds = st.holds.filter((h) => h.tag === 'title');
}

const RATINGS = { a: [2, 1, 1, 2, 1], b: [3, 2, 1, 1, 3], c: [1, 1, 2, 1, 2], d: [4, 3, 2, 2, 1] };
const RANKS = [['c', 1], ['a', 2], ['d', 3], ['b', 4]];
// answer every select on the bench for `slot`: the k-th option counting
// from the top (skip = 0), per RATINGS
async function rateSlot(page, slot) {
  const sels = await page.$$(`.jd-turn select.jd-turn-select[data-slot="${slot}"]`);
  const plan = RATINGS[slot];
  for (let i = 0; i < sels.length; i++) {
    const n = await sels[i].evaluate((s) => s.options.length);
    const idx = Math.max(1, Math.min(n - 1, plan[i % plan.length]));
    await sels[i].selectOption({ index: idx });
  }
}
async function expectView(page, v) {
  await waitFor(page, (v) => {
    const c = document.querySelector('.jd-turn-scrim.is-on .jd-turn');
    return !!c && c.getAttribute('data-view') === v;
  }, v, 'data-view=' + v);
}

async function runTurn(vp, prompt, full) {
  const sfx = '-' + vp;
  const CARD = { shot: { scroller: '.jd-turn-scroll' }, surfaces: ['.jd-turn-scrim'] };
  const { context, page, st } = await newPage('turn' + sfx, vp);
  await goto(page, '/art/junk-drawer/');
  await pileReady(page);
  await settle(page);
  // open the card the way a visitor does: press the PUSH button
  await press(page, '.jd-pile .jd-item--turn', 'the PUSH button');
  await expectView(page, 'form');
  await park(page);
  await capture(page, 'turn-form' + sfx, CARD);
  await page.fill('#jd-turn-prompt', prompt);
  if (full) await capture(page, 'turn-form-filled' + sfx, CARD);
  holdTurnRequests(st);
  await click(page, '.jd-turn [data-act="generate"]');
  await expectView(page, 'darkroom');
  await waitHeld(page, 4, 1);
  await park(page);
  await capture(page, 'turn-darkroom' + sfx, { ...CARD, settle: { quiet: 600 } });
  await releaseTurn(page, { onFirst: async () => {
    if (full) await capture(page, 'turn-darkroom-landed' + sfx, { ...CARD, settle: { quiet: 600 } });
  } });
  await expectView(page, 'plates');
  await capture(page, 'turn-plates' + sfx, CARD);
  await click(page, '.jd-turn [data-act="rate"]');
  await expectView(page, 'bench');
  if (full) await capture(page, 'turn-bench-a' + sfx, CARD);
  if (full) {
    await click(page, '.jd-turn .jd-rowhead[data-act="def"]');
    await capture(page, 'turn-bench-a-def' + sfx, CARD);
    await click(page, '.jd-turn .jd-rowhead[data-act="def"]');
  }
  for (const slot of ['a', 'b', 'c', 'd']) {
    if (slot !== 'a' && full) await capture(page, 'turn-bench-' + slot + sfx, CARD);
    await rateSlot(page, slot);
    if (slot === 'a') await capture(page, (full ? 'turn-bench-a-rated' : 'turn-bench-a') + sfx, CARD);
    await click(page, '.jd-turn [data-act="next"]');
  }
  await expectView(page, 'call');
  if (full) await capture(page, 'turn-call' + sfx, CARD);
  for (const [slot, rank] of RANKS) {
    await click(page, `.jd-turn .jd-pod-tier[data-rank="${rank}"]`, { mouse: true });
    await click(page, `.jd-turn .jd-pod-print[data-pod="${slot}"]`, { mouse: true });
  }
  await waitFor(page, () => !document.querySelector('.jd-turn [data-act="next"][disabled]'), null, 'the podium to be complete');
  await park(page);
  await capture(page, 'turn-call-ranked' + sfx, CARD);
  await click(page, '.jd-turn [data-act="next"]');
  await expectView(page, 'size');
  if (full) await capture(page, 'turn-size' + sfx, CARD);
  await click(page, '.jd-turn [data-act="size"][data-size="m"]');
  await park(page);
  await capture(page, 'turn-size-chosen' + sfx, CARD);
  await click(page, '.jd-turn [data-act="file"]');
  await expectView(page, 'said');
  await park(page);
  await capture(page, 'turn-said' + sfx, CARD);
  // the winner's generation id: the pile item the filing dropped in
  const won = await page.evaluate(() => {
    const el = document.querySelector('.jd-pile .jd-item--visitor');
    return el ? el.getAttribute('data-id') : null;
  });
  if (!won) throw new Error('[turn' + sfx + '] no won item was dropped into the pile');
  await click(page, '.jd-turn [data-act="done"]');
  await waitFor(page, () => !document.querySelector('.jd-turn-scrim.is-on'), null, 'the turn card to close');
  if (full) {
    await park(page);
    await capture(page, 'won-pile' + sfx, { shot: 'full', surfaces: ['.jd-pile'], artwork: 'all' });
    await press(page, `.jd-item[data-id="${won}"]`, 'the won item');
    await waitFor(page, () => !!document.querySelector('.jd-itemtag.is-on'), null, 'the won item\'s tag');
    await park(page);
    await capture(page, 'won-tag' + sfx, { shot: 'viewport', surfaces: ['.jd-itemtag', '.jd-rope', '.jd-well > .jd-item.is-picked'] });
    await page.keyboard.press('Escape');
    await settle(page);
    await openRecord(page, won);
    await park(page);
    await capture(page, 'won-card' + sfx, { shot: { scroller: '.jd-record .rc-scroll' }, surfaces: ['.jd-record-scrim'] });
  }
  await context.close();
  return won;
}

async function groupApology() {
  const { context, page, st } = await newPage('apology-desktop', 'desktop');
  await goto(page, '/art/junk-drawer/');
  await pileReady(page);
  await settle(page);
  await page.evaluate(() => window.JD_turnObject.press());
  await expectView(page, 'form');
  await page.fill('#jd-turn-prompt', PROMPTS.apology);
  holdTurnRequests(st);
  await click(page, '.jd-turn [data-act="generate"]');
  await waitHeld(page, 4, 1);
  await releaseTurn(page, { titleLast: true });
  await waitFor(page, () => {
    const c = document.querySelector('.jd-turn-scrim.is-on .jd-turn');
    return !!c && /Nothing came back/.test(c.textContent);
  }, null, 'the apology card');
  await park(page);
  await capture(page, 'turn-apology-desktop', { shot: { scroller: '.jd-turn-scroll' }, surfaces: ['.jd-turn-scrim'] });
  await context.close();
}

// a third visitor turn, filed through the real endpoints (no browser): four
// generations in slot order, then one rating batch — the shape jd-turn.js's
// submitRatings() posts. Every answer is taken from the taxonomy in data.php.
async function groupTurnApi() {
  const hdr = { 'Content-Type': 'application/json', Referer: ORIGIN + '/art/junk-drawer/', Origin: ORIGIN };
  const post = async (p, body) => {
    const r = await fetch(ORIGIN + p, { method: 'POST', headers: hdr, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.ok) throw new Error(`turn-api: ${p} answered ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
    return j;
  };
  const data = JSON.parse((await getRaw('/art/junk-drawer/data.php')).body.toString('utf8'));
  const tax = data.taxonomy || {};
  const axes = (tax.axes || []).filter((a) => !a.defunct);
  const grades = (tax.grades || []).map((g) => +g.rank).sort((a, b) => b - a);
  const clientRef = '0b7e7c2a-5d1e-4c3b-9a4f-2f1e0d9c8b7a';
  const deviceRef = '6f3c2b1a-0e9d-4c8b-8a7f-1e2d3c4b5a69';
  const gens = {};
  let sub = null;
  for (const slot of ['a', 'b', 'c', 'd']) {
    const j = await post('/api/jd-generate.php', { client_ref: clientRef, slot, prompt: PROMPTS.api, client: 'web',
      consent: { version: 'jd-consent-5' }, device_ref: deviceRef, website: '' });
    gens[slot] = j.gen_id;
    sub = j.submission_id || sub;
  }
  const ratings = [];
  ['a', 'b', 'c', 'd'].forEach((slot, si) => {
    ratings.push({ gen_id: gens[slot], kind: 'grade', value: grades[(si + 1) % grades.length] });
    axes.forEach((ax, ai) => {
      const vals = (ax.values || []).map((v) => +v.rank).sort((a, b) => b - a);
      ratings.push({ gen_id: gens[slot], kind: 'axis', axis_id: ax.id, value: vals[(si + ai) % vals.length] });
    });
  });
  const ranking = [['b', 1], ['d', 2], ['a', 3], ['c', 4]].map(([slot, rank]) => ({ slot, rank }));
  await post('/api/jd-rate.php', { submission_id: sub, client: 'web', title: 'Wind-up robot', suppress: false, size: 's',
    ratings, ranking, comparison: { winner: 'b', strength: null } });
}

let wonDesktop = null;
async function groupAfter() {
  if (SELECTED('drawer-after-desktop', 'after')) {
    const { context, page } = await newPage('drawer-after-desktop', 'desktop');
    await goto(page, '/art/junk-drawer/');
    await pileReady(page);
    await park(page);
    await capture(page, 'drawer-after-desktop', { shot: 'full', surfaces: ['.jd-pile'] });
    await context.close();
  }
  if (SELECTED('folder-after-desktop', 'after')) await groupFolder('folder-after', ['desktop']);
  if (SELECTED('payloads-after', 'after')) {
    const t = Date.now();
    const headers = lib.readJSON(path.join(OUT, 'payloads', 'headers.json'), {});
    const list = [
      ['data', '/art/junk-drawer/data.php'],
      ['jd-analytics', '/api/jd-analytics.php'],
      ['jd-bench-queue', '/api/jd-bench-queue.php'],
      ['jd-ledger', '/api/jd-ledger.php'],
      ['jd-inventory', '/api/jd-inventory.php'],
    ];
    if (wonDesktop) list.splice(1, 0, ['data-item-turn', '/art/junk-drawer/data.php?item=' + encodeURIComponent(wonDesktop)]);
    await payloads('after-', list, headers);
    lib.writeJSON(path.join(OUT, 'payloads', 'headers.json'), headers);
    manifest.scenes.push({ name: 'payloads-after', group: 'after', files: list.map(([n]) => 'payloads/after-' + n + '.json'), ms: Date.now() - t });
    log('  payloads-after');
  }
}

// ---------------------------------------------------------------------------
async function main() {
  prepareOut();
  try { manifest.git.head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (e) { manifest.git.head = null; }
  try { manifest.git.branch = execFileSync('git', ['-C', ROOT, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (e) {}
  try {
    manifest.git.dirty = execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'art/junk-drawer', 'api', 'includes', 'css', 'router.php'], { encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch (e) {}
  manifest.determinism.pristine_sha256 = preparePristine();
  let shim = null;
  try { shim = buildShim(); } catch (e) {
    throw new Error('cannot build the faketime shim (' + e.message + ') — without it run-minted ids and timestamps cannot repeat');
  }
  Object.assign(manifest.determinism, {
    server_clock: 'frozen at ' + new Date(EPOCH * 1000).toISOString() + ' (LD_PRELOAD faketime.c)',
    server_random: 'splitmix64, one php -S per group seeded from the group name (getrandom / syscall(SYS_getrandom) / getentropy)',
    browser: 'Math.random xorshift32 and a crypto.getRandomValues/randomUUID stream, both seeded from ' + SEED + ' x the page label; Date = ' +
      new Date(EPOCH * 1000).toISOString() + ' + elapsed; reducedMotion=reduce unless the scene says otherwise; non-127.0.0.1 requests aborted',
    viewports: VIEWPORTS,
    chrome_args: CHROME_ARGS,
  });
  log('serving ' + ROOT + ' on ' + ORIGIN);
  const pw = lib.requireGlobal('playwright');
  browser = await pw.chromium.launch({ headless: true, args: CHROME_ARGS });
  manifest.determinism.chromium = browser.version();
  try { manifest.determinism.playwright = require(path.join(lib.playwrightPkgDir(), 'package.json')).version; } catch (e) {}

  const groups = {
    payloads: groupPayloads, drawer: groupDrawer, motion: groupMotion, pick: groupPick, record: groupRecord,
    folder: () => groupFolder('folder', ['desktop', 'phone']), admin: groupAdmin, bench: groupBench, about: groupAbout,
    turn: async () => { wonDesktop = await runTurn('desktop', PROMPTS.desktop, true); },
    'turn-phone': async () => { await runTurn('phone', PROMPTS.phone, false); },
    apology: groupApology, 'turn-api': groupTurnApi, after: groupAfter,
  };
  const wanted = new Set();
  for (const [n, g] of SCENES) if (SELECTED(n, g)) wanted.add(g);
  for (const g of [...wanted]) for (const need of (GROUP_NEEDS[g] || [])) wanted.add(need);
  wanted.add('payloads');                       // always: the pristine ULID set comes from it
  manifest.timings = {};
  for (const g of GROUP_ORDER) {
    if (!wanted.has(g)) continue;
    const t = Date.now();
    log('group ' + g);
    await startServer(shim, seedFor(g));
    await groups[g]();
    await stopServer();
    manifest.timings[g] = Date.now() - t;
  }
  await browser.close();
  browser = null;

  // the console, grouped per page; the blocked origins
  lib.writeJSON(path.join(OUT, 'console.json'), consoleLog);
  if (Object.keys(surface).length) lib.writeJSON(path.join(OUT, 'surface.json'), surface);
  manifest.determinism.blocked_origins = [...blockedOrigins].sort();
  manifest.finished = new Date().toISOString();
  manifest.total_ms = Date.now() - T0;
  lib.writeJSON(path.join(OUT, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(OUT, 'server.log'), serverLog);

  if (ARGS.keepServer) {
    // a fresh server on the capture's final database (frozen clock, shim on)
    await startServer(shim, seedFor('keep-server'));
    log(`done in ${(manifest.total_ms / 1000).toFixed(1)}s — server up at ${ORIGIN} on the post-capture DB, holding the lock; Ctrl-C to stop`);
    await new Promise(() => {});
  }
  killServer();
  log(`done in ${(manifest.total_ms / 1000).toFixed(1)}s -> ${OUT}`);
}

main().catch(async (e) => {
  console.error('[jd-regress] FAILED: ' + (e && e.stack || e));
  try { if (browser) await browser.close(); } catch (x) {}
  try {
    manifest.error = String(e && e.message || e);
    lib.writeJSON(path.join(OUT, 'manifest.json'), manifest);
    fs.writeFileSync(path.join(OUT, 'server.log'), serverLog);
    lib.writeJSON(path.join(OUT, 'console.json'), consoleLog);
  } catch (x) {}
  killServer();
  process.exit(1);
});
