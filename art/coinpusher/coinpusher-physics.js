/* SCRIP CREEK — the pile
 *
 * A tiny bespoke sim: coins are discs in top-down machine space (x lateral,
 * z depth, z=0 at the tray lip, increasing toward the back wall), resolved
 * with position-based dynamics — stable at pile density, ~a hundred lines,
 * no engine.
 *
 * The mechanism is the real one, because it's what makes drop timing a
 * skill: ONE moving shelf does both jobs. Coins on the shelf top ride it by
 * friction; the fixed back wall blocks them on the retreat stroke, so they
 * get walked forward relative to the shelf and eventually tip off its front
 * edge onto the tray below. Meanwhile the shelf's front face bulldozes the
 * tray pile toward the lip on every forward stroke. A token dropped while
 * the shelf is retracted falls PAST the shelf edge straight onto the tray,
 * right in the face's path — prime real estate. Dropped while the shelf is
 * forward, it lands on the shelf top and joins the slow ratchet. Where and
 * WHEN, that's the whole game.
 *
 * Fixed-timestep (120 Hz accumulator in main), seeded RNG, fully
 * deterministic for a given seed + input sequence.
 */
window.CoinPusherPhysics = (function () {
  'use strict';

  var TUNE = {
    FW: 150,             // field width in machine units (a coin has r 5)
    COIN_R: 5,
    WALL_Z: 86,          // the fixed back wall
    FACE_MIN: 50,        // shelf front face travel...
    FACE_MAX: 68,        // ...retracted
    STROKE_HZ: 0.42,     // the machine's breath
    DROP_Z: 60,          // where the chute lets go (inside the face's travel)
    LIP_OVER: 1.8,       // how far past the lip a coin's center teeters before falling
    RELAX_ITERS: 5,
    DT_MS: 1000 / 120,
    MAX_COINS: 130,
    TROUGH_X0: 44,       // payout lanes, machine x: center is yours,
    TROUGH_X1: 106,      // the gutters are the house's
    FALL_MS: 300,        // lip-fall animation time
    CHUTE_MS: 260,       // chute-drop animation time
    TIP_MS: 140          // shelf-edge tip animation time
  };

  function makeSim(seed) {
    var R = window.Arcade.rng(seed);
    var coins = [];        // {id,x,z,tier,kind,r,m,fall:null|{state,T,lane}}
    var prizes = [];       // same shape + type
    var events = [];       // drained by main: {type:'payout'|'gutter'|'prize'|'prize-lost'|'tip'|'land', ...}
    var t = 0, faceZ = faceAt(0), nextId = 1;

    function faceAt(tt) {
      var mid = (TUNE.FACE_MIN + TUNE.FACE_MAX) / 2;
      var amp = (TUNE.FACE_MAX - TUNE.FACE_MIN) / 2;
      return mid + amp * Math.cos(2 * Math.PI * TUNE.STROKE_HZ * tt);
    }

    function addCoin(x, z, tier, kind, fall) {
      var c = { id: nextId++, x: x, z: z, tier: tier, kind: kind || 0,
                r: TUNE.COIN_R, m: 1, fall: fall || null };
      coins.push(c);
      return c;
    }
    function addPrize(type, x, z, r, m) {
      var p = { id: nextId++, x: x, z: z, tier: 0, type: type,
                r: r, m: m, fall: null };
      prizes.push(p);
      return p;
    }

    /* seed the pile: tray pile + shelf pile, then pre-settle */
    function seedPile() {
      var i, x, z;
      for (i = 0; i < 58; i++) {  // tray, packed like the machine's been fed for years
        x = 8 + R() * (TUNE.FW - 16);
        z = 4 + R() * (TUNE.FACE_MIN - 8);
        addCoin(x, z, 0, R() < 0.2 ? 1 : R() < 0.03 ? 2 : 0);
      }
      for (i = 0; i < 38; i++) {  // shelf
        x = 8 + R() * (TUNE.FW - 16);
        z = TUNE.FACE_MAX + 2 + R() * (TUNE.WALL_Z - TUNE.FACE_MAX - 6);
        addCoin(x, z, 1, R() < 0.2 ? 1 : 0);
      }
      // exactly one more buffalo-head somewhere it hurts to look at
      addCoin(30 + R() * 90, 30 + R() * 14, 0, 2);
      // the cargo
      addPrize('jar', 28, 26, 8, 4);
      addPrize('fortune', 76, 14, 6, 1.5);
      addPrize('arrowhead', 118, 34, 6, 2);
      addPrize('eye', 108, 18, 4, 1.5);
      // settle: relax so nothing starts inside anything, then pre-run a few
      // seconds of the full sim — the machine boots mid-breath, at pile
      // pressure, and the settle spillover doesn't count as anyone's payout
      for (i = 0; i < 60; i++) relax();
      clampAll();
      for (i = 0; i < 480; i++) step();
      events.length = 0;
    }

    /* ── PBD core ──────────────────────────────────────────────────── */
    function bodies() { return coins.concat(prizes); }

    function relax() {
      var all = bodies();
      for (var it = 0; it < 1; it++) {
        for (var i = 0; i < all.length; i++) {
          var a = all[i];
          if (a.fall) continue;
          for (var j = i + 1; j < all.length; j++) {
            var b = all[j];
            if (b.fall || a.tier !== b.tier) continue;
            var dx = b.x - a.x, dz = b.z - a.z;
            var rr = a.r + b.r;
            var d2 = dx * dx + dz * dz;
            if (d2 >= rr * rr || d2 === 0) continue;
            var d = Math.sqrt(d2), push = (rr - d) / d;
            var wa = (1 / a.m) / (1 / a.m + 1 / b.m);
            var wb = 1 - wa;
            a.x -= dx * push * wa; a.z -= dz * push * wa;
            b.x += dx * push * wb; b.z += dz * push * wb;
          }
        }
      }
    }

    function clampAll() {
      var all = bodies();
      for (var i = 0; i < all.length; i++) {
        var c = all[i];
        if (c.fall) continue;
        if (c.x < c.r) c.x = c.r;
        if (c.x > TUNE.FW - c.r) c.x = TUNE.FW - c.r;
        if (c.tier === 1) {
          if (c.z > TUNE.WALL_Z - c.r) c.z = TUNE.WALL_Z - c.r; // the wall
        } else {
          if (c.z > faceZ - c.r * 0.6) c.z = faceZ - c.r * 0.6; // the face
        }
      }
    }

    /* ── per-step ──────────────────────────────────────────────────── */
    function step() {
      t += TUNE.DT_MS / 1000;
      var prev = faceZ;
      faceZ = faceAt(t);
      var d = faceZ - prev;
      var i, c;

      // animations advance; finished ones resolve
      var all = bodies();
      for (i = all.length - 1; i >= 0; i--) {
        c = all[i];
        if (!c.fall) continue;
        c.fall.T += TUNE.DT_MS / c.fall.ms;
        if (c.fall.T < 1) continue;
        if (c.fall.state === 'chute') {
          // touchdown: which tier did the stroke leave under it?
          c.fall = null;
          c.tier = (TUNE.DROP_Z >= faceZ + c.r * 0.5) ? 1 : 0;
          c.z = TUNE.DROP_Z;
          if (c.tier === 0 && c.z > faceZ - c.r * 0.6) c.z = faceZ - c.r * 0.6;
          events.push({ type: 'land', tier: c.tier, x: c.x });
        } else if (c.fall.state === 'tip') {
          c.fall = null; // now a tray coin, mid-pile
          events.push({ type: 'tipdown', x: c.x });
        } else if (c.fall.state === 'out') {
          // gone: over the lip and into the dark
          var isPrize = !!c.type;
          if (isPrize) {
            prizes.splice(prizes.indexOf(c), 1);
            events.push({ type: c.fall.lane === 'trough' ? 'prize' : 'prize-lost', prize: c.type });
          } else {
            coins.splice(coins.indexOf(c), 1);
            events.push({ type: c.fall.lane === 'trough' ? 'payout' : 'gutter', kind: c.kind });
          }
        }
      }

      // shelf coins ride the shelf; the wall doesn't care
      for (i = 0; i < coins.length; i++) {
        c = coins[i];
        if (c.tier !== 1 || c.fall) continue;
        c.z += d;
        if (c.z > TUNE.WALL_Z - c.r) c.z = TUNE.WALL_Z - c.r;
        // the edge passes out from under it: tip off onto the tray
        if (c.z < faceZ + c.r * 0.3) {
          c.tier = 0;
          c.fall = { state: 'tip', T: 0, ms: TUNE.TIP_MS };
          events.push({ type: 'tip', x: c.x });
        }
      }

      // the face bulldozes the tray pile on the forward stroke
      if (d < 0) {
        var allT = bodies();
        for (i = 0; i < allT.length; i++) {
          c = allT[i];
          if (c.tier !== 0 || c.fall) continue;
          if (c.z > faceZ - c.r * 0.6) c.z = faceZ - c.r * 0.6;
        }
      }

      for (i = 0; i < TUNE.RELAX_ITERS; i++) { relax(); clampAll(); }

      // the lip: teeter past it and you're somebody's
      var allF = bodies();
      for (i = 0; i < allF.length; i++) {
        c = allF[i];
        if (c.tier !== 0 || c.fall) continue;
        if (c.z < TUNE.LIP_OVER) {
          var lane = (c.x >= TUNE.TROUGH_X0 && c.x <= TUNE.TROUGH_X1) ? 'trough' : 'gutter';
          c.fall = { state: 'out', T: 0, ms: TUNE.FALL_MS, lane: lane };
        }
      }
    }

    /* ── input ─────────────────────────────────────────────────────── */
    // drop a token from the chute at machine x; returns false if the field is full
    function drop(x) {
      if (coins.length >= TUNE.MAX_COINS) return false;
      x = Math.max(TUNE.COIN_R + 2, Math.min(TUNE.FW - TUNE.COIN_R - 2, x));
      // tiny landing scatter — the chute is old
      var jx = x + (R() - 0.5) * 3;
      addCoin(jx, TUNE.DROP_Z, 0, R() < 0.1 ? 1 : 0,
        { state: 'chute', T: 0, ms: TUNE.CHUTE_MS });
      return true;
    }

    function drainEvents() { var e = events; events = []; return e; }

    seedPile();

    return {
      TUNE: TUNE,
      step: step,
      drop: drop,
      drainEvents: drainEvents,
      coins: coins,
      prizes: prizes,
      time: function () { return t; },
      faceZ: function () { return faceZ; }
    };
  }

  return { makeSim: makeSim, TUNE: TUNE };
})();
