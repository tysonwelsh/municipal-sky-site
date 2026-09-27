/* MOTHER LODE — boot, input, loop (STUB; the integration phase owns this file next)
 *
 * ════════════════════════ THE RENDER CONTRACT ════════════════════════
 * pachinko-render.js defines
 *
 *   window.PachinkoRender = {
 *     GLASS_W: 320, GLASS_H: 416,     // the diorama (board space), fixed
 *     CAB_W, CAB_H,                    // the whole cabinet, ≤ 376 × 560
 *     GLASS_X, GLASS_Y,                // the glass interior's origin inside the cabinet
 *     build(board),                    // pre-render the static layers for this layout;
 *                                      // called at boot and again after every drift edit
 *     draw(ctx, view)                  // draw one frame
 *   }
 *
 * THE CAMERA (art-1 request, adopted). main.js sizes the screen canvas to
 * the stage in DEVICE pixels and hands it to draw(). The renderer fills
 * ctx.canvas with the camera rect: the whole cabinet at k = 0, lerped to
 * PachinkoRender.PLAY_RECT (cabinet px; default the glass + 3 px) at k = 1,
 * extending the shorter axis to the canvas aspect (never stretching).
 * main.js also computes that camera for you in view.cam = {k, s, x, y, w, h}:
 * s = device px per cabinet px (an INTEGER at rest, eased in between),
 * x, y, w, h = the visible rect in cabinet px. The simplest renderer does
 *   ctx.setTransform(s, 0, 0, s, -x * s, -y * s)  and draws the cabinet.
 * Input maps back with PachinkoRender.toGlass(canvasX, canvasY, view) if it
 * exists (canvas px → glass/board {x, y}), else with view.cam.
 * Board space maps to cabinet space as (GLASS_X + x, GLASS_Y + y).
 * Board space = the glass interior, 320 × 416 px, origin top-left, y down —
 * the same space as the physics (pachinko-physics.js) and the layout
 * (pachinko-board.js).
 *
 * view = {
 *   mode: 'attract' | 'play',        // (payout | work later)
 *   t,                               // seconds, the sim clock (deterministic under ?harness=1)
 *   cam: { k, s, x, y, w, h },       // k 0 = whole cabinet … 1 = dived into the glass (eased);
 *                                    // s, x, y, w, h: see THE CAMERA
 *   board,                           // the current layout (PachinkoBoard; see its header)
 *   marbles: [{ x, y, r, spin, id, phase }],   // board space; phase 'tunnel' marbles are hidden
 *                                    // (tunnel: {from, to, k 0..1} for a light behind the rock)
 *   hopper: { x, ghostX },           // the hopper's x on its rail, the hover ghost (null if none)
 *   figures: [],                     // the tommyknockers (filled by the knockers phase)
 *   fx: {},                          // lights, mischief, whistle, lode (filled later)
 *   hits: [{ id, t, speed }],        // recent contacts (last ~0.4 s): pins can flash / wobble
 *   score, marblesLeft
 * }
 * Kinematic parts: PachinkoBoard.pose(fixture, view.t) → the cart's bucket
 * {pose:{x,y,tilt,dumping}, pts, segs} or a wheel's {angle, omega, segs}.
 *
 * If PachinkoRender is absent or throws, main.js draws the debug view
 * instead (also forced with ?debug=1; ?debug=2 draws it over the art).
 * The legend: board.legend = [{n, text, scratched?, ref, slot?}]; slots
 * carry {legend, label, value}. Regions: board.regions (and every fixture's
 * `region`). Decor (ladders, lamps, specimens…): board.decor.
 * ═════════════════════════════════════════════════════════════════════
 *
 * ?harness=1  no rAF loop: window.__pachinko.harness owns the clock
 *             { stepTo(t), render(), state, drop(x), world, setMode(m), view }
 * ?seed=N     the physics seed; ?mode=play starts dived in
 */
