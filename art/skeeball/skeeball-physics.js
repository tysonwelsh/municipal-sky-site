/* HOLLER ROLLER — ball physics
 *
 * Pure simulation, no canvas. Machine units: 1 = half the lane's width.
 * z runs 0 (throw line) → L (hop crest); x is lateral in [-1, 1];
 * the bed is an inclined plane across a pit gap, with the ring stack
 * centered one outer-radius up the bed (the tangency the art enforces).
 *
 * Three phases: ROLL (friction + incline, wall bounces, can roll back),
 * FLIGHT (launch off the hop resolved analytically at takeoff — carry,
 * apex, landing point, and ring/hole/rim outcome are all known the moment
 * the ball leaves the crest), SETTLE (sink-into-hole animation window).
 *
 * Deterministic: rim rattles use a seed passed per throw.
 */
window.SkeeBallPhysics = (function () {
  'use strict';

  var TUNE = {
    L: 4.2,           // lane length, units
    g: 6.0,           // gravity, units/s² (tuned: full swipe sweeps the whole bed)
    laneDecel: 1.15,  // incline + rolling friction, units/s²
    wallBounce: 0.55, // lateral restitution off the side rails
    ballR: 0.11,      // ball radius (3" ball on a 28" lane)
    hopAngle: 0.675,  // ball-hop launch angle, rad (~39°, a real ski-jump loft)
    hopK: 0.90,       // speed kept through the hop
    pitGap: 0.55,     // crest → bed bottom edge, horizontal units
    bedAngle: 0.72,   // bed incline, rad (~41°)
    R10: 0.93,        // outer ring radius in units
    // ring radii fractions, must match the renderer's RING_FR
    ringFr: [1, 0.85, 0.70, 0.57, 0.45, 0.34, 0.24, 0.14, 0.075],
    holeU: 0.75, holeV: 1.37, holeR: 0.16, // the 100 holes on the bed
    bedHalfW: 1.05,   // bed width beyond which it's the side wall
    rimBounceOut: 0.62, // chance a rim hit rattles outward (vs inward)
    vzMin: 1.4, vzMax: 8.6, vxMax: 1.6,   // input clamps
    spinMax: 1.3,     // input clamp on english
    spinCurve: 2.3,   // lateral accel per unit spin while rolling (units/s²)
    spinAir: 0.8,     // lateral accel per unit spin in flight (units/s²)
    rollDownG: 2.8,   // net down-slope accel of a miss rolling back (units/s²)
    bedLateralFric: 1.2, // lateral drag on the roll-back
    gutterDepth: 0.34, // slope-distance past the bed lip before the gutter swallows it
    settleT: 0.55     // sink animation, s
  };

  // tiny deterministic hash → [0,1), for rim rattles
  function hash01(seed) {
    var h = (seed * 2654435761) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
    return h / 4294967296;
  }

  /* Given a landing point on the bed (u lateral, v up-slope from the
   * bottom edge), decide what the ball actually did. */
  function resolveLanding(u, v, seed) {
    var T = TUNE;
    // the 100 holes first — they're proud of the rings
    for (var s = -1; s <= 1; s += 2) {
      var dh = Math.hypot(u - s * T.holeU, v - T.holeV);
      if (dh < T.holeR + T.ballR * 0.3) return { kind: 'hole', score: 100 };
    }
    if (Math.abs(u) > T.bedHalfW) return { kind: 'wall', score: 0 };
    var d = Math.hypot(u, v - T.R10); // distance from ring center
    var fr = T.ringFr, R = T.R10;
    if (d > fr[0] * R) {
      // outside all rings: low = dribbles back into the pit, high = backstop
      return { kind: v > R ? 'backstop' : 'short', score: 0 };
    }
    // walk the bands: even = scoring gap, odd = raised cork rim
    var scores = [10, 20, 30, 40, 50];
    for (var i = 0; i < fr.length; i++) {
      var inner = (i + 1 < fr.length) ? fr[i + 1] * R : 0;
      if (d > inner) {
        if (i % 2 === 0) return { kind: 'ring', score: scores[i / 2] };
        // on a cork rim — but only a dead-center hit actually rattles;
        // clipping a rim edge just drops the ball into the nearer gap
        var outer = fr[i] * R, mid = (outer + inner) / 2, half = (outer - inner) / 2;
        if (Math.abs(d - mid) > half * 0.45)
          return { kind: 'ring', score: scores[(i - 1) / 2 + (d > mid ? 0 : 1)] };
        var out = hash01(seed + i) < T.rimBounceOut;
        return {
          kind: 'rim', rattle: true,
          score: scores[(i - 1) / 2 + (out ? 0 : 1)]
        };
      }
    }
    return { kind: 'ring', score: 50 };
  }

  /* Solve the flight at takeoff: where does the parabola meet the bed?
   * spin adds a subtle lateral curve to the airborne arc (english carries
   * over the hop). */
  function solveFlight(x, vz, vx, seed, spin) {
    var T = TUNE;
    spin = spin || 0;
    var v0 = vz * T.hopK;
    var vzc = v0 * Math.cos(T.hopAngle);  // horizontal carry speed
    var vy = v0 * Math.sin(T.hopAngle);   // vertical
    var tanB = Math.tan(T.bedAngle), cosB = Math.cos(T.bedAngle);
    // height when crossing the pit gap
    var tG = T.pitGap / vzc;
    var yG = vy * tG - 0.5 * T.g * tG * tG;
    if (yG < -0.05) { // never made the far side
      var tPit = (vy + Math.sqrt(vy * vy + 2 * T.g * 0.35)) / T.g; // fall ~pit depth
      return { T: tPit, apex: vy * vy / (2 * T.g), vzc: vzc, vy: vy, spin: spin,
               outcome: { kind: 'pit', score: 0 },
               u: x + vx * tPit + 0.5 * spin * T.spinAir * tPit * tPit, v: 0 };
    }
    // intersect parabola with the inclined bed: ½gt² + t(vzc·tanB − vy) − G·tanB = 0
    var a = 0.5 * T.g, b = vzc * tanB - vy, c = -T.pitGap * tanB;
    var t1 = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    var s = vzc * t1;
    var v = (s - T.pitGap) / cosB;
    var u = x + vx * t1 + 0.5 * spin * T.spinAir * t1 * t1;
    var outcome = resolveLanding(u, v, seed);
    // A wall miss decided beyond the bed edge would send the flight arc (and
    // the '0' toast, and the rolldown seed) off the cabinet, then snap back
    // when rolldown clamps ru. Clamp AFTER scoring so the kind decision and
    // determinism are untouched, but the arc terminates AT the side wall.
    if (outcome.kind === 'wall') u = (u < 0 ? -1 : 1) * Math.min(Math.abs(u), T.bedHalfW);
    return {
      T: t1, apex: vy * vy / (2 * T.g), vzc: vzc, vy: vy, spin: spin,
      u: u, v: v, outcome: outcome
    };
  }

  function createThrow(x0, vz, vx, seed, spin) {
    var T = TUNE;
    return {
      phase: 'roll',
      x: Math.max(-0.8, Math.min(0.8, x0)),
      z: 0,
      vz: Math.max(T.vzMin, Math.min(T.vzMax, vz)),
      vx: Math.max(-T.vxMax, Math.min(T.vxMax, vx)),
      spin: Math.max(-T.spinMax, Math.min(T.spinMax, spin || 0)),
      seed: seed | 0,
      ft: 0, st: 0, flight: null,
      // roll-back-down-the-bed state (populated when a miss lands)
      ru: 0, rv: 0, rvu: 0, rvv: 0, gut: false,
      events: [], trail: []
    };
  }

  function step(st, dt) {
    var T = TUNE;
    if (st.phase === 'roll') {
      st.z += st.vz * dt;
      st.x += st.vx * dt;
      st.vz -= T.laneDecel * dt;
      // english: the hook blooms late, like a bowling ball gripping the
      // lane as it slows — barely bends off the throw line, turns hard
      // in the final third. Reads as a curve instead of a diagonal.
      var grip = 0.3 + 1.4 * Math.min(1, st.z / T.L);
      st.vx += st.spin * T.spinCurve * grip * dt;
      var lim = 1 - T.ballR;
      if (st.x > lim) { st.x = lim; st.vx = -Math.abs(st.vx) * T.wallBounce; st.spin *= T.wallBounce; st.events.push({ type: 'wall' }); }
      if (st.x < -lim) { st.x = -lim; st.vx = Math.abs(st.vx) * T.wallBounce; st.spin *= T.wallBounce; st.events.push({ type: 'wall' }); }
      st.trail.push({ s: 'lane', x: st.x, z: st.z });
      if (st.z >= T.L) {
        st.flight = solveFlight(st.x, st.vz, st.vx, st.seed, st.spin);
        st.phase = 'flight'; st.ft = 0;
        st.events.push({ type: 'launch', speed: st.vz });
      } else if (st.vz <= 0) {
        st.phase = 'rollback';
        st.events.push({ type: 'stall', z: st.z });
      }
    } else if (st.phase === 'rollback') {
      st.z += st.vz * dt;
      st.vz -= T.laneDecel * dt * 0.8; // gravity wins, friction argues
      st.trail.push({ s: 'lane', x: st.x, z: st.z });
      if (st.z <= 0) { st.phase = 'done'; st.events.push({ type: 'return' }); }
    } else if (st.phase === 'flight') {
      st.ft += dt;
      var f = st.flight;
      st.trail.push({ s: 'air', fr: Math.min(1, st.ft / f.T) });
      if (st.ft >= f.T) {
        st.events.push({
          type: 'land', kind: f.outcome.kind,
          score: f.outcome.score, rattle: !!f.outcome.rattle,
          u: f.u, v: f.v
        });
        if (f.outcome.score > 0) {
          // scored: sink into the hole/ring where it stuck
          st.phase = 'settle'; st.st = 0;
        } else if (f.outcome.kind === 'pit') {
          // fell into the pit short of the bed — straight down the gutter
          st.phase = 'rolldown';
          st.ru = f.u; st.rv = 0; st.rvu = f.spin * 0.1; st.rvv = -0.7;
          st.gut = false;
        } else {
          // short / backstop / wall: landed on the wood, now rolls back down
          st.phase = 'rolldown';
          st.ru = f.u; st.rv = Math.max(0.02, f.v);
          // a little residual lateral drift, biased by any leftover english
          st.rvu = st.vx * 0.12 + f.spin * 0.12;
          st.rvv = -0.2;   // just tipped over the top, gravity takes it
          st.gut = false;
        }
      }
    } else if (st.phase === 'rolldown') {
      // accelerate down the inclined bed (rvv < 0 = moving toward the lip),
      // lateral position preserved with mild drag; drop over the lip into
      // the dark pit mouth (the gutter) and vanish
      st.rvv -= T.rollDownG * dt;
      st.rv += st.rvv * dt;
      st.ru += st.rvu * dt;
      st.rvu -= st.rvu * T.bedLateralFric * dt;
      if (st.ru > T.bedHalfW) { st.ru = T.bedHalfW; st.rvu = -Math.abs(st.rvu) * 0.4; }
      if (st.ru < -T.bedHalfW) { st.ru = -T.bedHalfW; st.rvu = Math.abs(st.rvu) * 0.4; }
      st.trail.push({ s: 'bed', u: st.ru, v: st.rv });
      if (st.rv <= 0 && !st.gut) { st.gut = true; st.events.push({ type: 'gutter', u: st.ru }); }
      if (st.rv <= -T.gutterDepth) { st.phase = 'done'; st.events.push({ type: 'done' }); }
    } else if (st.phase === 'settle') {
      st.st += dt;
      if (st.st >= T.settleT) { st.phase = 'done'; st.events.push({ type: 'done' }); }
    }
    return st;
  }

  /* Where is the ball right now, in machine terms the renderer can map? */
  function pose(st) {
    if (st.phase === 'roll' || st.phase === 'rollback')
      return { space: 'lane', x: st.x, z: Math.max(0, st.z) };
    var f = st.flight;
    if (st.phase === 'flight') {
      var fr = Math.min(1, st.ft / f.T);
      var y = f.vy * st.ft - 0.5 * TUNE.g * st.ft * st.ft;
      return { space: 'air', fr: fr, u: f.u, v: f.v, y: Math.max(0, y),
               apex: f.apex, outcome: f.outcome.kind };
    }
    if (st.phase === 'rolldown')
      return { space: 'rolldown', u: st.ru, v: st.rv,
               outcome: f.outcome.kind };
    if (st.phase === 'settle')
      return { space: 'bed', u: f.u, v: f.v, sink: st.st / TUNE.settleT,
               outcome: f.outcome.kind };
    return null;
  }

  return { TUNE: TUNE, createThrow: createThrow, step: step, pose: pose,
           solveFlight: solveFlight, resolveLanding: resolveLanding };
})();
