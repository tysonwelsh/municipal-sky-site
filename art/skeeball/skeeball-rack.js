/* HOLLER ROLLER — the ball-return rack (filling the trough)
 *
 * When the button is pushed, nine balls roll in one by one from the gate at
 * the LEFT end of the return trough. The trough is tilted gently toward the
 * right end, so each ball rolls right: the first hits the end wall and
 * bounces, the next ones clack into the pack, and they settle packed
 * against the right end. A tiny 1-D sim, in trough px (machine frame x).
 *
 * Pure: no DOM, no Math.random, no Date. The only randomness is a seeded
 * hash (the physics module's hash01) on each ball's entry speed (±15 %).
 *
 *   var rack = SkeeBallRack.createRack({ x0, x1, r, seed[, count 9] })
 *        x0, x1  the trough's inside ends (px); r the ball radius (px)
 *   SkeeBallRack.release(rack, t, v0)  a ball in at the gate, ~v0 px/s → its index
 *   SkeeBallRack.step(rack, dt)        any dt; integrates at 240 Hz
 *   rack.balls   [{ x, v }] left → right (in release order: ball 0 is rightmost)
 *   rack.events  queue of { type: 'rackWall', speed } | { type: 'rackClack', speed, i }
 *                (speed = approach speed, px/s; i = the ball that was struck;
 *                contacts within 50 ms merge into one event, loudest wins)
 *   rack.settled true once every ball is in and at rest (|v| < 2 px/s for
 *                0.15 s, each touching the next), or 4.5 s after the first release
 *   SkeeBallRack.packed(x1, r, n)      the settled positions, left → right
 */
