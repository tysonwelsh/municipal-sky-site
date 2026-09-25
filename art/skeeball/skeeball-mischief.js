/* HOLLER ROLLER — the derangement (PLAN.md §4, PLAN-2 §7)
 *
 * "Deranged like a 90s Nicktoon, not unfair like a broken toy." Every
 * event is announced before it matters, none steals a throw, and each
 * one either costs nothing or pays out:
 *
 *   THE LEAN     every nickel the lane warps a little to one side: a
 *                constant lateral pull `laneSideA` of 0.06–0.14 u/s², sign
 *                and size from the game seed. Ball one teaches it. The
 *                chalk ghost stays honest (it shows aim, not the drift).
 *   MOON         about one game in four, for one ball (never ball 1): the
 *                room goes bruise-purple and the 100 holes breathe. It is
 *                announced as the ball before it is thrown (a throw takes
 *                ≥ 1.76 s to resolve, so ≥ 1.5 s before the moon ball can
 *                be thrown), and during that ball the
 *                100 holes are 1.5× wider. It sets at that ball's `done`.
 *   THE SULK     after a 100 the next ball is refused once: it rolls up
 *                onto the hop, stops and rolls back. It is NOT consumed —
 *                main re-racks it. The possum's eyes narrow for 3 s and the
 *                next bell rings flat (audio).
 *   TICKET JAM   about one payout in six jams mid-crank. Tap the ticket
 *                slot to whack it loose; it unjams by itself after 6 s.
 *                The tickets were credited before the crank: always pays.
 *   POSSUM       three scores of 40+ in a row and the head tilts 1 px for
 *                the rest of the game.
 *
 * Everything is a pure function of (game seed, ball index, event history)
 * plus the injected clock (tick(t)); no Math.random, no Date. Moon and jam
 * games come in jittered blocks (see blockHit), so the history they read
 * is the seeds of the games played since attach.
 *
 *   var mis = SkeeBallMischief.attach(game, opts)
 *   game: { seed, on(fn) → unsubscribe, emit(ev), view, flags, rng,
 *           now?() , physics? (defaults to window.SkeeBallPhysics) }
 *   opts: { enabled (default true), rates: {moon .25, sulk 1, jam 1/6,
 *           lean 1 (multiplier)}, force: {moon: ball, sulk: ball|true,
 *           jam: ticket|true, lean: u/s²} }
 *   mis.gameStart(gameSeed)
 *   mis.beforeThrow(ball, {x0, v, aim, spin}) → {tuneOverride, refuse, refuseV}
 *   mis.tick(t)          on the sim clock, every step
 *   mis.crankHeld()      true while the ticket strip is jammed
 *   mis.whack()          same as an `input {kind:'whack'}` event
 *   mis.state(), mis.log(), mis.destroy()
 *   SkeeBallMischief.plan(gameSeed, rates, force) → the game's hidden roll
 *
 * Events out (game.emit): moon {ball, lead}, sulk {ball}, jam {ticketsAt,
 * tickets}, unjam {whacked, after}, possum {tilt: true}.
 * Flags: skeeball.saw-the-moon, skeeball.hit-100, skeeball.made-it-sulk,
 * skeeball.jammed.
 * View fields: moon {t0, phase 'rising'|'full'|'setting', k 0..1, ball},
 * sulk {t0, ball}, narrowT0, jam {t0, ticketsAt}, unjamT0, tilt 0|1.
 */
