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

    var state = {
      score: 0,
      ball: null,          // active physics throw
      launchX: 0,          // lateral position when the ball left the crest
      seed: 1,
      toast: null,         // {x, y, text, t0, pink} floating score
      debug: /[?&]debug=1/.test(location.search)
    };
    var listeners = opts.onEvent ? [opts.onEvent] : [];
    function emit(ev) {
      (window.__skeeEvents = window.__skeeEvents || []).push(ev);
      for (var i = 0; i < listeners.length; i++) listeners[i](ev);
    }

    /* ── throwing ─────────────────────────────────────────────────── */
    function throwBall(x0, vz, vx, spin) {
      if (state.ball && state.ball.phase !== 'done') return false;
      state.ball = P.createThrow(x0, vz, vx, state.seed++, spin || 0);
      emit({ type: 'throw', x0: x0, vz: vz, vx: vx, spin: spin || 0 });
      return true;
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
      var p = canvasPos(ev);
      if (p.y < R.GEO.lane.y0 - 16) return;          // swipe zone: the lane
      swipe = { pts: [{ t: performance.now(), x: p.x, y: p.y }] };
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { }
      ev.preventDefault();
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!swipe) return;
      swipe.pts.push({ t: performance.now(), x: canvasPos(ev).x, y: canvasPos(ev).y });
      if (swipe.pts.length > 48) swipe.pts.shift();
      ev.preventDefault();
    });
    // power mapping tuning — a heavy waxed ball: a soft flick barely
    // moves it; full power wants a genuinely long AND fast thumb swipe.
    var SPEED_CEIL = 2200;   // px/s that saturates the speed term
    var LEN_CEIL = 150;      // px of upward reach that saturates the length term
    var LEN_SPEED_GATE = 500; // px/s of release speed to earn full length credit
    var W_SPEED = 0.45, W_LEN = 0.55;  // blend (length-dominant = "push it")
    var POWER_GAMMA = 1.5;   // easing: soft inputs stay soft
    var SIDE_DIV = 300;      // px/s of sideways drift per unit vx (angled shots)
    var SPIN_DIV = 2.6;      // px/ms of lateral curl per unit spin (curve/hook)

    function endSwipe(ev) {
      if (!swipe) return;
      var pts = swipe.pts;
      swipe = null;
      var now = performance.now();
      // judge the throw from the final ~130ms of the gesture
      var recent = pts.filter(function (q) { return now - q.t <= 130; });
      if (recent.length < 2) return;
      var a = recent[0], b = recent[recent.length - 1];
      var dt = Math.max(0.016, (b.t - a.t) / 1000);
      var upSpeed = (a.y - b.y) / dt;                // canvas px/s, up = throw
      if (upSpeed < 120) return;                     // a nudge, not a throw
      var T = P.TUNE;

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

      // ENGLISH: curl of the swipe path — change in lateral velocity between
      // the start and end of the recent gesture. A straight (even diagonal)
      // swipe has ~constant lateral velocity → no spin; a hook curls.
      var n = recent.length, spin = 0;
      if (n >= 4) {
        var i1 = Math.max(1, Math.floor(n / 3));
        var i2 = Math.min(n - 2, Math.ceil(2 * n / 3));
        var evx = (recent[i1].x - recent[0].x) / Math.max(1, recent[i1].t - recent[0].t);
        var lvx = (recent[n - 1].x - recent[i2].x) / Math.max(1, recent[n - 1].t - recent[i2].t);
        spin = Math.max(-T.spinMax, Math.min(T.spinMax, (lvx - evx) / SPIN_DIV));
      }

      // ball starts where the swipe started, clamped to the lane
      var hw = 108 - R.GEO.lane.xb0;
      var x0 = Math.max(-0.8, Math.min(0.8, (pts[0].x - 108) / hw));
      throwBall(x0, vz, vx, spin);
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
        R.drawBallShadow(ctx, pt.x, pt.y, r * 0.9);
        R.drawBall(ctx, pt.x, pt.y - r * 0.65, r);
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
        R.drawBall(ctx, sx, sy, r0 + (r1 - r0) * pose.fr);
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
      drawBallLayer();
      if (state.debug) drawDebug();
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

  return { mount: mount };
})();

document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('skeeball-mount');
  if (el) window.__skeeMount = window.SkeeBall.mount(el);
});
