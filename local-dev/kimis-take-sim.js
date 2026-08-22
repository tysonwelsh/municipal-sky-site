/* kimis-take-sim.js — headless proof of the traffic manager (paths edition).

   Runs art/kimis-take/kimis-take.js against a stub DOM and a fake clock,
   advances two simulated minutes in 25ms steps, fires each head glyph's
   animationiteration at its scheduled wrap, and at every step recomputes
   every live stream's occupied cells FROM ITS PATH (glyph j's one-cell box
   rides at arclength s−j along the path — the same geometry the CSS
   offset-path animation renders) — asserting no grid cell is ever touched
   by two strips at once. Also reports turning-path share and live count.

   Run: node local-dev/kimis-take-sim.js [streams]
*/
'use strict';
const fs = require('fs');
const path = require('path');

let NOW = 0; // fake clock, ms

const intervals = [];
global.setInterval = (fn, ms) => { intervals.push({ fn, ms, last: 0 }); return intervals.length; };
global.clearInterval = () => {};
global.setTimeout = (fn) => { fn(); return 0; }; // mount's build retry: run now
global.performance = { now: () => NOW };
global.location = { search: '?debug' };
global.window = { matchMedia: () => ({ matches: false }) };
global.CSS = { supports: () => true };
global.window.CSS = global.CSS;
global.requestAnimationFrame = () => 0;  // positions are asserted from plans,
global.cancelAnimationFrame = () => {};  // the frame loop itself is not needed
global.getComputedStyle = () => ({
  getPropertyValue: (p) => (p === '--cr-cell' ? '18px' : ''),
});

function fakeEl(tag) {
  const el = {
    tagName: tag, children: [], attrs: {}, _ls: {},
    className: '', textContent: '', parentNode: null,
    style: { setProperty() {}, },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); },
    addEventListener(t, fn) { this._ls[t] = fn; },
  };
  Object.defineProperty(el, 'firstChild', { get() { return this.children[0] || null; } });
  return el;
}

const host = fakeEl('span');
host.clientWidth = 1206;   // 67 cols — match the browser probe's sheet
host.clientHeight = 738;   // 41 rows
Object.defineProperty(host, 'innerHTML', { set() { host.children.length = 0; } });

global.document = {
  createElement: fakeEl,
  createDocumentFragment: () => fakeEl('fragment'),
};

const errors = [];
const origErr = console.error;
console.error = (...a) => { errors.push(a.join(' ')); origErr(...a); };

eval(fs.readFileSync(path.join(__dirname, '..', 'art', 'kimis-take', 'kimis-take.js'), 'utf8'));

const KT = global.window.KimisTake;
if (!KT) { console.error('FATAL: window.KimisTake not exported'); process.exit(1); }
const N = parseInt(process.argv[2] || '8', 10);
const DIRS = [];
for (let i = 0; i < N; i++) DIRS.push(['d', 'u', 'r', 'l'][i % 4]);
KT.mount(host, { dirs: DIRS });

const COLS = Math.floor(1206 / 18), ROWS = Math.floor(738 / 18);
console.log(`grid: ${COLS} x ${ROWS} cells, cast: ${N} streams`);

/* forensic audit: pairwise window conflicts among live streams' plans —
   the exact check the python analysis of browser dumps performs */
let bookingConflicts = 0;
function auditBookings() {
  const recs = [];
  for (const st of host.children) {
    const rec = st.__rec;
    if (rec && rec.plan) recs.push(rec);
  }
  for (let a = 0; a < recs.length; a++) for (let b = a + 1; b < recs.length; b++) {
    const pa = recs[a].plan, pb = recs[b].plan;
    const wa = {};
    pa.cells.forEach((c, i) => {
      if (c[0] < 0 || c[0] >= COLS || c[1] < 0 || c[1] >= ROWS) return;
      wa[(c[1] << 10) | c[0]] = [pa.t0 + (i - 0.5) / pa.v, pa.t0 + (i + pa.len - 0.5) / pa.v];
    });
    pb.cells.forEach((c, i) => {
      if (c[0] < 0 || c[0] >= COLS || c[1] < 0 || c[1] >= ROWS) return;
      const k = (c[1] << 10) | c[0];
      if (!wa[k]) return;
      const wb = [pb.t0 + (i - 0.5) / pb.v, pb.t0 + (i + pb.len - 0.5) / pb.v];
      if (wa[k][0] < wb[1] && wb[0] < wa[k][1]) {
        bookingConflicts++;
        if (bookingConflicts <= 5) {
          console.error(`BOOKING CONFLICT: streams ${recs[a].id} and ${recs[b].id} at cell ${k}, ` +
                        `A born seed/plan t0=${pa.t0.toFixed(2)}, B t0=${pb.t0.toFixed(2)}`);
        }
      }
    });
  }
}

/* continuous replay: head rides at arclength s = v·(t−t0) cells along the
   path (cell i's centre at arclength i); glyph j is at s−j, its one-square
   box touching path cells whose centres lie within half a cell of it. */