(function (root) {
  'use strict';

  var BALLS = 9;
  var LEAN_MIN = 0.06, LEAN_MAX = 0.14;   // |laneSideA|, units/s²
  var MOON_LEAD = 1.5;                    // s of 'rising' before the moon is full
  var MOON_SET = 1.0;                     // s of 'setting' after the moon ball's done
  var MOON_HOLES = 1.5;                   // 100-hole capture radius × this
  var NARROW_T = 3;                       // (renderer) eyes narrowed this long
  var JAM_AUTO = 6;                       // s until a jam frees itself
  var TILT_RUN = 3, TILT_SCORE = 40;
  // the refusal: a backward pull on the hop, sized so the ball stops about
  // REFUSE_STOP up the hop (crest at 0.7), then walks home as a dead roll
  var REFUSE_STOP = 0.45, REFUSE_A_MIN = 12, REFUSE_A_MAX = 160;
  var REFUSE_V = 1.55;                    // fallback when physics has no hopBackA: a dead roll
  var HOLE_R = 0.14, HOLE_DIRECT_R = 0.085; // fallbacks (physics TUNE round 4)
  var DEFAULT_RATES = { moon: 0.25, sulk: 1, jam: 1 / 6, lean: 1 };
  var SALT = { lean: 0x1ea4, sign: 0x5167, moon: 0x300d, moonBall: 0xba11, jam: 0x7a33, jamAt: 0x7a34, sulk: 0x5a1c };
  var OWN = { moon: 1, sulk: 1, jam: 1, unjam: 1, possum: 1 };

  // the physics module's hash (same constants): deterministic → [0, 1)
  function hash01(seed, i) {
    var h = (Math.imul(seed | 0, 0x9E3779B1) ^ Math.imul(((i | 0) + 0x7F4A7C15) | 0, 0x85EBCA77)) >>> 0;
    h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function r4(x) { return Math.round(x * 1e4) / 1e4; }

  function mergeRates(r) {
    var o = {}, k;
    for (k in DEFAULT_RATES) o[k] = DEFAULT_RATES[k];
    if (r) for (k in r) if (typeof r[k] === 'number' && r[k] >= 0) o[k] = r[k];
    return o;
  }

  // Rare events come in jittered blocks: with rate p, each run of
  // L = round(1/p) consecutive games holds exactly one, at a slot drawn
  // from the seed of the block's first game (so at 1/4: one moon in every
  // four games, two to seven games apart; never a drought or a cluster).
  // `k` is the game's index since attach; the anchors live in `sched`.
  function blockHit(sched, kind, rate, k, seed) {
    if (!(rate > 0)) return false;
    if (rate >= 1) return true;
    var L = Math.max(1, Math.round(1 / rate)), b = Math.floor(k / L);
    if (k % L === 0 || sched[kind] == null) sched[kind] = seed | 0;
    return k % L === Math.floor(hash01(sched[kind], SALT[kind] + b) * L);
  }

  // the game's hidden roll: lean, moon ball (0 = none), whether the payout
  // jams. Without `sched` (a pure call) moon and jam are plain seeded coin
  // flips at their rates; attach() passes its block schedule.
  function plan(gameSeed, rates, force, sched, k) {
    rates = mergeRates(rates); force = force || {};
    var s = gameSeed | 0;
    var mag = LEAN_MIN + (LEAN_MAX - LEAN_MIN) * hash01(s, SALT.lean);
    var lean = (hash01(s, SALT.sign) < 0.5 ? -1 : 1) * mag * rates.lean;
    if (typeof force.lean === 'number') lean = force.lean;
    var moonHit = sched ? blockHit(sched, 'moon', rates.moon, k, s) : hash01(s, SALT.moon) < rates.moon;
    var moonBall = moonHit ? 2 + Math.floor(hash01(s, SALT.moonBall) * (BALLS - 1)) : 0;
    if (typeof force.moon === 'number' && force.moon > 0) moonBall = clamp(force.moon | 0, 2, BALLS);
    var jam = sched ? blockHit(sched, 'jam', rates.jam, k, s) : hash01(s, SALT.jam) < rates.jam;
    if (force.jam) jam = true;
    return { seed: s, lean: r4(lean), moonBall: moonBall, jam: jam, jamFrac: hash01(s, SALT.jamAt) };
  }

  function attach(game, opts) {
    game = game || {};
    opts = opts || {};
    var enabled = opts.enabled !== false;
    var rates = mergeRates(opts.rates);
    var force = opts.force || {};
    var view = game.view || {};
    var flags = game.flags || null;
    var physics = game.physics || root.SkeeBallPhysics || null;
    var PT = physics && physics.TUNE ? physics.TUNE : null;
    function supports(field) { return !!(PT && Object.prototype.hasOwnProperty.call(PT, field)); }
    var baseTune = game.tune || {};
    var holeR = baseTune.holeR || (PT && PT.holeR) || HOLE_R;
    var holeDirectR = baseTune.holeDirectR || (PT && PT.holeDirectR) || HOLE_DIRECT_R;

    var clock = 0, dead = false, log = [];
    var sched = {}, gamesSeen = 0; // block anchors for moon and jam, games started since attach
    var g = null; // this game's state

    function now() { return typeof game.now === 'function' ? game.now() : clock; }
    function note(kind, data) {
      var e = { k: kind, ball: g ? g.ball : 0 };
      if (data) for (var key in data) e[key] = data[key];
      log.push(e);
      if (log.length > 4096) log.shift();
    }
    function flag(key) { if (flags && flags.set) { try { flags.set(key); } catch (e) { } } }
    function emit(ev) {
      ev.mischief = true;
      if (game.emit) { try { game.emit(ev); } catch (e) { } }
    }

    function gameStart(gameSeed) {
      var s = (gameSeed == null ? game.seed : gameSeed) | 0;
      g = {
        plan: plan(s, rates, force, sched, gamesSeen++), ball: 0,
        moon: null,               // {ball, t0, t1 (set), thrown}
        moonPending: 0,           // announce over this ball on the next tick
        sulkBall: 0, sulked: {},  // the ball to refuse once; balls already refused
        refusing: false,          // a refused ball is rolling home
        lastScore: null, streak: 0, tilted: false,
        jamAt: 0, jam: null, tickets: 0
      };
      if (typeof force.sulk === 'number') g.sulkBall = force.sulk | 0;
      else if (force.sulk === true) g.sulkBall = 2;
      view.moon = null; view.sulk = null; view.jam = null; view.tilt = 0;
      view.narrowT0 = null; view.unjamT0 = null;
      note('game', { seed: s, lean: g.plan.lean, moonBall: g.plan.moonBall, jam: g.plan.jam });
      return g.plan;
    }

    /* ── the moon ─────────────────────────────────────────────────── */
    function announceMoon(ball) {
      var t = now();
      g.moon = { ball: ball, t0: t, t1: null, thrown: false };
      view.moon = { t0: t, phase: 'rising', k: 0, ball: ball };
      flag('skeeball.saw-the-moon');
      note('moon', { moonBall: ball });
      emit({ type: 'moon', ball: ball, lead: MOON_LEAD });
    }
    function flushMoon() { var b = g.moonPending; g.moonPending = 0; announceMoon(b); }
    function setMoon() {
      if (!g || !g.moon || g.moon.t1 != null) return;
      g.moon.t1 = now();
      note('moonset', { moonBall: g.moon.ball });
    }

    /* ── the throw ────────────────────────────────────────────────── */
    function beforeThrow(ball, args) {
      var out = { tuneOverride: null, refuse: false, refuseV: null };
      if (!enabled || dead) return out;
      if (!g) gameStart(game.seed);
      if (g.moonPending) flushMoon();
      ball = ball | 0;
      g.ball = ball;
      var ov = { laneSideA: g.plan.lean };
      out.tuneOverride = ov;
      // THE SULK: the first throw of the ball after a 100 is refused
      if (g.sulkBall === ball && !g.sulked[ball]) {
        g.sulked[ball] = true;
        g.refusing = true;
        var v = args && typeof args.v === 'number' ? args.v : 7.2;
        if (supports('hopBackA') || !physics) ov.hopBackA = r4(clamp(v * v / (2 * REFUSE_STOP), REFUSE_A_MIN, REFUSE_A_MAX));
        else out.refuseV = REFUSE_V;
        out.refuse = true;
        var t = now();
        view.sulk = { t0: t, ball: ball };
        view.narrowT0 = t;
        flag('skeeball.made-it-sulk');
        note('sulk', { hopBackA: ov.hopBackA || null });
        emit({ type: 'sulk', ball: ball });
        return out;
      }
      // the moon ball: wider 100s
      if (g.moon && g.moon.ball === ball && g.moon.t1 == null) {
        ov.holeR = r4(holeR * MOON_HOLES);
        ov.holeDirectR = r4(holeDirectR * MOON_HOLES);
        g.moon.thrown = true;
        note('moonthrow', { lead: r4(now() - g.moon.t0) });
      }
      // an accepted throw announces a moon over the next ball — on the next
      // tick, so listeners hear this ball's `throw` before the `moon` (the
      // audio ends the moon at the first `done` after a `throw`)
      if (g.plan.moonBall === ball + 1 && !g.moon) g.moonPending = ball + 1;
      note('throw', { lean: ov.laneSideA, holeR: ov.holeR || null });
      return out;
    }

    /* ── events in ────────────────────────────────────────────────── */
    function onEvent(ev) {
      if (dead || !enabled || !ev || !ev.type || ev.mischief || OWN[ev.type]) return;
      var type = ev.type;
      if (type === 'mode') {
        if (ev.mode !== 'play' && g) {
          setMoon();
          if (g.jam && !g.jam.done && ev.mode !== 'payout') unjam(false, 'leave');
        }
        return;
      }
      if (!g) return;
      if (type === 'ballstart') { g.ball = ev.n | 0; return; }
      if (type === 'captured') {
        if (ev.refused || g.refusing) return;
        g.lastScore = ev.score | 0;
        if (ev.score === 100) {
          flag('skeeball.hit-100');
          var next = g.ball + 1;
          if (next <= BALLS && !g.sulked[next] && hash01(g.plan.seed, SALT.sulk + g.ball) < rates.sulk) {
            g.sulkBall = next;
            note('sulkarmed', { next: next });
          }
        }
        return;
      }
      if (type === 'done') {
        if (ev.refused || g.refusing) {
          g.refusing = false;
          view.sulk = null;
          note('rerack');
          return;
        }
        var s = typeof ev.score === 'number' ? ev.score : (g.lastScore || 0);
        g.lastScore = null;
        g.streak = s >= TILT_SCORE ? g.streak + 1 : 0;
        if (g.streak >= TILT_RUN && !g.tilted) {
          g.tilted = true;
          view.tilt = 1;
          note('possum');
          emit({ type: 'possum', tilt: true });
        }
        if (g.moon && g.moon.thrown && g.moon.ball === g.ball) setMoon();
        return;
      }
      if (type === 'gameover') {
        setMoon();
        g.tickets = ev.tickets | 0;
        if (g.plan.jam && g.tickets >= 2) {
          g.jamAt = typeof force.jam === 'number' ? clamp(force.jam | 0, 1, g.tickets - 1)
            : 1 + Math.floor(g.plan.jamFrac * (g.tickets - 1));
          note('jamarmed', { at: g.jamAt, tickets: g.tickets });
        }
        return;
      }
      if (type === 'ticket') {
        if (g.jamAt && !g.jam && (ev.n | 0) === g.jamAt) {
          var t = now();
          g.jam = { t0: t, at: g.jamAt, done: false };
          view.jam = { t0: t, ticketsAt: g.jamAt };
          flag('skeeball.jammed');
          note('jam', { at: g.jamAt });
          emit({ type: 'jam', ticketsAt: g.jamAt, tickets: g.tickets });
        }
        return;
      }
      if (type === 'input' && ev.kind === 'whack') whack();
    }

    function unjam(whacked, why) {
      if (!g || !g.jam || g.jam.done) return false;
      var t = now();
      g.jam.done = true;
      view.jam = null;
      view.unjamT0 = t;
      var after = r4(t - g.jam.t0);
      note('unjam', { whacked: whacked, after: after, why: why || null });
      emit({ type: 'unjam', whacked: whacked, after: after });
      return true;
    }
    function whack() { return unjam(true, 'whack'); }
    function crankHeld() { return !!(enabled && g && g.jam && !g.jam.done); }

    /* ── the clock ────────────────────────────────────────────────── */
    function tick(t) {
      if (dead) return;
      if (typeof t === 'number' && t > clock) clock = t;
      if (!g) return;
      if (g.moonPending) flushMoon();
      var tn = now();
      var m = g.moon;
      if (m) {
        var e = tn - m.t0;
        if (m.t1 == null) {
          if (e < MOON_LEAD) view.moon = { t0: m.t0, phase: 'rising', k: r4(clamp(e / MOON_LEAD, 0, 1)), ball: m.ball };
          else view.moon = { t0: m.t0, phase: 'full', k: 1, ball: m.ball };
        } else if (tn - m.t1 < MOON_SET) {
          view.moon = { t0: m.t0, phase: 'setting', k: r4(clamp(1 - (tn - m.t1) / MOON_SET, 0, 1)), ball: m.ball };
        } else if (view.moon) view.moon = null;
      }
      if (g.jam && !g.jam.done && tn - g.jam.t0 >= JAM_AUTO) unjam(false, 'auto');
    }

    var unsub = enabled && game.on ? game.on(onEvent) : null;

    function destroy() {
      dead = true;
      if (typeof unsub === 'function') { try { unsub(); } catch (e) { } }
      view.moon = null; view.sulk = null; view.jam = null; view.tilt = 0;
    }

    return {
      gameStart: gameStart,
      beforeThrow: beforeThrow,
      tick: tick,
      crankHeld: crankHeld,
      whack: whack,
      destroy: destroy,
      state: function () {
        return g ? {
          lean: g.plan.lean, moonBall: g.plan.moonBall, jamPlanned: g.plan.jam, ball: g.ball,
          moon: g.moon ? { ball: g.moon.ball, t0: g.moon.t0, t1: g.moon.t1, thrown: g.moon.thrown } : null,
          sulkBall: g.sulkBall, refusing: g.refusing, streak: g.streak, tilted: g.tilted,
          jamAt: g.jamAt, jammed: crankHeld(), enabled: enabled
        } : { enabled: enabled };
      },
      log: function () { return log.slice(); }
    };
  }

  var api = {
    attach: attach, plan: plan, hash01: hash01,
    CONST: {
      LEAN_MIN: LEAN_MIN, LEAN_MAX: LEAN_MAX, MOON_LEAD: MOON_LEAD, MOON_SET: MOON_SET,
      MOON_HOLES: MOON_HOLES, NARROW_T: NARROW_T, JAM_AUTO: JAM_AUTO, TILT_RUN: TILT_RUN,
      TILT_SCORE: TILT_SCORE, REFUSE_STOP: REFUSE_STOP, REFUSE_V: REFUSE_V, DEFAULT_RATES: DEFAULT_RATES
    }
  };
  root.SkeeBallMischief = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
