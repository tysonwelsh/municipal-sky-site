// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — CHANGE RINGING FROM A FAR TOWER (KOLOB.GuestChanges)
//
// In England, from the seventeenth century on, the bells of a church tower
// have been rung not as tunes but as CHANGES. Five, six or more bells hang
// in a frame, each swung full circle on its wheel by one ringer on one rope,
// and each rings once in every ROW — a row is the order they sound in. The
// first row is ROUNDS, the bells from the highest (the treble, 1) down to
// the lowest (the tenor): 123456. Then, on the conductor's call, the order
// changes from each row to the next, and the only move a swinging bell can
// make is to change places with its neighbour: in each row a bell stays in
// its place or moves one place up or down. A METHOD is a rule for which
// pairs swap, and the art is to ring rows that never repeat until, at last,
// the bells come back to rounds of their own accord. Fabian Stedman's
// Tintinnalogia (1668) and Campanalogia (1677) set the art down; ringers
// write a method in PLACE NOTATION ("x" — every pair swaps; "16" — the bells
// in first and sixth place stay, the others swap), and draw the path of one
// bell through the rows as a blue line. It is one of the oldest algorithmic
// arts there is, and it sounds like nothing else: a cascade that is always
// the same six notes and never the same twice. (PLAN-COMPOSITION §8.3.)
//
// Here a far tower's band rings for the Sunday, as a variant of the
// steeples: the meetinghouse bell has the first word, as ever, and then,
// across the valley, a band rings rounds, the conductor calls "Go", and
// they ring PLAIN HUNT (every bell hunting straight up to the back and down
// to the lead: 5.1 on five, x16 on six) or PLAIN BOB (the treble plain-
// hunting while the others dodge at the lead end — Doubles 5.1.5.1.5.1.5.1.
// 5.125, Minor x16x16x16x16x16x12), a plain course or a TOUCH with calls
// ("Bob!": the lead end 145 or 14 in place of 125 or 12), until they come
// round; "That's all", a few rows of rounds, "Stand" — and the meetinghouse
// bell has the last word. Every row is generated from the place notation,
// and verified (verify()): each a permutation of the bells, each bell moving
// at most one place from row to row, the touch true (no row rung twice) and
// coming round. On six bells, Doubles may be rung with the tenor COVERING
// (ringing last in every row, the deep beat under the changes).
//
// TOWER BELLS, NOT HANDBELLS. A cast bronze church bell does not sound the
// harmonic series: tuned the English way ("true-harmonic", Simpson, 1895)
// its partials are the HUM an octave under the note, the PRIME, the TIERCE a
// minor third above it — the minor third that makes a church bell sound
// like a church bell — the QUINT, the NOMINAL an octave up, and the
// superquint and the upper octave above that; each partial doubled a
// fraction of a hertz apart (the bell is not perfectly round), so it
// shimmers, and the hum sings on after the rest have died. The handbell
// (kolob-voices-folk.js) is a fundamental and its twelfth; the meetinghouse
// bell (kolob-voices-ground.js) a generic stack; this is the tower's. In
// Kolob's tuning: a ring is a major scale down from the treble (six bells:
// la sol fa mi re do; five: sol fa mi re do), justly tuned (5/3, 3/2, 4/3,
// 5/4, 9/8, 1) on a tenor that stands on the day's keynote or a fifth or a
// fourth from it — the ring is in the colony's lattice.
//
// FAR OFF. The tower stands at an edge of the field; its bells come through
// the valley's air (a lowpass, the wind moving the level a decibel or two),
// with an echo off the far hillside, and into the tabernacle's wide send in
// the meeting (the steeples' visitors go there too). At a FUNERAL the bells
// are rung HALF-MUFFLED, as English ringers ring them for the dead: a leather
// muffle on one side of each clapper, so every backstroke is a soft, dull
// echo of the handstroke before it.
//
// ONE VOICE A BELL. A bell's partials are oscillators that run for the whole
// touch (silent at birth); a stroke re-excites them — each partial's gain
// rises in a millisecond or two from wherever its last stroke has decayed
// to and dies away at its own rate — so a ring of six costs some twenty
// nodes a bell, however long it rings, and a short burst of the clapper's
// knock (three nodes, gone in 30 ms) a stroke.
//
// PURE PLANNING. plan(), decide(), rows(), verify(), touches(), prepare() and
// score() touch no AudioContext, DOM, clock or Math.random; every die comes
// from the stream passed in (guest:changes:<n>), on forks: "seat" (the
// variant's die and the moment), "shape" (the stage, the method, the touch,
// the rounds, the pace, the ring's key, the tower's side, the band) and
// "synth" (each bell's own partials and shimmer, each stroke's placing and
// weight, the wind: sound-level, never reported).
//
// Public surface: window.KOLOB.GuestChanges
//   plan(meetingInfo, stream) → { guest, variantOf: "steeples", seat,
//        section, at, dur, holdUntil, stage, method, touch, muffled,
//        estimated, odds, logged: true } | null
//     meetingInfo: { n, kind, sunday?, sections, guests: [{type, section}]
//       (the steeples among them, or no ringing), material?, force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   prepare(material, stream) → the ringing, ready (pure; itself material):
//     material = { keynoteHz, sunday?, stage?, method?, piece?, muffled? }
//   score(material, stream, t0) → { bells, rows, strikes, calls, stages,
//        end, lastStrike, method, stage, touch, verify }
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { defer(at, fn), onNote({freq, t, dur, bell, place, row, hand,
//              muffled}), onStage({stage, t0, t1, label}), onCall({call, t}) }
//   rows(stage, notation, leads, calls) · verify(rows, opts) ·
//   touches(method, stage) · METHODS · ODDS · NAME · LABEL · LEVEL
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestChanges = (function () {
  "use strict";

  var NAME = "changes";
  var LABEL = "guest:changes:";                  // + the meeting number

  // ==========================================================================
  // PLACE NOTATION — the ringers' own way of writing a method
  // ==========================================================================
  // a notation string ("x16x16x16x16x16x12", "5.1.5.1.5.1.5.1.5.125") →
  // its changes, each "x" or the places made ("16", "125")
  function parse(pn) {
    var out = [], cur = "";
    String(pn).replace(/-/g, "x").split("").forEach(function (ch) {
      if (ch === "x" || ch === "X") { if (cur) out.push(cur); out.push("x"); cur = ""; }
      else if (ch === ".") { if (cur) out.push(cur); cur = ""; }
      else cur += ch;
    });
    if (cur) out.push(cur);
    return out;
  }
  var DIGITS = "1234567890ET";
  // apply one change to a row (an array of bell numbers): every pair not
  // making a place swaps, from the front
  function apply(row, change) {
    var n = row.length, keep = {}, out = row.slice();
    if (change !== "x") change.split("").forEach(function (d) { keep[DIGITS.indexOf(d) + 1] = true; });
    for (var p = 1; p <= n; p++) {
      if (keep[p]) continue;
      if (p + 1 <= n && !keep[p + 1]) { out[p - 1] = row[p]; out[p] = row[p - 1]; p++; }
      else keep[p] = true;             // (an odd bell left at the back makes a place)
    }
    return out;
  }
  function rounds(n) { var r = []; for (var i = 1; i <= n; i++) r.push(i); return r; }
  function str(row) { return row.map(function (b) { return DIGITS[b - 1]; }).join(""); }

  // THE METHODS the band knows (by stage): the lead's notation, the plain
  // lead end, and the calls' ("Bob!" — "Single!" is not rung here)
  var METHODS = {
    plainHunt: {
      en: "Plain Hunt", ds: "𐐑𐐢𐐁𐐤 𐐐𐐊𐐤𐐓",
      5: { lead: "5.1.5.1.5.1.5.1.5.1", course: 1 },
      6: { lead: "x16x16x16x16x16x16", course: 1 },
    },
    plainBob: {
      en: "Plain Bob", ds: "𐐑𐐢𐐁𐐤 𐐒𐐉𐐒",
      5: { lead: "5.1.5.1.5.1.5.1.5", plain: "125", bob: "145", course: 4, stageName: "Doubles" },
      6: { lead: "x16x16x16x16x16x", plain: "12", bob: "14", course: 5, stageName: "Minor" },
    },
  };
  var STAGE_NAME = { 5: "Doubles", 6: "Minor" };

  // THE ROWS: from rounds, lead by lead; calls[k] ("-" plain, "b" a bob)
  // at the k-th lead end; → [row strings], rounds first and last when the
  // touch comes round
  function rowsOf(stage, method, leads, calls) {
    var M = METHODS[method][stage], body = parse(M.lead), row = rounds(stage), out = [str(row)];
    for (var k = 0; k < leads; k++) {
      var le = M.plain ? (calls && calls[k] === "b" ? M.bob : M.plain) : null;
      var ch = le ? body.concat([le]) : body;
      ch.forEach(function (c) { row = apply(row, c); out.push(str(row)); });
    }
    return out;
  }

  // VERIFY — the rules of the art, checked on the rows themselves: every row
  // a permutation of the bells; from each row to the next every bell stays
  // or changes places with a neighbour; the touch true (no row rung twice)
  // and coming round only at its end; and, for a plain method, the treble
  // hunting (1, 2 … n, n … 2, 1 in each lead) → { ok, errors, … }
  function verify(rs, opts) {
    opts = opts || {};
    var errors = [], n = rs.length ? rs[0].length : 0, seen = {}, rnd = str(rounds(n));
    if (rs[0] !== rnd) errors.push("does not start from rounds");
    rs.forEach(function (r, i) {
      var sorted = r.split("").map(function (c) { return DIGITS.indexOf(c) + 1; }).sort(function (a, b) { return a - b; });
      if (sorted.join() !== rounds(n).join()) errors.push("row " + i + " (" + r + ") is not a permutation of the bells");
      if (i > 0) {
        var prev = rs[i - 1];
        for (var p = 0; p < n; p++) {
          var q = prev.indexOf(r[p]);
          if (Math.abs(q - p) > 1) errors.push("row " + i + ": bell " + r[p] + " jumps from place " + (q + 1) + " to " + (p + 1));
          else if (q !== p && prev[p] !== r[q]) errors.push("row " + i + ": bell " + r[p] + " moves without its neighbour");
        }
        if (r === rnd && i < rs.length - 1) errors.push("comes round early, at row " + i);
        if (seen[r] && !opts.repeats) errors.push("row " + i + " (" + r + ") rung twice (first at row " + seen[r] + ")");
        seen[r] = seen[r] || i;
      }
    });
    var round = rs.length > 1 && rs[rs.length - 1] === rnd;
    if (!round) errors.push("does not come round");
    var treble = null;
    if (opts.leadLen) {
      // (the treble's place after each change, from rounds: up 2, 3 … n, lie
      // at the back once more, down n − 1 … 1, lead once more)
      var path = rs.map(function (r) { return r.indexOf("1") + 1; }), want = [];
      for (var k = 2; k <= n; k++) want.push(k);
      want.push(n);
      for (var k2 = n - 1; k2 >= 1; k2--) want.push(k2);
      want.push(1);
      treble = true;
      for (var i2 = 1; i2 < path.length; i2++) if (path[i2] !== want[(i2 - 1) % (2 * n)]) { treble = false; errors.push("the treble leaves its hunt at row " + i2); break; }
    }
    return { ok: !errors.length, errors: errors.slice(0, 12), rows: rs.length, changes: rs.length - 1, round: round, trebleHunts: treble, stage: n };
  }

  // THE TOUCHES of Plain Bob a band may ring on a stage: every pattern of
  // plain leads and bobs up to eight leads that comes round at its last lead
  // end (and not before) and is true — found by ringing them (pure; kept
  // once found) → [{ calls ("-b-b"), leads, changes, bobs }], shortest first
  var touchCache = {};
  function touches(method, stage) {
    var key = method + ":" + stage;
    if (touchCache[key]) return touchCache[key];
    var out = [], M = METHODS[method][stage];
    if (!M.plain) { touchCache[key] = [{ calls: "", leads: 1, changes: parse(M.lead).length, bobs: 0 }]; return touchCache[key]; }
    for (var L = 1; L <= 8; L++) {
      for (var mask = 0; mask < (1 << L); mask++) {
        var calls = "";
        for (var b = 0; b < L; b++) calls += mask & (1 << b) ? "b" : "-";
        var rs = rowsOf(stage, method, L, calls), v = verify(rs, {});
        if (v.ok) out.push({ calls: calls, leads: L, changes: rs.length - 1, bobs: (calls.match(/b/g) || []).length });
      }
    }
    out.sort(function (a, b) { return a.changes - b.changes || a.bobs - b.bobs || (a.calls < b.calls ? -1 : 1); });
    touchCache[key] = out;
    return out;
  }

  // ==========================================================================
  // THE ODDS — a variant of the steeples: when the steeples ring, how often
  // the far bells are a band ringing changes (rather than the steeples
  // phasing on their own periods). The steeples' own odds are the meeting's
  // (kolob-meeting.js, about 7.5 % of meetings, more at Christmas and
  // Easter); this is the share of those.
  // ==========================================================================
  var ODDS = {
    base: 0.5,
    weight: {
      ordinary: 1, fast: 0.6, conference: 1.1, jubilee: 1.2,
      // (a wedding is rung for — the English ringers' oldest custom; a
      // funeral half-muffled)
      pioneer: 1.1, christmas: 1.5, easter: 1.4, wedding: 1.7, funeral: 1.3, dedication: 1.5,
    },
    cap: 0.85,
  };
  // the far tower's bus, against the organ reference (guests3b-lab: the
  // loudest 3 s, as seated — all tabernacle, as the steeples' visitors)
  var LEVEL = 0.2;
  var RING_TAIL = 6;                               // s: the tenor's hum after the last stroke

  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestChanges: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function oddsFor(info) {
    var w = ODDS.weight, k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1));
  }

  // THE SHAPE — the musical dice of one ringing, all drawn, in order
  function shapeOf(stream) {
    var r = need(stream).fork("shape");
    return {
      stageU: r.next(),                 // Minor on six; Doubles on five; Doubles on six, the tenor covering
      pieceU: r.next(),                 // plain hunt; a plain course of Plain Bob; a touch of it
      touchU: r.next(),
      before: r.pickW([[4, 1], [6, 2], [8, 1]]),    // rows of rounds before "Go" (even: the method starts at a handstroke)
      after: r.pickW([[4, 2], [6, 1]]),             // …and after "That's all"
      gap: r.rnd(0.2, 0.26),            // s between strokes (a lighter ring rings quicker)
      keyU: r.next(),                   // the ring's tenor: the keynote, a fifth or a fourth from it
      side: r.chance(0.5) ? 1 : -1, where: r.rnd(0.45, 0.85),
      distance: r.rnd(0, 1),            // how far across the valley (the air, the echo)
      band: r.pickW([["steady", 3], ["fair", 2]]),
    };
  }
  function stageOf(sh, forced) {
    var s = forced || (sh.stageU < 0.45 ? "minor" : sh.stageU < 0.7 ? "doubles" : "covered");
    return s === "minor" ? { name: "minor", bells: 6, working: 6, cover: false }
         : s === "covered" ? { name: "covered", bells: 6, working: 5, cover: true }
         : { name: "doubles", bells: 5, working: 5, cover: false };
  }
  function pieceOf(sh) { return sh.pieceU < 0.16 ? "hunt" : sh.pieceU < 0.64 ? "course" : "touch"; }

  // THE RING'S TUNING — a major scale down from the treble, just, on a
  // tenor at the day's keynote or a fifth or a fourth from it (monzos
  // relative to the keynote: SCORE §2)
  var SCALE = [[0, 0, 0, 0], [-3, 2, 0, 0], [-2, 0, 1, 0], [2, -1, 0, 0], [-1, 1, 0, 0], [0, -1, 1, 0]];   // do re mi fa sol la
  var TENOR = [[[0, 0, 0, 0], 3], [[-1, 1, 0, 0], 2], [[2, -1, 0, 0], 2], [[-2, 0, 1, 0], 0.6]];           // 1, 3/2, 4/3, 5/4
  var SOLFA = ["do", "re", "mi", "fa", "sol", "la"];
  function mz(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], (a[3] || 0) + (b[3] || 0)]; }
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function ringOf(sh, N, keynoteHz) {
    var tot = 0; TENOR.forEach(function (x) { tot += x[1]; });
    var u = sh.keyU * tot, tk = TENOR[0][0];
    for (var i = 0; i < TENOR.length; i++) { u -= TENOR[i][1]; if (u <= 0) { tk = TENOR[i][0]; break; } }
    var f = keynoteHz * ratio(tk), o = 0;
    while (f * Math.pow(2, o) >= 330) o--;
    while (f * Math.pow(2, o) < 196) o++;
    var tenor = [tk[0] + o, tk[1], tk[2], tk[3]], bells = [];
    for (var b = 1; b <= N; b++) {
      var deg = N - b, m = mz(tenor, SCALE[deg]);
      bells.push({ bell: b, deg: deg, solfa: SOLFA[deg], monzo: m, f: keynoteHz * ratio(m) });
    }
    return bells;
  }

  // ==========================================================================
  // THE RINGING, MADE READY (pure): the rows from the method, the strokes on
  // the clock — every row a stroke a bell, evenly, and before each
  // handstroke row the open handstroke lead (a stroke's silence) — the
  // calls, the stages. Times from 0; score() moves them to t0.
  // ==========================================================================
  function prepare(material, stream) {
    material = material || {};
    if (material.prepared) return material;
    var sh = shapeOf(stream), st = stageOf(sh, material.stage), W = st.working, N = st.bells;
    var piece = material.piece || pieceOf(sh), method = piece === "hunt" ? "plainHunt" : "plainBob";
    var M = METHODS[method][W], touch;
    if (piece === "hunt") touch = { calls: "", leads: 1 };
    else if (piece === "course") touch = { calls: new Array(M.course + 1).join("-"), leads: M.course };
    else {
      // (a touch no longer than the plain course: the far tower rings for a
      // minute or so, as the steeples do — Minor's bob course of 36, Doubles'
      // 20 and 60)
      var ts = touches("plainBob", W).filter(function (x) { return x.bobs > 0 && x.changes <= 60; });
      touch = ts.length ? ts[Math.min(ts.length - 1, Math.floor(sh.touchU * ts.length))] : { calls: new Array(M.course + 1).join("-"), leads: M.course };
    }
    var mrows = rowsOf(W, method, touch.leads, touch.calls);
    var check = verify(mrows, { leadLen: 2 * W });
    if (st.cover) mrows = mrows.map(function (r) { return r + DIGITS[N - 1]; });
    var rnd = mrows[0], all = [];
    for (var i = 0; i < sh.before; i++) all.push({ row: rnd, what: "rounds" });
    mrows.slice(1).forEach(function (r, k) { all.push({ row: r, what: k === mrows.length - 2 ? "round" : "method", lead: Math.floor(k / (2 * W)) }); });
    for (var j = 0; j < sh.after; j++) all.push({ row: rnd, what: "rounds" });
    var bells = ringOf(sh, N, material.keynoteHz || 261.63);
    var muffled = material.muffled != null ? !!material.muffled : material.sunday === "funeral";
    var g = sh.gap, t = 0.4, strikes = [], rowT = [];
    all.forEach(function (R, ri) {
      if (ri > 0 && ri % 2 === 0) t += g;                     // the open handstroke lead
      rowT.push(t);
      R.row.split("").forEach(function (c, p) {
        var b = DIGITS.indexOf(c) + 1, hand = ri % 2 === 0;
        strikes.push({ t: +(t + p * g).toFixed(4), bell: b, place: p + 1, row: ri, hand: hand ? "H" : "B", muffled: muffled && !hand, f: bells[b - 1].f, monzo: bells[b - 1].monzo });
      });
      t += N * g;
    });
    // each stroke rings until its bell strikes again (the report's length)
    var nextOf = {};
    for (var s = strikes.length - 1; s >= 0; s--) { var x = strikes[s]; x.dur = +((nextOf[x.bell] != null ? nextOf[x.bell] : x.t + 4) - x.t).toFixed(4); nextOf[x.bell] = x.t; }
    var goRow = sh.before, roundRow = sh.before + mrows.length - 2, last = strikes[strikes.length - 1].t;
    var name = METHODS[method].en + " " + STAGE_NAME[W] + (st.cover ? ", the tenor covering" : "");
    var calls = [{ call: "Look to", t: 0 }, { call: "Go " + METHODS[method].en, t: rowT[goRow - 2] }];
    if (method === "plainBob") for (var L = 0; L < touch.leads; L++) if (touch.calls[L] === "b") calls.push({ call: "Bob", t: rowT[goRow + (L + 1) * 2 * W - 3] });
    calls.push({ call: "That's all", t: rowT[roundRow] }, { call: "Stand", t: last + g });
    calls.sort(function (a, b) { return a.t - b.t; });
    var stages = [
      { stage: "rounds", t0: strikes[0].t, t1: rowT[goRow], label: "rounds, " + N + " bells" },
      { stage: "go", t0: rowT[goRow], t1: rowT[roundRow], label: name + (piece === "touch" ? ", a touch of " + touch.changes + " (" + touch.bobs + " bob" + (touch.bobs > 1 ? "s" : "") + ")" : piece === "course" ? ", a plain course" : "") },
      { stage: "round", t0: rowT[roundRow], t1: last + g, label: "that's all: rounds" },
      { stage: "stand", t0: last + g, t1: last + RING_TAIL, label: "stand" },
    ];
    return {
      prepared: true, stage: st.name, bells: bells, working: W, cover: st.cover, method: method, methodName: name, piece: piece,
      touch: { calls: touch.calls, leads: touch.leads, changes: mrows.length - 1, bobs: (touch.calls.match(/b/g) || []).length },
      rows: all.map(function (R) { return R.row; }), methodRows: mrows, verify: check, muffled: muffled, gap: g, band: sh.band,
      side: sh.side, where: sh.where, distance: sh.distance, strikes: strikes, calls: calls, stages: stages,
      firstStrike: strikes[0].t, lastStrike: last, dur: +(last + RING_TAIL).toFixed(3), keynoteHz: material.keynoteHz || 261.63,
    };
  }
  function shift(list, t0) { return list.map(function (x) { var y = {}; for (var k in x) y[k] = x[k]; if (y.t != null) y.t = y.t + t0; if (y.t0 != null) { y.t0 += t0; y.t1 += t0; } return y; }); }
  function score(material, stream, t0) {
    var m = prepare(material, stream);
    t0 = t0 || 0;
    return { bells: m.bells, rows: m.rows, methodRows: m.methodRows, strikes: shift(m.strikes, t0), calls: shift(m.calls, t0), stages: shift(m.stages, t0),
             end: t0 + m.dur, firstStrike: t0 + m.firstStrike, lastStrike: t0 + m.lastStrike, method: m.methodName, stage: m.stage, touch: m.touch, verify: m.verify, muffled: m.muffled };
  }

  // ==========================================================================
  // THE SEAT — the steeples' own: when they ring (in the prelude, calling the
  // valley in, or in the postlude, ringing it home), the far bells are a
  // band ringing changes this often; the ringing begins `at` seconds after
  // the meetinghouse bell's first word
  // ==========================================================================
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), atU = rs.next();                           // every die, first
    var p = oddsFor(info), why = null, steeple = null;
    (info.guests || []).forEach(function (g) { if (g && g.type === "steeples" && !steeple) steeple = g; });
    var order = (info.sections || []).map(function (s) { return s && s.type; });
    var section = steeple ? steeple.section : info.force ? (order.indexOf("prelude") >= 0 || !order.length ? "prelude" : "postlude") : null;
    if (!section) why = "the steeples do not ring today";
    else if (!(info.force || roll < p)) why = "the far steeples phase on their own (not a band this Sunday)";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var mat = prepare(info.material && info.material.prepared ? info.material : { keynoteHz: info.keynoteHz || 261.63, sunday: info.sunday || info.kind }, stream);
    var at = 3 + 3 * atU;
    return {
      seat: {
        guest: NAME, variantOf: "steeples", seat: section, section: section, at: +at.toFixed(2), dur: mat.dur,
        holdUntil: +(at + mat.dur + 3).toFixed(2), stage: mat.stage, method: mat.methodName, piece: mat.piece, touch: mat.touch,
        muffled: mat.muffled, estimated: false, odds: +p.toFixed(3), logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // THE TOWER BELL — a true-harmonic English bell: [partial, ratio to the
  // strike note, weight when struck, how long it rings (s, at 300 Hz — a
  // lower bell rings longer), whether it shimmers (a doublet a fraction of
  // a hertz apart)]. The hum an octave down, the prime, the minor-third
  // TIERCE, the quint, the nominal an octave up; the deciem, the superquint
  // and the upper octave brief and bright. The hum sings on.
  // ==========================================================================
  var PARTIALS = [
    ["hum", 0.5, 0.42, 5.5, true], ["prime", 1.0, 0.5, 2.8, false], ["tierce", 1.2, 0.55, 2.2, true],
    ["quint", 1.5, 0.16, 1.4, false], ["nominal", 2.0, 0.62, 1.5, true], ["deciem", 2.5, 0.14, 0.8, false],
    ["superquint", 3.0, 0.26, 0.7, false], ["octave", 4.0, 0.12, 0.45, false],
  ];
  // a muffled stroke (the leather on the clapper): the upper partials all
  // but gone, the rest softer, the stroke slower to speak
  var MUFFLE = { hum: 0.5, prime: 0.42, tierce: 0.28, quint: 0.2, nominal: 0.1, deciem: 0.04, superquint: 0.04, octave: 0.03 };
  // THE TOWER: its bells (each its partials, running silent from its birth
  // to its end, re-excited at every stroke) and the valley's air between
  // (a lowpass, the wind moving the level, the far hillside's echo from the
  // other side). o = { born, end, Y (the synth stream), side, where,
  // distance, level, air (false: the bells alone, dry — a lab's) }
  // → { stroke(i, ts, v, muffled), voices, bus, close() }
  function tower(ctx, dest, bells, o) {
    var born = o.born, tEnd = o.end, Y = o.Y, N = bells.length, nodes = [];
    function G(v) { var g = ctx.createGain(); g.gain.setValueAtTime(v, born); nodes.push(g); return g; }
    function panner(p) { var x = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (x.pan) x.pan.setValueAtTime(Math.max(-1, Math.min(1, p)), born); nodes.push(x); return x; }
    var bus = G(o.level != null ? o.level : LEVEL);
    if (o.air === false) bus.connect(dest);
    else {
      var air = ctx.createBiquadFilter(), wind = G(1), out = panner(0);
      air.type = "lowpass"; air.frequency.setValueAtTime(2700 - 1300 * o.distance, born); air.Q.setValueAtTime(0.6, born); nodes.push(air);
      bus.connect(air); air.connect(wind); wind.connect(out); out.connect(dest);
      var ed = ctx.createDelay(1), el = ctx.createBiquadFilter(), eg = G(0.1 + 0.08 * o.distance), ep = panner(-o.side * o.where * 0.55);
      ed.delayTime.setValueAtTime(0.22 + 0.25 * o.distance, born); el.type = "lowpass"; el.frequency.setValueAtTime(1300, born); nodes.push(ed, el);
      air.connect(ed); ed.connect(el); el.connect(eg); eg.connect(ep); ep.connect(dest);
      for (var wt = born + Y.rnd(2, 5); wt < tEnd; wt += Y.rnd(3, 7)) wind.gain.linearRampToValueAtTime(Math.pow(10, Y.rnd(-1.2, 1.2) / 20), wt);
    }
    var noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate), nd = noise.getChannelData(0);
    for (var ni = 0; ni < nd.length; ni++) nd[ni] = Y.rnd(-1, 1);
    var voices = bells.map(function (b, i) {
      var pan = panner(o.air === false ? 0 : o.side * o.where + (i + 1 - (N + 1) / 2) * 0.03);
      var bg = G(Math.pow(bells[N - 1].f / b.f, 0.3)), parts = {}, down = Math.pow(300 / b.f, 0.5);
      bg.connect(pan); pan.connect(bus);
      PARTIALS.forEach(function (P) {
        var g = G(0), cents = (P[0] === "hum" ? -4 : 0) + Y.rnd(-5, 5), f = b.f * P[1] * Math.pow(2, cents / 1200), oscs = [f];
        if (P[4]) oscs.push(f + Y.rnd(0.35, 1.3));
        oscs.forEach(function (fr) { var x = ctx.createOscillator(); x.type = "sine"; x.frequency.setValueAtTime(fr, born); x.connect(g); x.start(born); x.stop(tEnd); nodes.push(x); });
        g.connect(bg);
        parts[P[0]] = { g: g, amp: P[2] / oscs.length, tau: P[3] * down };
      });
      return { bell: b, parts: parts, bg: bg };
    });
    function stroke(i, ts, v, muffled) {
      var V = voices[i], atk = muffled ? 0.005 : 0.0015;
      PARTIALS.forEach(function (P) {
        var p = V.parts[P[0]], peak = p.amp * v * (muffled ? MUFFLE[P[0]] : 1);
        p.g.gain.setTargetAtTime(peak, ts, atk);
        p.g.gain.setTargetAtTime(0, ts + 4 * atk, p.tau * (muffled ? 0.6 : 1));
      });
      // the clapper's knock: a short bright burst (a dull thud, muffled)
      var src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), kg = ctx.createGain();
      src.buffer = noise; bp.type = "bandpass"; bp.frequency.setValueAtTime(muffled ? 380 : Math.min(5200, V.bell.f * 4.4), ts); bp.Q.setValueAtTime(1.3, ts);
      kg.gain.setValueAtTime(0, ts); kg.gain.linearRampToValueAtTime((muffled ? 0.05 : 0.12) * v, ts + 0.001); kg.gain.setTargetAtTime(0, ts + 0.002, muffled ? 0.012 : 0.006);
      src.connect(bp); bp.connect(kg); kg.connect(V.bg);
      src.start(ts); src.stop(ts + 0.05);
    }
    function close() { nodes.forEach(function (x) { try { x.disconnect(); } catch (e) { /* gone already */ } }); }
    return { stroke: stroke, voices: voices, bus: bus, close: close, standing: nodes.length };
  }

  var AHEAD = 2.5, SLICE = 1.0;
  function perform(ctx, dest, t, material, stream, hooks) {
    hooks = hooks || {};
    var m = prepare(material, stream), sc = score(m, stream, t), Y = need(stream).fork("synth");
    var tEnd = sc.end + 0.5, born = Math.max(0, t - 0.05);
    var T = tower(ctx, dest, m.bells, { born: born, end: tEnd, Y: Y, side: m.side, where: m.where, distance: m.distance, level: hooks.level });
    // where each ringer's stroke actually lands, and how hard (sound-level:
    // a steady band within a few milliseconds, a fair one looser, now and
    // then a bell a shade late), drawn for every stroke now, in order, so
    // a ringing laid out in slices is the same ringing
    var spread = m.band === "steady" ? 0.007 : 0.016;
    var lands = sc.strikes.map(function () { return { dt: Y.rnd(-spread, spread) + (Y.chance(m.band === "fair" ? 0.05 : 0.015) ? Y.rnd(0.015, 0.03) : 0), dv: Y.rnd(0.9, 1.08) }; });
    function stroke(k) {
      var s = sc.strikes[k], L = lands[k];
      T.stroke(s.bell - 1, Math.max(born + 0.01, s.t + L.dt), L.dv * (s.hand === "H" ? 1 : 0.94), s.muffled);
    }
    function tell(k) {
      var s = sc.strikes[k];
      if (hooks.onNote) hooks.onNote({ freq: s.f, t: s.t, dur: s.dur, bell: s.bell, place: s.place, row: s.row, hand: s.hand, muffled: s.muffled, monzo: s.monzo });
    }
    // LAID OUT A SLICE AT A TIME (hooks.defer — the engine's clock): the
    // strokes of each SLICE seconds are laid AHEAD seconds before the first
    // of them, each slice in a tick of the clock of its own; a lab with no
    // clock lays the whole ringing out at once
    var slices = [];
    sc.strikes.forEach(function (s, k) {
      var cur = slices[slices.length - 1];
      if (!cur || s.t >= cur.t0 + SLICE) slices.push(cur = { t0: s.t, ks: [] });
      cur.ks.push(k);
    });
    slices.forEach(function (sl) {
      function lay() { sl.ks.forEach(function (k) { stroke(k); tell(k); }); }
      var when = sl.t0 - AHEAD;
      if (hooks.defer && when > t + 0.05) hooks.defer(when, lay); else lay();
    });
    if (hooks.onStage) sc.stages.forEach(function (st) { hooks.onStage(st); });
    if (hooks.onCall) sc.calls.forEach(function (c) { hooks.onCall(c); });
    // when the last hum has gone, let the tower go
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator(), sg = ctx.createGain();
    sg.gain.setValueAtTime(0, born); sent.connect(sg); sg.connect(T.bus);
    sent.onended = function () { T.close(); try { sg.disconnect(); sent.disconnect(); } catch (e) { /* gone already */ } };
    sent.start(born); sent.stop(tEnd + 0.2);
    perform.last = { score: sc, voices: T.voices.length, nodesStanding: T.standing };
    return sc.end;
  }

  return {
    NAME: NAME, LABEL: LABEL, ODDS: ODDS, LEVEL: LEVEL, METHODS: METHODS, PARTIALS: PARTIALS, STAGE_NAME: STAGE_NAME,
    plan: plan, decide: decide, prepare: prepare, score: score, perform: perform, tower: tower, MUFFLE: MUFFLE,
    rows: function (stage, method, leads, calls) { return rowsOf(stage, method, leads, calls); }, verify: verify, touches: touches, parse: parse, apply: apply,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-changes.js"] = true;   // the load guard's roll call
