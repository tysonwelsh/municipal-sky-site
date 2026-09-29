// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE GULLS (KOLOB.GuestGulls)
//
// In June 1848 the crickets came down on the Saints' first crops in the
// Salt Lake Valley, and the settlers beat them with brooms and burned them
// and could not stop them; then the gulls came from the lake, in thousands,
// and ate them, and the harvest was saved. There is a monument to them on
// Temple Square, and the California gull is the state bird.
//
// At the rim of Kolob's light a flock goes over the meetinghouse now and
// then: a crowd of harsh bright cries crossing from one side of the sky to
// the other, a few seconds of it, gone. That is all anyone notices. But
// heard closely the loudest bird is not only crying: its held cries are the
// notes of the head of the day's first hymn, in its rhythm, a couple of
// octaves up — the tune the ward sang (or is about to sing) — and the
// others laugh around it. An Ivesian nature-quote, and a joke. Now and then
// a second bird answers the end of the phrase, and now and then the flock
// wheels round and one more bird calls its first notes from far off.
//
// THE TRACE, and the wave-1 fix. A gull's cry lives between about 650 and
// 1400 Hz, and a hymn's head lives two octaves under that, so the head is
// moved up — by ONE octave shift for the whole head (the one putting its
// middle nearest 954 Hz), never a note folded on its own: folding each note
// into the gulls' register sent a tune's last rise down a seventh (wave 1's
// "…1061 593 650"), and the joke is only a joke if the shape survives. The
// others' cries are pitches taken from the head as well, kept within the
// lead's own span, so the flock never argues with the tune it is quoting.
//
// PURE PLANNING. plan(), decide(), prepare() and score() touch no
// AudioContext, DOM, clock or Math.random: every die is the stream's —
// guest:gulls:<n>, forked "seat", "shape" (the flock, the pace, the way
// across, the echo, the wheel back) and "synth" (each cry's own throat).
// perform() reads no clock and lays the cries out a few seconds at a time
// through hooks.defer.
//
// Public surface: window.KOLOB.GuestGulls
//   plan(meetingInfo, stream) → { guest: "gulls", seat, section, at, dur,
//        holdUntil, odds, logged: true } | null
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   prepare(material, stream) → the flock's crossing (pure; material)
//     material: { hymn: <the day's first hymn, a SCORE Hymn>, homeHz (the
//       day's tonic; else keynoteHz) — the head is sung in the hymn's key }
//   score(material, stream, t0) → every cry as data (pure): { cries: [{t, f,
//        hold, kind, pan, dist, v, role, index}], head, shift, end, stages }
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { defer(at, fn), onNote({freq, t, dur, part, index, deg,
//              monzo, loud}), onStage({stage, t0, side, label, detail}),
//              only: "lead" (a lab's: the lead bird alone) }
//   head(hymn) → the head as the gulls take it (pure), ODDS, SEATS, LEVEL,
//   LABEL, NAME, CENTRE
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestGulls = (function () {
  "use strict";

  var NAME = "gulls";
  var LABEL = "guest:gulls:";

  // ==========================================================================
  // THE ODDS — a starting point, for the owner's ear
  // ==========================================================================
  // About one meeting in twelve; Pioneer Day's more (the gulls are the
  // pioneers' own story), a wedding's a little more; never at a funeral (it
  // is a joke), seldom at Christmas (the gulls have gone to the coast).
  var MAX_GUESTS = 2;                             // a meeting's guests, at most (PLAN §8: 0–2)
  var ODDS = {
    base: 0.08,
    weight: {
      ordinary: 1, fast: 0.6, conference: 0.8, jubilee: 1.3,
      pioneer: 2.5, christmas: 0.25, easter: 1.1, wedding: 1.3, funeral: 0, dedication: 0.5,
    },
    cap: 0.5,
  };
  // where they fly over: the gathering, the invocation, a quiet rite, or the
  // room emptying — never over a hymn, the sacrament or the doxology; never
  // in a section a guest holds or next to one (PLAN §8.13)
  var SEATS = [["prelude", 1], ["invocation", 0.7], ["testimony", 1], ["interlude", 0.9], ["postlude", 1.1]];
  var AT = [0.15, 0.6], AT_MIN = 5;
  var CENTRE = 954;                                 // Hz: where the head's middle is moved to
  var REGISTER = [600, 1500];                        // Hz: where a gull's cry lives
  var LEVEL = 0.5;                                  // the flock's bus (calibrated in the lab)

  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestGulls: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function oddsFor(info) {
    var w = ODDS.weight, k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1));
  }
  function shapeOf(stream) {
    var r = need(stream).fork("shape");
    return {
      birds: r.rint(4, 9),                 // the flock around the lead bird
      beat: r.rnd(0.24, 0.34),             // the lead bird's pace: seconds a hymn beat
      fromWest: r.chance(0.5),
      high: r.rnd(0.2, 0.3),               // nearest, overhead (the cry's distance, 0–1)
      far: r.rnd(0.55, 0.72),
      nearAt: r.rnd(0.35, 0.55),
      leadIn: r.rnd(1.2, 2.6),             // the flock heard before the lead bird begins
      tailS: r.rnd(2.2, 3.4),
      chatter: r.rnd(0.4, 0.65),           // cries a bird a second
      echo: r.chance(0.35),                // a second bird answers the end of the phrase
      wheel: r.chance(0.2),                // the flock wheels round, and one calls the first notes again
    };
  }
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), seatDie = rs.next(), atU = rs.next();
    shapeOf(stream);
    var p = oddsFor(info), why = null, secs = info.sections || [], guests = info.guests || [];
    function has(fn) { for (var j = 0; j < guests.length; j++) if (guests[j] && fn(guests[j])) return true; return false; }
    function free(i) {
      var near = [secs[i - 1], secs[i], secs[i + 1]].filter(Boolean).map(function (s) { return s.type; });
      return !has(function (g) { return g.type !== NAME && near.indexOf(g.section) >= 0; });
    }
    var pool = [], tot = 0;
    SEATS.forEach(function (sw) {
      for (var i = 0; i < secs.length; i++) if (secs[i] && secs[i].type === sw[0]) { if (free(i)) { pool.push([i, sw[1]]); tot += sw[1]; } break; }
    });
    var pick = null, x = seatDie * tot;
    for (var k = 0; k < pool.length && pick == null; k++) { x -= pool[k][1]; if (x <= 1e-12) pick = pool[k][0]; }
    if (pick == null && pool.length) pick = pool[pool.length - 1][0];
    var funeral = info.sunday === "funeral" || info.kind === "funeral";
    // (a meeting carries two guests at most, PLAN §8: planned after every
    // other guest, the flock never makes a third — unless it was asked for)
    var others = guests.filter(function (g) { return g && g.type !== NAME; }).length;
    if (funeral) why = "not at a funeral";
    else if (others >= MAX_GUESTS && !info.force) why = "two guests already";
    else if (pick == null) why = "no quiet rite free";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var sec = secs[pick], secDur = sec.dur > 0 ? sec.dur : 60;
    var at = Math.max(AT_MIN, secDur * (AT[0] + (AT[1] - AT[0]) * atU));
    var dur = info.material ? score(info.material, stream, 0).end : 16;
    return {
      seat: { guest: NAME, seat: sec.type, section: sec.type, at: +at.toFixed(2), dur: +dur.toFixed(2), holdUntil: +(at + dur + 2).toFixed(2),
              estimated: !info.material, odds: +p.toFixed(3), logged: true },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // THE HEAD — the first line of the hymn's tune (with the next, if the first
  // is short), up to ten notes, in its own rhythm
  // ==========================================================================
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  // (no hymn to be had — a lab's: OLD HUNDRED's first line, do do ti la sol do re mi)
  var OLD_HUNDRED = [[0, 2, [0, 0, 0, 0]], [0, 1, [0, 0, 0, 0]], [-1, 1, [-4, 1, 1, 0]], [-2, 1, [-1, -1, 1, 0]], [-3, 1, [-2, 1, 0, 0]],
                     [0, 1, [0, 0, 0, 0]], [1, 1, [-3, 2, 0, 0]], [2, 2, [-2, 0, 1, 0]]];
  function head(h) {
    if (!h || !h.lines || !h.lines.length) return OLD_HUNDRED.map(function (x, i) { return { deg: x[0], beats: x[1], monzo: x[2], index: i }; });
    var mp = h.melodyPart || "S", out = [];
    for (var li = 0; li < h.lines.length && (out.length < 5 || li === 0) && out.length < 10; li++) {
      ((h.lines[li].notes || {})[mp] || []).forEach(function (n) {
        if (out.length < 10 && n && n.monzo && n.beats > 0) out.push({ deg: n.deg, beats: n.beats, monzo: n.monzo, index: out.length });
      });
    }
    return out;
  }

  // ==========================================================================
  // PREPARE and SCORE — every cry of the crossing, as data (pure)
  // ==========================================================================
  function prepare(material, stream) {
    material = material || {};
    if (material.prepared) return material;
    var sh = shapeOf(stream), h = material.hymn || null, hd = head(h);
    var base = material.homeHz || (material.keynoteHz || 260) * (h && h.keyMonzo ? ratio(h.keyMonzo) : 1);
    var fs = hd.map(function (n) { return base * ratio(n.monzo); });
    var lo = Math.min.apply(null, fs), hi = Math.max.apply(null, fs);
    // ONE shift for the whole head: its shape survives, last rise and all —
    // the octave that leaves least of it outside the gulls' own register
    // (REGISTER), and of two that fit alike, the one nearer CENTRE
    var shift = 1, best = Infinity, k0 = Math.round(Math.log(CENTRE / Math.sqrt(lo * hi)) / Math.LN2);
    [k0 - 1, k0, k0 + 1].forEach(function (k) {
      var m = Math.pow(2, k), c = 0;
      fs.forEach(function (f) { c += Math.max(0, Math.log(REGISTER[0] / (f * m)) / Math.LN2) + Math.max(0, Math.log(f * m / REGISTER[1]) / Math.LN2); });
      c += 0.05 * Math.abs(Math.log(CENTRE / (Math.sqrt(lo * hi) * m)) / Math.LN2);
      if (c < best - 1e-9) { best = c; shift = m; }
    });
    return { prepared: true, shape: sh, head: hd, base: base, shift: shift, notes: fs.map(function (f) { return f * shift; }), hymnId: h ? h.id || null : null };
  }
  function score(material, stream, t0) {
    t0 = t0 || 0;
    var P = prepare(material, stream), sh = P.shape, r = need(stream).fork("flock"), cries = [];
    var from = sh.fromWest ? -0.85 : 0.85, to = -from;
    var lead0 = t0 + sh.leadIn, t = lead0;
    var lead = P.head.map(function (n, i) { var d = Math.max(0.16, n.beats * sh.beat), c = { t: t, f: P.notes[i], dur: d, index: i }; t += d; return c; });
    var headEnd = t, span = headEnd - t0 + sh.tailS;
    function x(tt) { return Math.max(0, Math.min(1, (tt - t0) / span)); }
    function panAt(tt) { return from + (to - from) * x(tt); }
    function distAt(tt) { var u = (x(tt) - sh.nearAt) / Math.max(sh.nearAt, 1 - sh.nearAt); return sh.high + (sh.far - sh.high) * Math.pow(Math.abs(u), 1.5); }
    lead.forEach(function (c) {
      cries.push({ t: c.t, f: c.f, hold: Math.max(0.07, c.dur * 0.55), up: 0.04, fall: Math.min(0.14, c.dur * 0.45), kind: "long", pan: panAt(c.t), dist: distAt(c.t), v: 1, role: "lead", index: c.index });
    });
    // the second bird: the end of the phrase again, a little behind and aside
    var echo0 = headEnd + 0.12, e = echo0;
    if (sh.echo) lead.slice(-3).forEach(function (c) {
      cries.push({ t: e, f: c.f, hold: Math.max(0.07, c.dur * 0.5), up: 0.04, fall: Math.min(0.14, c.dur * 0.45), kind: "long", pan: panAt(e) - 0.3 * (to - from) / 2, dist: distAt(e) + 0.12, v: 0.8, role: "echo", index: c.index });
      e += c.dur;
    });
    // the flock: cries and laughs from pitches of the head, kept within the
    // lead's own span (an octave from just under its lowest note)
    var lo = Math.min.apply(null, P.notes) * 0.94;
    function fold(f) { while (f < lo) f *= 2; while (f >= lo * 2) f /= 2; return f; }
    var n = Math.round(sh.birds * span * sh.chatter);
    for (var k = 0; k < n; k++) {
      var ct = t0 + r.rnd(0, span), inHead = ct >= lead0 && ct < headEnd;
      var skip = r.next() < (inHead ? 0.45 : 0);          // the flock gives the lead bird room
      var base = fold(r.pick(P.notes) * r.pick([1, 1.5, 0.75, 1]));
      var laugh = r.chance(0.45), pn = panAt(ct) + r.rnd(-0.28, 0.28), dd = Math.min(1, distAt(ct) + r.rnd(0.1, 0.35)), vv = r.rnd(0.55, 0.75);
      var many = r.rint(2, 4), gap = r.rnd(0.12, 0.16), wob = r.rnd(0.97, 1.03);
      if (skip) continue;
      if (laugh) for (var j = 0; j < many; j++) cries.push({ t: ct + j * gap, f: base * (1 - j * 0.03), kind: "ha", pan: pn, dist: dd, v: vv, role: "chatter" });
      else cries.push({ t: ct, f: base * wob, kind: "long", pan: pn, dist: dd, v: vv, role: "chatter" });
    }
    var end = t0 + span;
    // the flock wheels round: from far off, one bird calls the first notes again
    if (sh.wheel) {
      var w = t0 + span + r.rnd(1.2, 2.2);
      lead.slice(0, 3).forEach(function (c) {
        cries.push({ t: w, f: c.f, hold: Math.max(0.07, c.dur * 0.5), up: 0.04, fall: Math.min(0.14, c.dur * 0.45), kind: "long", pan: to * 0.4, dist: 0.78, v: 0.85, role: "wheel", index: c.index });
        w += c.dur;
      });
      end = w + 0.6;
    }
    cries.sort(function (a, b) { return a.t - b.t; });
    cries.forEach(function (c) { c.pan = Math.max(-1, Math.min(1, +c.pan.toFixed(3))); c.dist = +Math.max(0, Math.min(1, c.dist)).toFixed(3); });
    var side = sh.fromWest ? "west" : "east";
    return {
      cries: cries, head: P.head, notes: P.notes, shift: P.shift, end: end + 0.6, lead0: lead0, headEnd: headEnd, hymnId: P.hymnId, prepared: P,
      stages: [{ stage: "gulls", t0: t0, side: side, label: "∿ gulls", detail: "over the meetinghouse, from the " + side },
               { stage: "head", t0: lead0, side: side, label: "∿ the gulls", detail: "the first hymn's head", dev: true }],
    };
  }

  // ==========================================================================
  // PERFORM — the flock, placed at t (reads no clock), a few seconds of cries
  // at a time (hooks.defer), each cry KOLOB.VoicesFolk's gull
  // ==========================================================================
  var AHEAD = 2, SLICE_S = 3;
  function perform(ctx, dest, t, material, stream, hooks) {
    var VF = window.KOLOB.VoicesFolk;
    if (!VF) throw new Error("KOLOB.GuestGulls: load kolob-voices-folk.js first");
    hooks = hooks || {};
    var sc = score(material, stream, t), synth = need(stream).fork("synth");
    var bus = ctx.createGain(); bus.gain.value = LEVEL; bus.connect(dest);
    var folk = VF.create(ctx, bus, { rand: synth });
    var cries = hooks.only === "lead" ? sc.cries.filter(function (c) { return c.role === "lead"; }) : sc.cries, slices = [];
    cries.forEach(function (c) { var i = Math.max(0, Math.floor((c.t - t) / SLICE_S)); (slices[i] = slices[i] || []).push(c); });
    slices.forEach(function (sl, i) {
      if (!sl) return;
      var at = t + i * SLICE_S - AHEAD;
      if (hooks.defer && at > t) hooks.defer(at, function () { lay(sl); }); else lay(sl);
    });
    function lay(sl) {
      sl.forEach(function (c) {
        folk.gull(c.t, c.f, { hold: c.hold, up: c.up, fall: c.fall, kind: c.kind, pan: c.pan, dist: c.dist, v: c.v });
        if (hooks.onNote) {
          var h = c.index != null ? sc.head[c.index] : null;
          hooks.onNote({ freq: c.f, t: c.t + (c.up || 0.03), dur: c.hold || 0.07, part: c.role, index: c.index != null ? c.index : null,
                         deg: h ? h.deg : null, monzo: h ? h.monzo : null, loud: +(1 - c.dist).toFixed(3) });
        }
      });
    }
    if (hooks.onStage) sc.stages.forEach(function (st) { hooks.onStage(st); });
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
    var sg = ctx.createGain(); sg.gain.value = 0;
    sent.connect(sg); sg.connect(bus);
    sent.onended = function () { try { folk.out.disconnect(); sg.disconnect(); sent.disconnect(); bus.disconnect(); } catch (e) {} };
    sent.start(Math.max(0, t)); sent.stop(sc.end + 1.5);
    perform.last = { score: sc, folk: folk };
    return sc.end;
  }

  return {
    plan: plan, decide: decide, prepare: prepare, score: score, perform: perform, head: head, shape: shapeOf,
    ODDS: ODDS, MAX_GUESTS: MAX_GUESTS, SEATS: SEATS, NAME: NAME, LABEL: LABEL, CENTRE: CENTRE,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-gulls.js"] = true;   // the load guard's roll call (round 3c: the gulls)
