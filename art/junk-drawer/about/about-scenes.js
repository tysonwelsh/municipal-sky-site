/* ============================================================================
   about-scenes.js — the walkthrough's scroll engine (PLAN-PORTFOLIO v3).

   The /about/ page is a sticky-graphic scrollytelling piece: ONE pinned
   visual pane on the left (top, on a phone) and a column of steps beside it.
   Each step declares the scene it belongs to; as a step comes into view the
   pane is switched to that scene and the scene is told which step is showing.

   FOUR SCENES, and every one of them is the REAL app, not a screenshot:
     drawer      — the live pile, exactly as the art page mounts it
     instrument  — the real turn card (JD_turn.curate), network sealed
     record      — the real report card (JD_record.open)
     analytics   — the real analytics folder (JD_folder.open)

   The three modal scenes normally mount as full-screen scrims on <body>.
   Inline mode (see about.css) re-parents each scrim into the pane and flows
   it in place. Nothing here re-implements a card: if the drawer changes, this
   page changes with it, which is the whole reason it is built this way.

   PROGRESSIVE ENHANCEMENT: without the engine the page stays as its markup
   already reads — every step a plain block of prose under the drawer. The
   engine only ever ADDS.

   ---------------------------------------------------------------------------
   THE MOTION (rebuilt 2026-09-15, owner: "it scrolls up a little bit and then
   fades out, which ruins the effect — it needs to keep scrolling until it is
   all the way off the page before it disappears").

   A scene change is a HANDOFF that the reader's own scrolling performs. For
   the width of one pane either side of a scene boundary, the outgoing
   graphic rides UP at exactly the page's speed — one pixel of graphic per
   pixel of scroll, the same rate as the prose beside it — until every pixel
   of it has left the pane, and the incoming graphic follows it up from
   below at the same speed until it comes to rest. No fade. No clock. The
   position is a function of the scroll offset and nothing else, so scrolling
   back down reverses it exactly, and stopping anywhere leaves both graphics
   exactly where the hand left them.

   Two things had to change for that to be possible:

   1. THE MODULES ALLOW ONE CARD AT A TIME (JD_layerOpen), and the outgoing
      card has to be closed before the incoming can open. So during the
      handoff the pane shows SNAPSHOTS: at the boundary the outgoing card is
      cloned into a static ghost that keeps travelling on the scroll while
      the real card is closed and the next one mounts; the incoming card
      arrives as a ghost too (cloned the last time it was seen, or
      pre-rendered once at load, off-screen, so even the first arrival has
      something to show) and is swapped for the real card the moment that
      has rendered and been fitted. The swap is invisible: same DOM, same
      size, same place.

   2. NOTHING RUNS ON A FRAME CLOCK. requestAnimationFrame is withheld in a
      hidden tab, and a stepper gated on it stayed dead after the first
      dropped frame (the flag that said "a frame is coming" was never reset
      — every later scroll was ignored until reload). The scroll handler now
      runs on the frame when one comes and on a short timer when none does.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.jd-about');
  var pane = document.getElementById('jd-about-pane');
  if (!root || !pane) return;

  var stepEls = [].slice.call(root.querySelectorAll('.jd-step[data-scene]'));
  if (!stepEls.length) return;

  var API = window.JD_API || '';
  var BASE = '/art/junk-drawer/';
  var SPECIMEN = '2026-07-28-desktop-succulent';
  /* the four the owner chose; claude-opus-5 is on file but sits this out */
  var CAST = ['claude-fable-5', 'kimi-k3', 'gemini-3-1-pro', 'gpt-5-1'];

  root.classList.add('jd-about--live');

  /* ---- the payload, read once and shared ---------------------------------
     Grades and axis values are NEVER hard-coded here: they are read from
     data.php, the same source the drawer and the report card read, so this
     page cannot quietly disagree with the record it is describing. */
  var dataP = null;
  function payload() {
    if (!dataP) {
      dataP = fetch(API + BASE + 'data.php')
        .then(function (r) { return r.ok ? r.json() : null; });
    }
    return dataP;
  }
  function specimen(d) {
    var items = (d && d.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === SPECIMEN) return items[i];
    }
    return null;
  }

  /* ---- the pane ----------------------------------------------------------
     Scenes are siblings in the pane; the stepper names exactly one as
     current. Scenes mount lazily (the first time they are shown, or by the
     pre-render at load) and are never torn down — the drawer in particular
     carries its own sizing maths and compositing layer and must be built
     once, not rebuilt per scroll. */
  var sceneEls = {};
  var sceneOrder = [];
  [].slice.call(pane.querySelectorAll('[data-scene-pane]')).forEach(function (el) {
    var n = el.getAttribute('data-scene-pane');
    sceneEls[n] = el;
  });
  /* scene order comes from the STEPS, not the pane: it is the order the
     reader meets them in */
  stepEls.forEach(function (el) {
    var sc = el.getAttribute('data-scene');
    if (sceneOrder.indexOf(sc) < 0 && sceneEls[sc]) sceneOrder.push(sc);
  });

  var scenes = {};
  var curScene = null, curStep = null;
  var prerender = null;          /* the scene being rendered off-screen, if any */

  function wanted(name) { return curScene === name || prerender === name; }

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* the air between the outgoing graphic's foot and the incoming one's head,
     as they pass through the pane in one continuous strip */
  var GAP = 28;

  /* ---- THE SCENE SPANS -----------------------------------------------------
     Cut on the SAME boundary the stepper uses. A scene runs from its first
     step's top to the NEXT scene's first step's top — not to its own last
     step's bottom, which is a different number wherever steps carry a bottom
     margin (they do on a phone) and would leave a dead band where the
     outgoing scene had finished travelling and the incoming had not started.
     Document offsets, so they are independent of scroll; the cache is
     dropped whenever anything that could move them happens. */
  var spanCache = null, spanKey = '';
  function spans() {
    var key = document.documentElement.scrollHeight + 'x' +
      window.innerHeight + 'x' + window.innerWidth;
    if (spanCache && spanKey === key) return spanCache;
    var y = window.pageYOffset, order = [], tops = {}, last = null, end = 0;
    for (var i = 0; i < stepEls.length; i++) {
      var sc = stepEls[i].getAttribute('data-scene');
      var r = stepEls[i].getBoundingClientRect();
      if (sc !== last) { order.push(sc); tops[sc] = r.top + y; last = sc; }
      end = r.bottom + y;
    }
    var out = { order: order };
    order.forEach(function (sc, i) {
      out[sc] = {
        top: tops[sc],
        bottom: i + 1 < order.length ? tops[order[i + 1]] : end,
        next: i + 1 < order.length ? order[i + 1] : null,
        prev: i > 0 ? order[i - 1] : null,
        first: i === 0,
        last: i === order.length - 1
      };
    });
    out.paneH = pane.getBoundingClientRect().height || (window.innerHeight * 0.8);
    spanCache = out; spanKey = key;
    return out;
  }

  /* THE FOCUS LINE. On a desktop the pane is beside the prose and 45% down
     the viewport is the natural trigger. On a phone the pane is pinned ACROSS
     THE TOP, so 45% lands 130px BEHIND the graphic: a step became active
     while its eyebrow and headline were still hidden, and every scene change
     opened on a headless mid-paragraph. Under the pane, the line drops to
     just below it. Measured from the pane itself, so it survives any change
     to the pane's height. */
  function focusLine() {
    var h = window.innerHeight;
    if (window.matchMedia('(max-width: 768px)').matches) {
      var b = pane.getBoundingClientRect().bottom;
      if (b > 0 && b < h) return b + (h - b) * 0.18;
    }
    return h * 0.45;
  }

  /* ---- THE HANDOFF ---------------------------------------------------------
     For a boundary b between scene A (above) and scene B (below), the
     handoff runs over the D px of scroll centred on b, where D is the pane's
     height plus the gap: at = b - D/2 is A at rest, at = b + D/2 is B at
     rest, and in between A sits at -(at - (b - D/2)) and B exactly D below
     it — one strip, moving at the page's own speed. The stepper switches
     the CURRENT scene at b itself, which is when both graphics are half in
     and half out; whichever is not current is the ghost.

     Returns null when the reader is resting inside a scene, else
     { out, inc, yOut, yIn }. */
  function handoff() {
    var sp = spans();
    var at = window.pageYOffset + focusLine();
    var D = sp.paneH + GAP;
    for (var i = 0; i < sp.order.length - 1; i++) {
      var a = sp.order[i], s = sp[a];
      var b = s.bottom;
      if (at > b - D / 2 && at < b + D / 2) {
        var u = at - (b - D / 2);          /* 0 .. D */
        return { out: a, inc: s.next, yOut: -u, yIn: D - u, D: D };
      }
    }
    return null;
  }

  /* ---- placing the scenes ---------------------------------------------------
     Exactly one scene is CURRENT (in flow, centred by the pane); during a
     handoff one more is ASIDE (absolutely positioned where it would rest,
     then translated). Everything else is display:none. Positions are set
     from the scroll offset on every scroll tick and nowhere else. */
  function place(el, on, aside, y) {
    if (!el) return;
    el.classList.toggle('is-on', on);
    el.classList.toggle('is-out', aside && !on);
    if (!on && !aside) {
      el.style.transform = '';
      el.style.top = '';
      return;
    }
    if (aside && !on) {
      /* rest position: centred in the pane, as the current scene is, so the
         strip reads as one column of graphics passing through */
      var ph = pane.clientHeight, hh = el.offsetHeight;
      el.style.top = Math.max(0, Math.round((ph - hh) / 2)) + 'px';
    } else {
      el.style.top = '';
    }
    el.style.transform = (reduceMotion || !y) ? '' :
      'translate3d(0,' + y.toFixed(1) + 'px,0)';
  }

  function layout() {
    var h = reduceMotion ? null : handoff();
    Object.keys(sceneEls).forEach(function (name) {
      var el = sceneEls[name];
      if (el.classList.contains('is-prerender')) return;   /* off-stage work */
      var on = name === curScene;
      var y = 0, aside = false;
      if (h) {
        if (name === h.out) { y = h.yOut; aside = true; }
        else if (name === h.inc) { y = h.yIn; aside = true; }
      }
      /* an aside scene with nothing to show (never seen, no snapshot) stays
         hidden rather than presenting an empty box */
      if (aside && !on && !hasVisual(el)) aside = false;
      place(el, on, aside, y);
    });
  }

  /* the real card in a host — never its ghost, which is a clone carrying the
     same classes and would otherwise answer every one of these lookups first
     (it is inserted ahead of the real card on purpose, so the real card's
     ids win) */
  function realCard(host) {
    return host ? host.querySelector(':scope > .jd-inline-card:not(.jd-scene-ghost)') : null;
  }

  function hasVisual(host) {
    if (host.getAttribute('data-scene-pane') === 'drawer') return true;
    if (host.querySelector('.jd-scene-ghost')) return true;
    var card = realCard(host);
    return !!(card && hasContent(card));
  }

  /* ---- the cards' content check ----------------------------------------------
     A card exists as a shell before it renders (the turn card's scroller is
     emptied on close and refilled on open; the report card and the folder
     keep their last contents). A fit taken against the shell is what cut a
     host down to a title bar — so nothing here measures a card that has
     nothing in it. */
  function hasContent(card) {
    /* the folder's "pulling the file…" placeholder (.fx-stuck) is not content:
       a snapshot taken against it was a 99px ghost with no charts in it */
    return !!card.querySelector('.rc-scroll > *, .jd-turn-scroll > *, .jd-folder-scroll > :not(.fx-stuck)');
  }

  /* ---- THE PLAYHEAD ---------------------------------------------------------
     On this page the scroll position IS the story's playhead, and the cards
     move it: every render of the turn card ends in focusFirst() so a keyboard
     user lands on the new heading — correct in a modal, and here it makes
     the browser scroll that node into view, dragging the page with it.
     Traced: a rail drive threw the page BACKWARD by exactly 505px, the
     stepper re-ran at that earlier position, re-activated an earlier step
     and drove the rail back again, so the card sat on drawing A while the
     prose described Gemini.

     So the focus is asked not to scroll in the first place, and ONLY while
     an engine-driven action is in flight: a reader tabbing through the card
     still gets the ordinary scroll-into-view they need to see where they
     are. The counter is held a few frames because the focus lands after the
     click that caused it. */
  var noFocusScroll = 0;
  var origFocus = window.HTMLElement && HTMLElement.prototype.focus;
  if (origFocus) {
    HTMLElement.prototype.focus = function (opts) {
      if (noFocusScroll > 0) {
        var o = { preventScroll: true };
        for (var k in (opts || {})) { if (k !== 'preventScroll') o[k] = opts[k]; }
        return origFocus.call(this, o);
      }
      return origFocus.call(this, opts);
    };
  }
  /* poll on the clock, not on frames: every loop below is asking "has the
     card re-rendered yet" — a question about time, not about painting */
  function poll(fn, ms, tries) {
    var n = 0;
    (function tick() {
      if (fn() === true) return;          /* done */
      if (n++ < tries) setTimeout(tick, ms);
    })();
  }

  function keepScroll(fn) {
    noFocusScroll++;
    try { fn(); } catch (e) {}
    setTimeout(function () { noFocusScroll--; }, 260);
  }

  /* ONE CARD AT A TIME. The three modules each refuse to open while another
     layer is up (JD_layerOpen) — correct for a modal stack, and it means a
     scene MUST put its card away before the next scene asks for its own. */
  function closeCards() {
    keepScroll(function () {
      try { if (window.JD_turn && window.JD_turn.isOpen()) window.JD_turn.close(); } catch (e) {}
      try { if (window.JD_record && window.JD_record.isOpen()) window.JD_record.close(); } catch (e) {}
      try { if (window.JD_folder && window.JD_folder.isOpen()) window.JD_folder.close(); } catch (e) {}
    });
  }

  /* ---- FIT THE CARD TO THE PANE -----------------------------------------
     The card lays out at its full width — the layout about.css gives it —
     and is then scaled down to fit the pane. Scaling, not re-flowing.
     A transformed element still occupies its UNSCALED box, so the scene host
     is given the scaled size explicitly, and the card is translated to sit
     centred inside it.

     THE FIT NEVER MEASURES A SHELL. A card caught between renders (the turn
     card is emptied on every close) measured as its title bar, the host was
     cut to that height, and being overflow:hidden it then clipped the card
     that rendered a moment later — "I only see the header row". Now a card
     without content is left alone: the host keeps its last good size, and
     the ResizeObserver, the timed re-fits and the scroll-tick guard all
     re-cut it once the content is in. */
  /* THE FILMSTRIP (owner, 2026-09-16): the replay/scrub control
     (jd-filmstrip.js, shared with the drawer proper) goes under the drawing
     on both cards. The cards
     re-render their plate on every rail step, response flip and paper swap,
     so the control is (re)mounted wherever a plate stands without one —
     checked here, on the way into every fit, which already runs after each
     render. Keyed on the plate's own svg node: a fresh render is a fresh
     node, and the control made for the old one went with it. */
  var sbSeq = 0;
  /* THE PROMPT, LIFTED INTO A BOX OF ITS OWN (owner, 2026-09-17). On this
     page only the PROMPT rides beside the drawing — the grades and the
     sibling strip go back under the pair at the card's full width. The record
     card writes its prompt as TWO siblings, the rule that says THE PROMPT and
     the block that holds the text, and two siblings cannot share one grid
     cell: placed on consecutive rows, the tall plate in the column beside
     them sets the first row's height and the text lands a hundred-odd pixels
     below its own heading. Lifting the pair into one box gives the grid one
     thing to place. The bench needs none of this — its .jd-turn-assign is
     already a single block. Idempotent: the box is made once per render, and
     a re-render replaces the card and its box together. */
  function ensurePromptBox(host) {
    var card = realCard(host);
    if (!card) return;
    var colR = card.querySelector('.rc-col-r');
    if (!colR || colR.querySelector(':scope > .jd-about-prompt')) return;
    var head = colR.querySelector(':scope > .rc-head');
    var assign = colR.querySelector(':scope > .rc-assign');
    if (!head || !assign || head.nextElementSibling !== assign) return;
    var box = document.createElement('div');
    box.className = 'jd-about-prompt';
    colR.insertBefore(box, head);
    box.appendChild(head);
    box.appendChild(assign);
  }

  function ensureFilmstrip(host) {
    if (!window.JD_filmstrip) return;
    var card = realCard(host);
    if (!card) return;
    var name = host.getAttribute('data-scene-pane');
    var after = null, svg = null;
    if (name === 'record') {
      after = card.querySelector('.rc-col-l > .rc-plate');
      svg = after && after.querySelector('.rc-plate-art > svg');
    } else if (name === 'instrument') {
      /* inside the plate figure, under the artwork — the same place
         jd-turn.js mounts it, so one rule in junk-drawer.css serves both */
      after = card.querySelector('.jd-turn[data-view="bench"] .jd-turn-pin .jd-turn-plate .jd-turn-art');
      svg = after && after.querySelector('.jd-turn-art-in > svg');
    }
    if (!svg || !after) return;
    var cur = svg.__jdFilmstrip;
    if (cur && cur.bar.parentNode) {
      /* a control built while its scene was still off has NO marks to show:
         JD_drawOn finds nothing in a display:none subtree, so arm() fails and
         the readout sits at 0/0 until something touches it. This runs on the
         way into every fit, so the cheapest cure is to notice and build again
         now that the card is actually up. */
      var armedM = 0;
      try { armedM = cur.get().M; } catch (e) {}
      if (armedM > 0) return;
      try { cur.destroy(); } catch (e) {}
      svg.__jdFilmstrip = null;
    }
    /* EVERY control in this scene that is not the one for the plate standing
       now goes: a render that replaced the plate, and a ghost still holding
       the card it replaced (whose svg is very much still in the document, so
       the old detached-node test let it live), both leave one behind. Twelve
       cells of parked Web Animations each is not a rounding error on a phone,
       and only the live plate's control is ever interactive. */
    [].slice.call(host.querySelectorAll('.jd-filmstrip')).forEach(function (b) {
      if (b.__svg === svg) return;
      if (b.__svg && b.__svg.__jdFilmstrip) {
        try { b.__svg.__jdFilmstrip.destroy(); } catch (e) {}
        b.__svg.__jdFilmstrip = null;
      } else if (b.parentNode) { b.parentNode.removeChild(b); }
    });
    try {
      window.JD_filmstrip(svg, after, {
        pfx: 'fs' + name.charAt(0) + (++sbSeq) + '_',
        label: name === 'record' ? 'Replay the drawing' : 'Replay this drawing'
      });
    } catch (e) {}
  }

  function fitCard(host) {
    if (!host) return false;
    var card = realCard(host);
    if (!card || !hasContent(card)) return false;
    ensurePromptBox(host);
    ensureFilmstrip(host);

    var natW = card.offsetWidth;
    var natH = card.scrollHeight;
    if (!natW || !natH || natH < 80) return false;

    var availW = pane.clientWidth;
    var maxH = parseFloat(getComputedStyle(pane).maxHeight);
    if (!isFinite(maxH) || maxH <= 0) {
      maxH = parseFloat(getComputedStyle(pane).height);
    }
    var availH = isFinite(maxH) && maxH > 0 ? maxH - 10 : 0;
    if (!availW) return false;

    var k = Math.min(1, availW / natW);
    if (availH) k = Math.min(k, availH / natH);
    k = Math.max(k, 0.45);            /* past this it stops being readable */

    var left = Math.max(0, (availW - natW * k) / 2);
    card.style.transform = 'translateX(' + left.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
    host.style.height = Math.ceil(natH * k) + 'px';
    host.__jdFit = { natW: natW, natH: natH, k: k };
    spanCache = null;
    /* the real card is whole and sized: its ghost, if one was standing in
       for it, has done its job — but only while this scene is the current
       one. A scene that is aside or off shows its ghost by design (the
       report card and the folder keep their contents after closing, so a
       late re-fit would otherwise measure a closed card and throw away the
       picture the next handoff needs). */
    if (host.getAttribute('data-scene-pane') === curScene) dropGhost(host);
    return true;
  }

  /* THE SELF-HEAL, on every scroll tick: if the current card is no longer
     the size its host was cut for, it is re-cut. A partial card cannot
     survive the next thing the reader does with the wheel. */
  function guardFit() {
    if (pane.scrollTop) pane.scrollTop = 0;
    var host = curScene && sceneEls[curScene];
    if (!host) return;
    var card = realCard(host);
    if (!card) return;
    var f = host.__jdFit;
    if (!f || card.scrollHeight !== f.natH || card.offsetWidth !== f.natW) {
      fitCard(host);
    }
  }

  /* a decaying schedule of re-fits after a scene settles: a slow card (four
     inlined SVGs, a re-render after the payload lands) can still be settling
     three seconds in */
  var FIT_AT = [60, 140, 260, 420, 640, 900, 1250, 1700, 2300, 3000];
  function fitSoon(host) {
    fitCard(host);
    FIT_AT.forEach(function (ms) {
      setTimeout(function () { fitCard(host); }, ms);
    });
  }

  /* and whenever the card itself resizes, however late */
  var ro = window.ResizeObserver ? new ResizeObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var host = entries[i].target.closest('[data-scene-pane]');
      if (host) fitCard(host);
    }
  }) : null;

  function watchCard(host) {
    if (!ro || !host) return;
    var card = realCard(host);
    if (!card) return;
    if (!card.__jdWatched) { card.__jdWatched = true; ro.observe(card); }
    var inner = card.querySelector('.jd-turn, .jd-record, .jd-folder-card');
    if (inner && !inner.__jdWatched) { inner.__jdWatched = true; ro.observe(inner); }
  }

  window.addEventListener('resize', function () {
    spanCache = null;
    Object.keys(sceneEls).forEach(function (k) { fitCard(sceneEls[k]); });
  });

  /* ---- re-parenting a scrim into the pane --------------------------------
     Each card appends its scrim to <body> and, while open, the turn card also
     sets html.jd-turn-open { overflow: hidden } — which would freeze the very
     scrolling this page runs on. about.css neutralises that for this page;
     here we only move the node, and mark it so the inline rules bite. The
     ghost, if the host has one, stays FIRST so the real card's ids win every
     lookup (getElementById, url(#…)) — the ghost's own ids are rewritten
     anyway, see snapshot(). */
  function inline(selector, host) {
    var el = document.querySelector(selector + ':not(.jd-scene-ghost)');
    if (!el || !host) return null;
    el.classList.add('jd-inline-card');
    if (el.parentNode !== host) host.appendChild(el);
    return el;
  }

  /* ---- GHOSTS ----------------------------------------------------------------
     A ghost is a static clone of a card as it last stood, kept in the card's
     own host: it is what the pane shows for that scene while the real card
     is closed (leaving) or not yet rendered (arriving). Inert, aria-hidden,
     and every id inside it rewritten with the references that point at
     them — SVG gradients and clip paths, label/for, aria — so the copy can
     share a document with the original without either resolving to the
     other's parts. */
  function snapshot(name) {
    var host = sceneEls[name];
    if (!host || name === 'drawer') return;
    var card = realCard(host);
    if (!card || !hasContent(card) || !host.__jdFit) return;
    var g = card.cloneNode(true);
    g.classList.add('jd-scene-ghost');
    g.classList.remove('is-on');
    g.setAttribute('aria-hidden', 'true');
    g.setAttribute('inert', '');
    g.style.transform = card.style.transform;
    rewriteIds(g, 'g' + name.charAt(0) + '-');
    var old = host.querySelector('.jd-scene-ghost');
    if (old) host.removeChild(old);
    host.insertBefore(g, host.firstChild);
    host.__ghostH = host.__jdFit.natH * host.__jdFit.k;
    host.classList.add('has-ghost');
  }

  function rewriteIds(rootEl, prefix) {
    var els = rootEl.querySelectorAll('[id]');
    if (!els.length) return;
    var map = {}, i;
    for (i = 0; i < els.length; i++) {
      var id = els[i].getAttribute('id');
      map[id] = prefix + id;
      els[i].setAttribute('id', prefix + id);
    }
    var ids = Object.keys(map).sort(function (a, b) { return b.length - a.length; });
    if (!ids.length) return;
    var re = new RegExp('#(' + ids.map(function (s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('|') + ')(?![\\w-])', 'g');
    var all = rootEl.querySelectorAll('*');
    for (i = 0; i < all.length; i++) {
      var el = all[i], attrs = el.attributes, j;
      for (j = 0; j < attrs.length; j++) {
        var a = attrs[j];
        if (a.name === 'id') continue;
        if (a.value.indexOf('#') >= 0) {
          var v = a.value.replace(re, function (m, x) { return '#' + map[x]; });
          if (v !== a.value) el.setAttribute(a.name, v);
        } else if (a.name === 'for' || a.name === 'aria-labelledby' ||
                   a.name === 'aria-describedby' || a.name === 'aria-controls') {
          var parts = a.value.split(/\s+/).map(function (t) { return map[t] || t; });
          el.setAttribute(a.name, parts.join(' '));
        }
      }
      if (el.tagName && el.tagName.toLowerCase() === 'style' && el.textContent.indexOf('#') >= 0) {
        el.textContent = el.textContent.replace(re, function (m, x) { return '#' + map[x]; });
      }
    }
  }

  function dropGhost(host) {
    var g = host.querySelector('.jd-scene-ghost');
    if (g) host.removeChild(g);
    host.classList.remove('has-ghost');
  }

  /* a host whose real card is gone (closed, or off with another scene)
     shows its ghost at the ghost's own size */
  function useGhost(host) {
    var g = host.querySelector('.jd-scene-ghost');
    if (!g) return;
    host.classList.add('has-ghost');
    if (host.__ghostH) host.style.height = Math.ceil(host.__ghostH) + 'px';
  }

  /* ---- switching scenes ------------------------------------------------------
     Runs at the boundary, when the stepper's current scene changes:
       1. the outgoing scene is cloned into its ghost, still travelling;
       2. the open card is closed (the modules allow one at a time);
       3. the incoming scene shows its ghost (if it has one) and mounts its
          real card, which replaces the ghost as soon as it is fitted. */
  function showScene(name) {
    if (curScene === name) return Promise.resolve();
    var prev = curScene;
    curScene = name;
    root.setAttribute('data-active-scene', name);
    prerender = null;                        /* the reader outranks the warm-up */

    if (prev) {
      snapshot(prev);
      if (scenes[prev] && scenes[prev].exit) scenes[prev].exit();
    }
    closeCards();
    if (prev && sceneEls[prev]) useGhost(sceneEls[prev]);

    var host = sceneEls[name];
    if (host) useGhost(host);
    layout();

    var sc = scenes[name];
    if (!sc) return Promise.resolve();
    if (!sc._mounted) {
      sc._mounted = true;
      return Promise.resolve(sc.mount ? sc.mount() : null)
        .then(function () { return sc.enter ? sc.enter() : null; });
    }
    return Promise.resolve(sc.enter ? sc.enter() : null);
  }

  function applyStep(scene, step) {
    if (scene === curScene && step === curStep) return;
    var same = scene === curScene;
    curStep = step;
    showScene(scene).then(function () {
      var sc = scenes[scene];
      if (sc && sc.step) { try { sc.step(step, same); } catch (e) {} }
    });
  }

  /* =========================== SCENE 1 — THE DRAWER ======================= */
  scenes.drawer = {
    /* the stage is already in the pane (index.php includes _stage.php there);
       nothing to mount. Step 3 lifts one item out of the pile the same way a
       visitor does — by pressing it — so the tag and its grade appear. */
    step: function (step) {
      var stage = pane || document;
      var item = stage.querySelector('[data-id="' + SPECIMEN + '"]');
      /* a synthetic .click() never reaches pick(): the pile arms on a
         pointerdown/pointerup PAIR against the same element, so a dispatched
         click is ignored. jd-core exports the door for exactly this case. */
      if (step === 'graded') {
        if (item && window.JD_pick && !item.classList.contains('is-picked')) {
          window.JD_pick(item);
        }
      } else if (window.JD_hideTag) {
        window.JD_hideTag();
      }
    }
  };

  /* ======================= SCENE 2 — THE INSTRUMENT ======================= */
  /* The real turn card, opened through JD_turn.curate with a fixed response
     set and no network. Two jobs:
       BLANK   (steps try/taxonomy) — nothing filled in; the visitor rates it
       RATED   (the four specimens, the podium) — the owner's filed ratings
     One swap, at the taxonomy -> fable boundary, so the walkthrough shows
     real judgments rather than an empty form. */
  scenes.instrument = {
    _job: null, _mode: null, _svgs: null, _item: null, _gen: 0, _pending: null,

    mount: function () {
      var self = this;
      return payload().then(function (d) {
        var item = specimen(d);
        if (!item) return null;
        self._item = item;
        var picked = CAST.map(function (m) {
          for (var i = 0; i < item.responses.length; i++) {
            if (item.responses[i].model === m) return item.responses[i];
          }
          return null;
        }).filter(Boolean);
        /* every drawing is inlined as SOURCE by the card, not linked */
        return Promise.all(picked.map(function (r) {
          return fetch(API + r.url).then(function (res) {
            return res.ok ? res.text() : '';
          }).then(function (txt) { return { resp: r, svg: txt }; });
        })).then(function (list) {
          self._svgs = list.filter(function (x) { return x.svg; });
          return self._svgs;
        });
      });
    },

    _open: function (mode) {
      var self = this;
      if (this._mode === mode) return;
      if (!this._svgs || !this._svgs.length || !window.JD_turn) return;
      if (window.JD_turn.isOpen()) closeCards();
      this._mode = mode;
      var rated = mode === 'rated';
      /* THE RANKS ARE DERIVED, AND THAT IS SAID OUT LOUD (owner, 2026-09-15).
         The podium seats each print from resp.rank, and this specimen has no
         rank on file — nobody ever ranked it. Its filed GRADES order the
         four without a tie (5, 3, 2, 1), so the ranking the podium shows is
         that order — COMPUTED here from the grades rather than typed in, so
         a regrade re-seats the podium on its own and the page cannot come to
         disagree with the record. */
      var rankOf = {};
      this._svgs.slice().sort(function (a, b) {
        return (b.resp.grade || 0) - (a.resp.grade || 0);
      }).forEach(function (x, i) { rankOf[x.resp.rid] = i + 1; });
      var job = {
        prompt: this._item.prompt,
        size: this._item.sizeClass || null,
        fixedOrder: true,        /* the walkthrough has to name the drawings */
        responses: this._svgs.map(function (x) {
          var r = x.resp;
          return {
            generation_id: 'demo-' + r.rid,
            svg: x.svg,
            model_id: r.model,
            label: r.model_version || r.model,
            grade: rated ? r.grade : null,
            axes: rated ? (r.annotations || {}) : {},
            rank: rated ? (rankOf[r.rid] || null) : null
          };
        }),
        /* filing is a no-op: this is a demo and nothing leaves the browser.
           Resolving drives the card to its own unveil, which is the honest
           ending — the names were withheld, now they are shown. */
        file: function () { return Promise.resolve(); }
      };
      keepScroll(function () { window.JD_turn.curate(job); });
      /* THE STALE-SCRIM TRAP. jd-turn builds its scrim on <body> ONCE and
         close() only empties the body and drops .is-on — the node itself
         survives. So "wait until .jd-turn-scrim exists" passes on frame 1 of
         every open after the first. Waiting for the TARGET BUTTON closes it:
         the button cannot exist until the render that owns it has run. With
         no target (the blank pass) we wait for the rendered scroller. Each
         loop carries the generation it was started for and stands down the
         moment a newer one exists, or the reader has moved on. */
    var gen = ++self._gen;
      var want = self._pending || null;
      var host = sceneEls.instrument;
      poll(function () {
        if (gen !== self._gen || !wanted('instrument')) return true;
        var el = inline('.jd-turn-scrim', host);
        var ready = el && (want
          ? el.querySelector('[data-act="step"][data-step="' + want + '"]')
          : el.querySelector('.jd-turn-scroll > *'));
        if (!ready) return false;
        self._railTo(self._pending);
        fitSoon(host); watchCard(host);
        return true;
      }, 60, 80);
    },

    /* Drive the card's own rail, exactly as a press would — without letting
       the render's focus move the page (keepScroll), and WITHOUT trusting a
       single click to land: the drive ASSERTS the target for a bounded
       number of ticks and presses again if the rail still shows something
       else. A stale generation stands down. */
    _railTo: function (slot) {
      if (!slot) return;
      var self = this;
      var gen = self._gen, presses = 0, lastPress = 0;
      var host = sceneEls.instrument;
      poll(function () {
        if (gen !== self._gen || !wanted('instrument')) return true;
        var scrim = realCard(host);
        var cur = scrim && scrim.querySelector('.jd-rail-step.is-current');
        if (cur && cur.getAttribute('data-step') === slot) { fitSoon(host); return true; }
        var btn = scrim && scrim.querySelector(
          '[data-act="step"][data-step="' + slot + '"]');
        var now = Date.now();
        if (btn && presses < 4 && now - lastPress > 220) {
          presses++; lastPress = now;
          keepScroll(function () { btn.click(); });
          fitSoon(host); watchCard(host);
        }
        return false;
      }, 60, 50);
    },

    /* THE RAIL'S DESTINATIONS are the card's own step ids: a drawing is a
       slot letter, and the RANKING step is 'call' — the podium, the card's
       last station. Anything else (the opening two steps) wants the BLANK
       job. */
    step: function (step) {
      var dest = null;
      if (step === 'ranking') {
        dest = 'call';
      } else {
        var idx = this._slotOf(step);
        if (idx >= 0) dest = (window.JD_SLOTS || ['a', 'b', 'c', 'd'])[idx];
      }
      if (dest) {
        this._pending = dest;
        var fresh = this._mode !== 'rated';
        this._open('rated');
        /* on a fresh open the settle loop drives the rail once the buttons
           exist; driving here as well would fire against an empty card */
        if (!fresh) { this._gen++; this._railTo(dest); }
      } else {
        this._pending = null;
        this._open('blank');
      }
    },

    /* map a step's MODEL NAME to the slot it was actually dealt into */
    _slotOf: function (model) {
      if (!this._svgs) return -1;
      for (var i = 0; i < this._svgs.length; i++) {
        if (this._svgs[i].resp.model === model) return i;
      }
      return -1;
    },

    exit: function () {
      /* the card is closed by closeCards() on the way out; forget which job
         was loaded so re-entering the scene deals it again */
      this._mode = null;
      this._gen++;
    }
  };

  /* ======================== SCENE 3 — THE REPORT CARD ===================== */
  scenes.record = {
    enter: function () {
      return payload().then(function () {
        if (!window.JD_record) return;
        /* THE OPEN IS RETRIED, NOT FIRED ONCE. jd-record's open() begins
           `if (!payload || isOpen) return` — against ITS OWN payload, a
           different fetch from this page's, which it may not have yet. So
           the poll does the opening as well as the waiting, and stands down
           the moment the reader has moved to another scene. */
        var host = sceneEls.record;
        poll(function () {
          if (!wanted('record')) return true;
          if (!window.JD_record.isOpen()) {
            keepScroll(function () { window.JD_record.open(SPECIMEN, true); });
            return false;
          }
          var el = inline('.jd-record-scrim', host);
          if (!el || !el.querySelector('.rc-scroll > *')) return false;
          fitSoon(host); watchCard(host);
          return true;
        }, 60, 100);
      });
    },
    exit: function () {}
  };

  /* ========================= SCENE 4 — ANALYTICS ========================== */
  scenes.analytics = {
    exit: function () {},
    /* THREE CARDS, ONE PER STEP (owner, 2026-09-15). The folder renders all
       its cards at once; here each step names one (data-fx on the step:
       grades, cost, axes) and the host carries that name, so about.css
       shows that card alone. The card changes size, so the fit is re-taken. */
    step: function (step) {
      var el = null;
      for (var i = 0; i < stepEls.length; i++) {
        if (stepEls[i].getAttribute('data-step') === step) { el = stepEls[i]; break; }
      }
      var fx = (el && el.getAttribute('data-fx')) || 'grades';
      var host = sceneEls.analytics;
      if (host && host.getAttribute('data-fx') !== fx) {
        host.setAttribute('data-fx', fx);
        fitSoon(host);
      }
    },
    enter: function () {
      if (!window.JD_folder) return;
      var host = sceneEls.analytics;
      poll(function () {
        if (!wanted('analytics')) return true;
        if (!window.JD_folder.isOpen()) {
          keepScroll(function () { window.JD_folder.open(); });
          return false;
        }
        var el = inline('.jd-folder-scrim', host);
        if (!el || !el.querySelector('.jd-folder-scroll > *')) return false;
        fitSoon(host); watchCard(host);
        return true;
      }, 60, 100);
    }
  };

  /* ---- THE PRE-RENDER --------------------------------------------------------
     Each modal scene is opened once at load, off-screen (its host laid out
     but invisible), fitted, cloned into its ghost, and closed again — so the
     FIRST time a card arrives in a handoff there is already a picture of it
     to bring in. Sequential, because the modules allow one card at a time;
     abandoned the moment the reader crosses a boundary (showScene clears
     `prerender`), and never started while a card is already up. */
  function prerenderAll() {
    var queue = ['record', 'analytics', 'instrument'];
    (function next() {
      if (!queue.length) return;
      var name = queue.shift();
      var host = sceneEls[name], sc = scenes[name];
      if (!host || !sc || curScene === name || host.querySelector('.jd-scene-ghost')) { next(); return; }
      if (window.JD_layerOpen && window.JD_layerOpen()) { next(); return; }
      prerender = name;
      host.classList.add('is-prerender');
      var begin = sc._mounted ? Promise.resolve() :
        Promise.resolve(sc.mount ? sc.mount() : null).then(function () { sc._mounted = true; });
      begin.then(function () {
        if (prerender !== name) { host.classList.remove('is-prerender'); next(); return; }
        if (sc.enter) sc.enter();
        else if (sc.step) sc.step('try');
        /* the clone is cut only once the card has STOPPED GROWING: three
           polls in a row at the same natural height, and a height a real
           card could have — a card still inlining its drawings or pulling
           its charts would otherwise be photographed half-built */
        var stable = 0, lastH = 0, tries = 0;
        poll(function () {
          if (prerender !== name) { host.classList.remove('is-prerender'); return true; }
          var card = realCard(host);
          var settled = false;
          if (card && hasContent(card)) {
            fitCard(host);
            var f = host.__jdFit;
            if (f && f.natH >= 200) {
              if (f.natH === lastH) stable++; else { stable = 0; lastH = f.natH; }
              settled = stable >= 3;
            }
          }
          /* a card that never settles (its data failed to load, say) is not
             photographed — but it is put away and the queue moves on, so a
             stuck warm-up can never leave a card open under the page */
          if (!settled && ++tries < 150) return false;
          if (settled) snapshot(name);
          prerender = null;
          if (sc.exit) sc.exit();
          closeCards();
          host.classList.remove('is-prerender');
          useGhost(host);
          layout();
          setTimeout(next, 120);
          return true;
        }, 80, 160);
      });
    })();
  }

  /* ---- the stepper -------------------------------------------------------
     A step is ACTIVE from the moment its top edge crosses the focus line
     until the NEXT step's top crosses it. That is the standard scrollytelling
     rule and it is the one that survives steps of wildly different heights.
     Runs on the frame when the browser gives one, and on a short timer when
     it does not (a hidden tab withholds frames entirely), so a dropped frame
     can never leave the stepper waiting for a callback that will not come. */
  var ticking = false, lastEl = null;

  var lastGuard = 0;
  function pickStep() {
    ticking = false;
    /* the self-heal forces a layout read; once every 200ms is plenty for a
       repair and keeps the per-tick work to the transforms themselves */
    var now = Date.now();
    if (now - lastGuard > 200) { lastGuard = now; guardFit(); }
    layout();
    var line = focusLine();
    var chosen = stepEls[0];
    for (var i = 0; i < stepEls.length; i++) {
      if (stepEls[i].getBoundingClientRect().top <= line) chosen = stepEls[i];
      else break;
    }
    if (chosen === lastEl) return;
    lastEl = chosen;
    stepEls.forEach(function (el) { el.classList.toggle('is-on', el === chosen); });
    syncTimeline(chosen.getAttribute('data-step'), chosen.getAttribute('data-scene'));
    applyStep(chosen.getAttribute('data-scene'), chosen.getAttribute('data-step'));
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    var done = false;
    function run() { if (done) return; done = true; pickStep(); }
    if (window.requestAnimationFrame) window.requestAnimationFrame(run);
    setTimeout(run, 48);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---- THE TIMELINE ------------------------------------------------------
     Built from the steps themselves so it cannot disagree with them: one
     station per step, grouped under the scene it belongs to, the passed ones
     filled in and the current one lit. Pressing a station scrolls to that
     step — the ordinary page scroll, so the stepper reacts exactly as it
     would to a wheel. */
  var tlEl = document.getElementById('jd-timeline');
  var tlStops = {};

  function sceneLabel(id) {
    return { drawer: 'The drawer', instrument: 'The instrument',
             record: 'The record', analytics: 'The analysis' }[id] || id;
  }

  function buildTimeline() {
    if (!tlEl) return;
    var frag = document.createDocumentFragment();
    var group = null, groupScene = null;
    stepEls.forEach(function (el) {
      var scene = el.getAttribute('data-scene');
      var step = el.getAttribute('data-step');
      if (scene !== groupScene) {
        groupScene = scene;
        group = document.createElement('div');
        group.className = 'jd-tl-scene';
        group.setAttribute('data-tl-scene', scene);
        var name = document.createElement('p');
        name.className = 'jd-tl-name';
        name.textContent = sceneLabel(scene);
        group.appendChild(name);
        frag.appendChild(group);
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'jd-tl-stop';
      b.setAttribute('data-tl-step', step);
      var h = el.querySelector('h2');
      var label = h ? h.textContent.trim() : step;
      b.setAttribute('aria-label', label);
      b.title = label;
      b.innerHTML = '<span class="jd-tl-dot" aria-hidden="true"></span>';
      b.addEventListener('click', function () {
        var r = el.getBoundingClientRect();
        window.scrollTo({
          top: Math.round(window.pageYOffset + r.top - focusLine() + 4),
          behavior: 'smooth'
        });
      });
      group.appendChild(b);
      tlStops[step] = b;
    });
    tlEl.appendChild(frag);
  }

  function syncTimeline(step, scene) {
    if (!tlEl) return;
    var passed = true;
    stepEls.forEach(function (el) {
      var id = el.getAttribute('data-step');
      var b = tlStops[id];
      if (!b) return;
      if (id === step) { passed = false; b.classList.add('is-on'); b.classList.remove('is-done'); }
      else {
        b.classList.remove('is-on');
        b.classList.toggle('is-done', passed);
      }
    });
    [].slice.call(tlEl.querySelectorAll('.jd-tl-scene')).forEach(function (g) {
      g.classList.toggle('is-on', g.getAttribute('data-tl-scene') === scene);
    });
  }

  buildTimeline();

  /* open on whatever step the scroll position already names — a deep link or
     a restored scroll position must not land on scene 1's copy */
  pickStep();

  /* warm the ghosts once the drawer has its pile and the reader is still on
     scene 1; a reader already past it gets the ordinary lazy mounts */
  poll(function () {
    if (!document.querySelector('.jd-pile .jd-item')) return false;
    setTimeout(function () { if (curScene === 'drawer') prerenderAll(); }, 400);
    return true;
  }, 150, 200);

  /* exposed for the harness only: read-only state */
  window.JD_about = {
    scene: function () { return curScene; },
    step: function () { return curStep; },
    handoff: handoff,
    refit: function () { Object.keys(sceneEls).forEach(function (k) { fitCard(sceneEls[k]); }); }
  };
})();
