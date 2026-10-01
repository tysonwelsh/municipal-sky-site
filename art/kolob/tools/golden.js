#!/usr/bin/env node
// ============================================================================
// KOLOB — tools/golden.js: does the pure core compose what it composed?
// (2026-10-01, PLAN-REFACTOR §3.6)
//
//   node art/kolob/tools/golden.js                      compare seeds 1–40 with tools/golden/*.json
//   node art/kolob/tools/golden.js --write              write the baseline (an intended change: the same commit)
//   node art/kolob/tools/golden.js --show hymns 17      the canonical JSON one hash is taken of
//   options: --seeds 1-40 · --engine <dir>|git:<ref> (default this worktree) · --jobs N · --per 5
//
// A seed that differs is read by its JSON on both builds: --show <kind>
// <seed> --engine git:HEAD > a.json, the same on the worktree > b.json, and
// diff the two.
//
// The tally (tools/tally.js) proves a change left the music alone by playing
// twenty meetings through the harness, ten minutes. Most of the engine's
// thinking is pure — the composer, the dialects, the hymnists, the hymnal's
// plan and forms, the calendar, the cast, the organist, every guest room's
// decide() — and a change to one of those is proved here in seconds: for
// each seed, the first meeting of a fresh visit is planned and its hymns
// written, and five results are hashed, one file of hashes each:
//
//   meeting   what planMeeting leaves (kolob-meeting.js): the Sunday the
//             calendar drew (its die and its answer), the order of service
//             (each rite's type, length, meter and light, holds included),
//             the guests seated and refused, the seatings, the day's
//             hymnal and forms, the reckoning's order, the Hosanna, the
//             testimony, the chorale prelude, and every event it emitted
//   hymns     the hymnal's orders (prepare's rows, forms and reckoning) and
//             every order written by the hymnal's own write() — the same
//             others, the same dependency, the doxology's reckoning and its
//             candidates, a partner where drawn, the refrain — the Score as
//             get() returns it
//   guests    each guest room's decide(), on the info planMeeting handed its
//             plan(), on a fresh guest:<name>:<n>
//   organist  the organist as seated, the prelude draw, the chorale prelude
//             where drawn, and for each hymn the organ plays (in the day's
//             order, the ledger carried) the walk into a keyed hymn's key
//             (modulate) and the organist's hands on it (accompany: the
//             giving out, every verse, the interludes, the amen)
//   ward      the ward as seated (Cast.seat) and its plan for each of the
//             day's hymns (Cast.planHymn)
//
// HOW IT IS COMPUTED. The seeds are planned five to a process (PER, --per),
// each a fresh visit: tools/lib/engine.js loads _engine.php's one list in its
// order under a bare mock of the page (the loader tools/loadcheck.js uses),
// the dice are reseeded as GATHER reseeds them (KolobAudio.reseed), and the
// meeting is planned by the core's own entry, S.planMeeting(t), as the
// downbeat's cue calls it — there is no AudioContext, no clock and no cue:
// the core's cueAt does nothing without one, and every event is told at t 0.
// One lend is answered as the page answers it: S.pipeOn() asks whether the
// pipe organ has an AudioContext to sound in (kolob-voices-organ.js), and
// without one the planner would seat no organist's variations and draw no
// chorale prelude; the golden says the pipes are on, as every page with
// sound does.
// tools/selftest.js §14 holds the events planMeeting emits here against the
// harness's at the downbeat of the same seeds. Timers are written down and
// never run (the hymnal's idle road, the variations' readiness poll), and
// performance.now stands at 0 (the hymnal times each hymn it writes, for its
// stats). The hymns are written by KOLOB.Hymnal.get(), the "late" road of
// kolob-hymnal.js — write() itself, the function the idle road calls, and
// the worker the same errand.
//   The pure planners the meeting calls — the calendar's draw, the hymnal's
// plan and forms, each guest room's plan, Cast.seat, the organist's seat
// and prelude draw — are watched as they are called (their arguments kept
// as handed), and each is called again by the golden on a fresh stream of
// the same label, which must give what it gave the meeting: a planner that
// read anything but its arguments and its stream's birth seed would fail
// here, by name. The ward's and the organist's hymns (Cast.planHymn,
// Organist.modulate and accompany) are the golden's own walk, the labs' way
// (cast-lab.js, organist-lab.js): the hymn's own streams, the Cast's own
// count of verses, the hymn's own beat. The performer's walk — the verses
// the section has room for, the chorister's tempo and clock, the interlude
// a fuging displaces — belongs to kolob-voices-choir.js, a room that keeps
// time, and is the tally's to watch.
//   THE TRAP: while a seed is planned and composed, Math.random and Date.now
// throw, and the call is told with where it came from; nothing in the pure
// core calls either today (the trap is left off for no kind — TRAP_OFF).
//
// THE HASH: SHA-1 of the result as canonical JSON — every object's keys
// sorted, numbers as JSON writes them (exact, never rounded; NaN and the
// infinities as their names), a function as "ƒ", a PJ2.Rand stream as the
// first draw of its fork "golden:probe" (which names its birth seed without
// moving it), a reference to an enclosing object as "⟨cycle⟩".
//
// WHAT IT CANNOT SEE. The rooms that keep time and build nodes: the voices
// (kolob-voices-*.js), the conductor past the plan (enterSection's turns,
// the conductor's tick, the joints, the chord desk), the set pieces
// (kolob-guests.js), every guest's prepare(), score() and perform(), the
// choir's performance of a hymn, the core, the hymnal's worker and idle
// roads as such, any meeting after the first, and the switches (ives,
// force=, cumulative, razz, exp=). Those are the tally's. A change the
// golden calls clean has not moved the pure core on these seeds; it says
// nothing of the rest.
//
// RE-BASELINE after a change that moves the pure core on purpose: run
// --write in the same commit, and say in the commit message what moved and
// why (the kinds and seeds the comparison named before the write).
// Exit 0: every seed of every kind matches (or the baseline was written);
// 1: a seed differs, is missing from the baseline, or a seed faulted. (The
// exit code is set, never forced: a --show piped to another program is
// written whole.)
// ============================================================================
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const E = require("./lib/engine.js");
const W = require("./lib/witness.js");
const U = require("./lib/util.js");