(function (root) {
  'use strict';

  var FALLBACK = { GLASS_W: 320, GLASS_H: 416, CAB_W: 376, CAB_H: 560, GLASS_X: 28, GLASS_Y: 92 };
  var STEP = 1 / 120;
  var DIVE_T = 0.7;
  var MARBLES = 13;

  function mount(container, opts) {
    opts = opts || {};
    var search = (root.location && root.location.search) || '';
    var HARNESS = opts.harness || /[?&]harness=1/.test(search);
    var dm = /[?&]debug=(\d)/.exec(search);
    var DEBUG = opts.debug != null ? opts.debug : dm ? +dm[1] : 0;
    var sm = /[?&]seed=(-?\d+)/.exec(search);
    var seed = opts.seed != null ? opts.seed | 0 : sm ? +sm[1] : 1;

    var PB = root.PachinkoBoard, PP = root.PachinkoPhysics;
    var R = root.PachinkoRender && typeof root.PachinkoRender.draw === 'function' ? root.PachinkoRender : null;
    var G = R ? { GLASS_W: 320, GLASS_H: 416, CAB_W: R.CAB_W | 0 || FALLBACK.CAB_W, CAB_H: R.CAB_H | 0 || FALLBACK.CAB_H, GLASS_X: R.GLASS_X != null ? R.GLASS_X : FALLBACK.GLASS_X, GLASS_Y: R.GLASS_Y != null ? R.GLASS_Y : FALLBACK.GLASS_Y } : {};
    if (!R) for (var fk in FALLBACK) G[fk] = FALLBACK[fk];
    G.PLAY_RECT = (R && R.PLAY_RECT) || { x: G.GLASS_X, y: G.GLASS_Y - 3, w: G.GLASS_W, h: G.GLASS_H + 6 };

    var board = PB.base();
    var world = PP.createWorld(board, seed);
    var renderOK = !!R;
    if (R && R.build) { try { R.build(board); } catch (e) { renderOK = false; warn('build', e); } }

    // the cabinet canvas (logical) and the screen canvas (device px)
    var cab = document.createElement('canvas'); cab.width = G.CAB_W; cab.height = G.CAB_H;
    var cctx = cab.getContext('2d'); cctx.imageSmoothingEnabled = false;
    var canvas = document.createElement('canvas');
    canvas.className = 'pachinko-canvas';
    canvas.setAttribute('aria-label', 'MOTHER LODE, a pachinko machine');
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    var view = {
      mode: 'attract', t: 0, cam: { k: 0, x: 0, y: 0, w: G.CAB_W, h: G.CAB_H }, board: board,
      marbles: [], hopper: { x: 160, ghostX: null }, figures: [], fx: {}, hits: [], score: 0, marblesLeft: MARBLES
    };
    var game = { mode: 'attract', diveT0: -10, diveDir: 0 };
    var ring = [];

    /* ── fit: device px, the two rest scales ─────────────────────── */
    var devW = 1, devH = 1, sA = 1, sP = 1;
    function fit() {
      var dpr = root.devicePixelRatio || 1;
      devW = Math.max(1, Math.round(container.clientWidth * dpr));
      devH = Math.max(1, Math.round(container.clientHeight * dpr));
      canvas.width = devW; canvas.height = devH;
      canvas.style.width = (devW / dpr) + 'px'; canvas.style.height = (devH / dpr) + 'px';
      sA = Math.max(1, Math.floor(Math.min(devW / G.CAB_W, devH / G.CAB_H)));
      sP = Math.max(sA, Math.floor(Math.min(devW / G.PLAY_RECT.w, devH / G.PLAY_RECT.h)));
      ctx.imageSmoothingEnabled = false;
      if (HARNESS) render();
    }
    // the crop rect (cabinet px) and scale for a dive progress k
    function camera(k) {
      var e = k <= 0 ? 0 : k >= 1 ? 1 : (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
      var s = sA + (sP - sA) * e;
      var w = devW / s, h = devH / s;
      var cxA = G.CAB_W / 2, cyA = G.CAB_H / 2;
      var PR = G.PLAY_RECT;
      var cxP = PR.x + PR.w / 2, cyP = PR.y + PR.h / 2;
      var cx = cxA + (cxP - cxA) * e, cy = cyA + (cyP - cyA) * e;
      return { k: e, s: s, x: cx - w / 2, y: cy - h / 2, w: w, h: h };
    }
    function diveK() {
      var u = Math.max(0, Math.min(1, (view.t - game.diveT0) / DIVE_T));
      return game.diveDir > 0 ? u : game.diveDir < 0 ? 1 - u : (game.mode === 'play' ? 1 : 0);
    }

    /* ── input ───────────────────────────────────────────────────── */
    function toBoard(ev) {
      var rect = canvas.getBoundingClientRect();
      var dpr = root.devicePixelRatio || 1;
      var c = camera(diveK());
      var px = (ev.clientX - rect.left) * dpr, py = (ev.clientY - rect.top) * dpr;
      if (renderOK && DEBUG !== 1 && R.toGlass) { try { var q = R.toGlass(px, py, view); if (q) return q; } catch (e) { } }
      return { x: c.x + px / c.s - G.GLASS_X, y: c.y + py / c.s - G.GLASS_Y };
    }
    function onMove(ev) {
      var p = toBoard(ev);
      view.hopper.ghostX = (p.x >= 0 && p.x <= G.GLASS_W && p.y >= -40 && p.y <= G.GLASS_H) ? p.x : null;
    }
    function onDown(ev) {
      var p = toBoard(ev);
      if (p.x < -8 || p.x > G.GLASS_W + 8 || p.y < -60 || p.y > G.GLASS_H + 8) return;
      if (game.mode === 'attract') { setMode('play'); }
      drop(p.x);
    }
    function onKey(ev) {
      if (ev.key === 'Escape') setMode('attract');
      else if (ev.key === ' ' && view.hopper.ghostX != null) { drop(view.hopper.ghostX); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        var gx = view.hopper.ghostX == null ? view.hopper.x : view.hopper.ghostX;
        view.hopper.ghostX = Math.max(10, Math.min(310, gx + (ev.key === 'ArrowLeft' ? -2 : 2)));
      }
    }
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    root.addEventListener('keydown', onKey);

    function drop(x) {
      x = Math.max(board.drop.x0, Math.min(board.drop.x1, x));
      view.hopper.x = x;
      return PP.addMarble(world, x).id;
    }
    function setMode(m) {
      if (m === game.mode) return;
      game.mode = m; view.mode = m;
      game.diveT0 = view.t; game.diveDir = m === 'play' ? 1 : -1;
      document.documentElement.classList.toggle('pachinko-playing', m === 'play');
    }

    /* ── clock ───────────────────────────────────────────────────── */
    var simT = 0;
    function advance(t) {
      while (simT + STEP <= t + 1e-9) {
        simT += STEP;
        PP.stepWorld(world, STEP);
        var evs = world.events;
        for (var i = 0; i < evs.length; i++) {
          var e = evs[i];
          ring.push(e); if (ring.length > 256) ring.shift();
          if (e.type === 'pin' || e.type === 'rail' || e.type === 'wheel') view.hits.push({ id: e.id, t: e.t, speed: e.speed });
          if (e.type === 'slot' || e.type === 'pocket') view.score += e.value;
          if (opts.onEvent) { try { opts.onEvent(e); } catch (er) { } }
        }
        evs.length = 0;
      }
      view.t = Math.max(view.t, t);
      while (view.hits.length && view.t - view.hits[0].t > 0.4) view.hits.shift();
      if (world.marbles.length > 40) world.marbles = world.marbles.filter(function (m) { return !m.done || view.t - m.tDone < 1; });
    }

    /* ── render ──────────────────────────────────────────────────── */
    function render() {
      var cam = camera(diveK());
      view.cam.k = cam.k; view.cam.x = cam.x; view.cam.y = cam.y; view.cam.w = cam.w; view.cam.h = cam.h;
      view.marbles = world.marbles.filter(function (m) { return !m.done || (m.phase === 'pocket' && view.t - m.tDone < 0.6); }).map(function (m) {
        var o = { x: m.x, y: m.y, r: m.r, spin: m.spin, id: m.id, phase: m.phase };
        if (m.phase === 'tunnel') { var tu = m.tunnel; o.tunnel = { from: tu.from, to: tu.to, k: Math.min(1, (view.t - tu.tIn) / (tu.tOut - tu.tIn)) }; }
        return o;
      });
      view.cam.s = cam.s;
      var drew = false;
      if (renderOK && DEBUG !== 1) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        try { R.draw(ctx, view); drew = true; } catch (e) { renderOK = false; warn('draw', e); }
        if (drew && DEBUG === 2) {
          cctx.clearRect(0, 0, G.CAB_W, G.CAB_H); debugDraw(cctx, true);
          ctx.setTransform(1, 0, 0, 1, 0, 0); blit(cam);
        }
      }
      if (!drew) {
        cctx.setTransform(1, 0, 0, 1, 0, 0);
        cctx.fillStyle = '#07060d'; cctx.fillRect(0, 0, G.CAB_W, G.CAB_H); debugDraw(cctx, false);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#07060d'; ctx.fillRect(0, 0, devW, devH);
        blit(cam);
      }
    }
    // the debug view's camera: blit a crop of the logical cabinet canvas
    function blit(cam) {
      ctx.imageSmoothingEnabled = false;
      var sx = Math.max(0, cam.x), sy = Math.max(0, cam.y);
      var ex = Math.min(G.CAB_W, cam.x + cam.w), ey = Math.min(G.CAB_H, cam.y + cam.h);
      if (ex > sx && ey > sy) {
        var dx = (sx - cam.x) * cam.s, dy = (sy - cam.y) * cam.s;
        if (cam.k === 0 || cam.k === 1) { dx = Math.round(dx); dy = Math.round(dy); }
        ctx.drawImage(cab, sx, sy, ex - sx, ey - sy, dx, dy, (ex - sx) * cam.s, (ey - sy) * cam.s);
      }
    }

    /* the debug view: the board's primitives, regions tinted */
    var REG_TINT = { surface: '#1c2440', overburden: '#2b2230', haulage: '#1d1a2c', ventdoor: '#22182a', floor1: '#2b2230',
      workings: '#1b1a24', floor2: '#2b2230', sump: '#151a22', vein: '#1e1a16', payout: '#191422' };
    var MAT_COL = { steel: '#b8c4d8', brass: '#d8b25a', timber: '#a0703c', rock: '#6b5f6e', ore: '#e0c060', bone: '#e8dfc8' };
    function debugDraw(c, overlay) {
      c.save();
      c.translate(G.GLASS_X, G.GLASS_Y);
      c.beginPath(); c.rect(0, 0, G.GLASS_W, G.GLASS_H); c.clip();
      if (!overlay) {
        board.regions.forEach(function (r) { c.fillStyle = REG_TINT[r.id] || '#111'; c.fillRect(r.x, r.y, r.w, r.h); });
        board.bands.forEach(function (bd) {
          bd.pieces.forEach(function (pc) {
            c.fillStyle = '#3a3040'; c.beginPath();
            pc.poly.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); });
            c.closePath(); c.fill();
          });
        });
        c.fillStyle = '#6f5d95'; c.font = '6px monospace';
        board.regions.forEach(function (r) { c.fillText(r.id, r.x + 2, r.y + 7); });
      }
      var t = view.t, hot = {};
      view.hits.forEach(function (h) { hot[h.id] = 1; });
      board.fixtures.forEach(function (f) {
        var col = MAT_COL[f.material] || '#fff';
        if (f.kind === 'pin') { c.fillStyle = hot[f.id] ? '#ff4fa8' : col; c.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 3, 3); }
        else if (f.kind === 'rail') { line(c, f.x1, f.y1, f.x2, f.y2, hot[f.id] ? '#ff4fa8' : col, Math.max(1, f.r * 2)); }
        else if (f.kind === 'wheel') {
          var p = PB.pose(f, t);
          p.segs.forEach(function (s) { line(c, s[0][0], s[0][1], s[1][0], s[1][1], col, 2); });
          c.fillStyle = col; c.fillRect(f.x - f.hub, f.y - f.hub, f.hub * 2, f.hub * 2);
        } else if (f.kind === 'cart') {
          var cp = PB.pose(f, t);
          cp.segs.forEach(function (s) { line(c, s[0][0], s[0][1], s[1][0], s[1][1], '#c0c8d8', 2); });
        } else if (f.kind === 'tunnel') {
          c.strokeStyle = f.open ? '#ff4fa8' : '#553344'; c.beginPath(); c.arc(f.a.x, f.a.y, f.a.r, 0, 7); c.stroke();
          c.strokeStyle = '#a63a70'; c.beginPath(); c.arc(f.b.x, f.b.y, 4, 0, 7); c.stroke();
        } else if (f.kind === 'pocket') {
          c.fillStyle = '#d8b25a'; c.fillRect(f.x - f.w / 2, f.y, f.w, 6);
        } else if (f.kind === 'slot') {
          c.fillStyle = f.value === 13 ? '#ffd24a' : f.value ? '#6f5d95' : '#2c2347';
          c.fillRect(f.x0 + 1, f.y + 8, f.x1 - f.x0 - 2, 8);
          c.fillStyle = '#07060d'; c.font = '7px monospace'; c.fillText(String(f.value), f.x0 + 3, f.y + 15);
        }
      });
      // the hopper and its ghost
      c.fillStyle = '#e8dfc8'; c.fillRect(Math.round(view.hopper.x) - 4, 0, 9, 3);
      if (view.hopper.ghostX != null) { c.fillStyle = 'rgba(232,223,200,0.35)'; c.fillRect(Math.round(view.hopper.ghostX) - 4, 0, 9, 3); }
      // marbles
      view.marbles.forEach(function (m) {
        if (m.phase === 'tunnel') {
          var k = m.tunnel.k, x = m.tunnel.from.x + (m.tunnel.to.x - m.tunnel.from.x) * k, y = m.tunnel.from.y + (m.tunnel.to.y - m.tunnel.from.y) * k;
          c.fillStyle = 'rgba(255,79,168,0.5)'; c.fillRect(x - 1, y - 1, 3, 3); return;
        }
        c.fillStyle = '#9fe3ff'; c.beginPath(); c.arc(m.x, m.y, m.r, 0, 7); c.fill();
        c.strokeStyle = '#07060d'; c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(m.x + Math.cos(m.spin) * m.r, m.y + Math.sin(m.spin) * m.r); c.stroke();
      });
      c.restore();
      c.fillStyle = '#e8dfc8'; c.font = '8px monospace';
      c.fillText('DEBUG  t ' + view.t.toFixed(2) + '  score ' + view.score, 4, 10);
    }
    function line(c, x1, y1, x2, y2, col, wd) {
      c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    function warn(where, e) { if (root.console) console.warn('MOTHER LODE: render ' + where + ' failed; debug view', e); }

    /* ── loop ────────────────────────────────────────────────────── */
    var dead = false, rafId = 0, lastNow = null, clock = 0;
    function frame(now) {
      if (dead) return;
      rafId = root.requestAnimationFrame(frame);
      if (document.hidden) { lastNow = null; return; }
      if (lastNow === null) lastNow = now;
      clock += Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      advance(clock);
      render();
    }
    fit();
    root.addEventListener('resize', fit);
    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { fit(); }) : null;
    if (ro) ro.observe(container);
    if (/[?&]mode=play/.test(search)) { game.mode = view.mode = 'play'; game.diveDir = 0; }
    if (!HARNESS) rafId = root.requestAnimationFrame(frame);

    var handle = {
      view: view,
      drop: drop,
      getState: function () { return { mode: game.mode, t: view.t, marbles: world.marbles.length, score: view.score }; },
      pause: function () { }, resume: function () { },
      destroy: function () {
        dead = true; if (rafId) root.cancelAnimationFrame(rafId);
        root.removeEventListener('resize', fit); root.removeEventListener('keydown', onKey);
        if (ro) ro.disconnect();
        canvas.remove();
      }
    };
    if (HARNESS) {
      handle.harness = {
        stepTo: function (t) { advance(t); return view.t; },
        render: function () { render(); return view.t; },
        drop: drop,
        setMode: function (m) { game.mode = view.mode = m; game.diveDir = 0; return m; },
        setBoard: function (b) { board = view.board = b; world = PP.createWorld(b, seed); if (renderOK && R.build) R.build(b); },
        get world() { return world; },
        get state() { return { mode: game.mode, t: view.t, score: view.score, marbles: world.marbles.map(function (m) { return { id: m.id, x: m.x, y: m.y, phase: m.phase, outcome: m.outcome }; }) }; },
        events: ring, view: view, canvas: canvas, cab: cab
      };
    }
    return handle;
  }

  root.MotherLode = { mount: mount };

  // auto-mount on the page
  function boot() {
    var el = document.getElementById('pachinko-mount');
    if (!el || el.__mounted) return;
    el.__mounted = true;
    root.__pachinko = mount(el, {});
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(window);
