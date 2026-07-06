/* SCRIP CREEK — boot, loop & cabinet contract
 *
 * CoinPusher.mount(container, opts) creates the canvas via Arcade core,
 * builds the static machine, runs the sim on a fixed 120 Hz accumulator
 * (identical physics on any refresh rate), and wires the one-thumb input:
 * drag anywhere on the glass to slide the chute, tap to drop.
 *
 * Milestone 2 (the pile): drops are free — no ledger yet. The tray count
 * is cosmetic, the attract mode is the machine playing against itself,
 * which the physics gives us for free. Economy lands in milestone 3.
 * Returns the cabinet handle the universe demands: destroy(), pause(),
 * resume(). Add ?debug=1 for the true top-down machine space.
 */
window.CoinPusher = (function () {
  'use strict';

  var VERSION = 'the pile, v0.2';

  function mount(container, opts) {
    opts = opts || {};
    var R = window.CoinPusherRender;
    var P = window.CoinPusherPhysics;
    var A = window.Arcade;

    var m = A.mountCanvas(container, R.W, R.H, 'SCRIP CREEK coin pusher');
    R.buildStatic();
    var sim = P.makeSim(opts.seed || 1913);

    var state = {
      mode: 'ATTRACT',
      chuteX: 75,
      tray: 0,
      lastTouch: -1e9,       // sim-clock ms of last human input
      nextAutoDrop: 2000,
      paused: false,
      dead: false,
      debug: /[?&]debug=1/.test(location.search)
    };

    var listeners = opts.onEvent ? [opts.onEvent] : [];
    function emit(ev) {
      for (var i = 0; i < listeners.length; i++) listeners[i](ev);
      A.emit('coinpusher', ev);
    }

    /* ── input: drag slides the chute, a tap drops ─────────────────── */
    var canvas = m.canvas;
    var ptr = null; // {x0, t0, moved}
    function canvasX(e) {
      var r = canvas.getBoundingClientRect();
      return (e.clientX - r.left) * (R.W / r.width);
    }
    function onDown(e) {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      ptr = { x0: canvasX(e), t0: performance.now(), moved: false };
      state.lastTouch = performance.now();
    }
    function onMove(e) {
      if (!ptr) return;
      var x = canvasX(e), dx = x - ptr.x0;
      if (Math.abs(dx) > 4) ptr.moved = true;
      if (ptr.moved) {
        state.chuteX = Math.max(8, Math.min(142, state.chuteX + dx * (150 / 152)));
        ptr.x0 = x;
      }
      state.lastTouch = performance.now();
    }
    function onUp(e) {
      if (!ptr) return;
      var quick = performance.now() - ptr.t0 < 350;
      if (!ptr.moved && quick) {
        if (sim.drop(state.chuteX)) emit({ type: 'drop', x: state.chuteX });
      }
      ptr = null;
      state.lastTouch = performance.now();
    }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    /* ── fixed-step loop ───────────────────────────────────────────── */
    var acc = 0, lastT = null, rafId = 0;
    var wander = A.rng((opts.seed || 1913) ^ 0xA77AC);

    function frame(t) {
      if (state.dead) return;
      rafId = requestAnimationFrame(frame);
      if (state.paused) { lastT = null; return; }
      if (lastT == null) lastT = t;
      acc += Math.min(100, t - lastT); // clamp: background tabs don't fast-forward
      lastT = t;
      while (acc >= P.TUNE.DT_MS) {
        sim.step();
        acc -= P.TUNE.DT_MS;
      }

      // attract: left alone, the machine plays itself
      if (t - state.lastTouch > 8000 && t > state.nextAutoDrop) {
        state.chuteX = Math.max(12, Math.min(138, state.chuteX + (wander() - 0.5) * 60));
        sim.drop(state.chuteX);
        state.nextAutoDrop = t + 2200 + wander() * 1400;
      }

      // the sim's news
      var evs = sim.drainEvents();
      for (var i = 0; i < evs.length; i++) {
        var ev = evs[i];
        if (ev.type === 'payout') { state.tray++; emit(ev); }
        else if (ev.type === 'gutter') emit(ev);
        else if (ev.type === 'prize' || ev.type === 'prize-lost') emit(ev);
      }

      R.drawFrame(m.ctx, t, {
        sim: sim,
        chuteX: state.chuteX,
        tokens: A.tokens.get(),
        tray: state.tray,
        debug: state.debug
      });
    }
    rafId = requestAnimationFrame(frame);

    return {
      VERSION: VERSION,
      destroy: function () {
        state.dead = true;
        cancelAnimationFrame(rafId);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        m.destroy();
      },
      pause: function () { state.paused = true; },
      resume: function () { state.paused = false; },
      drop: function (x) { return sim.drop(x == null ? state.chuteX : x); },
      sim: sim // exposed for tuning until the game loop lands
    };
  }

  return { mount: mount, VERSION: VERSION };
})();

(function autoMount() {
  var el = document.getElementById('coinpusher-mount');
  if (el) window.__pusherMount = window.CoinPusher.mount(el);
  var v = document.getElementById('coinpusher-version');
  if (v) v.textContent = '(' + window.CoinPusher.VERSION + ')';
})();
