// ============================================================================
// ZANKYŌ — the bank: re-derives _harness-base.json (THE DELIBERATE RE-BASE).
//
// The harness gates each seed's melodic density against its own banked value
// (±20 %), so a change that moves the home stream on purpose — road map §1's
// melodic DNA was one — must re-bank, declared in the commit that does it.
// This runs the harness once per seed with ZK_BANK=1, gathers the BANK lines,
// and writes the file the harness reads, in the shape it already had.
//
// Usage: node _harness-bank.js [seconds=1800] [--seeds "3042 7 …"] [--par 4]
//   Default seeds: the base's own forty (the crew's four + 101–136).
// ============================================================================
"use strict";
const { execFile } = require("child_process");
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const args = process.argv.slice(2);
const RUN = parseFloat(args[0] && !args[0].startsWith("--") ? args[0] : "1800") || 1800;
let seeds = null, par = 4, dry = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--seeds") seeds = args[++i].split(/[\s,]+/).filter(Boolean).map(Number);
  else if (args[i] === "--par") par = parseInt(args[++i], 10) || 4;
  else if (args[i] === "--dry") dry = true;   // measure and report, write nothing (a before/after)
}
const os = require("os");
const shapeDir = fs.mkdtempSync(path.join(os.tmpdir(), "zk-shapes-"));
if (!seeds) { seeds = [3042, 17, 7, 8891]; for (let s = 101; seeds.length < 40; s++) seeds.push(s); }
const OUT = path.join(__dirname, "_harness-base.json");
const old = (() => { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { return null; } })();

function engineSig() {
  const h = crypto.createHash("sha1");
  const files = ["zankyo-audio.js"].concat(fs.readdirSync(__dirname).filter((f) => /^zk-.*\.js$/.test(f)).sort());
  for (const f of files) h.update(f).update(fs.readFileSync(path.join(__dirname, f)));
  return h.digest("hex").slice(0, 12);
}
function commitShort() { try { return require("child_process").execSync("git rev-parse --short HEAD", { cwd: __dirname }).toString().trim(); } catch (e) { return null; } }

