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
// /about/'s walkthrough, step by step (groups about-steps,
// about-steps-phone and about-steps-after). Every .jd-step in document order: [data-step,
// data-scene, the phone section (.jd-ph-sec[data-ph]) it is gathered into,
// what the pane shows]. The capture asserts the page carries exactly these
// steps, in this order.
const ABOUT_STEPS = [
  ['hook', 'drawer', 'drawer', 'scene 1, the drawer: the poster with the live specimen (the opening view)'],
  ['premise', 'drawer', 'drawer', 'the drawer, unchanged'],
  ['graded', 'drawer', 'drawer', 'the drawer with the specimen lifted and its tag up (JD_pick)'],
  ['try', 'instrument', 'instrument', 'scene 2, the instrument: the blank demo card (JD_turn.curate, fetch-sealed), drawing A'],
  ['taxonomy', 'instrument', 'instrument', 'the instrument beside the taxonomy legend (#jd-axes)'],
  ['claude-fable-5', 'record', 'fable', 'scene 3, the report card: data-view claude-fable-5'],
  ['gemini-3-1-pro', 'record', 'gemini', 'the report card: data-view gemini-3-1-pro'],
  ['gemini-answer', 'record', 'gemini', 'the same view (gemini-3-1-pro): the Understanding Assignment answer'],
  ['gemini-structure', 'record', 'gemini', 'the same view (gemini-3-1-pro): the Structural Coherence answer'],
  ['kimi-k3', 'record', 'kimi', 'the report card: data-view kimi-k3'],
  ['stack', 'analytics', 'turns', 'scene 4, the analysis: data-view turns (the records table)'],
  ['grades', 'analytics', 'grades', 'data-view grades (the average and the spread)'],
  ['distribution', 'analytics', 'distribution', 'data-view grades with data-focus spread-lead'],
  ['multiples', 'analytics', 'axes', 'data-view axes (issue rate per category)'],
  ['spend', 'analytics', 'cost', 'data-view cost'],
  ['outro', 'drawer', 'outro', 'back to the drawer (the page bottoms out here)'],
];
// the phone's sections that carry a figure (the outro is bare), in order
const ABOUT_PHONE_FIGS = ['drawer', 'instrument', 'fable', 'gemini', 'kimi', 'turns', 'grades', 'distribution', 'axes', 'cost'];
// scene 4's steps, captured again after the turns (group about-steps-after)
const ABOUT_AFTER_STEPS = ['stack', 'grades', 'distribution', 'multiples', 'spend'];
{
  const at = SCENES.findIndex(([n]) => n === 'about-phone') + 1;
  const add = [];
  for (const [id, , , d] of ABOUT_STEPS) {
    add.push(['about-step-' + id + '-desktop', 'about-steps', d + ' [1440, scrolled to the focus line: shots .pane + viewport; pane, step, #jd-timeline]']);
  }
  add.push(
    ['about-wake-desktop', 'about-steps', 'the drawer wakes: the mouse enters scene 1 (pointerenter) -> html.jd-drawer-awake, the live pile in place of the poster; pane + viewport'],
    ['about-wake-pick-desktop', 'about-steps', 'the woken pile: ' + 'the Googie UFO clicked on its ink -> its specimen tag; pane + viewport'],
    ['about-instrument-rated-a-desktop', 'about-steps', 'scene 2 (step try): drawing A answered — grade + every category — on the sealed demo card'],
    ['about-instrument-call-desktop', 'about-steps', 'B, C, D answered, NEXT each time: the podium, empty'],
    ['about-instrument-ranked-desktop', 'about-steps', 'the podium with all four placed (C, A, D, B)'],
    ['about-instrument-said-desktop', 'about-steps', 'FILE (the demo job\'s no-op file(); no write leaves the page) -> the unveil, "Who drew what"'],
    ['about-record-axdef-desktop', 'about-steps', 'scene 3 (step claude-fable-5): the first category\'s definition unfolded (.rc-axbtn)'],
    ['about-record-alt-desktop', 'about-steps', 'the third thumbnail pressed (.rc-alt[data-resp="2"], Claude Opus 5): the card turns in place'],
    ['about-tip-desktop', 'about-steps', 'scene 4 (step stack): the mouse on the first Item cell -> the prompt card (.jd-prompt-tip)'],
  );
  for (const [id, , sec, d] of ABOUT_STEPS) {
    add.push(['about-step-' + id + '-phone', 'about-steps-phone', d + ' [390, scrolled to the phone\'s line: viewport down to the end of .jd-ph-sec[data-ph="' + sec + '"]; that section, step]']);
  }
  for (const sec of ABOUT_PHONE_FIGS) {
    add.push(['about-figure-' + sec + '-phone', 'about-steps-phone', 'the ' + sec + ' section\'s figure(s) brought under the banner after the walk, paged viewport shots']);
  }
  add.push(
    ['about-wake-phone', 'about-steps-phone', 'the drawer wakes on a tap on the poster: the pictured item under the finger is picked, its tag up'],
    ['about-instrument-rated-a-phone', 'about-steps-phone', 'the phone\'s inline instrument: drawing A answered (paged)'],
    ['about-instrument-call-phone', 'about-steps-phone', 'B, C, D answered: the podium, empty (the card turned a page each NEXT)'],
    ['about-instrument-ranked-phone', 'about-steps-phone', 'the podium with all four placed (mouse clicks, as turn-call-ranked-phone)'],
    ['about-instrument-said-phone', 'about-steps-phone', 'FILE -> the unveil'],
    ['about-record-axdef-phone', 'about-steps-phone', 'the Fable card: the first category\'s definition button tapped (it does not unfold on a phone today — see README)'],
    ['about-record-alt-phone', 'about-steps-phone', 'the Fable card: the third thumbnail tapped -> the card turns in its figure (phoneTurn)'],
    ['about-tip-phone', 'about-steps-phone', 'the records table: the first Item cell clicked -> the prompt card (a mouse click: see README)'],
  );
  SCENES.splice(at, 0, ...add);
  // scene 4 again once the turns are filed: on the pristine DB jd-analytics
  // has no model on a visitor turn, so every chart (and the table's model
  // columns) is empty — these are the same steps with the charts drawn
  const after = [];
  for (const id of ABOUT_AFTER_STEPS) {
    const [, , , d] = ABOUT_STEPS.find(([x]) => x === id);
    after.push(['about-step-' + id + '-after-desktop', 'about-steps-after', d + ', after the turns (charts populated) [as about-step-' + id + '-desktop]']);
  }
  for (const id of ABOUT_AFTER_STEPS) {
    const [, , , d] = ABOUT_STEPS.find(([x]) => x === id);
    after.push(['about-step-' + id + '-after-phone', 'about-steps-after', d + ', after the turns [as about-step-' + id + '-phone]']);
  }
  for (const id of ABOUT_AFTER_STEPS) {
    const [, , sec] = ABOUT_STEPS.find(([x]) => x === id);
    after.push(['about-figure-' + sec + '-after-phone', 'about-steps-after', 'the ' + sec + ' section\'s figure after the turns, paged [as about-figure-' + sec + '-phone]']);
  }
  SCENES.push(...after);
}
const GROUP_ORDER = ['payloads', 'drawer', 'motion', 'pick', 'record', 'folder', 'admin', 'bench', 'about',
  'about-steps', 'about-steps-phone', 'turn', 'turn-phone', 'apology', 'turn-api', 'after', 'about-steps-after'];