const HERE = path.resolve(__dirname, "..");                         // art/kolob
const GOLDEN = path.join(__dirname, "golden");
const SEEDS = "1-40";
// seeds a process: each process loads the engine once and plans its seeds in
// turn, each a fresh visit (KolobAudio.reseed, as GATHER calls one), in
// groups that do not depend on the machine (--per 1: a process a seed, the
// same hashes — a visit leaves nothing to the next)
const PER = 5;
const KINDS = ["meeting", "hymns", "guests", "organist", "ward"];
const COVERS = {
  meeting: "planMeeting for meeting 1 of a fresh visit: the Sunday's draw, the order of service, guests, seatings, hymnal rows, forms, reckoning, events",
  hymns: "the hymnal's orders and every order written by kolob-hymnal.js write() (get), the Score as returned",
  guests: "each guest room's decide() on the info planMeeting handed its plan(), on a fresh guest:<name>:<n>",
  organist: "Organist.seat and preludeDraw as the meeting called them; prelude, modulate and accompany over the day's hymns",
  ward: "Cast.seat as the meeting called it; Cast.planHymn for each of the day's hymns",
};
// the kinds the trap is left off for, and why (none: nothing pure calls Math.random or Date.now)
const TRAP_OFF = {};

// ----------------------------------------------------------------------------
// The canonical JSON and its hash
// ----------------------------------------------------------------------------
function isStream(x) { return !!x && typeof x.fork === "function" && typeof x.next === "function" && typeof x.pickW === "function"; }
function probe(s) { return s.fork("golden:probe").next(); }        // a fork's draw: the parent is not moved
function canon(x, stack) {
  if (x === undefined) return undefined;
  if (x === null || typeof x === "string" || typeof x === "boolean") return x;
  if (typeof x === "number") return isFinite(x) ? x : String(x);
  if (typeof x === "function") return "ƒ";
  if (typeof x !== "object") return String(x);
  if (isStream(x)) return "⟨stream " + probe(x) + "⟩";
  stack = stack || [];
  if (stack.indexOf(x) >= 0) return "⟨cycle⟩";
  stack.push(x);
  let out;
  if (ArrayBuffer.isView(x)) out = Array.from(x, (v) => canon(v, stack));
  else if (Array.isArray(x)) out = x.map((v) => { const c = canon(v, stack); return c === undefined ? null : c; });
  else { out = {}; Object.keys(x).sort().forEach((k) => { const c = canon(x[k], stack); if (c !== undefined) out[k] = c; }); }
  stack.pop();
  return out;
}
function text(x) { return JSON.stringify(canon(x)); }
function sha1(s) { return crypto.createHash("sha1").update(s).digest("hex"); }
// a deep copy of what a planner was handed, as it was handed (the meeting
// goes on to change its own records): streams and functions by reference
function cloneDeep(x, seen) {
  if (x === null || typeof x !== "object" || isStream(x)) return x;
  seen = seen || new Map();
  if (seen.has(x)) return seen.get(x);
  if (ArrayBuffer.isView(x)) return x.slice();
  const out = Array.isArray(x) ? [] : {};
  seen.set(x, out);
  Object.keys(x).forEach((k) => { out[k] = cloneDeep(x[k], seen); });
  return out;
}

