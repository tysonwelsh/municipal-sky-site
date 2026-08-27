// ============================================================================
// Prospero's Jukebox v2 — pj2-rand.js
// PJ2.Rand: seeded random streams. Phase 0, module 1 of 4.
//
// The whole v2 engine flows from one seed. v1 (and every sibling before
// kolob-text) shared a single global RNG, which meant adding one extra draw
// in the ambient layer silently re-rolled every melody note after it — the
// music changed because a *raven cry* got a new parameter. The fix, learned
// the hard way in kolob-text.js, is streams: each subsystem forks its own
// independent sequence off the master seed, so subsystems can evolve their
// draw counts freely without perturbing each other. Same seed, same label,
// same music. Forever.
//
// Core is mulberry32, the same generator zankyo-audio.js:60 and
// kolob-audio.js:80 use — tiny, fast, passes the statistical tests that
// matter for art (we are choosing scale degrees, not keys).
//
// This module is PURE: no window state beyond the namespace, no Math.random,
// no Date.now, no DOM. Loadable headless. It depends on nothing.
// ============================================================================

window.PJ2 = window.PJ2 || {};

PJ2.Rand = (function () {
  "use strict";

  // FNV-1a 32-bit over a label string. We only need labels like
  // "melody:library" and "viz" to land on well-separated 32-bit values;
  // FNV-1a's avalanche is plenty for that and it's four lines.
  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // Final mix (murmur3-style avalanche) applied to (parentSeed ^ labelHash).
  // Without this, seeds 1 and 2 would produce child seeds that also differ
  // by ~1 bit, and mulberry32's early outputs from near-identical seeds are
  // visibly correlated. One avalanche pass scatters them across the space.
  function mix(a, b) {
    var h = (a ^ b) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }

  // ==========================================================================
  // stream(seed) → Stream
  // ==========================================================================
  function stream(seed) {
    // The birth seed is remembered separately from the advancing state:
    // fork() derives children from the ORIGINAL seed, never from the current
    // state, so a fork made after ten thousand draws is identical to one made
    // at birth. That is the whole contract — "same parent seed + same label
    // ⇒ same child sequence, always" — and it is what lets the engine fork
    // "conductor" late in setup without caring what ran first.
    var seed0 = seed >>> 0;
    var state = seed0;

    // mulberry32 — one 32-bit word of state, returns float in [0,1).
    function next() {
      state |= 0;
      state = (state + 0x6D2B79F5) | 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    return {
      next: next,

      // float in [a, b)
      rnd: function (a, b) {
        return a + next() * (b - a);
      },

      // int in [a, b] inclusive — next() < 1 strictly, so floor never
      // overshoots b.
      rint: function (a, b) {
        return Math.floor(a + next() * (b - a + 1));
      },

      chance: function (p) {
        return next() < p;
      },

      pick: function (arr) {
        return arr[Math.floor(next() * arr.length)];
      },

      // pool = [[value, weight], ...] — same shape as v1's ambient pools.
      // The trailing return covers float-sum residue on the last entry.
      pickW: function (pool) {
        var total = 0, i;
        for (i = 0; i < pool.length; i++) total += pool[i][1];
        var r = next() * total;
        for (i = 0; i < pool.length; i++) {
          r -= pool[i][1];
          if (r <= 0) return pool[i][0];
        }
        return pool[pool.length - 1][0];
      },

      // Fisher-Yates on a COPY — callers keep their arrays. Sibling engines
      // learned to never mutate the constant tables (v1's motif memory once
      // reversed a scale array in place; the track stayed upside-down until
      // reload).
      shuffle: function (arr) {
        var out = arr.slice();
        for (var i = out.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var tmp = out[i];
          out[i] = out[j];
          out[j] = tmp;
        }
        return out;
      },

      // NEW independent stream, seed derived from the birth seed + hashed
      // label. Deterministic, order-independent, nestable: a fork can fork.
      fork: function (label) {
        return stream(mix(seed0, fnv1a(String(label))));
      },
    };
  }

  return { stream: stream };
})();