// turn-api writes no artifacts: it files a third rated turn straight through
// the API, because the folder's grade and category charts only plot a model
// once it holds three ratings on visitor turns
const GROUP_NEEDS = { after: ['turn', 'turn-phone', 'apology', 'turn-api'], 'about-steps-after': ['turn', 'turn-phone', 'apology', 'turn-api'] };

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
  const wn = Math.max(...SCENES.map(([n]) => n.length)) + 2, wg = Math.max(...SCENES.map(([, g]) => g.length)) + 2;
  for (const [n, g, d] of SCENES) console.log(n.padEnd(wn) + g.padEnd(wg) + d);
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
    'styles (about-steps* scenes only): a display:none element below a surface root records its own line + "pruned": <n descendants not walked>',
    'markup (about-steps* scenes): a first line <!-- jd-regress state {…} --> (the walkthrough\'s own account of the step), normalised like the rest of the file',
    'shots (about-step-*-phone): the viewport cut at the bottom of the step\'s own .jd-ph-sec (the next section\'s held figure rasters ±1 level run to run)',
    'surface (about-steps*): the walk page\'s fetch/XHR URLs as a sorted set, not counts (data.php is fetched once or twice by timing)',
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
  // the about-steps pages also count the page's pending timers (aboutQuiet)
  if (opts.timers) await context.addInitScript({ content: TIMER_SCRIPT });
  const page = await context.newPage();
  const st = { label, vp: vpName, inflight: new Map(), heldReqs: new Set(), held: [], holds: [], dcl: false, artInflight: 0, blocked: new Set(),
    timers: !!opts.timers, lastNet: Date.now() };
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
    st.lastNet = Date.now();
    if (FURNITURE_ART.test(new URL(r.url()).pathname)) st.artInflight++;
  });
  const done = (r) => {
    st.inflight.delete(r);
    st.lastNet = Date.now();
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
// PRUNE (opt-in, the about-steps scenes only: prune 'display-none'): an
// element whose computed display is none — below a surface root — records
// its own line plus `"pruned": <n descendants not walked>`; nothing under it
// renders. The /about/ pane holds four scenes and the poster's hidden pile;
// each is walked in the captures where it is the one on screen.
async function stylesOf(page, selectors, artwork, prune) {
  const res = await page.evaluate(({ sels, artwork, ART_MIN, prune }) => {
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
          if (prune === 'display-none' && p !== '0' && s.display === 'none') {
            rec.pruned = el.getElementsByTagName('*').length;
            return;
          }
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
  }, { sels: selectors, artwork: artwork || 'first', ART_MIN, prune: prune || null });
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
  } else if (shot && shot.clip) {
    // an element that is already wholly in the viewport (the pinned /about/
    // pane): clipped out of a viewport shot. Nothing scrolls — on /about/ the
    // scroll offset IS the walkthrough's playhead
    const box = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    }, shot.clip);
    if (!box) throw new Error(`[${name}] no element ${shot.clip} to shoot`);
    const vp = page.viewportSize();
    if (box.x < 0 || box.y < 0 || box.x + box.width > vp.width + 0.5 || box.y + box.height > vp.height + 0.5 || !box.width || !box.height) {
      throw new Error(`[${name}] ${shot.clip} is not wholly inside the viewport (${JSON.stringify(box)})`);
    }
    await page.screenshot({ ...opts, path: base + '.png', clip: box });
    files.push('shots/' + name + '.png');
  } else if (shot && shot.viewportUntil) {
    // the viewport, cut off at the bottom of an element when that bottom is on
    // screen (the /about/ phone step: its own section, not the next one)
    const b = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().bottom : null;
    }, shot.viewportUntil);
    if (b == null) throw new Error(`[${name}] no element ${shot.viewportUntil} to cut the viewport at`);
    const vp = page.viewportSize();
    const h = Math.max(1, Math.min(vp.height, Math.ceil(b)));
    await page.screenshot({ ...opts, path: base + '.png', clip: { x: 0, y: 0, width: vp.width, height: h } });
    files.push('shots/' + name + '.png');
  } else if (shot && shot.docPages) {
    // a region of the DOCUMENT, brought under the fixed site banner and shot
    // a viewport at a time (<scene>.png, @2, …), each shot cut off where the
    // region ends (what follows it is not this scene's); then the scroll is
    // put back. The region runs from the top of `from` to the top of `until`.
    // Both must be in normal flow: a position:sticky element's rect is where
    // it is held NOW (at the far end of its section once that has scrolled
    // by), not where it sits in the document.
    const info = await page.evaluate(({ from, until }) => {
      const a = document.querySelector(from), b = document.querySelector(until);
      if (!a || !b) return null;
      const top = a.getBoundingClientRect().top + pageYOffset, bottom = b.getBoundingClientRect().top + pageYOffset;
      const ban = document.querySelector('.site-banner');
      const line = ban && getComputedStyle(ban).position === 'fixed' ? Math.round(ban.getBoundingClientRect().bottom) + 8 : 0;
      return { top, bottom, line, y0: pageYOffset, ih: innerHeight, max: document.documentElement.scrollHeight - innerHeight };
    }, shot.docPages);
    if (!info) throw new Error(`[${name}] no ${JSON.stringify(shot.docPages)} to shoot`);
    if (!(info.bottom > info.top)) throw new Error(`[${name}] empty region ${JSON.stringify(shot.docPages)}`);
    const step = info.ih - info.line;
    const want = Math.ceil((info.bottom - info.top) / step);
    const n = Math.min(MAX_PAGES, Math.max(1, want));
    if (want > MAX_PAGES) manifest.warnings.push(`[${name}] ${JSON.stringify(shot.docPages)} taller than ${MAX_PAGES} pages; later pages not shot`);
    const quiet = async () => (pageState.get(page).timers ? aboutQuiet(page, name) : settle(page, { quiet: 250, netQuiet: 150 }));
    for (let k = 0; k < n; k++) {
      const y = await scrollWindow(page, Math.max(0, Math.min(info.max, Math.round(info.top - info.line + k * step))));
      await quiet();
      const f = k ? name + '@' + (k + 1) : name;
      const h = Math.max(1, Math.min(info.ih, Math.ceil(info.bottom - y)));
      const vw = page.viewportSize().width;
      await page.screenshot({ ...opts, path: path.join(OUT, 'shots', f + '.png'), clip: { x: 0, y: 0, width: vw, height: h } });
      files.push('shots/' + f + '.png');
    }
    await scrollWindow(page, info.y0);
    await quiet();
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
  if (!spec.noPark) await park(page);
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
    // spec.note: a state line the scene asserts on (the /about/ steps), kept
    // at the head of the markup file so it is compared with it
    const head = spec.note ? '<!-- jd-regress state ' + lib.normText(JSON.stringify(spec.note), ctxFor()) + ' -->\n' : '';
    fs.writeFileSync(path.join(OUT, 'markup', name + '.html'), head + await markupOf(page, spec.surfaces));
    files.push('markup/' + name + '.html');
    mark('markup');
    if (spec.styles !== false) {
      fs.writeFileSync(path.join(OUT, 'styles', name + '.json'), await stylesOf(page, spec.surfaces, spec.artwork, spec.prune));
      files.push('styles/' + name + '.json');
      mark('styles');
    }
  }
  const r0 = await page.evaluate(() => window.__jdrResizes || 0);
  if (spec.shot) files.push(...await shoot(page, name, spec.shot));
  // several shots of one moment: [{ suffix, shot }] -> shots/<scene><suffix>.png
  for (const x of (spec.shots || [])) files.push(...await shoot(page, name + (x.suffix || ''), x.shot));
  mark('shot');
  const resizes = (await page.evaluate(() => window.__jdrResizes || 0)) - r0;
  if (frozen) await page.evaluate(() => { (window.__jdrFrozen || []).forEach(function (a) { try { a.play(); } catch (e) {} }); window.__jdrFrozen = null; });
  const st = pageState.get(page);
  manifest.scenes.push({ name, group, viewport: st.vp, page: st.label, surfaces: spec.surfaces || [], files, ms: Date.now() - t, split,
    shot: spec.shot || spec.shots || null, resize_events_from_shot: resizes, infinite_animations_frozen: frozen, ...(spec.meta || {}) });
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
async function inkPoint(page, sel, noScroll) {
  return page.evaluate(({ sel, noScroll }) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    if (!noScroll) el.scrollIntoView({ block: 'center', inline: 'center' });
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
  }, { sel, noScroll: !!noScroll });
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

