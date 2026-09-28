// ============================================================================
// KOLOB — kolob-hymnal.js: the day's hymnal
//
// Round 3's integration: the meeting sings composed hymns. The composer
// (kolob-composer.js) writes a hymn at a desk of its own; this room is the
// chorister's hymnal for one Sunday — which style the house sings in, each
// hymn's style and key, the order the hymns are written in — and the errand
// boy who carries the orders to the composer's desk and the finished hymns
// back, so that the writing never happens where the music is being played.
//
// THE HOUSE DIALECT (PLAN-COMPOSITION §3, "how dialects are chosen"). Each
// Sunday draws a house dialect from the three the composer knows — the
// Tabernacle (C), the Sacred Harp (A), the Old Way (F) — at odds set by the
// kind of Sunday: a fast Sunday leans to the Sacred Harp and the Old Way, a
// conference or a jubilee to the Tabernacle, an ordinary Sunday mixes. Each
// hymn then draws its own dialect, weighted toward the house's. The odds
// already name psalmody (B), gospel (D) and the Shaker and Primary song
// (E); a dialect is drawn only once KOLOB.Dialects has built it, so the day
// those arrive they join the draw with no change here.
//
// KEYS PER HYMN (§3.7). The chorister keys each hymn from the day's keynote:
// at home, or a just fourth away either way (4/3 up, the subdominant; 3/4
// down, the dominant) — never further, and with a pull toward home: a hymn
// sung away is usually followed by one at home, the day's first hymn is
// usually at home (always, when the trombones play it at dawn), and the
// doxology is always at home. The organ modulates into a hymn sung away
// through a chord the two keys share (kolob-voices-organ.js).
//
// THE ERRAND (compose ahead, never on the audio path). Composing costs tens
// to hundreds of milliseconds, with a long tail. The clock looks a quarter
// of a second ahead; a callback that stalls longer than that places its
// notes in the past. So the plan only writes the ORDERS (cheap, pure), and
// the writing is done elsewhere:
//   1. in a Web Worker, when the page has one: the composer's own rooms are
//      loaded into it (the same files, by the same versioned URLs the page
//      loaded), and the finished hymns come back by message — the main
//      thread pays only the copy;
//   2. else in idle slices of the main thread (a timer, one hymn a slice),
//      outside every clock callback;
//   3. and if a hymn is asked for before it has come back — a slow machine,
//      a worker that failed to load — it is written there and then, and the
//      hymnal says so (stats().late). The hymn is the same hymn by every
//      road: the composer is pure, its stream is hymn:<n>:<i> off the
//      visit's seed, and the meeting's earlier hymns are handed to it in the
//      same order and the same (lightened) form.
//
// Public surface: KOLOB.Hymnal = {
//   plan(info, R)       → { house, rows } (pure: the day's dialects and keys)
//   prepare(seed, n, rows)  the orders, posted
//   get(id), ready(id), hymnOf(id), book()   the hymns
//   stats(), warm(), backend(), setBackend(name)
//   timeline(h, lines, beatS), verseSeconds(h, beatS)   (pure helpers)
//   HOUSE_ODDS, KEYS }
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  var KOLOB = window.KOLOB;
  var S = KOLOB._s = KOLOB._s || {};

  // ==========================================================================
  // THE HOUSE DIALECT AND EACH HYMN'S (pure)
  // ==========================================================================
  // (weights; a dialect the composer has not built yet is left out of the
  // pool when it is read — its weight is the hook the next crew fills. An
  // ordinary Sunday mixes, the Tabernacle — the home dialect, PLAN §3.C —
  // leading it about 56 : 27 : 17 while there are three)
  var HOUSE_ODDS = {
    ordinary:   { tabernacle: 5.0, sacredharp: 2.4, oldway: 1.5, psalmody: 1.2, gospel: 0.8, shaker: 0.6 },
    fast:       { sacredharp: 4.2, oldway: 3.4, tabernacle: 0.7, psalmody: 1.0, shaker: 0.8 },
    conference: { tabernacle: 7.0, sacredharp: 1.0, oldway: 0.3, gospel: 1.2, psalmody: 0.5 },
    jubilee:    { tabernacle: 5.0, sacredharp: 1.0, gospel: 3.0, shaker: 0.6 },
  };
  // a hymn's own dialect, given the house's: the house's own at 6, its
  // neighbours at these weights (a Sacred Harp house sings the Old Way
  // sooner than the Tabernacle; the Tabernacle's house seldom lines out)
  var NEIGHBOURS = {
    tabernacle: { sacredharp: 0.9, oldway: 0.35, gospel: 0.8, psalmody: 0.5, shaker: 0.3 },
    sacredharp: { oldway: 1.0, tabernacle: 0.45, psalmody: 1.0, shaker: 0.3 },
    oldway:     { sacredharp: 1.3, tabernacle: 0.5, shaker: 0.5 },
    psalmody:   { sacredharp: 1.2, tabernacle: 0.8, oldway: 0.4 },
    gospel:     { tabernacle: 1.5, shaker: 0.6, sacredharp: 0.3 },
    shaker:     { oldway: 1.0, sacredharp: 0.6, tabernacle: 0.6 },
  };
  var HOUSE_W = 6;
  // the brush arbor (the prelude's seating with no organ) is the Sacred
  // Harp's own place: an arbor morning leans the house to it
  var ARBOR_LEAN = { sacredharp: 2.2, oldway: 1.4 };

  // THE KEYS — a monzo relative to the day's keynote. A just fourth either
  // way is the smallest move to a new tonic, so the tune's octave (which the
  // composer seats by the key's height) moves least.
  var KEYS = {
    home: [0, 0, 0, 0],
    sub:  [2, -1, 0, 0],                         // 4/3: up a fourth, the subdominant
    dom:  [-2, 1, 0, 0],                         // 3/4: down a fourth, the dominant
  };

  function built(name) { return !!(KOLOB.Dialects && KOLOB.Dialects.get && KOLOB.Dialects.get(name)); }
  function poolOf(table, lean) {
    var out = [];
    for (var k in table) if (Object.prototype.hasOwnProperty.call(table, k) && built(k)) out.push([k, table[k] * ((lean && lean[k]) || 1)]);
    return out.length ? out : [["tabernacle", 1]];
  }

  // plan(info, R): the day's hymnal, from R (the meeting's hymnal:<n>
  // stream). Every die is thrown for every singing section in the plan,
  // used or not, so a change of one hymn's dialect never moves another's key.
  //   info: { n, kind, mode, sections: [{type, meter}], seating (its name),
  //           trombones (the dawn plays the first hymn), cumulative,
  //           theme ([deg]), subs ([[deg]]) }
  //   → { house, rows: [{ i, id, section, meter, dialect, key, keyMonzo,
  //                       mode, gestures }] }
  function plan(info, R) {
    var kind = HOUSE_ODDS[info.kind] ? info.kind : "ordinary";
    var houseDie = R.fork("house").next();
    var house = pickWith(houseDie, poolOf(HOUSE_ODDS[kind], info.seating === "arbor" ? ARBOR_LEAN : null));
    var rows = [], k = 0, prevAway = false;
    var singing = (info.sections || []).filter(function (s) { return s.type === "hymn" || s.type === "doxology"; });
    singing.forEach(function (s, j) {
      k++;
      var Rh = R.fork("hymn:" + k);
      var dDie = Rh.next(), kDie = Rh.next(), awayDie = Rh.next();
      var dox = s.type === "doxology";
      // the hymn's dialect: the house's, or a neighbour now and then; the
      // doxology leans to the Tabernacle's brightness on a Tabernacle or an
      // ordinary Sunday, and keeps the house's voice on a fast one
      var nb = NEIGHBOURS[house] || {}, table = {};
      table[house] = HOUSE_W;
      for (var d in nb) if (d !== house) table[d] = nb[d];
      if (dox && house !== "sacredharp" && house !== "oldway") table.tabernacle = (table.tabernacle || 0) + 2;
      var dialect = pickWith(dDie, poolOf(table));
      // the key: home, or a fourth away, pulled home
      var key = "home";
      if (!dox) {
        var pHome = j === 0 ? (info.trombones ? 1 : 0.7) : (prevAway ? 0.8 : 0.45);
        if (kDie >= pHome) key = awayDie < 0.55 ? "dom" : "sub";
      }
      prevAway = key !== "home";
      // the material line one is seeded from (step 4 of the composer): the
      // day's theme for the first hymn and for the doxology — the theme comes
      // home at the end — and the day's other gestures between. On a
      // withheld Sunday (the cumulative form) only the doxology may carry the
      // theme: it is the tune assembled at last.
      var subs = info.subs || [], g = null;
      if (dox) g = info.theme;
      else if (info.cumulative) g = subs.length ? subs[(k - 1) % subs.length] : null;
      else g = k === 1 ? info.theme : (subs.length ? subs[(k - 2) % subs.length] : info.theme);
      rows.push({
        i: k, id: "h:" + info.n + ":" + k, section: s.type, index: s.index != null ? s.index : null,
        meter: s.meter || null, dialect: dialect, key: key, keyMonzo: KEYS[key].slice(), mode: s.mode || info.mode,
        gestures: g && g.length ? [g.slice()] : null,
      });
    });
    return { house: house, rows: rows };
  }
  function pickWith(u, pool) {
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i][1];
    var r = u * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
  }

  // ==========================================================================
  // THE TIMELINE OF A HYMN (pure) — a line laid out in seconds, as the lab
  // lays it (hymn-lab.js partEvents): a fermata holds its note and moves
  // everything after it; a tied note is one note; the last note of a line
  // gives up a breath (Line.breathAfter).
  // ==========================================================================
  function clockOf(line, beatS) {
    var holds = [];
    (line.fermataBeats || []).forEach(function (fb) {
      var len = 1;
      Object.keys(line.notes).forEach(function (p) { line.notes[p].forEach(function (n) { if (Math.abs(n.beat - fb) < 1e-6) len = Math.max(len, n.beats); }); });
      holds.push({ at: fb + len, extra: 0.7 * len * beatS });
    });
    return function (b) { var t = b * beatS; holds.forEach(function (x) { if (b >= x.at - 1e-6) t += x.extra; }); return t; };
  }
  function lineBeats(line, next) {
    if (next && next.startBeat != null && line.startBeat != null && next.startBeat > line.startBeat) return next.startBeat - line.startBeat;
    return KOLOB.Score && KOLOB.Score.lineLength ? KOLOB.Score.lineLength(line) : 8;
  }
  // one part of one line: [{at, dur, n}] in seconds from the line's start,
  // and the line's length in seconds (to the next line's start)
  function partLine(line, part, beatS, next) {
    var clk = clockOf(line, beatS), ns = line.notes[part] || [], ev = [];
    for (var k = 0; k < ns.length; k++) {
      var n = ns[k], b0 = n.beat, b1 = n.beat + n.beats;
      while (ns[k].tie && k + 1 < ns.length) { k++; b1 = ns[k].beat + ns[k].beats; }
      var at = clk(b0), dur = clk(b1) - clk(b0);
      if (k === ns.length - 1 && line.breathAfter !== false) dur -= Math.min(0.3 * beatS, 0.25 * dur);
      ev.push({ at: at, dur: dur, n: n });
    }
    var len = clk(lineBeats(line, next)) + ((line.fermataBeats || []).length ? 0.3 * beatS : 0);
    return { ev: ev, len: len };
  }
  // a verse's lines (the verse and its refrain) and their starts in seconds
  function timeline(h, lines, beatS) {
    var t = 0, out = [];
    for (var i = 0; i < lines.length; i++) {
      var pl = partLine(lines[i], h.melodyPart, beatS, lines[i + 1]);
      out.push({ line: lines[i], at: t, len: pl.len });
      t += pl.len;
    }
    return { lines: out, len: t };
  }
  function verseLines(h) { return h.lines.concat(h.refrain || []); }
  function verseSeconds(h, beatS) { return timeline(h, verseLines(h), beatS).len; }

  // ==========================================================================
  // THE ERRAND — the orders, the composer's desk, the hymns come back
  // ==========================================================================
  // What travels back: the Score whole, and of the composer's report only
  // what a reader of the meeting uses (the frame, the checks, the peak, the
  // fingerprint's shares). The same function lightens a hymn written in the
  // worker and one written here, so both roads give one object.
  function lighten(h) {
    if (!h) return h;
    var r = h.report || {}, fp = r.fingerprint || null;
    h.report = {
      frame: r.frame || null, peak: r.peak || null,
      checks: (r.checks || []).map(function (c) { return { name: c.name, ok: !!c.ok, hard: !!c.hard }; }),
      share: fp && fp.share ? fp.share : null,
    };
    return h;
  }
  // (the worker's body — stringified, so it carries lighten with it)
  function workerMain() {
    var cache = {};
    self.onmessage = function (e) {
      var m = e.data || {};
      if (m.type === "load") {
        try { self.window = self; importScripts.apply(self, m.urls); self.postMessage({ type: "loaded", ok: !!(self.KOLOB && self.KOLOB.Composer) }); }
        catch (err) { self.postMessage({ type: "loaded", ok: false, error: String(err && err.message || err) }); }
        return;
      }
      if (m.type === "forget") { for (var k in cache) if (k.indexOf(m.prefix) === 0) delete cache[k]; return; }
      if (m.type !== "compose") return;
      var t0 = self.performance && self.performance.now ? self.performance.now() : 0, h = null, err = null;
      try {
        var opts = m.opts || {};
        opts.others = (m.others || []).map(function (x) { return cache[x]; }).filter(Boolean);
        h = lighten(self.KOLOB.Composer.compose(self.PJ2.Rand.stream(m.seed).fork(m.label), opts));
        cache[m.key] = h;
      } catch (x) { err = String(x && x.message || x); }
      var ms = self.performance && self.performance.now ? self.performance.now() - t0 : 0;
      self.postMessage({ type: "hymn", key: m.key, hymn: h, error: err, ms: ms });
    };
  }
  // the composer's rooms, in the order the page loaded them (the worker loads
  // the same files at the same versions — the same bytes, the same hymns)
  var DESK_FILES = ["pj2-rand.js", "kolob-pitch.js", "kolob-score.js", "kolob-tunes.js", "kolob-dialects.js", "kolob-hymnists.js", "kolob-composer.js"];
  function deskUrls() {
    if (typeof document === "undefined" || !document.getElementsByTagName) return null;
    var scripts = document.getElementsByTagName("script"), urls = [];
    for (var i = 0; i < DESK_FILES.length; i++) {
      var found = null;
      for (var j = 0; j < scripts.length && !found; j++) {
        var src = scripts[j].src || "";
        var file = src.split("?")[0].split("/").pop();
        if (file === DESK_FILES[i]) found = src;
      }
      if (!found) return null;
      urls.push(found);
    }
    return urls;
  }

  var jobs = {};                 // key → { key, seed, label, opts, others, hymn, error, state, ms, how }
  var order = [];                // keys, in the order they were posted (the idle road writes them in turn)
  var worker = null, workerState = "none";   // none | loading | ready | failed
  var forced = null;             // a backend a test names: "worker" | "idle" | "sync"
  var idleArmed = false;
  var st = { posted: 0, composed: 0, byWorker: 0, byIdle: 0, late: 0, lateInCue: 0, failed: 0, workerMs: [], mainMs: [], receiveMs: [] };
  function keyOf(seed, id) { return seed + "|" + id; }
  function clock() { return typeof performance !== "undefined" && performance.now ? performance.now() : 0; }

  function backend() {
    if (forced) return forced;
    if (workerState === "ready" || workerState === "loading") return "worker";
    return "idle";
  }
  function setBackend(name) { forced = name === "worker" || name === "idle" || name === "sync" ? name : null; }
  // warm(): the worker is started early (at the page's first press), so its
  // rooms are loaded long before the first hymn is ordered
  function warm() {
    if (worker || workerState === "failed" || forced === "idle" || forced === "sync") return backend();
    if (typeof Worker === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined" || !URL.createObjectURL) { workerState = "failed"; return backend(); }
    var urls = deskUrls();
    if (!urls) { workerState = "failed"; return backend(); }
    try {
      var src = lighten.toString() + "\n(" + workerMain.toString() + ")();";
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      workerState = "loading";
      worker.onmessage = onWorker;
      worker.onerror = function (e) { if (e && e.preventDefault) e.preventDefault(); failWorker(); };
      worker.postMessage({ type: "load", urls: urls });
    } catch (e) { failWorker(); }
    return backend();
  }
  function failWorker() {
    workerState = "failed";
    try { if (worker) worker.terminate(); } catch (e) {}
    worker = null;
    // whatever was waiting on the worker is written in the idle road instead
    order.forEach(function (k) { var j = jobs[k]; if (j && j.state === "posted") j.state = "queued"; });
    armIdle();
  }
  function onWorker(e) {
    var m = e.data || {};
    if (m.type === "loaded") {
      if (!m.ok) { failWorker(); return; }
      workerState = "ready";
      return;
    }
    if (m.type !== "hymn") return;
    var t0 = clock();
    var j = jobs[m.key];
    if (!j || j.hymn) return;                    // (written here already, while it was on its way)
    if (m.error || !m.hymn) { j.state = "queued"; j.error = m.error; st.failed++; armIdle(); return; }
    j.hymn = m.hymn; j.state = "done"; j.ms = m.ms; j.how = "worker";
    st.composed++; st.byWorker++; st.workerMs.push(Math.round(m.ms));
    st.receiveMs.push(+(clock() - t0).toFixed(2));
  }
  function send(j) {
    j.state = "posted";
    worker.postMessage({ type: "compose", key: j.key, seed: j.seed, label: j.label, opts: j.opts, others: j.others });
  }

  // prepare(seed, n, rows): the orders for meeting n, in the order the
  // hymns are sung (each hymn is written knowing the ones before it)
  function prepare(seed, n, rows) {
    // (the orders of meetings long gone are dropped; the worker forgets them too)
    order = order.filter(function (k) {
      var keep = jobs[k] && jobs[k].n >= n - 1 && jobs[k].seed === seed;
      if (!keep) { if (jobs[k] && jobs[k].hymn) shelve(jobs[k]); delete jobs[k]; }
      return keep;
    });
    if (worker) worker.postMessage({ type: "forget", prefix: seed + "|h:" + (n - 2) + ":" });
    var earlier = [];
    rows.forEach(function (r) {
      var key = keyOf(seed, r.id);
      if (jobs[key]) { earlier.push(key); return; }
      var opts = { dialect: r.dialect, meter: r.meter || undefined, mode: r.mode, keyMonzo: r.keyMonzo, id: r.id, gestures: r.gestures };
      var j = jobs[key] = { key: key, n: n, i: r.i, id: r.id, seed: seed, label: "hymn:" + n + ":" + r.i, opts: opts, others: earlier.slice(), hymn: null, state: "queued", how: null };
      earlier.push(key);
      order.push(key);
      st.posted++;
      if (backend() === "worker" && worker) send(j);
    });
    if (backend() === "idle") armIdle();
  }
  // THE IDLE ROAD — one hymn a slice, on a timer of its own (never a cue)
  function armIdle() {
    if (idleArmed || typeof setTimeout === "undefined") return;
    idleArmed = true;
    setTimeout(idleSlice, 0);
  }
  function idleSlice() {
    idleArmed = false;
    if (backend() === "worker" && workerState !== "failed") return;
    for (var i = 0; i < order.length; i++) {
      var j = jobs[order[i]];
      if (j && !j.hymn && j.state === "queued") { write(j, "idle"); break; }
    }
    for (var k = 0; k < order.length; k++) { var jj = jobs[order[k]]; if (jj && !jj.hymn && jj.state === "queued") { armIdle(); break; } }
  }
  // the composer at this desk: the stream, the earlier hymns, the same lightening
  function write(j, how) {
    // (every hymn before it first — the composer is handed them, in order)
    var others = j.others.map(function (k) { var o = jobs[k]; if (o && !o.hymn) write(o, how); return o ? o.hymn : null; }).filter(Boolean);
    var t0 = clock();
    try {
      var opts = {}; for (var k in j.opts) opts[k] = j.opts[k];
      opts.others = others;
      j.hymn = lighten(KOLOB.Composer.compose(window.PJ2.Rand.stream(j.seed).fork(j.label), opts));
      j.state = "done";
    } catch (e) {
      j.state = "failed"; j.error = String(e && e.message || e); st.failed++;
      if (typeof console !== "undefined" && console.warn) console.warn("Kolob: the composer could not write " + j.id + ": " + j.error);
    }
    j.ms = clock() - t0; j.how = how;
    if (j.hymn) { st.composed++; if (how === "idle") st.byIdle++; }
    st.mainMs.push(Math.round(j.ms * 10) / 10);
    return j.hymn;
  }
  // get(id): the hymn, as it came back — or written now, if it has not
  // (counted: late, and whether it was inside a clock callback)
  function get(id, seed) {
    var key = keyOf(seed != null ? seed : (S.visitSeed ? S.visitSeed() : 0), id), j = jobs[key];
    if (!j) return null;
    if (!j.hymn && j.state !== "failed") {
      st.late++;
      if (S.inCue && S.inCue()) st.lateInCue++;
      write(j, "late");
    }
    settle(j);
    return j.hymn;
  }
  // THE BOARD'S NUMBERS: the composer draws a hymn's number on its own
  // stream, and two hymns of one meeting can draw the same (1.6 % of
  // meetings); a meeting never gives out one number twice, so a later hymn
  // takes the next free number on — decided in the meeting's own order,
  // whatever order the hymns came back in
  function settle(j) {
    if (!j || !j.hymn || j.settled) return;
    var used = {};
    order.forEach(function (k) {
      var o = jobs[k];
      if (!o || o === j || o.n !== j.n || o.seed !== j.seed || o.i >= j.i) return;
      if (!o.hymn && o.state !== "failed") write(o, "late");
      settle(o);
      if (o.hymn) used[o.hymn.number] = true;
    });
    var num = j.hymn.number, tries = 0;
    while (used[num] && tries++ < 400) num = num % 380 + 1;
    j.hymn.number = num;
    j.settled = true;
  }
  function ready(id, seed) { var j = jobs[keyOf(seed != null ? seed : (S.visitSeed ? S.visitSeed() : 0), id)]; return !!(j && j.hymn); }
  // (a meeting long gone keeps its last few hymns on a shelf, so a reader —
  // the harness after a long run, the page's dev tools — can still find the
  // hymn an id named; the shelf holds sixteen)
  var shelf = [];
  function shelve(j) { shelf.push({ seed: j.seed, id: j.id, hymn: j.hymn }); if (shelf.length > 16) shelf.shift(); }
  function hymnOf(id, seed) {
    var sd = seed != null ? seed : (S.visitSeed ? S.visitSeed() : null);
    for (var k in jobs) if (jobs[k].id === id && jobs[k].hymn && (sd == null || jobs[k].seed === sd)) return jobs[k].hymn;
    for (var i = shelf.length - 1; i >= 0; i--) if (shelf[i].id === id && (sd == null || shelf[i].seed === sd)) return shelf[i].hymn;
    return null;
  }
  function book() { return order.map(function (k) { var j = jobs[k]; return { id: j.id, n: j.n, state: j.state, how: j.how, ms: j.ms != null ? Math.round(j.ms) : null }; }); }
  function stats() {
    function q(a, p) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
    return {
      backend: backend(), worker: workerState, posted: st.posted, composed: st.composed, byWorker: st.byWorker, byIdle: st.byIdle,
      late: st.late, lateInCue: st.lateInCue, failed: st.failed,
      workerMs: { n: st.workerMs.length, p50: q(st.workerMs, 0.5), p90: q(st.workerMs, 0.9), max: q(st.workerMs, 1) },
      mainMs: { n: st.mainMs.length, p50: q(st.mainMs, 0.5), p90: q(st.mainMs, 0.9), max: q(st.mainMs, 1) },
      receiveMs: { n: st.receiveMs.length, p50: q(st.receiveMs, 0.5), max: q(st.receiveMs, 1) },
    };
  }

  KOLOB.Hymnal = {
    plan: plan, prepare: prepare, get: get, ready: ready, hymnOf: hymnOf, book: book, stats: stats,
    warm: warm, backend: backend, setBackend: setBackend,
    timeline: timeline, partLine: partLine, verseLines: verseLines, verseSeconds: verseSeconds, lighten: lighten,
    HOUSE_ODDS: HOUSE_ODDS, NEIGHBOURS: NEIGHBOURS, KEYS: KEYS,
  };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-hymnal.js"] = true;   // the load guard's roll call
})();
