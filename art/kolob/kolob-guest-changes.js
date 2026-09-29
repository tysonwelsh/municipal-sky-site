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
