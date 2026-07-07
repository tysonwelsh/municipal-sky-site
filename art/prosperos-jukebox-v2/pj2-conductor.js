// ============================================================================
// Prospero's Jukebox v2 — pj2-conductor.js
// PJ2.Conductor: the dramaturgy machine. Phase 1, module 6.
//
// Every engine in this family has a conductor buried in it — kolob's
// chorister plans a meeting of sections and walks them (kolob-audio.js:718),
// zankyo's meta-arc swings its cycles dark and back (zankyo-audio.js:435) —
// and every one of them is welded to its own track: the chorister knows what
// a hymn is, the meta-arc knows what iwato sounds like. This module is that
// machine extracted and made GENERIC. It knows scenes, intensity, joints,
// chaining, and the tide; it knows nothing about any particular track.
// Everything track-flavored arrives through one `dramaturgy` object — scene
// types, intensity curves, the plan, the joint vocabulary, the tide's labels
// — validated hard at create time, because a malformed dramaturgy discovered
// forty minutes into an evening is a malformed evening.
//
// Two departures from the family's prior art, both corrections:
//
// 1. INTENSITY IS CONTINUOUS. Kolob's intensity() switches curves the instant
//    a section changes — an audible seam every layer inherits. Here intensity
//    is a FUNCTION OF AUDIO TIME: at each scene boundary the new scene's
//    curve is crossfaded over the outgoing one (smoothstep, >= 8 seconds,
//    widened automatically when the curves meet far apart, so the blend's
//    own slope stays under ~0.02/s). The outgoing curve holds its final value
//    under the fade — the old scene doesn't vanish, it recedes. Handoffs can
//    overlap handoffs (short scenes chain their fades); a completed fade is
//    flattened away on the coarse pulse so an evening of boundaries doesn't
//    accumulate a tower of closures. The arc reads as weather, not theater.
//
// 2. EXACT TIME. The chorister polls "is the section over yet?" every 600ms
//    of sloppy wall clock. Here the coarse pulse (a 0.5s lane.every) does
//    only housekeeping; scene boundaries and joints are placed at EXACT
//    audio-clock times via lane.at, so a joint's page-turn lands sample-
//    accurately on the boundary it marks, and scene durations are honored
//    to arithmetic, not to a timer's mood.
//
// THE TIDE is the meta-arc generalized: one seeded cosine whose period is
// drawn in PERFORMANCES (not seconds), advanced only at performance
// boundaries. It biases plan() and the scene curves (both receive tidePos)
// and is exposed for voices to read. Its rng is a dedicated fork, so its
// series depends on nothing but the seed and the performance count.
//
// CHAINING: when the last scene ends, the next performance is planned from a
// fresh per-performance fork (label "performance:N") and entered AT ONCE —
// same instant, same lane, one joint marking the seam. Plans are therefore
// reproducible and order-independent: performance 7 is the same evening no
// matter what anyone drew during performances 1 through 6. The conductor
// itself never stops; the engine facade keeps the candle-out's tail fading
// under the new settling-in for the chainOverlapS the performance event
// carries.
//
// No Web Audio, no DOM, no Date.now/Math.random. Depends only on its
// injected clock and rng. Loadable headless.
//
// ----------------------------------------------------------------------------
// PJ2.Conductor.create(opts) → Conductor
//
//   opts.clock       PJ2.Clock instance (required)
//   opts.rng         a forked PJ2.Rand stream (required; forked again
//                    internally: "tide" once, "performance:N" per performance)
//   opts.dramaturgy  the contract object (required; shape validated, see
//                    validateDramaturgy below and SPEC-PHASE1 §6)
//   opts.onEvent     fn(evt) — every event carries {type, t}:
//                    {type:"tide", pos, label, phase, periodPerfs, perfN, t}
//                    {type:"performance", phase:"begin"|"end", n, t, durS?,
//                     sceneCount?, scenes?, chainOverlapS?, tidePos?, tideLabel?,
//                     elapsedS?}
//                    {type:"scene", scene, idx, count, durS, activity, tidePos, t}
//                    {type:"joint", from, to, did, error?, t}
//                    Listener errors are swallowed — a demo page must not be
//                    able to stop the transport.
//   opts.jointTools  the joint's toolkit — either the object itself,
//                    {ctx, out, rng, field}, or a FUNCTION returning it.
//                    Resolved fresh at every joint call, so the engine facade
//                    may hand a closure over state that doesn't exist yet
//                    (the AudioContext is lazy until first play):
//                        jointTools: function () {
//                          return { ctx: ctx, out: bus.input,
//                                   rng: jointsRng, field: field };
//                        }
//                    The conductor passes the resolved object through to
//                    dramaturgy.joint(from, to, t, intensity, tools) verbatim,
//                    untouched. If absent, joints receive {}.
//   opts.air         optional PJ2.Air instance, read for info().airHolders
//   opts.seed        optional number, echoed in info() for telemetry
//   opts.lane        optional lane name (default "conductor")
//
// Conductor:
//   .start()           plans a performance, enters its first scene
//   .stop()            cancels the lane; no musical gesture (facade fades)
//   .intensity()       current 0..1 — tide- and scene-shaped, CONTINUOUS
//   .intensityAt(t)    the same curve read at an arbitrary audio time
//   .scene()           {type, activity, x}
//   .tide()            {pos, label, phase, periodPerfs}
//   .airLimit()        current scene's declared airLimit (for wiring PJ2.Air)
//   .overlapChance()   current scene's declared overlapChance (ditto)
//   .info()            full telemetry snapshot
//
// JOINT CONVENTION: the conductor calls dramaturgy.joint exactly once per
// boundary (including the performance seam) at the boundary's exact audio
// time. The joint's return value is attached to the joint event as `did` —
// return a short label ("breath", "page-turn") when the joint sounded,
// return nothing/null for a silent boundary (which is a legitimate and
// frequent draw, per the aesthetic constants). A joint that throws is
// reported and the event carries `error`; the transport keeps walking.
// ============================================================================