function occupiedCells(rec, t) {
  const p = rec.plan;
  const s = p.v * (t - p.t0);
  const out = [];
  for (let j = 0; j < p.len; j++) {
    const q = s - j;
    const lo = Math.ceil(q - 0.5 - 1e-9), hi = Math.floor(q + 0.5 + 1e-9);
    for (let i = Math.max(0, lo); i <= Math.min(p.P - 1, hi); i++) {
      const c = p.cells[i][0], r = p.cells[i][1];
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) out.push((r << 10) | c);
    }
  }
  return out;
}

function isTurner(rec) {
  const c = rec.plan.cells;
  for (let i = 1; i < c.length - 1; i++) {
    const dc = c[i][0] - c[i - 1][0], dr = c[i][1] - c[i - 1][1];
    const ec = c[i + 1][0] - c[i][0], er = c[i + 1][1] - c[i][1];
    if (dc !== ec || dr !== er) return true;
  }
  return false;
}

let born = 0, wrapped = 0, overlapEvents = 0, maxLive = 0, turners = 0;
let vSum = 0, hSum = 0, mixSamples = 0;
let stubbornBorn = 0, stubbornKept = 0, stubbornGaveUp = 0;
const seen = new Set();
const livePlans = new Map();   // id -> plan, to score exits at retirement

const DVEC = { d: [0, 1], u: [0, -1], r: [1, 0], l: [-1, 0] };
function exitMatchesCommission(p) {
  const P = p.P;
  const dc = p.cells[P - 1][0] - p.cells[P - 2][0];
  const dr = p.cells[P - 1][1] - p.cells[P - 2][1];
  const want = DVEC[p.dir];
  return dc === want[0] && dr === want[1];
}

const SIM_SECONDS = 120, STEP_MS = 25;
for (let step = 0; step <= SIM_SECONDS * 1000 / STEP_MS; step++) {
  NOW = step * STEP_MS;
  const t = NOW / 1000;

  for (const iv of intervals) {
    if (NOW - iv.last >= iv.ms) { iv.last = NOW; iv.fn(); }
  }
  if (step % 40 === 0) auditBookings();   // once a simulated second

  // wraps are retired inside the real planner tick — nothing to emulate here

  // overlap assertion across all currently live streams
  const occ = new Map();
  let liveNow = 0;
  for (const st of host.children) {
    const rec = st.__rec;
    if (!rec || !rec.plan) continue;
    if (!seen.has(rec.id)) { seen.add(rec.id); born++; if (isTurner(rec)) turners++; }
    livePlans.set(rec.id, rec.plan);
    if (t < rec.plan.t0) continue;
    liveNow++;
    /* on-screen axis share: which way is each strip travelling right now */
    if (t > 5) {
      const p = rec.plan;
      const i = Math.max(0, Math.min(p.P - 2, Math.floor(p.v * (t - p.t0))));
      if (p.cells[i][0] === p.cells[i + 1][0]) vSum++; else hSum++;
      mixSamples++;
    }
    for (const key of occupiedCells(rec, t)) {
      if (occ.has(key)) {
        overlapEvents++;
        if (overlapEvents <= 5) {
          console.error(`OVERLAP at t=${t.toFixed(2)}s cell ${key}: streams ${occ.get(key)} and ${rec.id}`);
        }
      } else {
        occ.set(key, rec.id);
      }
    }
  }
  maxLive = Math.max(maxLive, liveNow);

  // retirements: a stream that vanished since the last sample ran its course
  for (const [id, p] of livePlans) {
    let stillThere = false;
    for (const st of host.children) {
      if (st.__rec && st.__rec.id === id) { stillThere = true; break; }
    }
    if (!stillThere) {
      livePlans.delete(id);
      wrapped++;
      if (p.stubborn) {
        stubbornBorn++;
        if (exitMatchesCommission(p)) stubbornKept++;
        else stubbornGaveUp++;
      }
    }
  }
}

console.log(`simulated ${SIM_SECONDS}s: ${born} born (${turners} turning, ${born - turners} straight), ${wrapped} retired, max ${maxLive} live`);
if (stubbornBorn) {
  console.log(`stubborn commissions: ${stubbornKept}/${stubbornBorn} kept (${(100 * stubbornKept / stubbornBorn).toFixed(0)}%), ${stubbornGaveUp} gave up`);
}
if (mixSamples) {
  console.log(`axis share on screen: ${(100 * vSum / mixSamples).toFixed(1)}% vertical / ${(100 * hSum / mixSamples).toFixed(1)}% horizontal`);
}
console.log(errors.length ? `double-booking errors: ${errors.length}` : 'reservation table: clean');
console.log(bookingConflicts ? `BOOKING CONFLICTS: ${bookingConflicts}` : 'booking audit: clean');
console.log(overlapEvents ? `OVERLAP EVENTS: ${overlapEvents}` : 'overlaps: none — traffic manager holds');
process.exit(errors.length || overlapEvents ? 1 : 0);
