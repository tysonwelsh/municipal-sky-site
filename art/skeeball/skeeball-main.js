/* HOLLER ROLLER — boot, input, game loop, cabinet API
 *
 * SkeeBall.mount(container, opts) creates the canvas, picks the internal
 * height and the crisp integer scale, reads the thumb, runs the fixed-step
 * loop over the physics (skeeball-physics.js), keeps the game
 * (ATTRACT → PLAY → PAYOUT → ATTRACT, tokens in, scrip out through Arcade
 * core) and draws the ball layer. The machine's reactions are drawn by
 * R.drawLive(ctx, t, view); this file only fills `view`.
 *
 * THE THROW (PLAN-2 §4). A pointerdown in the lower half of the canvas
 * rests the ball on the throw line under a chalk aim-ghost; the ball only
 * winds up a little under the thumb. On release, mapGesture() reads the
 * last ~90 ms of the gesture: speed → power, direction → aim, and a
 * deliberate end-of-gesture hook → english. The ball always launches from
 * the throw line. See mapGesture below for the constants.
 *
 * opts: { seed, tune (partial physics TUNE per throw), free (no tokens),
 *         onEvent(ev), harness }
 * Handle: { destroy, pause, resume, throwBall(power 0..1, aim rad,
 *           spin -1..1 [, x0]), getState(), onEvent(fn) → unsubscribe,
 *           harness (only with ?harness=1) }
 * Events (opts.onEvent, handle.onEvent, Arcade.emit('skeeball', ev)):
 *   every physics event (launch, wall, rim, bed, backstop, captured,
 *   gutter, stall, bounceback, rest, cage, return, timeout, done) with
 *   `ball: n` (a ball left propped on a 100 hole's lip comes out as
 *   `stuck` instead of `gutter`: no score, ball consumed), plus
 *   input {kind}, mute {muted}, mode {mode}, coin, nocoin, ballstart
 *   {n, ballsLeft}, throw {x0, v, aim, spin}, jackpot, gameover {score,
 *   tickets, hundreds}, ticket {n}.
 *
 * Keys: space throws (shift: full power), ←/→ aim ±5°, M mutes.
 * ?harness=1  no rAF loop: window.__skeeMount.harness owns the clock
 * ?mode=attract|play|payout  start in that mode (preview)
 */