// ---- /about/, step by step (about-steps, about-steps-phone, about-steps-after)
// about-scenes.js has no stepping API: it is driven by the scroll offset and
// its own timers. So the harness drives it the way a reader does — it scrolls
// — to the offset the page's OWN stepper reads as "this step":
//   desktop: pickStep() makes a step current once its top has crossed
//     focusLine() (45% down the viewport) and lit (.is-on) once it has
//     crossed litLine() (65% down); the timeline's buttons scroll a step's top
//     to focusLine() - 4. The harness scrolls to exactly that offset (so the
//     step is both current and lit), waits until the page agrees, then waits
//     for quiet.
//   phone (PHONE_Q): phoneInit() moves every scene into a section of its own
//     (.jd-ph-sec) and hides the pane; phoneScroll() makes a step current once
//     its top passes 62% of the screen. Same "- 4". .jd-step.is-on is never
//     moved on a phone (there is no stepper), so the phone asserts
//     JD_about.step() and the step's section instead.
// QUIET (aboutQuiet): the page's own timers drive the walkthrough (FIT_AT's
// 3 s re-fit ladder, the pre-render's polls, the rail drive, the tag nudges),
// so "no DOM change for a while" is not enough — a ladder step can land after
// a lull. The about pages count their pending setTimeout callbacks (an init
// script wraps setTimeout/clearTimeout; delays up to TIMER_HORIZON_MS) and
// the harness waits until, for ABOUT_HOLD_MS together: no such timer is
// pending or has fired, no MutationObserver record on the walkthrough root
// (.jd-about: the pane, the steps, the timeline, the phone's sections) or on
// <body>'s children, no running finite animation, and no request in flight.
const TIMER_HORIZON_MS = 10000;
const ABOUT_HOLD_MS = 600;
const ABOUT_QUIET_TIMEOUT_MS = 45000;
const TIMER_SCRIPT = `(() => {
  // the page's pending setTimeout callbacks (delay <= ${TIMER_HORIZON_MS} ms) and the
  // moment one was last scheduled, fired or cleared — read by aboutQuiet
  var ST = window.setTimeout, CT = window.clearTimeout, pend = new Map();
  window.__jdrPend = pend; window.__jdrTimerT = performance.now(); window.__jdrST = ST;
  window.setTimeout = function setTimeout(fn, ms) {
    if (typeof fn !== 'function') return ST.apply(window, arguments);
    var args = Array.prototype.slice.call(arguments, 2), d = +ms || 0, h;
    h = ST(function () {
      if (pend.delete(h)) window.__jdrTimerT = performance.now();
      return fn.apply(this, args);
    }, d);
    if (d <= ${TIMER_HORIZON_MS}) { pend.set(h, d); window.__jdrTimerT = performance.now(); }
    return h;
  };
  window.clearTimeout = function clearTimeout(h) {
    if (pend.delete(h)) window.__jdrTimerT = performance.now();
    return CT(h);
  };
})();`;
// the demo's seal (index.php): none of these may reach the network from /about/
const ABOUT_SEALED = ['/api/jd-generate.php', '/api/jd-rate.php', '/api/jd-title.php', '/api/jd-item-rate.php', '/api/jd-curate.php'];
const ABOUT_UFO = '2026-08-20-googie-style-ufo';
// the phone's wake: a tap on the poster at this point of the well (fractions
// of its box); today it lands on a pictured item (the three of hearts), which
// the wake picks. The picked id is in the scene's state line.
const ABOUT_TAP = { fx: 0.880, fy: 0.335 };
const aboutSealBreaches = [];

