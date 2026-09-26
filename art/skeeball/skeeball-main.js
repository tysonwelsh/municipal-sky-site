/* HOLLER ROLLER — boot, input, game loop, cabinet API
 *
 * SkeeBall.mount(container, opts) creates the canvas, picks the internal
 * height and the crisp integer scale, reads the thumb, runs the fixed-step
 * loop over the physics (skeeball-physics.js), keeps the game
 * (ATTRACT → PLAY → PAYOUT → ATTRACT, tokens in, scrip out through Arcade
 * core) and draws the ball layer (ball, trail, chalk ghost, sink). The
 * machine's reactions are drawn by render's drawLiveUnder/drawLiveOver
 * from the `view` this file fills.
 *
 * THE THROW (PLAN-2 §4). A pointerdown anywhere on the stage below the canvas midline
 * rests the ball on the throw line under a chalk aim-ghost; the ball only
 * winds up a little under the thumb. On release, mapGesture() reads the
 * last ~90 ms of the gesture: speed → power, direction → aim, and a
 * deliberate end-of-gesture hook → english. The ball always launches from
 * the throw line. See mapGesture below for the constants.
 *
 * opts: { seed, tune (partial physics TUNE per throw), free (no tokens),
 *         onEvent(ev), harness }
 * Handle: { destroy, pause, resume,
 *           throwBall(power 0..1, aim rad, spin -1..1 [, x0]) → true | false | 'refused',
 *           getState(), onEvent(fn) → unsubscribe, harness (only with ?harness=1) }
 * Events (opts.onEvent, handle.onEvent, Arcade.emit('skeeball', ev)):
 *   every physics event (launch, wall, rim, bed, backstop, captured,
 *   gutter, stall, bounceback, rest, cage, return, timeout, done) with
 *   `ball: n` (a ball left propped on a 100 hole's lip comes out as
 *   `stuck` instead of `gutter`: no score, ball consumed), plus
 *   the rack filling after the button: rackRelease {n}, rackClack {speed, i},
 *   rackWall {speed}, rackRoll {energy} (every 100 ms while it moves),
 *   rackSettled {t}; then ballstart {n: 1}.
 *   input {kind}, mute {muted}, mode {mode}, coin, nocoin, ballstart
 *   {n, ballsLeft}, throw {x0, v, aim, spin}, jackpot, gameover {score,
 *   tickets, hundreds, best}, ticket {n}, found {tokens}, resume {n, score},
 *   tear {n} (the ticket pile torn off), and the mischief's moon / sulk / jam / unjam / possum.
 *
 * THE START: tap the coin slot (a nickel → a credit), then tap the glowing
 * button (the credit → nine balls). A swipe in ATTRACT only rattles the rack.
 * Keys: C drops a nickel, space pushes the button / throws (shift: full
 * power), ←/→ aim ±5°, M mutes.
 * ?harness=1  no rAF loop: window.__skeeMount.harness owns the clock; with
 *             it, ?mode=attract|play|payout and ?force=moon:3,sulk,jam:2
 *             preview a state (ignored without the harness)
 */
