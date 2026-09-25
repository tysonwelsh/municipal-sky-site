/* HOLLER ROLLER — ball physics (PLAN-2 §2, §3)
 *
 * A continuous 3-D rigid-ball simulation. Pure: no DOM, no Math.random,
 * no Date. Loads in the browser (window.SkeeBallPhysics) and in Node
 * (module.exports) for the lab harness (local-dev/skeeball-lab/sim.js).
 *
 * Units: 1 unit = half the lane width (≈ 14 in); ball radius 0.11.
 * Machine space: x lateral (+ right), y up, z down the lane away from the
 * player. The throw line is z = 0.
 *
 *   lane   y = 0,                          z ∈ [0, zHop]
 *   hop    y = hCrest·((z − zHop)/hopLen)², z ∈ [zHop, L]   (crest at L)
 *   pit    floor y = floorY,               z ∈ [L, bed.z0]  (swallows)
 *   bed    a plane through the lip (z0, y0) rising at `angle`; bed
 *          coordinates (u, v, h): u = x, v = slope distance up the plane
 *          from the lip, h = height above the plane.
 *
 * Nothing is scripted after the throw. Gravity, rolling resistance and
 * contact impulses against the lane/hop surface, the crest and lip
 * edges, the pit walls, the bed plane, five raised rims (capsule-section
 * hoops; the cups between them are open wells), the two 100-hole lips,
 * the side walls and the backstop produce every bounce, rattle, skip and
 * dead roll. A ball is CAPTURED when it has sunk between two rims (or
 * down a 100 hole) and is moving slowly; the sink animation then drops
 * it below the bed over TUNE.sinkT.
 *
 * Semi-implicit Euler at a fixed 1/240 s substep. The only randomness is
 * hash01(seed, stepIndex): ±3 % rim restitution roughness and a tiny
 * bed-texture lateral nudge. Same seed + same inputs = same throw.
 */
