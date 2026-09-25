/* HOLLER ROLLER — boot, input, loop, ball layer
 *
 * SkeeBall.mount(container) creates the canvas, picks the internal height
 * and the crisp integer scale, reads swipes, runs the fixed-timestep loop,
 * and draws the ball from the physics POSE CONTRACT:
 *
 *   pose = { x, y, z, r, phase, sinking, cup, onBed, u, v }
 *     x, y, z   ball centre, machine units (render.js documents the frame)
 *     phase     'roll'|'hop'|'flight'|'bed'|'captured'|'gutter'|'return'|'done'
 *     sinking   0..1 while captured; cup 10|20|30|40|50|100|null
 *
 * The machine's reactions are drawn by R.drawLive(ctx, t, view); this file
 * only fills `view`. Swipe input is still the V0.38 model (phase 3 rewrites
 * it) and drives the V0.38 physics through a small legacy-pose adapter
 * until the new physics lands; a contract-speaking physics is used as is.
 *
 * ?debug=1  top-down truth overlay (V0.38 physics only)
 * ?harness=1  no rAF loop: window.__skeeMount.harness owns the clock
 *             { stepTo(t), render(), setBall(pose|fn|trail), setView(partial), state, canvas }
 * ?mode=attract|payout  preview the attract / payout layers
 */
