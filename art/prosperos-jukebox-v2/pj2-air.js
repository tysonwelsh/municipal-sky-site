// ============================================================================
// Prospero's Jukebox v2 — pj2-air.js
// PJ2.Air: the air — turn-taking with occasional overlap. Phase 1, module 5.
//
// Adapted from kolob's courtesy protocol (kolob-audio.js:391) and softened
// per the owner's note. In kolob the air was two numbers — busyUntil and a
// holder count — which worked because kolob's holders all expired together.
// v2's voices phrase at different lengths, so the air here keeps an actual
// list of claims, each with its own expiry, and sweeps the dead ones lazily
// against clock.now() whenever anyone asks anything. No timers, no audio,
// no scheduling: the air is pure bookkeeping about who is speaking and until
// when. Landscape voices (drone, hum bed, room tone, joints) never touch it —
// they are the room the speeches happen in.
//
// The softening: turn-taking is the norm, but when the air is full a voice
// may enter ANYWAY with a scene-dependent probability — the happy accident
// of two readers murmuring at once. Never past limit()+1 total holders; that
// cap is hard. `limit` and `overlapChance` are FUNCTIONS supplied by the
// caller (the conductor knows the scene; the air does not), so the protocol
// re-reads the scene's manners at every claim without ever knowing what a
// scene is.
//
// A claim occupies [now, now + durS + marginS] — the margin is enforced
// silence after the phrase, part of the utterance's footprint. A voice denied
// the air simply skips this utterance and asks again next cycle: the same
// graceful-thinning philosophy as the polyphony budget (never steal, never
// queue, just let the moment pass).
//
// Depends on nothing but its injected clock (for .now()) and rng stream.
// Loadable headless. No Date.now, no Math.random.
// ============================================================================

window.PJ2 = window.PJ2 || {};

PJ2.Air = (function () {
  "use strict";

  // create({ clock, rng, limit, overlapChance }) → Air
  //   clock         : PJ2.Clock (only .now() is used)
  //   rng           : a forked PJ2.Rand stream (only .chance() is used —
  //                   every overlap decision is a seeded draw)
  //   limit         : fn() → int   scene-dependent normal capacity (min 1)
  //   overlapChance : fn() → 0..1  scene-dependent chance of the +1 grant
  function create(opts) {
    opts = opts || {};
    var clock = opts.clock;
    var rng = opts.rng;
    var limitFn = opts.limit;
    var overlapFn = opts.overlapChance;

    if (!clock || typeof clock.now !== "function") {
      throw new Error("PJ2.Air.create: opts.clock with .now() is required");
    }
    if (!rng || typeof rng.chance !== "function") {
      throw new Error("PJ2.Air.create: opts.rng (a PJ2.Rand stream) is required");
    }
    if (typeof limitFn !== "function") {
      throw new Error("PJ2.Air.create: opts.limit must be a function returning an int");
    }
    if (typeof overlapFn !== "function") {
      throw new Error("PJ2.Air.create: opts.overlapChance must be a function returning 0..1");
    }

    var claims = [];       // live claims: { voice, since, until, overlap }
    var idCounter = 0;

    // Telemetry. The harness reconstructs concurrency from these; the demo
    // page just wants to watch the conversation's manners.
    var attempts = 0;      // every tryClaim call
    var grants = 0;        // claims granted (normal + overlap)
    var denials = 0;       // utterances that let the moment pass
    var overlapGrants = 0; // grants that went past limit() on the dice

    // The lazy sweep: expired claims are corpses until someone looks. Every
    // public call sweeps first, so holders() is always honest at the moment
    // of asking and nothing needs a timer to stay true.
    function sweep() {
      var now = clock.now();
      var live = [];
      for (var i = 0; i < claims.length; i++) {
        if (claims[i].until > now) live.push(claims[i]);
      }
      claims = live;
    }

    function currentLimit() {
      var n = Math.floor(+limitFn());
      // A limit below 1 would mean nobody may ever speak — refuse the
      // garbage and keep the conversation possible.
      return n >= 1 ? n : 1;
    }

    return {
      // tryClaim(voiceName, durS, marginS) → token | null
      // Grants when holders < limit(). When the air is full, grants ANYWAY
      // with probability overlapChance() — but never past limit()+1 total
      // holders, hard. The returned token is the claim record itself
      // ({voice, since, until, overlap}) — readable telemetry, and the
      // handle for an early release().
      tryClaim: function (voiceName, durS, marginS) {
        sweep();
        attempts++;
        var lim = currentLimit();
        var overlap = false;
        if (claims.length >= lim) {
          // The air is spoken for. One extra voice may still slip in — the
          // happy accident — but only one, and only on the dice.
          // NOTE: the overlap draw happens only on a full air, so a quiet
          // scene consumes fewer rng draws than a busy one. That is fine:
          // this stream is the air's own fork and perturbs nobody else.
          if (claims.length >= lim + 1 || !rng.chance(+overlapFn())) {
            denials++;
            return null;
          }
          overlap = true;
          overlapGrants++;
        }
        var now = clock.now();
        var m = marginS != null ? +marginS : 0;
        if (!(m >= 0)) m = 0;
        var d = +durS;
        if (!(d >= 0)) d = 0;
        var token = {
          id: ++idCounter,
          voice: String(voiceName),
          since: now,
          until: now + d + m,
          overlap: overlap,
        };
        claims.push(token);
        grants++;
        return token;
      },

      // Early release — rarely needed; claims auto-expire by time. Releasing
      // an expired or unknown token is a harmless no-op.
      release: function (token) {
        if (!token) return;
        for (var i = 0; i < claims.length; i++) {
          if (claims[i] === token || claims[i].id === token.id) {
            claims.splice(i, 1);
            return;
          }
        }
      },

      // Current holder count. Sweeps first, so this is the truth at now().
      holders: function () {
        sweep();
        return claims.length;
      },

      // Total overlap grants across the run — the telemetry the aesthetic
      // rule is checked against ("rare", not "duet norm").
      overlapCount: function () {
        return overlapGrants;
      },

      // Full telemetry snapshot for the demo page / harness.
      info: function () {
        sweep();
        return {
          holders: claims.length,
          limit: currentLimit(),
          attempts: attempts,
          grants: grants,
          denials: denials,
          overlapGrants: overlapGrants,
        };
      },
    };
  }

  return { create: create };
})();