(function () {
  'use strict';

  var TUNE = {
    // ── pinned geometry (PLAN-2 §2; the renderer draws exactly this) ──
    ballR: 0.11,
    laneHalfW: 1.0,          // side rails at |x| = 1 (ball centre ≤ 1 − r)
    zHop: 3.5,               // lane → hop
    L: 4.2,                  // hop crest
    hCrest: 0.28,            // crest height; parabola → launch ≈ 38.7°
    pitFloorY: -0.5,
    bedZ0: 4.75, bedY0: 0.2, // the lip
    bedAngle: 0.72,          // β, rad
    bedHalfW: 1.2,
    bedTopV: 2.95,           // backstop
    ringCV: 1.20,            // ring centre (u = 0)
    rims: [0.93, 0.744, 0.535, 0.326, 0.116],
    rimH: 0.08, rimW: 0.05,
    dentRim: 3,              // the 40's rim (radius 0.326)
    dentA0: 20, dentA1: 70,  // degrees from +u toward +v
    dentDepth: 0.40,         // rimH × (1 − 0.40) inside the dent
    dentTaper: 6,            // degrees of smooth shoulder each side
    holeU: 0.7512, holeV: 2.57, holeR: 0.14, lipH: 0.04,
    // the outer (10) rim is bermed on its outside: a cork fillet from the
    // rim top down to the bed over bermW. A ball rolling down from the
    // backstop rides up it and drops into the 10 instead of propping
    // against a bare hoop (on a 41° bed the fillet is still downhill).
    bermW: 0,                // (off: a fillet ski-jumps fast balls over the stack)
    // …instead the outer rim's TOP arc is nearly flush with the bed (as on a
    // real machine, where the backboard runs down into the 10): a ball that
    // comes back off the backstop rolls straight into the 10 cup.
    flushRim: 0, flushA0: 35, flushA1: 145, flushDepth: 0.8, flushTaper: 15,
    cageH: 0.9,              // wire cage over the bed, height above the plane

    // ── world ──
    g: 5.0,                  // cinematic gravity, units/s²
    rollK: 5 / 7,            // rolling sphere's share of a slope's pull (crest energy only)
    // the lane rises imperceptibly toward the hop (not drawn): a stalled
    // ball always drifts home. Expressed as an along-lane accel, units/s².
    laneLean: 0.55,
    crrLane: 0.018,          // rolling resistance, waxed maple
    crrBed: 0.06,            // cork-dead bed
    returnMinV: 2.5,         // a returning ball is carried home at least this fast
    returnAccel: 4.0,        // …reaching it at this rate

    // ── contacts ──
    eLane: 0.25, eRail: 0.5, eWall: 0.45, eBed: 0.25, eRim: 0.25,
    eBackstop: 0.30, ePit: 0.2, eLip: 0.35,
    muImpact: 0.3,           // Coulomb friction at contacts (slip ↔ spin); ≥ (2/7)·tan β to roll on the bed
    muImpactRim: 0.12,       // rim tops are polished: little spin bite
    muRail: 0.05,            // varnished rails and walls: a bank shot keeps its pace
    muBackstop: 0.04,        // padded backstop: a topspun ball doesn't climb it
    vRest: 0.18,             // normal speeds below this don't bounce (resting)
    rimRough: 0.03,          // ±3 % seeded restitution roughness
    bedNudge: 0.06,          // seeded bed-texture lateral accel, units/s²

    // ── english ──
    spinA: 0.45,             // lane lateral accel per unit spin at speed ≥ spinVRef
    spinVRef: 4.0,           // the hook blooms as the ball slows below this…
    spinGrow: 2.2,           // …up to spinGrow × spinA
    spinAir: 0.12,           // tiny airborne drift
    spinBed: 0.10,           // and on the bed

    // ── capture / resolution ──
    // The pinned cups are narrower than the ball (clear gap 0.14–0.16 vs a
    // 0.22 ball), so a ball can only nest on two rim tops — there is no hole
    // for it to fall into. cupDrag stands in for that missing depth: a ball
    // whose bottom is below the rim tops over a cup is "in the cup" and the
    // cup soaks up its motion (cork is dead). Without it a ball rolling down
    // from the backstop skips over every shallow nest and out of the stack.
    cupDrag: 8.0,            // 1/s, velocity decay rate while in a cup
    cupH: 0.225,             // "in a cup": centre below this over a band (rim top + r + a little)
    capH: 0.20,              // centre height above plane below which a ball is "in" a cup
    capV: 1.6,               // …and slower than this → captured
    capHDrop: 0.20,          // …centre height for the dropping-in case
    capVDrop: 4.2,           // …or coming down into the open part of the cup slower than this
    capMargin: 0.0,          // extra rim-zone half-width (beyond the tube) that doesn't count as open cup
    holeCapH: 0.06,          // down a 100 hole
    holeDirectR: 0.065,      // a direct hit drops in if its centre is this close to the hole's
    restV: 0.06, restT: 0.5, // at rest this long on the bed → resolved where it sits
    sinkT: 0.35, gutterT: 0.35,
    timeoutT: 8.0,           // force-resolve 8 s after the throw

    // ── events ──
    evRim: 0.2, evBed: 0.35, evWall: 0.3, evBackstop: 0.3, evCooldown: 0.05,

    // ── input range (the swipe maps into this; physics accepts any v ≥ 0) ──
    vMin: 2.6, vMax: 9.0, aimMax: 0.44, vAbsMax: 12,
    substep: 1 / 240
  };

  var SCORES = [10, 20, 30, 40, 50];
  var GEO = {};
  var D = {}; // hot derived constants

  function derive() {
    var T = TUNE;
    D.r = T.ballR;
    D.sB = Math.sin(T.bedAngle); D.cB = Math.cos(T.bedAngle);
    D.hopLen = T.L - T.zHop;
    D.rho = T.rimW / 2;
    D.thetaCrest = Math.atan(2 * T.hCrest / D.hopLen);
    D.lipRing = T.holeR + T.rimW / 2;
    D.dent0 = T.dentA0 * Math.PI / 180; D.dent1 = T.dentA1 * Math.PI / 180;
    D.dentTap = T.dentTaper * Math.PI / 180;
    D.flush0 = T.flushA0 * Math.PI / 180; D.flush1 = T.flushA1 * Math.PI / 180;
    D.flushTap = T.flushTaper * Math.PI / 180;
    GEO.ballR = T.ballR;
    GEO.L = T.L; GEO.zHop = T.zHop; GEO.hCrest = T.hCrest;
    GEO.launchAngle = D.thetaCrest;
    GEO.laneHalfW = T.laneHalfW;
    GEO.pit = { z0: T.L, z1: T.bedZ0, floorY: T.pitFloorY };
    GEO.bed = { z0: T.bedZ0, y0: T.bedY0, angle: T.bedAngle, halfW: T.bedHalfW, vTop: T.bedTopV };
    GEO.ringC = { u: 0, v: T.ringCV };
    GEO.rims = T.rims.slice();
    GEO.scores = SCORES.slice();
    GEO.rimH = T.rimH; GEO.rimW = T.rimW;
    GEO.dent = { rim: T.dentRim, a0: T.dentA0, a1: T.dentA1, depth: T.dentDepth };
    GEO.holes = [{ u: -T.holeU, v: T.holeV, r: T.holeR }, { u: T.holeU, v: T.holeV, r: T.holeR }];
    GEO.lipH = T.lipH;
    GEO.berm = { rim: 0, w: T.bermW };
    GEO.flush = { rim: T.flushRim, a0: T.flushA0, a1: T.flushA1, depth: T.flushDepth };
    GEO.rimTop = rimTop; // (k, angleRad) → rim height there (dent + flush arc included)
    GEO.cageH = T.cageH;
    return GEO;
  }
  derive();

  // partial TUNE override (opts.tune); rebuilds GEO in place
  function configure(partial) {
    if (partial) for (var k in partial) if (Object.prototype.hasOwnProperty.call(partial, k)) TUNE[k] = partial[k];
    return derive();
  }

  // deterministic hash → [0, 1)
  function hash01(seed, i) {
    var h = (Math.imul(seed | 0, 0x9E3779B1) ^ Math.imul(((i | 0) + 0x7F4A7C15) | 0, 0x85EBCA77)) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  /* ── surfaces ─────────────────────────────────────────────────── */

  function hopY(z) { var t = (z - TUNE.zHop) / D.hopLen; return TUNE.hCrest * t * t; }
  function hopSlope(z) { return 2 * TUNE.hCrest * (z - TUNE.zHop) / (D.hopLen * D.hopLen); }

  // y of the lane/hop surface under (x, z), or null over the pit / beyond
  function surfaceAt(x, z) {
    if (z < 0 && z > -1) return 0;
    if (z < 0) return null;
    if (z <= TUNE.zHop) return 0;
    if (z <= TUNE.L) return hopY(z);
    return null;
  }

  // world → bed (u, v, h)
  function toBed(x, y, z) {
    var dy = y - TUNE.bedY0, dz = z - TUNE.bedZ0;
    return { u: x, v: dy * D.sB + dz * D.cB, h: dy * D.cB - dz * D.sB };
  }
  function fromBed(u, v, h) {
    return { x: u, y: TUNE.bedY0 + v * D.sB + h * D.cB, z: TUNE.bedZ0 + v * D.cB - h * D.sB };
  }

  // smooth 0..1 window over [a0, a1] (rad) with cosine shoulders of width tp
  function arcWin(ang, a0, a1, tp) {
    if (ang >= a0 && ang <= a1) return 1;
    if (ang > a0 - tp && ang < a0) return 0.5 - 0.5 * Math.cos(Math.PI * (ang - (a0 - tp)) / tp);
    if (ang > a1 && ang < a1 + tp) return 0.5 + 0.5 * Math.cos(Math.PI * (ang - a1) / tp);
    return 0;
  }
  function rimTop(k, ang) { // top height of rim k at polar angle ang (rad, −π..π, 0 = +u, π/2 = up-bed)
    var T = TUNE, hgt = T.rimH;
    if (k === T.dentRim) hgt *= 1 - T.dentDepth * arcWin(ang, D.dent0, D.dent1, D.dentTap);
    if (k === T.flushRim) hgt *= 1 - T.flushDepth * arcWin(ang, D.flush0, D.flush1, D.flushTap);
    return hgt;
  }

  // which cup band a bed point is over: 0..4 (score index) or −1 outside
  function bandAt(u, v) {
    var d = Math.hypot(u, v - TUNE.ringCV), R = TUNE.rims;
    if (d > R[0]) return -1;
    for (var k = 0; k < R.length - 1; k++) if (d > R[k + 1]) return k;
    return R.length - 1;
  }
  // is the centre over the open part of cup `band` (not over a rim tube)?
  function overClearCup(q, band) {
    var d = Math.hypot(q.u, q.v - TUNE.ringCV), R = TUNE.rims, m = D.rho + TUNE.capMargin;
    if (d > R[band] - m) return false;
    if (band < R.length - 1 && d < R[band + 1] + m) return false;
    return true;
  }
  function holeAt(u, v, rad) {
    for (var i = 0; i < 2; i++) {
      var hu = (i ? 1 : -1) * TUNE.holeU;
      if (Math.hypot(u - hu, v - TUNE.holeV) < rad) return i;
    }
    return -1;
  }

  /* ── ball ─────────────────────────────────────────────────────── */

  function createThrow(x0, v, aim, spin, seed) {
    var T = TUNE, r = D.r;
    x0 = +x0 || 0; v = +v || 0; aim = +aim || 0; spin = +spin || 0;
    var lim = T.laneHalfW - r;
    x0 = Math.max(-lim, Math.min(lim, x0));
    v = Math.max(0, Math.min(T.vAbsMax, v));
    aim = Math.max(-T.aimMax, Math.min(T.aimMax, aim));
    spin = Math.max(-1, Math.min(1, spin));
    var b = {
      x: x0, y: r, z: 0,
      vx: v * Math.sin(aim), vy: 0, vz: v * Math.cos(aim),
      w: spin, seed: seed | 0,
      wx: 0, wy: 0, wz: 0,                 // angular velocity, rad/s
      phase: 'roll', t: 0, n: 0,          // sim time, substep index
      launched: false, tLaunch: -1, touchedBed: false,
      sup: 0, supNx: 0, supNy: 1, supNz: 0, // support contact from the last substep
      supKind: 'lane',
      restT: 0, rimHits: 0, cd: {},
      land: null,                          // first bed-side contact {u, v, t, kind}
      landF: null,                         // where the flight first dropped to rim-top level {u, v, t}
      cap: null,                           // capture record while sinking
      endT: 0, result: null,
      events: [], trail: [],
      input: { x0: x0, v: v, aim: aim, spin: spin }
    };
    rollOn(b, 0, 1, 0);
    return b;
  }

  function emit(b, ev) { ev.t = +b.t.toFixed(4); b.events.push(ev); }
  function emitCd(b, key, ev) {
    if (b.cd[key] !== undefined && b.t - b.cd[key] < TUNE.evCooldown) return;
    b.cd[key] = b.t; emit(b, ev);
  }

  // one contact: push out along n by pen, bounce/friction impulse.
  // Returns the pre-impulse approach speed (≥ 0).
  // One contact: push out along n by pen, then a rigid-sphere impulse —
  // normal restitution e, and Coulomb friction (coefficient mu) acting on
  // the contact point's slip, which couples the ball's linear velocity to
  // its spin ω (solid sphere, I = 2/5·m·r²). This is what makes a rolling
  // ball pivot up and over a rim edge instead of stopping dead against it,
  // and what makes a landed ball go from sliding to rolling (5/7 of the
  // slope's pull) without any hand-made rolling rule.
  // Returns the approach speed (≥ 0).
  function contact(b, nx, ny, nz, pen, e, mu) {
    b.x += nx * pen; b.y += ny * pen; b.z += nz * pen;
    var vn = b.vx * nx + b.vy * ny + b.vz * nz;
    if (vn >= 0) return 0;
    var r = D.r;
    var ee = -vn < TUNE.vRest ? 0 : e;
    var Jn = -(1 + ee) * vn;
    // contact-point velocity v_c = v − r (ω × n), tangential part = slip
    var cx = b.wy * nz - b.wz * ny, cy = b.wz * nx - b.wx * nz, cz = b.wx * ny - b.wy * nx;
    var ux = b.vx - r * cx, uy = b.vy - r * cy, uz = b.vz - r * cz;
    var un = ux * nx + uy * ny + uz * nz;
    ux -= un * nx; uy -= un * ny; uz -= un * nz;
    var us = Math.hypot(ux, uy, uz);
    var jx = 0, jy = 0, jz = 0;
    if (us > 1e-9) {
      var jt = (2 / 7) * us, jmax = mu * Jn;
      if (jt > jmax) jt = jmax;
      jx = -ux / us * jt; jy = -uy / us * jt; jz = -uz / us * jt;
    }
    b.vx += Jn * nx + jx; b.vy += Jn * ny + jy; b.vz += Jn * nz + jz;
    var k = -5 / (2 * r); // Δω = −(5 / 2r)(n × Jt)
    b.wx += k * (ny * jz - nz * jy); b.wy += k * (nz * jx - nx * jz); b.wz += k * (nx * jy - ny * jx);
    // a supporting contact (normal has an upward component)
    if (ny > 0.3 && ny > b._supBest) {
      b._supBest = ny; b.sup = 1; b.supNx = nx; b.supNy = ny; b.supNz = nz;
    }
    return -vn;
  }
  // make ω pure rolling on a surface with normal n for the current v
  function rollOn(b, nx, ny, nz) {
    var r = D.r;
    b.wx = (ny * b.vz - nz * b.vy) / r; b.wy = (nz * b.vx - nx * b.vz) / r; b.wz = (nx * b.vy - ny * b.vx) / r;
  }
  // bed-local normal → world
  function bedN(nu, nv, nh) {
    return [nu, nv * D.sB + nh * D.cB, nv * D.cB - nh * D.sB];
  }

  /* A contact with anything on the bed side. The first one is the LANDING
   * and is reported once, flagged landing: true — as 'backstop' on a direct
   * hit, otherwise as 'bed' {speed, surface: 'plane'|'rim'|'hole'|'lip',
   * ring|hole}. The cups are narrower than the ball (pinned geometry), so a
   * ball coming down into the stack nearly always meets a rim top first;
   * that first knock is the landing, not a rattle. Every LATER rim or
   * 100-lip impact above evRim is a 'rim' event and makes `rattled` true.
   * Contacts within evCooldown of an event of the same kind are the same
   * impact, not a new sound. */
  function bedHit(b, kind, s, idx) {
    var T = TUNE;
    if (b.sup) b.supKind = 'bed';
    var sp = +s.toFixed(3);
    if (!b.touchedBed) {
      b.touchedBed = true;
      var q = toBed(b.x, b.y, b.z);
      b.land = { u: q.u, v: q.v, t: b.t, kind: kind };
      if (b.phase === 'flight') b.phase = 'bed';
      b.cd.land = b.t;
      if (kind === 'backstop') emit(b, { type: 'backstop', speed: sp, landing: true });
      else {
        var ev = { type: 'bed', speed: sp, surface: kind, landing: true };
        if (kind === 'rim') ev.ring = idx; else if (kind === 'hole') ev.hole = idx;
        emit(b, ev);
      }
      return;
    }
    if (b.t - b.cd.land < T.evCooldown) return; // the landing's own follow-through
    if (kind === 'rim') { if (s > T.evRim) { b.rimHits++; emitCd(b, 'rim' + idx, { type: 'rim', ring: idx, speed: sp }); } }
    else if (kind === 'hole') { if (s > T.evRim) { b.rimHits++; emitCd(b, 'hole' + idx, { type: 'rim', ring: null, hole: idx, speed: sp }); } }
    else if (kind === 'backstop') { if (s > T.evBackstop) emitCd(b, 'backstop', { type: 'backstop', speed: sp }); }
    else if (s > T.evBed) emitCd(b, 'bed', { type: 'bed', speed: sp, surface: kind });
  }

  // capsule ring in bed space: centre (cu, cv), ring radius R, section from
  // h = −1 up to hTopC with tube radius rho. Returns approach speed or −1.
  function ringContact(b, q, cu, cv, R, topFn, k, rho, e, mu) {
    var du = q.u - cu, dv = q.v - cv, d = Math.hypot(du, dv);
    var reach = D.r + rho;
    if (Math.abs(d - R) > reach || d < 1e-9) return -1;
    var hTopC = topFn(k, Math.atan2(dv, du)) - rho;
    var hc = q.h < -1 ? -1 : (q.h > hTopC ? hTopC : q.h);
    var dr = d - R, dh = q.h - hc, dist = Math.hypot(dr, dh);
    if (dist >= reach || dist < 1e-9) return -1;
    var nr = dr / dist, nh = dh / dist;
    var n = bedN(nr * du / d, nr * dv / d, nh);
    var s = contact(b, n[0], n[1], n[2], reach - dist, e, mu);
    return s;
  }
  function flatTop(k, a) { return TUNE.lipH; }

  // leave the hop exactly at the crest, on the crest tangent. yContact is
  // the surface height the speed was measured at (energy for the last climb).
  function crestExit(b, sp, yContact) {
    var T = TUNE, r = D.r, thC = D.thetaCrest, cs = Math.cos(thC), sn = Math.sin(thC);
    var dy = Math.max(0, T.hCrest - yContact);
    var spC = Math.sqrt(Math.max(0, sp * sp - 2 * T.g * T.rollK * dy));
    var zC = T.L - r * sn, yC = T.hCrest + r * cs;
    var over = Math.max(0, (b.z - zC) * cs + (b.y - yC) * sn); // already past the crest point
    b.z = zC + over * cs; b.y = yC + over * sn;
    b.vz = spC * cs; b.vy = spC * sn;
    rollOn(b, 0, cs, -sn);
    b.sup = 0; b.supKind = 'air';
  }

  function substep(b, dt) {
    var T = TUNE, r = D.r, g = T.g;
    b.n++;
    var sp = Math.hypot(b.vx, b.vy, b.vz);

    /* forces */
    var ax = 0, ay = -g, az = 0;
    if (b.sup) {
      // rolling resistance along the tangential velocity, the lane's lean,
      // the bed's texture. (Gravity's 5/7 share for a rolling ball comes out
      // of the friction impulses in contact(), not from a rule here.)
      var nx = b.supNx, ny = b.supNy, nz = b.supNz;
      var vnS = b.vx * nx + b.vy * ny + b.vz * nz;
      var vtx = b.vx - vnS * nx, vty = b.vy - vnS * ny, vtz = b.vz - vnS * nz;
      var vt = Math.hypot(vtx, vty, vtz);
      var crr = b.supKind === 'bed' ? T.crrBed : T.crrLane;
      if (vt > 1e-6) {
        var fr = crr * g * ny;
        var cap = vt / dt; if (fr > cap) fr = cap;
        ax -= fr * vtx / vt; ay -= fr * vty / vt; az -= fr * vtz / vt;
      }
      if (b.supKind === 'lane' || b.supKind === 'hop') az -= T.laneLean;
      if (b.supKind === 'bed') ax += T.bedNudge * (hash01(b.seed, b.n) - 0.5) * 2;
    }
    // english
    if (b.w) {
      if (!b.launched && b.sup) {
        var grow = Math.min(T.spinGrow, Math.max(1, T.spinVRef / Math.max(sp, 0.3)));
        ax += T.spinA * b.w * grow;
      } else if (!b.touchedBed) ax += T.spinAir * b.w;
      else if (b.sup) ax += T.spinBed * b.w;
    }
    // a stalled ball is carried home at a walking pace (the lean + the return)
    if (b.phase === 'return' && b.sup && b.z < T.L && b.vz > -T.returnMinV) az -= T.returnAccel;

    b.vx += ax * dt; b.vy += ay * dt; b.vz += az * dt;
    if (b.touchedBed && T.cupDrag > 0) {
      var qd = toBed(b.x, b.y, b.z);
      if (qd.h < T.cupH && (bandAt(qd.u, qd.v) >= 0)) {
        var kd = Math.exp(-T.cupDrag * dt);
        b.vx *= kd; b.vy *= kd; b.vz *= kd; b.wx *= kd; b.wy *= kd; b.wz *= kd;
      }
    }
    var px = b.x, py = b.y, pz = b.z;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    // flight metric: first crossing of rim-top level above the bed (interpolated)
    if (b.launched && !b.landF && b.z > T.bedZ0 - r) {
      var hTop = T.rimH + r, q0 = toBed(px, py, pz), q1 = toBed(b.x, b.y, b.z);
      if (q1.h <= hTop && q1.v > -r) {
        var f = q0.h > q1.h ? Math.max(0, Math.min(1, (q0.h - hTop) / (q0.h - q1.h))) : 1;
        b.landF = { u: q0.u + (q1.u - q0.u) * f, v: q0.v + (q1.v - q0.v) * f, t: b.t + f * dt };
      }
    }

    // dropping into a cup: centre over the open part of a cup, bottom down
    // at the rim tops, coming down. Checked BEFORE the contacts so the cup's
    // back wall catches the ball instead of bouncing it back out — the cups
    // are holes in a real machine (see capHDrop).
    if (b.launched && (b.phase === 'flight' || b.phase === 'bed')) {
      var qc = toBed(b.x, b.y, b.z);
      if (qc.h < T.capHDrop && qc.v > 0) {
        var bandC = bandAt(qc.u, qc.v);
        var vhd = b.vy * D.cB - b.vz * D.sB;
        if (bandC >= 0 && vhd < 0 && Math.hypot(b.vx, b.vy, b.vz) < T.capVDrop && overClearCup(qc, bandC)) {
          if (!b.touchedBed) bedHit(b, 'cup', -vhd, null);
          b.t += dt;
          return capture(b, qc, SCORES[bandC], bandC, null);
        }
      }
    }

    /* contacts */
    b.sup = 0; b._supBest = 0; b.supKind = 'air';
    var s;

    // lane + hop surface, crest edge, pit front wall
    if (b.z < T.L + r && b.y < T.hCrest + 2 * r + 0.3) {
      if (b.z <= T.zHop - r * 0.0 && b.z < T.zHop) {
        if (b.y < r) { s = contact(b, 0, 1, 0, r - b.y, 0, T.muImpact); if (b.sup) b.supKind = 'lane'; }
      } else {
        var zc = b.z;
        for (var it = 0; it < 4; it++) {
          var th = zc > T.zHop ? Math.atan(hopSlope(Math.min(zc, T.L))) : 0;
          zc = b.z + r * Math.sin(th);
        }
        if (zc <= T.L) {
          var th2 = zc > T.zHop ? Math.atan(hopSlope(zc)) : 0;
          var c = Math.cos(th2), sn = Math.sin(th2);
          var dist = (b.y - surfaceAt(0, zc)) * c - (b.z - zc) * sn;
          if (dist < r) {
            contact(b, 0, c, -sn, r - dist, 0, T.muImpact); if (b.sup) b.supKind = zc > T.zHop ? 'hop' : 'lane';
            // exact crest exit: a ball that will pass the crest within this
            // substep leaves from the crest itself, on the crest tangent, with
            // the rolling energy the last sliver of climb costs. Without this
            // the exit angle jitters with the substep phase (±0.4° → ±0.08
            // units of landing) and landing distance folds in power.
            var vAlong = b.vz * c + b.vy * sn;
            if (!b.launched && b.phase !== 'return' && vAlong > 0 && zc + vAlong * c * dt >= T.L)
              crestExit(b, vAlong, surfaceAt(0, zc));
          }
        } else if (b.y >= T.hCrest) {
          var ey = b.y - T.hCrest, ez = b.z - T.L, ed = Math.hypot(ey, ez);
          if (!b.launched && b.phase !== 'return' && b.vz > 0 && ez < r) {
            // passed the crest inside one substep without the hop branch seeing it
            crestExit(b, Math.hypot(b.vy, b.vz), b.y - r * Math.cos(Math.atan2(b.vy, b.vz)));
          } else if (ed < r && ed > 1e-9) { contact(b, 0, ey / ed, ez / ed, r - ed, 0, T.muImpact); if (b.sup) b.supKind = 'hop'; }
        } else if (b.z < T.L + r) {
          contact(b, 0, 0, 1, T.L + r - b.z, T.ePit, T.muImpact);
        }
      }
    }
    // side rails (lane/hop) and side walls (pit/bed)
    var hw = (b.z < T.L ? T.laneHalfW : T.bedHalfW) - r;
    if (b.x > hw) { s = contact(b, -1, 0, 0, b.x - hw, b.launched ? T.eWall : T.eRail, T.muRail); if (s > T.evWall) emitCd(b, 'wall', { type: 'wall', speed: +s.toFixed(3) }); b.w *= 0.5; }
    else if (b.x < -hw) { s = contact(b, 1, 0, 0, -hw - b.x, b.launched ? T.eWall : T.eRail, T.muRail); if (s > T.evWall) emitCd(b, 'wall', { type: 'wall', speed: +s.toFixed(3) }); b.w *= 0.5; }

    // pit back wall (the bed's front face) and floor
    if (b.z > T.L && b.y < T.bedY0 && b.z > T.bedZ0 - r) contact(b, 0, 0, -1, b.z - (T.bedZ0 - r), T.ePit, T.muImpact);

    // bed
    var q = toBed(b.x, b.y, b.z);
    if (q.v > -r - 0.05 && q.h < 1.2 && b.z > T.L) {
      // lip edge (corner line at v = 0, h = 0)
      if (q.v < 0 && b.y >= T.bedY0) {
        var ld = Math.hypot(q.v, q.h);
        if (ld < r && ld > 1e-9) {
          var nl = bedN(0, q.v / ld, q.h / ld);
          s = contact(b, nl[0], nl[1], nl[2], r - ld, T.eLip, T.muImpact);
          bedHit(b, 'lip', s, null);
          q = toBed(b.x, b.y, b.z);
        }
      }
      // plane (open everywhere except over the ring stack and the holes)
      if (q.v >= 0 && q.h < r && q.h > -0.3) {
        var dC = Math.hypot(q.u, q.v - T.ringCV);
        if (dC > T.rims[0] && holeAt(q.u, q.v, D.lipRing) < 0) {
          var nb = bedN(0, 0, 1);
          s = contact(b, nb[0], nb[1], nb[2], r - q.h, T.eBed, T.muImpact);
          bedHit(b, 'plane', s, null);
          q = toBed(b.x, b.y, b.z);
        }
      }
      // rims
      if (q.h < T.rimH + r + 0.01) {
        var dCr = Math.hypot(q.u, q.v - T.ringCV);
        if (dCr < T.rims[0] + r + D.rho + 0.01) {
          for (var k = 0; k < T.rims.length; k++) {
            var e = T.eRim * (1 + T.rimRough * (hash01(b.seed ^ 0x51ed, b.n * 8 + k) - 0.5) * 2);
            s = ringContact(b, q, 0, T.ringCV, T.rims[k], rimTop, k, D.rho, e, T.muImpactRim);
            if (s >= 0) {
              bedHit(b, 'rim', s, k);
              q = toBed(b.x, b.y, b.z);
            }
          }
        }
        // the berm outside rim 0: a straight fillet in the (radial, h) plane
        dCr = Math.hypot(q.u, q.v - T.ringCV);
        var dB = dCr - T.rims[0];
        if (T.bermW > 0 && dB > 0 && dB < T.bermW + r) {
          var bw = T.bermW, bh = T.rimH, L2 = bw * bw + bh * bh;
          var tt = Math.max(0, Math.min(1, (dB * bw + (q.h - bh) * -bh) / L2));
          var cr = tt * bw, chh = bh - tt * bh;
          var er = dB - cr, eh = q.h - chh, ed2 = Math.hypot(er, eh);
          if (ed2 < r && ed2 > 1e-9 && (er * bh + eh * bw) > 0) {
            var nbr = er / ed2, nbh = eh / ed2, du0 = q.u / dCr, dv0 = (q.v - T.ringCV) / dCr;
            var nB = bedN(nbr * du0, nbr * dv0, nbh);
            s = contact(b, nB[0], nB[1], nB[2], r - ed2, T.eBed, T.muImpact);
            bedHit(b, 'plane', s, null);
            q = toBed(b.x, b.y, b.z);
          }
        }
        // 100-hole lips / wells
        for (var hI = 0; hI < 2; hI++) {
          var hu = (hI ? 1 : -1) * T.holeU;
          s = ringContact(b, q, hu, T.holeV, D.lipRing, flatTop, 0, D.rho, T.eRim, T.muImpactRim);
          if (s >= 0) {
            bedHit(b, 'hole', s, hI);
            q = toBed(b.x, b.y, b.z);
          }
        }
      }
      // cage roof
      if (q.v > 0 && q.h > T.cageH - r) {
        var nc = bedN(0, 0, -1);
        s = contact(b, nc[0], nc[1], nc[2], q.h - (T.cageH - r), T.eBackstop, T.muImpact);
        if (s > T.evWall) emitCd(b, 'wall', { type: 'wall', speed: +s.toFixed(3), cage: true });
        q = toBed(b.x, b.y, b.z);
      }
      // backstop
      if (q.v > T.bedTopV - r) {
        var nbk = bedN(0, -1, 0);
        s = contact(b, nbk[0], nbk[1], nbk[2], q.v - (T.bedTopV - r), T.eBackstop, T.muBackstop);
        bedHit(b, 'backstop', s, null);
        q = toBed(b.x, b.y, b.z);
      }
    }

    b.t += dt;

    /* phase bookkeeping */
    if (!b.launched) {
      var zcNow = b.z + r * Math.sin(D.thetaCrest) + 1e-9;
      if (b.phase !== 'return' && zcNow >= T.L) {
        b.launched = true; b.tLaunch = b.t; b.phase = 'flight';
        emit(b, { type: 'launch', v: +sp.toFixed(3) });
      } else if (b.phase !== 'return' && b.vz <= 0) {
        b.phase = 'return';
        emit(b, { type: 'stall', z: +b.z.toFixed(3) });
      } else if (b.phase === 'return') {
        if (b.z <= 0) {
          b.z = 0; b.vx = b.vy = b.vz = 0;
          emit(b, { type: 'return' });
          finish(b, { kind: 'return', score: 0, cup: null });
        }
      } else b.phase = b.z >= T.zHop ? 'hop' : 'roll';
    }

    // launched too softly to leave the crest: it rolled back over the edge
    // onto the hop. That is a dead roll, not a flight.
    if (b.launched && !b.touchedBed && b.z < T.L - r && b.vz < 0 && b.y < T.hCrest + r + 0.02) {
      b.launched = false; b.phase = 'return';
      emit(b, { type: 'stall', z: +b.z.toFixed(3) });
    }
    // bounced all the way back out over the pit onto the hop/lane
    if (b.touchedBed && b.phase === 'bed' && b.z < T.L - r && b.y < T.hCrest + 2 * r) {
      b.phase = 'return'; b.launched = false;
      emit(b, { type: 'stall', z: +b.z.toFixed(3), bounced: true });
    }
    if (b.phase === 'done') return;

    // gutter: touched the pit floor
    if (b.y - r <= T.pitFloorY) {
      b.y = T.pitFloorY + r; b.vx = b.vy = b.vz = 0;
      b.phase = 'gutter'; b.endT = b.t;
      emit(b, { type: 'gutter' });
      b.result = { kind: 'gutter', score: 0, cup: null, t: +b.t.toFixed(4) };
      return;
    }

    if (b.touchedBed && b.phase !== 'return') {
      q = toBed(b.x, b.y, b.z);
      var spd = Math.hypot(b.vx, b.vy, b.vz);
      // down a 100 hole
      // down a 100 hole: sunk into the well, or a direct hit — the centre
      // over the mouth while the ball comes down through lip level
      var hole = holeAt(q.u, q.v, T.holeR);
      if (hole >= 0) {
        var vh = b.vy * D.cB - b.vz * D.sB;
        if (q.h < T.holeCapH) return capture(b, q, 100, 5 + hole, hole);
        if (vh < 0 && q.h < r + T.lipH && holeAt(q.u, q.v, T.holeDirectR) >= 0) return capture(b, q, 100, 5 + hole, hole);
      }
      // between two rims
      var band = bandAt(q.u, q.v);
      if (band >= 0) {
        // settled in the cup (low and slow), or coming down into the open
        // part of it with its bottom at the rim tops: the cups are holes in
        // a real machine, and that is the ball dropping into the ring
        if (q.h < T.capH && spd < T.capV) return capture(b, q, SCORES[band], band, null);
      }
      // at rest somewhere odd (e.g. propped against the outer rim from above)
      if (spd < T.restV) {
        b.restT += dt;
        if (b.restT > T.restT) { emit(b, { type: 'stall', u: +q.u.toFixed(3), v: +q.v.toFixed(3) }); return forceResolve(b); }
      } else b.restT = 0;
    }
    if (b.t > T.timeoutT) { emit(b, { type: 'timeout' }); return forceResolve(b); }
  }

  function forceResolve(b) {
    var T = TUNE, q = toBed(b.x, b.y, b.z);
    if (!b.launched) {
      emit(b, { type: 'return' });
      return finish(b, { kind: 'return', score: 0, cup: null });
    }
    var hole = holeAt(q.u, q.v, D.lipRing + D.r);
    if (hole >= 0 && q.v >= 0) return capture(b, q, 100, 5 + hole, hole);
    var d = Math.hypot(q.u, q.v - T.ringCV);
    if (q.v >= 0 && d <= T.rims[0] + D.r + D.rho + 0.02) {
      var band = bandAt(q.u, q.v); if (band < 0) band = 0;
      return capture(b, q, SCORES[band], band, null);
    }
    b.phase = 'gutter'; b.endT = b.t; b.vx = b.vy = b.vz = 0;
    emit(b, { type: 'gutter' });
    b.result = { kind: 'gutter', score: 0, cup: null, t: +b.t.toFixed(4) };
  }

  function capture(b, q, score, band, hole) {
    var T = TUNE, tu, tv;
    if (hole !== null) { tu = (hole ? 1 : -1) * T.holeU; tv = T.holeV; }
    else {
      var du = q.u, dv = q.v - T.ringCV, d = Math.hypot(du, dv);
      var mid = band < T.rims.length - 1 ? (T.rims[band] + T.rims[band + 1]) / 2 : 0;
      if (d < 1e-6) { du = 0; dv = 1; d = 1; }
      tu = du / d * mid; tv = T.ringCV + dv / d * mid;
    }
    b.cap = { u0: q.u, v0: q.v, h0: q.h, u1: tu, v1: tv, h1: -D.r * 1.4, t0: b.t };
    b.vx = b.vy = b.vz = 0;
    b.phase = 'captured';
    b.result = { kind: hole !== null ? 'hole' : 'ring', score: score, cup: score, band: band, hole: hole, t: +b.t.toFixed(4) };
    emit(b, { type: 'captured', score: score, cup: score, band: band, hole: hole, rattled: b.rimHits > 0, rims: b.rimHits });
  }

  function finish(b, res) {
    b.phase = 'done';
    res.t = +b.t.toFixed(4);
    b.result = res;
    emit(b, { type: 'done', score: res.score });
  }

  function step(b, dt) {
    if (!b || b.phase === 'done') return b;
    var h = TUNE.substep;
    var n = Math.max(1, Math.round(dt / h));
    var sdt = dt / n;
    for (var i = 0; i < n && b.phase !== 'done'; i++) {
      if (b.phase === 'captured') {
        b.t += sdt;
        if (b.t - b.cap.t0 >= TUNE.sinkT) finish(b, b.result);
      } else if (b.phase === 'gutter') {
        b.t += sdt;
        if (b.t - b.endT >= TUNE.gutterT) finish(b, b.result);
      } else substep(b, sdt);
    }
    var p = pose(b);
    b.trail.push({ t: +b.t.toFixed(4), x: p.x, y: p.y, z: p.z, phase: p.phase });
    if (b.trail.length > 64) b.trail.shift();
    return b;
  }

  function ease(s) { return s * s * (3 - 2 * s); }

  function pose(b) {
    var T = TUNE, r = D.r;
    var x = b.x, y = b.y, z = b.z, sinking = 0, cup = null;
    var ph = b.phase;
    if (b.cap) {
      var s = Math.min(1, (b.t - b.cap.t0) / T.sinkT);
      sinking = s;
      var c = b.cap, k = ease(s), kh = s * s; // slide to the cup line, drop accelerating
      var P = fromBed(c.u0 + (c.u1 - c.u0) * k, c.v0 + (c.v1 - c.v0) * k, c.h0 + (c.h1 - c.h0) * kh);
      x = P.x; y = P.y; z = P.z;
      cup = b.result ? b.result.score : null;
      if (ph === 'done') ph = 'done';
    } else if (ph === 'gutter' || (ph === 'done' && b.result && b.result.kind === 'gutter')) {
      sinking = Math.min(1, (b.t - b.endT) / T.gutterT);
    }
    var q = toBed(x, y, z);
    var onBed = false;
    if (!b.cap && b.touchedBed && ph !== 'gutter' && ph !== 'done') {
      onBed = b.supKind === 'bed';
      var band = bandAt(q.u, q.v);
      if (band >= 0 && q.h < T.rimH + r) cup = SCORES[band];
      else if (holeAt(q.u, q.v, T.holeR) >= 0 && q.h < r) cup = 100;
    }
    return { x: x, y: y, z: z, r: r, phase: ph, sinking: sinking, cup: cup, onBed: onBed,
             u: q.u, v: q.v, h: q.h, vx: b.vx, vy: b.vy, vz: b.vz, t: b.t };
  }

  function simulate(args, opts) {
    args = args || {}; opts = opts || {};
    var maxT = opts.maxT || 12, dt = 1 / 120;
    var b = createThrow(args.x0 || 0, args.v || 0, args.aim || 0, args.spin || 0, args.seed || 0);
    var trail = [];
    var keepTrail = opts.trail !== false;
    if (keepTrail) trail.push({ t: 0, x: b.x, y: b.y, z: b.z, phase: b.phase });
    while (b.phase !== 'done' && b.t < maxT) {
      step(b, dt);
      if (keepTrail) { var p = pose(b); trail.push({ t: +b.t.toFixed(4), x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4), phase: p.phase, sinking: +p.sinking.toFixed(3) }); }
    }
    var result = b.result || { kind: 'unresolved', score: 0, cup: null, t: b.t };
    return { events: b.events, trail: trail, result: result, land: b.land, landF: b.landF, tLaunch: b.tLaunch, ball: b };
  }

  var SkeeBallPhysics = {
    TUNE: TUNE, GEO: GEO, SCORES: SCORES,
    createThrow: createThrow, step: step, pose: pose, simulate: simulate,
    hash01: hash01, surfaceAt: surfaceAt, configure: configure,
    toBed: toBed, fromBed: fromBed, bandAt: bandAt, rimTop: rimTop
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SkeeBallPhysics;
  if (typeof window !== 'undefined') window.SkeeBallPhysics = SkeeBallPhysics;
})();
