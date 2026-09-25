/* HOLLER ROLLER — ball physics (PLAN-2 §2, §3; round 2 per the physics critic)
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
 *   pit    floor y = pitFloorY,            z ∈ [L, bedZ0]   (swallows)
 *   bed    a plane through the lip (bedZ0, bedY0) rising at bedAngle; bed
 *          coordinates (u, v, h): u = x, v = slope distance up the plane
 *          from the lip, h = height above the plane.
 *
 * Nothing is scripted after the throw. Gravity, rolling resistance and
 * rigid-sphere contact impulses (restitution + Coulomb friction coupled to
 * the ball's spin) against the lane/hop surface, the crest and lip edges,
 * the pit walls, the bed plane, the ring cups, the 100-hole wells, the side
 * walls, the backstop and a safety cage produce every bounce, rattle, skip,
 * backstop rebound and dead roll.
 *
 * THE CUPS. Each band between two rims (and the 50 disc) is a real
 * depression: a floor cupDepth below the bed plane with the rims as walls
 * on both sides (rimH above the plane, so rimH + cupDepth above the floor).
 * A ball that drops into a cup is held by physics; it is CAPTURED only once
 * it has settled there (slower than settleV for settleT), or sunk deeper
 * than capDeepH clear of the rims. A fast ball skips over a rim or bounces
 * off a wall into the next cup — the rattle, caused rather than decided.
 *
 * GEOMETRY RECONCILIATION (see PLAN-2 §11, round 2). The pinned cups are
 * narrower than the drawn ball: the clear gap between drawn rims is
 * 0.14–0.16, the ball is 0.22 across, and a ball nested on two rim tops of a
 * 41° bed escapes at < 0.1 u/s (it cannot be held). So the rims collide as
 * thin blades (tube radius rimBlade) and the ball meets them with a smaller
 * collision radius rimBallR, which lets it drop to the cup floor. Everything
 * else (floor, bed, lane, walls) uses the full ball radius. On screen the
 * ball overlaps a drawn rim by ≤ 2–3 px, only while it is below the bed
 * plane — where the renderer draws the near hoop over it anyway.
 *
 * Also beyond PLAN-2 §2 (all in GEO): the dented 40 (a lower wall on the
 * 40's rim over its upper-right octant), the outer rim's top arc worn
 * nearly flush with the bed (backstop rebounds roll into the 10 — the
 * renderer draws it worn), pit walls splaying from the lane's half-width to
 * the bed's, and a safety cage roof high over the bed.
 *
 * Integration: semi-implicit Euler in exact 1/240 s substeps; step(b, dt)
 * accumulates ANY dt, so outcomes do not depend on the frame rate. No
 * contact may add energy (clamped). The only randomness is hash01(seed, i):
 * ±3 % rim restitution roughness, a tiny bed-texture nudge, and which way a
 * ball balanced exactly on a rim top tips.
 *
 * Tuning is per throw: createThrow(…, tuneOverride) snapshots TUNE (plus
 * the override) onto the ball. configure() only changes the defaults for
 * throws created afterwards.
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
    bedHalfW: 1.02,          // round 4: matched to the painted bed
    bedTopV: 2.60,           // backstop (round 4: the visible top of the painted bed)
    ringCV: 1.20,            // ring centre (u = 0)
    rims: [0.93, 0.744, 0.535, 0.326, 0.119], // innermost 0.116 → 0.126 in round 3, 0.119 in round 5 (the 50's catch)
    rimH: 0.08, rimW: 0.05,  // drawn rim height above the bed plane, drawn thickness
    rimBackRise: 1.0,        // round 5: the up-bed half of each rim is taller by × (1 + rimBackRise·sin angle)
    holeU: 0.7512, holeV: 2.30, holeR: 0.14, lipH: 0.04, // round 4: v from the lip, as painted

    // ── cups (round 2) ──
    cupDepth: 0.12,          // cup floor below the bed plane
    rimBlade: 0.005,         // physical rim: a thin blade, tube radius
    rimBallR: 0.04,          // the ball's collision radius against rim blades (see header)
    // the dented 40: its rim's wall is lower over the upper-right octant
    dentRim: 3,
    dentA0: 44, dentA1: 69,  // degrees from +u toward +v (round 4: the drawn 7-px flat)
    dentDepth: 1.12,         // rim height × (1 − dentDepth) inside the dent: worn a hair below the bed
    dentTaper: 10,           // degrees of smooth shoulder each side
    // the outer rim's top arc is worn nearly flush with the bed (as on a
    // real machine, where the backboard runs down into the 10): a ball that
    // comes back off the backstop rolls straight into the 10 cup
    flushRim: 0, flushA0: 35, flushA1: 145, flushDepth: 0.8, flushTaper: 15,
    cageH: 2.4,              // safety cage roof, height above the bed; < 1 % of throws touch it

    // ── world ──
    g: 3.2,                  // cinematic gravity, units/s² (flight ≈ 0.5 s mid-power)
    rollK: 5 / 7,            // rolling sphere's share of a slope's pull (crest energy only)
    // the alley rises gently toward the hop (real alleys do; undrawn):
    // stalled balls roll home. An along-lane accel ≈ g·sin 2.9°; a soft
    // throw loses ≤ 12 % of its speed along the lane to it.
    laneLean: 0.16,
    laneSideA: 0, hopBackA: 0,   // mischief: the lean (lateral u/s²) and the sulk's hop brake (u/s²)
    crrLane: 0.018,          // rolling resistance, waxed maple
    crrBed: 0.06,            // cork bed
    crrCup: 2.0,             // cork cup floor and walls: dead
    // a stalled (or bounced-back) ball is walked home, never faster than returnMaxV and never
    // faster than returnFrac × the speed it was thrown at (floor returnMinV)
    returnMaxV: 2.2, returnFrac: 1.0, returnMinV: 0.5, returnAccel: 1.5,
    returnDoneZ: 0.6,        // a ball rolling home is done here (the renderer rolls it into the rail)

    // ── contacts ──
    eRail: 0.5, eWall: 0.45, eBed: 0.15, eRim: 0.05, eFloor: 0.05,
    eBackstop: 0.15, ePit: 0.2, eLip: 0.35, eCage: 0.3,
    muImpact: 0.3,           // Coulomb friction at contacts (slip ↔ spin); ≥ (2/7)·tan β to roll on the bed
    muImpactRim: 0.6,        // cork rims grip
    muRail: 0.05,            // varnished rails and walls
    railScrub: 0.35,         // a rail bounce also scrubs this × the normal impulse off the along-rail speed
    muBackstop: 0.04,        // padded backstop: a topspun ball doesn't climb it
    vRest: 0.144,            // normal approach speeds below this don't bounce (resting contact)
    rimRough: 0.03,          // ±3 % seeded restitution roughness
    bedNudge: 0.038,         // seeded bed-texture lateral accel, units/s²
    perchV: 0.3,             // a ball this slow on a rim top…
    perchNudge: 0.6,         // …is tipped off toward the side its centre leans, units/s²
    lipNudge: 1.2,           // a slow ball propped on a 100-hole lip is tipped (u/s²)…
    lipTipIn: 0.3,           // …into the hole if its centre is within lipRing + lipTipIn·r, else away down the bed…
    lipTipT: 0.25,           // …or into the hole anyway once 'away' has been blocked this long (s)
    supportNy: 0.3,          // a contact whose normal has this much +y supports the ball (rolling)

    // ── english (a lateral-acceleration coefficient, not the ball's spin ω) ──
    spinA: 0.288,            // lane lateral accel per unit english at speed ≥ spinVRef
    spinVRef: 3.2,           // the hook blooms as the ball slows below this…
    spinGrow: 2.2,           // …up to spinGrow × spinA
    spinVFloor: 0.24,        // speed floor in that ratio
    spinAir: 0.077,          // tiny airborne drift
    spinBed: 0.064,          // and on the bed
    spinRailKeep: 0.5,       // english kept after a rail/wall hit

    // ── capture / resolution ──
    settleV: 0.25, settleT: 0.08, // settled in a cup: slower than settleV for settleT → captured
    capH: 0.04,              // "in the cup": centre below this height above the bed plane
    capDeepH: -0.066,        // …or sunk deeper than this (−0.6 r) clear of the rims → captured
    holeCapH: 0.06,          // down a 100 hole
    holeDirectR: 0.075,      // a direct hit drops in if its centre is this close to the hole's
    restV: 0.05, restT: 0.6, // at rest on the open bed this long → resolved where it sits ('rest')
    restReach: 0.02,         // …into the 10 if within ball + rim reach of the outer rim + this
    sinkT: 0.35, gutterT: 0.35,
    gutterDrop: 0.3,         // a falling ball this far below the lip, inside the pit, is swallowed
    sinkDepth: 1.4,          // the sink ends this many ball radii below the bed plane
    sinkVMax: 2.4,           // capture momentum carried into the sink, units/s (cap)
    timeoutT: 8.0,           // no throw lasts longer than this from release (force-resolved in time to sink)
    preLaunchT: 20.0,        // …or this long after the throw if it never launched (safety)

    // ── events ──
    evRim: 1.15, evBed: 0.28, evWall: 0.24, evBackstop: 0.24, evCooldown: 0.05,

    // ── input range (the swipe maps into this; physics accepts any v ≥ 0) ──
    vMin: 2.08, vMax: 7.2, vAbsMax: 9.6,
    aimSoft: 0.35, aimMax: 0.44, // aim is linear to ±aimSoft, then compresses smoothly toward ±aimMax
    substep: 1 / 240,
    trailCap: 64             // ball.trail keeps this many recent poses
  };

  var SCORES = [10, 20, 30, 40, 50];
  var DEG = Math.PI / 180;
  var SALT_RIM = 0x51ed;     // hash salts: rim roughness,
  var SALT_PERCH = 0x9e7;    // which way an exactly balanced ball tips

  // derived constants for one tuning
  function derive(T) {
    var D = {};
    D.T = T;
    D.r = T.ballR;
    D.sB = Math.sin(T.bedAngle); D.cB = Math.cos(T.bedAngle);
    D.hopLen = T.L - T.zHop;
    D.thetaCrest = Math.atan(2 * T.hCrest / D.hopLen);
    D.lipRing = T.holeR + T.rimW / 2;
    D.lipRho = T.rimW / 2;
    D.dent0 = T.dentA0 * DEG; D.dent1 = T.dentA1 * DEG; D.dentTap = T.dentTaper * DEG;
    D.flush0 = T.flushA0 * DEG; D.flush1 = T.flushA1 * DEG; D.flushTap = T.flushTaper * DEG;
    D.rimReach = T.rimBallR + T.rimBlade;
    D.landH = T.rimH + T.ballR; // lab metric: where a flight first comes down to rim-top level
    return D;
  }

  var GEO = {};
  var DEF = null; // derived constants for the module defaults
  function buildGeo() {
    var T = TUNE;
    DEF = derive(T);
    GEO.ballR = T.ballR;
    GEO.L = T.L; GEO.zHop = T.zHop; GEO.hCrest = T.hCrest;
    GEO.launchAngle = DEF.thetaCrest;
    GEO.laneHalfW = T.laneHalfW;
    GEO.laneLean = T.laneLean;
    GEO.pit = { z0: T.L, z1: T.bedZ0, floorY: T.pitFloorY };
    GEO.bed = { z0: T.bedZ0, y0: T.bedY0, angle: T.bedAngle, halfW: T.bedHalfW, vTop: T.bedTopV };
    GEO.ringC = { u: 0, v: T.ringCV };
    GEO.rims = T.rims.slice();
    GEO.scores = SCORES.slice();
    GEO.rimH = T.rimH; GEO.rimW = T.rimW;
    GEO.cupDepth = T.cupDepth;
    GEO.dent = { rim: T.dentRim, a0: T.dentA0, a1: T.dentA1, depth: T.dentDepth };
    GEO.flush = { rim: T.flushRim, a0: T.flushA0, a1: T.flushA1, depth: T.flushDepth };
    GEO.rimTop = function (k, ang) { return rimTop(DEF, k, ang); }; // (k, angleRad) → rim height there
    GEO.holes = [{ u: -T.holeU, v: T.holeV, r: T.holeR }, { u: T.holeU, v: T.holeV, r: T.holeR }];
    GEO.lipH = T.lipH;
    GEO.cageH = T.cageH;
    return GEO;
  }
  buildGeo();

  // change the defaults for throws created from now on (rebuilds GEO in place)
  function configure(partial) {
    if (partial) for (var k in partial) if (Object.prototype.hasOwnProperty.call(partial, k)) TUNE[k] = partial[k];
    return buildGeo();
  }

  // deterministic hash → [0, 1)
  function hash01(seed, i) {
    var h = (Math.imul(seed | 0, 0x9E3779B1) ^ Math.imul(((i | 0) + 0x7F4A7C15) | 0, 0x85EBCA77)) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // the swipe aim, softly clamped: linear to ±aimSoft, then compressing
  // (C¹-smooth) toward ±aimMax, so noise past the clamp is never discarded
  function softAim(T, a) {
    var s = T.aimSoft, m = T.aimMax, x = Math.abs(a);
    if (x <= s) return a;
    var w = m - s;
    return (a < 0 ? -1 : 1) * (s + w * Math.tanh((x - s) / w));
  }

  /* ── surfaces ─────────────────────────────────────────────────── */

  function hopY(D, z) { var t = (z - D.T.zHop) / D.hopLen; return D.T.hCrest * t * t; }
  function hopSlope(D, z) { return 2 * D.T.hCrest * (z - D.T.zHop) / (D.hopLen * D.hopLen); }
  function surfY(D, z) { return z <= D.T.zHop ? 0 : hopY(D, Math.min(z, D.T.L)); }

  // y of the lane/hop surface under (x, z), or null over the pit / beyond
  function surfaceAt(x, z) {
    var T = TUNE;
    if (z < -1 || z > T.L) return null;
    return z <= T.zHop ? 0 : hopY(DEF, z);
  }

  function toBedD(D, x, y, z) {
    var dy = y - D.T.bedY0, dz = z - D.T.bedZ0;
    return { u: x, v: dy * D.sB + dz * D.cB, h: dy * D.cB - dz * D.sB };
  }
  function fromBedD(D, u, v, h) {
    return { x: u, y: D.T.bedY0 + v * D.sB + h * D.cB, z: D.T.bedZ0 + v * D.cB - h * D.sB };
  }
  function toBed(x, y, z) { return toBedD(DEF, x, y, z); }
  function fromBed(u, v, h) { return fromBedD(DEF, u, v, h); }

  // smooth 0..1 window over [a0, a1] (rad) with cosine shoulders of width tp
  function arcWin(ang, a0, a1, tp) {
    if (ang >= a0 && ang <= a1) return 1;
    if (ang > a0 - tp && ang < a0) return 0.5 - 0.5 * Math.cos(Math.PI * (ang - (a0 - tp)) / tp);
    if (ang > a1 && ang < a1 + tp) return 0.5 + 0.5 * Math.cos(Math.PI * (ang - a1) / tp);
    return 0;
  }
  // top height (above the bed plane) of rim k at polar angle ang (rad, 0 = +u, π/2 = up-bed)
  function rimTop(D, k, ang) {
    var T = D.T, hgt = T.rimH;
    // the up-bed half of each hoop stands a little taller (the cups' back
    // walls), so a ball arriving from below meets wall, not a ski-jump top
    if (T.rimBackRise) { var sa = Math.sin(ang); if (sa > 0) hgt *= 1 + T.rimBackRise * sa; }
    if (k === T.dentRim) hgt *= 1 - T.dentDepth * arcWin(ang, D.dent0, D.dent1, D.dentTap);
    if (k === T.flushRim) hgt *= 1 - T.flushDepth * arcWin(ang, D.flush0, D.flush1, D.flushTap);
    return hgt;
  }
  function inDent(D, ang) { return arcWin(ang, D.dent0, D.dent1, D.dentTap) > 0; }

  // which cup a bed point is over: 0..4 (score index) or −1 outside the stack
  function bandAtD(D, u, v) {
    var d = Math.hypot(u, v - D.T.ringCV), R = D.T.rims;
    if (d > R[0]) return -1;
    for (var k = 0; k < R.length - 1; k++) if (d > R[k + 1]) return k;
    return R.length - 1;
  }
  function bandAt(u, v) { return bandAtD(DEF, u, v); }
  function holeAtD(D, u, v, rad) {
    for (var i = 0; i < 2; i++) {
      var hu = (i ? 1 : -1) * D.T.holeU;
      if (Math.hypot(u - hu, v - D.T.holeV) < rad) return i;
    }
    return -1;
  }

  /* ── ball ─────────────────────────────────────────────────────── */

  function createThrow(x0, v, aim, spin, seed, tuneOverride) {
    var T = TUNE;
    if (tuneOverride) {
      T = {};
      for (var k in TUNE) T[k] = TUNE[k];
      for (var j in tuneOverride) if (Object.prototype.hasOwnProperty.call(tuneOverride, j)) T[j] = tuneOverride[j];
    }
    var D = tuneOverride ? derive(T) : DEF;
    var r = D.r;
    x0 = +x0 || 0; v = +v || 0; aim = +aim || 0; spin = +spin || 0;
    var lim = T.laneHalfW - r;
    x0 = Math.max(-lim, Math.min(lim, x0));
    v = Math.max(0, Math.min(T.vAbsMax, v));
    aim = softAim(T, aim);
    spin = Math.max(-1, Math.min(1, spin));
    var b = {
      T: T, D: D,
      x: x0, y: r, z: 0,
      vx: v * Math.sin(aim), vy: 0, vz: v * Math.cos(aim),
      wx: 0, wy: 0, wz: 0,                 // angular velocity, rad/s
      english: spin,                       // the throw's english (lateral-accel coefficient)
      seed: seed | 0,
      phase: 'roll', t: 0, n: 0, acc: 0,   // sim time, substep index, substep accumulator
      launched: false, tLaunch: -1, touchedBed: false,
      vThrow: v, vPeak: v,                 // for the return speed cap
      sup: 0, supNx: 0, supNy: 1, supNz: 0, supKind: 'lane', _supBest: 0,
      rimTouch: false, perchSide: 0, perchU: 0, perchV: 0, tipOn: false, tipU: 0, tipV: 0, lipT: 0,
      settleT: 0, restT: 0, rimHits: 0, cd: {},
      band: -1, dentEscape: false, in40Dent: false, in40Other: false, cageTouch: false,
      land: null,                          // first bed-side contact {u, v, t, kind, band}
      landF: null,                         // lab: where the flight first came down to rim-top level
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
    if (b.cd[key] !== undefined && b.t - b.cd[key] < b.T.evCooldown) return;
    b.cd[key] = b.t; emit(b, ev);
  }

  // Energy per unit mass: translation + rotation (solid sphere) + height.
  function energy(b) {
    var r = b.D.r;
    return 0.5 * (b.vx * b.vx + b.vy * b.vy + b.vz * b.vz) +
           0.2 * r * r * (b.wx * b.wx + b.wy * b.wy + b.wz * b.wz) + b.T.g * b.y;
  }

  // One contact: push out along n by pen, then a rigid-sphere impulse —
  // normal restitution e, and Coulomb friction (coefficient mu) on the
  // contact point's slip, coupling linear velocity to the spin ω (solid
  // sphere, I = 2/5·m·r²). A rolling ball pivots up and over an edge
  // instead of stopping dead; a landed ball goes from sliding to rolling.
  // rc is the contact's lever arm (the collision radius used). Returns the
  // approach speed along n (≥ 0).
  function contact(b, nx, ny, nz, pen, e, mu, rc) {
    b.x += nx * pen; b.y += ny * pen; b.z += nz * pen;
    if (ny > b.T.supportNy && ny > b._supBest) {
      b._supBest = ny; b.sup = 1; b.supNx = nx; b.supNy = ny; b.supNz = nz;
    }
    var vn = b.vx * nx + b.vy * ny + b.vz * nz;
    if (vn >= 0) return 0;
    var r = rc || b.D.r;
    var ee = -vn < b.T.vRest ? 0 : e;
    var Jn = -(1 + ee) * vn;
    var cx = b.wy * nz - b.wz * ny, cy = b.wz * nx - b.wx * nz, cz = b.wx * ny - b.wy * nx; // ω × n
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
    return -vn;
  }
  // make ω pure rolling on a surface with normal n for the current v
  function rollOn(b, nx, ny, nz) {
    var r = b.D.r;
    b.wx = (ny * b.vz - nz * b.vy) / r; b.wy = (nz * b.vx - nx * b.vz) / r; b.wz = (nx * b.vy - ny * b.vx) / r;
  }
  // bed-local normal → world
  function bedN(D, nu, nv, nh) {
    return [nu, nv * D.sB + nh * D.cB, nv * D.cB - nh * D.sB];
  }

  /* A contact with anything on the bed side. The first one is the LANDING
   * and is reported once, flagged landing: true — as 'backstop' on a direct
   * hit, otherwise as 'bed' {speed, surface: 'plane'|'floor'|'rim'|'hole'|
   * 'lip', ring|hole}. Every LATER rim or 100-lip impact above evRim is a
   * 'rim' event and makes `rattled` true. Contacts within evCooldown of an
   * event of the same kind are the same impact, not a new sound. */
  function bedHit(b, kind, s, idx) {
    var T = b.T;
    // what the ball is rolling on (sets its rolling resistance): a cup
    // floor is cork 'cup'; the plane and friends are 'bed'. A rim alone
    // is not something to roll on — a ball perched on a blade tips off.
    if (b.sup) {
      if (kind === 'floor') b.supKind = 'cup';
      else if (kind !== 'rim' && b.supKind !== 'cup') b.supKind = 'bed';
    }
    var sp = +s.toFixed(3);
    if (!b.touchedBed) {
      b.touchedBed = true;
      var q = toBedD(b.D, b.x, b.y, b.z);
      b.land = { u: q.u, v: q.v, t: b.t, kind: kind, band: bandAtD(b.D, q.u, q.v) };
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

  // A hoop in bed space around (cu, cv) at radius R: a capsule section
  // running from below the cup floor up to top(ang) − rho, met by a ball of
  // collision radius rc. Returns {s: approach speed, nh} or null.
  function hoopContact(b, q, cu, cv, R, top, rho, rc, hLow, e, mu) {
    var D = b.D;
    var du = q.u - cu, dv = q.v - cv, d = Math.hypot(du, dv);
    var reach = rc + rho;
    if (Math.abs(d - R) > reach || d < 1e-9) return null;
    var hTopC = top - rho;
    var hc = q.h < hLow ? hLow : (q.h > hTopC ? hTopC : q.h);
    var dr = d - R, dh = q.h - hc, dist = Math.hypot(dr, dh);
    if (dist >= reach || dist < 1e-9) return null;
    var nr = dr / dist, nh = dh / dist;
    var n = bedN(D, nr * du / d, nr * dv / d, nh);
    var s = contact(b, n[0], n[1], n[2], reach - dist, e, mu, rc);
    return { s: s, nh: nh, dr: dr, du: du / d, dv: dv / d };
  }

  // leave the hop exactly at the crest, on the crest tangent. yContact is
  // the surface height the speed was measured at (energy for the last climb).
  function crestExit(b, sp, yContact) {
    var T = b.T, D = b.D, r = D.r, thC = D.thetaCrest, cs = Math.cos(thC), sn = Math.sin(thC);
    var dy = Math.max(0, T.hCrest - yContact);
    var spC = Math.sqrt(Math.max(0, sp * sp - 2 * T.g * T.rollK * dy));
    var zC = T.L - r * sn, yC = T.hCrest + r * cs;
    // Put the ball on THE ballistic arc through the crest point with the
    // crest velocity, at the time offset τ its along-path position implies
    // (τ < 0: still a sliver short of the crest). Every throw of the same
    // speed then flies the identical parabola whatever the substep phase —
    // no angle jitter, no landing folds — and the ball never jumps forward.
    var over = (b.z - zC) * cs + (b.y - yC) * sn;
    var tau = spC > 1e-6 ? over / spC : 0;
    b.vz = spC * cs; b.vy = spC * sn - T.g * tau;
    b.z = zC + spC * cs * tau; b.y = yC + spC * sn * tau - 0.5 * T.g * tau * tau;
    rollOn(b, 0, cs, -sn);
    b.sup = 0; b.supKind = 'air';
    if (!b.launched) {
      b.launched = true; b.tLaunch = b.t; b.phase = 'flight';
      emit(b, { type: 'launch', v: +spC.toFixed(3) });
    }
  }

  // side rails (lane/hop) and side walls (pit/bed); over the pit the walls
  // splay from the lane's half-width to the bed's, so a ball that comes back
  // toward the lane meets a slanted wall, not a sudden step. A rail bounce
  // scrubs along-rail speed: bank shots cost distance. Run before and after
  // the bed contacts, so a rim can never shove the ball through a wall.
  function sideWalls(b, dt) {
    var T = b.T, r = b.D.r, s;
    var hw, sl = 0;
    if (b.z < T.L) hw = T.laneHalfW;
    else if (b.z < T.bedZ0) { sl = (T.bedHalfW - T.laneHalfW) / (T.bedZ0 - T.L); hw = T.laneHalfW + sl * (b.z - T.L); }
    else hw = T.bedHalfW;
    hw -= r;
    var wn = 1 / Math.sqrt(1 + sl * sl), ew = b.launched ? T.eWall : T.eRail;
    var side = b.x > hw ? 1 : b.x < -hw ? -1 : 0;
    if (side) {
      var vtB = Math.hypot(b.vy, b.vz);
      s = contact(b, -side * wn, 0, sl * wn, (side * b.x - hw) * wn, ew, T.muRail);
      if (s > 0 && vtB > 1e-6) {
        var scrub = Math.min(1, T.railScrub * (1 + ew) * s / vtB);
        b.vy *= 1 - scrub; b.vz *= 1 - scrub;
      }
      if (s > T.evWall) emitCd(b, 'wall', { type: 'wall', speed: +s.toFixed(3) });
      if (s > 0) b.english *= T.spinRailKeep;
    }
  }

  function substep(b, dt) {
    var T = b.T, D = b.D, r = D.r, g = T.g;
    b.n++;
    var sp = Math.hypot(b.vx, b.vy, b.vz);
    if (!b.launched && b.phase !== 'return' && b.vz > b.vPeak) b.vPeak = b.vz;
    var e0 = energy(b);

    /* forces (other than gravity these are the only energy sources) */
    var ax = 0, ay = -g, az = 0;
    if (b.sup) {
      // rolling resistance along the tangential velocity, the lane's lean,
      // the bed's texture. (Gravity's 5/7 share for a rolling ball comes out
      // of the friction impulses in contact(), not from a rule here.)
      var nx = b.supNx, ny = b.supNy, nz = b.supNz;
      var vnS = b.vx * nx + b.vy * ny + b.vz * nz;
      var vtx = b.vx - vnS * nx, vty = b.vy - vnS * ny, vtz = b.vz - vnS * nz;
      var vt = Math.hypot(vtx, vty, vtz);
      var crr = b.supKind === 'cup' ? T.crrCup : b.supKind === 'bed' ? T.crrBed : T.crrLane;
      if (vt > 1e-6) {
        var fr = crr * g * ny;
        var cap = vt / dt; if (fr > cap) fr = cap;
        ax -= fr * vtx / vt; ay -= fr * vty / vt; az -= fr * vtz / vt;
      }
      if (b.supKind === 'lane' || b.supKind === 'hop') az -= T.laneLean;
      if (b.supKind === 'lane' || b.supKind === 'hop') ax += T.laneSideA;
      if (b.supKind === 'hop' && b.vz > 0 && !b.launched && T.hopBackA && vt > 1e-6) { var hb = Math.min(T.hopBackA, vt / dt); ax -= hb * vtx / vt; ay -= hb * vty / vt; az -= hb * vtz / vt; }
      if (b.supKind === 'bed') ax += T.bedNudge * (hash01(b.seed, b.n) - 0.5) * 2;
    }
    // english: only while the ball is on its way (not on a dead roll home)
    if (b.english && b.phase !== 'return') {
      if (!b.launched && b.sup) {
        var grow = Math.min(T.spinGrow, Math.max(1, T.spinVRef / Math.max(sp, T.spinVFloor)));
        ax += T.spinA * b.english * grow;
      } else if (!b.touchedBed) ax += T.spinAir * b.english;
      else if (b.sup) ax += T.spinBed * b.english;
    }
    // a stalled ball is walked home at a trickle: pushed up to vRet while it
    // rolls, and braked back to vRet if the hop or the lean ever make it faster
    if (b.phase === 'return') {
      var vRet = Math.min(b.vThrow, Math.max(T.returnMinV, Math.min(T.returnMaxV, T.returnFrac * b.vPeak)));
      if (b.sup && b.z < T.L && b.vz > -vRet) az -= T.returnAccel;
    }
    // a ball balanced on a rim top is tipped off toward the side it leans
    if (b.tipOn) {
      var tn3 = bedN(D, b.tipU, b.tipV, 0);
      ax += tn3[0] * T.lipNudge; ay += tn3[1] * T.lipNudge; az += tn3[2] * T.lipNudge;
      b.tipOn = false;
    }
    if (b.perchSide) {
      var pn = bedN(D, b.perchU, b.perchV, 0);
      ax += pn[0] * T.perchNudge * b.perchSide; ay += pn[1] * T.perchNudge * b.perchSide; az += pn[2] * T.perchNudge * b.perchSide;
      b.perchSide = 0;
    }
    // work the non-gravity forces do this substep (at the midpoint velocity,
    // so a motor can start a ball from rest)
    var ayM = ay + g;
    var motorWork = Math.max(0, (ax * (b.vx + 0.5 * ax * dt) + ayM * (b.vy + 0.5 * ayM * dt) + az * (b.vz + 0.5 * az * dt)) * dt);

    b.vx += ax * dt; b.vy += ay * dt; b.vz += az * dt;
    var px = b.x, py = b.y, pz = b.z;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.lab && b.launched && !b.landF && b.z > T.bedZ0 - r) {
      var q0 = toBedD(D, px, py, pz), q1 = toBedD(D, b.x, b.y, b.z);
      if (q1.h <= D.landH && q1.v > -r) {
        var f = q0.h > q1.h ? Math.max(0, Math.min(1, (q0.h - D.landH) / (q0.h - q1.h))) : 1;
        b.landF = { u: q0.u + (q1.u - q0.u) * f, v: q0.v + (q1.v - q0.v) * f, t: b.t + f * dt };
      }
    }

    /* contacts */
    b.sup = 0; b._supBest = 0; b.supKind = 'air'; b.rimTouch = false;
    var s;

    // lane + hop surface, crest edge, pit front wall
    if (b.z < T.L + r && b.y < T.hCrest + 2 * r) {
      if (b.z < T.zHop) {
        if (b.y < r) { contact(b, 0, 1, 0, r - b.y, 0, T.muImpact); if (b.sup) b.supKind = 'lane'; }
      } else {
        var zc = b.z;
        for (var it = 0; it < 4; it++) zc = b.z + r * Math.sin(Math.atan(hopSlope(D, Math.min(zc, T.L))));
        if (zc <= T.L && !(b.launched && b.vz > 0)) {
          var th2 = Math.atan(hopSlope(D, zc));
          var c = Math.cos(th2), sn = Math.sin(th2);
          var dist = (b.y - surfY(D, zc)) * c - (b.z - zc) * sn;
          if (dist < r) {
            contact(b, 0, c, -sn, r - dist, 0, T.muImpact); if (b.sup) b.supKind = zc > T.zHop ? 'hop' : 'lane';
            var vAlong = b.vz * c + b.vy * sn;
            if (!b.launched && b.phase !== 'return' && vAlong > 0 && zc + vAlong * c * dt >= T.L)
              crestExit(b, vAlong, surfY(D, zc));
          }
        } else if (zc > T.L && b.y >= T.hCrest) {
          var ey = b.y - T.hCrest, ez = b.z - T.L, ed = Math.hypot(ey, ez);
          if (!b.launched && b.phase !== 'return' && b.vz > 0 && ez < r) {
            // passed the crest inside one substep without the hop branch seeing it
            crestExit(b, Math.hypot(b.vy, b.vz), b.y - r * Math.cos(Math.atan2(b.vy, b.vz)));
          } else if (ed < r && ed > 1e-9) { contact(b, 0, ey / ed, ez / ed, r - ed, 0, T.muImpact); if (b.sup) b.supKind = 'hop'; }
        } else if (b.y < T.hCrest && b.z < T.L + r && b.z > T.L - r) {
          contact(b, 0, 0, 1, T.L + r - b.z, T.ePit, T.muImpact);
        }
      }
    }
    sideWalls(b, dt);

    // pit back wall (the bed's front face)
    if (b.z > T.L && b.y < T.bedY0 && b.z > T.bedZ0 - r) contact(b, 0, 0, -1, b.z - (T.bedZ0 - r), T.ePit, T.muImpact);

    // bed side
    var q = toBedD(D, b.x, b.y, b.z);
    if (b.z > T.L && q.v > -2 * r) {
      // lip edge (corner line at v = 0, h = 0)
      if (q.v < 0 && b.y >= T.bedY0) {
        var ld = Math.hypot(q.v, q.h);
        if (ld < r && ld > 1e-9) {
          var nl = bedN(D, 0, q.v / ld, q.h / ld);
          s = contact(b, nl[0], nl[1], nl[2], r - ld, T.eLip, T.muImpact);
          bedHit(b, 'lip', s, null);
          q = toBedD(D, b.x, b.y, b.z);
        }
      }
      var dC = Math.hypot(q.u, q.v - T.ringCV);
      var inStack = dC < T.rims[0];
      if (q.v >= 0) {
        var nb = bedN(D, 0, 0, 1);
        if (!inStack) {
          // the plane: open everywhere except over the stack and the holes
          if (q.h < r && q.h > -r && holeAtD(D, q.u, q.v, D.lipRing) < 0) {
            s = contact(b, nb[0], nb[1], nb[2], r - q.h, T.eBed, T.muImpact);
            bedHit(b, 'plane', s, null);
            q = toBedD(D, b.x, b.y, b.z);
          }
        } else if (q.h < r - T.cupDepth) {
          // a cup floor
          s = contact(b, nb[0], nb[1], nb[2], r - T.cupDepth - q.h, T.eFloor, T.muImpact);
          bedHit(b, 'floor', s, null);
          q = toBedD(D, b.x, b.y, b.z);
        }
      }
      // rims: thin blades from below the cup floors up to their tops
      if (q.h < T.rimH + D.rimReach && dC < T.rims[0] + D.rimReach) {
        var ang = Math.atan2(q.v - T.ringCV, q.u);
        for (var k = 0; k < T.rims.length; k++) {
          var e = T.eRim * (1 + T.rimRough * (hash01(b.seed ^ SALT_RIM, b.n * T.rims.length + k) - 0.5) * 2);
          var hc = hoopContact(b, q, 0, T.ringCV, T.rims[k], rimTop(D, k, ang), T.rimBlade, T.rimBallR, -T.cupDepth - r, e, T.muImpactRim);
          if (hc) {
            b.rimTouch = true;
            bedHit(b, 'rim', hc.s, k);
            // perched on the blade's top edge and slow: tip it off
            if (hc.nh > 0.8 && Math.hypot(b.vx, b.vy, b.vz) < T.perchV) {
              var lean = hc.dr !== 0 ? (hc.dr > 0 ? 1 : -1) : (hash01(b.seed ^ SALT_PERCH, b.n) < 0.5 ? -1 : 1);
              b.perchSide = lean; b.perchU = hc.du; b.perchV = hc.dv;
            }
            q = toBedD(D, b.x, b.y, b.z);
          }
        }
      }
      // 100-hole lips and wells (full ball radius: the 0.14 hole fits the ball)
      if (q.h < T.lipH + r + 0.05) {
        for (var hI = 0; hI < 2; hI++) {
          var hl = hoopContact(b, q, (hI ? 1 : -1) * T.holeU, T.holeV, D.lipRing, T.lipH, D.lipRho, r, -1, T.eRim, T.muImpactRim);
          if (hl) {
            bedHit(b, 'hole', hl.s, hI);
            // a slow ball propped on the lip must tip, never rest: into the
            // hole if its centre is over the lip (within lipRing + lipTipIn·r),
            // otherwise away, down the bed; if away is blocked (the corner
            // pocket between lip, wall and backstop) for lipTipT, into the hole
            if (Math.hypot(b.vx, b.vy, b.vz) < T.perchV) {
              b.lipT += dt;
              var dh = D.lipRing + hl.dr, inward = dh < D.lipRing + T.lipTipIn * r || b.lipT > T.lipTipT;
              if (inward) { b.tipU = -hl.du; b.tipV = -hl.dv; }
              else {
                // away: outward and downhill; an exact tie (straight down) leans by the seeded roughness
                var tu = hl.du, tv = hl.dv - 1, tn = Math.hypot(tu, tv);
                if (tn < 1e-6) { tu = hash01(b.seed ^ SALT_PERCH, b.n) < 0.5 ? -1 : 1; tv = 0; tn = 1; }
                b.tipU = tu / tn; b.tipV = tv / tn;
              }
              b.tipOn = true;
            }
            q = toBedD(D, b.x, b.y, b.z);
          }
        }
      }
      // safety cage roof
      if (q.v > 0 && q.h > T.cageH - r) {
        var nc = bedN(D, 0, 0, -1);
        s = contact(b, nc[0], nc[1], nc[2], q.h - (T.cageH - r), T.eCage, T.muImpact);
        b.cageTouch = true;
        if (s > T.evWall) emitCd(b, 'cage', { type: 'cage', speed: +s.toFixed(3) });
        q = toBedD(D, b.x, b.y, b.z);
      }
      // backstop
      if (q.v > T.bedTopV - r) {
        var nbk = bedN(D, 0, -1, 0);
        s = contact(b, nbk[0], nbk[1], nbk[2], q.v - (T.bedTopV - r), T.eBackstop, T.muBackstop);
        bedHit(b, 'backstop', s, null);
        q = toBedD(D, b.x, b.y, b.z);
      }
    }

    sideWalls(b, dt);

    // No contact may add energy: the push-outs raise the ball a little each
    // time it rides a convex edge. Anything above the energy the ball came
    // in with (plus the motors' work this substep) comes off its speed.
    var e1 = energy(b), allow = e0 + motorWork;
    if (e1 > allow + 1e-12) {
      var ke = e1 - T.g * b.y, keNew = ke - (e1 - allow);
      var kf = ke > 1e-12 ? Math.sqrt(Math.max(0, keNew) / ke) : 0;
      b.vx *= kf; b.vy *= kf; b.vz *= kf; b.wx *= kf; b.wy *= kf; b.wz *= kf;
    }

    if (b.phase === 'return') {
      var vCap = Math.min(b.vThrow, Math.max(T.returnMinV, Math.min(T.returnMaxV, T.returnFrac * b.vPeak)));
      if (b.vz < -vCap) { var kr = vCap / -b.vz; b.vz *= kr; b.vx *= kr; }
    }

    b.t += dt;

    /* phase bookkeeping */
    if (!b.launched) {
      if (b.phase === 'return') {
        if (b.z < T.returnDoneZ && b.vz <= 0) {
          b.vx = b.vy = b.vz = 0;
          emit(b, { type: 'return' });
          return finish(b, { kind: 'return', score: 0, cup: null, band: null, hole: null });
        }
      } else if (b.vz <= 0) {
        b.phase = 'return';
        emit(b, { type: 'stall', z: +b.z.toFixed(3) });
      } else b.phase = b.z >= T.zHop ? 'hop' : 'roll';
    }
    // launched too softly to leave the crest: it rolled back over the edge
    if (b.launched && !b.touchedBed && b.z < T.L - r && b.vz < 0 && b.y < T.hCrest + 2 * r) {
      b.launched = false; b.phase = 'return';
      emit(b, { type: 'stall', z: +b.z.toFixed(3) });
    }
    // bounced all the way back out over the pit onto the hop/lane
    if (b.touchedBed && b.phase === 'bed' && b.z < T.L - r && b.y < T.hCrest + 2 * r) {
      b.phase = 'return'; b.launched = false;
      emit(b, { type: 'bounceback', z: +b.z.toFixed(3) });
    }

    // gutter: touched the pit floor, or dropped far enough into the pit
    // mouth (below the lip by gutterDrop, falling, clear of the lane) that
    // nothing can bring it back
    var pitFloorHit = b.y - r <= T.pitFloorY;
    if (pitFloorHit || (b.z > T.L + r && b.z < T.bedZ0 && b.vy < 0 && b.y < T.bedY0 - T.gutterDrop)) {
      if (pitFloorHit) b.y = T.pitFloorY + r;
      clampToWalls(b);
      b.vx = b.vy = b.vz = 0;
      b.phase = 'gutter'; b.endT = b.t;
      emit(b, { type: 'gutter' });
      b.result = { kind: 'gutter', score: 0, cup: null, band: null, hole: null, t: +b.t.toFixed(4) };
      return;
    }

    if (b.touchedBed && b.phase !== 'return') {
      q = toBedD(D, b.x, b.y, b.z);
      var spd = Math.hypot(b.vx, b.vy, b.vz);
      var band = bandAtD(D, q.u, q.v);
      // the dented 40: was the ball down in the 40 in the dent octant (or
      // elsewhere), and did it climb out over the dent into the 30?
      var angB = Math.atan2(q.v - T.ringCV, q.u);
      if (band === T.dentRim && q.h < T.rimH) { if (inDent(D, angB)) b.in40Dent = true; else b.in40Other = true; }
      if (b.band === T.dentRim && band === T.dentRim - 1 && inDent(D, angB)) b.dentEscape = true;
      b.band = band;
      // down a 100 hole: sunk into the well, or a direct hit — the centre
      // over the mouth while the ball comes down through lip height
      var hole = holeAtD(D, q.u, q.v, T.holeR);
      if (hole >= 0) {
        var vh = b.vy * D.cB - b.vz * D.sB;
        if (q.h < T.holeCapH) return capture(b, q, 100, null, hole);
        if (vh < 0 && q.h < r + T.lipH && holeAtD(D, q.u, q.v, T.holeDirectR) >= 0) return capture(b, q, 100, null, hole);
      }
      // settled in a cup, or sunk deep in one clear of the rims
      if (band >= 0 && q.h < T.capH) {
        if (q.h < T.capDeepH && !b.rimTouch) return capture(b, q, SCORES[band], band, null);
        if (spd < T.settleV) { b.settleT += dt; if (b.settleT >= T.settleT) return capture(b, q, SCORES[band], band, null); }
        else b.settleT = 0;
      } else b.settleT = 0;
      // at rest on the open bed (e.g. propped against the outer rim from above)
      if (band < 0 && spd < T.restV) {
        b.restT += dt;
        if (b.restT > T.restT) { emit(b, { type: 'rest', u: +q.u.toFixed(3), v: +q.v.toFixed(3) }); return forceResolve(b); }
      } else b.restT = 0;
    }
    // no throw may take longer than timeoutT from release, sink included
    if (b.t > T.timeoutT - T.sinkT || b.t > T.preLaunchT) { emit(b, { type: 'timeout' }); return forceResolve(b); }
  }

  // the ball's final resting x never sits outside the walls (a hair of push-out can)
  function clampToWalls(b) {
    var T = b.T, lim = (b.z < T.L ? T.laneHalfW : b.z < T.bedZ0 ? T.laneHalfW + (T.bedHalfW - T.laneHalfW) * (b.z - T.L) / (T.bedZ0 - T.L) : T.bedHalfW) - b.D.r;
    if (b.x > lim) b.x = lim; else if (b.x < -lim) b.x = -lim;
  }

  function forceResolve(b) {
    clampToWalls(b);
    var T = b.T, D = b.D, q = toBedD(D, b.x, b.y, b.z);
    if (!b.launched) {
      emit(b, { type: 'return' });
      return finish(b, { kind: 'return', score: 0, cup: null, band: null, hole: null });
    }
    // only a ball whose centre is over a hole's mouth is in it; one propped
    // on the lip from outside (the corner pocket above each hole) is not
    var hole = holeAtD(D, q.u, q.v, T.holeR);
    if (hole >= 0 && q.v >= 0) return capture(b, q, 100, null, hole);
    var d = Math.hypot(q.u, q.v - T.ringCV);
    if (q.v >= 0 && d <= T.rims[0] + D.r + D.rimReach + T.restReach) {
      var band = bandAtD(D, q.u, q.v); if (band < 0) band = 0;
      return capture(b, q, SCORES[band], band, null);
    }
    // stuck on the open bed (e.g. on a 100 hole's lip): the machine takes it back, no score
    b.phase = 'gutter'; b.endT = b.t; b.vx = b.vy = b.vz = 0;
    emit(b, { type: 'gutter' });
    b.result = { kind: 'stuck', score: 0, cup: null, band: null, hole: null, t: +b.t.toFixed(4) };
  }

  function capture(b, q, score, band, hole) {
    clampToWalls(b); q = toBedD(b.D, b.x, b.y, b.z);
    var T = b.T, D = b.D, tu, tv;
    if (hole !== null) { tu = (hole ? 1 : -1) * T.holeU; tv = T.holeV; }
    else {
      var du = q.u, dv = q.v - T.ringCV, d = Math.hypot(du, dv);
      var mid = band < T.rims.length - 1 ? (T.rims[band] + T.rims[band + 1]) / 2 : 0;
      if (d < 1e-6) { du = 0; dv = 1; d = 1; }
      tu = du / d * mid; tv = T.ringCV + dv / d * mid;
    }
    // the sink keeps the ball's momentum at the moment of capture (clamped),
    // so it doesn't stop dead: Hermite from (position, velocity) to the cup
    var vu = b.vx, vv = b.vy * D.sB + b.vz * D.cB, vh = b.vy * D.cB - b.vz * D.sB;
    var vm = Math.hypot(vu, vv, vh), vk = vm > T.sinkVMax ? T.sinkVMax / vm : 1;
    b.cap = { u0: q.u, v0: q.v, h0: q.h, u1: tu, v1: tv, h1: -D.r * T.sinkDepth - (hole !== null ? 0 : T.cupDepth), t0: b.t,
              mu: vu * vk * T.sinkT, mv: vv * vk * T.sinkT, mh: Math.min(0, vh * vk) * T.sinkT };
    b.vx = b.vy = b.vz = 0; b.wx = b.wy = b.wz = 0;
    b.phase = 'captured';
    b.result = { kind: hole !== null ? 'hole' : 'ring', score: score, cup: score, band: band, hole: hole, t: +b.t.toFixed(4) };
    var ev = { type: 'captured', score: score, cup: score, band: band, hole: hole, rattled: b.rimHits > 0, rims: b.rimHits };
    if (score === 30 && b.dentEscape) ev.dent = true; // climbed out of the 40 over the dent
    emit(b, ev);
  }

  function finish(b, res) {
    b.phase = 'done';
    res.t = +b.t.toFixed(4);
    b.result = res;
    emit(b, { type: 'done', score: res.score });
  }

  // Advance by dt (any value): exact 1/240 s substeps via an accumulator,
  // so the outcome never depends on the caller's frame rate.
  function step(b, dt) {
    if (!b || b.phase === 'done') return b;
    var T = b.T, h = T.substep;
    b.acc += dt / h;
    var n = Math.floor(b.acc + 1e-9);
    b.acc -= n;
    if (b.acc < 0) b.acc = 0;
    for (var i = 0; i < n && b.phase !== 'done'; i++) {
      if (b.phase === 'captured') {
        b.t += h;
        if (b.t - b.cap.t0 >= T.sinkT - 1e-9) finish(b, b.result);
      } else if (b.phase === 'gutter') {
        b.t += h;
        if (b.t - b.endT >= T.gutterT - 1e-9) finish(b, b.result);
      } else substep(b, h);
    }
    var p = pose(b);
    b.trail.push({ t: +b.t.toFixed(4), x: p.x, y: p.y, z: p.z, phase: p.phase });
    if (b.trail.length > T.trailCap) b.trail.shift();
    return b;
  }

  function pose(b) {
    var T = b.T, D = b.D, r = D.r;
    var x = b.x, y = b.y, z = b.z, sinking = 0, cup = null, hole = null;
    var ph = b.phase;
    if (b.cap) {
      var s = Math.min(1, (b.t - b.cap.t0) / T.sinkT);
      sinking = s;
      // cubic Hermite: starts at the capture point with the capture velocity,
      // ends in the cup below the bed, at rest
      var c = b.cap, s2 = s * s, s3 = s2 * s;
      var h01 = 3 * s2 - 2 * s3, h10 = s3 - 2 * s2 + s;
      var P = fromBedD(D, c.u0 + (c.u1 - c.u0) * h01 + c.mu * h10,
                          c.v0 + (c.v1 - c.v0) * h01 + c.mv * h10,
                          c.h0 + (c.h1 - c.h0) * h01 + c.mh * h10);
      x = P.x; y = P.y; z = P.z;
      cup = b.result.score; hole = b.result.hole;
    } else if (b.result && (b.result.kind === 'gutter' || b.result.kind === 'stuck')) {
      sinking = Math.min(1, (b.t - b.endT) / T.gutterT);
    }
    var q = toBedD(D, x, y, z);
    var onBed = !b.cap && b.touchedBed && ph !== 'gutter' && ph !== 'done' && ph !== 'return' && (b.supKind === 'bed' || b.supKind === 'cup');
    return { x: x, y: y, z: z, r: r, phase: ph, sinking: sinking, cup: cup, hole: hole, onBed: onBed,
             u: q.u, v: q.v, h: q.h, vx: b.vx, vy: b.vy, vz: b.vz, t: b.t };
  }

  function simulate(args, opts) {
    args = args || {}; opts = opts || {};
    var maxT = opts.maxT || 12, dt = 1 / 120;
    var b = createThrow(args.x0 || 0, args.v || 0, args.aim || 0, args.spin || 0, args.seed || 0, opts.tune || null);
    b.lab = opts.lab !== false;
    var trail = [];
    var keepTrail = opts.trail !== false;
    if (keepTrail) trail.push({ t: 0, x: b.x, y: b.y, z: b.z, phase: b.phase });
    while (b.phase !== 'done' && b.t < maxT) {
      step(b, dt);
      if (keepTrail) { var p = pose(b); trail.push({ t: +b.t.toFixed(4), x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4), phase: p.phase, sinking: +p.sinking.toFixed(3) }); }
    }
    var result = b.result || { kind: 'unresolved', score: 0, cup: null, band: null, hole: null, t: b.t };
    return { events: b.events, trail: trail, result: result, land: b.land, landF: b.landF, tLaunch: b.tLaunch, ball: b };
  }

  var SkeeBallPhysics = {
    TUNE: TUNE, GEO: GEO, SCORES: SCORES,
    createThrow: createThrow, step: step, pose: pose, simulate: simulate,
    hash01: hash01, surfaceAt: surfaceAt, configure: configure, softAim: function (a) { return softAim(TUNE, a); },
    toBed: toBed, fromBed: fromBed, bandAt: bandAt,
    rimTop: function (k, ang) { return rimTop(DEF, k, ang); }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SkeeBallPhysics;
  if (typeof window !== 'undefined') window.SkeeBallPhysics = SkeeBallPhysics;
})();
