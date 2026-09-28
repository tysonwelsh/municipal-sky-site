/* MOTHER LODE — marble physics (PLAN §4)
 *
 * Pure: no DOM, no Math.random, no Date. Loads in the browser
 * (window.PachinkoPhysics) and in Node (module.exports) for the lab.
 * Board space (pachinko-board.js): px, y down, 320 × 416.
 *
 * A WORLD holds the board, the sim clock and every marble on the glass, so
 * streams of marbles click against each other:
 *   w = createWorld(board, seed[, tune])
 *   m = addMarble(w, x[, seed])        // released from the hopper at (x, drop.y)
 *   stepWorld(w, dt)                   // any dt; runs exact 1/240 s substeps
 *   w.events                           // drained by the caller
 * The single-marble API of PLAN §4 wraps it: createDrop(board, x, seed),
 * step(state, board, t, dt), simulate(board, x, seed, {maxT}).
 *
 * Integration: semi-implicit Euler, 240 Hz. Gravity down-screen, a small
 * linear drag (the glass front), a speed cap (so nothing tunnels: at the cap
 * a step is 2.3 px against a pin+marble reach of 5.5 px).
 *
 * CONTACTS: the marble (r 4) against pins (circles), rails (capsules),
 * moving paddles and cart walls (segments with a surface velocity), and the
 * other marbles. Each contact pushes the marble out and applies restitution
 * and Coulomb friction BY MATERIAL, with seeded ±3 % roughness per contact
 * and a tiny seeded tangential jitter (so a marble balanced on a pin top
 * always tips, and tips the same way for the same seed). A fast contact is
 * an EVENT (the clatter); a marble rolling along a rail emits `roll` ticks.
 *
 * KINEMATIC PARTS are pure functions of the sim time (board.pose): a paddle
 * moving into the marble bats it. A marble that settles in the ore cart's
 * bucket is CARRIED (rigidly, phase 'cart') until the cart tips at the dump
 * end, then released with the cart's velocity and a little toss.
 *
 * TUNNELS: a marble whose centre enters an open mouth A is hidden (phase
 * 'tunnel') for `delay` s and comes out of mouth B. POCKETS catch a marble
 * that drops between their lips. SLOTS resolve a marble whose centre passes
 * board.SLOT_Y.
 *
 * ANTI-STALL: a marble slower than stallV for stallT s gets a seeded KNOCK
 * (the tommyknockers). Unresolved at TIMEOUT s, it is dropped straight into
 * the slot under it (`timeout`).
 *
 * Events {type, m (marble id), t, …}:
 *   drop {x} · pin {id, material, dress, speed, x, y} · rail {id, material,
 *   dress, speed} · roll {id, speed} · wheel {id, speed} · clack {other, speed}
 *   · cart {id, what:'catch'|'dump'} · tunnel {id, what:'in'|'out'} ·
 *   pocket {id, value, legend} · slot {id, value, legend, x} · knock {n} ·
 *   award {id, value} (the cart pays on a catch; the marble rides on) ·
 *   teeter {id} (landed square on the bone over the 13) · ride {id} (carried
 *   over a wheel) ·
 *   timeout {x} · done {outcome}
 */