async function aboutQuiet(page, what) {
  const st = pageState.get(page);
  const t0 = Date.now();
  await page.evaluate(() => {
    if (window.__jdrAboutMO) return;
    window.__jdrAboutMut = performance.now();
    window.__jdrAboutMO = new MutationObserver(function () { window.__jdrAboutMut = performance.now(); });
    window.__jdrAboutMO.observe(document.querySelector('.jd-about') || document.body,
      { subtree: true, childList: true, attributes: true, characterData: true });
    window.__jdrAboutMO.observe(document.body, { childList: true });
  });
  let last = null;
  while (Date.now() - t0 < ABOUT_QUIET_TIMEOUT_MS) {
    const s = await page.evaluate(() => {
      const now = performance.now();
      const pend = window.__jdrPend;
      return {
        timers: pend ? Array.from(pend.values()).sort(function (a, b) { return a - b; }) : null,
        sinceTimer: pend ? Math.round(now - window.__jdrTimerT) : 0,
        sinceMutation: Math.round(now - window.__jdrAboutMut),
        animations: document.getAnimations().filter(function (a) {
          if (a.playState !== 'running') return false;
          const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
          return !!t && isFinite(t.endTime);
        }).length,
      };
    });
    if (!s.timers) throw new Error(`[${st.label}] aboutQuiet needs the timer script (newPage(..., { timers: true }))`);
    const net = [...st.inflight.keys()].filter((r) => !st.heldReqs.has(r)).length;
    const sinceNet = Date.now() - st.lastNet;
    last = { ...s, timers: s.timers.slice(0, 16), net, sinceNet };
    if (!s.timers.length && !s.animations && !net && s.sinceTimer >= ABOUT_HOLD_MS &&
        s.sinceMutation >= ABOUT_HOLD_MS && sinceNet >= ABOUT_HOLD_MS) return Date.now() - t0;
    await sleep(100);
  }
  throw new Error(`[${st.label}] ${what}: the page never went quiet in ${ABOUT_QUIET_TIMEOUT_MS / 1000}s — ${JSON.stringify(last)}`);
}

// scroll the window to y and wait until the page has seen it (its scroll
// event), as it would see a reader's scroll; nothing when already there
async function scrollWindow(page, y) {
  return page.evaluate((y) => new Promise((res) => {
    if (Math.round(window.pageYOffset) === y) return res(window.pageYOffset);
    const T = window.__jdrST || window.setTimeout;      // not one of the page's timers
    let done = false;
    const fin = () => { if (!done) { done = true; res(window.pageYOffset); } };
    window.addEventListener('scroll', fin, { once: true });
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
    T(fin, 1500);
  }), y);
}

// the offset at which the page's own stepper makes `step` current (see above)
async function aboutStepOffset(page, step) {
  return page.evaluate((id) => {
    const el = document.querySelector('.jd-step[data-step="' + id + '"]');
    if (!el) return null;
    const h = window.innerHeight;
    let line;
    if (document.querySelector('.jd-about--phone')) line = h * 0.62;       // phoneScroll()
    else {
      line = h * 0.45;                                                       // focusLine()
      if (window.matchMedia('(max-width: 768px)').matches) {
        const b = document.getElementById('jd-about-pane').getBoundingClientRect().bottom;
        if (b > 0 && b < h) line = b + (h - b) * 0.18;
      }
    }
    const want = Math.round(window.pageYOffset + el.getBoundingClientRect().top - line + 4);
    const max = document.documentElement.scrollHeight - h;
    return { want, y: Math.max(0, Math.min(max, want)), max };
  }, step);
}

// what the walkthrough says about itself: the current step and scene
// (JD_about), the lit step, the pane's scene, the scene hosts' fitted card
// (the view it shows, its ghost, the fit maths), the drawer
async function aboutState(page) {
  return page.evaluate(() => {
    const A = window.JD_about || null;
    const phone = !!document.querySelector('.jd-about--phone');
    const pane = document.getElementById('jd-about-pane');
    const cur = A && A.step ? A.step() : null;
    const curEl = cur && document.querySelector('.jd-step[data-step="' + cur + '"]');
    const sec = curEl && curEl.closest('.jd-ph-sec');
    const hosts = {};
    document.querySelectorAll('.jd-scene[data-scene-pane]:not(.jd-scene-relay)').forEach(function (h) {
      const f = h.__jdFit;
      hosts[h.getAttribute('data-scene-pane')] = {
        shows: h.__shows || null,
        ghost: !!h.querySelector(':scope > .jd-scene-ghost'),
        focus: h.getAttribute('data-focus'),
        fit: f ? { k: f.k, natW: f.natW, natH: f.natH, availW: f.availW, availH: f.availH } : null,
      };
    });
    return {
      phone,
      step: cur,
      scene: A && A.scene ? A.scene() : null,
      lit: Array.prototype.map.call(document.querySelectorAll('.jd-step.is-on'), function (e) { return e.getAttribute('data-step'); }),
      pane: pane ? Array.prototype.map.call(pane.querySelectorAll(':scope > .jd-scene.is-on'), function (e) { return e.getAttribute('data-scene-pane'); }) : [],
      section: sec ? sec.getAttribute('data-ph') : null,
      handoff: phone || !A || !A.handoff ? undefined : A.handoff(),
      hosts,
      awake: document.documentElement.classList.contains('jd-drawer-awake'),
      picked: Array.prototype.map.call(document.querySelectorAll('.jd-item.is-picked'), function (e) { return e.getAttribute('data-id'); }),
      tag: !!document.querySelector('.jd-itemtag.is-on'),
      scrollY: window.pageYOffset,
      docHeight: document.documentElement.scrollHeight,
    };
  });
}
function aboutIsCurrent(s, id) {
  const [, scene, sec] = ABOUT_STEPS.find(([x]) => x === id);
  if (s.step !== id) return false;
  if (s.phone) return s.section === sec;
  return s.scene === scene && s.lit.length === 1 && s.lit[0] === id && s.pane.length === 1 && s.pane[0] === scene;
}
function aboutWhy(s, id) {
  const [, scene, sec] = ABOUT_STEPS.find(([x]) => x === id);
  return s.phone
    ? `expected JD_about.step() "${id}" in section "${sec}"; got step ${JSON.stringify(s.step)} in section ${JSON.stringify(s.section)} at scrollY ${s.scrollY}`
    : `expected JD_about.step() "${id}", scene "${scene}", .jd-step.is-on [${id}], pane [${scene}]; got step ${JSON.stringify(s.step)}, scene ${JSON.stringify(s.scene)}, lit ${JSON.stringify(s.lit)}, pane ${JSON.stringify(s.pane)} at scrollY ${s.scrollY}`;
}
// fails the capture unless `id` is (still) the current step
function aboutAssert(page, s, id, when) {
  if (!aboutIsCurrent(s, id)) throw new Error(`[${pageState.get(page).label}] ${when}: ${aboutWhy(s, id)}`);
}

