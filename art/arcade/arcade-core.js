/* Arcade core — the engine room of the Appalachian arcade universe.
 *
 * Everything a cabinet needs that isn't the cabinet: the canvas boot with
 * crisp integer scaling, the one save document (currencies, inventory,
 * per-game stats, world flags), the event bus, and the seeded RNG.
 *
 * Economy law (see WORLD.md): TOKENS are the play money every machine
 * eats (in-lore name TBD; the save key stays 'tokens' forever). SCRIP is
 * the pink paper tickets — won at skill games, spent at the redemption
 * counter. The coin pusher pays tokens back and drops prizes directly.
 *
 * Cabinet contract: every game exposes  Game.mount(container, opts)  and
 * returns a handle with destroy() and pause()/resume(). Events out via
 * opts.onEvent and/or Arcade.on(): 'tokens', 'scrip', 'inventory', 'flag',
 * and per-game events like 'gameover'. An RPG shell later mounts the same
 * factories inside the big building and listens.
 */
window.Arcade = (function () {
  'use strict';

  var SAVE_KEY = 'holler.v1';
  var STARTER_TOKENS = 20; // until the changer by the front door exists

  /* ── event bus ─────────────────────────────────────────────────────── */
  var listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return fn; }
  function off(ev, fn) {
    var l = listeners[ev]; if (!l) return;
    var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
  }
  function emit(ev, detail) {
    var l = listeners[ev]; if (!l) return;
    for (var i = 0; i < l.length; i++) {
      try { l[i](detail); } catch (e) { /* one bad listener never kills the bus */ }
    }
  }

  /* ── the save document ─────────────────────────────────────────────── */
  function freshSave() {
    return { v: 1, tokens: STARTER_TOKENS, scrip: 0, inventory: [], games: {}, flags: {} };
  }
  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return freshSave();
      var d = JSON.parse(raw);
      // merge over defaults so old saves survive new fields
      var base = freshSave();
      for (var k in base) if (d[k] === undefined) d[k] = base[k];
      return d;
    } catch (e) { return freshSave(); }
  }
  var data = load();
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* private mode etc. */ }
  }
  persist(); // first visit mints the starter pocket immediately

  /* ── currency ledgers (tokens + scrip, same interface) ─────────────── */
  function ledger(field) {
    return {
      get: function () { return data[field]; },
      add: function (n, source) {
        n = Math.max(0, n | 0); if (!n) return data[field];
        data[field] += n; persist();
        emit(field, { balance: data[field], delta: n, source: source || null });
        return data[field];
      },
      spend: function (n, source) {
        n = Math.max(0, n | 0);
        if (data[field] < n) return false;
        data[field] -= n; persist();
        emit(field, { balance: data[field], delta: -n, source: source || null });
        return true;
      }
    };
  }
  var tokens = ledger('tokens');
  var scrip = ledger('scrip');

  /* ── inventory: prizes are objects, not point values ───────────────── */
  var inventory = {
    all: function () { return data.inventory.slice(); },
    has: function (id) { return data.inventory.indexOf(id) >= 0; },
    count: function (id) {
      var n = 0;
      for (var i = 0; i < data.inventory.length; i++) if (data.inventory[i] === id) n++;
      return n;
    },
    // unique items refuse duplicates (there is only one glass eye)
    grant: function (id, opts) {
      if (opts && opts.unique && inventory.has(id)) return false;
      data.inventory.push(id); persist();
      emit('inventory', { id: id });
      return true;
    }
  };

  /* ── world flags: what the machines have seen you see ──────────────── */
  var flags = {
    get: function (key) { return !!data.flags[key]; },
    set: function (key) {
      if (data.flags[key]) return;
      data.flags[key] = true; persist();
      emit('flag', { key: key });
    }
  };

  // per-game stats bag; mutate it, then call Arcade.persist()
  function stats(gameId) {
    if (!data.games[gameId]) data.games[gameId] = {};
    return data.games[gameId];
  }

  /* ── deterministic RNG (mulberry32) ────────────────────────────────── */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ── canvas boot: crisp integer scaling in device pixels ───────────── */
  function mountCanvas(container, w, h, label) {
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.className = 'arcade-canvas';
    if (label) canvas.setAttribute('aria-label', label);
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function fit() {
      var dpr = window.devicePixelRatio || 1;
      var availW = container.clientWidth * dpr;
      var availH = container.clientHeight * dpr;
      var scale = Math.max(1, Math.floor(Math.min(availW / w, availH / h)));
      canvas.style.width = (w * scale / dpr) + 'px';
      canvas.style.height = (h * scale / dpr) + 'px';
    }
    fit();
    window.addEventListener('resize', fit);

    return {
      canvas: canvas,
      ctx: ctx,
      refit: fit,
      destroy: function () {
        window.removeEventListener('resize', fit);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  return {
    SAVE_KEY: SAVE_KEY,
    on: on, off: off, emit: emit,
    tokens: tokens, scrip: scrip,
    inventory: inventory, flags: flags,
    stats: stats, persist: persist,
    rng: rng,
    mountCanvas: mountCanvas
  };
})();
