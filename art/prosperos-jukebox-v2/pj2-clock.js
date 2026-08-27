// ============================================================================
// PJ2.Clock — the lookahead transport (Prospero's Jukebox v2, Phase 0)
//
// Every engine in this family — prospero v1, zankyo, bardo, kolob — keeps time
// the same way: a recursive setTimeout fires "roughly now", and the callback
// schedules its audio "roughly now" too. It mostly works because the music is
// slow and forgiving. But setTimeout drifts, browsers clamp it to a crawl in
// background tabs, and every layer that wants a different tempo ends up
// cancelling and re-arming its own private timer Set (kolob-audio.js:335,
// v1's rescheduleLayer). The rhythm of these pieces has always been a little
// seasick, and we called it aleatoric.
//
// This module is the correction: Chris Wilson's "tale of two clocks". There
// are two clocks in a browser and only one of them is honest. The JS timer
// clock is sloppy — so we use it only as a COARSE PUMP, a setInterval that
// wakes up every ~25ms and asks one question: which events fall inside the
// lookahead window [now, now + aheadS)? Those get fired NOW, but each callback
// receives the EXACT scheduled time `t` on the honest clock (ctx.currentTime's
// timeline), so it places its Web Audio events sample-accurately at `t` —
// never at "whenever the timer got around to us". The sloppy clock decides
// *when we think*; the audio clock decides *when things sound*.
//
// Drift is eliminated by construction, not by correction: every time in the
// system is an absolute audio-clock time. A .every loop's next fire is
// t + delay — computed from the SCHEDULED t, not from wall-clock now — so a
// thousand iterations later the loop is exactly where arithmetic says it is.
//
// Lanes replace the per-layer timer Sets: named sub-transports, each with a
// rate multiplier. Changing a lane's rate rescales its already-pending events
// proportionally around the present moment (the accelerando bends the notes
// already in flight, not just the ones yet to be written), where v1 did this
// with a cancel-everything-and-reschedule shudder.
//
// Background tabs: browsers clamp timers to 1s when hidden. We can't stop
// that, so on visibilitychange→hidden we widen the lookahead window to 1.6s —
// wide enough that even 1s-apart wakeups always overlap the window ahead of
// them, and nothing falls through the crack. The music keeps time while
// nobody is watching, which is most of what these pieces do anyway.
//
// Discipline (house rule, spec §3): no Date.now, no performance.now, no DOM
// at the top level. Time comes only from the injected ctx.currentTime; timers
// come from opts.setInterval/clearInterval if given (the harness drives a
// virtual clock through them) or the globals otherwise. Deterministic under
// test, honest in production.
//
// Public surface: PJ2.Clock.create(ctx, opts) → Clock (see spec §3).
// Depends on nothing but its injected ctx and timers.
// ============================================================================