(function (root) {
  'use strict';

  /* ══ the gesture → throw mapping (pure; Node-testable) ═══════════════ */
  //
  // Speeds are in MACHINE HEIGHTS per second: css px/s ÷ the css height of
  // the 384-row machine frame at the current integer scale (R.MH·rect.height/R.H).
  // That is constant for a given scale, so the same thumb gives the same
  // throw on a tall phone, a short phone, and with the URL bar in or out.
  //
  // Power: release speed s over the last WIN_MS of the gesture, mapped
  //   v = vMin + (V_TOP − vMin) · clamp((s − SPEED_FLOOR) / (SPEED_CEIL − SPEED_FLOOR))^GAMMA
  // SPEED_FLOOR 0.15 MH/s (≈ 90 px/s on a phone): below it, v = vMin.
  // SPEED_CEIL 3.78 MH/s (≈ 2180 px/s): a hard flick saturates at V_TOP.
  // V_TOP 7.1: the documented 100 line (PLAN-2 §11: the full-power corner
  //   bank, x0 0.6, v 7.1, aim 0.12), so "as hard as you can, from the
  //   corner" IS the skill shot rather than a 1 % window under saturation.
  // GAMMA 2.0: convex, so the ordinary thumb range (≈ 500–1400 px/s,
  //   0.87–2.43 MH/s) walks the ordered ring ladder (physics round 5:
  //   v 2.3 → 3.9, 10 → 20 → 30 → 40 → 50) and only a hard flick
  //   (> 1400 px/s) goes over the top (v 3.9 → 7: 40 → 30 → 20 → 10 off
  //   the backstop, and the 100 lines from the sides).
  // Aim: the direction of the same window, screen → lane (AIM_PERSPECTIVE).
  // English: a deliberate end-of-gesture hook (the last HOOK_MS against a
  //   STRAIGHT prior window); when there is one, power and aim come from
  //   the window before the hook, so hooking doesn't also re-aim the throw.
  var GESTURE = {
    SPEED_FLOOR: 0.55, SPEED_CEIL: 5.4, GAMMA: 1.4, V_TOP: 7.1,
    MIN_NORM_CSS: 384,           // power's yardstick never drops below this (landscape: 0.5 css px per art px)
    WIN_MS: 40,                  // release window for power + aim: the hand at the moment of letting go
    AIM_MAX: 25 * Math.PI / 180, // aim clamp, on the lane (P.softAim compresses further)
    // The swipe is read on the SCREEN, the aim is on the LANE: at the throw
    // line one unit of z is 32.5 canvas rows but one unit of x is 96 px
    // (render.js laneRowAt / laneBall), so tan(lane aim) = 0.34·tan(screen
    // angle). A swipe along a line drawn on the lane throws along that line,
    // and the chalk ghost lies under the thumb.
    AIM_PERSPECTIVE: 0.34,
    HOOK_MS: 40, HOOK_PRIOR_MS: 90,
    HOOK_AIM: 20 * Math.PI / 180,  // a tail turned more than this (after a straight run) doesn't re-aim the throw
    HOOK_MIN: 35 * Math.PI / 180,  // a natural thumb arc turns less than this
    HOOK_FULL: 75 * Math.PI / 180, // a full hook
    HOOK_STRAIGHT: 10 * Math.PI / 180, // the prior window's heading spread must stay under this
    SPIN_MAX: 0.4,               // english of a full hook: moves the landing ≈ 0.16 u in the ladder
    HOOK_LATE_PX: 6, HOOK_PRIOR_PX: 8,
    TAP_PX: 8,                   // a gesture that never strays this far is a tap
    MAX_PTS: 96,                 // samples kept per drag
    SETDOWN_SPEED: 0.5, SETDOWN_MS: 150, // slower than this after this long: the ball is set down, not thrown
    MIN_TRAVEL: 12               // css px of upward travel to count as a throw
  };
  var FALLBACK_TUNE = { vMin: 2.08, vMax: 7.2 };

  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

  // speed (machine heights/s) → v
  function speedToV(s, T) {
    var G = GESTURE;
    var x = clamp((s - G.SPEED_FLOOR) / (G.SPEED_CEIL - G.SPEED_FLOOR), 0, 1);
    var power = Math.pow(x, G.GAMMA);
    var top = Math.min(T.vMax, G.V_TOP);
    return { power: power, v: T.vMin + (top - T.vMin) * power };
  }

  // points: [{t (ms), x, y (css px, y down)[, id]}], one pointer (if the
  // points carry ids, only the first point's pointer counts); machineCssH:
  // the css height of the 384-row machine frame (R.MH·rect.height/R.H).
  // → {v, aim, spin, valid, power, speed (MH/s), x0css (the pointerdown x),
  //    travel, tap, setDown, aimScreen, turn, dragAim}
  function mapGesture(points, machineCssH, tune) {
    var G = GESTURE;
    var T = tune || (root.SkeeBallPhysics && root.SkeeBallPhysics.TUNE) || FALLBACK_TUNE;
    var out = { v: T.vMin, aim: 0, spin: 0, valid: false, power: 0, speed: 0, x0css: null, travel: 0, tap: true, setDown: false, dragAim: 0 };
    if (!points || !points.length || !(machineCssH > 0)) return out;
    machineCssH = Math.max(machineCssH, G.MIN_NORM_CSS); // a tiny (landscape) machine is not a hair trigger
    var id = points[0].id, pts = [];
    for (var i = 0; i < points.length; i++) {
      var q = points[i];
      if (id != null && q.id != null && q.id !== id) continue;
      if (pts.length && q.t < pts[pts.length - 1].t) continue; // out of order
      pts.push(q);
    }
    // a phone's pointerup lands 8–16 ms after the last move, at the same
    // spot: that's the lift, not a still thumb — drop it
    if (pts.length > 2) {
      var u1 = pts[pts.length - 1], u0 = pts[pts.length - 2];
      if (Math.hypot(u1.x - u0.x, u1.y - u0.y) < 0.5 && u1.t - u0.t <= 25) pts.pop();
    }
    var n = pts.length, a = pts[0], z = pts[n - 1];
    out.x0css = a.x;                       // the ball launches where it was set down
    var minY = a.y, maxD = 0;
    for (var k = 0; k < n; k++) {
      if (pts[k].y < minY) minY = pts[k].y;
      maxD = Math.max(maxD, Math.hypot(pts[k].x - a.x, pts[k].y - a.y));
    }
    out.travel = a.y - minY;
    out.tap = maxD < G.TAP_PX;
    function lane(sx, sy) { return sy > 0 ? clamp(Math.atan(G.AIM_PERSPECTIVE * Math.tan(Math.atan2(sx, sy))), -G.AIM_MAX, G.AIM_MAX) : 0; }
    out.dragAim = lane(z.x - a.x, a.y - z.y);   // the whole drag's direction (the ghost while the thumb is down)
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

    // english first: a hook moves the power/aim window back before it
    var tEnd = z.t;
    // (a hook needs a whole straight prior window before it: ≥ 130 ms of gesture)
    if (z.t - a.t >= G.HOOK_MS + G.HOOK_PRIOR_MS) {
      var h1 = at(z.t - G.HOOK_MS), t0 = z.t - G.HOOK_MS - G.HOOK_PRIOR_MS, h0 = at(t0);
      var lx = z.x - h1.x, ly = z.y - h1.y, px = h1.x - h0.x, py = h1.y - h0.y;
      if (Math.hypot(lx, ly) >= G.HOOK_LATE_PX && Math.hypot(px, py) >= G.HOOK_PRIOR_PX) {
        var turn = Math.atan2(px * ly - py * lx, px * lx + py * ly);
        out.turn = turn;
        // the prior window must be straight: a steady arc is not a hook.
        // Headings of three equal time slices (interpolated, so pixel
        // quantization of the touch samples doesn't read as curvature)
        var hs = [], K = 3;
        for (var u = 0; u < K; u++) {
          var q0 = at(t0 + (h1.t - t0) * u / K), q1 = at(t0 + (h1.t - t0) * (u + 1) / K);
          if (Math.hypot(q1.x - q0.x, q1.y - q0.y) >= 3) hs.push(Math.atan2(q1.x - q0.x, q0.y - q1.y));
        }
        var spread = hs.length > 1 ? Math.max.apply(null, hs) - Math.min.apply(null, hs) : 0;
        out.priorSpread = spread;
        if (spread < G.HOOK_STRAIGHT && Math.abs(turn) > G.HOOK_AIM) {
          // a turned-off tail: power and aim come from before it, english only past HOOK_MIN
          tEnd = h1.t;
          var m = clamp((Math.abs(turn) - G.HOOK_MIN) / (G.HOOK_FULL - G.HOOK_MIN), 0, 1);
          if (m) out.spin = (turn < 0 ? -m : m) * G.SPIN_MAX;
        }
      }
    }

    var e = at(tEnd), tA = Math.max(a.t, tEnd - G.WIN_MS), w = at(tA), dt = (tEnd - tA) / 1000;
    if (!(dt >= 0.008)) { out.spin = 0; return out; }
    var dx = e.x - w.x, up = w.y - e.y;
    var sEnd = Math.hypot(dx, up) / dt / machineCssH;
    // POWER is the hand's fastest 40 ms going up the lane (a hand can push a
    // ball, never pull it back: whatever it slows to before lifting, the ball
    // has already left at its fastest) — the same rule the carry follows
    var s = sEnd, j0 = 0;
    for (var ii = 1; ii < n && pts[ii].t <= tEnd; ii++) {
      while (j0 < ii - 1 && pts[ii].t - pts[j0 + 1].t >= G.WIN_MS) j0++;
      var wdt = (pts[ii].t - pts[j0].t) / 1000, wup = pts[j0].y - pts[ii].y;
      if (wdt >= 0.008 && wup > 0 && (pts[ii].t - pts[j0].t >= G.WIN_MS || j0 === 0)) {
        var ws = Math.hypot(pts[ii].x - pts[j0].x, wup) / wdt / machineCssH;
        if (ws > s) s = ws;
      }
    }
    out.speed = s; out.speedEnd = sEnd;
    // a throw goes up the lane and ends going up (or stopped): pulling back down is no throw
    out.valid = out.travel >= G.MIN_TRAVEL && up > -0.5 && s > 0;
    // a slow release after a real dwell: the player set the ball down to aim
    if (sEnd < G.SETDOWN_SPEED && s < G.SETDOWN_SPEED * 2 && z.t - a.t > G.SETDOWN_MS) { out.valid = false; out.setDown = true; }
    // a thumb held still at the end has no window direction: use the whole gesture's
    var ax = dx, ay = up;
    if (Math.hypot(dx, up) < 3) { ax = z.x - a.x; ay = a.y - z.y; }
    out.aimScreen = ay > 0 ? Math.atan2(ax, ay) : 0;
    out.aim = lane(ax, ay);
    var sv = speedToV(s, T);
    out.power = sv.power; out.v = sv.v;
    if (!out.valid) out.spin = 0;
    return out;
  }

  /* ══ the cabinet ═════════════════════════════════════════════════════ */
  // The machine keeps a few secrets (EGGS.md). Each is one switch.
  var EGGS = {
    thirteen: true,   // 1 a score that is a multiple of 13
    sneeze: true,     // 2 three taps on the possum's nose, in ATTRACT
    plaque: true,     // 3 a long press on the stained plinth
    coinReturn: true, // 4 the coin return (a token once; a dime, once ever, on a moon)
    perfect: true,    // 5 nine 50s
    sigh: true,       // 6 three gutters in a row
    pity: true,       // 7 a score of 0
    moonNight: true,  // 8 a real full moon tonight (read at mount, never in the sim)
    moths: true       // 9 three minutes of ATTRACT, untouched
  };
  var NAMES = ['PAWPAW', 'BURL', 'ZEKE', null];   // the possum trying on names; null: the title again
  // within ±12 h of a full moon, local clock (mean synodic month from the 2000-01-06 18:14 UTC new moon)
  function fullMoonTonight(ms) {
    var SYN = 29.530588853, day = 86400000, epoch = Date.UTC(2000, 0, 6, 18, 14);
    var age = ((ms - epoch) / day) % SYN; if (age < 0) age += SYN;
    return Math.abs(age - SYN / 2) <= 0.5;
  }
  var MODES = { attract: 1, play: 1, payout: 1 };
  var BALLS = 9, DUST_T = 0.15, NOTE_T = 1.6, RIM_TICK_T = 3 / 60, GLIDE_T = 0.25;
  // the economy (WORLD.md): tickets = floor(score / 50) + 5 at 300 + 13 per 100
  var TICKET_PER = 50, BONUS_AT = 300, BONUS = 5, PER_HUNDRED = 13;
  function ticketsFor(score, hundreds) {
    return Math.floor(score / TICKET_PER) + (score >= BONUS_AT ? BONUS : 0) + PER_HUNDRED * (hundreds | 0);
  }
  var CRANK_PER = 0.12, CRANK_MAX = 4, PAYOUT_HOLD = 2, FF_HOLD = 0.5; // s per ticket, cap, linger, fast-forward hold
  var REFILL = 5;                // the nickel found in the coin return
  var SEED0 = 1913;
  var MEDIUM = 0.3;              // keyboard / default power: v 3.6, a straight throw into the stack

  // ?force=moon:5,sulk:3,jam,lean:0.1 → opts.mischiefForce (harness/preview)
  function parseForce(search) {
    var m = /[?&]force=([^&]*)/.exec(search || '');
    if (!m) return undefined;
    var f = {};
    decodeURIComponent(m[1]).split(',').forEach(function (kv) {
      var p = kv.split(':'); if (!p[0]) return;
      f[p[0]] = p.length > 1 ? +p[1] : true;
    });
    return f;
  }

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
    // to R.H_MAX) to fill the stage at that scale — the extra rows are room.
    function fit() {
      var dpr = root.devicePixelRatio || 1;
      var availW = container.clientWidth * dpr;
      var availH = container.clientHeight * dpr;
      var scale = Math.max(1, Math.floor(Math.min(availW / R.W, availH / R.H_MIN)));
      // H in steps of 8 rows, so the iOS URL bar's dvh wobble doesn't rebuild the layers
      var rows = Math.max(R.H_MIN, Math.floor(availH / scale / 8) * 8);
      if (R.setHeight(rows) || canvas.height !== R.H || !R.staticLayer) {
        canvas.height = R.H;
        R.buildStatic();
      }
      ctx.imageSmoothingEnabled = false;
      canvas.style.width = (R.W * scale / dpr) + 'px';
      canvas.style.height = (R.H * scale / dpr) + 'px';
      // placed on whole device pixels (flex centring can land on a half pixel)
      canvas.style.marginLeft = (Math.max(0, Math.floor((availW - R.W * scale) / 2)) / dpr) + 'px';
      canvas.style.marginTop = (Math.max(0, Math.floor((availH - R.H * scale) / 2)) / dpr) + 'px';
      rectCache = null;
      if (HARNESS) render();
    }

    // one-way geometry check: the drawn machine against the physics' GEO
    var bad = R.checkGeometry(P.GEO);
    if (bad.length) console.warn('HOLLER ROLLER: physics GEO differs from the drawn machine:\n  ' + bad.join('\n  '));

    /* ── state ─────────────────────────────────────────────────────── */
    var game = {
      mode: 'attract', score: 0, n: 0, hundreds: 0, tickets: 0, ballScores: [],
      // the game seed: fixed for the harness (opts.seed / H.play(seed)); otherwise
      // derived from the save at each startGame, so visitors get different machines
      seed: (opts.seed | 0) || SEED0, fixedSeed: opts.seed != null, games: 0,
      payoutT0: 0, ticketsCranked: 0, crankPer: 0.12
    };
    var state = {
      ball: null,          // the physics throw in play
      toast: null,         // {x, y, text, t0, pink} floating score
      trail: [],           // recent airborne screen points {x, y, t}
      rerack: null         // {x, z, t0}: a refused ball gliding home to the throw line
    };
    // what the machine shows; drawLive reads it (see render.js for fields)
    var view = {
      mode: 'attract', score: 0, highScore: 0, ballsLeft: BALLS,
      ticketsOut: 0, cranking: false, hundreds: 0, holeGlow: [0, 0],
      lift: null, jackpot: null, wideT0: null,
      doorRattle: null, marqueeNote: null
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
    // Events a listener raises while one is being delivered (the mischief's
    // `jam` from a `ticket`) queue behind it, so the stream stays in order.
    var emitQ = [], emitting = false;
    function emit(ev) {
      emitQ.push(ev);
      if (emitting) return;
      emitting = true;
      try {
        while (emitQ.length) {
          var e = emitQ.shift();
          if (HARNESS) { ring.push(e); if (ring.length > 64) ring.shift(); }
          for (var i = 0; i < listeners.length; i++) {
            try { listeners[i](e); } catch (x) { console.error(x); } // a bad listener never stops the machine
          }
          if (A) A.emit('skeeball', e);
        }
      } finally { emitting = false; }
    }
    function subscribe(fn) {
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    }

    // the derangement layer (skeeball-mischief.js): lean, moon, sulk, jam, tilt
    var mis = null;
    // egg 8: the real sky, read once here (never inside the sim or the mischief)
    if (opts.moonTonight == null) opts.moonTonight = EGGS.moonNight && !HARNESS && fullMoonTonight(Date.now());
    if (root.SkeeBallMischief && opts.mischief !== false) {
      mis = root.SkeeBallMischief.attach({
        seed: game.seed, view: view, physics: P, tune: opts.tune,
        flags: A ? A.flags : null,
        now: function () { return tNow; }, emit: emit, on: subscribe
      }, { rates: opts.mischief || {}, force: opts.mischiefForce || (HARNESS ? parseForce(search) : undefined),
           moonTonight: !!opts.moonTonight });
    }

    /* ── the game ──────────────────────────────────────────────────── */
    function setMode(m) {
      game.mode = m; view.mode = m;
      view.releaseZ = m === 'play' ? 2.4 : null;       // the chalk release line (CARRY.Z_RELEASE)
      // a hard scroll lock while a game is running (the stage already refuses touch scrolling)
      document.documentElement.classList.toggle('skeeball-playing', m === 'play');
      if (m === 'play' && !HARNESS) { // don't lock the page with the machine half off-screen
        var r = container.getBoundingClientRect(), vh = root.innerHeight || 0;
        if (r.top < -1 || r.bottom > vh + 1) try { container.scrollIntoView({ block: 'end' }); } catch (e) { }
      }
      emit({ type: 'mode', mode: m });
    }
    function toAttract() {
      drag = null;
      clearOpen();
      view.highScore = stats().best || 0;
      view.ballsLeft = BALLS; view.lift = null;
      view.rack = []; view.gateOpen = false; state.fill = null; state.rackX = []; // an empty trough until the button
      view.ticketsOut = 0; view.cranking = false; view.hundreds = 0;
      view.ticketTag = null; view.newBest = false;
      if (view.marqueeNote && view.marqueeNote.text === 'NEW BEST') view.marqueeNote = null;
      game.n = 0;
      state.attractSince = tNow;
      setMode('attract');
      hint();                          // the chalk note comes in at full strength
      if (A && !FREE && A.tokens.get() <= 0) noTokens();
    }
    // an empty pocket: the door rattles and the marquee says so, then the
    // machine finds a nickel in its own coin return (WORLD.md, PLAN-2 §11)
    var FIND_T = 1.5;
    function noTokens() {
      view.doorRattle = tNow;
      view.marqueeNote = { text: 'NO TOKENS', t0: tNow, until: tNow + NOTE_T };
      if (state.findAt == null) state.findAt = tNow + FIND_T;
    }
    function findNickel() {
      state.findAt = null;
      if (!A || FREE || A.tokens.get() > 0) return;
      A.tokens.add(REFILL, 'skeeball-return');
      A.flags.set('skeeball.found-a-nickel');
      emit({ type: 'found', tokens: A.tokens.get() });
    }

    // a game in progress survives a reload / tab eviction: no lost nickels
    function saveOpen() {
      if (!A || game.mode !== 'play') return;
      var st = stats();
      st.open = { open: true, n: game.n, score: game.score, ballsLeft: view.ballsLeft, hundreds: game.hundreds,
        ballScores: game.ballScores.slice(), games: game.games, seed: game.seed };
      A.persist();
    }
    function clearOpen() {
      if (!A) return;
      var st = stats();
      if (st.open) { delete st.open; A.persist(); }
    }
    function resumeGame(o) {
      game.seed = o.seed | 0 || game.seed; game.games = (o.games | 0) || 1;
      game.hundreds = o.hundreds | 0; game.ballScores = (o.ballScores || []).slice();
      if (mis) mis.gameStart((game.seed * 1000003 + game.games * 7919) | 0);
      state.ball = null; state.toast = null;
      view.hundreds = game.hundreds; view.jackpot = null;
      setMode('play');
      setScore(o.score | 0);
      var rn = clamp(o.n | 0, 1, BALLS);
      state.rackX = packedRack(BALLS - rn + 1);          // the balls still to come, packed at once
      startBall(rn);
      emit({ type: 'resume', n: game.n, score: game.score });
    }
    /* ── the start: drop a nickel, then push the button ─────────────── */
    // The chalk on the lane says what the machine wants next, and a nudge
    // (a swipe or a bare button press) makes it breathe in again at full strength.
    function hint() {
      view.chalkText = state.perfectChalk ? 'PERFECT' : state.credited ? 'PUSH THE BUTTON' : 'DROP A NICKEL';
      view.attractT0 = tNow;
    }
    // the coin slot: one nickel buys one credit (a second one isn't eaten)
    function insertCoin() {
      if (game.mode !== 'attract') return false;
      if (state.credited) { emit({ type: 'input', kind: 'coin-ignored' }); return false; }
      if (!coin()) return false;
      setCredit(true);
      view.coinDrop = tNow;
      hint();
      return true;
    }
    // the glowing button: releases the balls if there's a credit
    function pressButton() {
      if (game.mode !== 'attract') return false;
      view.buttonPress = tNow;
      var had = !!state.credited;
      emit({ type: 'button', credited: had });
      if (!had) { hint(); return false; }
      setCredit(false);
      view.chalkText = null;
      startGame();
      return true;
    }
    // the credit survives a reload (a paid nickel is never lost)
    function setCredit(on) {
      state.credited = on;
      view.credit = on ? { t0: tNow } : null;
      if (A) { var st = stats(); if (on) st.credit = true; else delete st.credit; A.persist(); }
    }
    // a swipe in ATTRACT: no credit, no throw — the rack rattles, the chalk says why
    function nudge() {
      view.rackRattle = tNow;
      emit({ type: 'input', kind: 'nudge' });
      hint();
    }

    // take a nickel from the pocket; false (door rattles, NO TOKENS) if it's empty
    function coin() {
      if (!FREE && !A.tokens.spend(1, 'skeeball')) {
        noTokens();
        emit({ type: 'nocoin' });
        return false;
      }
      emit({ type: 'coin', tokens: A ? A.tokens.get() : null });
      return true;
    }
    function startGame() {
      if (!game.fixedSeed) {
        var sd = stats();
        game.seed = (SEED0 * 1000003 + (sd.games | 0) * 7919 + (sd.lifetimeScore | 0)) | 0;
      }
      setScore(0); game.hundreds = 0; game.ballScores = []; game.games++;
      state.perfectChalk = false; view.pityTicket = false; view.thirteen13 = null;
      state.touched = false; state.readySince = null;   // the grab cue waits for the first ball to sit untouched
      if (mis) mis.gameStart((game.seed * 1000003 + game.games * 7919) | 0);
      state.ball = null; state.toast = null;
      view.hundreds = 0; view.jackpot = null; view.ticketsOut = 0; view.cranking = false;
      view.ticketCount = 0;             // the counter starts over with the new game (the pile doesn't)
      setMode('play');
      startFill();                     // the nine balls roll into the trough; ball 1 lifts when they settle
    }

    /* ── the rack: nine balls roll in from the left when the button is pushed ── */
    // Trough geometry from render (troughRect; until it's exported, the
    // front panel's trough: x 14 … 202 in the machine frame), ball radius 5.
    var RACK_R = 5, RELEASE_EVERY = 0.16, RACK_V0 = 75, ROLL_EVERY = 0.1;
    function trough() {
      if (R.troughRect) { var t = R.troughRect(); return { x0: t.x, x1: t.x + t.w }; }
      return { x0: 14, x1: 202 };
    }
    function startFill() {
      var K = root.SkeeBallRack, tr = trough();
      state.rackX = [];
      view.rack = [];
      view.ballsLeft = BALLS;
      if (!K) { state.rackX = packedRack(BALLS); view.rack = state.rackX.slice(); startBall(1); return; }
      var seed = (game.seed * 1000003 + game.games * 6007) | 0;
      state.fill = {
        rack: K.createRack({ x0: tr.x0, x1: tr.x1, r: RACK_R, seed: seed, count: BALLS }),
        n: 0, tNext: tNow, tRoll: tNow,
        v0: RACK_V0 * (1 + 0.15 * (2 * K.hash01(seed, 99) - 1))   // this game's gate push, ±15 %
      };
      view.gateOpen = true;
    }
    function packedRack(n) {
      var tr = trough(), K = root.SkeeBallRack, P = 2 * RACK_R + 1, out = [];
      if (K) return K.packed(tr.x1, RACK_R, n);
      for (var i = 0; i < n; i++) out.push(tr.x1 - RACK_R - (n - 1 - i) * P);
      return out;
    }
    // on the sim clock, every step while the rack fills
    function tickFill() {
      var f = state.fill, K = root.SkeeBallRack;
      if (f.n < BALLS && tNow >= f.tNext - 1e-9) {
        K.release(f.rack, tNow, f.v0);
        f.n++; f.tNext += RELEASE_EVERY;
        emit({ type: 'rackRelease', n: f.n });
        if (f.n === BALLS) view.gateOpen = false;      // the gate shuts behind the ninth
      }
      K.step(f.rack, STEP);
      var ev;
      while ((ev = f.rack.events.shift())) emit(ev);
      view.rack = f.rack.balls.map(function (b) { return b.x; });
      if (tNow - f.tRoll >= ROLL_EVERY - 1e-9) {        // the rumble, while anything moves
        f.tRoll = tNow;
        var en = K.energy(f.rack);
        if (en >= 2) emit({ type: 'rackRoll', energy: +en.toFixed(1) });
      }
      if (f.rack.settled) {
        state.fill = null;
        view.gateOpen = false;
        state.rackX = view.rack.slice();
        emit({ type: 'rackSettled', t: +(f.rack.tSettled - f.rack.t0).toFixed(3) });
        startBall(1);
      }
    }
    function startBall(n) {
      game.n = n;
      state.readyX = 0;                 // the next ball sits in the middle of the throw line
      view.ballsLeft = BALLS - n;
      // the lift takes the leftmost ball of the pack; the rest stay put
      var fromX = state.rackX && state.rackX.length ? state.rackX.shift() : null;
      view.rack = state.rackX ? state.rackX.slice() : [];
      view.lift = { t0: tNow, fromX: fromX };
      emit({ type: 'ballstart', n: n, ballsLeft: view.ballsLeft });
      saveOpen();
    }
    // busy while a ball is out, or a refused one is still gliding home
    function ballActive() { return !!(state.ball && state.ball.phase !== 'done'); }
    function ballReady() { return !ballActive() && !state.rerack && !state.setdown; }
    function ballSeed() { return (game.seed * 1000003 + game.games * 131 + game.n * 17) | 0; }

    // every throw goes through here: from a swipe, the keyboard or the API
    function requestThrow(x0, v, aim, spin, z0) {
      if (game.mode === 'payout') {
        if (!payoutDone()) fastForward();
        else toAttract();                 // after the crank: back to the machine, no auto-nickel
        return false;
      }
      if (game.mode === 'attract') { nudge(); return false; } // drop a nickel, push the button first
      if (!ballReady() || game.n < 1) return false;
      x0 = clamp(+x0 || 0, -CARRY.X_MAX, CARRY.X_MAX);
      z0 = clamp(+z0 || 0, 0, CARRY.PUSH_MAX_Z);
      // the machine may lean, widen the holes (moon) or refuse the ball (sulk)
      var mv = mis ? mis.beforeThrow(game.n, { x0: x0, v: v, aim: aim || 0, spin: spin || 0 }) : {};
      state.refused = !!mv.refuse;
      if (mv.refuseV) v = Math.min(v, mv.refuseV);
      var tune = mv.tuneOverride ? Object.assign({}, opts.tune, mv.tuneOverride) : (opts.tune || null);
      state.throwTune = tune;
      state.ball = P.createThrow(x0, v, aim || 0, spin || 0, ballSeed(), tune, z0);
      state.throwT = tNow;
      state.trail = []; state.cap = null; state.rimTick = null; state.pendingJackpot = null; state.cameHome = false;
      view.lift = null;                   // the throw cuts any lift still under way
      if (state.refused) return 'refused'; // sent back: no `throw` event, the ball is not consumed
      emit({ type: 'throw', x0: +x0.toFixed(4), z0: +z0.toFixed(4), v: +(state.throwEventV != null ? state.throwEventV : v).toFixed(4), aim: +(aim || 0).toFixed(4), spin: +(spin || 0).toFixed(4), ball: game.n, carried: !!state.carriedThrow });
      return true;
    }
    function throwPower(power, aim, spin, x0) {
      var T = P.TUNE;
      return requestThrow(x0 || 0, T.vMin + (T.vMax - T.vMin) * clamp(+power || 0, 0, 1), aim, spin);
    }

    function onPhysicsEvent(ev) {
      ev.ball = game.n;
      if (state.refused) { // the sulk: the same ball comes back to the rack, nothing scores
        ev.refused = true;
        if (ev.type === 'captured') return;
        if (ev.type === 'done') {
          emit(ev);
          state.refused = false;
          // the ball rolls home: glide it from where it is to the throw line
          // (no rack lift); it is ready again when it gets there
          var lp0 = state.ball ? P.pose(state.ball) : { x: 0, z: 0 };
          state.rerack = { x: lp0.x, z: Math.max(0, lp0.z), t0: tNow };
          return;
        }
      }
      // a ball propped on a 100 hole's lip (result 'stuck') is taken back
      // with no score: a gutter for the game, its own event for the sound
      if (ev.type === 'gutter' && state.ball && state.ball.result && state.ball.result.kind === 'stuck')
        ev = { type: 'stuck', t: ev.t, ball: game.n };
      var lp = state.ball ? P.pose(state.ball) : null;
      if ((ev.type === 'return' || ev.type === 'bounceback') && !state.refused) state.cameHome = true;
      if (ev.type === 'done' && state.cameHome && !(ev.score > 0)) {
        // it rolled home, but it counted: say so where it stopped
        var ph = lp ? R.project(lp.x, lp.y, lp.z) : R.project(0, U.BALL_R, 0);
        state.toast = { x: ph.sx, y: ph.sy - 10, t0: tNow, text: '0', kind: 'zero' };
      }
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
        // the digital counter shows the tickets earned so far, live
        view.ticketCount = ticketsFor(game.score, game.hundreds);
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
        ballOutcome(ev.score || 0);
        if (game.mode !== 'play') return;
        if (game.n < BALLS) startBall(game.n + 1);
        else gameOver();
      }
    }

    function gameOver() {
      var s = game.score, prevBest = stats().best || 0;
      var n = ticketsFor(s, game.hundreds);
      game.extraHold = 0;
      var eggs = [];
      if (EGGS.thirteen && s > 0 && s % 13 === 0) {              // egg 1: the thirteen
        n += 13; game.extraHold = 2.5;
        view.thirteen13 = { t0: tNow, count: 13 };
        setFlag('skeeball.thirteen'); eggs.push({ type: 'thirteen', score: s });
      }
      if (EGGS.pity && s === 0) {                                 // egg 7: the pity ticket
        n = 1; view.pityTicket = true;
        setFlag('skeeball.pity-ticket'); eggs.push({ type: 'pity' });
      }
      if (EGGS.perfect && game.ballScores.length >= BALLS && game.ballScores.every(function (b) { return b === 50; })) { // egg 5
        view.eyesNeon = true; state.perfectChalk = true; view.chalkText = 'PERFECT'; view.attractT0 = tNow;
        setFlag('skeeball.perfect'); eggs.push({ type: 'perfect' });
      }
      game.tickets = n;
      if (A && n > 0) A.scrip.add(n, 'skeeball');
      if (A) {
        var st = stats();
        st.games++; st.best = Math.max(st.best || 0, s);
        st.lifetimeScore += s; st.hundreds += game.hundreds; st.tickets += n;
        delete st.open;
        A.persist();
      }
      game.payoutT0 = tNow; game.ticketsCranked = 0; game.holdUntil = 0;
      view.ticketTag = n;
      view.newBest = s > prevBest && s > 0;
      if (view.newBest) view.marqueeNote = { text: 'NEW BEST', t0: tNow, until: Infinity }; // lettered until ATTRACT
      game.crankPer = n > 0 ? Math.min(CRANK_PER, CRANK_MAX / n) : 0;
      view.ticketsOut = 0; view.cranking = n > 0;
      view.hundreds = game.hundreds;
      view.ballsLeft = 0; view.lift = null;
      view.highScore = Math.max(view.highScore || 0, s);
      setMode('payout');
      if (eggs.length) view.ticketCount = n;
      emit({ type: 'gameover', score: s, tickets: n, hundreds: game.hundreds, best: view.newBest });
      for (var ei = 0; ei < eggs.length; ei++) emit(eggs[ei]);
    }
    function setFlag(k) { if (A && A.flags) A.flags.set(k); }
    /* ── the eggs that live outside the payout ─────────────────────── */
    // egg 6: three gutters (gutter, stuck or a ball that rolled home) in a row; a capture resets it
    function ballOutcome(score) {
      if (!EGGS.sigh) return;
      state.gutters = score > 0 ? 0 : (state.gutters | 0) + 1;
      if (state.gutters >= 3) { state.gutters = 0; view.eyeRoll = { t0: tNow }; emit({ type: 'sigh' }); }
    }
    // egg 2: three taps on the nose within 2 s, in ATTRACT
    function noseTap() {
      if (!EGGS.sneeze || game.mode !== 'attract') return false;
      var taps = state.noseTaps = (state.noseTaps || []).filter(function (t) { return tNow - t <= 2; });
      taps.push(tNow);
      if (taps.length < 3) return false;
      state.noseTaps = [];
      state.nameIx = ((state.nameIx == null ? -1 : state.nameIx) + 1) % NAMES.length;
      var name = NAMES[state.nameIx];
      view.sneeze = { t0: tNow };
      if (name) view.marqueeNote = { text: name, t0: tNow, until: tNow + 2 };
      else if (view.marqueeNote && NAMES.indexOf(view.marqueeNote.text) >= 0) view.marqueeNote = null;
      setFlag('skeeball.sneezed');
      emit({ type: 'sneeze', name: name || 'HOLLER ROLLER' });
      return true;
    }
    // egg 4: the coin return
    function moonNow() { return !!(state.forceMoon || (mis && mis.isMoon && mis.isMoon())); }
    function coinReturn() {
      if (!EGGS.coinReturn) return null;
      var found = null;
      if (A && A.inventory && moonNow() && !A.inventory.has('mercury-dime')) {
        A.inventory.grant('mercury-dime', { unique: true }); found = 'dime';      // silent: no toast, no marquee
      } else if (A && !A.flags.get('skeeball.checked-the-return')) {
        A.tokens.add(1, 'skeeball-return'); found = 'token';
      }
      setFlag('skeeball.checked-the-return');
      view.returnFlap = { t0: tNow, coin: found };
      emit({ type: 'coinreturn', found: found });
      return found;
    }
    // egg 3: the plaque — a long, still press on the plinth (checked on the sim clock)
    var PLAQUE_HOLD = 3, PLAQUE_RISE = 0.6, PLAQUE_STILL = 6;
    function tickPlaque() {
      var pq = view.plaque;
      if (drag && drag.plinth && !drag.carry && EGGS.plaque) {
        var d0 = drag.pts[0], dl = drag.pts[drag.pts.length - 1];
        if (Math.hypot(dl.x - d0.x, dl.y - d0.y) >= PLAQUE_STILL) drag.plinth = false;
        else if (!pq && tNow - drag.tDown >= PLAQUE_HOLD) {
          view.plaque = { t0: tNow, k: 0 }; drag.plaqueShown = true; setFlag('skeeball.saw-the-plaque'); emit({ type: 'plaque', k: 'rise' });
        } else if (pq && !pq.sinking) pq.k = Math.min(1, (tNow - pq.t0) / PLAQUE_RISE);
      } else if (pq && !pq.sinking) {                  // let go: it sinks back
        pq.sinking = true; pq.t1 = tNow; pq.k1 = pq.k; emit({ type: 'plaque', k: 'sink' });
      }
      if (pq && pq.sinking) { pq.k = Math.max(0, pq.k1 * (1 - (tNow - pq.t1) / PLAQUE_RISE)); if (pq.k <= 0) view.plaque = null; }
    }
    // egg 9: the moths, after three minutes of ATTRACT untouched; any input scatters them
    var MOTHS_T = 180;
    function noteInput() {
      state.lastInput = tNow;
      if (view.moths) { view.moths = null; emit({ type: 'mothsGone' }); }
    }
    function tickMoths() {
      if (!EGGS.moths || view.moths || game.mode !== 'attract') return;
      var since = Math.max(state.lastInput || 0, state.attractSince || 0);
      if (tNow - since >= MOTHS_T) { view.moths = { t0: tNow }; emit({ type: 'moths' }); }
    }
    // the eggs' hit areas (render's rects; nothing until they exist)
    function inRect(pt, r, pad) {
      if (!r) return false;
      var m = toMachine(pt.x, pt.y); pad = pad || 0;
      return m.x >= r.x - pad && m.x <= r.x + r.w + pad && m.y >= r.y - pad && m.y <= r.y + r.h + pad;
    }
    function onNose(pt) { return EGGS.sneeze && R.noseRect && inRect(pt, R.noseRect(), 3); }
    function onPlinth(pt) { return EGGS.plaque && R.plinthRect && inRect(pt, R.plinthRect(), 0); }
    // the flap sits under the coin door: where their tap margins overlap, the nearer one wins
    function nearerCoinDoor(pt) {
      if (!onCoinDoor(toMachine(pt.x, pt.y))) return false;
      var m = toMachine(pt.x, pt.y), d = R.coinDoorRect(), f = R.returnFlapRect();
      return Math.hypot(m.x - (d.x + d.w / 2), m.y - (d.y + d.h / 2)) <= Math.hypot(m.x - (f.x + f.w / 2), m.y - (f.y + f.h / 2));
    }
    function onReturnFlap(pt) { return EGGS.coinReturn && R.returnFlapRect && inRect(pt, R.returnFlapRect(), 3); }
    function crankDone() { return game.ticketsCranked >= game.tickets && !(mis && mis.crankHeld()); }
    function payoutDone() { return crankDone() && tNow >= game.holdUntil; }
    // a touch during the crank: whack a jam, or run the rest of the tickets out at once
    function fastForward() {
      if (mis && mis.crankHeld()) { emit({ type: 'input', kind: 'whack' }); return; }
      if (crankDone()) return;
      // run the strip out at once — unless the dispenser jams on the way
      while (game.ticketsCranked < game.tickets && !(mis && mis.crankHeld())) {
        game.ticketsCranked++;
        printTicket();
        emit({ type: 'ticket', n: game.ticketsCranked, fast: true });
      }
      game.payoutT0 = tNow - game.ticketsCranked * game.crankPer;
      view.ticketsOut = game.ticketsCranked; view.cranking = false;
      game.holdUntil = tNow + FF_HOLD;
    }

    /* ── the ticket pile: printed tickets hang there, round after round,
     * until torn off. view.ticketCount is this round's count (the digital
     * counter); view.ticketPile is everything printed and not yet torn,
     * kept in the save (the paper is still hanging there after a reload).
     * Scrip was already credited at the payout: tearing is cosmetic. */
    var TEAR_T = 0.3;
    function setPile(n) {
      view.ticketPile = n;
      if (A) { var st = stats(); st.pile = n; A.persist(); }
    }
    function printTicket() {
      setPile((view.ticketPile | 0) + 1);
    }
    function pileRect() {
      if (R.pileRect) return R.pileRect();
      var sr = R.slotRect(); return { x: sr.x - 4, y: sr.y, w: sr.w + 8, h: R.MH + (R.BOT || 0) - sr.y }; // under the ticket window
    }
    function onPile(pt) {
      var m = toMachine(pt.x, pt.y), r = pileRect();
      return m.x >= r.x - 4 && m.x <= r.x + r.w + 4 && m.y >= r.y - 4 && m.y <= r.y + r.h + 4;
    }
    function canTear() {
      return (view.ticketPile | 0) > 0 && state.tearAt == null && !(mis && mis.crankHeld()) &&
        !(game.mode === 'payout' && game.ticketsCranked < game.tickets);   // not while the crank is running
    }
    function tear() {
      if (!canTear()) return false;
      state.tearAt = tNow; view.tearT0 = tNow;
      emit({ type: 'tear', n: view.ticketPile | 0 });
      return true;
    }

    // timers that live on the sim clock (deterministic under the harness)
    function tickGame() {
      if (state.findAt != null && tNow >= state.findAt) findNickel();
      if (state.fill) tickFill();
      tickPlaque(); tickMoths();
      if (state.tearAt != null && tNow - state.tearAt >= TEAR_T) { state.tearAt = null; setPile(0); }
      if (state.setdown && tNow - state.setdown.t0 >= CARRY.SETDOWN_T) { state.readyX = state.setdown.x; state.setdown = null; }
      // the sulk: the possum's eyes stay narrowed until the refused ball is home
      if (state.refused || state.rerack) view.narrowT0 = tNow;
      if (state.rerack && tNow - state.rerack.t0 >= GLIDE_T) {
        state.rerack = null;
        var NT = root.SkeeBallMischief && root.SkeeBallMischief.CONST ? root.SkeeBallMischief.CONST.NARROW_T : 3;
        view.narrowT0 = tNow - NT + 0.4;        // reopen a beat after it's back
        emit({ type: 'ballstart', n: game.n, ballsLeft: view.ballsLeft, rerack: true });
        saveOpen();
      }
      if (mis) {
        mis.tick(tNow);
        // a jammed dispenser holds the crank and the walk back to ATTRACT
        if (mis.crankHeld()) { game.payoutT0 += STEP; view.cranking = false; return; }
      }
      if (game.mode !== 'payout') return;
      var n = game.tickets, e = tNow - game.payoutT0;
      var out = n > 0 ? Math.min(n, e / game.crankPer) : 0;
      while (game.ticketsCranked < Math.floor(out + 1e-9) && !(mis && mis.crankHeld())) {
        game.ticketsCranked++;
        printTicket();
        emit({ type: 'ticket', n: game.ticketsCranked });
      }
      view.ticketsOut = out;
      view.cranking = out < n;
      if (e >= n * game.crankPer + PAYOUT_HOLD + (game.extraHold || 0)) toAttract();
    }

    /* ── input ─────────────────────────────────────────────────────── */
    canvas.style.touchAction = 'none';
    function toMachine(cx, cy) { // canvas css px → machine frame (the rect cached per gesture)
      var r = crect();
      return { x: cx * R.W / r.width, y: cy * R.H / r.height - R.TOP };
    }
    function laneX(mx) { return clamp((mx - 108) / (108 - R.GEO.lane.xb0), -0.85, 0.85); }
    // Tap targets are the painted rects plus a margin (8 art px = 12 css px
    // at phone scale) so both are comfortable thumbs; the slot and the
    // button sit side by side, so where the margins overlap the nearer one wins.
    var HIT_PAD = 8, BUTTON_PAD_R = 14;   // the button has open panel to its right
    function buttonRect() {
      if (R.buttonRect) return R.buttonRect();
      var fr = R.GEO.front; return { x: 46, y: fr.y0 + 3, w: 15, h: 15 }; // (render's, until it's exported)
    }
    function padded(d, padR) { return { x0: d.x - HIT_PAD, x1: d.x + d.w + (padR || HIT_PAD), y0: d.y - HIT_PAD, y1: d.y + d.h + HIT_PAD, cx: d.x + d.w / 2 }; }
    function inBox(m, b) { return m.x >= b.x0 && m.x <= b.x1 && m.y >= b.y0 && m.y <= b.y1; }
    function startTarget(m) {
      var d = padded(R.coinDoorRect()), b = padded(buttonRect(), BUTTON_PAD_R);
      var inD = inBox(m, d), inB = inBox(m, b);
      if (inD && inB) return Math.abs(m.x - d.cx) <= Math.abs(m.x - b.cx) ? 'coin' : 'button';
      return inD ? 'coin' : inB ? 'button' : null;
    }
    function onCoinDoor(m) { return startTarget(m) === 'coin'; }
    function onButton(m) { return startTarget(m) === 'button'; }
    function slotRect() { return R.slotRect(); }
    // a tap on the jammed slot (or the strip under it) is a whack
    function jammedSlotHit(pt) {
      if (!mis || !mis.crankHeld()) return false;
      var m = toMachine(pt.x, pt.y), sr = slotRect();
      return m.x >= sr.x - 6 && m.x <= sr.x + sr.w + 6 && m.y >= sr.y - 6 && m.y <= sr.y + sr.h + 24;
    }
    // the lower half: below the canvas midline, including the stage band under it
    function inSwipeZone(cy) { return cy >= crect().height / 2; }
    // css height of the 384-row machine frame at this integer scale (power's yardstick)
    function machineCssH() { var r = crect(); return R.MH * r.height / R.H; }
    function canStartDrag() { return !(game.mode === 'play' && !ballReady()); }
    function inactive() { return dead || hostPaused || hiddenPaused; } // paused cabinets take no input

    // a finished gesture (pointer or harness): tap, throw, or nothing
    function release(pts) {
      if (inactive()) return { gesture: null, thrown: false, refused: true };
      var g = mapGesture(pts, machineCssH());
      var thrown = false;
      if (game.mode === 'payout') {
        if (g.tap && jammedSlotHit(pts[0])) emit({ type: 'input', kind: 'whack' });
        else if (!payoutDone()) fastForward();
        else if (tNow >= game.holdUntil) toAttract();    // any tap or swipe after the crank
      } else if (game.mode === 'attract') {
        var m = toMachine(pts[0].x, pts[0].y);
        if (g.tap && onCoinDoor(m)) insertCoin();
        else if (g.tap && onButton(m)) pressButton();
        else if (g.valid) nudge();
      } else if (g.valid) {
        thrown = requestThrow(laneX(toMachine(g.x0css, 0).x), g.v, g.aim, g.spin);
      }
      if (game.mode === 'play' || thrown) puffGhost(pts, g);
      return { gesture: g, thrown: thrown };
    }

    /* ── THE CARRY: the ball stays under your thumb until you throw it ──
     * A pointerdown on the resting ball (its sprite ± GRAB_CSS; also while it
     * is still lifting — the hand waits for it) picks it up.
     *
     * IN THE HAND the thumb sets a target on the lane (its lane point, grab
     * offset kept) and the ball rolls toward it at up to max(vL, V_HAND):
     * it sits under a slow thumb, lags a quicker one, stops under a stopped
     * one, and never gets ahead of a thumb that is down. Pulling back rolls
     * it back to the throw line; it can't be carried past Z_RELEASE (the
     * chalk line). The roll sound follows the ball's own speed.
     *
     * A FLICK throws it: the moment the thumb's speed UP THE LANE over the
     * last 40 ms passes FLICK_UP, the ball leaves from where it is — struck,
     * at max(its own speed, 0.6·vL) — and while the thumb stays in contact
     * (within PUSH_NEAR css px of the ball, or PUSH_T after the leave) the
     * hand's launch speed vL pushes it up, ×1.35 per 1/60 s at most. On the
     * lift the throw is settled (power: the hand's fastest 40 ms up the
     * lane; aim: the swing's chord; english: curl + wrist, from the swing
     * since its last pause or corner) and any speed still owed arrives
     * within 2 frames. A lift without a flick sets the ball down where it is
     * — under the thumb — and it rolls back to the line: nothing is spent. */
    var CARRY = {
      Z_RELEASE: 2.4,          // the ball can't be carried past here (render's chalk line: view.releaseZ)
      X_MAX: 0.89,             // |x| ≤ 1 − r (the rails)
      GRAB_CSS: 14,            // the ball's sprite ± this many css px picks it up
      SETDOWN_T: 0.4,          // a set-down ball rolls back to the line over this long
      SPEED_MS: 40,            // the hand's speed: the last 40 ms
      V_HAND: 2.2,             // u/s: the ball rolls toward the thumb at up to max(vL, this) — no faster than
                               // the gentlest throw, so a roll never hands a flick more power than the hand gives it
      FLICK_UP: 1.0,           // MH/s up the lane (≈ 580 css px/s on a phone): a flick throws the ball
      RAMP: 1.35,              // the pushed ball's speed grows at most ×1.35 per 1/60 s
      STRIKE: 0.6,             // …starting at no less than 0.6·vL (a struck ball, not a towed one)
      PUSH_NEAR: 20, PUSH_T: 0.12,             // the hand pushes only in contact: this close (css px), or this soon after the leave
      PUSH_MAX_T: 0.6, PUSH_MAX_Z: 3.1,        // after this long / this far the throw is settled
      FLOOR_K: 1.15,           // a real throw at least reaches the hop, with this margin
      PAUSE: 0.3,              // MH/s: slower than this, the thumb has paused (the swing starts after it)
      ENG_LATE: 40,                            // ms: the wrist's last move before the release
      AIM_ARC: 0.6, AIM_DEAD: 3,               // aim: chord60 − 0.6·curl; under 3° (screen) is straight (see chordAim)
      LIFT_UP: 0.6,                            // MH/s up the lane at the lift: a gentle lift of a rolling ball throws it
      EASE_T: 0.08,                            // s: the ball's last approach to the thumb eases (speed ∝ gap / this)
      FLICK_MIN: 21, FLICK_FULL: 46,           // ° the last 40 ms before the lift turn off the swing's line
      CURL_MIN: 22, CURL_FULL: 44,             // ° the swing's second half turns off its first
      W_FLICK: 0.6, W_CURL: 0.5, SPIN_MAX: 1   // blend and cap (→ the physics' ±1)
    };
    var DEG = Math.PI / 180;
    view.releaseZ = null;
    // machine frame → css px (the inverse of toMachine), and the css px per art px
    function cssK() { return crect().height / R.H; }
    function lifting() { return !!(view.lift && tNow - view.lift.t0 < R.LIFT_T); }
    // the resting ball on the throw line, machine frame
    function readyBall() {
      var p = R.project(state.readyX || 0, U.BALL_R, 0);
      return { sx: p.sx, sy: p.sy, r: ballPx(p.scale) };
    }
    function onReadyBall(pt) {
      if (game.mode !== 'play' || !ballReady() || game.n < 1 || fake || state.fill) return false;
      var m = toMachine(pt.x, pt.y), b = readyBall(), k = cssK();
      return Math.hypot(m.x - b.sx, m.y - b.sy) <= b.r + CARRY.GRAB_CSS / k;
    }
    // THE LANE UNDER A POINT: the machine-frame sprite centre (sx, sy) of a
    // ball rolling on the lane → its lane position {x, z} (z unclamped, may
    // be < 0). R.project isn't invertible in closed form (foreshortened rows,
    // stepped half-widths), so z is found by bisection on the sprite row,
    // which falls monotonically with z, and x from the half-width there.
    function laneAt(sx, sy) {
      var lo = -0.6, hi = U.Z_CREST;
      for (var i = 0; i < 32; i++) {
        var mid = (lo + hi) / 2;
        if (R.project(0, U.BALL_R, mid).sy > sy) lo = mid; else hi = mid;
      }
      var z = (lo + hi) / 2, c = R.project(0, U.BALL_R, z).sx, e = R.project(1, U.BALL_R, z).sx;
      return { x: (sx - c) / ((e - c) || 1), z: z };
    }
    // the lane's own slowing (lean + rolling), for the "reaches the hop" floor
    function vFloor(z) {
      var T = P.TUNE, a = (T.rollK || 5 / 7) * ((T.laneLean || 0) + (T.crrLane || 0) * (T.g || 0));
      return CARRY.FLOOR_K * Math.sqrt(Math.max(0, 2 * a * (U.Z_HOP - z)));
    }
    // css px per lane unit (up the lane) at z, for screen-speed limits
    function cssPerUnit(z) {
      var a = R.project(0, U.BALL_R, Math.max(0, z)), b = R.project(0, U.BALL_R, Math.max(0, z) + 0.05);
      return Math.max(1, (a.sy - b.sy) / 0.05 * cssK());
    }
    function mhCss() { return Math.max(machineCssH(), GESTURE.MIN_NORM_CSS); }
    // the hand's speed over the last SPEED_MS of pts (MH/s): total, and up the lane only
    function handWin(pts) {
      var n = pts.length; if (n < 2) return null;
      var z = pts[n - 1], i = n - 2;
      while (i > 0 && z.t - pts[i].t < CARRY.SPEED_MS) i--;
      var a = pts[i], dt = (z.t - a.t) / 1000;
      return dt > 0 ? { a: a, z: z, dt: dt } : null;
    }
    function handSpeed(pts) { var w = handWin(pts); return w ? Math.hypot(w.z.x - w.a.x, w.z.y - w.a.y) / w.dt / mhCss() : 0; }
    function handUp(pts) { var w = handWin(pts); return w ? (w.a.y - w.z.y) / w.dt / mhCss() : 0; }
    function launchV(s, z) {
      var v = speedToV(s, P.TUNE).v;
      return P.vForLadder ? P.vForLadder(z, v) : v;
    }
    // the swing: the thumb path since its last pause, corner or backward
    // move before the end. A sideways slide, a hold or a wind-up before the
    // flick is not part of the throw (a curl turns gradually: no corner).
    function swing(pts) {
      var n = pts.length; if (n < 3) return pts;
      var H = mhCss(), i = n - 1, hPrev = null, end = n, started = false;
      while (i > 0) {
        var j = i - 1; while (j > 0 && pts[i].t - pts[j].t < 24) j--;
        var dt = (pts[i].t - pts[j].t) / 1000; if (!(dt > 0)) { i = j; continue; }
        var dx = pts[i].x - pts[j].x, up = pts[j].y - pts[i].y, sp = Math.hypot(dx, up) / dt / H, h = Math.atan2(dx, up);
        if (!started && (up <= 0 || sp < CARRY.PAUSE)) { end = j + 1; i = j; continue; } // the tail after the swing (a hooked-over or stopped finish)
        started = true;
        if (sp < CARRY.PAUSE || up < 0) break;                               // a pause, or a move back down the lane
        if (hPrev != null && Math.abs(Math.atan2(Math.sin(h - hPrev), Math.cos(h - hPrev))) > 60 * DEG) break; // a corner
        hPrev = h; i = j;
      }
      var out = started ? pts.slice(Math.max(0, i), Math.max(end, i + 2)) : pts.slice();
      out.full = started ? pts.slice(Math.max(0, i)) : pts;       // (english reads the whole finish, hook and all)
      return out;
    }
    // the swing's aim, on the lane (screen → lane: AIM_PERSPECTIVE):
    //  - a straight-intended swing: the chord over its first 60 %, less 0.6 of
    //    its curl (a thumb's natural pivot arc curls its own chord off the
    //    line it meant), and anything under 3° is straight — so a natural
    //    arc throws straight and a deliberate diagonal keeps its angle; a
    //    bow whose whole chord is straight (< 4°) throws straight;
    //  - a deliberate curl: its opening line (the first 30 %), so it leaves
    //    along the line it started on and hooks the way it bent (start right,
    //    aim left of the 40, bend it in);
    //  blended by how far the swing curls (20° → 30° of curl).
    function chordAt(pts, frac) {
      var n = pts.length, len = 0, cum = [0];
      for (var i = 1; i < n; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(len); }
      var k = 1; while (k < n - 1 && cum[k] < len * frac) k++;
      var dx = pts[k].x - pts[0].x, up = pts[0].y - pts[k].y;
      return up > 2 ? Math.atan2(dx, up) / DEG : 0;
    }
    function chordAim(pts) {
      if (pts.length < 2) return 0;
      var sc = swingCurl(pts), a = chordAt(pts, 0.6) - CARRY.AIM_ARC * sc;
      // a bow that comes back to its line (the whole chord straight) was meant straight too
      if (Math.abs(chordAt(pts, 1)) < CARRY.AIM_DEAD + 1) a = 0;
      var straight = Math.abs(a) < CARRY.AIM_DEAD ? 0 : a, opening = chordAt(pts, 0.3);
      var curl = Math.abs(sc), w = clamp((curl - 20) / 10, 0, 1);
      var ang = straight * (1 - w) + opening * w;
      return clamp(Math.atan(GESTURE.AIM_PERSPECTIVE * Math.tan(ang * DEG)), -GESTURE.AIM_MAX, GESTURE.AIM_MAX);
    }
    // the swing's curl: its second half's heading against its first (°, by length)
    function swingCurl(pts) {
      var n = pts.length; if (n < 3) return 0;
      var len = 0, cum = [0];
      for (var i = 1; i < n; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(len); }
      var k = 1; while (k < n - 1 && cum[k] < len / 2) k++;
      var a = pts[0], mid = pts[k], z = pts[n - 1], ax = mid.x - a.x, ay = mid.y - a.y, bx = z.x - mid.x, by = z.y - mid.y;
      return Math.atan2(ax * by - ay * bx, ax * bx + ay * by) / DEG;
    }
    function carryStart(pt) {
      var m = toMachine(pt.x, pt.y), b = readyBall(), x0 = state.readyX || 0;
      state.touched = true; view.grabCue = false;
      drag.carry = { offX: b.sx - m.x, offY: b.sy - m.y, x: x0, z: 0, tx: x0, tz: 0, cap: CARRY.V_HAND,
        path: [{ t: tNow, x: x0, z: 0 }], waiting: lifting() };
      emit({ type: 'carry', kind: 'pick' });
    }
    // one thumb sample while carrying: a new target, or a flick
    function carryPoint(pt) {
      var c = drag.carry;
      drag.pts.push(pt);
      while (drag.pts.length > GESTURE.MAX_PTS) drag.pts.shift();
      if (c.pushing) { pushPoint(); return false; }         // the ball has gone; the hand may still push it
      var m = toMachine(pt.x, pt.y);
      if (c.waiting) {                                     // the ball is still lifting: the hand waits under it
        if (lifting()) return false;
        var b = readyBall(); c.waiting = false; c.offX = b.sx - m.x; c.offY = b.sy - m.y;
        drag.pts = [pt];
        return false;
      }
      var L = laneAt(m.x + c.offX, m.y + c.offY);
      c.tx = clamp(L.x, -CARRY.X_MAX, CARRY.X_MAX);
      c.tz = clamp(L.z, 0, CARRY.Z_RELEASE);
      var up = handUp(drag.pts);
      c.cap = Math.max(CARRY.V_HAND, launchV(Math.max(0, up), c.z));
      if (up >= CARRY.FLICK_UP) {                          // a flick: the ball is struck from where it is
        var vL = launchV(handSpeed(drag.pts), c.z);
        leave(Math.max(ballSpeed(c), CARRY.STRIKE * vL), vL);
      }
      return false;
    }
    // on the sim clock: the ball in the hand rolls toward the thumb's target, never past it
    function tickCarry() {
      if (!drag || !drag.carry) return;
      var c = drag.carry; if (c.pushing || c.waiting) return;
      var dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz);
      var stepMax = Math.min(c.cap, d / CARRY.EASE_T) * STEP;   // it rolls into the hand: the last few px ease in
      if (d > 1e-6) { var f = Math.min(1, stepMax / d); c.x += dx * f; c.z += dz * f; if (d < 1e-3) { c.x = c.tx; c.z = c.tz; } }
      c.path.push({ t: tNow, x: c.x, z: c.z, tx: c.tx, tz: c.tz });
      while (c.path.length > 40) c.path.shift();
    }
    // the ball's own speed in the hand (lane u/s) over the last ≥ 16 ms
    function ballSpeed(c) {
      var p = c.path, a = p[p.length - 1], b = a;
      for (var i = p.length - 2; i >= 0; i--) { b = p[i]; if (a.t - b.t >= 0.016) break; }
      return a.t > b.t ? Math.hypot(a.x - b.x, a.z - b.z) / (a.t - b.t) : 0;
    }
    // the ball leaves the hand: a live ball from where it is, at v0; the
    // throw is settled when the thumb lifts (settleCarry)
    function leave(v0, vL) {
      var c = drag.carry, aim = chordAim(swing(drag.pts));
      c.pushing = true;
      state.push = { v: v0, target: Math.max(v0, vL || 0, vFloor(c.z)), aim: aim, spin: 0, t0: tNow, latched: false, tune: opts.tune || null };
      state.ball = P.createThrow(c.x, v0, aim, 0, ballSeed(), state.push.tune, c.z);
      state.throwT = tNow; state.trail = []; state.cap = null; state.rimTick = null; state.pendingJackpot = null; state.cameHome = false;
      view.lift = null;
      emit({ type: 'carry', kind: 'leave', z: +c.z.toFixed(3), v: +v0.toFixed(3) });
    }
    // the thumb is in contact with the ball it pushes: within PUSH_NEAR css px of it, or just after the leave
    function inContact() {
      var p = state.push; if (!p || !state.ball || !drag) return false;
      if (tNow - p.t0 <= CARRY.PUSH_T) return true;
      var q = P.pose(state.ball), bp = R.project(q.x, U.BALL_R, q.z), last = drag.pts[drag.pts.length - 1];
      var m = toMachine(last.x, last.y), k = cssK();
      return Math.hypot(m.x + drag.carry.offX - bp.sx, m.y + drag.carry.offY - bp.sy) * k <= CARRY.PUSH_NEAR;
    }
    // while the thumb is down after the ball left: follow the hand's launch speed up (in contact only)
    function pushPoint() {
      var p = state.push; if (!p || p.latched || !state.ball || !inContact()) return;
      var q = P.pose(state.ball);
      p.target = Math.max(p.target, launchV(handSpeed(drag.pts), Math.max(0, q.z)));
      p.aim = chordAim(swing(drag.pts));
    }
    // on the sim clock: ramp the pushed ball toward its target
    function tickPush() {
      var p = state.push; if (!p || !state.ball) return;
      var q = P.pose(state.ball);
      if (!p.latched && drag && drag.carry && (tNow - p.t0 > CARRY.PUSH_MAX_T || q.z > CARRY.PUSH_MAX_Z)) { settleCarry(drag.pts.slice()); return; }
      if (q.phase !== 'roll') { if (p.latched) state.push = null; return; }   // it's on the hop: hands off
      var rate = p.latched ? Math.max(CARRY.RAMP, p.finishRate || 1) : CARRY.RAMP;
      var want = Math.min(p.target, p.v * Math.pow(rate, STEP * 60));
      var aimMoved = !p.latched && Math.abs(p.aim - (p.aimNow == null ? p.aim : p.aimNow)) > 0.2 * DEG;
      if (want > p.v + 1e-4 || aimMoved) {
        p.v = Math.max(p.v, want); p.aimNow = p.aim;
        state.ball = P.createThrow(q.x, p.v, p.aim, p.spin, ballSeed(), p.tune, q.z);
      }
      if (p.latched && p.v >= p.target - 1e-4) state.push = null;          // done ramping
    }
    function endCarry() { var d = drag; drag = null; rectCache = null; return d; }
    // the thumb lifts after the ball left: settle speed, aim and english
    function settleCarry(pts) {
      var p = state.push; if (!p || p.latched) return { thrown: false };
      if (drag && drag.carry) endCarry();
      pts = trimUp(pts);
      var q = P.pose(state.ball), sw = swing(pts), s = handSpeed(pts);
      var target = Math.max(p.target, vFloor(Math.max(0, q.z)));
      if (s > 0 && tNow - p.t0 <= CARRY.PUSH_T + 0.1) target = Math.max(target, launchV(s, Math.max(0, q.z)));
      var aim = chordAim(sw), spin = carryEnglish(sw.full || sw);
      // the throw proper (mischief: lean, moon, sulk), from where the ball is now, at the speed it has
      state.ball = null;
      state.carriedThrow = true; state.throwEventV = target;   // the throw's speed is where the push is heading
      var thrown = requestThrow(q.x, p.v, aim, spin, Math.max(0, q.z));
      state.carriedThrow = false; state.throwEventV = null;
      if (thrown === true && !state.refused && p.v < target) {
        // whatever speed is still owed arrives within 2 frames of the lift
        state.push = { v: p.v, target: target, aim: aim, aimNow: aim, spin: spin, t0: p.t0, latched: true, tune: state.throwTune,
          finishRate: Math.sqrt(target / p.v) };
      } else state.push = null;
      var out = { thrown: thrown, v: target, z0: q.z, spin: spin, aim: aim };
      emit({ type: 'carry', kind: 'release', z0: +Math.max(0, q.z).toFixed(3), vHand: +launchV(s, 0).toFixed(3), v: +target.toFixed(3), spin: +spin.toFixed(3), aim: +aim.toFixed(4),
        flick: state.lastEnglish && state.lastEnglish.flick, curl: state.lastEnglish && state.lastEnglish.curl });
      state.lastCarry = out;
      return out;
    }
    // a phone's pointerup lands 8–16 ms after the last move, at the same spot: not a still sample
    function trimUp(pts) {
      var n = pts.length;
      if (n > 2 && Math.hypot(pts[n - 1].x - pts[n - 2].x, pts[n - 1].y - pts[n - 2].y) < 0.5 && pts[n - 1].t - pts[n - 2].t <= 25) return pts.slice(0, n - 1);
      return pts;
    }
    // the thumb lifts with the ball still in the hand (no flick): it is set
    // down where it is — under or just behind the thumb — and rolls home
    function carryUp(pts) {
      var c = drag.carry; endCarry();
      if (c.waiting) {                                             // a flick made entirely inside the lift
        if (pts.length > 1 && Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) > 12) { view.rackRattle = tNow; emit({ type: 'input', kind: 'busy' }); }
        return { thrown: false };
      }
      pts = trimUp(pts);
      var own = ballSpeed(c), up = handUp(pts);
      if (own >= 0.8 * CARRY.V_HAND && up >= CARRY.LIFT_UP) {
        // a gentle lift of a ball still rolling in the hand: it goes, at the
        // hand's power (the swipe's rule) or its own speed, whichever is more
        var sw = swing(pts), g = mapGesture(pts, machineCssH());
        var v = Math.max(own, launchV(g.speed, c.z), vFloor(c.z)), aim = chordAim(sw), spin = carryEnglish(sw.full || sw);
        state.carriedThrow = true;
        var thrown = requestThrow(c.x, v, aim, spin, c.z);
        state.carriedThrow = false;
        emit({ type: 'carry', kind: 'release', z0: +c.z.toFixed(3), vHand: +launchV(g.speed, 0).toFixed(3), v: +v.toFixed(3), spin: +spin.toFixed(3), aim: +aim.toFixed(4),
          flick: state.lastEnglish && state.lastEnglish.flick, curl: state.lastEnglish && state.lastEnglish.curl, gentle: true });
        state.lastCarry = { thrown: thrown, v: v, z0: c.z, spin: spin, aim: aim };
        return state.lastCarry;
      }
      if (c.z > 0.02) setDown(c.x, c.z);
      state.lastCarry = { thrown: false, setDown: c.z > 0.02 };
      return state.lastCarry;
    }
    // a cancelled carry: the ball rolls back to the line (never a teleport)
    function carryCancel() {
      var d = drag, c = d.carry;
      if (c.pushing && state.push && !state.push.latched && state.ball) {   // left, but not yet thrown: call it back
        var q = P.pose(state.ball); endCarry(); state.ball = null; state.push = null;
        setDown(clamp(q.x, -CARRY.X_MAX, CARRY.X_MAX), clamp(q.z, 0, CARRY.Z_RELEASE));
        return;
      }
      endCarry();
      if (!c.waiting && c.z > 0.02) setDown(c.x, c.z);
    }
    // ENGLISH, like a bowler's wrist, from the forward swing (the thumb path
    // from its lowest point — after any wind-up — to the lift):
    //  (a) the flick: the heading of the last 40 ms before the lift against
    //      the swing's line (start → lift), a sideways turn of the wrist;
    //  (b) the curl: how far the swing turns between its first and second
    //      halves (by length), a curled arm.
    // Each has a dead zone so a straight push is 0 and a thumb's natural arc
    // (a 200–260 px radius over a 150 px swing: flick < 18°, curl < 22°)
    // gives 0; clockwise on screen (y down) hooks right (+x).
    // 0.6·flick + 0.5·curl (each 0..1 past its dead zone), capped ±1.
    function carryEnglish(pts) {
      var n = pts.length; if (n < 3) return 0;
      var lo = 0;
      for (var i = 1; i < n; i++) if (pts[i].y >= pts[lo].y) lo = i;   // the bottom of the wind-up
      var sw = pts.slice(lo), m = sw.length, z = sw[m - 1], a = sw[0];
      if (m < 3 || z.t - a.t < 60) return 0;
      var len = 0, cum = [0];
      for (i = 1; i < m; i++) { len += Math.hypot(sw[i].x - sw[i - 1].x, sw[i].y - sw[i - 1].y); cum.push(len); }
      if (len < 20) return 0;
      function atT(t) {
        if (t <= a.t) return a;
        for (var j = m - 1; j > 0; j--) if (sw[j - 1].t <= t) {
          var p0 = sw[j - 1], p1 = sw[j], f = (t - p0.t) / ((p1.t - p0.t) || 1);
          return { x: p0.x + (p1.x - p0.x) * f, y: p0.y + (p1.y - p0.y) * f };
        }
        return a;
      }
      var k = 1; while (k < m - 1 && cum[k] < len / 2) k++;
      var mid = sw[k], l0 = atT(z.t - CARRY.ENG_LATE);
      function turn(ax, ay, bx, by) { return Math.atan2(ax * by - ay * bx, ax * bx + ay * by) / DEG; }
      function ramp(v, lo2, hi2) { var r = clamp((Math.abs(v) - lo2) / (hi2 - lo2), 0, 1); return v < 0 ? -r : r; }
      var fx = z.x - a.x, fy = z.y - a.y, lx = z.x - l0.x, ly = z.y - l0.y;
      var flick = Math.hypot(lx, ly) >= 3 ? turn(fx, fy, lx, ly) : 0;
      var curl = turn(mid.x - a.x, mid.y - a.y, z.x - mid.x, z.y - mid.y);
      var e = CARRY.W_FLICK * ramp(flick, CARRY.FLICK_MIN, CARRY.FLICK_FULL) + CARRY.W_CURL * ramp(curl, CARRY.CURL_MIN, CARRY.CURL_FULL);
      state.lastEnglish = { flick: +flick.toFixed(1), curl: +curl.toFixed(1) };
      return clamp(e, -CARRY.SPIN_MAX, CARRY.SPIN_MAX);
    }
    // a slow let-go: the ball is put down and rolls back to the throw line
    function setDown(x, z) {
      state.setdown = { x: x, z: z, t0: tNow };
      emit({ type: 'setdown', x: +x.toFixed(3), z: +z.toFixed(3) });
    }
    // the synthetic pose of the ball in the hand (audio rolls it; lane u/s):
    // the ball's own motion over the last 50 ms of the sim clock, so the roll
    // sound follows what the ball does (0 once it has caught up and stopped)
    function carryPose() {
      if (!drag || !drag.carry || drag.carry.pushing || drag.carry.waiting) return null;
      var c = drag.carry, pth = c.path, a = pth[pth.length - 1], b = a;
      for (var i = pth.length - 2; i >= 0 && a.t - pth[i].t <= 0.05; i--) b = pth[i];
      var dt = a.t - b.t, vz = dt > 0 ? (a.z - b.z) / dt : 0, vx = dt > 0 ? (a.x - b.x) / dt : 0;
      // the roll sound: the ball's own speed, or half the thumb's if that is more (a faster roll sounds faster)
      if (dt > 0 && a.tz != null && b.tz != null) {
        var tz = 0.5 * (a.tz - b.tz) / dt, tx = 0.5 * (a.tx - b.tx) / dt;
        if (Math.hypot(tx, tz) > Math.hypot(vx, vz)) { vz = tz; vx = tx; }
      }
      return { phase: 'carry', x: c.x, z: c.z, y: 0, r: U.BALL_R, vz: vz, vx: vx };
    }

    // the canvas rect, cached per gesture (not per coalesced sample)
    var rectCache = null;
    function crect() { return rectCache || canvas.getBoundingClientRect(); }
    function localPt(ev) {
      var r = crect();
      return { t: ev.timeStamp, x: ev.clientX - r.left, y: ev.clientY - r.top };
    }
    function onDown(ev) {
      if (inactive()) return;
      if (ev.pointerType === 'mouse' && ev.button !== 0) return; // right/middle click: not a throw
      // a drag whose pointerup was lost (context menu, OS gesture) expires
      if (drag && (ev.pointerId === drag.id || ev.timeStamp - drag.pts[drag.pts.length - 1].t > 1000)) drag = null;
      if (drag) { emit({ type: 'input', kind: 'down' }); return; }  // one pointer at a time
      rectCache = canvas.getBoundingClientRect();
      if (pointerDown(localPt(ev), ev.pointerId)) {
        try { container.setPointerCapture(ev.pointerId); } catch (e) { }
        ev.preventDefault();
      }
    }
    // a pointer comes down at pt (canvas css px): true when a drag started
    function pointerDown(pt, id) {
      emit({ type: 'input', kind: 'down' });
      noteInput();
      if (!jammedSlotHit(pt) && onPile(pt) && canTear()) {   // the ticket pile: a tap tears it off (decided on release)
        drag = { id: id, pts: [pt], live: id !== -1, pile: true }; return true;
      }
      if (game.mode === 'attract' && onNose(pt)) { drag = { id: id, pts: [pt], live: id !== -1, egg: 'nose' }; return true; }
      if (onReturnFlap(pt) && !nearerCoinDoor(pt)) { drag = { id: id, pts: [pt], live: id !== -1, egg: 'return' }; return true; }
      var plinth = onPlinth(pt);
      if (state.fill || !canStartDrag()) {      // the rack is filling, or a ball is out
        if (plinth) { drag = { id: id, pts: [pt], live: id !== -1, egg: 'plinth', plinth: true, tDown: tNow }; return true; }
        if (!state.fill) { view.rackRattle = tNow; emit({ type: 'input', kind: 'busy' }); }  // a ball is out: the rack rattles
        return false;
      }
      // PAYOUT takes the gesture anywhere (it decides on release, never on down)
      if (game.mode !== 'payout' && !inSwipeZone(pt.y) && !plinth) return false;
      beginDrag(pt, id);
      if (plinth && !drag.carry) { drag.plinth = true; drag.tDown = tNow; }
      return true;
    }
    function beginDrag(pt, id) {
      drag = { id: id, pts: [pt], live: true };
      if (onReadyBall(pt)) carryStart(pt);      // on the ball: it's in the hand
    }
    function moveDrag(pt) {
      if (drag.egg || drag.pile) { drag.pts.push(pt); return false; }
      if (drag.carry) { var ended = carryPoint(pt); if (!ended && drag && drag.carry && drag.carry.pushing) pushPoint(); return ended; }
      drag.pts.push(pt);
      while (drag.pts.length > GESTURE.MAX_PTS) drag.pts.shift();
      return false;
    }
    function endDrag(pt) {
      var d = drag; drag = null; rectCache = null;
      if (d.plaqueShown) return { plaque: true };   // the long press was for the plaque: the lift is not a tap
      if (d.egg) {                               // the nose, the coin return, a busy-time plinth press: taps only
        var tap = Math.hypot(pt.x - d.pts[0].x, pt.y - d.pts[0].y) < GESTURE.TAP_PX;
        if (tap && d.egg === 'nose') return { egg: noseTap() };
        if (tap && d.egg === 'return') return { egg: coinReturn() };
        return { egg: false };
      }
      if (d.pile) {                              // a tap on the pile tears it; a drag off it does nothing
        d.pts.push(pt);
        var mv = Math.hypot(pt.x - d.pts[0].x, pt.y - d.pts[0].y);
        return { tore: mv < GESTURE.TAP_PX ? tear() : false };
      }
      if (d.carry) {
        drag = d;                                   // (the carry functions end it themselves)
        d.pts.push(pt);
        return d.carry.pushing ? settleCarry(d.pts) : carryUp(d.pts);
      }
      d.pts.push(pt);
      return release(d.pts);
    }
    function onMove(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      var list = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
      if (!list || !list.length) list = [ev];
      for (var i = 0; i < list.length && drag; i++) if (moveDrag(localPt(list[i]))) break; // (a carry may let go mid-list)
      ev.preventDefault();
    }
    function onUp(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      endDrag(localPt(ev));
    }
    function onCancel(ev) {
      if (!drag || ev.pointerId !== drag.id) return;
      if (drag.carry) { carryCancel(); return; }      // the ball rolls back, never teleports
      drag = null; rectCache = null;
    }
    function onContextMenu(ev) { ev.preventDefault(); } // a long-press / right-click menu would swallow the pointerup
    function onTouchMove(ev) { if (ev.cancelable) ev.preventDefault(); } // belt and braces for iOS
    // the whole stage takes input (the thumb rests on the band under the
    // machine); points are mapped through the canvas rect
    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onCancel);
    container.addEventListener('lostpointercapture', onCancel);
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('contextmenu', onContextMenu);

    // keyboard: C = drop a nickel, Space = push the button (ATTRACT) or a
    // medium straight throw (PLAY; shift: full power), ←/→ aim ±5°, M = mute
    // the keys belong to the machine only while it's on screen, the focus isn't
    // on a control, and no modifier is held (Cmd-M minimises, Space presses buttons)
    function keysAreOurs(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      var t = ev.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName) || t.isContentEditable)) return false;
      var r = container.getBoundingClientRect(), vh = root.innerHeight || 0;
      var seen = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      return r.height > 0 && seen >= r.height * 0.5;
    }
    function onKey(ev) {
      if (!keysAreOurs(ev)) return;
      noteInput();
      if (ev.key === 'm' || ev.key === 'M') {
        userMuted = !userMuted;
        syncMute();
        emit({ type: 'mute', muted: userMuted });
        return;
      }
      if (inactive()) return;
      if (ev.code === 'Space' || ev.key === ' ') {
        ev.preventDefault();
        if (ev.repeat) return;
        emit({ type: 'input', kind: 'key' });
        if (game.mode === 'attract') { pressButton(); return; }
        if (game.mode === 'payout') { if (!payoutDone()) fastForward(); else if (tNow >= game.holdUntil) toAttract(); return; }
        throwPower(ev.shiftKey ? 1 : MEDIUM, kbd.aim, 0, 0);
      } else if (ev.key === 'c' || ev.key === 'C') {
        emit({ type: 'input', kind: 'key' });
        if (game.mode === 'attract') insertCoin();
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
    function ballPx(scale) { return R.ballRadius(scale); }
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
        // english makes the scuff orbit faster (the ball is spinning)
        if (state.ball && state.ball.english && pose.phase !== 'carry' && typeof state.throwT === 'number' && !pose.synthetic)
          a += state.ball.english * 22 * (tNow - state.throwT);
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
      // "ROLL IT": the first ball of a game has sat on the line untouched for 1.5 s
      var readyNow = game.mode === 'play' && game.n >= 1 && !state.fill && ballReady() && !lifting() && !drag;
      if (readyNow && state.readySince == null) state.readySince = tNow;
      if (!readyNow) state.readySince = null;
      view.grabCue = !!(readyNow && game.n === 1 && !state.touched && tNow - state.readySince > 1.5);
      view.grabCueT0 = view.grabCue ? state.readySince + 1.5 : null;
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
        var cp = carryPose();
        var rd = game.mode === 'play' && !cp ? dragRead() : null;
        if (cp) view.ballSx = R.project(cp.x, U.BALL_R, cp.z).sx;
        else if (rd) view.ballSx = R.project(rd.x, U.BALL_R, rd.z).sx;
        else if (game.mode === 'play' && game.n >= 1) view.ballSx = 108;
      }
    }

    function drawBallLayer() {
      var pose = currentPose();
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
        if (hole100) R.drawSunkBall(ctx, c.sx, by, rc, s);
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
        if (sh.surface === 'bed') R.drawBedShadow(ctx, sh.sx, sh.sy, r * k, p.sy, r); // rim-light under the sprite's bottom row
        else R.drawBallShadow(ctx, sh.sx, sh.sy, r * 0.9 * k, sh.c, 0.4);
      }
      if (pose.phase === 'flight') drawTrail();
      var rt = state.rimTick, ticking = rt && tNow - rt.t0 < RIM_TICK_T;
      if (ticking) p = { sx: p.sx + (Math.cos(rt.angle) < 0 ? 1 : -1), sy: p.sy - 1, scale: p.scale }; // knocked a pixel off the rim
      // below the pit's mouth: the hop's crest hides it, the dark eats it
      var inPit = pose.z > U.Z_CREST && pose.z < U.Z_LIP && pose.y < R.surfY(pose.z) + br;
      if (inPit || pose.phase === 'gutter') {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, R.W, R.GEO.ramp.y0); ctx.clip();
        var depth = Math.min(1, Math.max(0, R.surfY(pose.z) + br - pose.y) * 3);
        R.drawSunkBall(ctx, p.sx, p.sy, r, depth);
        ctx.restore();
        return;
      }
      drawBallSprite(p.sx, p.sy, r, pose);
      // the rattle's picture: the struck rim ticks, over the ball
      if (ticking && rt.ring != null) R.drawRimTick(ctx, rt.ring, rt.angle, 1 - (tNow - rt.t0) / RIM_TICK_T, p.sx, p.sy, r);
    }

    // a ball rolling on the lane at (x, z), its scuff tumbling with the distance
    function drawRollingBall(x, z) {
      var p = R.project(x, U.BALL_R, z), r = ballPx(p.scale);
      R.drawContact(ctx, p.sx, p.sy, r);
      drawBallSprite(p.sx, p.sy, r, { x: x, z: z, phase: 'roll', synthetic: true });
      view.ballSx = p.sx;
    }
    // a ball resting on the lane at (x, z)
    function drawLaneBall(x, z, bob) {
      var p = R.project(x, U.BALL_R, z), r = ballPx(p.scale);
      R.drawContact(ctx, p.sx, p.sy, r);          // one LANE3 row under the resting sprite
      R.drawBall(ctx, p.sx, p.sy + (bob || 0), r);  // (bob: the grab cue's little hop)
      view.ballSx = p.sx;
    }

    // the live read of the drag: gesture so far (plus "now", so a held
    // thumb reads as no power) and the cosmetic wind-up under the thumb
    function dragRead() {
      if (!drag || drag.carry || drag.pts.length < 1) return null;
      var r = crect(), pts = drag.pts;
      if (drag.live && typeof performance !== 'undefined') {
        var last = pts[pts.length - 1], now = performance.now();
        if (now > last.t + 1) pts = pts.concat([{ t: now, x: last.x, y: last.y }]);
      }
      var g = mapGesture(pts, machineCssH());
      var a = drag.pts[0], z = drag.pts[drag.pts.length - 1];
      var rows = (a.y - z.y) * R.H / r.height;      // machine rows the thumb went up
      var laneRows = R.GEO.lane.y1 - R.GEO.lane.y0;
      var wz = clamp(rows / laneRows * U.Z_HOP * 0.35, -0.25, 0.15 * U.Z_HOP);
      var bx = laneX(toMachine(a.x, 0).x);      // the ball stays where it was set down
      // the ghost: the whole drag's direction at a fixed medium length; the
      // real power shows only while the thumb is actually flicking
      var flicking = g.speed > GHOST_FLICK;
      return { g: g, x: bx, z: wz, aim: flicking ? g.aim : g.dragAim, power: flicking ? Math.max(GHOST_POWER, g.power) : GHOST_POWER };
    }

    // the chalk aim-ghost: a worn chalk arrow in the lane; length = power,
    // angle = aim. Returns its screen pixels [x, y, strength 0..1].
    var GHOST_POWER = 0.3, GHOST_FLICK = 1.0; // the resting ghost's length; MH/s that counts as flicking
    function ghostPoints(x, z, power, aim) {
      var len = 0.4 + 2.7 * power, pts = [], z0 = z + 0.5; // starts above the ball, never under it
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
      var bx = laneX(toMachine(pts[0].x, 0).x);
      dust = { pts: ghostPoints(bx, 0, g.valid ? g.power : GHOST_POWER, g.valid ? g.aim : g.dragAim), t0: tNow };
    }

    // the ball on the throw line: the next ball, or the one under the thumb
    function drawThrowLine() {
      if (drag && drag.carry && !drag.carry.pushing) {
        if (drag.carry.waiting) return;                           // the ball is still lifting (render draws it)
        drawRollingBall(drag.carry.x, drag.carry.z); return;      // the ball is the arrow
      }
      if (state.setdown) { // put down: it rolls back to the throw line
        var ks = clamp((tNow - state.setdown.t0) / CARRY.SETDOWN_T, 0, 1), es = ks * (2 - ks);
        drawRollingBall(state.setdown.x, state.setdown.z * (1 - es));
        return;
      }
      var rd = game.mode === 'play' ? dragRead() : null; // no ball on the line until the button is pushed
      if (rd) {
        drawGhost(ghostPoints(rd.x, rd.z, rd.power, rd.aim));
        drawLaneBall(rd.x, rd.z);
        return;
      }
      if (game.mode !== 'play' || fake || ballActive() || game.n < 1) return;
      if (state.rerack) { // the refused ball rolling the last of the way home
        var k = clamp((tNow - state.rerack.t0) / GLIDE_T, 0, 1), e = k * k * (3 - 2 * k);
        drawLaneBall(state.rerack.x * (1 - e), state.rerack.z * (1 - e));
        return;
      }
      if (view.lift && tNow - view.lift.t0 < R.LIFT_T) return;
      if (tNow < kbd.until) drawGhost(ghostPoints(0, 0, MEDIUM, kbd.aim));
      drawLaneBall(state.readyX || 0, 0, view.grabCue && R.grabBob ? R.grabBob(tNow, view) : 0);
    }

    // the floating score (render draws it and owns its rise and life);
    // view.toast is the harness's way in (film.js)
    function drawToast() {
      var ts = view.toast && (!state.toast || view.toast.t0 > state.toast.t0) ? view.toast : state.toast;
      if (!ts || !ts.text || tNow < ts.t0) return;
      var kind = ts.kind || (ts.text === '100' ? 'hundred' : ts.text === '0' ? 'zero' : 'score');
      R.drawToast(ctx, ts.text, ts.x, ts.y, kind, ts.t0, tNow);
    }

    /* ── clock, render, loop ──────────────────────────────────────── */
    var tNow = 0, simT = 0, STEP = 1 / 120, trailTick = 0;
    // advance the sim to time t in fixed steps (the same t sequence gives the same pixels)
    function advance(t) {
      while (simT + STEP <= t + 1e-9) {
        simT += STEP;
        tNow = simT;
        if (drag && drag.carry) tickCarry();
        if (state.push) tickPush();
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
      if (game.mode === 'attract') view.ballsLeft = BALLS; // (the trough itself is view.rack: empty)
      prepView();
      R.drawFrame(ctx, tNow);
      R.drawLiveUnder(ctx, tNow, view);               // holes, glow, drums, eyes, rack
      ctx.save();
      ctx.translate(0, R.TOP);
      drawBallLayer();
      drawThrowLine();
      drawDust();
      ctx.restore();
      R.drawLiveOver(ctx, tNow, view);                // the lift ball, tickets, payout card
      ctx.save(); ctx.translate(0, R.TOP); drawToast(); ctx.restore();
      // build stamp, bottom-left, on its own dark plate (legible under the moon)
      if (R.stampRect) { var sr = R.stampRect(STAMP); ctx.fillStyle = R.PAL.NIGHT0; ctx.fillRect(sr.x, sr.y, sr.w, sr.h); }
      R.text(ctx, STAMP, 3, R.H - 8, R.PAL.FOG, 1);
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
      if (hiddenPaused) drag = null;
      else lastNow = null;
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
    // A reload starts the flow from the top (owner's call, 2026-09-25): the
    // open game and any waiting credit are dropped, not resumed. Pass
    // opts.resume = true to restore them instead (the code is kept for later).
    view.ticketPile = A ? (stats().pile | 0) : 0; view.ticketCount = 0;   // the paper still hanging from last time
    var open = A ? stats().open : null;   // a game the last page left running
    if (opts.resume) {
      if (A && stats().credit) { state.credited = true; view.credit = { t0: 0 }; } // a paid nickel waiting for its button
    } else if (A) {
      var st0 = stats(); var dirty = false;
      if (st0.open) { delete st0.open; dirty = true; }
      if (st0.credit) { delete st0.credit; dirty = true; }
      if (dirty) A.persist();
      open = null;
    }
    toAttract();
    if (open && open.open && opts.resume) resumeGame(open);
    var qm = HARNESS && /[?&]mode=(attract|play|payout)/.exec(search); // preview only under the harness
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
      throwBall: function (power, aim, spin, x0) { return inactive() ? false : throwPower(power, aim, spin, x0); },
      getState: function () {
        return {
          mode: game.mode, score: game.score, ball: game.n, ballsLeft: view.ballsLeft,
          phase: state.ball ? state.ball.phase : 'idle', filling: !!state.fill,
          ready: game.mode === 'play' && game.n >= 1 && !state.fill && ballReady() && !(view.lift && tNow - view.lift.t0 < R.LIFT_T),
          tokens: A ? A.tokens.get() : null, scrip: A ? A.scrip.get() : null,
          highScore: view.highScore
        };
      },
      getPose: function () { return carryPose() || currentPose(); }, // while carried: {phase:'carry', x, z, y, vz, vx, r}
      onEvent: subscribe,
      pause: function () { hostPaused = true; drag = null; syncMute(); },
      resume: function () { hostPaused = false; lastNow = null; syncMute(); },
      destroy: function () {
        dead = true;
        if (rafId) root.cancelAnimationFrame(rafId);
        if (audio && audio.destroy) { try { audio.destroy(); } catch (e) { } }
        if (mis) { try { mis.destroy(); } catch (e) { } }
        root.removeEventListener('resize', fit);
        if (ro) ro.disconnect();
        if (dprMq) dprMq.removeEventListener('change', onDpr);
        root.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisibility);
        container.removeEventListener('pointerdown', onDown);
        container.removeEventListener('pointermove', onMove);
        container.removeEventListener('pointerup', onUp);
        container.removeEventListener('pointercancel', onCancel);
        container.removeEventListener('lostpointercapture', onCancel);
        container.removeEventListener('touchmove', onTouchMove);
        container.removeEventListener('contextmenu', onContextMenu);
        canvas.remove();
        document.documentElement.classList.remove('skeeball-playing');
        listeners = [];
      }
    };

    if (HARNESS) {
      var H = handle.harness = {
        get rack() { return state.fill ? state.fill.rack : null; },   // the filling rack (null once settled)
        canvas: canvas,
        events: ring,
        mischief: mis,
        // tap the ticket slot (a whack while it's jammed)
        whack: function () { if (!mis || !mis.crankHeld()) return false; emit({ type: 'input', kind: 'whack' }); return true; },
        // own the clock: advance the sim and the animation time
        stepTo: function (t) { advance(t); return tNow; },
        render: function () { render(); return tNow; },
        // feed the ball layer without physics: a contract pose, a function
        // t → pose, a trail array [{t, …pose}], or null to clear
        setBall: function (p) { fake = p || null; state.trail = []; },
        setView: function (partial) { for (var k in partial) view[k] = partial[k]; return view; },
        setMode: forceMode,
        // tap the coin door
        tear: function () { return tear(); },
        // force each egg's condition (EGGS.md); returns what happened
        egg: function (name, arg) {
          var endWith = function (score, balls) {
            if (game.mode !== 'play') startGame();
            state.fill = null; game.ballScores = balls; setScore(score); game.hundreds = 0; state.ball = null;
            gameOver(); return { mode: game.mode, tickets: game.tickets, view: { thirteen13: view.thirteen13, pityTicket: view.pityTicket, eyesNeon: view.eyesNeon, chalkText: view.chalkText, ticketCount: view.ticketCount } };
          };
          var nine = function (v) { var a = []; for (var i = 0; i < BALLS; i++) a.push(v); return a; };
          if (name === 'thirteen') return endWith(arg || 130, [40, 30, 20, 10, 10, 10, 10, 0, 0]);
          if (name === 'perfect') return endWith(450, nine(50));
          if (name === 'zero') return endWith(0, nine(0));
          if (name === 'nose') { if (game.mode !== 'attract') toAttract(); var r = [noseTap(), noseTap(), noseTap()]; return { sneezed: r[2], note: view.marqueeNote && view.marqueeNote.text, sneeze: view.sneeze }; }
          if (name === 'plinth') { // hold still on the plinth for arg seconds, then let go
            drag = { id: -1, pts: [{ t: 0, x: 0, y: 0 }], live: false, egg: 'plinth', plinth: true, tDown: tNow };
            advance(tNow + (arg || 3.2)); var up = view.plaque && { k: view.plaque.k }; drag = null; advance(tNow + 0.05);
            return { risen: up, after: view.plaque && { k: +view.plaque.k.toFixed(3), sinking: !!view.plaque.sinking } };
          }
          if (name === 'return') return { found: coinReturn(), flap: view.returnFlap };
          if (name === 'moon') { state.forceMoon = arg !== false; return { moon: moonNow() }; }
          if (name === 'gutters') { var before = view.eyeRoll; ballOutcome(0); ballOutcome(0); ballOutcome(0); return { sighed: view.eyeRoll !== before, eyeRoll: view.eyeRoll }; }
          if (name === 'idle') { if (game.mode !== 'attract') toAttract(); noteInput(); advance(tNow + (arg || 181)); return { moths: view.moths }; }
          if (name === 'touch') { noteInput(); return { moths: view.moths }; }
          return null;
        },
        get eggs() { return EGGS; },
        // the two-step start, and the old one-call start (a nickel, then the button)
        insertCoin: function () { return insertCoin(); },
        pressButton: function () { return pressButton(); },
        coin: function () { if (game.mode !== 'attract') return false; insertCoin(); return pressButton(); },
        // a whole gesture in canvas css px [{t ms, x, y}] → mapGesture + release
        swipe: function (points) {
          if (!points || !points.length) return null;
          drag = null; rectCache = canvas.getBoundingClientRect();
          if (!pointerDown(points[0], -1)) return { gesture: null, thrown: false, refused: true };
          // the sim clock runs with the thumb (points' t in ms), so the carry's push happens as it would live
          var carried = !!(drag && drag.carry), out = null, ts = tNow, p0 = points[0].t;
          var clockTo = function (pt) { var tt = ts + (pt.t - p0) / 1000; if (tt > tNow) advance(tt); };
          for (var i = 1; i < points.length - 1 && drag; i++) { clockTo(points[i]); if (drag) moveDrag(points[i]); }
          clockTo(points[points.length - 1]);
          if (drag) out = endDrag(points[points.length - 1]);
          else out = state.lastCarry || { thrown: true };
          if (out) out.carried = carried;
          return out;
        },
        // a carry held open (for pictures): pick up at points[0], move through the rest, don't let go
        hold: function (points) {
          drag = null; rectCache = canvas.getBoundingClientRect();
          beginDrag(points[0], -1);
          var ts = tNow, p0 = points[0].t;
          for (var i = 1; i < points.length && drag; i++) { var tt = ts + (points[i].t - p0) / 1000; if (tt > tNow) advance(tt); if (drag) moveDrag(points[i]); }
          return drag ? carryPose() || { swipe: true } : state.lastCarry;
        },
        letGo: function (pt) { return drag ? endDrag(pt || drag.pts[drag.pts.length - 1]) : null; },
        // one pointer event at a time (canvas css px, t in ms): the clock advances with t
        down: function (pt) { drag = null; rectCache = canvas.getBoundingClientRect(); H._t0 = pt.t; H._ts = tNow; beginDrag(pt, -1); return drag && drag.carry ? 'carry' : 'swipe'; },
        move: function (pt) { var tt = H._ts + (pt.t - H._t0) / 1000; if (tt > tNow) advance(tt); if (drag) moveDrag(pt); return drag ? (drag.carry && drag.carry.pushing ? 'pushing' : 'hand') : 'gone'; },
        up: function (pt) { var tt = H._ts + (pt.t - H._t0) / 1000; if (tt > tNow) advance(tt); return drag ? endDrag(pt) : state.lastCarry; },
        laneAt: function (sx, sy) { return laneAt(sx, sy); },
        readyBall: function () { var b = readyBall(), k = cssK(); return { x: b.sx * k, y: (b.sy + R.TOP) * k, r: b.r * k }; },
        // hold a drag open for pictures (points as in swipe); null lets go without throwing
        drag: function (points) { drag = points ? { id: -1, pts: points.slice(), live: false } : null; return drag ? mapGesture(points, machineCssH()) : null; },
        gesture: function (points) { return mapGesture(points, machineCssH()); },
        // a whole deterministic game: coin, nine throws, payout, back to attract.
        // throws[i]: {power, aim, spin, x0} | {v, aim, spin, x0} | {points}
        play: function (seed, throws) {
          if (seed != null) { game.seed = seed | 0; game.fixedSeed = true; }
          throws = throws && throws.length ? throws : [{ power: MEDIUM }];
          var t = tNow, dt = 1 / 60, perBall = [], refused = 0;
          function run(until, limit) { var end = t + limit; while (!until() && t < end) { t += dt; advance(t); } }
          if (game.mode !== 'attract') toAttract();
          var ledger0 = A ? { tokens: A.tokens.get(), scrip: A.scrip.get() } : null;
          if (!H.coin()) return { ok: false, reason: 'no tokens', state: handle.getState() };
          for (var i = 0; i < BALLS; i++) {
            run(function () { return !state.fill && (!view.lift || tNow - view.lift.t0 >= R.LIFT_T); }, 8); // the fill, then the lift
            var th = throws[i % throws.length], ok;
            if (th.points) ok = H.swipe(th.points).thrown;
            else if (th.v != null) ok = requestThrow(th.x0 || 0, th.v, th.aim || 0, th.spin || 0);
            else ok = throwPower(th.power != null ? th.power : MEDIUM, th.aim || 0, th.spin || 0, th.x0 || 0);
            if (ok === 'refused') { // the sulk: same ball, back in the rack; it doesn't count
              refused++;
              run(function () { return !state.refused && !state.rerack && (!view.lift || tNow - view.lift.t0 >= R.LIFT_T); }, 12);
              i--; continue;
            }
            if (!ok) return { ok: false, reason: 'throw ' + (i + 1) + ' refused', state: handle.getState() };
            var n0 = game.ballScores.length;
            run(function () { return game.ballScores.length > n0; }, 15);
            perBall.push(game.ballScores[n0]);
          }
          var over = { score: game.score, tickets: game.tickets, hundreds: game.hundreds };
          run(function () { return game.mode === 'attract'; }, 20); // a jam frees itself in 6 s
          return {
            ok: true, balls: perBall, refused: refused, score: over.score, tickets: over.tickets, hundreds: over.hundreds,
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

  var api = { mount: mount, mapGesture: mapGesture, speedToV: speedToV, GESTURE: GESTURE };
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