// scroll `id` into place, wait for quiet, and assert the page made it the
// current step. A scroll can move the layout under the reader — on the phone
// jd-core's immersive chrome toggles html.jd-chrome on scrollY, showing the
// 56px banner, so a jump from the top lands one step short — so the offset
// is re-measured and the page scrolled again (as a reader would keep
// scrolling) until the step is current, at most ABOUT_TRIES times. The
// number of scrolls it took is in the state line (scroll.tries).
const ABOUT_TRIES = 4;
async function aboutGoTo(page, id) {
  let off = null, s = null, quietMs = 0, tries = 0;
  while (tries < ABOUT_TRIES) {
    off = await aboutStepOffset(page, id);
    if (!off) throw new Error(`[${pageState.get(page).label}] no .jd-step[data-step="${id}"] on the page`);
    tries++;
    await scrollWindow(page, off.y);
    quietMs += await aboutQuiet(page, 'step ' + id);
    s = await aboutState(page);
    if (aboutIsCurrent(s, id)) break;
  }
  aboutAssert(page, s, id, `scrolled to ${off.y} for step ${id} (${tries} time(s)), it is not the current step`);
  return { id, off: { ...off, tries }, s, quietMs };
}
// after an interaction: quiet, then the state (asserting `id` is still the
// current step, where given)
async function aboutHere(page, id, what) {
  const quietMs = await aboutQuiet(page, what || 'after an interaction');
  const s = await aboutState(page);
  if (id) aboutAssert(page, s, id, (what || 'an interaction') + ' moved the walkthrough off step ' + id);
  return { id, off: null, s, quietMs };
}
function aboutNote(r) {
  const { phone, ...s } = r.s;
  const note = { step: r.id, ...s };
  if (r.off) note.scroll = { want: r.off.want, max: r.off.max, tries: r.off.tries };
  return note;
}
// capture, then assert that capturing moved nothing (the scroll offset is the
// walkthrough's playhead: a shot that scrolled would have changed the step)
async function aboutCapture(page, name, r, spec) {
  await capture(page, name, { ...spec, note: aboutNote(r), meta: { quiet_ms: r.quietMs } });
  const s = await aboutState(page);
  if (s.scrollY !== r.s.scrollY || s.step !== r.s.step) {
    throw new Error(`[${name}] capturing moved the walkthrough: scrollY ${r.s.scrollY} -> ${s.scrollY}, step ${r.s.step} -> ${s.step}`);
  }
}
const aboutDesktopSpec = (id, extra = []) => ({
  surfaces: [...extra, '#jd-about-pane', `.jd-step[data-step="${id}"]`, '#jd-timeline'], prune: 'display-none',
  shots: [{ suffix: '', shot: 'viewport' }, { suffix: '.pane', shot: { clip: '#jd-about-pane' } }],
});
// THE PHONE'S STEP SHOT ENDS WITH THE STEP'S SECTION. Where the next section
// opens with a held figure (gemini, kimi: position:sticky, so a composited
// layer) its top edge enters the viewport at a fractional offset, and its
// photo corners (a gradient under a drop-shadow filter) rastered 1 level
// apart between runs — one of two variants per page life, stable within it,
// whatever the wait. That figure is shot in its own steps and in
// about-figure-<section>-phone; here the viewport is cut at the bottom of
// the step's own section (the whole viewport for the outro).
// a phone section's figure(s): from the section's top down to its first step
// (the held figures are sticky, so they cannot be measured themselves)
const aboutFigure = (sec) => {
  const first = ABOUT_STEPS.find(([, , x]) => x === sec)[0];
  return { docPages: { from: `.jd-ph-sec[data-ph="${sec}"]`, until: `.jd-step[data-step="${first}"]` } };
};
const aboutPhoneSpec = (id) => {
  const [, , sec] = ABOUT_STEPS.find(([x]) => x === id);
  return { surfaces: [`.jd-ph-sec[data-ph="${sec}"]`, `.jd-step[data-step="${id}"]`, '#jd-timeline'], prune: 'display-none',
    shot: { viewportUntil: `.jd-ph-sec[data-ph="${sec}"]` } };
};

async function aboutOpen(label, vp, reqs) {
  const p = await newPage(label, vp, { timers: true });
  p.page.on('request', (r) => {
    let u;
    try { u = new URL(r.url()); } catch (e) { return; }
    if (u.host !== '127.0.0.1:' + PORT) return;
    if (ABOUT_SEALED.includes(u.pathname)) aboutSealBreaches.push(`[${label}] ${r.method()} ${u.pathname}`);
    // the SET of URLs the page fetched, not how often: jd-turn's
    // ensurePayload() races the drawer's setData() for the taxonomy, so the
    // full data.php is fetched once or twice depending on timing
    if (reqs && (r.resourceType() === 'fetch' || r.resourceType() === 'xhr')) {
      reqs.add(r.method() + ' ' + lib.normText(u.pathname + u.search, ctxFor()));
    }
  });
  await goto(p.page, '/art/junk-drawer/about/');
  await waitFor(p.page, () => !!window.JD_about && document.querySelectorAll('.jd-pile .jd-item').length > 0, null, 'the about page and its drawer', 60000);
  // the known burst: the pre-render opens, fits, photographs and closes the
  // report card, the charts and the instrument off-stage for ~5-8 s
  p.loadQuietMs = await aboutQuiet(p.page, 'the load');
  // the page must carry exactly the catalogue's steps, in order
  const got = await p.page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.jd-step'), function (e) {
    const sec = e.closest('.jd-ph-sec');
    return [e.getAttribute('data-step'), e.getAttribute('data-scene'), sec ? sec.getAttribute('data-ph') : null];
  }));
  const want = ABOUT_STEPS.map(([a, b, c]) => [a, b, vp === 'phone' ? c : null]);
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    throw new Error(`[${label}] /about/'s steps are not capture.js's ABOUT_STEPS:\n  page:    ${JSON.stringify(got)}\n  harness: ${JSON.stringify(want)}\n` +
      'If the change is intended, update ABOUT_STEPS (and ABOUT_PHONE_FIGS) and recapture the baseline.');
  }
  return p;
}
function aboutSealCheck() {
  if (aboutSealBreaches.length) throw new Error('the demo seal leaked — writes reached the network from /about/: ' + aboutSealBreaches.join(', '));
}
async function aboutApi(page) {
  return page.evaluate(() => {
    const A = window.JD_about;
    if (!A) return null;
    const members = Object.keys(A).sort();
    const types = {};
    members.forEach(function (k) { types[k] = typeof A[k]; });
    return { members, types };
  });
}
function aboutWalkEntry(r) {
  const s = r.s;
  const e = { step: r.id, scrollY: s.scrollY, want: r.off.want, tries: r.off.tries, current: s.step };
  if (s.phone) e.section = s.section;
  else Object.assign(e, { scene: s.scene, lit: s.lit, pane: s.pane, handoff: s.handoff });
  return e;
}