(function (root) {
  'use strict';

  var TUNE = {
    tilt: 40,          // px/s² toward the right end (a slow ball still arrives)
    roll: 10,          // px/s² rolling resistance, against the motion
    eWall: 0.45,       // right end wall (and the gate) restitution
    eBall: 0.55,       // ball-ball restitution (equal masses)
    eRestV: 6,         // approach speeds below this don't bounce (resting contact)
    evMin: 8,          // quieter contacts make no event
    gap: 1,            // packed balls sit 2r + gap apart (they touch in the art)
    vJitter: 0.15,     // ≈ ±15 % entry speed (see release)
    settleV: 2, settleT: 0.15, forceT: 4.5,
    substep: 1 / 240
  };

  // deterministic [0, 1) — the physics module's hash01 (same constants)
  function hash01(seed, i) {
    var h = (Math.imul(seed | 0, 0x9E3779B1) ^ Math.imul(((i | 0) + 0x7F4A7C15) | 0, 0x85EBCA77)) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function createRack(o) {
    o = o || {};
    var r = o.r || 5;
    return {
      x0: o.x0, x1: o.x1, r: r, pitch: 2 * r + TUNE.gap, seed: o.seed | 0,
      expect: o.count != null ? o.count : 9,   // settles only once this many are in
      balls: [],             // left → right; new balls enter on the left
      released: 0, t: 0, t0: null, acc: 0, quietT: 0,
      settled: false, events: [], lastEv: {}
    };
  }

  // one ball in at the gate; returns its release index (0 = the first)
  function release(rack, t, v0) {
    var k = rack.released++;
    // ±15 % overall, but each ball a little slower than the one before, so
    // they arrive one by one (clack, clack…) instead of as one touching train
    // (1.14 → 0.87 of v0 over the nine, ±1 % seeded on each)
    var j = (1 + TUNE.vJitter * 0.93) * (1 - 0.03 * k) * (1 + 0.01 * (2 * hash01(rack.seed, k) - 1));
    rack.balls.unshift({ x: rack.x0 + rack.r, v: (v0 || 75) * j, n: k });
    if (rack.t0 == null) rack.t0 = rack.t;
    rack.settled = false; rack.quietT = 0;
    return k;
  }

  function substep(rack, h) {
    var T = TUNE, b = rack.balls, n = b.length, i;
    // gravity along the tilt and rolling resistance
    for (i = 0; i < n; i++) {
      var q = b[i], a = T.tilt;
      if (q.v > 0) a -= T.roll; else if (q.v < 0) a += T.roll;
      q.v += a * h;
      q.x += q.v * h;
    }
    // contacts, resolved from the right end leftward (the pack leans on the wall)
    var lo = rack.x0 + rack.r, hi = rack.x1 - rack.r, P = rack.pitch;
    for (var it = 0; it < 4; it++) {
      for (i = n - 1; i >= 0; i--) {
        var c = b[i];
        if (i === n - 1 && c.x > hi) {                    // the right end wall
          c.x = hi;
          if (c.v > 0) {
            if (it === 0) note(rack, 'rackWall', c.v, null);
            c.v = c.v > T.eRestV ? -T.eWall * c.v : 0;
          }
        }
        if (i < n - 1) {
          var d = b[i + 1];
          if (d.x - c.x < P) {                            // touching the ball to its right
            var over = P - (d.x - c.x);
            // the right ball is pinned if it rests on the wall/pack; push the left one back
            if (d.x >= hi - 0.01 || (i + 2 < n && b[i + 2].x - d.x <= P + 0.01)) c.x -= over;
            else { c.x -= over / 2; d.x += over / 2; }
            var rel = c.v - d.v;                          // approach speed
            if (rel > 0) {
              if (it === 0) note(rack, 'rackClack', rel, d.n);
              var e = rel > T.eRestV ? T.eBall : 0, m = (c.v + d.v) / 2;
              c.v = m - e * rel / 2; d.v = m + e * rel / 2;
            }
          }
        }
        if (i === 0 && c.x < lo) { c.x = lo; if (c.v < 0) c.v = -T.eWall * c.v; } // the gate
      }
    }
    // a ball leaning on the wall (directly or through the pack) can't be
    // moving right: that is resting contact, not motion (no creeping chain)
    var pinned = false;
    for (i = n - 1; i >= 0; i--) {
      pinned = i === n - 1 ? b[i].x >= hi - 0.01 : pinned && b[i + 1].x - b[i].x <= P + 0.01;
      if (pinned && b[i].v > 0) b[i].v = 0;
    }
  }

  // Events: a wave through a touching pack is one sound, not nine. Contacts
  // within EV_GAP s of the last event of the same type merge into it (the
  // loudest speed wins); quieter than evMin makes no event.
  var EV_GAP = 0.03;
  function note(rack, type, speed, i) {
    if (!(speed > TUNE.evMin)) return;
    var last = rack.lastEv[type];
    if (last && rack.t - last.at < EV_GAP) {
      if (speed > last.ev.speed) { last.ev.speed = +speed.toFixed(1); if (i != null) last.ev.i = i; }
      return;
    }
    var ev = { type: type, speed: +speed.toFixed(1) };
    if (i != null) ev.i = i;
    rack.events.push(ev);
    rack.lastEv[type] = { at: rack.t, ev: ev };
  }

  function step(rack, dt) {
    if (rack.settled) return rack;
    var h = TUNE.substep;
    rack.acc += dt;
    while (rack.acc >= h - 1e-9) {
      rack.acc -= h;
      rack.t += h;
      if (!rack.balls.length) continue;
      substep(rack, h);
      var b = rack.balls, quiet = true;
      for (var i = 0; i < b.length; i++) {
        if (Math.abs(b[i].v) >= TUNE.settleV) quiet = false;
        var right = i === b.length - 1 ? rack.x1 - rack.r : b[i + 1].x - rack.pitch;
        if (right - b[i].x > 0.5) quiet = false;         // not yet touching
      }
      rack.quietT = quiet ? rack.quietT + h : 0;
      var all = rack.expect == null || rack.released >= rack.expect;
      if (all && (rack.quietT >= TUNE.settleT || (rack.t0 != null && rack.t - rack.t0 >= TUNE.forceT))) {
        var px = packed(rack.x1, rack.r, b.length);       // exactly packed, at rest
        for (var k = 0; k < b.length; k++) { b[k].x = px[k]; b[k].v = 0; }
        rack.settled = true; rack.tSettled = rack.t;
        break;
      }
    }
    return rack;
  }

  // settled positions, left → right, for n balls against the right end
  function packed(x1, r, n) {
    var P = 2 * r + TUNE.gap, out = [];
    for (var i = 0; i < n; i++) out.push(x1 - r - (n - 1 - i) * P);
    return out;
  }

  // the energy of the moving pack (Σ|v|, px/s), for the rumble
  function energy(rack) {
    var s = 0;
    for (var i = 0; i < rack.balls.length; i++) s += Math.abs(rack.balls[i].v);
    return s;
  }

  var api = { TUNE: TUNE, createRack: createRack, release: release, step: step, packed: packed, energy: energy, hash01: hash01 };
  root.SkeeBallRack = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