const results = {}, queue = seeds.slice(); let running = 0, failed = 0;
function next() {
  while (running < par && queue.length) {
    const seed = queue.shift(); running++;
    execFile(process.execPath, [path.join(__dirname, "_harness.js"), String(RUN), String(seed)], { env: Object.assign({}, process.env, { ZK_BANK: "1", ZK_SHAPES: path.join(shapeDir, seed + ".json") }), maxBuffer: 1 << 26 }, (err, stdout) => {
      running--;
      const m = /^BANK (.*)$/m.exec(stdout || "");
      if (!m) { failed++; console.error("seed " + seed + ": no BANK line" + (err ? " (" + err.message.split("\n")[0] + ")" : "")); }
      else { const r = JSON.parse(m[1]); results[seed] = r; console.log("seed " + seed + ": " + (r.home ? "home" : "far ") + " · " + r.density + "/30 min · shapes " + r.shapesPerHour + "/h · heard-before " + Math.round(100 * r.shapeHeardBefore) + "%"); }
      if (queue.length) next(); else if (!running) finish();
    });
  }
}
// THE CROSS-NIGHT MEASURE — the owner's complaint was between nights, not
// within one: "the instruments sound like the same instruments every night".
// For every pair of home nights, the Jaccard overlap of their phrase-shape
// sets; and for each night, the share of its phrases whose shape sounds on
// at least half of the OTHER home nights (the "every night" shapes). Lower
// is more different nights; the union is how much melody the pool holds.
function crossNight() {
  const sets = {}, counts = {};
  for (const seed of seeds) {
    const r = results[seed]; if (!r || !r.home) continue;
    try { const j = JSON.parse(fs.readFileSync(path.join(shapeDir, seed + ".json"), "utf8")); sets[seed] = new Set(Object.keys(j.shapes)); counts[seed] = j.shapes; } catch (e) {}
  }
  const ids = Object.keys(sets); if (ids.length < 2) return null;
  let jac = 0, pairs = 0; const union = new Set(), inNights = {};
  for (const a of ids) for (const sh of sets[a]) { union.add(sh); inNights[sh] = (inNights[sh] || 0) + 1; }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = sets[ids[i]], B = sets[ids[j]]; let inter = 0; for (const sh of A) if (B.has(sh)) inter++;
    jac += inter / (A.size + B.size - inter); pairs++;
  }
  let everyNight = 0, total = 0;
  for (const a of ids) for (const sh in counts[a]) { total += counts[a][sh]; if ((inNights[sh] - 1) >= (ids.length - 1) / 2) everyNight += counts[a][sh]; }
  const common = Object.keys(inNights).sort((x, y) => inNights[y] - inNights[x]).slice(0, 4).map((k) => k + "@" + inNights[k]);
  return { homeNights: ids.length, unionShapes: union.size, meanJaccard: +(jac / pairs).toFixed(4), everyNightShare: +(everyNight / total).toFixed(4), commonest: common };
}
function finish() {
  const home = {}, seedDensity = {}, phrases = {}, homeDs = [];
  for (const seed of seeds) { const r = results[seed]; if (!r) continue; home[seed] = !!r.home; seedDensity[seed] = r.density; phrases[seed] = { shapesPerHour: r.shapesPerHour, shapeHeardBefore: r.shapeHeardBefore }; if (r.home) homeDs.push(r.density); }
  homeDs.sort((a, b) => a - b);
  const q = (p) => homeDs.length ? homeDs[Math.min(homeDs.length - 1, Math.floor(p * (homeDs.length - 1)))] : null;
  const meta = {
    instrument: "_harness.js", runS: RUN, signalMock: process.env.ZK_SIGNAL_MOCK || "ready",
    signalNote: (old && old.meta && old.meta.signalNote) || "Reels PLAY and broadcasts HOLD THE AIR.",
    seeds: Object.keys(seedDensity).length, homeSeeds: homeDs.length, seedList: seeds.filter((s) => results[s]),
    commit: commitShort(), engine: engineSig(), written: new Date().toISOString(),
    repeatability: "exact — the instrument is deterministic per seed; the ±20 % band is a policy threshold, not an error bar",
    rebase: "re-derived by _harness-bank.js; the commit that re-banked says why",
    homeMin: homeDs[0] || null, homeP5: q(0.05), homeMedian: q(0.5), homeMax: homeDs[homeDs.length - 1] || null,
  };
  const cn = crossNight(); if (cn) meta.crossNight = cn;
  console.log("cross-night (" + (cn ? cn.homeNights : 0) + " home nights): union " + (cn ? cn.unionShapes : "—") + " shapes · mean pairwise overlap " + (cn ? (100 * cn.meanJaccard).toFixed(2) + "%" : "—") +
    " · every-night share " + (cn ? (100 * cn.everyNightShare).toFixed(1) + "%" : "—") + " · commonest " + (cn ? cn.commonest.join(" ") : "—"));
  const homeMean = homeDs.length ? Math.round(homeDs.reduce((a, b) => a + b, 0) / homeDs.length) : null;
  console.log((dry ? "DRY — not written" : "wrote " + OUT) + " · " + meta.seeds + " seeds (" + meta.homeSeeds + " home) · home " + meta.homeMin + "–" + meta.homeMax + ", median " + meta.homeMedian + ", mean " + homeMean + (failed ? " · " + failed + " FAILED" : ""));
  if (!dry) fs.writeFileSync(OUT, JSON.stringify({ meta, home, seedDensity, phrases }, null, 1) + "\n");
  try { fs.rmSync(shapeDir, { recursive: true, force: true }); } catch (e) {}
  process.exit(failed ? 1 : 0);
}
next();