// the turn card on /about/: the instrument's REAL card, never its ghost
async function aboutWaitCard(page, card, test, what) {
  await waitFor(page, ({ card, test }) => {
    const c = document.querySelector(card);
    if (!c) return false;
    if (test.view && c.getAttribute('data-view') !== test.view) return false;
    if (test.rail) {
      const r = c.querySelector('.jd-rail-step.is-current');
      if (!r || r.getAttribute('data-step') !== test.rail) return false;
    }
    if (test.armed && !c.querySelector('[data-act="' + test.armed + '"]:not([disabled])')) return false;
    return true;
  }, { card, test }, what);
}
// the sealed demo card filled as far as it goes: A..D answered, the podium
// placed, FILED (the job's file() is a no-op) — the unveil
async function aboutFillInstrument(page, card, sfx, shoot) {
  const SL = ['a', 'b', 'c', 'd'];
  await aboutWaitCard(page, card, { view: 'bench', rail: 'a' }, 'the blank demo card on drawing A');
  for (let i = 0; i < SL.length; i++) {
    await rateSlot(page, SL[i], card);
    await aboutWaitCard(page, card, { armed: 'next' }, 'NEXT to arm on drawing ' + SL[i]);
    if (i === 0) await shoot('about-instrument-rated-a-' + sfx);
    await click(page, card + ' [data-act="next"]');
    if (i < SL.length - 1) await aboutWaitCard(page, card, { view: 'bench', rail: SL[i + 1] }, 'drawing ' + SL[i + 1]);
    else await aboutWaitCard(page, card, { view: 'call' }, 'the podium');
  }
  await shoot('about-instrument-call-' + sfx);
  for (const [slot, rank] of RANKS) {
    await click(page, `${card} .jd-pod-tier[data-rank="${rank}"]`, { mouse: true });
    await click(page, `${card} .jd-pod-print[data-pod="${slot}"]`, { mouse: true });
  }
  await aboutWaitCard(page, card, { view: 'call', armed: 'file' }, 'the podium to be complete');
  await shoot('about-instrument-ranked-' + sfx);
  await click(page, card + ' [data-act="file"]');
  await aboutWaitCard(page, card, { view: 'said' }, 'the unveil');
  await shoot('about-instrument-said-' + sfx);
}

const ABOUT_GAPS = {
  'about-steps': [
    'about-steps: the HANDOFF and the RELAY are never captured mid-flight. Under prefers-reduced-motion: reduce (the harness default) layout() skips the handoff entirely — the scene switches at the boundary, no transforms, the relay stays hidden. Each step\'s state line records JD_about.handoff() at its offset (null at rest).',
    'about-steps: not driven — the timeline buttons (they smooth-scroll, passing through every step between), Enter/Space on the turn plate and the tag\'s REPORT CARD / DOWNLOAD buttons (they open the full drawer in a new tab), dragging pile items, the strip\'s pagers (.rc-alt-nav), the prompt fold (.rc-pv), the replay controls (filmstrips), the breakpoint-crossing reload (restoreStep), ?live and ?type=b|c.',
  ],
  'about-steps-after': [
    'about-steps-after: only scene 4 is captured again with the turns filed (it is the scene that reads jd-analytics.php). Scenes 1-3 are not: with items newer than the poster the drawer would scatter its slim pile afresh behind the picture, and the cards read curated items the turns do not touch.',
  ],
  'about-steps-phone': [
    'about-steps-phone: .jd-step.is-on is never moved on a phone (no stepper; the markup leaves it on "hook") and #jd-about-pane is display:none once phoneInit() has moved every scene into its .jd-ph-sec — the phone asserts JD_about.step() and the step\'s section, and captures the section in place of the pane (pixels: the viewport at the step, plus the about-figure-*-phone pages).',
    'about-figure-outro-phone: not a scene — the outro section is bare (no figure).',
    'about-steps-phone: not driven — the swipe-to-scroll / sideways-drag split on a woken pile (phoneSwipeScrolls), keepTagInWell\'s drag of a tag seated above the well, the records table\'s "Show all N prompts" button, the instrument\'s 15 s fallback note, and the dormant OPEN THE DRAWER button (PHONE_OPEN_DRAWER = false).',
  ],
};