window.SkeeBall = (function () {
  'use strict';

  function mount(container, opts) {
    opts = opts || {};
    var R = window.SkeeBallRender;
    var P = window.SkeeBallPhysics;
    var U = R.UNITS;
    var search = typeof location !== 'undefined' ? location.search : '';
    var HARNESS = opts.harness || /[?&]harness=1/.test(search);
    // version stamp: VERSION file → data-version on the mount (index.php)
    var VERSION = (container.getAttribute('data-version') || 'dev').trim();
    var STAMP = VERSION.toUpperCase();

    var canvas = document.createElement('canvas');
    canvas.width = R.W;
    canvas.height = R.H;
    canvas.className = 'skeeball-canvas';
    canvas.setAttribute('aria-label', 'HOLLER ROLLER skee ball machine');
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    // Integer scaling in *device* pixels. The scale is the largest integer
    // at which the 216×384 machine fits; the internal height then grows (up
    // to 448) to fill the stage at that scale — the extra rows are room.
    function fit() {
      var dpr = window.devicePixelRatio || 1;
      var availW = container.clientWidth * dpr;
      var availH = container.clientHeight * dpr;
      var scale = Math.max(1, Math.floor(Math.min(availW / R.W, availH / R.H_MIN)));
      if (R.setHeight(availH / scale) || canvas.height !== R.H || !R.staticLayer) {
        canvas.height = R.H;
        R.buildStatic();
      }
      ctx.imageSmoothingEnabled = false;
      canvas.style.width = (R.W * scale / dpr) + 'px';
      canvas.style.height = (R.H * scale / dpr) + 'px';
      if (HARNESS) render();
    }

    // one-way geometry check: the drawn machine against the physics' GEO
    if (P && P.GEO) {
      var bad = R.checkGeometry(P.GEO);
      if (bad.length) console.warn('HOLLER ROLLER: physics GEO differs from the drawn machine:\n  ' + bad.join('\n  '));
    } else if (P && P.syncGeometry) {
      P.syncGeometry(R.GEO); // V0.38 physics binds its scoring to the drawing
    }

    var state = {
      score: 0,
      ball: null,          // active physics throw
      launchX: 0,          // lateral position when the ball left the crest
      seed: 1,
      toast: null,         // {x, y, text, t0, pink} floating score
      trail: [],           // recent airborne screen points {x, y, t}
      debug: /[?&]debug=1/.test(search)
    };
    // what the machine shows; drawLive reads it (see render.js for fields)
    var qm = /[?&]mode=(attract|payout)/.exec(search);
    var view = {
      mode: qm ? qm[1] : 'play', score: 0, highScore: 0, ballsLeft: 9,
      ticketsOut: 0, cranking: false, hundreds: 0, holeGlow: [0, 0]
    };
    var drumTo = 0, lastScore = 0;
    var fake = null;       // harness: a pose, a function t → pose, or a trail

    var listeners = opts.onEvent ? [opts.onEvent] : [];
    function emit(ev) {
      (window.__skeeEvents = window.__skeeEvents || []).push(ev);
      for (var i = 0; i < listeners.length; i++) listeners[i](ev);
    }

    /* ── throwing (V0.38 physics) ─────────────────────────────────── */
    function throwBall(x0, vz, vx, spin, z0) {
      if (state.ball && state.ball.phase !== 'done') return false;
      if (P.GEO) {
        // contract physics: createThrow(x0, v, aim, spin, seed) from the
        // throw line. Stopgap mapping of the V0.38 swipe until phase 3.
        state.ball = P.createThrow(x0, Math.hypot(vz, vx), Math.atan2(vx, Math.max(0.01, vz)),
          Math.max(-1, Math.min(1, (spin || 0) / 1.3)), state.seed++);
      } else {
        state.ball = P.createThrow(x0, vz, vx, state.seed++, spin || 0, z0 || 0);
      }
      state.trail = [];
      emit({ type: 'throw', x0: x0, vz: vz, vx: vx, spin: spin || 0, z0: z0 || 0 });
      return true;
    }

    // Map a machine-frame point to a lane position (lateral in [-1,1], zn in [0,1]).
    function laneAt(cx, cy) {
      var g = R.GEO;
      var row = Math.max(g.ramp.y0 + 2, Math.min(g.lane.y1, cy));
      var zn = R.laneZAt(row);
      var center = R.laneBall(0, zn).x;
      var hw = R.laneBall(1, zn).x - center;
      var lat = Math.max(-0.92, Math.min(0.92, (cx - center) / hw));
      return { lat: lat, zn: zn };
    }

    /* ── swipe input (V0.38 model, unchanged; phase 3 replaces it) ── */
    canvas.style.touchAction = 'none';
    var swipe = null;
    function canvasPos(ev) { // → machine frame (the room rows above it are TOP)
      var r = canvas.getBoundingClientRect();
      return {
        x: (ev.clientX - r.left) * R.W / r.width,
        y: (ev.clientY - r.top) * R.H / r.height - R.TOP
      };
    }
    canvas.addEventListener('pointerdown', function (ev) {
      if (state.ball && state.ball.phase !== 'done') return; // one ball at a time
      var p = canvasPos(ev);
      if (p.y < R.GEO.lane.y0 - 16) return;          // swipe zone: the lane
      swipe = { pts: [{ t: performance.now(), x: p.x, y: p.y }], roll: 0 };
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { }
      ev.preventDefault();
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!swipe) return;
      var q = { t: performance.now(), x: canvasPos(ev).x, y: canvasPos(ev).y };
      var prev = swipe.pts[swipe.pts.length - 1];
      swipe.roll += Math.hypot(q.x - prev.x, q.y - prev.y) * 0.11;
      swipe.pts.push(q);
      if (swipe.pts.length > 48) swipe.pts.shift();
      ev.preventDefault();
    });
    // power mapping tuning — a heavy waxed ball: a soft flick barely
    // moves it; full power wants a genuinely long AND fast thumb swipe.
    var SPEED_CEIL = 1400;   // px/s that saturates the speed term
    var LEN_CEIL = 100;      // px of upward reach that saturates the length term
    var LEN_SPEED_GATE = 400; // px/s of release speed to earn full length credit
    var W_SPEED = 0.45, W_LEN = 0.55;  // blend (length-dominant = "push it")
    var POWER_GAMMA = 1.20;  // easing: soft inputs stay soft, but a moderate
                             // swipe already reaches the rings/50
    var SIDE_DIV = 420;      // px/s of sideways drift per unit vx (angled shots);
                             // gentle enough that aim lands on the bed, not the rail
    var SPIN_ANG_K = 1.3;    // spin per radian of heading curl over the gesture

    function endSwipe(ev) {
      if (!swipe) return;
      var pts = swipe.pts;
      var lastPt = pts[pts.length - 1];
      swipe = null;
      var T = swipeTune();
      var now = performance.now();
      // judge the throw from the final ~130ms of the gesture
      var recent = pts.filter(function (q) { return now - q.t <= 130; });

      // Where the ball actually is when released → its lane start (z0) and
      // lateral position. The throw launches from here, not the throw line.
      var rel = laneAt(lastPt.x, lastPt.y);
      var z0 = rel.zn * T.L;
      var x0 = rel.lat;

      if (recent.length < 2) {
        // held still and lifted: if it was carried up the lane, let it roll
        // back down dead; a mere tap at the bottom does nothing.
        if (z0 > 0.4) throwBall(x0, 0, 0, 0, z0);
        return;
      }
      var a = recent[0], b = recent[recent.length - 1];
      var dt = Math.max(0.016, (b.t - a.t) / 1000);
      var upSpeed = (a.y - b.y) / dt;                // canvas px/s, up = throw
      if (upSpeed < 120) {                           // released without a flick
        if (z0 > 0.4) throwBall(x0, 0, 0, 0, z0);    // roll back down dead
        return;
      }

      // POWER: blend swipe speed with how far up the lane the whole gesture
      // reached, then ease so feather-touches stay feathery.
      var minY = pts[0].y;
      for (var i = 0; i < pts.length; i++) if (pts[i].y < minY) minY = pts[i].y;
      var reach = pts[0].y - minY;                   // total upward travel, px
      var speedN = Math.min(1, upSpeed / SPEED_CEIL);
      var lenN = Math.min(1, reach / LEN_CEIL);
      // Release speed must dominate the heavy-ball fantasy: a long but slow
      // deliberate push shouldn't buy full length credit. Gate the length
      // term by release speed so a slow drag tops out around the pit.
      lenN *= Math.min(1, upSpeed / LEN_SPEED_GATE);
      var raw = W_SPEED * speedN + W_LEN * lenN;
      var power = Math.pow(Math.min(1, Math.max(0, raw)), POWER_GAMMA);
      var vz = T.vzMin + (T.vzMax - T.vzMin) * power;

      // ANGLE: net sideways drift over the recent gesture → committed
      // diagonal (strong enough angles bank off the side rails).
      var sideSpeed = (b.x - a.x) / dt;
      var vx = Math.max(-T.vxMax, Math.min(T.vxMax, sideSpeed / SIDE_DIV));

      // ENGLISH: curl of the WHOLE gesture, not just the release. Compare
      // the thumb's heading over the first third of the path against the
      // last third: the signed angle between them is how much the stroke
      // rotated. A J-hook is a big curl; a straight diagonal is none.
      var n = pts.length, spin = 0;
      if (n >= 6) {
        var i3 = Math.max(2, Math.floor(n / 3));
        var ex = pts[i3].x - pts[0].x, ey = pts[i3].y - pts[0].y;
        var lx = pts[n - 1].x - pts[n - 1 - i3].x, ly = pts[n - 1].y - pts[n - 1 - i3].y;
        var eLen = Math.hypot(ex, ey), lLen = Math.hypot(lx, ly);
        if (eLen > 8 && lLen > 8) {
          // screen y is down: positive angle = clockwise curl = hook right
          var curl = Math.atan2(ex * ly - ey * lx, ex * lx + ey * ly);
          spin = Math.max(-T.spinMax, Math.min(T.spinMax, curl * SPIN_ANG_K));
        }
      }

      // Energy compensation: vz above is the intended speed as if from the
      // throw line. Releasing the ball part-way up the lane would otherwise
      // hand it a head start; subtract the roll energy it would have spent
      // reaching z0 so the OUTCOME depends only on the flick, not where you
      // let go. (A weak flick from high up thus rolls back, as it should.)
      var work = P.rollWork ? P.rollWork(z0) : 1.15 * z0;
      var vz0 = Math.sqrt(Math.max(0, vz * vz - 2 * work));
      // (contract physics always throws from the throw line: no compensation)
      throwBall(x0, P.GEO ? vz : vz0, vx, spin, z0);
    }
    // the V0.38 swipe's clamps, from whichever physics is loaded
    function swipeTune() {
      var T = P.TUNE;
      return { vzMin: T.vzMin != null ? T.vzMin : T.vMin, vzMax: T.vzMax != null ? T.vzMax : T.vMax,
        vxMax: T.vxMax != null ? T.vxMax : 1.6, spinMax: T.spinMax != null ? T.spinMax : 1.3, L: T.L };
    }
    canvas.addEventListener('pointerup', endSwipe);
    canvas.addEventListener('pointercancel', function () { swipe = null; });

    /* ── physics events → presentation ────────────────────────────── */
    function handleEvent(ev) {
      if (ev.type === 'land' && typeof ev.score === 'number') {
        state.score += ev.score;
        var pt = R.bedPoint(ev.u, ev.v, (P.TUNE && P.TUNE.R10) || 0.93);
        state.toast = {
          x: pt.x, y: pt.y - 8, t0: tNow,
          text: ev.score > 0 ? '' + ev.score : (ev.kind === 'pit' ? '' : '0'),
          pink: ev.score >= 50
        };
      }
      if (ev.type === 'captured' && typeof ev.score === 'number') {
        state.score += ev.score;
        var p = state.lastPose ? R.project(state.lastPose.x, state.lastPose.y, state.lastPose.z) : { sx: 108, sy: 150 };
        state.toast = { x: p.sx, y: p.sy - 8, t0: tNow, text: '' + ev.score, pink: ev.score >= 50 };
      }
      if (ev.type === 'launch' && state.ball) state.launchX = state.ball.x;
      emit(ev);
    }

    /* ── poses ────────────────────────────────────────────────────── */
    // Adapter from the V0.38 physics' screen-ish poses to the contract, so
    // the old swipe game keeps playing on the new ball layer. Old bed v is
    // measured from the outer ring's bottom; the contract's from the lip.
    function legacyPose(lp, st) {
      var r = U.BALL_R, cb = Math.cos(U.BETA), sb = Math.sin(U.BETA);
      function onBed(u, vOld) {
        var v = vOld + 0.27;
        return { x: u, z: U.Z_LIP + v * cb - r * sb, y: U.Y_LIP + v * sb + r * cb, u: u, v: v };
      }
      if (lp.space === 'lane') {
        return { x: lp.x, z: lp.z, y: R.surfY(lp.z) + r, r: r,
          phase: st.phase === 'rollback' ? 'return' : (lp.z > U.Z_HOP ? 'hop' : 'roll') };
      }
      if (lp.space === 'air') {
        var land = onBed(lp.u, lp.outcome === 'pit' ? -0.27 : lp.v), f = lp.fr;
        return { x: state.launchX + (land.x - state.launchX) * f,
          z: U.Z_CREST + (land.z - U.Z_CREST) * f,
          y: (U.HOP_H + r) + (land.y - U.HOP_H - r) * f + 1.4 * f * (1 - f),
          r: r, phase: 'flight' };
      }
      if (lp.space === 'rolldown') {
        if (lp.v + 0.27 > 0) { var b = onBed(lp.u, lp.v); b.r = r; b.phase = 'bed'; b.onBed = true; return b; }
        var d = -(lp.v + 0.27);                       // over the lip, dropping into the pit
        return { x: lp.u, z: U.Z_LIP - d * 0.5, y: U.Y_LIP + r - d * 2.5, r: r, phase: 'gutter' };
      }
      if (lp.space === 'bed') {
        var p = onBed(lp.u, lp.v);
        p.r = r; p.onBed = true;
        p.cup = R.cupAt(p.u, p.v);
        p.sinking = Math.max(0, Math.min(1, lp.sink || 0));
        p.phase = p.sinking > 0 && p.cup ? 'captured' : 'bed';
        return p;
      }
      return null;
    }
    function isContract(p) { return p && typeof p.phase === 'string' && typeof p.z === 'number' && typeof p.y === 'number'; }
    // a trail array [{t, …pose}] → pose at time t (linear between samples)
    function trailAt(tr, t) {
      if (!tr.length) return null;
      if (t <= tr[0].t) return tr[0];
      for (var i = 1; i < tr.length; i++) {
        if (tr[i].t >= t) {
          var a = tr[i - 1], b = tr[i], k = (t - a.t) / ((b.t - a.t) || 1), o = {};
          for (var key in b) o[key] = (typeof b[key] === 'number' && typeof a[key] === 'number') ? a[key] + (b[key] - a[key]) * k : (k < 0.5 ? a[key] : b[key]);
          return o;
        }
      }
      return tr[tr.length - 1];
    }
    function fakeAt(t) {
      if (!fake) return null;
      if (typeof fake === 'function') return fake(t);
      if (Array.isArray(fake)) return trailAt(fake, t);
      return fake;
    }
    function currentPose() {
      if (fake) return fakeAt(tNow);
      if (!state.ball || state.ball.phase === 'done') return null;
      var p = P.pose(state.ball);
      if (!p) return null;
      return isContract(p) ? p : legacyPose(p, state.ball);
    }

    /* ── ball drawing ─────────────────────────────────────────────── */
    var SCUFF = '#6e5335';
    function ballPx(scale) { return Math.max(1, 6.8 * scale); }

    // the airborne trail: 1-px dots at recent projected centres
    function drawTrail(pose) {
      var tr = [];
      if (fake && typeof fake !== 'object' || Array.isArray(fake)) {
        // scripted path: resample the last 0.2 s at 60 Hz (deterministic)
        for (var k = 12; k >= 1; k--) {
          var q = fakeAt(tNow - k / 60);
          if (q && q.phase === 'flight') { var pq = R.project(q.x, q.y, q.z); tr.push({ x: pq.sx, y: pq.sy, age: k / 60 }); }
        }
      } else {
        for (var i = 0; i < state.trail.length; i++) {
          var s = state.trail[i];
          if (tNow - s.t <= 0.2) tr.push({ x: s.x, y: s.y, age: tNow - s.t });
        }
      }
      for (var j = 0; j < tr.length; j++) {
        if (j % 2) continue; // every other sample: a dotted streak
        ctx.fillStyle = tr[j].age < 0.1 ? R.PAL.BONE_D : R.PAL.FOG;
        ctx.fillRect(Math.round(tr[j].x), Math.round(tr[j].y), 1, 1);
      }
    }

    function drawBallSprite(x, y, r, pose) {
      R.drawBall(ctx, x, y, r);
      // a scuff mark tumbling with the distance rolled → reads as rolling
      var rr = Math.round(r);
      if (rr >= 3 && pose.phase !== 'captured') {
        var a = pose.z * 9 + pose.x * 5;
        var ox = Math.round(Math.cos(a) * (rr - 1.5)), oy = Math.round(Math.sin(a * 0.6) * (rr - 2));
        if (Math.sin(a) > -0.3) { ctx.fillStyle = SCUFF; ctx.fillRect(Math.round(x) + ox, Math.round(y) + oy, 1, 2); }
      }
    }

    function drawBallLayer() {
      view.holeGlow = [0, 0];
      var pose = currentPose();
      state.lastPose = pose;
      if (!pose || pose.phase === 'done') { view.ballSx = undefined; return; }
      var br = pose.r || U.BALL_R;
      var p = R.project(pose.x, pose.y, pose.z);
      var r = ballPx(p.scale);
      view.ballSx = p.sx;
      var h = pose.y - R.surfY(pose.z) - br;          // clearance above the surface

      if (pose.phase === 'captured' && pose.cup) {
        // Sinking into a cup: start from the resting spot (the contact
        // point, onto which a resting ball projects), drop the sprite down
        // the screen and redraw everything in front of the cup over it.
        var uv = typeof pose.v === 'number' ? { u: pose.u != null ? pose.u : pose.x, v: pose.v }
          : R.bedUV(pose.x, pose.z + br * Math.sin(U.BETA));
        var zc = U.Z_LIP + uv.v * Math.cos(U.BETA);
        var c = R.project(uv.u, R.surfY(zc), zc), rc = ballPx(c.scale);
        var s = Math.max(0, Math.min(1, pose.sinking || 0));
        if (s >= 1) return;
        var by = c.sy + s * (2 * rc + 1);
        R.drawBall(ctx, c.sx, by, rc);
        if (s > 0.25) R.drawBallShadow(ctx, c.sx, by + 1, rc, R.PAL.GAP, 0.9 * s); // the cup's own shade
        var box = { x0: Math.floor(c.sx - rc - 2), x1: Math.ceil(c.sx + rc + 3), y1: Math.ceil(by + rc + 3) };
        R.drawSinkOccluder(ctx, pose.cup, uv.u < 0 ? -1 : 1, c.sy + 1, box);
        if (pose.cup === 100) view.holeGlow[uv.u < 0 ? 0 : 1] = s;
        return;
      }

      // Up the bed past the visible top (v ≈ 2.60) the bed runs on under
      // the score bar's hood to the backstop: the hood hides the ball.
      var hooded = pose.z > U.Z_LIP && R.bedUV(pose.x, pose.z).v > R.DRAWN.bedTopV - 0.05 && h < 0.5;
      if (hooded) { ctx.save(); ctx.beginPath(); ctx.rect(0, R.GEO.target.y0, R.W, R.MH); ctx.clip(); }
      drawFreeBall(pose, p, r, h, br);
      if (hooded) ctx.restore();
    }

    function drawFreeBall(pose, p, r, h, br) {
      // contact shadow on the lane/hop/bed (none over the pit), shrinking
      // as the ball rises
      var sh = R.shadowAt(pose.x, pose.z);
      if (sh) {
        var k = Math.max(0.35, 1 - Math.max(0, h) * 1.6);
        R.drawBallShadow(ctx, sh.sx, sh.sy, r * 0.9 * k, sh.c, sh.surface === 'bed' ? 0.6 : 0.4);
      }
      if (pose.phase === 'flight') {
        drawTrail(pose);
        state.trail.push({ x: p.sx, y: p.sy, t: tNow });
        while (state.trail.length > 40) state.trail.shift();
      }

      // below the pit's mouth: the hop's crest hides it, the dark eats it
      var inPit = pose.z > U.Z_CREST && pose.z < U.Z_LIP && pose.y < R.surfY(pose.z) + br;
      if (inPit || pose.phase === 'gutter') {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, R.W, R.GEO.ramp.y0); ctx.clip();
        drawBallSprite(p.sx, p.sy, r, pose);
        var depth = Math.max(0, R.surfY(pose.z) + br - pose.y);
        if (depth > 0.02) R.drawBallShadow(ctx, p.sx, p.sy, r, R.PAL.NIGHT0, Math.min(1, depth * 3));
        ctx.restore();
        return;
      }
      drawBallSprite(p.sx, p.sy, r, pose);
    }

    // the ball riding under the thumb during a swipe (before release)
    function drawCarry() {
      if (!swipe) return false;
      if (state.ball && state.ball.phase !== 'done') return false;
      var last = swipe.pts[swipe.pts.length - 1];
      var rel = laneAt(last.x, last.y);
      var z = rel.zn * U.Z_CREST;
      var pose = { x: rel.lat, z: z, y: R.surfY(z) + U.BALL_R, phase: 'roll' };
      var p = R.project(pose.x, pose.y, pose.z), r = ballPx(p.scale), sh = R.shadowAt(pose.x, pose.z);
      if (sh) R.drawBallShadow(ctx, sh.sx, sh.sy, r * 0.9, sh.c, 0.4);
      R.drawBall(ctx, p.sx, p.sy, r);
      if (r >= 3) { // scuff tumbling with the rolled distance
        var ox = Math.round(Math.cos(swipe.roll) * (r - 1.5)), oy = Math.round(Math.sin(swipe.roll * 0.6) * (r - 2));
        ctx.fillStyle = SCUFF;
        ctx.fillRect(Math.round(p.sx + ox), Math.round(p.sy + oy), 1, 2);
      }
      view.ballSx = p.sx;
      return true;
    }

    // the next ball waiting on the throw line (not while one is lifting)
    function drawReadyBall() {
      if (view.mode !== 'play' || fake) return;
      if (state.ball && state.ball.phase !== 'done') return;
      if (view.lift && tNow - view.lift.t0 < 0.4) return;
      if (view.ballsLeft <= 0 && view.lift) return;
      var p = R.project(0, U.BALL_R, 0), r = ballPx(p.scale), sh = R.shadowAt(0, 0);
      R.drawBallShadow(ctx, sh.sx, sh.sy, r * 0.9, sh.c, 0.4);
      R.drawBall(ctx, p.sx, p.sy, r);
    }

    function drawToast() {
      var ts = view.toast && (!state.toast || view.toast.t0 > state.toast.t0) ? view.toast : state.toast;
      if (ts && tNow >= ts.t0 && tNow - ts.t0 < 0.7 && ts.text) {
        var rise = (tNow - ts.t0) * 14;
        R.textC(ctx, ts.text, ts.x, Math.round(ts.y - rise), ts.pink ? R.PAL.PINK : R.PAL.BONE, 1);
      }
    }

    /* ── debug overlay: top-down truth (V0.38 physics) ────────────── */
    function drawDebug() {
      var T = P.TUNE, g = ctx;
      if (!T || !T.ringFr) return;
      var mx = 6, mw = 44, myBot = 330, sc = 26; // px per unit
      var cxm = mx + mw / 2;
      function zRow(z) { return myBot - z * sc; }
      g.fillStyle = 'rgba(7,6,13,0.75)';
      g.fillRect(mx - 2, zRow(T.L + T.pitGap + 2.2) - 2, mw + 4, myBot - zRow(T.L + T.pitGap + 2.2) + 6);
      g.strokeStyle = '#6f5d95'; g.lineWidth = 1;
      g.strokeRect(cxm - sc, zRow(T.L), sc * 2, T.L * sc);
      g.strokeStyle = '#a63a70';
      g.beginPath();
      var cosB = Math.cos(T.bedAngle);
      for (var i = 0; i < T.ringFr.length; i += 2) {
        var rr = T.ringFr[i] * T.R10;
        g.moveTo(cxm + rr * sc, zRow(T.L + T.pitGap + T.R10 * cosB));
        g.ellipse(cxm, zRow(T.L + T.pitGap + T.R10 * cosB), rr * sc, rr * sc * cosB, 0, 0, Math.PI * 2);
      }
      g.stroke();
      if (state.ball && state.ball.trail) {
        g.fillStyle = '#e8dfc8';
        var tr = state.ball.trail;
        for (var k = 0; k < tr.length; k += 3) {
          var q = tr[k];
          if (q.s === 'lane') g.fillRect(cxm + q.x * sc, zRow(q.z), 1, 1);
        }
      }
    }

    /* ── clock, render, loop ──────────────────────────────────────── */
    var running = true, tNow = 0, simT = 0;
    var STEP = 1 / 120;
    // advance the sim to time t in fixed steps (deterministic: the same t
    // sequence gives the same pixels)
    function advance(t) {
      if (t - simT > 0.1 && !HARNESS) simT = t - 0.1; // no spiral after a stall
      while (simT + STEP <= t) {
        simT += STEP;
        if (state.ball && state.ball.phase !== 'done') {
          P.step(state.ball, STEP);
          var ev;
          while ((ev = state.ball.events.shift())) handleEvent(ev);
        }
      }
      tNow = t;
    }

    function render() {
      if (state.score !== lastScore) { view.score = state.score; lastScore = state.score; }
      if (view.score !== drumTo) { // the drums roll to every new score
        var from = view.drum ? view.drum.to : drumTo;
        view.drum = { from: from, to: view.score, t0: tNow };
        drumTo = view.score;
      }
      R.drawFrame(ctx, tNow);
      ctx.save();
      ctx.translate(0, R.TOP);
      if (!drawCarry()) { drawReadyBall(); drawBallLayer(); }
      drawToast();
      ctx.restore();
      R.drawLive(ctx, tNow, view);
      if (state.debug) { ctx.save(); ctx.translate(0, R.TOP); drawDebug(); ctx.restore(); }
      R.text(ctx, STAMP, 3, R.H - 8, '#453567', 1); // build stamp, bottom-left
    }

    var t0 = null;
    function frame(now) {
      if (!running) return;
      if (t0 === null) t0 = now;
      advance((now - t0) / 1000);
      render();
      requestAnimationFrame(frame);
    }

    fit();
    window.addEventListener('resize', fit);
    if (!HARNESS) requestAnimationFrame(frame);

    var handle = {
      throwBall: throwBall,
      view: view,
      getState: function () { return { score: state.score, phase: state.ball ? state.ball.phase : 'idle' }; },
      getPose: currentPose,
      onEvent: function (fn) { listeners.push(fn); },
      destroy: function () {
        running = false;
        window.removeEventListener('resize', fit);
        canvas.remove();
      }
    };
    if (HARNESS) {
      handle.harness = {
        canvas: canvas,
        // own the clock: advance the sim (if any) and the animation time
        stepTo: function (t) { advance(t); return tNow; },
        render: function () { render(); return tNow; },
        // feed the ball layer without physics: a contract pose, a function
        // t → pose, a trail array [{t, …pose}], or null to clear
        setBall: function (p) { fake = p || null; state.trail = []; },
        setView: function (partial) { for (var k in partial) view[k] = partial[k]; return view; },
        state: {
          get t() { return tNow; }, get view() { return view; }, get pose() { return currentPose(); },
          get score() { return state.score; }, get H() { return R.H; }, get TOP() { return R.TOP; }
        }
      };
    }
    return handle;
  }

  return { mount: mount };
})();

document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('skeeball-mount');
  if (el) window.__skeeMount = window.SkeeBall.mount(el);
  if (el) console.log('HOLLER ROLLER ' + (el.getAttribute('data-version') || 'dev'));
});