(function (root) {
  'use strict';

  var B = root.PachinkoBoard || (typeof require !== 'undefined' ? require('./pachinko-board.js') : null);

  var TUNE = {
    R: 4,               // marble radius (px)
    g: 1000,            // gravity along the board (px/s²)
    drag: 0.35,         // linear damping (1/s): the glass front
    vMax: 560,          // speed cap (px/s)
    dt: 1 / 240,
    // restitution / tangential friction by material (glass marble on …)
    mat: {
      steel:  { e: 0.45, mu: 0.06 },
      brass:  { e: 0.55, mu: 0.07 },
      timber: { e: 0.34, mu: 0.12 },
      track:  { e: 0.22, mu: 0.04 },   // the haulage track: steel rail on sleepers, dead
      plank:  { e: 0.16, mu: 0.06 },   // gallery floors: planking over dirt
      rock:   { e: 0.26, mu: 0.16 },
      ore:    { e: 0.30, mu: 0.14 },
      bone:   { e: 0.42, mu: 0.09 },
      spoke:  { e: 0.12, mu: 0.35 },   // the sheave's spokes: grippy, they carry a marble round
      glass:  { e: 0.88, mu: 0.03 }
    },
    rough: 0.03,        // ±3 % restitution per contact
    jitter: 3,          // seeded tangential nudge on a contact (px/s)
    perchKick: 2.5,     // per-step tangential push off a pin top (px/s)
    teeterKick: 0.5,    // …and off the teetering bone over the 13 (slower: it hesitates)
    restV: 10,          // normal speeds under this don't bounce (they roll)
    rollDecel: 6,       // rolling resistance while in contact (px/s²)
    eventV: 16,         // a contact faster than this is a tick (event)
    rollTickDist: 9,    // a rolling marble ticks once per this many px on a rail
    stallV: 8, stallT: 0.6, knockV: 110,
    timeout: 12,
    cartCatchV: 60,     // relative speed under which a marble in the bucket is caught
    cartTipRelease: 0.55, // tilt (rad) at which the bucket lets go
    cartMaxAge: 5.0     // a marble older than this isn't picked up (it still tips out with the load)
  };

  var CELL = 16;

  function hash01(seed, i) { return B.hash01(seed, i); }

  /* ── the static spatial hash ─────────────────────────────────────── */
  function buildGrid(board) {
    var cols = Math.ceil((board.W + 64) / CELL), rows = Math.ceil((board.H + 128) / CELL);
    var cells = new Array(cols * rows);
    function put(i0, j0, i1, j1, f) {
      for (var j = Math.max(0, j0); j <= Math.min(rows - 1, j1); j++)
        for (var i = Math.max(0, i0); i <= Math.min(cols - 1, i1); i++) {
          var k = j * cols + i; (cells[k] || (cells[k] = [])).push(f);
        }
    }
    function ci(x) { return Math.floor((x + 32) / CELL); }
    function cj(y) { return Math.floor((y + 64) / CELL); }
    board.fixtures.forEach(function (f) {
      if (f.buried) return;             // under a cave-in's heap
      if (f.kind === 'pin' || f.kind === 'rubble') put(ci(f.x - f.r), cj(f.y - f.r), ci(f.x + f.r), cj(f.y + f.r), f);
      else if (f.kind === 'rail') {
        var x0 = Math.min(f.x1, f.x2) - f.r, x1 = Math.max(f.x1, f.x2) + f.r, y0 = Math.min(f.y1, f.y2) - f.r, y1 = Math.max(f.y1, f.y2) + f.r;
        put(ci(x0), cj(y0), ci(x1), cj(y1), f);
      } else if (f.kind === 'wheel') {
        // the hub is a static circle
        put(ci(f.x - f.hub), cj(f.y - f.hub), ci(f.x + f.hub), cj(f.y + f.hub), { id: f.id + '.hub', kind: 'pin', x: f.x, y: f.y, r: f.hub, material: f.material, dress: 'hub', region: f.region, hubOf: f.id });
      }
    });
    return {
      query: function (x, y, reach, out) {
        out.length = 0;
        var i0 = ci(x - reach), i1 = ci(x + reach), j0 = cj(y - reach), j1 = cj(y + reach), seen = 0;
        for (var j = Math.max(0, j0); j <= Math.min(rows - 1, j1); j++)
          for (var i = Math.max(0, i0); i <= Math.min(cols - 1, i1); i++) {
            var c = cells[j * cols + i]; if (!c) continue;
            for (var k = 0; k < c.length; k++) if (out.indexOf(c[k]) < 0) out.push(c[k]);
          }
        return out;
      }
    };
  }

  // one grid per layout: a board is never changed once made (every edit
  // returns a new one), so the validator's 300 drops share one hash instead
  // of building it 300 times (wave 5c: the WORK-start stutter)
  var GRIDS = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function gridOf(board) {
    if (!GRIDS) return buildGrid(board);
    var g = GRIDS.get(board);
    if (!g) { g = buildGrid(board); GRIDS.set(board, g); }
    return g;
  }

  /* ── world ───────────────────────────────────────────────────────── */
  function createWorld(board, seed, tune) {
    var T = {}; for (var k in TUNE) T[k] = TUNE[k];
    if (tune) for (var k2 in tune) T[k2] = tune[k2];
    return {
      board: board, seed: seed | 0, T: T, t: 0, acc: 0, nextId: 1,
      marbles: [], events: [], grid: gridOf(board), contactN: 0,
      cartLoad: {}
    };
  }

  function addMarble(w, x, seed) {
    var b = w.board, T = w.T;
    x = Math.max(b.drop.x0, Math.min(b.drop.x1, x));
    var s = seed == null ? (w.seed * 31 + w.nextId * 977) | 0 : seed | 0;
    var m = {
      id: w.nextId++, seed: s, x: x, y: b.drop.y, vx: (hash01(s, 1) - 0.5) * 2, vy: 60,
      r: T.R, spin: 0, w: 0, phase: 'drop', t0: w.t, age: 0,
      slowT: 0, knocks: 0, n: 0, hits: 0, touched: {}, lastHit: null, lastHitT: -1, rollAcc: 0,
      tunnel: null, cart: null, outcome: null, done: false, x0: x
    };
    w.marbles.push(m);
    w.events.push({ type: 'drop', m: m.id, t: w.t, x: x });
    return m;
  }

  function emit(w, m, ev) { ev.m = m.id; ev.t = w.t; w.events.push(ev); }

  function stepWorld(w, dt) {
    w.acc += dt;
    var h = w.T.dt;
    while (w.acc >= h - 1e-9) {
      w.acc -= h;
      substep(w, h);
    }
  }

  function substep(w, h) {
    var T = w.T, b = w.board, ms = w.marbles;
    w.t += h;
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (m.done) continue;
      m.age += h;
      if (m.phase === 'tunnel') { tickTunnel(w, m); continue; }
      if (m.phase === 'cart') { tickCart(w, m, h); continue; }
      if (m.phase === 'pocket') continue;
      // gravity + drag
      m.vy += T.g * h;
      var dmp = 1 - T.drag * h; m.vx *= dmp; m.vy *= dmp;
      var sp = Math.hypot(m.vx, m.vy);
      if (sp > T.vMax) { m.vx *= T.vMax / sp; m.vy *= T.vMax / sp; }
      var x0 = m.x, y0 = m.y;
      m.x += m.vx * h; m.y += m.vy * h;
      m.spin += m.w * h; m.w *= (1 - 0.6 * h);
      if (m.phase === 'drop' && m.y > b.drop.y + 6) m.phase = 'board';
      m.inContact = false;
      collideStatic(w, m, h);
      collideKinematic(w, m, h);
      checkCatchers(w, m);
      if (m.done) continue;
      // stall watch
      // (by how far it actually moved: a marble wedged between two pins can
      // keep a jittering velocity that the contacts cancel every step)
      if (m.phase !== 'cart' && Math.hypot(m.x - x0, m.y - y0) / h < T.stallV) {
        m.slowT += h;
        if (m.slowT > T.stallT) knock(w, m);
      } else m.slowT = 0;
      if (m.age > T.timeout) {
        emit(w, m, { type: 'timeout', x: m.x });
        resolveSlot(w, m, m.x);
      }
    }
    // marble on marble
    for (var a = 0; a < ms.length; a++) {
      var A = ms[a]; if (A.done || A.phase === 'tunnel' || A.phase === 'pocket') continue;
      for (var c = a + 1; c < ms.length; c++) {
        var C = ms[c]; if (C.done || C.phase === 'tunnel' || C.phase === 'pocket') continue;
        collideMarbles(w, A, C);
      }
    }
    // retire resolved marbles (keep the array short for streams)
    if (ms.length > 24) w.marbles = ms.filter(function (m) { return !m.done; });
  }

  function knock(w, m) {
    var T = w.T;
    m.knocks++; m.slowT = 0;
    var dir = hash01(m.seed, 900 + m.knocks) < 0.5 ? -1 : 1;
    m.vx += dir * T.knockV * (0.6 + 0.4 * hash01(m.seed, 950 + m.knocks));
    m.vy -= T.knockV;
    emit(w, m, { type: 'knock', n: m.knocks, x: m.x, y: m.y });
  }

  /* resolve one contact with normal n (unit, pointing at the marble), depth
   * pen, the surface velocity (sx, sy) and a material; returns impact speed */
  function contact(w, m, nx, ny, pen, sx, sy, matName, f) {
    var T = w.T, M = T.mat[matName] || T.mat.steel;
    m.x += nx * pen; m.y += ny * pen;
    var rvx = m.vx - sx, rvy = m.vy - sy;
    var vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 0;
    w.contactN++;
    m.inContact = true;
    var tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
    var e = M.e * (1 + T.rough * (2 * hash01(m.seed, 3000 + m.n) - 1));
    var imp = -vn;
    var vnNew = imp > T.restV ? e * imp : 0;
    // the bone over the 13 has a worn, cupped top: a marble landing square on it dies there
    if (f && f.teeter && ny < -0.55) {
      vnNew = 0; vt *= 0.2;
      if (m.perch !== f.id) { m.perch = f.id; emit(w, m, { type: 'teeter', id: f.id, x: m.x, y: m.y }); }
    }
    // Coulomb friction on the tangential part, plus rolling resistance
    var dvt = Math.min(Math.abs(vt), M.mu * (imp + vnNew));
    vt -= Math.sign(vt) * dvt;
    // seeded jitter so a marble can't balance on a pin top forever
    var jit = (hash01(m.seed, 5000 + m.n) * 2 - 1) * T.jitter * (imp > T.restV ? 1 : 0.35);
    // perched on the top of a pin or a cap (normal nearly straight up, barely
    // moving): it can't stay there. Tip it off, the same way for the same seed.
    if (ny < -0.96 && Math.abs(vt) < 12 && f && f.kind !== 'rail') {
      // …except the bone over the 13, where it TEETERS: a held breath before it picks a side
      jit += (hash01(m.seed, 7000 + m.knocks) < 0.5 ? -1 : 1) * (f.teeter ? T.teeterKick : T.perchKick);
    }
    m.n++;
    vt += jit;
    m.vx = sx + nx * vnNew + tx * vt;
    m.vy = sy + ny * vnNew + ty * vt;
    // spin follows the rolling speed along the surface
    m.w += (vt / m.r - m.w) * 0.5;
    return imp;
  }

  function hitEvent(w, m, f, imp, kind) {
    if (imp < w.T.eventV) return;
    if (m.lastHit === f.id && w.t - m.lastHitT < 0.07) { m.lastHitT = w.t; return; }
    m.lastHit = f.id; m.lastHitT = w.t;
    m.hits++;
    if (kind === 'pin') m.touched.pins = (m.touched.pins | 0) + 1;
    emit(w, m, { type: kind, id: f.hubOf || f.id, material: f.material, dress: f.dress, speed: imp, x: m.x, y: m.y });
  }

  var near = [];
  function collideStatic(w, m, h) {
    var T = w.T, list = w.grid.query(m.x, m.y, m.r + 3, near);
    for (var k = 0; k < list.length; k++) {
      var f = list[k];
      if (f.kind === 'pin' || f.kind === 'rubble') {
        var dx = m.x - f.x, dy = m.y - f.y, d2 = dx * dx + dy * dy, rr = m.r + f.r;
        if (d2 >= rr * rr) continue;
        var d = Math.sqrt(d2) || 1e-6;
        var imp = contact(w, m, dx / d, dy / d, rr - d, 0, 0, f.material, f);
        if (imp) hitEvent(w, m, f, imp, 'pin');
      } else if (f.kind === 'rail') {
        var q = closest(m.x, m.y, f.x1, f.y1, f.x2, f.y2);
        var ex = m.x - q.x, ey = m.y - q.y, e2 = ex * ex + ey * ey, rr2 = m.r + f.r;
        if (e2 >= rr2 * rr2) continue;
        var dd = Math.sqrt(e2) || 1e-6;
        var imp2 = contact(w, m, ex / dd, ey / dd, rr2 - dd, 0, 0, f.material, f);
        if (imp2) hitEvent(w, m, f, imp2, 'rail');
        else if (m.inContact) rolling(w, m, f, h);
      }
    }
  }

  // a marble rolling along a rail: resistance, and a soft tick every few px
  function rolling(w, m, f, h) {
    var T = w.T, sp = Math.hypot(m.vx, m.vy);
    if (sp > 0) { var k = Math.max(0, sp - T.rollDecel * h) / sp; m.vx *= k; m.vy *= k; }
    m.rollAcc += sp * h;
    if (m.rollAcc > T.rollTickDist) { m.rollAcc = 0; if (sp > 12) emit(w, m, { type: 'roll', id: f.id, material: f.material, speed: sp }); }
  }

  function closest(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
    var u = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    return { x: x1 + dx * u, y: y1 + dy * u, u: u };
  }

  /* moving segments: wheels' paddles and the cart's bucket */
  function collideKinematic(w, m, h) {
    var b = w.board, t = w.t;
    var wheels = b.byKind.wheel;
    for (var i = 0; i < wheels.length; i++) {
      var wh = wheels[i];
      var dx = m.x - wh.x, dy = m.y - wh.y;
      if (dx * dx + dy * dy > (wh.r + m.r + 2) * (wh.r + m.r + 2)) continue;
      var segs = B.wheelSegments(wh, t), om = B.wheelOmega(wh, t);
      // riding the wheel: count how far round the hub the marble has been carried
      if (wh.mode === 'spin') {
        var ang = Math.atan2(dy, dx);
        if (m.ride && m.ride.id === wh.id) {
          var da = ang - m.ride.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
          m.ride.sum += da; m.ride.a = ang; m.ride.t = w.t;
          if (!m.ride.looped && Math.abs(m.ride.sum) > Math.PI) { m.ride.looped = true; emit(w, m, { type: 'ride', id: wh.id, x: m.x, y: m.y }); }
        } else m.ride = { id: wh.id, a: ang, sum: 0, t: w.t, looped: false };
      }
      for (var s = 0; s < segs.length; s++) {
        var a = segs[s][0], c = segs[s][1];
        var q = closest(m.x, m.y, a[0], a[1], c[0], c[1]);
        var ex = m.x - q.x, ey = m.y - q.y, e2 = ex * ex + ey * ey, rr = m.r + 1.2;
        if (e2 >= rr * rr) continue;
        var d = Math.sqrt(e2) || 1e-6;
        // surface velocity of the paddle at q: ω × (q − hub)
        var sx = -om * (q.y - wh.y), sy = om * (q.x - wh.x);
        var imp = contact(w, m, ex / d, ey / d, rr - d, sx, sy, wh.material, wh);
        if (imp > w.T.eventV) {
          if (!(m.lastHit === wh.id && w.t - m.lastHitT < 0.12)) { emit(w, m, { type: 'wheel', id: wh.id, material: wh.material, dress: wh.dress, speed: imp, x: m.x, y: m.y }); m.touched.moving = 1; }
          m.lastHit = wh.id; m.lastHitT = w.t;
        } else if (imp) m.touched.moving = 1;
      }
    }
    var carts = b.byKind.cart;
    for (var j = 0; j < carts.length; j++) {
      var ct = carts[j];
      var cs = B.cartSegments(ct, t);
      var p = cs.pose;
      if (Math.abs(m.x - p.x) > ct.w + 8 || Math.abs(m.y - (p.y - ct.h / 2)) > ct.h + 10) continue;
      var cv = B.cartVel(ct, t);
      var pivX = p.x + (ct.dump === 'left' ? -ct.w / 2 : ct.w / 2), pivY = p.y - 3;
      // the marble in the bucket's frame (un-tipped about the dump corner): the
      // bucket only collides from above and inside. A marble rolling along the
      // track passes in front of the cart (it rides the glass), so the cart
      // never shoves marbles back up the track.
      var ca0 = Math.cos(-p.tilt), sa0 = Math.sin(-p.tilt), rx = m.x - pivX, ry = m.y - pivY;
      var lx = rx * ca0 - ry * sa0 + (pivX - p.x), ly = rx * sa0 + ry * ca0;
      var above = ly < -ct.h + 1, inX0 = Math.abs(lx) < ct.w / 2;
      // in the bucket only if it came in over the rim (a marble rolling along
      // the track passes in front of the cart: it rides the glass)
      if (above && inX0) m.bucket = ct.id;
      else if (!inX0 || ly > 2) { if (m.bucket === ct.id) m.bucket = null; }
      var inside = m.bucket === ct.id && inX0 && ly < 0;
      if (!above && !inside) continue;
      // tipping with a loose marble in the bucket: it goes out with the load
      if (inside && Math.abs(p.tilt) > w.T.cartTipRelease && m.phase !== 'cart') { tipOut(w, m, ct, pivX, pivY); continue; }
      for (var k = 0; k < cs.segs.length; k++) {
        if (k === 1 && !(inside || (above && Math.abs(lx) < ct.w / 2))) continue;
        var A = cs.segs[k][0], C = cs.segs[k][1];
        var q2 = closest(m.x, m.y, A[0], A[1], C[0], C[1]);
        var fx = m.x - q2.x, fy = m.y - q2.y, f2 = fx * fx + fy * fy, r2 = m.r + 1;
        if (f2 >= r2 * r2) continue;
        var dd = Math.sqrt(f2) || 1e-6;
        var svx = cv.vx - cv.vtilt * (q2.y - pivY), svy = cv.vtilt * (q2.x - pivX);
        var imp2 = contact(w, m, fx / dd, fy / dd, r2 - dd, svx, svy, ct.material, ct);
        if (imp2 > w.T.eventV) hitEvent(w, m, ct, imp2, 'rail');
        if (imp2) m.touched.moving = 1;
      }
      // caught? inside the bucket, low, slow relative to the cart, and not tipping
      var inX = m.bucket === ct.id && Math.abs(m.x - p.x) < ct.w / 2 - 1, inY = m.y > p.y - 3 - ct.h && m.y < p.y - 3;
      if (inX && inY && Math.abs(p.tilt) < 0.1 && Math.hypot(m.vx - cv.vx, m.vy) < w.T.cartCatchV && m.phase !== 'cart' && !(m.cartOff > w.t) && m.age < w.T.cartMaxAge && B.cartLoading(ct, t)) {
        var load = w.cartLoad[ct.id] | 0;
        if (load < 3) {
          w.cartLoad[ct.id] = load + 1;
          m.phase = 'cart';
          m.cart = { id: ct.id, lx: Math.max(-ct.w / 2 + m.r + 1, Math.min(ct.w / 2 - m.r - 1, m.x - p.x)) + (load ? (load % 2 ? -3 : 3) : 0), ly: -m.r - 1 - (load ? 2 : 0) };
          m.touched.moving = 1; m.touched.cart = 1;
          emit(w, m, { type: 'cart', id: ct.id, what: 'catch', x: m.x, y: m.y });
          // a full load pays a little on the spot (the marble rides on)
          if (ct.award) { m.award = (m.award | 0) + ct.award; emit(w, m, { type: 'award', id: ct.id, value: ct.award, x: m.x, y: m.y }); }
        }
      }
    }
  }

  function tickCart(w, m, h) {
    var ct = w.board.byId[m.cart.id], cs = B.cartSegments(ct, w.t), p = cs.pose;
    var pivX = p.x + (ct.dump === 'left' ? -ct.w / 2 : ct.w / 2), pivY = p.y - 3;
    // the marble's seat in the bucket, rotated with the tilt about the dump corner
    var lx = m.cart.lx - (pivX - p.x), ly = m.cart.ly;
    var ca = Math.cos(p.tilt), sa = Math.sin(p.tilt);
    var nx = pivX + lx * ca - ly * sa, ny = pivY + lx * sa + ly * ca;
    var cv = B.cartVel(ct, w.t);
    m.vx = (nx - m.x) / h; m.vy = (ny - m.y) / h;
    m.x = nx; m.y = ny;
    m.spin += cv.vx / m.r * h;
    if (Math.abs(p.tilt) > w.T.cartTipRelease) {
      w.cartLoad[ct.id] = Math.max(0, (w.cartLoad[ct.id] | 0) - 1);
      tipOut(w, m, ct, pivX, pivY);
    }
  }
  // tipped out over the lip, clear of the bucket, into the chute below
  function tipOut(w, m, ct, pivX, pivY) {
    var dir = ct.dump === 'left' ? -1 : 1;
    m.phase = 'board';
    m.x = pivX + dir * (m.r + 1.5 + 2 * hash01(m.seed, 78)); m.y = pivY - m.r - 1;
    m.vx = dir * (30 + 20 * hash01(m.seed, 77)); m.vy = 20;
    m.slowT = 0;
    m.cart = null; m.bucket = null; m.cartOff = w.t + 1.5;
    emit(w, m, { type: 'cart', id: ct.id, what: 'dump', x: m.x, y: m.y });
  }

  function tickTunnel(w, m) {
    var tn = w.board.byId[m.tunnel.id];
    if (w.t >= m.tunnel.tOut) {
      m.phase = 'board';
      m.x = tn.b.x; m.y = tn.b.y;
      var j = hash01(m.seed, 400 + m.n);
      m.vx = tn.b.spread != null ? tn.b.vx + (2 * j - 1) * tn.b.spread : tn.b.vx * (0.8 + 0.4 * j); m.vy = tn.b.vy;
      m.slowT = 0;
      m.tunnel = null;
      emit(w, m, { type: 'tunnel', id: tn.id, what: 'out', x: m.x, y: m.y });
    }
  }

  function checkCatchers(w, m) {
    var b = w.board;
    // tunnel mouths
    var tn = b.byKind.tunnel;
    for (var i = 0; i < tn.length; i++) {
      var T = tn[i];
      if (!T.open) continue;
      var dx = m.x - T.a.x, dy = m.y - T.a.y;
      if (dx * dx + dy * dy < T.a.r * T.a.r) {
        m.phase = 'tunnel';
        m.tunnel = { id: T.id, tIn: w.t, tOut: w.t + T.delay, from: { x: T.a.x, y: T.a.y }, to: { x: T.b.x, y: T.b.y } };
        m.touched.tunnel = 1;
        emit(w, m, { type: 'tunnel', id: T.id, what: 'in', x: m.x, y: m.y });
        return;
      }
    }
    // pockets
    var pk = b.byKind.pocket;
    for (var j = 0; j < pk.length; j++) {
      var P = pk[j];
      if (Math.abs(m.x - P.x) < P.w / 2 - 2 && m.y > P.y && m.y < P.y + 8 && m.vy > -5) {
        m.phase = 'pocket';
        m.x = P.x; m.y = P.y + 3; m.vx = 0; m.vy = 0;
        finishMarble(w, m, { kind: 'pocket', id: P.id, value: P.value, legend: P.legend });
        emit(w, m, { type: 'pocket', id: P.id, value: P.value, legend: P.legend, x: m.x, y: m.y });
        emit(w, m, { type: 'done', outcome: m.outcome });
        return;
      }
    }
    if (m.y > b.SLOT_Y) resolveSlot(w, m, m.x);
    else if (m.y > b.H + 20 || m.x < -20 || m.x > b.W + 20 || !isFinite(m.x + m.y)) resolveSlot(w, m, isFinite(m.x) ? m.x : b.W / 2);
  }

  function resolveSlot(w, m, x) {
    if (m.done) return;
    var s = B.slotAt(w.board, x);
    m.phase = 'slot';
    finishMarble(w, m, { kind: 'slot', id: s.id, value: s.value, legend: s.legend, label: s.label });
    emit(w, m, { type: 'slot', id: s.id, value: s.value, legend: s.legend, x: x });
    emit(w, m, { type: 'done', outcome: m.outcome });
  }

  function finishMarble(w, m, outcome) {
    m.outcome = outcome; m.done = true; m.tDone = w.t;
    if (m.phase !== 'pocket') m.phase = 'done';
  }

  function collideMarbles(w, A, C) {
    var dx = C.x - A.x, dy = C.y - A.y, rr = A.r + C.r, d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    var d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d, pen = rr - d;
    var aFix = A.phase === 'cart', cFix = C.phase === 'cart';
    if (aFix && cFix) return;
    if (aFix) { C.x += nx * pen; C.y += ny * pen; }
    else if (cFix) { A.x -= nx * pen; A.y -= ny * pen; }
    else { A.x -= nx * pen / 2; A.y -= ny * pen / 2; C.x += nx * pen / 2; C.y += ny * pen / 2; }
    var rv = (C.vx - A.vx) * nx + (C.vy - A.vy) * ny;
    if (rv >= 0) return;
    var e = w.T.mat.glass.e, j = -(1 + e) * rv;
    if (aFix) { C.vx += nx * j; C.vy += ny * j; }
    else if (cFix) { A.vx -= nx * j; A.vy -= ny * j; }
    else { j /= 2; A.vx -= nx * j; A.vy -= ny * j; C.vx += nx * j; C.vy += ny * j; }
    if (-rv > w.T.eventV) {
      emit(w, A, { type: 'clack', other: C.id, speed: -rv, x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 });
      A.touched.clack = C.touched.clack = 1;
    }
  }

  /* ── the single-marble API (PLAN §4) ─────────────────────────────── */
  function createDrop(board, x, seed, tune) {
    var w = createWorld(board, seed, tune);
    var m = addMarble(w, x, seed);
    return { world: w, marble: m, get x() { return m.x; }, get y() { return m.y; }, get phase() { return m.phase; }, events: w.events };
  }
  function step(state, board, t, dt) { stepWorld(state.world, dt); return state; }

  // run one marble to its end; returns {outcome, t, timeout, contacts, touchedMoving, events?, path?}
  function simulate(board, x, seed, opts) {
    opts = opts || {};
    var w = createWorld(board, seed, opts.tune);
    if (opts.t0) w.t = opts.t0;          // the kinematic parts' phase at the drop
    var m = addMarble(w, x, seed);
    var maxT = opts.maxT || 14, path = opts.path ? [] : null, ev = opts.events ? [] : null;
    var pins = 0, rails = 0, wheels = 0, rolls = 0, knocks = 0, h = w.T.dt, n = 0;
    while (!m.done && m.age < maxT) {
      substep(w, h);
      for (var i = 0; i < w.events.length; i++) {
        var e = w.events[i];
        if (e.type === 'pin') pins++; else if (e.type === 'rail') rails++; else if (e.type === 'wheel') wheels++;
        else if (e.type === 'roll') rolls++; else if (e.type === 'knock') knocks++;
        if (ev) ev.push(e);
      }
      w.events.length = 0;
      if (path && (n++ % 6) === 0) path.push([m.x, m.y, m.phase]);
    }
    if (!m.done) { resolveSlot(w, m, m.x); }
    return {
      outcome: m.outcome, award: m.award | 0, value: (m.outcome ? m.outcome.value : 0) + (m.award | 0), t: m.tDone - (opts.t0 || 0), timeout: m.age > w.T.timeout, knocks: knocks,
      pins: pins, rails: rails, wheels: wheels, rolls: rolls, contacts: pins + rails + wheels,
      moving: !!(m.touched.moving || m.touched.tunnel), tunnel: !!m.touched.tunnel, cart: !!m.touched.cart,
      path: path, events: ev, nan: !isFinite(m.x + m.y)
    };
  }

  function configure(partial) { for (var k in partial) TUNE[k] = partial[k]; }

  // a new layout under a live world (a cave-in mid-game): the marbles stay
  // where they are, the static hash is rebuilt so the new rubble collides
  function setBoard(w, board) { w.board = board; w.grid = gridOf(board); return w; }

  var api = {
    TUNE: TUNE, configure: configure, setBoard: setBoard,
    createWorld: createWorld, addMarble: addMarble, stepWorld: stepWorld,
    createDrop: createDrop, step: step, simulate: simulate
  };
  root.PachinkoPhysics = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