async function groupAboutSteps() {
  const G = 'about-steps';
  const any = (pfx) => SCENES.some(([n, g]) => g === G && n.startsWith(pfx) && SELECTED(n, g));
  manifest.skipped.push(...ABOUT_GAPS[G]);
  // 1. the walk: every step, in document order
  if (any('about-step-')) {
    const reqs = new Set();
    const { context, page } = await aboutOpen('about-steps-desktop', 'desktop', reqs);
    const out = { JD_about: await aboutApi(page), steps: ABOUT_STEPS.map(([s]) => s), walk: [] };
    for (const [id] of ABOUT_STEPS) {
      const r = await aboutGoTo(page, id);
      out.walk.push(aboutWalkEntry(r));
      await aboutCapture(page, 'about-step-' + id + '-desktop', r, aboutDesktopSpec(id));
    }
    out.requests = [...reqs].sort();
    surface['about-steps'] = out;
    await context.close();
    aboutSealCheck();
  }
  // 2. the drawer wakes: the mouse enters scene 1; then a pick in the live pile
  if (any('about-wake-')) {
    const { context, page } = await aboutOpen('about-wake-desktop', 'desktop');
    const s0 = await aboutState(page);
    aboutAssert(page, s0, 'hook', 'the opening view');
    if (s0.awake) throw new Error('[about-wake-desktop] the drawer was awake before anything reached for it');
    // a point on the poster's floor (not on the live specimen or the turn plate)
    const pt = await page.evaluate(() => {
      const host = document.querySelector('#jd-about-pane [data-scene-pane="drawer"]');
      const well = host && host.querySelector('.jd-well');
      if (!well) return null;
      const r = well.getBoundingClientRect();
      const tries = [[0.12, 0.12], [0.2, 0.85], [0.88, 0.12], [0.5, 0.06]];
      for (const [fx, fy] of tries) {
        const x = Math.round(r.left + r.width * fx), y = Math.round(r.top + r.height * fy);
        const hit = document.elementFromPoint(x, y);
        if (hit && host.contains(hit) && !hit.closest('.jd-item, .jd-itemtag')) return { x, y, fx, fy };
      }
      return null;
    });
    if (!pt) throw new Error('[about-wake-desktop] found no bare spot on the poster to move the mouse to');
    await page.mouse.move(pt.x, pt.y);
    await waitFor(page, () => document.documentElement.classList.contains('jd-drawer-awake'), null, 'the drawer to wake (pointerenter)');
    let r = await aboutHere(page, 'hook', 'the wake');
    await aboutCapture(page, 'about-wake-desktop', r, aboutDesktopSpec('hook'));
    const p = await inkPoint(page, `#jd-about-pane .jd-pile > .jd-item[data-id="${ABOUT_UFO}"]`, true);
    if (!p) throw new Error('[about-wake-desktop] the woken pile shows no ink of ' + ABOUT_UFO);
    await page.mouse.click(p.x, p.y);
    await waitFor(page, (id) => !!document.querySelector('.jd-itemtag.is-on') && !!document.querySelector('.jd-item.is-picked[data-id="' + id + '"]'),
      ABOUT_UFO, 'the UFO\'s tag');
    r = await aboutHere(page, 'hook', 'the pick');
    await aboutCapture(page, 'about-wake-pick-desktop', r, aboutDesktopSpec('hook'));
    await context.close();
    aboutSealCheck();
  }
  // 3. scene 2: the demo card, filled as far as the seal lets it go
  if (any('about-instrument-')) {
    const { context, page } = await aboutOpen('about-instrument-desktop', 'desktop');
    await aboutGoTo(page, 'try');
    const CARD = '#jd-about-pane [data-scene-pane="instrument"] > .jd-inline-card:not(.jd-scene-ghost) .jd-turn';
    await aboutFillInstrument(page, CARD, 'desktop', async (name) => {
      const r = await aboutHere(page, 'try', name);
      await aboutCapture(page, name, r, aboutDesktopSpec('try'));
    });
    await context.close();
    aboutSealCheck();
  }
  // 4. scene 3's card controls, scene 4's prompt card
  if (any('about-record-') || any('about-tip-')) {
    const { context, page } = await aboutOpen('about-cards-desktop', 'desktop');
    await aboutGoTo(page, 'claude-fable-5');
    const HOST = '#jd-about-pane [data-scene-pane="record"]';
    const REC = HOST + ' > .jd-inline-card:not(.jd-scene-ghost)';
    await click(page, REC + ' .rc-axbtn');
    await waitFor(page, (c) => { const b = document.querySelector(c + ' .rc-axbtn'); return !!b && b.getAttribute('aria-expanded') === 'true'; },
      REC, 'the first category\'s definition to unfold');
    let r = await aboutHere(page, 'claude-fable-5', 'the definition');
    r.s.axbtn = await page.evaluate((c) => document.querySelector(c + ' .rc-axbtn').getAttribute('aria-expanded'), REC);
    await aboutCapture(page, 'about-record-axdef-desktop', r, aboutDesktopSpec('claude-fable-5'));
    await click(page, REC + ' .rc-alt[data-resp="2"]');
    await waitFor(page, (h) => /^alt:/.test(document.querySelector(h).__shows || ''), HOST, 'the card to turn to the third drawing');
    r = await aboutHere(page, 'claude-fable-5', 'the thumbnail');
    await aboutCapture(page, 'about-record-alt-desktop', r, aboutDesktopSpec('claude-fable-5'));
    await aboutGoTo(page, 'stack');
    const CELL = '#jd-about-pane [data-scene-pane="analytics"] > .jd-inline-card:not(.jd-scene-ghost) .jdc-sheet td.jdc-c-prompt';
    const p = await inkPoint(page, CELL, true);
    if (!p) throw new Error('[about-cards-desktop] the records table\'s first Item cell is not on screen');
    await page.mouse.move(p.x, p.y);
    await waitFor(page, () => !!document.querySelector('.jd-prompt-tip.is-on'), null, 'the prompt card');
    r = await aboutHere(page, 'stack', 'the prompt card');
    // the mouse stays on the cell: parking it would take the card down
    await aboutCapture(page, 'about-tip-desktop', r, { ...aboutDesktopSpec('stack', ['.jd-prompt-tip']), noPark: true });
    await context.close();
    aboutSealCheck();
  }
}