(function () {
  "use strict";
  window.PJ2 = window.PJ2 || {};

  var PULSE_S = 0.5;          // coarse housekeeping pulse — never load-bearing
  var HANDOFF_MIN_S = 8;      // spec floor: scene handoffs interpolate >= 8s
  var HANDOFF_SLOPE = 0.02;   // max intensity change per second the crossfade
                              // itself may contribute; the window widens to
                              // 1.5·gap/slope when curves meet far apart
                              // (1.5 = smoothstep's peak derivative)

  function smooth(z) {
    z = z < 0 ? 0 : z > 1 ? 1 : z;
    return z * z * (3 - 2 * z);
  }
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  // --------------------------------------------------------------------------
  // Dramaturgy validation — loud and early. Every message names the field:
  // the parallel agent wiring a track against this machine should learn what
  // is wrong from the throw, not from a silent evening.
  // --------------------------------------------------------------------------
  function bad(msg) {
    throw new Error("PJ2.Conductor: malformed dramaturgy — " + msg);
  }
  function isRange(a) {
    return Object.prototype.toString.call(a) === "[object Array]" &&
      a.length === 2 && isFinite(a[0]) && isFinite(a[1]) && +a[0] <= +a[1];
  }
  function validateDramaturgy(d) {
    if (!d || typeof d !== "object") bad("expected an object");
    if (typeof d.name !== "string" || !d.name) bad("name must be a non-empty string");
    if (!isRange(d.durationRangeS) || !(d.durationRangeS[0] > 0)) {
      bad("durationRangeS must be [lo, hi] seconds with 0 < lo <= hi");
    }
    if (typeof d.plan !== "function") bad("plan must be a function(rng, tidePos) -> scene list");
    if (!d.scenes || typeof d.scenes !== "object") bad("scenes must be an object of scene types");
    var count = 0;
    for (var type in d.scenes) {
      count++;
      var s = d.scenes[type];
      var where = 'scenes["' + type + '"]';
      if (!s || typeof s !== "object") bad(where + " must be an object");
      if (typeof s.intensity !== "function") bad(where + ".intensity must be a function(x, tidePos) -> 0..1");
      if (!isFinite(s.airLimit) || Math.floor(s.airLimit) !== +s.airLimit || s.airLimit < 1) {
        bad(where + ".airLimit must be an integer >= 1");
      }
      if (!isFinite(s.overlapChance) || s.overlapChance < 0 || s.overlapChance > 1) {
        bad(where + ".overlapChance must be a number in 0..1");
      }
      if (s.activityWeights != null) {
        if (Object.prototype.toString.call(s.activityWeights) !== "[object Array]" || !s.activityWeights.length) {
          bad(where + ".activityWeights must be a non-empty [[name, weight], ...] pool");
        }
      }
    }
    if (!count) bad("scenes must declare at least one scene type");
    if (typeof d.joint !== "function") bad("joint must be a function(fromType, toType, t, intensity, tools)");
    if (!isRange(d.chainOverlapS) || !(d.chainOverlapS[0] >= 0)) {
      bad("chainOverlapS must be [lo, hi] seconds with 0 <= lo <= hi");
    }
    if (!d.tide || typeof d.tide !== "object") bad("tide must be an object");
    if (!isRange(d.tide.periodPerfs) || !(d.tide.periodPerfs[0] >= 1)) {
      bad("tide.periodPerfs must be [lo, hi] performances with 1 <= lo <= hi");
    }
    if (Object.prototype.toString.call(d.tide.labels) !== "[object Array]" || !d.tide.labels.length) {
      bad("tide.labels must be a non-empty array of strings");
    }
  }

  // The plan is data from a function we don't own, drawn fresh every
  // performance — so it gets the same suspicion the static shape did.
  function validatePlan(d, plan, perfN) {
    var where = 'dramaturgy "' + d.name + '" plan for performance ' + perfN;
    if (Object.prototype.toString.call(plan) !== "[object Array]" || !plan.length) {
      bad(where + " must be a non-empty array");
    }
    for (var i = 0; i < plan.length; i++) {
      var seg = plan[i];
      if (!seg || typeof seg !== "object") bad(where + "[" + i + "] must be an object");
      if (!d.scenes[seg.type]) bad(where + "[" + i + '] has unknown scene type "' + seg.type + '"');
      if (!isFinite(seg.durS) || !(seg.durS > 0)) bad(where + "[" + i + "].durS must be > 0 seconds");
    }
  }

  // --------------------------------------------------------------------------
  function create(opts) {
    opts = opts || {};
    var clock = opts.clock;
    var rng = opts.rng;
    var D = opts.dramaturgy;
    var onEvent = opts.onEvent || null;
    var jointTools = opts.jointTools || null;
    var air = opts.air || null;
    var seed = opts.seed != null ? opts.seed : null;
    var laneName = opts.lane || "conductor";

    if (!clock || typeof clock.now !== "function" || typeof clock.lane !== "function") {
      throw new Error("PJ2.Conductor.create: opts.clock (a PJ2.Clock) is required");
    }
    if (!rng || typeof rng.fork !== "function") {
      throw new Error("PJ2.Conductor.create: opts.rng (a PJ2.Rand stream) is required");
    }
    validateDramaturgy(D);

    var lane = null;
    var running = false;
    var freshStart = false;   // the first scene after start() enters without
                              // a handoff — the facade fades the bus, not us

    function emit(evt) {
      if (!onEvent) return;
      try { onEvent(evt); } catch (ignored) { /* listeners can't stop the show */ }
    }

    // ------------------------------------------------------------------
    // THE TIDE — one seeded cosine, advanced per performance. Dedicated
    // fork: its series depends on nothing but the seed and the count of
    // performances, so voices reading it stay order-independent too.
    // ------------------------------------------------------------------
    var tideRng = rng.fork("tide");
    var tideStarted = false;
    var tidePhase = 0;
    var tidePeriod = 1;    // in performances; redrawn each full swing
    var tidePos = 0;       // 0 trough … 1 peak

    function drawTidePeriod() {
      return tideRng.rnd(D.tide.periodPerfs[0], D.tide.periodPerfs[1]);
    }
    function advanceTide() {
      if (!tideStarted) {
        tideStarted = true;
        tidePeriod = drawTidePeriod();
        // Open partway up the first slope (kolob's season trick) so a short
        // listen still hears the tide move instead of sitting on the trough.
        tidePhase = tideRng.rnd(0, 0.25);
      } else {
        tidePhase += 1 / tidePeriod;
        if (tidePhase >= 1) { tidePhase -= 1; tidePeriod = drawTidePeriod(); }
      }
      tidePos = 0.5 - 0.5 * Math.cos(2 * Math.PI * tidePhase);
    }
    // Labels partition the PHASE, not the position: a 3-label tide reads
    // trough-rising / peak / descent — "candlelit" and "late-night" are the
    // same height going opposite directions, and they should not share a name.
    function tideLabel() {
      var L = D.tide.labels;
      var i = Math.floor((tidePhase % 1) * L.length);
      if (i < 0) i = 0;
      if (i >= L.length) i = L.length - 1;
      return L[i];
    }

    // ------------------------------------------------------------------
    // Performance + scene state.
    // ------------------------------------------------------------------
    var perfN = 0;
    var perfRng = null;
    var plan = [];
    var perfStart = 0;
    var perfDur = 0;
    var chainOverlap = 0;

    var sceneIdx = -1;
    var sceneType = null;
    var sceneActivity = null;
    var sceneStart = 0;
    var sceneDur = 1;
    var sceneTide = 0;     // tidePos frozen at scene entry — the outgoing
                           // curve keeps its own weather under the crossfade

    // ------------------------------------------------------------------
    // INTENSITY — a function of absolute audio time, rebuilt at each
    // boundary as a crossfade over its own predecessor. iFn is always
    // callable; before start() it reports 0.
    // ------------------------------------------------------------------
    var iFn = function () { return 0; };
    var iFlat = null;        // the incoming scene's bare curve…
    var iFlattenAt = -1;     // …which replaces the blend chain once the fade
                             // is over (checked on the pulse; identical values
                             // by construction, so the swap is inaudible)

    // A scene's curve as a function of absolute time: x clamps to [0,1], so
    // an outgoing scene holds its final value under the incoming fade.
    function sceneCurveFn(def, t0, dur, tp) {
      return function (t) {
        var x = (t - t0) / dur;
        return clamp01(+def.intensity(x < 0 ? 0 : x > 1 ? 1 : x, tp) || 0);
      };
    }

    function installCurve(newFn, tB, newDur) {
      if (freshStart) {
        // First scene after start(): no predecessor worth fading from.
        freshStart = false;
        iFn = newFn;
        iFlat = null;
        return;
      }
      var prevFn = iFn;
      // Widen the window when the curves meet far apart: smoothstep's peak
      // slope is 1.5·gap/W, and we budget the blend HANDOFF_SLOPE per second
      // so the harness's continuity ruler (0.02 per 0.5s sample) always has
      // headroom left for the curves' own motion.
      var gap = Math.abs(newFn(tB) - prevFn(tB));
      var W = Math.max(HANDOFF_MIN_S, (1.5 * gap) / HANDOFF_SLOPE);
      // …but a fade should not outlive the scene it fades into. If it must
      // be cut short, the overlapping-handoff chain below absorbs the rest.
      var cap = Math.max(HANDOFF_MIN_S, 0.9 * newDur);
      if (W > cap) W = cap;
      iFn = function (t) {
        var u = (t - tB) / W;
        if (u <= 0) return prevFn(t);
        if (u >= 1) return newFn(t);
        var s = smooth(u);
        return prevFn(t) * (1 - s) + newFn(t) * s;
      };
      iFlat = newFn;
      iFlattenAt = tB + W;
    }

    function intensityAt(t) {
      return clamp01(iFn(t));
    }

    // ------------------------------------------------------------------
    // The plan of an evening.
    // ------------------------------------------------------------------
    function planPerformance(t) {
      perfN++;
      advanceTide();
      emit({
        type: "tide", pos: tidePos, label: tideLabel(),
        phase: tidePhase, periodPerfs: tidePeriod, perfN: perfN, t: t,
      });
      // The fresh fork is the whole reproducibility story: performance N's
      // plan depends on the master seed and N, nothing else. Draw order
      // inside the fork is fixed: plan first, then chain overlap, then any
      // activity draws in scene order.
      perfRng = rng.fork("performance:" + perfN);
      plan = D.plan(perfRng, tidePos);
      validatePlan(D, plan, perfN);
      chainOverlap = perfRng.rnd(D.chainOverlapS[0], D.chainOverlapS[1]);
      perfStart = t;
      perfDur = 0;
      var types = [];
      for (var i = 0; i < plan.length; i++) {
        perfDur += +plan[i].durS;
        types.push(plan[i].type);
      }
      emit({
        type: "performance", phase: "begin", n: perfN, t: t,
        durS: perfDur, sceneCount: plan.length, scenes: types,
        chainOverlapS: chainOverlap, tidePos: tidePos, tideLabel: tideLabel(),
      });
    }

    function enterScene(i, t) {
      var seg = plan[i];
      var def = D.scenes[seg.type];
      sceneIdx = i;
      sceneType = seg.type;
      sceneStart = t;
      sceneDur = +seg.durS;
      sceneTide = tidePos;
      // The plan may name the scene's activity; otherwise the scene type's
      // own weighted pool decides (a chapter can be "close reading" or
      // "turning pages" — flavor the voices read, nothing structural).
      sceneActivity = seg.activity != null
        ? seg.activity
        : (def.activityWeights ? perfRng.pickW(def.activityWeights) : null);
      installCurve(sceneCurveFn(def, t, sceneDur, sceneTide), t, sceneDur);
      emit({
        type: "scene", scene: sceneType, idx: i, count: plan.length,
        durS: sceneDur, activity: sceneActivity, tidePos: sceneTide, t: t,
      });
      // The boundary is placed ONCE, at exact audio time — arithmetic, not
      // polling. Everything that happens at the boundary happens at tB.
      lane.at(t + sceneDur, boundary);
    }

    function resolveTools() {
      var jt = jointTools;
      if (typeof jt === "function") {
        try { jt = jt(); } catch (e) { jt = null; }
      }
      return jt || {};
    }

    function callJoint(fromType, toType, tB) {
      var did = null, errMsg = null;
      try {
        did = D.joint(fromType, toType, tB, intensityAt(tB), resolveTools());
      } catch (e) {
        // A joint that throws must not stop the evening — report and walk on.
        errMsg = e && e.message ? e.message : String(e);
        if (typeof console !== "undefined" && console.error) {
          console.error("PJ2.Conductor: joint threw at t=" + tB, e);
        }
      }
      var evt = {
        type: "joint", from: fromType, to: toType,
        did: did == null ? null : did, t: tB,
      };
      if (errMsg) evt.error = errMsg;
      emit(evt);
    }

    // Every boundary — between scenes and between performances — funnels
    // through here at its exact audio time. Order at a performance seam:
    // end event, tide, plan (begin event), joint, scene — so a "performance"
    // event always precedes its plan's scenes, and the joint already knows
    // both shores of the seam it is marking.
    function boundary(tB) {
      var fromType = sceneType;
      var last = sceneIdx >= plan.length - 1;
      if (last) {
        emit({
          type: "performance", phase: "end", n: perfN, t: tB,
          elapsedS: tB - perfStart,
        });
        planPerformance(tB);
        // The conductor never stops here: the engine facade keeps the old
        // performance's tail fading for chainOverlap seconds under what we
        // are about to enter. Seamless is a property of the seam, and this
        // is the seam.
      }
      var nextIdx = last ? 0 : sceneIdx + 1;
      callJoint(fromType, plan[nextIdx].type, tB);
      enterScene(nextIdx, tB);
    }

    // ------------------------------------------------------------------
    // The public machine.
    // ------------------------------------------------------------------
    return {
      // Plans a performance and enters its first scene at now(). After a
      // stop(), start() begins a FRESH performance continuing the same
      // lineage (perfN and the tide keep counting) — for a bit-identical
      // rerun, build a new conductor from a fresh seed stream (the facade's
      // preferred stop/play behavior per SPEC-PHASE1 §7).
      start: function () {
        if (running) return;
        running = true;
        freshStart = true;
        lane = clock.lane(laneName);
        var t0 = clock.now();
        planPerformance(t0);
        enterScene(0, t0);
        // The pulse does housekeeping only: once a handoff is complete the
        // blend chain is flattened to the bare scene curve (identical values
        // past iFlattenAt, so nothing audible happens) — an evening of
        // boundaries must not stack closures under intensity().
        lane.every(function (t) {
          if (iFlat && t > iFlattenAt) { iFn = iFlat; iFlat = null; }
          return PULSE_S;
        });
      },

      // Cancels the lane (pending boundaries and the pulse die with it).
      // No musical gesture — fading is the engine facade's job. intensity()
      // keeps answering with the curve as it stood, so a fade-out reading
      // it doesn't fall off a cliff.
      stop: function () {
        if (!running) return;
        running = false;
        if (lane) lane.cancelAll();
      },

      // Continuous, tide- and scene-shaped, 0..1. The one number every
      // voice reads; the harness rules it with a 0.02-per-half-second ruler.
      intensity: function () {
        return intensityAt(clock.now());
      },
      // The same curve read at an arbitrary audio time — voices scheduling
      // ahead of now (everything on a lookahead clock does) should ask about
      // the moment their note SOUNDS, not the moment they think.
      intensityAt: intensityAt,

      scene: function () {
        var x = sceneDur > 0 ? (clock.now() - sceneStart) / sceneDur : 0;
        return { type: sceneType, activity: sceneActivity, x: clamp01(x) };
      },

      tide: function () {
        return { pos: tidePos, label: tideLabel(), phase: tidePhase, periodPerfs: tidePeriod };
      },

      // Convenience for wiring PJ2.Air: the current scene's declared manners.
      //   PJ2.Air.create({ clock, rng,
      //     limit:         conductor.airLimit,
      //     overlapChance: conductor.overlapChance })
      airLimit: function () {
        var def = sceneType && D.scenes[sceneType];
        return def ? def.airLimit : 1;
      },
      overlapChance: function () {
        var def = sceneType && D.scenes[sceneType];
        return def ? def.overlapChance : 0;
      },

      info: function () {
        var now = clock.now();
        var x = sceneDur > 0 ? clamp01((now - sceneStart) / sceneDur) : 0;
        return {
          running: running,
          perfN: perfN,
          seed: seed,
          dramaturgy: D.name,
          sceneType: sceneType,
          sceneIdx: sceneIdx,
          sceneCount: plan.length,
          activity: sceneActivity,
          x: x,
          intensity: intensityAt(now),
          tidePos: tidePos,
          tideLabel: tideLabel(),
          airHolders: air ? air.holders() : null,
          elapsedS: perfN ? now - perfStart : 0,
          durS: perfDur,
          chainOverlapS: chainOverlap,
        };
      },
    };
  }

  window.PJ2.Conductor = { create: create };
})();