// ----------------------------------------------------------------------------
// The child: one engine, loaded headless; the seeds it is given
// ----------------------------------------------------------------------------
function child(dir, seeds, emit) {
  const said = [];                                                    // the engine's console, kept: a word from it is a fault
  ["log", "info", "warn", "error"].forEach((k) => { console[k] = function () { said.push(k + ": " + Array.prototype.map.call(arguments, (a) => (a && a.message) || String(a)).join(" ")); }; });
  const write = (o) => process.stdout.write(JSON.stringify(o) + "\n");
  // the page without audio or a clock: an address that names a seed (so the
  // core does not ask the hour at load), timers written down and never run,
  // a performance.now that stands still
  E.mockPage({ search: "?seed=1" });
  let armed = 0;
  const never = () => ++armed;
  global.setTimeout = global.setInterval = global.requestAnimationFrame = global.requestIdleCallback = never;
  global.clearTimeout = global.clearInterval = global.cancelAnimationFrame = global.cancelIdleCallback = () => {};
  Object.defineProperty(global, "performance", { configurable: true, writable: true, value: { now: () => 0 } });
  const ev = E.evaluate(dir, E.engineList(dir));
  if (ev.failures.length) { write({ fail: "the engine did not load: " + ev.failures.join("; ") }); return; }
  const fingerprint = W.fingerprintOf(ev.read);
  const K = global.KOLOB, S = K._s, P = global.PJ2, KA = global.KolobAudio, B = S.Meeting;
  // (the pipes are on, as on every page with sound: see HOW IT IS COMPUTED)
  S.pipeOn = function () { return true; };

  // the pure planners, watched while the meeting is planned
  let rec = null;
  function watch(obj, name, tag, also) {
    const fn = obj && obj[name];
    if (typeof fn !== "function") return;
    obj[name] = function () {
      if (!rec) return fn.apply(this, arguments);
      const call = { tag, args: Array.prototype.map.call(arguments, (a) => cloneDeep(a)), probes: Array.prototype.map.call(arguments, (a) => (isStream(a) ? probe(a) : null)) };
      if (also) also(call, arguments);
      rec.calls.push(call);
      const res = fn.apply(this, arguments);
      call.res = cloneDeep(res);
      return res;
    };
  }
  const CAL = K.Calendar;
  watch(CAL, "draw", "calendar.draw");
  watch(CAL, "scenes", "calendar.scenes", (call, a) => { rec.plan = a[0]; });     // (the plan itself, to read once it is held)
  watch(K.Hymnal, "plan", "hymnal.plan");
  watch(K.Hymnal, "forms", "hymnal.forms");
  watch(K.Hymnal, "prepare", "hymnal.prepare");
  watch(K.Cast, "seat", "cast.seat");
  watch(K.Organist, "seat", "organist.seat");
  watch(K.Organist, "preludeDraw", "organist.preludeDraw");
  const ROOMS = Object.keys(K).filter((k) => /^Guest[A-Z]|^Testimony$/.test(k) && K[k] && typeof K[k].plan === "function" && typeof K[k].decide === "function" && K[k].LABEL).sort();
  ROOMS.forEach((k) => watch(K[k], "plan", "guest", (call) => { call.room = k; }));
  let events = null;
  KA.setEventListener((e) => { if (events) { const o = cloneDeep(e); delete o.t; events.push(o); } });

  const realRandom = Math.random, realNow = Date.now;
  for (const seed of seeds) {
    const t0 = process.hrtime.bigint();
    const faults = [], hash = {}, json = {};
    said.length = 0;
    const root = P.Rand.stream(seed);
    // a planner called again on a fresh stream of the label the meeting used
    // must give what it gave the meeting
    const fresh = (call, i, label) => {
      const R = root.fork(label);
      if (call.probes[i] !== probe(R)) faults.push(call.tag + (call.room ? " (" + call.room + ")" : "") + " was handed a stream that is not " + label);
      return R;
    };
    const same = (what, a, b) => { if (text(a) !== text(b)) faults.push(what + " on a fresh stream did not give what it gave the meeting (not pure on its arguments and its stream)"); };
    const kind = (name, fn) => {
      const hits = [];
      // (who called: the two frames under the trap, by file name and line)
      const caller = (e) => e.stack.split("\n").slice(2, 4).map((l) => { const x = /at (?:Object\.)?(\S+) \((.*):(\d+):\d+\)$/.exec(l.trim()); return x ? x[1] + " (" + path.basename(x[2]) + ":" + x[3] + ")" : l.trim(); }).join(" ← ");
      if (!TRAP_OFF[name]) {
        Math.random = function () { const e = new Error("Math.random() while the golden computed " + name); hits.push("Math.random() in " + name + ": " + caller(e)); throw e; };
        Date.now = function () { const e = new Error("Date.now() while the golden computed " + name); hits.push("Date.now() in " + name + ": " + caller(e)); throw e; };
      }
      let r;
      try { r = fn(); }
      catch (e) { faults.push(name + " threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); }
      finally { Math.random = realRandom; Date.now = realNow; }
      hits.forEach((h) => faults.push("the trap: " + h));
      if (r !== undefined) {
        const t = JSON.stringify(canon(r));
        hash[name] = sha1(t);
        if (emit === name) json[name] = canon(r);
      }
      return r;
    };

    // ---- meeting: the plan, as the downbeat calls it
    let calls = [], planned = null, told = [];
    const m = kind("meeting", () => {
      rec = { calls, plan: null }; events = told;
      KA.reseed(seed);
      try { S.planMeeting(0); } finally { planned = rec.plan; rec = null; events = null; }
      const draw = calls.find((c) => c.tag === "calendar.draw");
      if (draw) same("Calendar.draw", CAL.draw(draw.args[0]), draw.res);
      return {
        n: B.meetingNum(), sunday: draw ? { u: draw.args[0], drawn: draw.res } : null, day: B.day(),
        plan: (planned || []).map((s) => ({ type: s.type, dur: s.dur, meter: s.meter || null, light: s.light != null ? s.light : null })),
        guests: B.guests(), budget: B.budget(), seating: B.seating(), scenes: B.scenes(),
        house: B.house(), hymnal: B.hymnal(), forms: B.forms(), payoff: B.payoff(), reckoning: B.reckoning(),
        hosanna: B.hosanna(), testimony: B.testimony(), chorale: B.chorale(), cumulative: B.cumulative(),
        events: told,
      };
    });
    const n = B.meetingNum(), rows = B.hymnal(), sunday = m && m.day ? m.day.id : null;
    const callOf = (tag) => calls.find((c) => c.tag === tag) || null;

    // ---- hymns: the orders, and every order written as write() writes it
    const written = {};
    kind("hymns", () => {
      const hp = callOf("hymnal.plan"), hf = callOf("hymnal.forms"), pr = callOf("hymnal.prepare");
      if (hp) same("Hymnal.plan", K.Hymnal.plan(cloneDeep(hp.args[0]), fresh(hp, 1, "hymnal:" + n)), hp.res);
      if (hf) same("Hymnal.forms", K.Hymnal.forms(cloneDeep(hf.args[0]), cloneDeep(hf.args[1]), fresh(hf, 2, "forms:" + n)), hf.res);
      const book = K.Hymnal.book().map((b) => ({ id: b.id, n: b.n, piece: b.piece }));
      book.forEach((b) => { b.hymn = written[b.id] = K.Hymnal.get(b.id, seed); if (!b.hymn) faults.push("the hymnal wrote no " + b.id); });
      return { orders: pr ? { n: pr.args[1], rows: pr.args[2], forms: pr.args[3], reckon: pr.args[4] } : null, book };
    });

    // ---- ward: seated as the meeting seated it; its plan for each hymn
    const wardPlans = {};
    const Dl = K.Dialects;
    // (the organ under a hymn: the dialect's profile, never a round — the
    // performer's own rule, kolob-voices-choir.js performancePlan)
    const organOf = (h) => { const Dp = Dl && Dl.get ? Dl.get(h.dialect) : null; return !h.round && (Dp && Dp.organ != null ? !!Dp.organ : h.dialect === "tabernacle"); };
    kind("ward", () => {
      const cs = callOf("cast.seat"), W = B.ward();
      if (cs) same("Cast.seat", K.Cast.seat(fresh(cs, 0, "cast:" + n), cloneDeep(cs.args[1])), cs.res);
      const seat = { opts: cs ? cs.args[1] : null, ward: cs ? cs.res : null };
      const hymns = rows.map((r) => {
        const h = written[r.id], opts = h ? { organ: organOf(h), first: r.i === 1 } : null;
        const plan = h && W ? K.Cast.planHymn(W, h, root.fork("hymn:" + n + ":" + r.i).fork("performance"), opts) : null;
        wardPlans[r.id] = plan;
        return { id: r.id, opts, plan };
      });
      return { seat, hymns };
    });

    // ---- organist: the bench as seated, its prelude, its hands on the day's hymns
    kind("organist", () => {
      const os_ = callOf("organist.seat"), pd = callOf("organist.preludeDraw"), seated = B.organist();
      if (!seated) return { seat: null };
      if (os_) same("Organist.seat", K.Organist.seat(fresh(os_, 0, "cast:" + n), cloneDeep(os_.args[1])), os_.res);
      if (pd) same("Organist.preludeDraw", K.Organist.preludeDraw(cloneDeep(pd.args[0]), fresh(pd, 1, "cast:" + n), cloneDeep(pd.args[2])), pd.res);
      const org = JSON.parse(JSON.stringify(seated));              // (the golden's own bench: its ledger is the golden's)
      const first = rows.length ? written[rows[0].id] : null;
      const prelude = pd && pd.res && pd.res.play && first ? K.Organist.prelude(org, first, root.fork("cast:" + n)) : null;
      const mode = S.mode;
      const hymns = rows.map((r) => {
        const h = written[r.id];
        // (the organ plays it where the performer has the organist play it:
        // kolob-voices-choir.js organistAt — not a fuge sung twice)
        if (!h || !organOf(h) || (h.fuge && h.fuge.repeatFrom != null)) return { id: r.id, hands: null };
        const R = root.fork("hymn:" + n + ":" + r.i), wp = wardPlans[r.id];
        const modulation = r.key !== "home" ? K.Organist.modulate(org, { keyMonzo: [0, 0, 0, 0], mode }, { keyMonzo: h.keyMonzo, mode: h.mode }, R, { beatS: h.beatS }) : null;
        const hands = K.Organist.accompany(org, h, R, { verses: wp ? wp.verses.length : 2, beatS: h.beatS, hymnIndex: r.i - 1, accompanied: true, reg: r.light != null ? CAL.regLean(r.light, sunday) : 0 });
        return { id: r.id, modulation, hands };
      });
      return { seat: os_ ? { info: os_.args[1], organist: os_.res } : null, preludeDraw: pd ? { info: pd.args[2], draw: pd.res } : null, prelude, hymns, ledger: org.ledger };
    });

    // ---- guests: each room's decide(), on what the meeting handed its plan()
    kind("guests", () => calls.filter((c) => c.tag === "guest").map((c) => {
      const room = K[c.room], label = room.LABEL + n;
      const decision = room.decide(cloneDeep(c.args[0]), fresh(c, 1, label));
      if (text(decision ? decision.seat : null) !== text(c.res == null ? null : c.res)) faults.push(c.room + ".decide() on a fresh " + label + " did not give the seat its plan() gave the meeting");
      return { room: c.room, label, decision };
    }));

    said.forEach((s) => faults.push("the engine said: " + s));
    // (each fault once, with how many times it came)
    const once = [];
    faults.forEach((f) => { const o = once.find((x) => x.f === f); if (o) o.n++; else once.push({ f, n: 1 }); });
    write({ seed, fingerprint, hash, faults: once.map((x) => x.f + (x.n > 1 ? " (×" + x.n + ")" : "")), json: emit ? json[emit] : undefined, ms: Number(process.hrtime.bigint() - t0) / 1e6, timers: armed });
  }
}

// ----------------------------------------------------------------------------
// The parent: the seeds, a process each, and the baseline
// ----------------------------------------------------------------------------
// a process for a group of seeds, planned one after another, each a fresh
// visit → one result a seed
function runChild(dir, seeds, emit) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [__filename, "--child", dir, seeds.join(",")].concat(emit ? ["--emit", emit] : []), { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      const rs = [];
      out.split("\n").forEach((l) => { if (l.trim()) { try { rs.push(JSON.parse(l)); } catch (e) { /* not a result */ } } });
      const why = "the child exited " + code + ": " + (err || out || "no output").trim().split("\n").slice(-4).join(" | ");
      if (rs.length && rs[0].fail) resolve(rs);
      else resolve(seeds.map((s) => rs.find((r) => r.seed === s) || { seed: s, fail: why }));
    });
  });
}
async function runAll(dir, seeds, jobs, per) {
  const groups = [], out = [];
  for (let i = 0; i < seeds.length; i += per) groups.push(seeds.slice(i, i + per));
  let k = 0;
  async function worker() { while (k < groups.length) { const g = groups[k++]; Array.prototype.push.apply(out, await runChild(dir, g)); } }
  await Promise.all(Array.from({ length: Math.min(jobs, groups.length) }, worker));
  return out.sort((a, b) => a.seed - b.seed);
}
function readBaseline(kind) { try { return JSON.parse(fs.readFileSync(path.join(GOLDEN, kind + ".json"), "utf8")); } catch (e) { return null; } }
function rangeOf(seeds) {
  const s = seeds.slice().sort((a, b) => a - b), parts = [];
  for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; parts.push(j > i ? s[i] + "–" + s[j] : String(s[i])); i = j; }
  return parts.join(", ");
}
function engineDir(spec) {
  if (!spec || spec === true || spec === "worktree") return HERE;
  if (String(spec).startsWith("git:")) return require("./lib/run.js").resolveEngine(spec).dir;
  const d = path.resolve(String(spec));
  if (!fs.existsSync(path.join(d, "_engine.php"))) throw new Error("no _engine.php in " + d + " (the golden loads the one list)");
  return d;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--child") {
    const ei = argv.indexOf("--emit");
    return child(argv[1], argv[2].split(",").map(Number), ei > 0 ? argv[ei + 1] : null);
  }
  const args = U.parseArgs(argv, ["write"]);
  const dir = engineDir(args.engine);
  const list = E.engineList(dir).map((rel) => path.resolve(dir, rel));
  const fingerprint = W.fingerprintPaths(list);
  let version = null;
  try { version = fs.readFileSync(path.join(dir, "VERSION"), "utf8").trim().split("\n")[0].split(" — ")[0]; } catch (e) { version = null; }
  const rel = path.relative(path.resolve(HERE, "..", ".."), dir), where = rel && !rel.startsWith("..") ? rel : dir;

  if (args.show) {
    const kindName = String(args.show), seed = +args._[0];
    if (KINDS.indexOf(kindName) < 0 || !(seed >= 0)) { console.error("golden.js: --show <" + KINDS.join("|") + "> <seed>"); process.exitCode = 2; return; }
    const r = (await runChild(dir, [seed], kindName))[0];
    if (r.fail) { console.error("golden.js: " + r.fail); process.exitCode = 1; return; }
    const base = readBaseline(kindName), was = base && base.seeds ? base.seeds[seed] : null;
    process.stdout.write(JSON.stringify(r.json, null, 1) + "\n");
    console.error(kindName + " · seed " + seed + " · " + r.hash[kindName] + (was ? (was === r.hash[kindName] ? " · matches the baseline" : " · the baseline's is " + was) : " · not in the baseline") +
      (r.faults.length ? " · " + r.faults.length + " fault(s): " + r.faults.join("; ") : ""));
    return;
  }

  const seeds = U.parseSeeds(args.seeds, U.parseSeeds(SEEDS, []));
  const jobs = Math.max(1, +args.jobs || Math.min(8, os.cpus().length)), per = Math.max(1, +args.per || PER);
  const t0 = process.hrtime.bigint();
  const results = await runAll(dir, seeds, jobs, per);
  const secs = Number(process.hrtime.bigint() - t0) / 1e9;
  const failed = results.filter((r) => r.fail);
  if (failed.length) { console.error("golden.js: " + failed[0].fail); process.exitCode = 1; return; }
  const moved = results.filter((r) => r.fingerprint !== fingerprint);
  if (moved.length) { console.error("golden.js: the engine in " + where + " changed while it was being read (seed " + moved[0].seed + " read " + moved[0].fingerprint + ", the list is " + fingerprint + "); run again when it is still"); process.exitCode = 1; return; }
  const faulted = results.filter((r) => r.faults.length);
  const slow = results.reduce((a, r) => (r.ms > a.ms ? r : a), results[0]);
  const base0 = readBaseline(KINDS[0]);

  console.log("kolob golden — " + where + (version ? " · " + version : "") + " · modules " + fingerprint +
    (args.write ? "" : base0 ? " (the baseline's " + base0.engine + ", written " + base0.written + (base0.version ? " at " + base0.version : "") + ")" : " (no baseline)") +
    " · seeds " + rangeOf(seeds) + " · " + jobs + " jobs, " + per + " seed(s) a process · " + secs.toFixed(1) + " s (the slowest seed " + slow.seed + ", " + (slow.ms / 1000).toFixed(1) + " s)");
  let differs = 0;
  if (args.write) {
    if (faulted.length) { console.log("  not written: a seed faulted (below); the baseline is written only from a clean run"); }
    else {
      fs.mkdirSync(GOLDEN, { recursive: true });
      const date = new Date().toISOString().slice(0, 10);
      KINDS.forEach((k) => {
        const file = { tool: "kolob golden (tools/golden.js)", kind: k, covers: COVERS[k], engine: fingerprint, version, written: date, seeds: {} };
        results.forEach((r) => { file.seeds[r.seed] = r.hash[k]; });
        fs.writeFileSync(path.join(GOLDEN, k + ".json"), JSON.stringify(file, null, 2) + "\n");
        console.log("  " + k.padEnd(9) + "written: " + results.length + " seeds → tools/golden/" + k + ".json");
      });
    }
  } else {
    KINDS.forEach((k) => {
      const base = readBaseline(k);
      if (!base) { differs++; console.log("  " + k.padEnd(9) + "no baseline (tools/golden/" + k + ".json): run --write"); return; }
      const differ = [], missing = [];
      results.forEach((r) => { const was = base.seeds[r.seed]; if (was == null) missing.push(r.seed); else if (was !== r.hash[k]) differ.push(r.seed); });
      const ok = results.length - differ.length - missing.length;
      if (differ.length || missing.length) differs++;
      console.log("  " + k.padEnd(9) + ok + " of " + results.length + " seeds match" +
        (differ.length ? " — differ: " + differ.join(", ") + " (node art/kolob/tools/golden.js --show " + k + " " + differ[0] + ")" : "") +
        (missing.length ? " — not in the baseline: " + rangeOf(missing) : ""));
    });
  }
  // (each fault once, with the seeds it came on)
  const byFault = new Map();
  faulted.forEach((r) => r.faults.forEach((f) => byFault.set(f, (byFault.get(f) || []).concat(r.seed))));
  [...byFault].slice(0, 12).forEach(([f, ss]) => console.log("  FAULT (seed" + (ss.length > 1 ? "s " : " ") + rangeOf(ss) + ") " + f));
  if (byFault.size > 12) console.log("  … and " + (byFault.size - 12) + " fault(s) more");
  const trapOff = Object.keys(TRAP_OFF);
  console.log("  the trap: Math.random and Date.now " + (results.some((r) => r.faults.some((f) => /^the trap: /.test(f))) ? "CALLED (above)" : "never called") +
    (trapOff.length ? " (left off for " + trapOff.join(", ") + ")" : "") + "; every pure planner the meeting called gave the same on a fresh stream" + (faulted.some((r) => r.faults.some((f) => /fresh/.test(f))) ? " — BUT NOT ALL (above)" : ""));
  if (!args.write) console.log(differs ? "  DIFFERS" : faulted.length ? "  FAULTED (above)" : "  ALL MATCH");
  else if (!faulted.length && base0 && base0.engine !== fingerprint) console.log("  (the baseline was " + base0.engine + ", written " + base0.written + ")");
  process.exitCode = differs || faulted.length ? 1 : 0;
}

main().catch((e) => { console.error("golden.js: " + (e.refusal ? e.message : e.stack || e.message)); process.exitCode = 1; });
