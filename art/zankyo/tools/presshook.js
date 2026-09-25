// ============================================================================
// ZANKYŌ Q0 r2 — the press log, injected beside tools/rxrec.js (dev tool only).
// The critic's rx-critic.js hook, lifted into its own file so _rx-probe.js
// records it too: every 受信 press — what dial() answered, whether a broadcast
// was live, the armed t0s — and the set's phase, on the audio clock. Lands in
// window.__crit; the driver writes it to crit.json. It only listens.
// ============================================================================
(function () {
  var C = window.__crit = { dial: [], phase: [] };
  function t() { try { var c = ZankyoAudio.getAudioContext(); return c ? +c.currentTime.toFixed(3) : null; } catch (e) { return null; } }
  function hook() {
    var Z = window.ZankyoAudio; if (!Z || !Z.dial) return setTimeout(hook, 50);
    if (Z.__crit) return; Z.__crit = 1;
    var od = Z.dial;
    Z.dial = function (a, w, f) {
      var at = t(); var r = od.apply(this, arguments);
      if (f) { var st = null; try { st = ZankyoBroadcast.getState(); } catch (e) {}
        C.dial.push({ t: at, r: r, live: !!(st && st.live), armed: st && st.armed ? st.armed.map(function (q) { return q.t0 != null ? q.t0 : (q.wantT0 != null ? q.wantT0 : null); }) : null }); }
      return r;
    };
  }
  hook();
  var last = null;
  setInterval(function () { try { var s = window.ZankyoSet && ZankyoSet.getState && ZankyoSet.getState(); var p = s && s.phase; if (p !== last) { C.phase.push([t(), p]); last = p; } } catch (e) {} }, 50);
})();