async function groupAboutStepsPhone() {
  const G = 'about-steps-phone';
  const any = (pfx) => SCENES.some(([n, g]) => g === G && n.startsWith(pfx) && SELECTED(n, g));
  manifest.skipped.push(...ABOUT_GAPS[G]);
  // 1. the walk, then each section's figure
  if (any('about-step-') || any('about-figure-')) {
    const reqs = new Set();
    const { context, page } = await aboutOpen('about-steps-phone', 'phone', reqs);
    const secs = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.jd-ph-sec'), function (s) {
      return [s.getAttribute('data-ph'), s.querySelectorAll(':scope > .jd-ph-fig').length];
    }));
    const wantSecs = [...ABOUT_PHONE_FIGS.map((s) => [s, s === 'gemini' || s === 'kimi' ? 2 : 1]), ['outro', 0]];
    if (JSON.stringify(secs) !== JSON.stringify(wantSecs)) {
      throw new Error(`[about-steps-phone] the phone's sections are not capture.js's ABOUT_PHONE_FIGS: page ${JSON.stringify(secs)}, harness ${JSON.stringify(wantSecs)}`);
    }
    const out = { JD_about: await aboutApi(page), steps: ABOUT_STEPS.map(([s]) => s), sections: secs, walk: [] };
    for (const [id] of ABOUT_STEPS) {
      const r = await aboutGoTo(page, id);
      out.walk.push(aboutWalkEntry(r));
      await aboutCapture(page, 'about-step-' + id + '-phone', r, aboutPhoneSpec(id));
    }
    // the figures, each paged from under the banner; every one starts from
    // (and docPages returns to) the outro's offset, whatever else was selected
    for (const sec of ABOUT_PHONE_FIGS) {
      await capture(page, 'about-figure-' + sec + '-phone', { shot: aboutFigure(sec) });
    }
    out.requests = [...reqs].sort();
    surface['about-steps-phone'] = out;
    await context.close();
    aboutSealCheck();
  }
  // 2. the drawer wakes on a tap: the pictured item under the finger is picked
  if (any('about-wake-')) {
    const { context, page } = await aboutOpen('about-wake-phone', 'phone');
    const s0 = await aboutState(page);
    aboutAssert(page, s0, 'hook', 'the opening view');
    if (s0.awake) throw new Error('[about-wake-phone] the drawer was awake before anything reached for it');
    const pt = await page.evaluate(({ fx, fy }) => {
      const well = document.querySelector('.jd-ph-sec[data-ph="drawer"] .jd-well');
      if (!well) return null;
      const r = well.getBoundingClientRect();
      const x = Math.round(r.left + r.width * fx), y = Math.round(r.top + r.height * fy);
      return x > 0 && y > 0 && x < innerWidth && y < innerHeight ? { x, y } : null;
    }, ABOUT_TAP);
    if (!pt) throw new Error('[about-wake-phone] the poster is not on screen to tap');
    await page.touchscreen.tap(pt.x, pt.y);
    await waitFor(page, () => document.documentElement.classList.contains('jd-drawer-awake'), null, 'the drawer to wake (a tap)');
    const r = await aboutHere(page, 'hook', 'the wake');
    if (!r.s.picked.some((id) => id !== CURATED_ITEM)) {      // (the succulent is the page's own specimen)
      manifest.warnings.push(`[about-wake-phone] the tap at ${JSON.stringify(ABOUT_TAP)} woke the drawer but picked no pictured item (picked: ${JSON.stringify(r.s.picked)})`);
    }
    await aboutCapture(page, 'about-wake-phone', r, { ...aboutPhoneSpec('hook') });
    await context.close();
    aboutSealCheck();
  }
  // 3. the instrument, in its own phone layout, filled to the unveil
  if (any('about-instrument-')) {
    const { context, page } = await aboutOpen('about-instrument-phone', 'phone');
    await aboutGoTo(page, 'try');
    const SEC = '.jd-ph-sec[data-ph="instrument"]';
    const CARD = SEC + ' .jd-ph-card .jd-turn';
    await aboutFillInstrument(page, CARD, 'phone', async (name) => {
      // where the reader's taps left the page; the step it makes current is
      // recorded, not asserted (the card turning a page scrolls the page)
      const r = await aboutHere(page, null, name);
      await aboutCapture(page, name, r, { surfaces: [SEC], prune: 'display-none', shot: aboutFigure('instrument') });
    });
    await context.close();
    aboutSealCheck();
  }
  // 4. the Fable card's controls, the records table's prompt card
  if (any('about-record-') || any('about-tip-')) {
    const { context, page } = await aboutOpen('about-cards-phone', 'phone');
    await aboutGoTo(page, 'claude-fable-5');
    const SEC = '.jd-ph-sec[data-ph="fable"]';
    const CARD = SEC + ' > .jd-ph-fig > .jd-ph-card';
    const cardSpec = { surfaces: [SEC], prune: 'display-none', shot: aboutFigure('fable') };
    // ON A PHONE THIS DOES NOTHING TODAY: recordControls() finds the
    // definition through ax.closest('.jd-inline-card'), and the phone's cards
    // are .jd-ph-card — captured as it is (the state line records
    // aria-expanded), so a fix shows up as a difference, not as a timeout
    await click(page, CARD + ' .rc-axbtn');
    let r = await aboutHere(page, null, 'the definition');
    r.s.axbtn = await page.evaluate((c) => { const b = document.querySelector(c + ' .rc-axbtn'); return b && b.getAttribute('aria-expanded'); }, CARD);
    await aboutCapture(page, 'about-record-axdef-phone', r, cardSpec);
    await page.evaluate((c) => { window.__jdrOldCard = document.querySelector(c); }, CARD);
    await click(page, CARD + ' .rc-alt[data-resp="2"]');
    await waitFor(page, (c) => { const n = document.querySelector(c); return !!n && n !== window.__jdrOldCard; }, CARD, 'the Fable card to turn to the third drawing');
    await page.evaluate(() => { window.__jdrOldCard = null; });
    r = await aboutHere(page, null, 'the thumbnail');
    await aboutCapture(page, 'about-record-alt-phone', r, cardSpec);
    await aboutGoTo(page, 'stack');
    const TSEC = '.jd-ph-sec[data-ph="turns"]';
    const CELL = TSEC + ' .jdc-sheet td.jdc-c-prompt';
    // the cell is brought to the middle of the screen first (a scroll the page
    // answers by hiding the prompt card), then clicked where it stands
    const box = await page.evaluate(async (c) => {
      const el = document.querySelector(c);
      if (!el) return null;
      const T = window.__jdrST || window.setTimeout;
      await new Promise((res) => {
        const r0 = el.getBoundingClientRect();
        if (r0.top > innerHeight * 0.3 && r0.bottom < innerHeight * 0.7) return res();
        window.addEventListener('scroll', res, { once: true });
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
        T(res, 1500);
      });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + Math.min(r.width / 2, 40)), y: Math.round(r.top + r.height / 2) };
    }, CELL);
    if (!box) throw new Error('[about-cards-phone] no Item cell in the records table');
    await aboutQuiet(page, 'the records table');
    // a MOUSE click, not a tap: with Playwright's emulated tap the card comes
    // up on the tap's click and is taken down 3 ms later by a mouseover on the
    // site banner (Chromium re-dispatching hover at a stale pointer position
    // once the card has laid out) — see README, "Known gaps"
    pageState.get(page).mouseUsed = true;
    await page.mouse.click(box.x, box.y);
    await waitFor(page, () => !!document.querySelector('.jd-prompt-tip.is-on'), null, 'the prompt card');
    r = await aboutHere(page, null, 'the prompt card');
    await aboutCapture(page, 'about-tip-phone', r, { surfaces: ['.jd-prompt-tip', TSEC], prune: 'display-none', shot: 'viewport', noPark: true });
    await context.close();
    aboutSealCheck();
  }
}

// scene 4 once the turns are filed (the DB the `after` group reads): the
// page jumps from the top straight to each step, as a deep link would
async function groupAboutStepsAfter() {
  const G = 'about-steps-after';
  const any = (sfx) => SCENES.some(([n, g]) => g === G && n.endsWith(sfx) && SELECTED(n, g));
  manifest.skipped.push(...ABOUT_GAPS[G]);
  if (any('-desktop')) {
    const { context, page } = await aboutOpen('about-steps-after-desktop', 'desktop');
    for (const id of ABOUT_AFTER_STEPS) {
      const r = await aboutGoTo(page, id);
      await aboutCapture(page, 'about-step-' + id + '-after-desktop', r, aboutDesktopSpec(id));
    }
    await context.close();
    aboutSealCheck();
  }
  if (any('-phone')) {
    const { context, page } = await aboutOpen('about-steps-after-phone', 'phone');
    for (const id of ABOUT_AFTER_STEPS) {
      const r = await aboutGoTo(page, id);
      await aboutCapture(page, 'about-step-' + id + '-after-phone', r, aboutPhoneSpec(id));
    }
    for (const id of ABOUT_AFTER_STEPS) {
      const [, , sec] = ABOUT_STEPS.find(([x]) => x === id);
      await capture(page, 'about-figure-' + sec + '-after-phone', { shot: aboutFigure(sec) });
    }
    await context.close();
    aboutSealCheck();
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
async function rateSlot(page, slot, scope = '.jd-turn') {
  const sels = await page.$$(`${scope} select.jd-turn-select[data-slot="${slot}"]`);
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
    'about-steps': groupAboutSteps, 'about-steps-phone': groupAboutStepsPhone, 'about-steps-after': groupAboutStepsAfter,
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
