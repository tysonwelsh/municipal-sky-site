// ============================================================================
// KOLOB — kolob-guest-room.js: the scaffold every guest room stands on
// (KOLOB.GuestRoom)
//
// Thirteen rooms plan and play a guest of the meeting (kolob-guest-*.js, and
// kolob-testimony.js for the testimony-bearers), and each was built on the
// same frame: a stream it insists on, a plan that is its decision's seat,
// odds read from the meeting or from its own table, a decision of one shape,
// and a performance laid out a slice at a time on the engine's clock, its
// stages told, its nodes let go by a silent sentinel when its last sound has
// gone. That frame is here, once; each room keeps its own seats, its own
// dice and its own music, and says in its header what it takes from here.
//
// THE DICE ARE NOT HERE. Nothing in this file draws from a stream: need()
// only asks that there be one, and every room's decide() still forks "seat"
// first and throws its own dice in its own order before it calls anything
// below (SCORE §3). The pieces are called at the points where the code they
// replace stood, so a room planned or played through them is the room it was
// (tools/golden.js holds every room's decide() for 40 seeds; the harness's
// forced runs hold its notes, its events and its graph).
//
// Public surface: KOLOB.GuestRoom
//   planning (pure):
//     need(stream, room, label)        the stream, or a throw naming the room
//     plan(decide)                     a room's plan(info, stream): its decision's seat
//     oddsFor(info, ODDS, opts)        a room's odds this Sunday (THE ODDS, below)
//     weightOf(tbl, info)              a table's weight for the Sunday, else the kind
//     notThisSunday(info, roll, p)     the seat's own die says no, and no one asked for it
//     decision(seat, why, p, roll, also)   { seat, why, odds, roll } (+ also's fields)
//   performing (reads no clock):
//     ahead(s)                         how long before its sound a slice is laid
//     defer(hooks, t, when, lay, margin)   lay() on the engine's clock, or now
//     ALWAYS                           defer()'s margin: every slice a cue of its own
//     tellStages(hooks, stages)        each stage to hooks.onStage, now
//     stage(stages, t0)                a score's stage-writer
//     sentinel(ctx, dest, from, until, letGo, opts)   the teardown
//     quiet(nodes)                     nodes let go, one already gone keeping none of the others
//     last(perform, what)              perform.last, for the labs
//     level(api, read, write)          the room's LEVEL on its surface
//
// Pure: no AudioContext but the one perform() is handed, no DOM, no clock,
// no Math.random. Loaded after kolob-pitch.js and before the first guest
// room, on the one list (_engine.php) and on every lab's list that loads a
// guest room (tools/loadcheck.js loads each in its order).
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestRoom = (function () {
  "use strict";

  // ==========================================================================
  // PLANNING — pure
  // ==========================================================================
  // THE STREAM. Every room plans and plays on a PJ2.Rand stream of its own
  // label (guest:<name>:<n>) and refuses anything else, naming itself.
  function need(stream, room, label) {
    if (!stream || typeof stream.fork !== "function") throw new Error(room + ": a PJ2.Rand stream is required (label " + label + "<n>)");
    return stream;
  }
  // THE PLAN is the decision's seat (null when the room is not seated): the
  // meeting calls plan(), the labs and the golden read decide()'s reasons
  function plan(decide) {
    return function (info, stream) { return decide(info, stream).seat; };
  }
  // THE ODDS. The meeting hands each room its odds from
  // Calendar.GUEST_ODDS, info.odds; a lab without them reads the room's own
  // ODDS: base × weight[the Sunday, else the kind; 1 for neither], capped.
  // Where a room's odds are its own, the option says how (none of them a
  // case of the room's name here):
  //   mayCome(info)  the room comes on these Sundays only: 0 elsewhere,
  //                  whatever it is handed (the Hosanna: the calendar's own
  //                  hook, else Easter and a dedication)
  //   unnamed        the odds are the table's weight for the Sunday by name
  //                  alone — no base, no kind — and this for a Sunday it does
  //                  not name (the Hosanna: 0.5)
  //   styleOdds      the organist's lean, ODDS.style[info.organist.style]
  //                  (1 for none), on top of the odds, handed or its own
  //                  (the variations)
  //   ignoresOdds    the room reads its own ODDS even when handed info.odds
  //                  (the testimony, which is not in the calendar's table)
  var NONE = {};
  function oddsFor(info, ODDS, opts) {
    opts = opts || NONE;
    if (opts.mayCome && !opts.mayCome(info)) return 0;
    var st = opts.styleOdds && info.organist && ODDS.style[info.organist.style] != null ? ODDS.style[info.organist.style] : 1;
    if (!opts.ignoresOdds && info && info.odds != null) return Math.max(0, Math.min(1, opts.styleOdds ? +info.odds * st : +info.odds));
    if (opts.unnamed != null) return Math.min(ODDS.cap, ODDS.weight[info.sunday] != null ? ODDS.weight[info.sunday] : opts.unnamed);
    var p = ODDS.base * weightOf(ODDS, info);
    return Math.min(ODDS.cap, opts.styleOdds ? p * st : p);
  }
  // a table's weight ({weight: {sunday or kind: w}}) for this Sunday: its
  // own when the table names it, else the meeting's kind's, else 1 (the
  // band's second band reads its own table so)
  function weightOf(tbl, info) {
    var w = tbl.weight, k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return w[k] != null ? w[k] : 1;
  }
  // THE SEAT'S OWN DIE. A room seated by its odds comes when its roll (the
  // first die of its "seat" fork) falls under p, or when it was asked for
  // by name (info.force); this is the test, asked where each room asked it —
  // last, after the room's own refusals — and the room says why in its own
  // words ("not this Sunday"; the testimony's "the ward keeps the silence")
  function notThisSunday(info, roll, p) {
    return !(info.force || roll < p);
  }
  // THE DECISION's shape: the seat (null when refused), why, the odds and
  // the roll; `also`, a room's own fields after them (the Hosanna's guests
  // beside the doxology)
  function decision(seat, why, p, roll, also) {
    var d = { seat: seat, why: why, odds: p, roll: roll };
    if (also) for (var k in also) d[k] = also[k];
    return d;
  }

  // ==========================================================================
  // PERFORMING — placed at t; reads no clock
  // ==========================================================================
  // THE LOOK-AHEAD. A slice of a piece is laid this long before its first
  // sound: the house's 2.5 s, or a room's own (the gulls' 2)
  var AHEAD = 2.5;
  function ahead(s) { return s != null ? s : AHEAD; }
  // THE SLICES ON THE CLOCK. With the engine's clock (hooks.defer, a cue on
  // the guests' lane) a piece is laid out a slice at a time, never the whole
  // piece in one callback; a lab with no clock lays it all out at once. A
  // slice due at `when` is deferred when it is more than `margin` s after t,
  // the moment the piece was placed (0 by default; 0.05 in most rooms), and
  // laid now otherwise. margin ALWAYS: every slice a cue of its own, even one
  // due now, never before t (the Hosanna, the gift of tongues, the far ward:
  // the moment they are cued costs only their score).
  var ALWAYS = "always";
  function defer(hooks, t, when, lay, margin) {
    if (margin === ALWAYS) { if (hooks.defer) hooks.defer(Math.max(t, when), lay); else lay(); return; }
    if (hooks.defer && when > t + (margin || 0)) hooks.defer(when, lay);
    else lay();
  }
  // THE STAGES TOLD: each of the score's stages to hooks.onStage, now (the
  // meeting's glue tells each row at its own moment)
  function tellStages(hooks, stages) {
    if (hooks.onStage) stages.forEach(function (st) { hooks.onStage(st); });
  }
  // a score's stage-writer: stage(name, a, b, label) adds { stage, t0, t1,
  // label } at a and b seconds from t0; a fifth argument is the stage's
  // member (the testimony-bearers', one of the ward)
  function stage(stages, t0) {
    return function (name, a, b, label, member) {
      var st = { stage: name, t0: t0 + a, t1: t0 + b, label: label };
      if (arguments.length > 4) st.member = member;
      stages.push(st);
    };
  }
  // THE TEARDOWN SENTINEL. A guest's nodes are let go when its last sound
  // has gone, not when its piece ends: a silent source (a ConstantSource, an
  // oscillator where there is none) through a gain of nothing into the
  // room's own bus, started at `from` — never before the context's birth: a
  // lab may place a piece before it, a solo choir heard from its first
  // phrase — and stopped at `until`. Its end lets the room's nodes go:
  // letGo(), the room's own (its voices' dispose, a room's tower closed, its
  // buses through quiet()), and then the sentinel's own two. (Every
  // disconnect of one end is one task: their order is not heard.)
  // opts.automated: the gain is zeroed by automation at `from`, not by its
  // value (change ringing's tower sets every gain so).
  function sentinel(ctx, dest, from, until, letGo, opts) {
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator(), sg = ctx.createGain(), at = Math.max(0, from);
    if (opts && opts.automated) sg.gain.setValueAtTime(0, at); else sg.gain.value = 0;
    sent.connect(sg); sg.connect(dest);
    sent.onended = function () { if (letGo) letGo(); quiet([sg, sent]); };
    sent.start(at); sent.stop(until);
    return sent;
  }
  // nodes let go, each on its own (one already gone keeps none of the
  // others): cleanup, never a fault to tell
  function quiet(nodes) {
    (nodes || []).forEach(function (n) { try { n.disconnect(); } catch (e) { /* gone already */ } });
  }
  // what the last performance made, for the labs (perform.last)
  function last(perform, what) {
    perform.last = what;
    return what;
  }
  // THE LEVEL: the room's bus, settable from a lab or the console
  // (KOLOB.GuestGulls.LEVEL = 0.4), always a number; read and write are the
  // room's own, over its own variable
  function level(api, read, write) {
    Object.defineProperty(api, "LEVEL", { enumerable: true, configurable: true, get: function () { return read(); }, set: function (v) { write(+v); } });
    return api;
  }

  return {
    need: need, plan: plan, oddsFor: oddsFor, weightOf: weightOf, notThisSunday: notThisSunday, decision: decision,
    ahead: ahead, defer: defer, ALWAYS: ALWAYS, tellStages: tellStages, stage: stage, sentinel: sentinel, quiet: quiet, last: last, level: level,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-room.js"] = true;   // the load guard's roll call