(function () {
  "use strict";
  window.PJ2 = window.PJ2 || {};

  // How wide the window opens when the tab goes dark. Hidden-tab timers clamp
  // to 1s; 1.6s gives 60% overlap so a late wakeup still can't skip anything.
  var HIDDEN_AHEAD_S = 1.6;

  // The floor for a .every loop's returned delay when it hands us garbage
  // (NaN, zero, negative). 20ms: fast enough to be musically "immediately",
  // slow enough that a confused callback can't spin the tick loop forever.
  var MIN_EVERY_DELAY_S = 0.02;

  function create(ctx, opts) {
    opts = opts || {};
    var tickMs    = opts.tickMs != null ? opts.tickMs : 25;
    var baseAhead = opts.aheadS != null ? opts.aheadS : 0.25;
    var aheadS    = baseAhead;                 // widened while the tab hides
    var onError   = opts.onError || null;

    // Injectable timers. Wrapped in closures rather than referenced bare —
    // window.setInterval called without its receiver throws in some browsers,
    // and the harness hands us plain functions anyway.
    var timerSet = opts.setInterval  || function (fn, ms) { return setInterval(fn, ms); };
    var timerClr = opts.clearInterval || function (id) { clearInterval(id); };

    // ------------------------------------------------------------------
    // The pending-event structure: a binary min-heap keyed on (t, seq).
    // seq is a monotone counter so equal times fire in insertion order —
    // stable, so "schedule the downbeat, then its ornament" stays in that
    // order forever. Cancellation is lazy (a tombstone flag) because
    // deleting from the middle of a heap is more code than skipping a
    // corpse at the top; a compaction pass sweeps them when they pile up.
    // ------------------------------------------------------------------
    var heap = [];            // entries: {t, seq, fn, id, laneName, every, cancelled, fired}
    var seqCounter = 0;       // insertion order, never reset
    var idCounter  = 0;       // public handles, never reset
    var idMap = {};           // id → live entry (in heap, or mid-fire)
    var tombstones = 0;       // cancelled entries still physically in the heap
    var lanes = {};           // name → {name, rate, live, api}
    var timerId = null;
    var running = false;

    function earlier(a, b) {
      return a.t < b.t || (a.t === b.t && a.seq < b.seq);
    }
    function heapPush(e) {
      heap.push(e);
      var i = heap.length - 1;
      while (i > 0) {
        var p = (i - 1) >> 1;
        if (earlier(heap[i], heap[p])) {
          var tmp = heap[i]; heap[i] = heap[p]; heap[p] = tmp; i = p;
        } else break;
      }
    }
    function siftDown(i) {
      var n = heap.length;
      for (;;) {
        var l = i * 2 + 1, r = l + 1, m = i;
        if (l < n && earlier(heap[l], heap[m])) m = l;
        if (r < n && earlier(heap[r], heap[m])) m = r;
        if (m === i) return;
        var tmp = heap[i]; heap[i] = heap[m]; heap[m] = tmp; i = m;
      }
    }
    function heapPop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; siftDown(0); }
      return top;
    }
    function heapify() {                       // rebuild in place after bulk edits
      for (var i = (heap.length >> 1) - 1; i >= 0; i--) siftDown(i);
    }
    function sweepTombstones() {               // physically remove the cancelled
      if (!tombstones) return;
      var live = [];
      for (var i = 0; i < heap.length; i++) if (!heap[i].cancelled) live.push(heap[i]);
      heap = live;
      tombstones = 0;
      heapify();
    }
    function maybeCompact() {                  // only when the dead outnumber the living
      if (tombstones > 32 && tombstones * 2 > heap.length) sweepTombstones();
    }

    // ------------------------------------------------------------------
    // Bookkeeping: per-lane live counts so Lane.pending() is O(1).
    // ------------------------------------------------------------------
    function incLive(e) { if (e.laneName) lanes[e.laneName].live++; }
    function decLive(e) { if (e.laneName) lanes[e.laneName].live--; }

    function schedule(t, fn, laneName, every) {
      var id = ++idCounter;
      var e = {
        t: +t, seq: seqCounter++, fn: fn, id: id,
        laneName: laneName, every: !!every,
        cancelled: false, fired: false
      };
      idMap[id] = e;
      heapPush(e);
      incLive(e);
      return id;
    }

    function cancel(id) {
      var e = idMap[id];
      if (!e) return;
      delete idMap[id];
      if (e.fired) {
        // Mid-fire (a callback cancelling itself, or its own loop): it is
        // not in the heap right now. Flag it so the reschedule path below
        // sees the cancellation and lets the loop die.
        e.cancelled = true;
        return;
      }
      e.cancelled = true;
      tombstones++;
      decLive(e);
      maybeCompact();
    }

    function cancelLaneEvents(name) {
      var i, e;
      for (i = 0; i < heap.length; i++) {
        e = heap[i];
        if (e.laneName === name && !e.cancelled) {
          e.cancelled = true;
          tombstones++;
          delete idMap[e.id];
        }
      }
      // Catch a lane event that is executing THIS instant (cancelAll called
      // from inside one of the lane's own callbacks) — it lives only in idMap.
      for (var id in idMap) {
        e = idMap[id];
        if (e.laneName === name && e.fired) { e.cancelled = true; delete idMap[id]; }
      }
      if (lanes[name]) lanes[name].live = 0;
      sweepTombstones();                       // bulk cancel: sweep immediately
    }

    function report(err, e) {
      if (onError) {
        try { onError(err, { t: e.t, lane: e.laneName, id: e.id }); } catch (ignored) {}
      } else if (typeof console !== "undefined" && console.error) {
        console.error("PJ2.Clock: callback threw at t=" + e.t, err);
      }
    }

    // ------------------------------------------------------------------
    // The tick: the coarse pump. Everything scheduled before now+aheadS
    // fires immediately, in scheduled-time order, receiving its exact t.
    // Overdue events (t already past — a stall, a hidden-tab hiccup) fire
    // too; Web Audio clamps their placement to "as soon as possible",
    // which is the least-bad recovery and drops nothing.
    // ------------------------------------------------------------------
    function tick() {
      var horizon = ctx.currentTime + aheadS;
      // Note: an .every reschedule that lands inside this same horizon is
      // picked up by this same loop — a fast loop never starves behind the
      // tick interval. The clamp on returned delays keeps this finite.
      while (heap.length && (heap[0].cancelled || heap[0].t < horizon)) {
        var e = heapPop();
        if (e.cancelled) { tombstones--; continue; }
        e.fired = true;
        decLive(e);
        var delay, threw = false;
        try {
          delay = e.fn(e.t);                   // the exact scheduled time — the whole point
        } catch (err) {
          threw = true;                        // one bad note must not stop the transport
          report(err, e);
        }
        if (e.every && !threw && !e.cancelled && delay !== null && delay !== undefined) {
          delay = +delay;
          if (!(delay > 0)) delay = MIN_EVERY_DELAY_S;   // catches NaN, 0, negatives
          var rate = (e.laneName && lanes[e.laneName]) ? lanes[e.laneName].rate : 1;
          // Next fire from the SCHEDULED t, at the rate in force right now.
          // Absolute arithmetic on the audio clock: zero drift by construction.
          e.t = e.t + delay / rate;
          e.seq = seqCounter++;
          e.fired = false;
          heapPush(e);                         // same entry, same public id
          incLive(e);
        } else {
          // One-shot done, loop ended (null/undefined), loop threw, or the
          // callback cancelled itself mid-fire. Either way it's over.
          if (idMap[e.id] === e) delete idMap[e.id];
        }
      }
    }

    // ------------------------------------------------------------------
    // Background-tab resilience. Guarded: the Node harness has no document.
    // ------------------------------------------------------------------
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") {
          aheadS = Math.max(HIDDEN_AHEAD_S, baseAhead);
          if (running) tick();                 // pre-fill the widened window now,
        } else {                               // before the clamp slows our pulse
          aheadS = baseAhead;
        }
      });
    }

    // ------------------------------------------------------------------
    // Lanes: named sub-transports with independent rate.
    // ------------------------------------------------------------------
    function setLaneRate(L, v) {
      v = +v;
      if (!isFinite(v)) return;                // refuse garbage, keep playing
      if (v < 0.05) v = 0.05;                  // spec floor: no stopped/negative time
      var old = L.rate;
      L.rate = v;
      if (v === old) return;
      // Rescale this lane's pending events proportionally around NOW: an
      // event that was Δ seconds away is now Δ·(old/new) away. Time already
      // spent waiting stays spent — only the remaining distance stretches.
      // v1 cancelled and rescheduled everything; here we bend the heap
      // entries in place and re-heapify once.
      var now = ctx.currentTime, k = old / v;
      for (var i = 0; i < heap.length; i++) {
        var e = heap[i];
        if (e.laneName === L.name && !e.cancelled) e.t = now + (e.t - now) * k;
      }
      heapify();
    }

    function lane(name) {
      var L = lanes[name];
      if (L) return L.api;
      L = lanes[name] = { name: name, rate: 1, live: 0, api: null };
      var api = {
        at: function (timeS, fn)  { return schedule(timeS, fn, name, false); },
        in: function (deltaS, fn) { return schedule(ctx.currentTime + deltaS, fn, name, false); },
        // .every: fn(t) returns the delay (seconds) to its next fire, or
        // null/undefined to end the loop. First fire is "now" — i.e. on the
        // next tick, with t = the moment of the call.
        every: function (fn)      { return schedule(ctx.currentTime, fn, name, true); },
        cancelAll: function ()    { cancelLaneEvents(name); },
        pending: function ()      { return L.live; }
      };
      Object.defineProperty(api, "rate", {
        get: function () { return L.rate; },
        set: function (v) { setLaneRate(L, v); }
      });
      L.api = api;
      return api;
    }

    // ------------------------------------------------------------------
    // The Clock itself.
    // ------------------------------------------------------------------
    var clock = {
      start: function () {
        if (running) return;
        running = true;
        timerId = timerSet(tick, tickMs);
        tick();                                // don't make the downbeat wait a tick
      },
      stop: function () {                      // stop() cancels ALL pending events
        if (timerId != null) { timerClr(timerId); timerId = null; }
        running = false;
        // Flag every live entry cancelled first: an .every callback that is
        // executing right now must not resurrect itself into the fresh heap.
        for (var id in idMap) idMap[id].cancelled = true;
        idMap = {};
        heap = [];
        tombstones = 0;
        for (var n in lanes) lanes[n].live = 0;
      },
      now: function () { return ctx.currentTime; },
      at: function (timeS, fn)  { return schedule(timeS, fn, null, false); },
      in: function (deltaS, fn) { return schedule(ctx.currentTime + deltaS, fn, null, false); },
      cancel: cancel,
      lane: lane
    };
    return clock;
  }

  window.PJ2.Clock = { create: create };
})();