(function (root) {
  'use strict';

  /* ══ the gesture → throw mapping (pure; Node-testable) ═══════════════ */
  //
  // Aim: the direction of the same window, screen → lane (AIM_PERSPECTIVE).
  // Power: release speed over the last WIN_MS of the gesture, in canvas
  // heights per second (so phone and desktop feel the same), mapped
  //   p = clamp((s − SPEED_FLOOR) / (SPEED_CEIL − SPEED_FLOOR))^GAMMA
  //   v = vMin + (vMax − vMin) · smoothstep(p)          (vMin/vMax: P.TUNE)
  // SPEED_FLOOR 0.25 H/s: slower than that is a dead roll (v = vMin).
  // SPEED_CEIL 4.5 H/s: ≈ 3000 css px/s on a phone, a hard flick.
  // GAMMA 0.83: puts the ring stack (v ≈ 3–4.5) on an ordinary medium
  //   flick (≈ 1.2–2.0 H/s, 800–1350 px/s on a phone) and the 100 holes
  //   (v ≈ 6.9) on a fast one (≈ 3.6 H/s).
  var GESTURE = {
    SPEED_FLOOR: 0.25, SPEED_CEIL: 4.5, GAMMA: 0.83,
    WIN_MS: 90,                  // release window for power + aim
    AIM_MAX: 25 * Math.PI / 180, // aim clamp, on the lane (P.softAim compresses further)
    // The swipe is read on the SCREEN, the aim is on the LANE: at the throw
    // line one unit of z is 32.5 canvas rows but one unit of x is 96 px
    // (render.js laneRowAt / laneBall), so tan(lane aim) = 0.34·tan(screen
    // angle). A swipe along a line drawn on the lane throws along that line,
    // and the chalk ghost lies under the thumb.
    AIM_PERSPECTIVE: 0.34,
    HOOK_MS: 40, HOOK_PRIOR_MS: 90,
    HOOK_MIN: 25 * Math.PI / 180,  // a natural thumb arc turns less than this
    HOOK_FULL: 70 * Math.PI / 180, // a full hook: english 1 ≈ one ring sideways
    HOOK_LATE_PX: 6, HOOK_PRIOR_PX: 8,
    MIN_TRAVEL: 12               // css px of upward travel to count as a throw
  };
  var FALLBACK_TUNE = { vMin: 2.08, vMax: 7.2 };

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function smoothstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  // points: [{t (ms), x, y (css px, y down)[, id]}], one pointer (if the
  // points carry ids, only the first point's pointer counts).
  // → {v, aim, spin, valid, power, speed (H/s), x0css, travel, tap}
  function mapGesture(points, canvasCssHeight, tune) {
    var G = GESTURE;
    var T = tune || (root.SkeeBallPhysics && root.SkeeBallPhysics.TUNE) || FALLBACK_TUNE;
    var out = { v: T.vMin, aim: 0, spin: 0, valid: false, power: 0, speed: 0, x0css: null, travel: 0, tap: true };
    if (!points || !points.length || !(canvasCssHeight > 0)) return out;
    var id = points[0].id, pts = [];
    for (var i = 0; i < points.length; i++) {
      var q = points[i];
      if (id != null && q.id != null && q.id !== id) continue;
      if (pts.length && q.t < pts[pts.length - 1].t) continue; // out of order
      pts.push(q);
    }
    var n = pts.length, a = pts[0], z = pts[n - 1];
    out.x0css = z.x;
    var minY = a.y, maxD = 0;
    for (var k = 0; k < n; k++) {
      if (pts[k].y < minY) minY = pts[k].y;
      maxD = Math.max(maxD, Math.hypot(pts[k].x - a.x, pts[k].y - a.y));
    }
    out.travel = a.y - minY;
    out.tap = maxD < 8;
    if (n < 2) return out;

    // position at time t, linear between samples, clamped to the gesture
    function at(t) {
      if (t <= a.t) return a;
      for (var j = n - 1; j > 0; j--) {
        if (pts[j - 1].t <= t) {
          var p0 = pts[j - 1], p1 = pts[j], f = (t - p0.t) / ((p1.t - p0.t) || 1);
          return { t: t, x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f };
        }
      }
      return a;
    }

    var tA = Math.max(a.t, z.t - G.WIN_MS), w = at(tA), dt = (z.t - tA) / 1000;
    out.x0css = w.x;
    if (dt < 0.008) return out;
    var dx = z.x - w.x, up = w.y - z.y;
    var s = Math.hypot(dx, up) / dt / canvasCssHeight;
    out.speed = s;
    out.valid = out.travel >= G.MIN_TRAVEL && up > 0;
    // a thumb held still at the end has no window direction: use the whole gesture's
    var ax = dx, ay = up;
    if (Math.hypot(dx, up) < 3) { ax = z.x - a.x; ay = a.y - z.y; }
    out.aimScreen = ay > 0 ? Math.atan2(ax, ay) : 0;
    out.aim = clamp(Math.atan(G.AIM_PERSPECTIVE * Math.tan(out.aimScreen)), -G.AIM_MAX, G.AIM_MAX);
    var p = Math.pow(clamp((s - G.SPEED_FLOOR) / (G.SPEED_CEIL - G.SPEED_FLOOR), 0, 1), G.GAMMA);
    out.power = smoothstep(p);
    out.v = T.vMin + (T.vMax - T.vMin) * out.power;

    // english: the heading of the last HOOK_MS against the HOOK_PRIOR_MS
    // before it; screen y is down, so a clockwise turn is a hook right (+x)
    if (z.t - a.t >= G.HOOK_MS + 30) {
      var h1 = at(z.t - G.HOOK_MS), h0 = at(Math.max(a.t, z.t - G.HOOK_MS - G.HOOK_PRIOR_MS));
      var lx = z.x - h1.x, ly = z.y - h1.y, px = h1.x - h0.x, py = h1.y - h0.y;
      if (Math.hypot(lx, ly) >= G.HOOK_LATE_PX && Math.hypot(px, py) >= G.HOOK_PRIOR_PX) {
        var turn = Math.atan2(px * ly - py * lx, px * lx + py * ly);
        var m = clamp((Math.abs(turn) - G.HOOK_MIN) / (G.HOOK_FULL - G.HOOK_MIN), 0, 1);
        out.spin = m ? (turn < 0 ? -m : m) : 0;
        out.turn = turn;
      }
    }
    if (!out.valid) out.spin = 0;
    return out;
  }

  /* ══ the cabinet ═════════════════════════════════════════════════════ */
  var MODES = { attract: 1, play: 1, payout: 1 };
  var BALLS = 9, LIFT_T = 0.4, DUST_T = 0.15, NOTE_T = 1.6, RATTLE_T = 0.5, RIM_TICK_T = 2 / 60;
  var MEDIUM = 0.3;              // keyboard / default power: v 3.6, a straight throw into the stack

  function mount(container, opts) {
    opts = opts || {};
    var R = root.SkeeBallRender;
    var P = root.SkeeBallPhysics;
    var A = root.Arcade || null;
    var U = R.UNITS;
    var search = typeof location !== 'undefined' ? location.search : '';
    var HARNESS = opts.harness || /[?&]harness=1/.test(search);
    var FREE = !!opts.free || !A;
    // version stamp: VERSION file → data-version on the mount (index.php)
    var VERSION = (container.getAttribute('data-version') || 'dev').trim();
    var STAMP = VERSION.toUpperCase();

    var canvas = document.createElement('canvas');
    canvas.width = R.W;
    canvas.height = R.H;
    canvas.className = 'skeeball-canvas';
    canvas.setAttribute('aria-label', 'HOLLER ROLLER skee ball machine. Swipe up the lane to roll; space bar throws.');
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    // Integer scaling in *device* pixels. The scale is the largest integer
    // at which the 216×384 machine fits; the internal height then grows (up
    // to 448) to fill the stage at that scale — the extra rows are room.
    function fit() {
      var dpr = root.devicePixelRatio || 1;
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
    var bad = R.checkGeometry(P.GEO);
    if (bad.length) console.warn('HOLLER ROLLER: physics GEO differs from the drawn machine:\n  ' + bad.join('\n  '));

    /* ── state ─────────────────────────────────────────────────────── */
    var game = {
      mode: 'attract', score: 0, n: 0, hundreds: 0, tickets: 0, ballScores: [],
      seed: (opts.seed | 0) || 1913, games: 0,
      payoutT0: 0, ticketsCranked: 0, crankPer: 0.12
    };
    var state = {
      ball: null,          // the physics throw in play
      toast: null,         // {x, y, text, t0, pink} floating score
      trail: [],           // recent airborne screen points {x, y, t}
      lastPose: null
    };
    // what the machine shows; drawLive reads it (see render.js for fields)
    var view = {
      mode: 'attract', score: 0, highScore: 0, ballsLeft: BALLS,
      ticketsOut: 0, cranking: false, hundreds: 0, holeGlow: [0, 0],
      lift: null, liftT: null, jackpot: null, wideT0: null,
      doorRattle: null, marqueeNote: null, thirteen: false
    };
    var drag = null;       // {id, pts: [{t, x, y}], live}
    var dust = null;       // {pts: [[sx, sy]], t0} — the ghost puffing to chalk dust
    var kbd = { aim: 0, until: -1 };

    function stats() {
      var s = A ? A.stats('skeeball') : {};
      if (s.games == null) { s.games = 0; s.best = 0; s.lifetimeScore = 0; s.hundreds = 0; s.tickets = 0; }
      return s;
    }
    view.highScore = stats().best || 0;

    /* ── events ────────────────────────────────────────────────────── */
    var listeners = opts.onEvent ? [opts.onEvent] : [];
    var ring = [];         // the last 64 events, for the harness only
    function emit(ev) {
      if (HARNESS) { ring.push(ev); if (ring.length > 64) ring.shift(); }
      for (var i = 0; i < listeners.length; i++) {
        try { listeners[i](ev); } catch (e) { console.error(e); } // a bad listener never stops the machine
      }
      if (A) A.emit('skeeball', ev);
    }

    /* ── the game ──────────────────────────────────────────────────── */
    function setMode(m) {
      game.mode = m; view.mode = m;
      // a hard scroll lock while a game is running (the stage already refuses touch scrolling)
      document.documentElement.classList.toggle('skeeball-playing', m === 'play');
      emit({ type: 'mode', mode: m });
    }
    function toAttract() {
      drag = null;
      if (A && !FREE && A.tokens.get() <= 0) {
        // the machine finds a nickel in its own coin return (WORLD.md)
        A.tokens.add(5, 'skeeball-return');
        A.flags.set('skeeball.found-a-nickel');
      }
      view.highScore = stats().best || 0;
      view.ballsLeft = BALLS; view.lift = null; view.liftT = null;
      view.ticketsOut = 0; view.cranking = false; view.thirteen = false; view.hundreds = 0;
      game.n = 0;
      setMode('attract');
    }
    // feed the machine a nickel; false (door rattles, NO TOKENS) if the pocket is empty
    function coin() {
      if (!FREE && !A.tokens.spend(1, 'skeeball')) {
        view.doorRattle = tNow;
        view.marqueeNote = { text: 'NO TOKENS', t0: tNow, until: tNow + NOTE_T };
        emit({ type: 'nocoin' });
        return false;
      }
      emit({ type: 'coin', tokens: A ? A.tokens.get() : null });
      return true;
    }
    function startGame() {
      setScore(0); game.hundreds = 0; game.ballScores = []; game.games++;
      state.ball = null; state.toast = null;
      view.hundreds = 0; view.jackpot = null; view.ticketsOut = 0; view.cranking = false; view.thirteen = false;
      setMode('play');
      startBall(1);
    }
    function startBall(n) {
      game.n = n;
      view.ballsLeft = BALLS - n;
      view.lift = { t0: tNow }; view.liftT = tNow;
      emit({ type: 'ballstart', n: n, ballsLeft: view.ballsLeft });
    }
    // busy while the pose says the ball is anything but done (the pose is the contract)
    function ballActive() { return !!(state.ball && P.pose(state.ball).phase !== 'done'); }
    function ballSeed() { return (game.seed * 1000003 + game.games * 131 + game.n * 17) | 0; }

    // every throw goes through here: from a swipe, the keyboard or the API
    function requestThrow(x0, v, aim, spin) {
      if (game.mode === 'payout') { toAttract(); return false; }
      if (game.mode === 'attract') {
        if (!coin()) return false;        // any swipe in ATTRACT is "a nickel and a throw"
        startGame();
      }
      if (ballActive() || game.n < 1) return false;
      x0 = clamp(+x0 || 0, -0.85, 0.85);
      state.ball = P.createThrow(x0, v, aim || 0, spin || 0, ballSeed(), opts.tune || null);
      state.trail = []; state.cap = null; state.rimTick = null; state.pendingJackpot = null;
      view.lift = null;                   // the throw cuts any lift still under way
      emit({ type: 'throw', x0: +x0.toFixed(4), v: +v.toFixed(4), aim: +(aim || 0).toFixed(4), spin: +(spin || 0).toFixed(4), ball: game.n });
      return true;
    }
    function throwPower(power, aim, spin, x0) {
      var T = P.TUNE;
      return requestThrow(x0 || 0, T.vMin + (T.vMax - T.vMin) * clamp(+power || 0, 0, 1), aim, spin);
    }

    function onPhysicsEvent(ev) {
      ev.ball = game.n;
      // a ball propped on a 100 hole's lip (result 'stuck') is taken back
      // with no score: a gutter for the game, its own event for the sound
      if (ev.type === 'gutter' && state.ball && state.ball.result && state.ball.result.kind === 'stuck')
        ev = { type: 'stuck', t: ev.t, ball: game.n };
      var lp = state.ball ? P.pose(state.ball) : null;
      if (ev.type === 'rim' && lp) {
        // the rattle's picture: the struck arc ticks, the ball jumps a pixel
        state.rimTick = { ring: ev.ring, angle: Math.atan2(lp.v - P.GEO.ringC.v, lp.u - P.GEO.ringC.u), t0: tNow };
      }
      if (ev.type === 'captured' && typeof ev.score === 'number') {
        setScore(game.score + ev.score);
        // the sprite sinks from where it was caught (a 100 stays pinned there)
        state.cap = lp ? { u: lp.u, v: lp.v, hole: ev.hole != null ? ev.hole : lp.hole } : null;
        var p = lp ? R.project(lp.x, lp.y, lp.z) : { sx: 108, sy: 150 };
        if (ev.score === 100) {
          // the capture only lights the hole (holeGlow); the flash, the wide
          // eyes, the toast and the jackpot event wait for the swallow (done)
          game.hundreds++;
          view.hundreds = game.hundreds;
          state.pendingJackpot = { hole: state.cap && state.cap.hole != null ? state.cap.hole : (lp && lp.x < 0 ? 0 : 1), x: p.sx, y: p.sy };
          if (A) A.flags.set('skeeball.hit-100');
        } else {
          state.toast = { x: p.sx, y: p.sy - 8, t0: tNow, text: '' + ev.score, kind: 'score' };
        }
      }
      emit(ev);
      if (ev.type === 'done' && state.pendingJackpot) {
        var jp = state.pendingJackpot; state.pendingJackpot = null;
        view.jackpot = { hole: jp.hole, t0: tNow };
        view.wideT0 = tNow;
        state.toast = { x: jp.x, y: jp.y - 8, t0: tNow, text: '100', kind: 'hundred' };
        emit({ type: 'jackpot', hole: jp.hole, ball: game.n });
      }
      if (ev.type === 'done') {
        state.cap = null;
        game.ballScores.push(ev.score || 0);
        if (game.mode !== 'play') return;
        if (game.n < BALLS) startBall(game.n + 1);
        else gameOver();
      }
    }

    function gameOver() {
      var s = game.score;
      var n = Math.floor(s / 50) + (s >= 300 ? 5 : 0) + 13 * game.hundreds;
      game.tickets = n;
      if (A && n > 0) A.scrip.add(n, 'skeeball');
      if (A) {
        var st = stats();
        st.games++; st.best = Math.max(st.best || 0, s);
        st.lifetimeScore += s; st.hundreds += game.hundreds; st.tickets += n;
        A.persist();
      }
      game.payoutT0 = tNow; game.ticketsCranked = 0;
      game.crankPer = n > 0 ? Math.min(0.12, 4 / n) : 0;
      view.ticketsOut = 0; view.cranking = n > 0;
      view.hundreds = game.hundreds; view.thirteen = game.hundreds > 0;
      view.ballsLeft = 0; view.lift = null;
      view.highScore = Math.max(view.highScore || 0, s);
      setMode('payout');
      emit({ type: 'gameover', score: s, tickets: n, hundreds: game.hundreds });
    }

    // timers that live on the sim clock (deterministic under the harness)
    function tickGame() {
      if (game.mode !== 'payout') return;
      var n = game.tickets, e = tNow - game.payoutT0;
      var out = n > 0 ? Math.min(n, e / game.crankPer) : 0;
      while (game.ticketsCranked < Math.floor(out + 1e-9)) {
        game.ticketsCranked++;
        emit({ type: 'ticket', n: game.ticketsCranked });
      }
      view.ticketsOut = out;
      view.cranking = out < n;
      if (e >= n * game.crankPer + 2) toAttract();
    }

    /* ── input ─────────────────────────────────────────────────────── */
    canvas.style.touchAction = 'none';
    function toMachine(cx, cy) { // canvas css px → machine frame
      var r = canvas.getBoundingClientRect();
      return { x: cx * R.W / r.width, y: cy * R.H / r.height - R.TOP };
    }
    function laneX(mx) { return clamp((mx - 108) / (108 - R.GEO.lane.xb0), -0.85, 0.85); }
    function onCoinDoor(m) {
      var x0 = R.GEO.lane.xb0 - 4, fr = R.GEO.front; // front panel's left edge (render: frontX)
      return m.x >= x0 + 6 && m.x <= x0 + 48 && m.y >= fr.y0 && m.y <= fr.y1 + 2;
    }
    function inSwipeZone(cy) { return cy >= canvas.getBoundingClientRect().height / 2; }
    function canStartDrag() { return !(game.mode === 'play' && ballActive()); }

    // a finished gesture (pointer or harness): tap, throw, or nothing
    function release(pts) {
      var r = canvas.getBoundingClientRect();
      var g = mapGesture(pts, r.height);
      var thrown = false;
      if (g.tap) {
        var m = toMachine(pts[0].x, pts[0].y);
        if (game.mode === 'attract' && onCoinDoor(m)) { if (coin()) startGame(); }
        else if (game.mode === 'payout') toAttract();
      } else if (g.valid) {
        if (game.mode === 'payout') toAttract();
        else thrown = requestThrow(laneX(toMachine(g.x0css, 0).x), g.v, g.aim, g.spin);
      }
      puffGhost(pts, g);
      return { gesture: g, thrown: thrown };
    }

    function localPt(ev) {
      var r = canvas.getBoundingClientRect();
      return { t: ev.timeStamp, x: ev.clientX - r.left, y: ev.clientY - r.top };
    }
    function onDown(ev) {
      emit({ type: 'input', kind: 'down' });
      if (drag) return;                        // one pointer at a time
      var pt = localPt(ev);
      if (game.mode === 'payout') { toAttract(); return; }
      if (!inSwipeZone(pt.y) || !canStartDrag()) return;
      drag = { id: ev.pointerId, pts: [pt], live: true };
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) { }
      ev.preventDefault();
    }
    function onMove(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var list = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
      if (!list || !list.length) list = [ev];
      for (var i = 0; i < list.length; i++) drag.pts.push(localPt(list[i]));
      while (drag.pts.length > 96) drag.pts.shift();
      ev.preventDefault();
    }
    function onUp(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var pts = drag.pts; drag = null;
      pts.push(localPt(ev));
      release(pts);
    }
    function onCancel(ev) {
      if (drag && ev.pointerId === drag.id) drag = null;
    }
    function onTouchMove(ev) { if (ev.cancelable) ev.preventDefault(); } // belt and braces for iOS
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('lostpointercapture', onCancel);
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });

    // keyboard: space = medium straight throw (shift: full power), ←/→ aim ±5°
    function onKey(ev) {
      if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      if (ev.code === 'Space' || ev.key === ' ') {
        ev.preventDefault();
        if (ev.repeat) return;
        emit({ type: 'input', kind: 'key' });
        if (game.mode === 'payout') { toAttract(); return; }
        throwPower(ev.shiftKey ? 1 : MEDIUM, kbd.aim, 0, 0);
      } else if (ev.key === 'm' || ev.key === 'M') {
        userMuted = !userMuted;
        syncMute();
        emit({ type: 'mute', muted: userMuted });
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        kbd.aim = clamp(kbd.aim + (ev.key === 'ArrowLeft' ? -5 : 5) * Math.PI / 180, -GESTURE.AIM_MAX, GESTURE.AIM_MAX);
        kbd.until = tNow + 1.5;
      }
    }
    root.addEventListener('keydown', onKey);

    /* ── ball drawing ─────────────────────────────────────────────── */
    var SCUFF = R.PAL.CORK2;
    // the one ball-radius law lives in render (R.ballRadius) once it lands
    function ballPx(scale) { return R.ballRadius ? R.ballRadius(scale) : Math.max(1, 6.8 * scale); }
    function hash(a, b) { var h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; }

    // the airborne trail: 1-px dots at recent projected centres
    function drawTrail() {
      var tr = [];
      if (fake && (typeof fake === 'function' || Array.isArray(fake))) {
        for (var k = 12; k >= 1; k--) { // scripted path: resample the last 0.2 s at 60 Hz
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

    // a trail array [{t, …pose}] → pose at time t (linear between samples)
    var fake = null;       // harness: a pose, a function t → pose, or a trail
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
      return P.pose(state.ball);
    }

    // what the machine needs from the ball before anything is drawn (the
    // live layer under the ball reads the gaze and the hole glow)
    function prepView() {
      view.holeGlow = [0, 0];
      view.ballSx = undefined;
      var pose = currentPose();
      if (pose && pose.phase !== 'done') {
        view.ballSx = R.project(pose.x, pose.y, pose.z).sx;
        if (pose.phase === 'captured' && pose.cup === 100) {
          var h = pose.hole != null ? pose.hole : (state.cap && state.cap.hole != null ? state.cap.hole : (pose.x < 0 ? 0 : 1));
          view.holeGlow[h === 0 ? 0 : 1] = clamp(pose.sinking || 0, 0, 1);
        }
      } else {
        var rd = dragRead();
        if (rd) view.ballSx = R.project(rd.x, U.BALL_R, rd.z).sx;
        else if (game.mode === 'play' && game.n >= 1) view.ballSx = 108;
      }
    }

    function drawBallLayer() {
      var pose = currentPose();
      state.lastPose = pose;
      if (!pose || pose.phase === 'done') return false;
      var br = pose.r || U.BALL_R;
      var p = R.project(pose.x, pose.y, pose.z);
      var r = ballPx(p.scale);
      view.ballSx = p.sx;
      var h = pose.y - R.surfY(pose.z) - br;          // clearance above the surface

      if (pose.phase === 'captured' && pose.cup) {
        // Sinking into a cup: start from the resting spot (the contact
        // point, onto which a resting ball projects), drop the sprite down
        // the screen and redraw everything in front of the cup over it.
        var hole100 = pose.cup === 100;
        var side = hole100 ? ((pose.hole != null ? pose.hole : (state.cap && state.cap.hole)) === 0 ? -1 : 1) : 0;
        // a 100 sinks straight down from where it was caught (no Hermite bob)
        var uv = hole100 && state.cap && !fake ? { u: state.cap.u, v: state.cap.v }
          : typeof pose.v === 'number' ? { u: pose.u != null ? pose.u : pose.x, v: pose.v }
          : R.bedUV(pose.x, pose.z + br * Math.sin(U.BETA));
        if (!side) side = uv.u < 0 ? -1 : 1;
        var zc = U.Z_LIP + uv.v * Math.cos(U.BETA);
        var c = R.project(uv.u, R.surfY(zc), zc), rc = ballPx(c.scale);
        var s = clamp(pose.sinking || 0, 0, 1);
        if (s >= 1) return true;
        var by = c.sy + s * (2 * rc + 1);
        if (hole100 && R.drawSunkBall) R.drawSunkBall(ctx, c.sx, by, rc, s);
        else {
          R.drawBall(ctx, c.sx, by, rc);
          if (s > 0.25) R.drawBallShadow(ctx, c.sx, by + 1, rc, R.PAL.GAP, 0.9 * s); // the cup's own shade
        }
        var box = { x0: Math.floor(c.sx - rc - 2), x1: Math.ceil(c.sx + rc + 3), y1: Math.ceil(by + rc + 3) };
        R.drawSinkOccluder(ctx, pose.cup, side, c.sy + 1, box);
        if (hole100) view.holeGlow[side < 0 ? 0 : 1] = s;
        return true;
      }

      // Up the bed past the visible top the bed runs on under the score
      // bar's hood to the backstop: the hood hides the ball.
      var hooded = pose.z > U.Z_LIP && R.bedUV(pose.x, pose.z).v > R.DRAWN.bedTopV - 0.05 && h < 0.5;
      if (hooded) { ctx.save(); ctx.beginPath(); ctx.rect(0, R.GEO.target.y0, R.W, R.MH); ctx.clip(); }
      drawFreeBall(pose, p, r, h, br);
      if (hooded) ctx.restore();
      return true;
    }

    function drawFreeBall(pose, p, r, h, br) {
      // contact shadow on the lane/hop/bed (none over the pit), shrinking as the ball rises
      var sh = R.shadowAt(pose.x, pose.z);
      if (sh) {
        var k = Math.max(0.35, 1 - Math.max(0, h) * 1.6);
        R.drawBallShadow(ctx, sh.sx, sh.sy, r * 0.9 * k, sh.c, sh.surface === 'bed' ? 0.6 : 0.4);
      }
      if (pose.phase === 'flight') drawTrail();
      var rt = state.rimTick;
      if (rt && tNow - rt.t0 < RIM_TICK_T) {
        if (rt.ring != null && R.drawRimTick) R.drawRimTick(ctx, rt.ring, rt.angle, 1 - (tNow - rt.t0) / RIM_TICK_T);
        p = { sx: p.sx + (Math.cos(rt.angle) < 0 ? 1 : -1), sy: p.sy - 1, scale: p.scale }; // knocked a pixel off the rim
      }
      // below the pit's mouth: the hop's crest hides it, the dark eats it
      var inPit = pose.z > U.Z_CREST && pose.z < U.Z_LIP && pose.y < R.surfY(pose.z) + br;
      if (inPit || pose.phase === 'gutter') {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, R.W, R.GEO.ramp.y0); ctx.clip();
        var depth = Math.min(1, Math.max(0, R.surfY(pose.z) + br - pose.y) * 3);
        if (R.drawSunkBall) R.drawSunkBall(ctx, p.sx, p.sy, r, depth);
        else {
          drawBallSprite(p.sx, p.sy, r, pose);
          if (depth > 0.06) darkenBall(p.sx, p.sy, r, depth);
        }
        ctx.restore();
        return;
      }
      drawBallSprite(p.sx, p.sy, r, pose);
    }

    // stopgap until R.drawSunkBall: the dark eats the ball on a Bayer grid
    // (never a same-size ellipse, which reads as a hollow ring)
    var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    function darkenBall(x, y, r, depth) {
      var cx = Math.round(x), cy = Math.round(y), rr = Math.ceil(r);
      ctx.fillStyle = R.PAL.NIGHT0;
      for (var j = -rr; j <= rr; j++) for (var i = -rr; i <= rr; i++) {
        if (i * i + j * j > r * r + 0.5) continue;
        var X = cx + i, Y = cy + j;
        if (BAYER4[((Y & 3) << 2) | (X & 3)] / 16 < depth) ctx.fillRect(X, Y, 1, 1);
      }
    }

    // a ball resting on the lane at (x, z)
    function drawLaneBall(x, z) {
      var p = R.project(x, U.BALL_R, z), r = ballPx(p.scale), sh = R.shadowAt(x, z);
      if (sh) R.drawBallShadow(ctx, sh.sx, sh.sy, r * 0.9, sh.c, 0.4);
      R.drawBall(ctx, p.sx, p.sy, r);
      view.ballSx = p.sx;
    }

    // the live read of the drag: gesture so far (plus "now", so a held
    // thumb reads as no power) and the cosmetic wind-up under the thumb
    function dragRead() {
      if (!drag || drag.pts.length < 1) return null;
      var r = canvas.getBoundingClientRect(), pts = drag.pts;
      if (drag.live && typeof performance !== 'undefined') {
        var last = pts[pts.length - 1], now = performance.now();
        if (now > last.t + 1) pts = pts.concat([{ t: now, x: last.x, y: last.y }]);
      }
      var g = mapGesture(pts, r.height);
      var a = drag.pts[0], z = drag.pts[drag.pts.length - 1];
      var rows = (a.y - z.y) * R.H / r.height;      // machine rows the thumb went up
      var laneRows = R.GEO.lane.y1 - R.GEO.lane.y0;
      var wz = clamp(rows / laneRows * U.Z_HOP * 0.35, -0.25, 0.15 * U.Z_HOP);
      var bx = laneX(toMachine(g.x0css != null ? g.x0css : z.x, 0).x);
      return { g: g, x: bx, z: wz };
    }

    // the chalk aim-ghost: a worn chalk arrow in the lane; length = power,
    // angle = aim. Returns its screen pixels [x, y, strength 0..1].
    function ghostPoints(x, z, power, aim) {
      var len = 0.4 + 2.7 * power, pts = [], z0 = z + 0.3;
      var sa = Math.sin(aim), ca = Math.cos(aim);
      var steps = Math.ceil(len / 0.02), last = null, prev = null;
      for (var i = 0; i <= steps; i++) {
        var s = len * i / steps, gx = x + s * sa, gz = z0 + s * ca;
        if (gz > U.Z_HOP - 0.05 || Math.abs(gx) > 0.97) break;
        var p = R.project(gx, 0, gz), sx = Math.round(p.sx), sy = Math.round(p.sy);
        pts.push([sx, sy, 1]);
        if (p.scale > 0.82) pts.push([sx + 1, sy, 0.7]);  // wider near the thrower
        prev = last; last = [p.sx, p.sy];
      }
      if (last && prev && pts.length > 8) {
        // the head: two 5-px barbs back from the tip at ±35° on screen
        var dx = last[0] - prev[0], dy = last[1] - prev[1], d = Math.hypot(dx, dy) || 1;
        dx /= d; dy /= d;
        for (var side = -1; side <= 1; side += 2) {
          var c = Math.cos(Math.PI - side * 0.6), sn = Math.sin(Math.PI - side * 0.6);
          var bx = dx * c - dy * sn, by = dx * sn + dy * c;
          for (var j = 1; j <= 5; j++) pts.push([Math.round(last[0] + bx * j), Math.round(last[1] + by * j), 1]);
        }
      }
      return pts;
    }
    function drawGhost(pts) {
      var seen = {};
      ctx.fillStyle = R.PAL.BONE;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], key = p[0] + ',' + p[1];
        if (seen[key]) continue;
        seen[key] = 1;
        // chalk on waxed wood: the stroke wears through in places
        if (hash(p[0], p[1]) < 0.16) continue;
        ctx.globalAlpha = 0.9 * p[2];
        ctx.fillRect(p[0], p[1], 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    function drawDust() {
      if (!dust) return;
      var k = (tNow - dust.t0) / DUST_T;
      if (k < 0 || k >= 1) { if (k >= 1) dust = null; return; }
      ctx.fillStyle = R.PAL.BONE;
      for (var i = 0; i < dust.pts.length; i++) {
        var p = dust.pts[i], hx = hash(p[0] * 7 + i, p[1]), hy = hash(p[1] * 13, p[0] + i);
        if (hash(i, 99) < k * 0.9) continue;             // it thins as it drifts
        ctx.globalAlpha = 0.7 * (1 - k);
        ctx.fillRect(Math.round(p[0] + (hx - 0.5) * 6 * k), Math.round(p[1] - hy * 4 * k), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    function puffGhost(pts, g) {
      if (!g || g.tap || pts.length < 2) return;
      var bx = laneX(toMachine(g.x0css != null ? g.x0css : pts[0].x, 0).x);
      dust = { pts: ghostPoints(bx, 0, g.power, g.aim), t0: tNow };
    }

    // the ball on the throw line: the next ball, or the one under the thumb
    function drawThrowLine() {
      var rd = dragRead();
      if (rd) {
        drawGhost(ghostPoints(rd.x, 0, rd.g.power, rd.g.aim));
        drawLaneBall(rd.x, rd.z);
        return;
      }
      if (game.mode !== 'play' || fake || ballActive() || game.n < 1) return;
      if (view.lift && tNow - view.lift.t0 < LIFT_T) return;
      if (tNow < kbd.until) drawGhost(ghostPoints(0, 0, MEDIUM, kbd.aim));
      drawLaneBall(0, 0);
    }

    // the floating score: pink with a dark outline, kept off the painted
    // label column (R.drawToast once it lands; this is its stopgap)
    var TOAST_T = 0.7, TOAST_RISE = 14;
    function drawToast() {
      var ts = view.toast && (!state.toast || view.toast.t0 > state.toast.t0) ? view.toast : state.toast;
      if (!ts || tNow < ts.t0 || tNow - ts.t0 >= TOAST_T || !ts.text) return;
      var kind = ts.kind || (ts.text === '100' ? 'hundred' : ts.text === '0' ? 'zero' : 'score');
      var y = Math.round(ts.y - (tNow - ts.t0) * TOAST_RISE);
      if (R.drawToast) { R.drawToast(ctx, ts.text, ts.x, y, kind); return; }
      var x = ts.x;
      if (Math.abs(x - 108) < 10) x = x < 108 ? 108 - 14 : 108 + 14;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++)
        if (dx || dy) R.textC(ctx, ts.text, x + dx, y + dy, R.PAL.NIGHT0, 1);
      R.textC(ctx, ts.text, x, y, kind === 'hundred' ? R.PAL.MOON : R.PAL.PINK, 1);
    }

    // Stopgaps until render.js draws them (view.marqueeNote, view.doorRattle):
    // NO TOKENS in pink over the marquee, and the coin door shaking.
    function drawMachineNotes() {
      var note = view.marqueeNote;
      if (note && tNow >= note.t0 && tNow < note.until) {
        var m = R.GEO.marquee;
        if (Math.floor((tNow - note.t0) * 6) % 3 !== 2) {
          ctx.fillStyle = R.PAL.NIGHT0;
          ctx.fillRect(m.x0 + 6, m.y0 + 10, m.x1 - m.x0 - 12, 18);
          R.textC(ctx, note.text, 108, m.y0 + 14, R.PAL.PINK, 2);
        }
      }
      var rt = view.doorRattle;
      if (typeof rt === 'number' && tNow >= rt && tNow - rt < RATTLE_T) {
        var dx = [1, -1, 1, 0, -1, 1][Math.floor((tNow - rt) * 24) % 6];
        if (dx) {
          var x0 = R.GEO.lane.xb0 - 4 + 10, y0 = R.GEO.front.y0 + 3 + R.TOP;
          ctx.drawImage(canvas, x0, y0, 34, 15, x0 + dx, y0, 34, 15);
        }
      }
    }

    /* ── clock, render, loop ──────────────────────────────────────── */
    var tNow = 0, simT = 0, STEP = 1 / 120, trailTick = 0;
    // advance the sim to time t in fixed steps (the same t sequence gives the same pixels)
    function advance(t) {
      while (simT + STEP <= t + 1e-9) {
        simT += STEP;
        tNow = simT;
        if (ballActive()) {
          P.step(state.ball, STEP);
          var ev;
          while (state.ball && (ev = state.ball.events.shift())) onPhysicsEvent(ev);
          // the flight trail samples at 60 Hz of sim time, whatever the display rate
          if (state.ball && (++trailTick & 1) === 0) {
            var q = P.pose(state.ball);
            if (q.phase === 'flight') {
              var pq = R.project(q.x, q.y, q.z);
              state.trail.push({ x: pq.sx, y: pq.sy, t: tNow });
              if (state.trail.length > 24) state.trail.shift();
            }
          }
        }
        tickGame();
      }
      tNow = Math.max(tNow, t);
    }

    // the drums roll to every new score, starting when it changes
    function setScore(s) {
      game.score = s;
      if (s === view.score) return;
      view.drum = { from: view.score, to: s, t0: tNow };
      view.score = s;
    }

    function render() {
      // nine balls a nickel: the ball on the line during an ATTRACT drag comes out of the rack
      if (game.mode === 'attract') view.ballsLeft = drag ? BALLS - 1 : BALLS;
      var split = !!(R.drawLiveUnder && R.drawLiveOver);
      prepView();
      R.drawFrame(ctx, tNow);
      if (split) R.drawLiveUnder(ctx, tNow, view);   // holes, glow, drums, eyes, rack
      ctx.save();
      ctx.translate(0, R.TOP);
      drawBallLayer();
      drawThrowLine();
      drawDust();
      ctx.restore();
      if (split) R.drawLiveOver(ctx, tNow, view);    // the lift ball, tickets, payout card
      else R.drawLive(ctx, tNow, view);
      ctx.save(); ctx.translate(0, R.TOP); drawToast(); drawMachineNotes(); ctx.restore();
      R.text(ctx, STAMP, 3, R.H - 8, R.PAL.FOG, 1); // build stamp, bottom-left
    }

    var dead = false, hostPaused = false, hiddenPaused = false, lastNow = null, clock = 0, rafId = 0;
    function frame(now) {
      if (dead) return;
      rafId = root.requestAnimationFrame(frame);
      if (hostPaused || hiddenPaused) { lastNow = null; return; }
      if (lastNow === null) lastNow = now;          // resume: no catch-up burst
      clock += Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      advance(clock);
      render();
    }
    function onVisibility() {
      hiddenPaused = document.hidden;
      if (!hiddenPaused) lastNow = null;
      syncMute();
    }
    // sound is off while paused or hidden, and whenever the player muted it (M)
    var userMuted = false;
    function syncMute() {
      view.muted = userMuted;
      if (audio && audio.setMuted) { try { audio.setMuted(userMuted || hostPaused || hiddenPaused); } catch (e) { } }
    }
    document.addEventListener('visibilitychange', onVisibility);

    fit();
    root.addEventListener('resize', fit);
    // a dpr change (zoom, another monitor) or a stage resize without a window resize
    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { fit(); }) : null;
    if (ro) ro.observe(container);
    var dprMq = null;
    function watchDpr() {
      if (!root.matchMedia) return;
      if (dprMq) dprMq.removeEventListener('change', onDpr);
      dprMq = root.matchMedia('(resolution: ' + (root.devicePixelRatio || 1) + 'dppx)');
      dprMq.addEventListener('change', onDpr);
    }
    function onDpr() { fit(); watchDpr(); }
    watchDpr();
    toAttract();
    var qm = /[?&]mode=(attract|play|payout)/.exec(search);
    if (qm && qm[1] !== 'attract') forceMode(qm[1]);
    if (!HARNESS) rafId = root.requestAnimationFrame(frame);

    function forceMode(m) {
      if (!MODES[m]) return false;
      if (m === 'attract') toAttract();
      else if (m === 'play') startGame();
      else gameOver();
      return true;
    }

    var audio = null;
    var handle = {
      VERSION: VERSION,
      view: view,
      throwBall: function (power, aim, spin, x0) { return throwPower(power, aim, spin, x0); },
      getState: function () {
        return {
          mode: game.mode, score: game.score, ball: game.n, ballsLeft: view.ballsLeft,
          phase: state.ball ? state.ball.phase : 'idle',
          tokens: A ? A.tokens.get() : null, scrip: A ? A.scrip.get() : null,
          highScore: view.highScore
        };
      },
      getPose: currentPose,
      onEvent: function (fn) {
        listeners.push(fn);
        return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
      },
      pause: function () { hostPaused = true; syncMute(); },
      resume: function () { hostPaused = false; lastNow = null; syncMute(); },
      destroy: function () {
        dead = true;
        if (rafId) root.cancelAnimationFrame(rafId);
        if (audio && audio.destroy) { try { audio.destroy(); } catch (e) { } }
        root.removeEventListener('resize', fit);
        if (ro) ro.disconnect();
        if (dprMq) dprMq.removeEventListener('change', onDpr);
        root.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisibility);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onCancel);
        canvas.removeEventListener('lostpointercapture', onCancel);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.remove();
        document.documentElement.classList.remove('skeeball-playing');
        listeners = [];
      }
    };

    if (HARNESS) {
      var H = handle.harness = {
        canvas: canvas,
        events: ring,
        // own the clock: advance the sim and the animation time
        stepTo: function (t) { advance(t); return tNow; },
        render: function () { render(); return tNow; },
        // feed the ball layer without physics: a contract pose, a function
        // t → pose, a trail array [{t, …pose}], or null to clear
        setBall: function (p) { fake = p || null; state.trail = []; },
        setView: function (partial) { for (var k in partial) view[k] = partial[k]; return view; },
        setMode: forceMode,
        // tap the coin door
        coin: function () { if (game.mode !== 'attract') return false; if (!coin()) return false; startGame(); return true; },
        // a whole gesture in canvas css px [{t ms, x, y}] → mapGesture + release
        swipe: function (points) {
          if (!points || !points.length) return null;
          if (!inSwipeZone(points[0].y) || !canStartDrag()) return { gesture: null, thrown: false, refused: true };
          emit({ type: 'input', kind: 'down' });
          drag = null;
          return release(points);
        },
        // hold a drag open for pictures (points as in swipe); null lets go without throwing
        drag: function (points) { drag = points ? { id: -1, pts: points.slice(), live: false } : null; return drag ? mapGesture(points, canvas.getBoundingClientRect().height) : null; },
        gesture: function (points) { return mapGesture(points, canvas.getBoundingClientRect().height); },
        // a whole deterministic game: coin, nine throws, payout, back to attract.
        // throws[i]: {power, aim, spin, x0} | {v, aim, spin, x0} | {points}
        play: function (seed, throws) {
          if (seed != null) game.seed = seed | 0;
          throws = throws && throws.length ? throws : [{ power: MEDIUM }];
          var t = tNow, dt = 1 / 60, perBall = [];
          function run(until, limit) { var end = t + limit; while (!until() && t < end) { t += dt; advance(t); } }
          if (game.mode !== 'attract') toAttract();
          var ledger0 = A ? { tokens: A.tokens.get(), scrip: A.scrip.get() } : null;
          if (!H.coin()) return { ok: false, reason: 'no tokens', state: handle.getState() };
          for (var i = 0; i < BALLS; i++) {
            run(function () { return !view.lift || tNow - view.lift.t0 >= LIFT_T; }, 2);
            var th = throws[i % throws.length], ok;
            if (th.points) ok = H.swipe(th.points).thrown;
            else if (th.v != null) ok = requestThrow(th.x0 || 0, th.v, th.aim || 0, th.spin || 0);
            else ok = throwPower(th.power != null ? th.power : MEDIUM, th.aim || 0, th.spin || 0, th.x0 || 0);
            if (!ok) return { ok: false, reason: 'throw ' + (i + 1) + ' refused', state: handle.getState() };
            var n0 = game.ballScores.length;
            run(function () { return game.ballScores.length > n0; }, 15);
            perBall.push(game.ballScores[n0]);
          }
          var over = { score: game.score, tickets: game.tickets, hundreds: game.hundreds };
          run(function () { return game.mode === 'attract'; }, 12);
          return {
            ok: true, balls: perBall, score: over.score, tickets: over.tickets, hundreds: over.hundreds,
            t: tNow, mode: game.mode, ledgerBefore: ledger0,
            ledgerAfter: A ? { tokens: A.tokens.get(), scrip: A.scrip.get() } : null
          };
        },
        state: {
          get t() { return tNow; }, get view() { return view; }, get pose() { return currentPose(); },
          get score() { return game.score; }, get mode() { return game.mode; }, get ball() { return game.n; },
          get H() { return R.H; }, get TOP() { return R.TOP; }, get drag() { return drag; }
        }
      };
      root.__skeeEvents = ring;
    }

    // the sound module (written separately) hears everything through the
    // handle; not under the harness, whose play() fires a game in one burst
    if (!HARNESS && root.SkeeBallAudio && root.SkeeBallAudio.attach) {
      try { audio = root.SkeeBallAudio.attach(handle, canvas); } catch (e) { console.error(e); audio = null; }
      syncMute();
    }
    return handle;
  }

  var api = { mount: mount, mapGesture: mapGesture, GESTURE: GESTURE };
  root.SkeeBall = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      var el = document.getElementById('skeeball-mount');
      if (!el) return;
      root.__skeeMount = api.mount(el);
      console.log('HOLLER ROLLER ' + (el.getAttribute('data-version') || 'dev'));
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
