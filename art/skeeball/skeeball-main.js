/* HOLLER ROLLER — boot, input, game loop
 *
 * SkeeBall.mount(container) creates the canvas, handles crisp integer
 * scaling, reads swipes, and runs the fixed-timestep physics loop.
 * The mount handle exposes throwBall() and an event callback so the
 * eventual RPG (and the test harness) can drive the machine directly.
 *
 * Milestone 2 scope: endless balls, live score drum, no game states yet.
 * Add ?debug=1 for the top-down truth overlay.
 */
window.SkeeBall = (function () {
  'use strict';

  // Bump on every deployed change so on-device testing is unambiguous.
  // Shown in the canvas corner, the page blurb, and the console.
  var VERSION = 'V0.35';

  function mount(container, opts) {
    opts = opts || {};
    var R = window.SkeeBallRender;
    var P = window.SkeeBallPhysics;
    var canvas = document.createElement('canvas');
    canvas.width = R.W;
    canvas.height = R.H;
    canvas.className = 'skeeball-canvas';
    canvas.setAttribute('aria-label', 'HOLLER ROLLER skee ball machine');
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Integer scaling in *device* pixels (see fit() rationale in git history)
    function fit() {
      var dpr = window.devicePixelRatio || 1;
      var availW = container.clientWidth * dpr;
      var availH = container.clientHeight * dpr;
      var scale = Math.max(1, Math.floor(Math.min(availW / R.W, availH / R.H)));
      canvas.style.width = (R.W * scale / dpr) + 'px';
      canvas.style.height = (R.H * scale / dpr) + 'px';
    }
    fit();
    window.addEventListener('resize', fit);
    R.buildStatic();
    // Bind the physics scoring geometry to the geometry the renderer draws,
    // so a scored 100 lands inside the visible pink hole and every ring score
    // matches the ring the ball rests in. (Falls back to TUNE defaults, which
    // already match 'grand', if the physics build predates syncGeometry.)
    if (P.syncGeometry) P.syncGeometry(R.GEO);

    var state = {
      score: 0,
      ball: null,          // active physics throw
      launchX: 0,          // lateral position when the ball left the crest
      seed: 1,
      toast: null,         // {x, y, text, t0, pink} floating score
      ghost: [],           // recent lane positions, drawn as a fading trail
      debug: /[?&]debug=1/.test(location.search)
    };
    var listeners = opts.onEvent ? [opts.onEvent] : [];
    function emit(ev) {
      (window.__skeeEvents = window.__skeeEvents || []).push(ev);
      for (var i = 0; i < listeners.length; i++) listeners[i](ev);
    }

    /* ── throwing ─────────────────────────────────────────────────── */
    function throwBall(x0, vz, vx, spin, z0) {
      if (state.ball && state.ball.phase !== 'done') return false;
      state.ball = P.createThrow(x0, vz, vx, state.seed++, spin || 0, z0 || 0);
      state.ghost = [];
      emit({ type: 'throw', x0: x0, vz: vz, vx: vx, spin: spin || 0, z0: z0 || 0 });
      return true;
    }

    // Map a canvas point to a lane position (lateral in [-1,1], zn in [0,1]).
    function laneAt(cx, cy) {
      var g = R.GEO;
      var row = Math.max(g.ramp.y0 + 2, Math.min(g.lane.y1, cy));
      var zn = R.laneZAt(row);
      var center = R.laneBall(0, zn).x;
      var hw = R.laneBall(1, zn).x - center;
      var lat = Math.max(-0.92, Math.min(0.92, (cx - center) / hw));
      return { lat: lat, zn: zn };
    }

    // orbiting scuff mark: makes english visible on the ball itself,
    // spinning faster (and the other way) with stronger spin
    function drawSpinMark(bx, by, r, spin) {
      if (Math.abs(spin) < 0.08 || r < 3) return;
      var phase = tNow * (2.5 + 8 * Math.abs(spin)) * (spin > 0 ? 1 : -1);
      var ox = Math.round(Math.cos(phase) * (r - 1.5));
      ctx.fillStyle = '#6e5335';
      ctx.fillRect(Math.round(bx + ox), Math.round(by), 1, 2);
    }

    /* ── swipe input ──────────────────────────────────────────────── */
    canvas.style.touchAction = 'none';
    var swipe = null;
    function canvasPos(ev) {
      var r = canvas.getBoundingClientRect();
      return {
        x: (ev.clientX - r.left) * R.W / r.width,
        y: (ev.clientY - r.top) * R.H / r.height
      };
    }
    canvas.addEventListener('pointerdown', function (ev) {
      if (state.ball && state.ball.phase !== 'done') return; // one ball at a time
      var p = canvasPos(ev);
      if (p.y < R.GEO.lane.y0 - 16) return;          // swipe zone: the lane
      // a ball appears under the thumb the instant it touches the lane
      swipe = { pts: [{ t: performance.now(), x: p.x, y: p.y }], roll: 0 };
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { }
      ev.preventDefault();
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!swipe) return;
      var q = { t: performance.now(), x: canvasPos(ev).x, y: canvasPos(ev).y };
      var prev = swipe.pts[swipe.pts.length - 1];
      // accumulate rolled distance so the carried ball's scuff tumbles
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
      var T = P.TUNE;
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
      throwBall(x0, vz0, vx, spin, z0);
    }
    canvas.addEventListener('pointerup', endSwipe);
    canvas.addEventListener('pointercancel', function () { swipe = null; });

    /* ── physics events → presentation ────────────────────────────── */
    function handleEvent(ev) {
      if (ev.type === 'land') {
        state.score += ev.score;
        var pt = R.bedPoint(ev.u, ev.v, P.TUNE.R10);
        state.toast = {
          x: pt.x, y: pt.y - 8, t0: tNow,
          text: ev.score > 0 ? '' + ev.score : (ev.kind === 'pit' ? '' : '0'),
          pink: ev.score >= 50
        };
      }
      if (ev.type === 'launch') state.launchX = state.ball.x;
      emit(ev);
    }

    // the ball riding under the thumb during a swipe (before release)
    function drawCarry() {
      if (!swipe) return;
      if (state.ball && state.ball.phase !== 'done') return;
      var last = swipe.pts[swipe.pts.length - 1];
      var rel = laneAt(last.x, last.y);
      var pt = R.laneBall(rel.lat, rel.zn);
      var r = 2.2 + 4.6 * pt.s;
      var by = pt.y - r * 0.65;
      R.drawBallShadow(ctx, pt.x, pt.y, r * 0.9);
      R.drawBall(ctx, pt.x, by, r);
      // scuff mark tumbling with the rolled distance → reads as rolling
      if (r >= 3) {
        var ox = Math.round(Math.cos(swipe.roll) * (r - 1.5));
        var oy = Math.round(Math.sin(swipe.roll * 0.6) * (r - 2));
        ctx.fillStyle = '#6e5335';
        ctx.fillRect(Math.round(pt.x + ox), Math.round(by + oy), 1, 2);
      }
    }

    /* ── ball drawing ─────────────────────────────────────────────── */
    function drawBallLayer() {
      var b = state.ball;
      if (!b || b.phase === 'done') return;
      var pose = P.pose(b);
      if (!pose) return;
      var T = P.TUNE;
      if (pose.space === 'lane') {
        var zn = Math.min(1, Math.max(0, pose.z / T.L));
        var pt = R.laneBall(pose.x, zn);
        var r = 2.2 + 4.6 * pt.s;
        // short fading trail so a hooking path reads as a curve at speed
        var by = pt.y - r * 0.65;
        state.ghost.push({ x: pt.x, y: by, t: tNow });
        while (state.ghost.length && tNow - state.ghost[0].t > 0.22) state.ghost.shift();
        ctx.fillStyle = '#93743f';
        for (var gi = 0; gi < state.ghost.length; gi += 2) {
          var gp = state.ghost[gi];
          ctx.fillRect(Math.round(gp.x), Math.round(gp.y), 1, 1);
        }
        R.drawBallShadow(ctx, pt.x, pt.y, r * 0.9);
        R.drawBall(ctx, pt.x, by, r);
        drawSpinMark(pt.x, by, r, b.spin);
      } else if (pose.space === 'air') {
        var p0 = R.laneBall(state.launchX, 1);
        var p1;
        if (pose.outcome === 'pit') {
          // aim the arc at the bed's bottom lip; the roll-down phase then
          // carries it on into the dark pit mouth
          p1 = R.bedPoint(pose.u, 0, T.R10);
        } else {
          p1 = R.bedPoint(pose.u, pose.v, T.R10);
        }
        var sx = p0.x + (p1.x - p0.x) * pose.fr;
        var sy = p0.y + (p1.y - p0.y) * pose.fr - pose.y * 24; // height cue, damped
        var r0 = 2.2 + 4.6 * p0.s, r1 = 3.2;
        var fr2 = r0 + (r1 - r0) * pose.fr;
        R.drawBall(ctx, sx, sy, fr2);
        drawSpinMark(sx, sy, fr2, b.spin);
      } else if (pose.space === 'rolldown') {
        // a miss rolling back down the waxed wood and over the lip into the
        // dark pit mouth (the gutter). bedPoint carries continuously below
        // v=0 into the pit band; shrink + darken as the gutter swallows it.
        var gd = T.gutterDepth;
        var bp = R.bedPoint(pose.u, pose.v, T.R10);
        var rr = 3.0;
        if (pose.v < 0) rr = 3.0 * Math.max(0, 1 + pose.v / gd); // sinking away
        if (rr >= 1) {
          if (pose.v > 0.04) R.drawBallShadow(ctx, bp.x, bp.y + 2, rr * 0.85);
          R.drawBall(ctx, bp.x, bp.y, rr);
        }
      } else if (pose.space === 'bed') {
        var bp = R.bedPoint(pose.u, pose.v, T.R10);
        var rr = 3.2 * (1 - pose.sink * 0.55);
        if (rr >= 1) R.drawBall(ctx, bp.x, bp.y, rr);
      }
      // floating score toast
      if (state.toast && tNow - state.toast.t0 < 0.7 && state.toast.text) {
        var ts = state.toast;
        var rise = (tNow - ts.t0) * 14;
        R.textC(ctx, ts.text, ts.x, Math.round(ts.y - rise),
          ts.pink ? R.PAL.PINK : R.PAL.BONE, 1);
      }
    }

    /* ── debug overlay: top-down truth ────────────────────────────── */
    function drawDebug() {
      var T = P.TUNE, g = ctx;
      var mx = 6, mw = 44, myBot = 330, sc = 26; // px per unit
      var cxm = mx + mw / 2;
      function zRow(z) { return myBot - z * sc; }
      g.fillStyle = 'rgba(7,6,13,0.75)';
      g.fillRect(mx - 2, zRow(T.L + T.pitGap + 2.2) - 2, mw + 4, myBot - zRow(T.L + T.pitGap + 2.2) + 6);
      g.strokeStyle = '#6f5d95'; g.lineWidth = 1;
      g.strokeRect(cxm - sc, zRow(T.L), sc * 2, T.L * sc);       // lane
      g.strokeStyle = '#a63a70';
      g.beginPath();                                              // rings, plan view
      var cosB = Math.cos(T.bedAngle);
      for (var i = 0; i < T.ringFr.length; i += 2) {
        var rr = T.ringFr[i] * T.R10;
        g.moveTo(cxm + rr * sc, zRow(T.L + T.pitGap + T.R10 * cosB));
        g.ellipse(cxm, zRow(T.L + T.pitGap + T.R10 * cosB), rr * sc, rr * sc * cosB, 0, 0, Math.PI * 2);
      }
      g.stroke();
      if (state.ball) {                                           // trail
        g.fillStyle = '#e8dfc8';
        var tr = state.ball.trail;
        for (var k = 0; k < tr.length; k += 3) {
          var q = tr[k];
          if (q.s === 'lane') g.fillRect(cxm + q.x * sc, zRow(q.z), 1, 1);
        }
        var f = state.ball.flight;
        if (f && (state.ball.phase === 'settle' || state.ball.phase === 'flight')) {
          g.fillStyle = '#ff4fa8';
          g.fillRect(cxm + f.u * sc - 1, zRow(T.L + T.pitGap + f.v * cosB) - 1, 3, 3);
        }
        if (state.ball.phase === 'rolldown') {
          g.fillStyle = '#ffd23f';
          g.fillRect(cxm + state.ball.ru * sc - 1, zRow(T.L + T.pitGap + state.ball.rv * cosB) - 1, 3, 3);
        }
      }
    }

    /* ── fixed-timestep loop ──────────────────────────────────────── */
    var running = true, start = null, last = null, acc = 0, tNow = 0;
    var STEP = 1 / 120;
    function frame(now) {
      if (!running) return;
      if (start === null) { start = now; last = now; }
      tNow = (now - start) / 1000;
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      while (acc >= STEP) {
        acc -= STEP;
        if (state.ball && state.ball.phase !== 'done') {
          P.step(state.ball, STEP);
          var ev;
          while ((ev = state.ball.events.shift())) handleEvent(ev);
        }
      }
      R.drawFrame(ctx, tNow, { score: state.score });
      drawCarry();
      drawBallLayer();
      if (state.debug) drawDebug();
      R.text(ctx, VERSION, 3, R.H - 8, '#453567', 1); // build stamp, bottom-left
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    var handle = {
      throwBall: throwBall,
      getState: function () { return { score: state.score, phase: state.ball ? state.ball.phase : 'idle' }; },
      getPose: function () { return state.ball ? P.pose(state.ball) : null; },
      onEvent: function (fn) { listeners.push(fn); },
      destroy: function () {
        running = false;
        window.removeEventListener('resize', fit);
        canvas.remove();
      }
    };
    return handle;
  }

  return { mount: mount, VERSION: VERSION };
})();

document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('skeeball-mount');
  if (el) window.__skeeMount = window.SkeeBall.mount(el);
  var v = document.getElementById('skeeball-version');
  if (v) v.textContent = window.SkeeBall.VERSION;
  console.log('HOLLER ROLLER ' + window.SkeeBall.VERSION);
});
