/* ============================================================================
   about-scenes.js — the walkthrough's scroll engine (PLAN-PORTFOLIO v3).

   The /about/ page is a sticky-graphic scrollytelling piece: ONE pinned
   visual pane on the left (top, on a phone) and a column of steps beside it.
   Each step declares the scene it belongs to; as a step comes into view the
   pane is switched to that scene and the scene is told which step is showing.

   FOUR SCENES, and every one of them is the REAL app, not a screenshot:
     drawer      — the live pile, exactly as the art page mounts it
     instrument  — the real turn card (JD_turn.curate), network sealed
     record      — the real report card, as finished cards (JD_record.card)
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

  /* THE PHONE (owner, 2026-09-29: "sticky sections"). ONE test, used
     everywhere, and the same query about.css writes for its phone rules, so
     the two can never disagree: a narrow screen, or a landscape phone (short,
     however wide). On a phone none of the pinned pane's machinery runs — no
     handoff, no relay, no fitting, no ghosts: each scene's graphic is laid
     into the page above its own steps, at its own phone size, by phoneInit()
     at the foot of this file. The desktop path below is untouched; every
     guard added to it is `if (PHONE)`, false on a desktop. Decided once, at
     load: crossing the breakpoint (a rotation) reloads the page. */
  var PHONE_Q = '(max-width: 768px), (max-height: 500px)';
  function isPhone() {
    return !!(window.matchMedia && window.matchMedia(PHONE_Q).matches);
  }
  var PHONE = isPhone();
  /* CROSSING THE BREAKPOINT (a rotation, a split view, a window made
     narrower or shorter) rebuilds the page the other way: the step being
     read is kept for the reload and returned to (restoreStep, at the foot).
     Listened for on BOTH sides — a desktop turning into a phone had no
     listener, and dropped every figure but the drawer (round 1, P1-4). */
  (function () {
    if (!window.matchMedia) return;
    var mq = window.matchMedia(PHONE_Q);
    var onFlip = function () {
      if (isPhone() === PHONE) return;
      try {
        sessionStorage.setItem('jd-about-restore', JSON.stringify({ step: curStep, t: Date.now() }));
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      } catch (e) {}
      window.location.reload();
    };
    if (mq.addEventListener) mq.addEventListener('change', onFlip);
    else if (mq.addListener) mq.addListener(onFlip);
  })();

  var stepEls = [].slice.call(root.querySelectorAll('.jd-step[data-scene]'));
  /* every step gets an anchor of its own, built from the two data attributes
     it already carries — #step-record-cost, #step-instrument-ranking. The
     walkthrough is long and scroll-driven, so without these there is no way
     to point anyone (or anything) at one part of it. Set here rather than in
     the markup so the two never drift apart. */
  /* A VIEW is what the pane shows for a step: its scene, and — where the
     step carries data-view — which face of that scene (the report card
     turned to one model's drawing). Every change of view is a handoff, even
     within a scene (owner, 2026-09-27: "I'd rather just see the report card
     scroll up from the bottom instead of having it suddenly flash in"). */
  function viewOf(el) {
    var v = el.getAttribute('data-view');
    return el.getAttribute('data-scene') + (v ? ':' + v : '');
  }
  stepEls.forEach(function (el, i) {
    if (!el.id) el.id = 'step-' + el.getAttribute('data-scene') + '-' + el.getAttribute('data-step');
    /* the first step of every view after the first: the handoff's runway */
    if (i && viewOf(el) !== viewOf(stepEls[i - 1])) {
      el.classList.add('jd-step--scene-head');
    }
  });
  if (!stepEls.length) return;

  var API = window.JD_API || '';
  var BASE = '/art/junk-drawer/';
  var SPECIMEN = '2026-07-28-desktop-succulent';
  var INSTRUMENT_ITEM = '2026-08-20-googie-style-ufo';   /* scene 2's blank card */
  /* the four the owner chose; claude-opus-5 is on file but sits this out */
  var CAST = ['claude-fable-5', 'kimi-k3', 'gemini-3-1-pro', 'gpt-5-1'];

  root.classList.add('jd-about--live');

  /* NO BLUEPRINT HERE (owner, 2026-09-29): the graph/blueprint paper swap
     stays on the drawer proper, but this page shows every drawing on graph
     paper and offers no switch (about.css hides the buttons). The shared
     preference is read through window.JD_paper at render time, so pinning
     get() here keeps a viewer's blueprint choice from the drawer from
     showing up on this page, and set() does nothing. */
  if (window.JD_paper) {
    window.JD_paper = { get: function () { return 'graph'; },
      set: function () {}, icon: window.JD_paper.icon };
  }

  /* THE INSTRUMENT'S BUTTON SAYS "NEXT" (owner, 2026-09-29). The card's own
     label names the drawing it leads to ("next — drawing B →"); on this
     page the rail sits beside the button and already says where it goes, so
     the button reads just "next". Relabelled as the card renders — the turn
     card re-renders on every step, so an observer on the pane catches each
     new button (and the check keeps the observer from firing on its own
     write). */
  function nextOnly() {
    /* (on a phone the instrument has left the pane for its own section) */
    var bs = (PHONE ? root : pane).querySelectorAll('[data-scene-pane="instrument"] .jd-turn-go[data-act="next"]');
    for (var i = 0; i < bs.length; i++) {
      if (bs[i].textContent !== 'next') bs[i].textContent = 'next';
    }
  }
  if (window.MutationObserver) {
    new MutationObserver(nextOnly).observe(PHONE ? root : pane, { childList: true, subtree: true });
  }

  /* ---- the poster (see index.php / about.css "THE POSTER") ----------------
     Scene 1 shows a picture of the pile with the specimen live on top. (The
     OPEN THE DRAWER button that sat on its floor went 2026-09-29, owner: the
     prose links to the full drawer already.) The specimen is seated on the
     spot the capture recorded
     — the stored scatter usually does that already, but a drawing filed since
     the capture makes the drawer scatter fresh, and the live object must
     never land on top of a picture of something else. */
  if (window.JD_POSTER) {
    /* THE PHONE'S OPEN THE DRAWER is off with the desktop's (owner,
       2026-09-29: the prose links to the full drawer already). One switch
       brings it back on phones: about.css keeps its phone rule (44px, 13px
       type, two lines clear of the turn plate). */
    var PHONE_OPEN_DRAWER = false;
    var posterStage = PHONE && PHONE_OPEN_DRAWER ? pane.querySelector('.jd-stage') : null;
    if (posterStage) {
      var openA = document.createElement('a');
      openA.className = 'jd-open-drawer';
      openA.href = BASE;
      openA.target = '_blank'; openA.rel = 'noopener';
      openA.textContent = 'Open the drawer →';
      posterStage.appendChild(openA);
    }
    var seat = window.JD_POSTER.place;
    if (seat) {
      poll(function () {
        /* (on a phone the drawer has left the pane for its own section) */
        var it = (PHONE ? root : pane).querySelector('.jd-pile [data-id="' + window.JD_POSTER.specimen + '"]');
        if (!it || !it.style.left) return false;
        it.style.left = seat.left;
        it.style.top = seat.top;
        it.style.setProperty('--rot', seat.rot);
        return true;
      }, 100, 300);
    }
  }

  /* ---- this page's data: ONE ITEM AT A TIME --------------------------------
     (owner, 2026-09-27: "let's say we were making this for its own one-off
     purpose … so that we don't have to load all that data"). The walkthrough
     shows two items — the succulent on the report cards, the UFO on the
     instrument — so it asks data.php for exactly those, in its single-item
     mode (?item=<id>: the taxonomy and one entry, ~28 KB against the whole
     drawer's ~200 KB), and never waits on the drawer's own load. Still read
     live: grades and ratings come from the same record the drawer shows, so
     this page cannot quietly disagree with it. Each item is fetched once; a
     failed fetch is not cached, so the next caller asks again. */
  var itemP = {};
  function itemData(id) {
    if (!itemP[id]) {
      itemP[id] = fetch(API + BASE + 'data.php?item=' + encodeURIComponent(id))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (d) {
          if (!d || !d.item) { itemP[id] = null; return null; }
          return d;
        });
    }
    return itemP[id];
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

  function wanted(name) {
    /* on a phone the instrument is the one live card, open for good */
    if (PHONE) return name === 'instrument';
    return curScene === name || prerender === name;
  }

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
    /* cut on VIEWS, not scenes: a scene may hold several views in a row
       (the report card turned to four drawings), and each is its own span */
    var y = window.pageYOffset, order = [], last = null, end = 0;
    for (var i = 0; i < stepEls.length; i++) {
      var vk = viewOf(stepEls[i]);
      var r = stepEls[i].getBoundingClientRect();
      if (vk !== last) {
        order.push({ key: vk, scene: stepEls[i].getAttribute('data-scene'), top: r.top + y });
        last = vk;
      }
      end = r.bottom + y;
    }
    order.forEach(function (s, i) {
      s.bottom = i + 1 < order.length ? order[i + 1].top : end;
    });
    var out = { order: order };
    out.paneH = pane.getBoundingClientRect().height || (window.innerHeight * 0.8);
    spanCache = out; spanKey = key;
    return out;
  }

  /* THE FOCUS LINE. On a desktop the pane is beside the prose and 45% down
     the viewport is the natural trigger. On a phone the pane is pinned ACROSS
     THE TOP, so 45% lands 130px BEHIND the graphic: a step became active
     while its headline was still hidden, and every scene change
     opened on a headless mid-paragraph. Under the pane, the line drops to
     just below it. Measured from the pane itself, so it survives any change
     to the pane's height. */
  function litLine() {
    var h = window.innerHeight;
    if (window.matchMedia('(max-width: 768px)').matches) return focusLine() + h * 0.12;
    return focusLine() + h * 0.2;
  }
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

     ON A DESKTOP THE HANDOFF ENDS AT b (owner, 2026-09-27: "by the time the
     instrument is actually displayed on the left, that text is almost
     exiting the top of the viewport"). Centred on b, the incoming graphic
     came to rest half a pane AFTER its first step reached the focus line, by
     which point that step's prose had ridden ~420px up and off the screen.
     Run over [b - D, b] instead and the graphic arrives at rest exactly as
     its words reach the line — the two travel up side by side the whole
     way. The scroll that buys is the extra top margin on each scene's first
     step (about.css, .jd-step--scene-head), so the outgoing scene's last
     step still gets its still moment before the strip starts to move. The
     phone keeps the centred handoff: its pane sits above the prose, not
     beside it.

     Returns null when the reader is resting inside a scene, else
     { out, inc, yOut, yIn }. */
  function handoff() {
    var sp = spans();
    var at = window.pageYOffset + focusLine();
    var D = sp.paneH + GAP;
    var phone = window.matchMedia('(max-width: 768px)').matches;
    for (var i = 0; i < sp.order.length - 1; i++) {
      var a = sp.order[i], n = sp.order[i + 1];
      var b = a.bottom;
      /* a change of VIEW within one scene always ends at b, phone included:
         the real card turns to the new view at b, so it must be out of
         sight by then, with the relay's picture at rest in its place */
      var lead = (phone && a.scene !== n.scene) ? D / 2 : D;
      if (at > b - lead && at < b + D - lead) {
        var u = at - (b - lead);           /* 0 .. D */
        /* relay: both views are faces of ONE scene, so the real card rides
           out as the outgoing view and a picture of the incoming one (the
           relay, below) follows it up */
        return { out: a.scene, inc: n.scene, outView: a.key, incView: n.key,
                 relay: a.scene === n.scene, yOut: -u, yIn: D - u, D: D };
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
    if (PHONE) return;                  /* no pane to lay out on a phone */
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
    placeRelay(h);
  }

  /* ---- THE RELAY -------------------------------------------------------------
     A handoff between two views of the SAME scene: the host holds the
     outgoing view's card and rides up, and the incoming view's own card —
     built and fitted at mount (scenes.record) — rides up behind it in a
     layer of its own. At the boundary the step moves that same element from
     the relay into the host, in one task, so the swap is never seen. The
     relay is aria-hidden: the card it carries is announced once it lands. */
  var relay = document.createElement('div');
  relay.className = 'jd-scene jd-scene-relay';
  relay.setAttribute('aria-hidden', 'true');
  pane.appendChild(relay);

  function relayShow(host, key) {
    var snap = host && host.__views && host.__views[key];
    if (!snap || !snap.h) return false;
    /* the relay carries the view's own card; the one card it may never take
       is the one standing in the host */
    if (snap.node.parentNode === host) return false;
    /* the card's layout rules are written against its scene's host
       ([data-scene-pane="record"] .jd-inline-card { width: 740px }), so the
       picture has to stand in a box that answers to the same name, or it
       lays out at another width and no longer matches the scale it was cut
       at. (sceneEls was collected before the relay existed, so the name
       adds no scene.) */
    relay.setAttribute('data-scene-pane', host.getAttribute('data-scene-pane'));
    if (relay.__key !== key || snap.node.parentNode !== relay) {
      while (relay.firstChild) relay.removeChild(relay.firstChild);
      /* the strip stays (it is part of the card's height); only the marks
         are stilled — the control is rebuilt when the card lands */
      stillDrawing(snap.node);
      relay.appendChild(snap.node);
      relay.__key = key;
    }
    relay.style.height = Math.ceil(snap.h) + 'px';
    return true;
  }

  function placeRelay(h) {
    var host = null, key = null, y = 0;
    if (h && h.relay) { host = sceneEls[h.inc]; key = h.incView; y = h.yIn; }
    if (reduceMotion && y) { host = null; }
    if (host && relayShow(host, key)) {
      place(relay, false, true, y);
    } else {
      place(relay, false, false, 0);
    }
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
    return !!card.querySelector('.rc-scroll > *, .jd-turn-scroll > *, .jd-folder-scroll > :not(.fx-stuck), .jdc');
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
      /* on a phone every card is in the page's own flow, so a card's
         focus-on-render would drag the page to it — at load, from a screen
         away, and after NEXT to a heading left mid-screen. The page places
         the card itself instead (phoneInit, "the card turns a page"). */
      if (noFocusScroll > 0 || PHONE) {
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
  /* THE PAPERWORK ASIDE (owner, 2026-09-17). Beside the drawing this page
     shows the PROMPT and, under it, the SPECIMEN details; the grades table
     and the sibling strip go back under the pair at the card's full width.

     Two reasons this is done in JS rather than CSS. The prompt is written as
     TWO siblings — the rule that says THE PROMPT and the block holding the
     text — and two siblings cannot share one grid cell; placed on consecutive
     rows, the tall plate in the column beside them sets the first row's
     height and the text lands a hundred-odd pixels below its own heading. And
     the specimen details (Model / Date / Tokens / Cost, the file number, the
     DOWNLOAD button) are absolutely positioned ON the photograph in the
     drawer's own design — printed on the paper, in its corners. Here they are
     wanted as a read-down block in the column, which means lifting them off
     the plate, not restyling them in place.

     One <div> holds both, so the pair reads top-down under one another with
     the plate's height irrelevant to where the specimen block starts. Made
     once per render; a re-render replaces the card and this with it. */
  function ensureAside(host) {
    var card = realCard(host);
    if (!card) return;
    var colR = card.querySelector('.rc-col-r');
    var plate = card.querySelector('.rc-col-l > .rc-plate');
    if (!colR || colR.querySelector(':scope > .jd-about-aside')) return;
    var head = colR.querySelector(':scope > .rc-head');
    var assign = colR.querySelector(':scope > .rc-assign');
    if (!head || !assign || head.nextElementSibling !== assign) return;

    var aside = document.createElement('div');
    aside.className = 'jd-about-aside';
    colR.insertBefore(aside, head);

    var prompt = document.createElement('div');
    prompt.className = 'jd-about-prompt';
    aside.appendChild(prompt);
    prompt.appendChild(head);
    prompt.appendChild(assign);

    /* the specimen block, in the card's own heading idiom */
    if (!plate) return;
    var notes = plate.querySelector(':scope > .rc-notes');
    var no = plate.querySelector(':scope > .rc-note-no');
    var btns = plate.querySelector(':scope > .rc-plate-btns');
    if (!notes && !no && !btns) return;
    var spec = document.createElement('div');
    spec.className = 'jd-about-specimen';
    var h = document.createElement('div');
    h.className = 'rc-block rc-head';
    h.textContent = 'Specimen';
    spec.appendChild(h);
    var body = document.createElement('div');
    body.className = 'jd-about-specimen-body';
    spec.appendChild(body);
    if (notes) body.appendChild(notes);
    if (btns) body.appendChild(btns);
    if (no) body.appendChild(no);
    aside.appendChild(spec);
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
    var keep = false;
    if (cur && cur.bar.parentNode) {
      /* a control built while its scene was still off has NO marks to show:
         JD_drawOn finds nothing in a display:none subtree, so arm() fails and
         the readout sits at 0/0 until something touches it. This runs on the
         way into every fit, so the cheapest cure is to notice and build again
         now that the card is actually up. */
      var armedM = 0;
      try { armedM = cur.get().M; } catch (e) {}
      if (armedM > 0) return;
      /* ...but only once it IS up. A drawing that is not rendered (its
         host display:none) or not visible (the pre-render's hidden host, a
         real card under its ghost) cannot arm, so a fresh control would be
         just as empty as this one — and the warm-up fits its hidden cards
         dozens of times in its first seconds, each rebuild twelve deep
         clones of the drawing. The unarmed control stays: its row is the same fixed
         height, so no measurement moves, and the first fit that finds the
         drawing on screen builds it again and arms it, exactly as before.
         The strays below still go. */
      if (!svg.getClientRects().length || getComputedStyle(svg).visibility === 'hidden') {
        keep = true;
      } else {
        try { cur.destroy(); } catch (e) {}
        svg.__jdFilmstrip = null;
      }
    }
    /* EVERY control in this scene that is not the one for the plate standing
       now goes: a render that replaced the plate, and a ghost still holding
       the card it replaced (whose svg is very much still in the document, so
       the old detached-node test let it live), both leave one behind. Twelve
       cells of parked Web Animations each is not a rounding error on a phone,
       and only the live plate's control is ever interactive.
       A GHOST'S STRIP STAYS: it is part of the picture, and taking it out
       shrank the ghost by the strip's row at the moment it went up (owner,
       2026-09-26). It costs nothing — snapshot() strips the draw-on state
       from every copy, so a ghost holds no animations at all. */
    [].slice.call(host.querySelectorAll('.jd-filmstrip')).forEach(function (b) {
      if (b.__svg === svg) return;
      if (b.closest('.jd-scene-ghost')) return;
      if (b.__svg && b.__svg.__jdFilmstrip) {
        try { b.__svg.__jdFilmstrip.destroy(); } catch (e) {}
        b.__svg.__jdFilmstrip = null;
      } else if (b.parentNode) { b.parentNode.removeChild(b); }
    });
    if (keep) return;
    try {
      window.JD_filmstrip(svg, after, {
        /* autoplay:false, as the cards' own mounts have it — parked at the
           finished drawing. With the default (play once on mount) every
           arrival and every job swap blanked the drawing and drew it again,
           which read as a flash (owner, 2026-09-26). REPLAY still plays it. */
        autoplay: false,
        pfx: 'fs' + name.charAt(0) + (++sbSeq) + '_',
        label: name === 'record' ? 'Replay the drawing' : 'Replay this drawing'
      });
    } catch (e) {}
  }

  /* an UNARMED control (M = 0: built while its card was hidden) is left
     alone — seeking it would arm it on the spot and park the drawing at
     mark 0, blank; the fit that builds it afresh parks it finished */
  function finishDrawings(card) {
    [].forEach.call(card.querySelectorAll('svg'), function (svg) {
      var fs = svg.__jdFilmstrip;
      if (!fs) return;
      try {
        fs.pause();
        var M = fs.get().M;
        if (M > 0) fs.seekMark(M);
      } catch (e) {}
    });
  }

  function fitCard(host) {
    if (PHONE || !host) return false;   /* phone cards stand at 1:1 */
    var card = realCard(host);
    if (!card || !hasContent(card)) return false;
    ensureAside(host);
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

    /* A CARD THAT GREW DOES NOT GET SMALLER (owner bug, 2026-09-17: "when I
       click to expand one of the rows … it seems to shrink the width of the
       overall container"). Opening an axis definition makes the card taller;
       the ResizeObserver refits; availH/natH falls; k falls — and k scales
       BOTH axes, so a height change came out as the whole card, width and
       all, shrinking away from the reader at the exact moment they asked to
       read something. Expanding to read and being given smaller type is the
       wrong answer to the gesture.

       So the height term only ever sets the scale on the FIRST fit, and while
       the pane itself is unchanged. Grow the content afterwards and the scale
       is held: the card keeps its size and the host below simply gets taller
       to match. A real pane resize (a window drag, an orientation change)
       still refits from scratch, because availW or availH moves with it.

       TWO GUARDS, both found by this going wrong: the scale is only held for
       the SAME card node (a re-render is a new node and must be measured
       afresh), and only across a modest growth. Without them the very first
       fit — which runs before the card has any content, when it is short
       enough to need no scaling at all — was cached at k=1 and then held
       forever, so the finished card rendered at full size in a pane too small
       for it and was clipped out of sight. An axis opening adds a tenth of
       the card's height; an empty card filling adds many times its own. */
    var prev = host.__jdFit;
    if (prev && prev.card === card &&
        prev.availW === availW && prev.availH === availH &&
        Math.abs(prev.natW - natW) < 0.5 &&
        natH > prev.natH && natH < prev.natH * 1.6) {
      k = prev.k;
    }

    var left = Math.max(0, (availW - natW * k) / 2);
    card.style.transform = 'translateX(' + left.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
    /* while a swap is covered, the host keeps the GHOST's height: the card
       under it is mid-deal (the podium is 120px shorter than a drawing) and
       the pane centres its host, so sizing to the hidden card dropped the
       visible ghost by half the difference for a frame */
    host.style.height = Math.ceil(host.__hold && host.__ghostH ? host.__ghostH : natH * k) + 'px';
    host.__jdFit = { natW: natW, natH: natH, k: k, availW: availW, availH: availH, card: card };
    spanCache = null;
    /* the real card is whole and sized: its ghost, if one was standing in
       for it, has done its job — but only while this scene is the current
       one. A scene that is aside or off shows its ghost by design (the
       report card and the folder keep their contents after closing, so a
       late re-fit would otherwise measure a closed card and throw away the
       picture the next handoff needs). */
    if (host.getAttribute('data-scene-pane') === curScene && !host.__hold) dropGhost(host);
    return true;
  }

  /* THE SELF-HEAL, on every scroll tick: if the current card is no longer
     the size its host was cut for, it is re-cut. A partial card cannot
     survive the next thing the reader does with the wheel. */
  function guardFit() {
    if (PHONE) return;
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
  /* ONE LADDER PER BURST: a card that lands is asked for its ladder by
     every hand that touched it in the same moment (the warm-up lands the
     report card's every view in one loop, then the step lands one again),
     and identical ladders queued within a few ms of each other only fit
     the same card twice at each rung. The first stands for the rest. */
  function fitSoon(host) {
    fitCard(host);
    var now = Date.now();
    if (host.__fitSoonAt != null && now - host.__fitSoonAt < 10) return;
    host.__fitSoonAt = now;
    FIT_AT.forEach(function (ms) {
      setTimeout(function () { fitCard(host); }, ms);
    });
  }

  /* and whenever the card itself resizes, however late. (Both the card and
     its inner panel are watched, so one change usually arrives as two
     entries and fits the host twice. That is load-bearing as it stands: the
     second fit finds the new height already recorded and re-derives the
     scale, so fitCard's "a card that grew does not get smaller" hold lasts
     only until then. Collapsing the pair would let the hold stand — an
     unfolded definition on the succulent's card would stay at k 1.000
     instead of 0.960, overflowing the pane — a visible change, and the
     owner's call.) */
  var ro = window.ResizeObserver ? new ResizeObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var host = entries[i].target.closest('[data-scene-pane]');
      /* the relay carries a scene's name for its card's layout rules, but it
         is not a scene: its card is fitted by the host it came from, and a
         re-fit here would rebuild the card's replay control mid-handoff */
      if (host && host !== relay) fitCard(host);
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

  /* every scene host, fitted again: a resize, and the harness's refit() */
  function refitAll() {
    Object.keys(sceneEls).forEach(function (k) { fitCard(sceneEls[k]); });
  }
  window.addEventListener('resize', function () {
    spanCache = null;
    refitAll();
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
    /* a phone card keeps its OWN phone layout: jd-inline-card is what
       re-lays it out at 740px for the pinned pane (about.css) */
    el.classList.add(PHONE ? 'jd-ph-card' : 'jd-inline-card');
    if (el.parentNode !== host) host.appendChild(el);
    return el;
  }

  /* THE FIRST-OPEN FLASH (owner, 2026-09-26: "things blink and flash on the
     screen … once I've scrolled down and back up it doesn't happen"). A card
     module builds its scrim on <body> the first time it opens, and the polls
     above only carried it into the pane on their next tick — so for a frame
     or more every card painted as what it is everywhere else, a full-screen
     modal over a grey backdrop. The warm-up opens all three at load, so the
     page flashed grey three times before the reader had touched it; after
     that the scrims live in the pane and are reused, which is why it never
     happened twice. A MutationObserver runs before the next paint, so a
     scrim is moved the instant it lands on <body> — when its scene wants it.
     A card the READER opens outside its scene (the tag's REPORT CARD button
     in scene 1) is left alone to be the modal it was asked to be. */
  /* (the tag's REPORT CARD button used to scroll to scene 3 here; it now
     opens the item's card in the full drawer — see "the drawer wakes") */

  /* ---- THE DRAWER WAKES (owner, 2026-09-27) --------------------------------
     "I'd still like to be able to rearrange the items and click on an item
     to see its specimen tag … without pulling all of the data." The drawer
     loads the SLIM pile (index.php: JD_SLIM — every item, only the drawing it
     shows and what its tag prints) and builds it behind the picture, where
     it costs nothing: poster mode keeps every object but the specimen
     display:none. The first time the reader reaches for the drawer — a mouse
     entering it, a finger or a click landing on it, a keyboard focus inside
     it — html takes .jd-drawer-awake and the live pile replaces the picture
     (about.css). It lands on the picture's own layout, so nothing moves;
     only a reader who digs pays for fifty live drawings, and only while the
     drawer is on screen. A tap that woke the drawer is not wasted: it picks
     whatever object was pictured under it. */
  var drawerHost = sceneEls.drawer;
  var awake = !document.documentElement.classList.contains('jd-poster-on');
  function pileReady() {
    return drawerHost && drawerHost.querySelectorAll('.jd-pile > .jd-item').length > 1;
  }
  function wake(pt) {
    if (awake) return;
    if (!pileReady()) {
      /* reached for before the pile has loaded: wake the moment it has */
      if (!wake._waiting) {
        wake._waiting = true;
        poll(function () {
          if (!pileReady()) return false;
          wake._waiting = false; wake(pt); return true;
        }, 100, 150);
      }
      return;
    }
    awake = true;
    document.documentElement.classList.add('jd-drawer-awake');
    if (PHONE) { posterReseat(); phoneSwipeScrolls(); }
    if (pt && window.JD_pick) {
      var hit = document.elementFromPoint(pt.x, pt.y);
      var it = hit && hit.closest && hit.closest('.jd-pile > .jd-item');
      if (it && !it.dataset.turn) window.JD_pick(it);
    }
  }
  /* THE WAKE KEEPS THE PICTURE'S LAYOUT (audit P1-5), phone only. The
     drawer reuses the poster's stored scatter only if it covers EVERY item
     on the page (jd-core's layoutFor); a drawing filed since the capture
     makes it scatter the whole pile fresh, so waking swapped the picture for
     a different pile. Here, in the same task as the wake (before a paint),
     every item the picture holds is put back where the picture has it, with
     the drawer's own turn-plate clearance; only items newer than the picture
     keep their fresh places. */
  function posterReseat() {
    var sc = window.JD_POSTER && window.JD_POSTER.scatter;
    var pileEl = drawerHost && drawerHost.querySelector('.jd-pile');
    if (!sc || !pileEl) return;
    var wr = pileEl.getBoundingClientRect();
    if (!wr.width || !wr.height) return;
    [].forEach.call(pileEl.querySelectorAll(':scope > .jd-item'), function (el) {
      var p = sc[el.dataset.id];
      if (!p || el.dataset.turn || el.dataset.id === window.JD_POSTER.specimen) return;
      el.style.setProperty('--rot', p.rot + 'deg');
      el.style.left = (p.x * 100) + '%';
      el.style.top = (p.y * 100) + '%';
      if (window.JD_zBase && p.z != null) el.style.zIndex = window.JD_zBase(el) + p.z;
      if (window.JD_avoidTurn) {
        var r = el.getBoundingClientRect();
        var a = window.JD_avoidTurn(p.x, p.y, Math.min(0.5, r.width / 2 / wr.width),
                                    Math.min(0.5, r.height / 2 / wr.height));
        el.style.left = (a.x * 100) + '%';
        el.style.top = (a.y * 100) + '%';
      }
    });
  }
  /* A SWIPE THAT STARTS ON A WOKEN DRAWING SCROLLS THE PAGE (phone only).
     touch-action: pan-y (about.css) lets the browser pan vertically, but
     the drawer's own non-passive touchmove calls preventDefault on a held
     item, which cancels the pan. So, on a phone and once the pile is awake,
     the drawer host catches each touchmove on the way down (capture) and
     keeps it from the drawer while the gesture is undecided or mostly
     vertical; a mostly sideways drag is let through, and digging works as
     it does in the drawer. The pointer events that move an item are not
     touched: a vertical pan simply cancels them, and the item settles. */
  var swipeWired = false;
  function phoneSwipeScrolls() {
    if (swipeWired || !drawerHost) return;
    swipeWired = true;
    var g = null;                      /* the touch gesture: start, direction */
    function onItem(e) { return e.target.closest && e.target.closest('.jd-pile > .jd-item'); }
    drawerHost.addEventListener('pointerdown', function (e) {
      g = (e.pointerType === 'touch' && onItem(e)) ? { id: e.pointerId, x: e.clientX, y: e.clientY, dir: null } : null;
    }, true);
    /* the drawer drags on pointermove and stops the pan on touchmove: both
       are held back until the gesture shows itself sideways */
    drawerHost.addEventListener('pointermove', function (e) {
      if (!g || e.pointerId !== g.id) return;
      if (!g.dir) {
        var dx = Math.abs(e.clientX - g.x), dy = Math.abs(e.clientY - g.y);
        if (dx > 8 || dy > 8) g.dir = dy > dx ? 'v' : 'h';
      }
      if (g.dir !== 'h') e.stopPropagation();
    }, true);
    drawerHost.addEventListener('touchmove', function (e) {
      if (g && g.dir !== 'h') e.stopPropagation();
    }, { capture: true, passive: true });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      drawerHost.addEventListener(t, function (e) { if (g && e.pointerId === g.id) g = null; }, true);
    });
  }
  if (drawerHost && !awake && PHONE) {
    /* A PHONE WAKES ON A TAP, never on the touch that starts a scroll
       (audit P0-1): a swipe across the poster used to wake the pile, and a
       woken pile's drawings take the next swipe as a drag. A tap is a press
       and release within a finger's slop. */
    var tapAt = null;
    drawerHost.addEventListener('pointerdown', function (e) {
      if (awake || tagNudging) return;
      tapAt = { x: e.clientX, y: e.clientY, id: e.pointerId, t: e.target };
    }, true);
    drawerHost.addEventListener('pointercancel', function () { tapAt = null; }, true);
    drawerHost.addEventListener('pointerup', function (e) {
      var a = tapAt; tapAt = null;
      if (awake || !a || a.id !== e.pointerId) return;
      if (Math.abs(e.clientX - a.x) > 10 || Math.abs(e.clientY - a.y) > 10) return;
      if (a.t.closest && a.t.closest('.jd-itemtag, a[href], .jd-pile > .jd-item')) { wake(); return; }
      wake({ x: e.clientX, y: e.clientY });
    }, true);
    drawerHost.addEventListener('focusin', function () { wake(); });
  } else if (drawerHost && !awake) {
    drawerHost.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'mouse') wake();
    });
    drawerHost.addEventListener('pointerdown', function (e) {
      if (awake) return;
      if (e.target.closest && e.target.closest('.jd-itemtag, a[href], .jd-pile > .jd-item')) { wake(); return; }
      wake({ x: e.clientX, y: e.clientY });
    }, true);
    drawerHost.addEventListener('focusin', function () { wake(); });
  }

  /* the full drawer opens in a NEW TAB (owner, 2026-09-27), so the reader
     keeps their place in the walkthrough. Called from the press itself, so
     it counts as a user gesture and no popup blocker stops it. */
  function openDrawer(hash) {
    var url = BASE + (hash ? '#' + hash : '');
    /* not the 'noopener' feature: with it window.open returns null even on
       success, which is indistinguishable from a blocked popup. The opener
       is cut by hand instead; only a real block falls back to this tab. */
    var w = window.open(url, '_blank');
    if (w) { try { w.opener = null; } catch (e) {} }
    else window.location.href = url;
  }

  /* EVERYTHING BEYOND DIGGING IS IN THE DRAWER ITSELF. The tag's buttons and
     the Take-a-Turn button take the reader to the full drawer: REPORT CARD
     opens that item's card there (the drawer's #<id> deep link), DOWNLOAD
     SVG opens the drawer on the same item, and the button opens the drawer.
     This page loads none of what those need — the record, the alternatives,
     the ratings, the turn — so it hands the reader to the page that does. */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest || !drawerHost || !drawerHost.contains(t)) return;
    var btn = t.closest('.jd-itemtag a');
    if (!btn) return;
    /* the tag names its own item: its REPORT CARD link is "#<id>" */
    var tag = btn.closest('.jd-itemtag');
    var fr = tag && tag.querySelector('.jd-fullrecord');
    var id = fr ? (fr.getAttribute('href') || '').replace(/^#/, '') : '';
    e.preventDefault();
    e.stopPropagation();
    openDrawer(id);
  }, true);
  if (window.JD_turnObject) {
    window.JD_turnObject.press = function () { openDrawer(); };
  }
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!t.closest || !t.closest('#jd-about-pane .jd-item--turn, .jd-ph-sec .jd-item--turn')) return;
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();
    e.stopPropagation();
    openDrawer();
  }, true);

  var SCRIM_SCENE = { 'jd-turn-scrim': 'instrument', 'jd-record-scrim': 'record',
                      'jd-folder-scrim': 'analytics' };
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      records.forEach(function (rec) {
        [].forEach.call(rec.addedNodes, function (n) {
          if (n.nodeType !== 1 || n.classList.contains('jd-scene-ghost')) return;
          for (var cls in SCRIM_SCENE) {
            if (n.classList.contains(cls) && wanted(SCRIM_SCENE[cls])) {
              n.classList.add(PHONE ? 'jd-ph-card' : 'jd-inline-card');
              sceneEls[SCRIM_SCENE[cls]].appendChild(n);
              return;
            }
          }
        });
      });
    }).observe(document.body, { childList: true });
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
    var g = cloneCard(card, 'g' + name.charAt(0) + '-');
    var old = host.querySelector('.jd-scene-ghost');
    if (old) host.removeChild(old);
    host.insertBefore(g, host.firstChild);
    host.__ghostH = host.__jdFit.natH * host.__jdFit.k;
    host.classList.add('has-ghost');
  }

  function cloneCard(card, prefix) {
    var g = card.cloneNode(true);
    g.classList.add('jd-scene-ghost');
    g.classList.remove('is-on');
    g.setAttribute('aria-hidden', 'true');
    g.setAttribute('inert', '');
    g.style.transform = card.style.transform;
    rewriteIds(g, prefix);
    /* A PICTURE OF A FINISHED DRAWING. A drawing on a card is held finished
       by the draw-on engine's paused animations — inline stroke dashes and
       a CSS animation, parked at their end by the filmstrip. A clone copies
       the inline styles but not the pause, so every animation in the ghost
       started again from nothing and the ghost showed an empty plate (owner,
       2026-09-26: the flash between the blank card and the rated one).
       Stripped here, the ghost shows the drawing plainly, as it stood. */
    stillDrawing(g);
    return g;
  }

  /* take the draw-on engine's state off every mark in a card: the drawing
     then shows plainly, as it stands finished, with nothing to replay */
  function stillDrawing(root) {
    [].forEach.call(root.querySelectorAll('[style]'), function (el) {
      var st = el.style;
      if (!st.animation && !st.strokeDasharray && !st.strokeDashoffset) return;
      st.animation = '';
      st.strokeDasharray = '';
      st.strokeDashoffset = '';
      st.removeProperty('--jdfo');
      st.removeProperty('--jdo');
    });
  }

  /* A CARD THAT MOVES LOSES ITS FILMSTRIP. The replay control holds the
     finished drawing as paused Web Animations; detaching the card cancels
     them, and re-attaching starts fresh CSS animations the control has no
     handle on — the drawing replays from nothing, un-steerable. So before a
     card moves, its control is taken down and its marks stilled; the host
     builds a new control when the card lands (ensureFilmstrip, in the fit). */
  function unmountFilmstrip(card) {
    [].forEach.call(card.querySelectorAll('svg'), function (svg) {
      var fs = svg.__jdFilmstrip;
      if (!fs) return;
      try { fs.destroy(); } catch (e) {}
      svg.__jdFilmstrip = null;
    });
    [].forEach.call(card.querySelectorAll('.jd-filmstrip'), function (b) {
      if (b.parentNode) b.parentNode.removeChild(b);
    });
    stillDrawing(card);
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
        } else if (a.name === 'for' || a.name === 'aria-labelledby' || a.name === 'data-axd' ||
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
    /* THE WARM-UP HANDS OVER (2026-09-27). A reader who arrives while this
       scene is still being built off-stage takes it over mid-build — and
       layout() skips any host marked is-prerender, so the scene stayed
       switched off, the pane blank, until the next scroll event happened to
       lay it out again. On a cold load (a hard refresh in Safari) the build
       is slow enough to be caught this way: "sometimes the report cards
       aren't there". The mark comes off here, before the layout. */
    if (host) { host.classList.remove('is-prerender'); useGhost(host); }
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
      /* ONLY THE LATEST STEP. A scene's first showing waits on its mount,
         and a fast scroll (Safari animates a jump through every step on the
         way) can name two more steps in the meantime. Those later steps are
         in a scene that is already current, so they resolve at once, and
         the first step used to land LAST — a jump to Gemini's card finished
         on Fable's. A step that is no longer current is dropped. */
      if (scene !== curScene || step !== curStep) return;
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
      var stage = (PHONE ? sceneEls.drawer : pane) || document;
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
      /* THE INSTRUMENT'S OWN ITEM (owner, 2026-09-27): the report cards keep
         the succulent, but the blank card the reader tries is a different
         prompt — the Googie UFO — so the walkthrough shows more than one
         drawing. Its four served responses, in the order data.php gives
         them; the card deals them blind. The succulent stands in if the UFO
         cannot be had. */
      return itemData(INSTRUMENT_ITEM).then(function (d) {
        return d || itemData(SPECIMEN);
      }).then(function (d) {
        var item = d && d.item;
        if (!item) return null;
        self._item = item;
        var picked = item.responses.slice(0, 4);
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
      var rated = mode === 'rated';
      /* THE SWAP FLASH. The rated job opens on the card's own last station —
         everything is filed, so it deals straight to the podium — and only
         then does the rail drive to the drawing the step names: for a frame
         or two the reader saw a podium between two drawings. So a swap to a
         named drawing is covered by a picture of the card as it stood, and
         the real card is shown only once the rail has landed (_railTo). */
      var ihost = sceneEls.instrument;
      if (rated && this._pending && ihost) {
        if (window.JD_turn.isOpen()) snapshot('instrument');
        ihost.__hold = true;
        ihost.classList.add('has-ghost');
      }
      if (window.JD_turn.isOpen()) closeCards();
      this._mode = mode;
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
      var gen = self._gen, presses = 0, lastPress = 0, ticks = 0;
      var host = sceneEls.instrument;
      /* the swap cover comes off once the card shows the drawing asked for —
         or, if the rail never gets there, after ~2.7s rather than never */
      function release() {
        if (!host.__hold) return;
        host.__hold = false;
        fitCard(host);
      }
      poll(function () {
        if (gen !== self._gen || !wanted('instrument')) return true;
        var scrim = realCard(host);
        var cur = scrim && scrim.querySelector('.jd-rail-step.is-current');
        if (cur && cur.getAttribute('data-step') === slot) { release(); fitSoon(host); return true; }
        if (++ticks > 45) { release(); return true; }
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
      if (sceneEls.instrument) sceneEls.instrument.__hold = false;
    }
  };

  /* ======================== SCENE 3 — THE REPORT CARD ===================== */
  /* FINISHED CARDS, ONE PER VIEW (owner, 2026-09-27: "sometimes the report
     cards aren't there … if there's a better way to load those drawings").
     This scene used to drive the drawer's live report-card MODAL: open it,
     wait for its data, press its thumbnails to turn it to each drawing, wait
     for each render, photograph each face for the handoffs. Every one of
     those waits was a race a cold load could lose, and a lost race left the
     pane empty or on the wrong drawing.

     Now jd-record builds each card as finished markup (JD_record.card — the
     same cardHTML the modal renders, same styles) and this scene simply
     holds them: one element per view the steps name, all built and fitted
     at mount, before the reader arrives. A step puts its view's card in the
     host; a handoff between two views carries the incoming card itself up
     the relay layer, and at the boundary that same element moves into the
     host. Nothing is opened, clicked, waited on or photographed, so there is
     nothing to lose. The card's own controls that matter here (a category's
     definition, the prompt's fold, the filmstrip) are wired below; a
     thumbnail takes the reader to that drawing's step, if it has one. */
  var cardSeq = 0;
  function recordViews() {
    var seen = {}, list = [];
    stepEls.forEach(function (el) {
      if (el.getAttribute('data-scene') !== 'record') return;
      var k = viewOf(el);
      if (seen[k]) return;
      seen[k] = true;
      list.push({ key: k, model: el.getAttribute('data-view'), step: el });
    });
    return list;
  }

  /* a card lands in the host: detached from wherever it was (its replay
     control rebuilt, see unmountFilmstrip), framed once (the drawings'
     frames and the prompt's fold, as jd-record's render() earns them after
     layout), fitted, and left with its drawing finished */
  function landCard(host, v) {
    if (v.node.parentNode !== host) {
      unmountFilmstrip(v.node);
      host.appendChild(v.node);
    }
    var sc = v.node.querySelector('.rc-scroll');
    if (!v.framed && sc) {
      if (window.JD_fitAll) window.JD_fitAll(sc);
      var fold = sc.querySelector('.rc-assign.rc-can-fold');
      var fp = fold && fold.querySelector('p');
      if (fp && fp.scrollHeight <= fp.clientHeight + 2) fold.classList.remove('rc-can-fold');
      v.framed = true;
    }
    fitCard(host);
    if (host.__jdFit) v.h = host.__jdFit.natH * host.__jdFit.k;
    finishDrawings(v.node);
    fitSoon(host); watchCard(host);
  }

  /* ---- THE PROMPT CARD (owner, 2026-09-27) ---------------------------------
     The record's Item column shows each item's title; hovering one (or
     tapping it, on a touch screen) shows the full prompt in a small card
     beside the cell, set like the report card's prompt box. One card for the
     page, fixed to the viewport and placed from the cell's own rect, so the
     pane's scale transform and the table's scroll cannot misplace it. */
  var promptTip = null;
  function showPromptTip(cell) {
    var text = cell.getAttribute('data-prompt');
    if (!text) return;
    if (!promptTip) {
      promptTip = document.createElement('div');
      promptTip.className = 'jd-prompt-tip';
      promptTip.setAttribute('role', 'tooltip');
      document.body.appendChild(promptTip);
    }
    promptTip.innerHTML = '<span class="jd-prompt-tip-h">The prompt</span>';
    var p = document.createElement('p');
    p.textContent = '\u201c' + text + '\u201d';
    promptTip.appendChild(p);
    promptTip.classList.add('is-on');
    var r = cell.getBoundingClientRect();
    var tw = promptTip.offsetWidth, th = promptTip.offsetHeight;
    var x = r.right + 10, y = r.top - 6;
    if (x + tw > window.innerWidth - 12) x = Math.max(12, r.left - tw - 10);
    if (y + th > window.innerHeight - 12) y = Math.max(12, window.innerHeight - th - 12);
    promptTip.style.left = Math.round(x) + 'px';
    promptTip.style.top = Math.round(y) + 'px';
  }
  function hidePromptTip() { if (promptTip) promptTip.classList.remove('is-on'); }
  document.addEventListener('mouseover', function (e) {
    var c = e.target.closest && e.target.closest('.jdc-sheet td.jdc-c-prompt');
    if (c) showPromptTip(c); else hidePromptTip();
  });
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.jdc-sheet td.jdc-c-prompt');
    if (c) showPromptTip(c); else hidePromptTip();
  });
  window.addEventListener('scroll', hidePromptTip, { passive: true });
  document.addEventListener('scroll', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('jdc-tablewrap')) hidePromptTip();
  }, true);

  /* ---- VIEWS: one prepared card per view, swapped in whole ------------------
     Shared by the report card and the charts. showView puts VIEW's card in
     the host and fits it — synchronously, so a swap at a boundary happens
     inside one task. prepareViews fits every view's card once, before a
     handoff needs its height. */
  function showView(host, key) {
    var v = host.__views && host.__views[key];
    if (!v) return false;
    var cur = realCard(host);
    if (cur && cur !== v.node) host.removeChild(cur);
    if (v.node.parentNode && v.node.parentNode !== host) {
      if (v.node.parentNode === relay) relay.__key = null;
      v.node.parentNode.removeChild(v.node);
    }
    landCard(host, v);
    host.__shows = key;
    return true;
  }
  function prepareViews(host) {
    if (!host.__views || host.__prepared) return;
    var back = host.__shows;
    Object.keys(host.__views).forEach(function (k) { showView(host, k); });
    host.__prepared = true;
    if (back) showView(host, back);
  }
  function firstView(scene) {
    for (var i = 0; i < stepEls.length; i++) {
      if (stepEls[i].getAttribute('data-scene') === scene) return viewOf(stepEls[i]);
    }
    return null;
  }

  scenes.record = {
    mount: function () {
      var host = sceneEls.record, self = this;
      /* THIS PAGE'S OWN DATA, not the drawer's (owner, 2026-09-27: "the
         survey instrument always loads, the report card doesn't"). The
         instrument builds from this page's own fetch of data.php; the cards
         used to wait for the drawer to hand jd-record its data, which the
         drawer does only after fetching every drawing in the pile — some
         seventy requests, all of which must land. One slow request on a cold
         load (a hard refresh against the one-request-at-a-time local
         server) and the cards never came. Now they need one data request
         and their own three drawings, exactly like the instrument. */
      if (!window.JD_record || !window.JD_record.card) {
        if (window.console) console.warn('about: jd-record has no card() — report cards unavailable');
        return Promise.resolve();
      }
      return itemData(SPECIMEN).then(function (d) {
        var item = d && d.item;
        if (!item) throw new Error('data.php?item=' + SPECIMEN + ' did not answer');
        var views = recordViews();
        return Promise.all(views.map(function (v) {
          var rid = null;
          for (var i = 0; i < item.responses.length; i++) {
            if (item.responses[i].model === v.model) { rid = item.responses[i].rid; break; }
          }
          return window.JD_record.card(item, rid, d).then(function (el) { return { v: v, el: el }; });
        }));
      }).then(function (built) {
        host.__views = host.__views || {};
        built.forEach(function (b) {
          if (!b.el) return;
          var el = b.el;
          el.classList.add('jd-inline-card');
          /* several cards share the document (the host's and the relay's):
             every id inside each is made its own */
          rewriteIds(el, 'rc' + (++cardSeq) + '-');
          host.__views[b.v.key] = { node: el, h: 0 };
        });
        self._built = Object.keys(host.__views).length > 0;
      }).catch(function (err) {
        /* a failed build is said out loud and tried again the next time
           the scene is entered, rather than leaving the pane empty for good */
        self._built = false;
        if (window.console) console.warn('about: report cards failed to build (' + (err && err.message) + ')');
      });
    },
    show: function (key) { return showView(sceneEls.record, key); },
    prepare: function () { prepareViews(sceneEls.record); },
    enter: function () {
      var self = this;
      if (!self._built) {
        /* the build failed or has not finished: (re)build, then come back */
        if (!self._building) {
          self._building = self.mount().then(function () {
            self._building = null;
            if (self._built && wanted('record')) self.enter();
          });
        }
        return self._building;
      }
      self.prepare();
      var key = curStep && document.querySelector('.jd-step[data-scene="record"][data-step="' + curStep + '"]');
      key = key ? viewOf(key) : (recordViews()[0] || {}).key;
      self.show(key);
      layout();
    },
    step: function (step) {
      var el = document.querySelector('.jd-step[data-scene="record"][data-step="' + step + '"]');
      if (el && this.show(viewOf(el))) layout();
    },
    exit: function () {}
  };

  var altCards = {};
  function turnInPlace(idx) {
    var host = sceneEls.record;
    itemData(SPECIMEN).then(function (d) {
      var item = d && d.item;
      var r = item && item.responses[idx];
      if (!r) return;
      /* the step's own card, if this drawing is one the steps show */
      var v = null;
      Object.keys(host.__views || {}).forEach(function (k) {
        if (!v && k === 'record:' + r.model) v = host.__views[k];
      });
      var ready = v ? Promise.resolve(v) : (altCards[r.rid] || (altCards[r.rid] =
        window.JD_record.card(item, r.rid, d).then(function (el) {
          if (!el) return null;
          el.classList.add('jd-inline-card');
          rewriteIds(el, 'rc' + (++cardSeq) + '-');
          return { node: el, h: 0 };
        })));
      ready.then(function (c) {
        if (!c || !wanted('record')) return;
        keepScroll(function () {
          var cur = realCard(host);
          if (cur && cur !== c.node) host.removeChild(cur);
          if (c.node.parentNode && c.node.parentNode !== host) {
            if (c.node.parentNode === relay) relay.__key = null;
            c.node.parentNode.removeChild(c.node);
          }
          landCard(host, c);
        });
        /* the host now shows a drawing its step did not name: the next
           step (or this one, re-entered) puts the step's card back */
        host.__shows = 'alt:' + r.rid;
        layout();
      });
    });
  }

  /* the card's own controls, on this page's cards (the modal's listeners
     live on the modal's own node, which this page never builds) */
  sceneEls.record.addEventListener('click', recordControls);
  function recordControls(e) {
    var t = e.target;
    if (!t.closest) return;
    var ax = t.closest('.rc-axbtn');
    if (ax) {
      var card = ax.closest('.jd-inline-card');
      var dr = card && card.querySelector('#' + ax.getAttribute('data-axd'));
      if (dr) {
        var opening = dr.hidden;
        dr.hidden = !opening;
        ax.setAttribute('aria-expanded', opening ? 'true' : 'false');
      }
      return;
    }
    var pv = t.closest('.rc-pv');
    if (pv) {
      var box = pv.closest('.rc-assign');
      if (box) {
        var open = box.classList.toggle('is-open');
        pv.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      return;
    }
    /* the strip's ◂ ▸ pagers: one thumbnail of travel along the strip */
    var nav = t.closest('.rc-alt-nav');
    if (nav) {
      var port = nav.parentNode && nav.parentNode.querySelector('.rc-alt-port');
      var th = port && port.querySelector('.rc-alt');
      if (port && th) {
        var by = (parseInt(nav.getAttribute('data-nav'), 10) || 1) * (th.getBoundingClientRect().width + 8);
        if (port.scrollBy) port.scrollBy({ left: by, behavior: reduceMotion ? 'auto' : 'smooth' });
        else port.scrollLeft += by;
      }
      return;
    }
    var alt = t.closest('.rc-alt');
    if (alt) {
      /* THE CARD TURNS IN PLACE (owner, 2026-09-27: "no longer jumps around
         the page when I select one of the other models … just change the
         image … and continue to scroll like normal"). A thumbnail swaps the
         card in the pane for that drawing's card — built once, from the
         same finished-card markup — and the page does not move. The step
         beside it keeps its text; the next step puts its own card back. */
      e.preventDefault();
      /* (a phone card turns inside its own figure: see phoneInit) */
      if (PHONE) phoneTurn(alt);
      else turnInPlace(parseInt(alt.getAttribute('data-resp'), 10));
    }
  }

  /* ========================= SCENE 4 — ANALYTICS ========================== */
  /* THE CHARTS, WITHOUT THE FOLDER (owner, 2026-09-27: "we won't need the
     analytics folder as a background … rework the graphs … follow the design
     principles of Edward Tufte"). This page draws its own three charts from
     the same endpoint the folder reads (/api/jd-analytics.php), so the
     numbers are the folder's numbers, but the ink is spent on data alone:
       - no frames, no fills, no gridlines; one hairline per row to carry the
         eye, and faint ticks at each point of the scale
       - direct labels everywhere (model names on the rows, values at the
         marks), so there is no legend and no value axis to read across
       - no axis labels (owner, 2026-09-27): the ticks carry the scale, and
         each value carries its n
       - one ink per model, the same in every chart (the folder's inks, the
         teal stepped up to pass the palette check), with the name beside
         every mark so identity never rests on color alone
       - each chart's subtitle says what the number is and what n counts
     Each step names one chart (data-fx) and about.css shows it alone. */
  var INK = ['#b8541f', '#00836a', '#2b5aa3', '#7a3b66'];
  /* the report card's grade meter, worst (1, Utility) to best (5, Prime) —
     copied from jd-core's meterSVG, as jd-furniture's grade book copies it */
  var GRADE_RAMP = ['#8f1d12', '#b0490f', '#a06200', '#46761a', '#0b6a1f'];

  function chartsHTML(a, tax, full) {
    var name = {}, ink = {};
    (a.models || []).forEach(function (m, i) {
      name[m.model_id] = m.label;
      ink[m.model_id] = INK[i % INK.length];
    });
    var esc = window.JD_esc || function (x) { return String(x); };
    /* rows in the overall-grade order, kept in every panel of the multiples
       so a model sits on the same line wherever the eye finds it */
    var order = (a.grades || []).slice()
      .sort(function (x, y) { return y.avg - x.avg; })
      .map(function (g) { return g.model_id; });
    function pos(v, lo, hi) { return ((v - lo) / (hi - lo) * 100).toFixed(2) + '%'; }
    function dotRows(rows, lo, hi, fmt, noName, noN) {
      var ticks = '';
      for (var t = lo; t <= hi; t++) ticks += '<i class="jdc-tick" style="left:' + pos(t, lo, hi) + '"></i>';
      return rows.map(function (r) {
        var tip = name[r.model_id] + ': ' + fmt(r.avg) + ' (n ' + r.n + ')';
        return '<div class="jdc-row" title="' + esc(tip) + '">' +
          '<span class="jdc-name">' + esc(name[r.model_id] || r.model_id) + '</span>' +
          '<span class="jdc-track"><i class="jdc-rule"></i>' + ticks +
          '<b class="jdc-dot" style="left:' + pos(r.avg, lo, hi) + ';background:' + ink[r.model_id] + '"></b></span>' +
          '<span class="jdc-val">' + fmt(r.avg) + (noN ? '' : '<span class="jdc-n">n ' + r.n + '</span>') + '</span></div>';
      }).join('');
    }
    function byOrder(list) {
      return order.map(function (id) {
        for (var i = 0; i < list.length; i++) if (list[i].model_id === id) return list[i];
        return null;
      }).filter(Boolean);
    }
    var one = function (v) { return v.toFixed(1); };
    var figs = {};

    /* 0 — THE RECORD, IN FULL (owner, 2026-09-27: "an actual table that
       shows the ratings for each one in each category … scrollable both
       horizontally and vertically … all of the ones that appear in the
       drawer"). One row per drawing on display — every prompt in the drawer,
       every model's drawing of it — with its overall grade, its rating in
       each of the four categories, and what it cost. Read from the drawer's
       full data.php, the same record the report cards read. A table is for
       looking things up: plain values, the scale in each head, nothing
       drawn; the head row and the prompt column hold still while it
       scrolls. */
    var liveAx = (tax.axes || []).filter(function (x) { return !x.defunct; });
    var modelName = {};
    (tax.models || []).forEach(function (m) { modelName[m.id] = m.label; });
    var items = (full && full.items) || [];
    /* ONE ROW PER PROMPT (owner, 2026-09-27): each prompt once, and each
       model's ratings across the row in a group of columns — Grade, then the
       four categories. */
    var perModel = {};
    var sheet = [];
    items.forEach(function (it) {
      var byM = {};
      (it.responses || []).forEach(function (r) {
        if (r.retired) return;
        /* two drawings by one model on one prompt: the better-graded wins */
        if (!byM[r.model] || (+r.grade || 0) > (+byM[r.model].grade || 0)) byM[r.model] = r;
      });
      var ms = Object.keys(byM);
      if (!ms.length) return;
      ms.forEach(function (m) { perModel[m] = (perModel[m] || 0) + 1; });
      sheet.push({ it: it, byM: byM });
    });
    /* THE FOUR-MODEL CAST ONLY (owner, 2026-09-27: "this doesn't have to be
       a comprehensive table … just the shape of the data"): the four models
       every turn is drawn by, in the charts' order, and only the prompts all
       four drew. */
    var mcols = (a.models || []).map(function (m) { return m.model_id; });
    sheet = sheet.filter(function (row) {
      return mcols.every(function (m) { return row.byM[m]; });
    });
    var sub = ['Overall Grade'].concat(liveAx.map(function (x) { return x.label; }));
    /* the scale each column is read on: 5 for the grade, an axis's own
       point count for its category */
    var pts = [5].concat(liveAx.map(function (x) { return (x.values || []).length || 3; }));
    /* SPARKLINES IN THE CELLS (owner, 2026-09-29): every value carries the
       folder's segmented gauge beside its number — the grade book's meter
       at cell size, exactly as the analytics folder's turn table draws it —
       so the sheet reads like that table. A category on a 3- or 4-point
       scale gets a gauge of as many segments, inked where its value falls
       on the five-step ramp. */
    function gauge(v, n) {
      var TW = 40, TH = 8;
      v = Math.max(1, Math.min(n, +v || 1));
      var ink = GRADE_RAMP[n === 5 ? Math.min(4, Math.max(0, Math.floor(v) - 1))
                                    : Math.round((v - 1) / (n - 1) * 4)];
      var w = TW * v / n, g = '';
      g += '<rect x="0.5" y="0.5" width="' + w.toFixed(1) + '" height="' + TH + '" fill="' + ink + '"/>';
      for (var t = 1; t < n; t++) {
        var tx = 0.5 + TW * t / n;
        g += '<line x1="' + tx.toFixed(1) + '" y1="0.5" x2="' + tx.toFixed(1) + '" y2="' + (TH + 0.5) +
             '" class="' + (tx <= 0.5 + w ? 'jdc-seg' : 'jdc-seg-out') + '"/>';
      }
      g += '<rect x="0.5" y="0.5" width="' + TW + '" height="' + TH +
           '" fill="none" stroke="rgba(74,53,18,0.28)" stroke-width="1"/>';
      return '<svg class="jdc-gauge" viewBox="0 0 ' + (TW + 1) + ' ' + (TH + 1) + '" aria-hidden="true">' + g + '</svg>';
    }
    function cell(r, k) {
      if (!r) return '';
      var v;
      if (k === 0) v = r.grade;
      else {
        v = r.annotations && r.annotations[liveAx[k - 1].id];
        if (v && typeof v === 'object') v = v.value;
      }
      if (v == null) return '<span class="jdc-none">&mdash;</span>';
      return '<span class="jdc-num">' + String(+v) + '</span>' + gauge(+v, pts[k]);
    }
    /* THE TABLE IS THE WHOLE VISUAL (owner, 2026-09-27): no card, no title,
       no subtitle — the sheet itself, on the page, as wide as a report card */
    figs.turns = '<figure class="jdc jdc-turns" data-chart="turns">' +
      '<div class="jdc-tablewrap" tabindex="0" aria-label="the record: ' + sheet.length +
      ' prompts, each model&rsquo;s grade and ratings; scrollable">' +
      '<table class="jdc-sheet"><thead><tr class="jdc-h1">' +
      '<th class="jdc-rn" rowspan="2" aria-label="row"></th>' +
      '<th class="jdc-c-prompt" rowspan="2">Item <span class="jdc-hint">(hover to see prompt)</span></th>' +
      mcols.map(function (m) {
        return '<th class="jdc-g-head" colspan="' + sub.length + '">' + esc(modelName[m] || m) + '</th>';
      }).join('') + '</tr><tr class="jdc-h2">' +
      mcols.map(function () {
        return sub.map(function (t, k) {
          return '<th class="jdc-c-num' + (k === 0 ? ' jdc-g-start' : '') + '">' + esc(t) + '</th>';
        }).join('');
      }).join('') + '</tr></thead><tbody>' +
      sheet.map(function (row, n) {
        var it = row.it, title = it.title || it.prompt || it.id;
        return '<tr><td class="jdc-rn">' + (n + 1) + '</td>' +
          /* the item's title, not its prompt: a summary is what a sheet
             shows. The prompt itself rides along for the hover card */
          '<td class="jdc-c-prompt" data-prompt="' + esc(it.prompt || '') + '">' + esc(title) + '</td>' +
          mcols.map(function (m) {
            return sub.map(function (t, k) {
              return '<td class="jdc-c-num' + (k === 0 ? ' jdc-g-start' : '') + '">' + cell(row.byM[m], k) + '</td>';
            }).join('');
          }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div></figure>';

    /* 1 — the overall grade, on the grade scale itself */
    /* 1b — THE DISTRIBUTION (owner, 2026-09-27: "not just the average, but
       the distribution for each of the models"). Small multiples: one
       histogram per model, counting its drawings at each overall grade from
       1 (Utility) to 5 (Prime). The panels share one count scale, so bar
       heights compare across models; each bar carries its count, and the
       grade's number sits under it — the words would crowd five narrow bars.
       Counted from the same record as the table beside the previous step
       (the prompts all four models drew), so every panel has the same n. */
    var gradeName = {};
    (tax.grades || []).forEach(function (g) { gradeName[g.rank] = g.label; });
    /* THE SAME RATINGS AS THE AVERAGE (owner, 2026-09-27: "if we have the
       overall grades for ninety-five, why can't we … draw the histograms?").
       jd-analytics.php now sends each model's grade counts ('hist') from
       exactly the rows its average is made of, so every panel sums to the n
       on the average chart. Until that endpoint is live, the panels fall
       back to counting the drawer's own record (the table's prompts). */
    var hist = {}, hmax = 0, fromAnalytics = (a.grades || []).some(function (g) { return g.hist; });
    order.forEach(function (m) { hist[m] = [0, 0, 0, 0, 0]; });
    if (fromAnalytics) {
      (a.grades || []).forEach(function (g) {
        if (!hist[g.model_id]) return;
        Object.keys(g.hist || {}).forEach(function (k) {
          var b = +k;
          if (b >= 1 && b <= 5) hist[g.model_id][b - 1] = +g.hist[k];
        });
      });
    } else {
      sheet.forEach(function (row) {
        order.forEach(function (m) {
          var r = row.byM[m], g = r && Math.round(+r.grade);
          if (g >= 1 && g <= 5) hist[m][g - 1]++;
        });
      });
    }
    order.forEach(function (m) { hist[m].forEach(function (c) { if (c > hmax) hmax = c; }); });
    /* ONE POPULATION FOR BOTH (2026-09-27): the average and the spread are
       read side by side, so they must count the same drawings. With the
       analytics counts in hand, the averages are the analytics' own; without
       them, the averages are computed from the same drawer record the spread
       counts, so the two never disagree about who was graded. */
    var gradeRows = fromAnalytics ? (a.grades || []) : order.map(function (m) {
      var h = hist[m], n = 0, sum = 0;
      h.forEach(function (c, i) { n += c; sum += c * (i + 1); });
      return { model_id: m, avg: n ? sum / n : 0, n: n };
    });

    /* THE AVERAGE AND THE SPREAD, ONE CARD (owner, 2026-09-27: "they kind
       of should go together"): one title over both, each chart with its own
       subtitle — the average first, then how each model's grades fall.
       The spread: COLOURED BY GRADE, NOT BY MODEL — each bar takes its
       grade's colour from the report card's meter (jd-core meterSVG), so a
       row reads as one grade across all four models; HORIZONTAL, IN ONE ROW —
       the grade names once, down the left, Prime at the top, the four models
       side by side on one shared scale, the count at each bar's end. */
    figs.grades = '<figure class="jdc jdc-pair" data-chart="grades">' +
      '<figcaption><span class="jdc-title">How the models compare</span></figcaption>' +
      '<div class="jdc-sec jdc-sec-avg"><span class="jdc-sub jdc-sec-sub">Average overall grade, from 1 (' +
        esc(gradeName[1] || 'Utility') + ') to 5 (' + esc(gradeName[5] || 'Prime') + ')</span>' +
        dotRows(byOrder(gradeRows), 1, 5, one) + '</div>' +
      '<div class="jdc-sec jdc-sec-spread"><span class="jdc-sub jdc-sec-sub">How each model&rsquo;s grades are spread: the same drawings, counted by grade</span>' +
      '<div class="jdc-hrow" style="grid-template-columns:auto repeat(' + order.length + ',1fr)">' +
      '<span class="jdc-hrow-corner"></span>' +
      order.map(function (m) { return '<span class="jdc-ptitle jdc-hrow-t" data-model="' + esc(m) + '">' + esc(name[m] || m) + '</span>'; }).join('') +
      [5, 4, 3, 2, 1].map(function (g) {
        return '<span class="jdc-hrow-lab">' + esc(gradeName[g] || g) + '</span>' +
          order.map(function (m) {
            var c = hist[m][g - 1];
            var tip = (name[m] || m) + ': ' + c + ' graded ' + (gradeName[g] || g);
            return '<span class="jdc-hrow-cell" data-model="' + esc(m) + '" data-grade="' + g + '" title="' + esc(tip) + '">' +
              '<b class="jdc-hrow-bar" style="width:' + (hmax ? (c / hmax * 78).toFixed(1) : 0) + '%;background:' + GRADE_RAMP[g - 1] + '"></b>' +
              '<span class="jdc-hrow-n">' + c + '</span></span>';
          }).join('');
      }).join('') + '</div></div></figure>';

    /* 2 — THE FOUR CATEGORIES AS ISSUE RATES (owner, 2026-09-30, from
       mockup-47; the analytics folder draws the same thing). Each panel is
       one 0–100% ruler: how often each model's drawings had a problem in
       that category, the dark segment the big problems, the pale one the
       small, and the value the whole bar. Je ne sais quoi measures what goes
       right, so it is the hit rate in green: Has it (dark) plus Just a hint.
       The whisker is a 95% Wilson interval on the whole bar; overlapping
       whiskers are not a difference. The split and the interval come from
       jd-furniture's JD_axisRates, so the folder and this page cannot
       disagree. Counted from jd-analytics.php's per-axis 'hist'; until that
       endpoint is live, from the drawer record (the table's prompts), as the
       grade spread does. */
    var axDef = {};
    (tax.axes || []).forEach(function (x) { axDef[x.id] = x; });
    var ISSUE = [GRADE_RAMP[0], '#cf6e56'], HIT = [GRADE_RAMP[4], '#6ea456'];
    var rates = window.JD_axisRates;
    var axHasHist = (a.axes || []).some(function (ax) {
      return (ax.models || []).some(function (r) { return r.hist; });
    });
    function sheetHist(axisId) {
      var out = {};
      order.forEach(function (m) {
        var h = {};
        sheet.forEach(function (row) {
          var r = row.byM[m], v = r && r.annotations && r.annotations[axisId];
          if (v && typeof v === 'object') v = v.value;
          if (v == null) return;
          var k = String(Math.round(+v));
          h[k] = (h[k] || 0) + 1;
        });
        out[m] = { model_id: m, hist: h };
      });
      return order.map(function (m) { return out[m]; });
    }
    function pc(x) { return Math.round(x * 100) + '%'; }
    function sw(c, t) { return '<span class="jdc-key"><i style="background:' + c + '"></i>' + t + '</span>'; }
    figs.axes = !rates ? '' : '<figure class="jdc" data-chart="axes">' +
      '<figcaption><span class="jdc-title">Issue rate in each category</span>' +
      '<span class="jdc-sub">How often each model&rsquo;s drawings had a problem; for Je ne sais quoi, how often they had it</span></figcaption>' +
      '<div class="jdc-legend">' + sw(ISSUE[0], 'big problem') + sw(ISSUE[1], 'small problem') +
        sw(HIT[0], 'has it') + sw(HIT[1], 'just a hint') +
        '<span class="jdc-key"><i class="jdc-key-ci"></i>95% interval</span></div>' +
      '<div class="jdc-multiples jdc-rates">' +
      (a.axes || []).map(function (ax, pi) {
        var def = axDef[ax.axis_id] || {};
        var pts = ax.points || (def.values ? def.values.length : 3);
        var src = axHasHist ? byOrder(ax.models || []) : sheetHist(ax.axis_id);
        var right = pi % 2 === 1;
        var rows = src.map(function (r) {
          var q = rates(r.hist, pts, ax.axis_id);
          if (!q.n) return '';
          var ink = q.hit ? HIT : ISSUE;
          var ps = q.strong / q.n * 100, pt = q.total / q.n * 100;
          var tip = (name[r.model_id] || r.model_id) + ': ' + pc(q.rate) + ' (95% ' + pc(q.lo) + '–' + pc(q.hi) + '); ' +
            (q.hit ? 'has it ' + q.strong + ', a hint ' + q.light + ', missed '
                   : 'big ' + q.strong + ', small ' + q.light + ', clean ') + (q.n - q.total) + ', n ' + q.n;
          return '<div class="jdc-row" title="' + esc(tip) + '">' +
            '<span class="jdc-name">' + esc(name[r.model_id] || r.model_id) + '</span>' +
            '<span class="jdc-track"><i class="jdc-rtrack"></i><i class="jdc-mid"></i>' +
            (ps > 0 ? '<b class="jdc-seg" style="left:0;width:' + ps.toFixed(2) + '%;background:' + ink[0] + '"></b>' : '') +
            (pt - ps > 0 ? '<b class="jdc-seg jdc-seg-end" style="left:' + ps.toFixed(2) + '%;width:' +
              (pt - ps).toFixed(2) + '%;background:' + ink[1] + '"></b>' : '') +
            '<i class="jdc-ci" style="left:' + (q.lo * 100).toFixed(2) + '%;width:' + ((q.hi - q.lo) * 100).toFixed(2) + '%"></i></span>' +
            '<span class="jdc-val">' + pc(q.rate) + '</span></div>';
        }).join('');
        return '<div class="jdc-panel' + (right ? ' is-right' : '') + '"><div class="jdc-ptitle">' + esc(ax.label) + '</div>' +
          rows + '</div>';
      }).join('') + '</div></figure>';

    /* 3 — cost per drawing: a length, so a bar, from zero */
    var cost = (a.cost || []).slice().sort(function (x, y) { return y.avg_usd - x.avg_usd; });
    var cmax = cost.length ? cost[0].avg_usd : 1;
    figs.cost = '<figure class="jdc" data-chart="cost">' +
      '<figcaption><span class="jdc-title">Average cost per drawing</span>' +
      '<span class="jdc-sub">API price of each call, from its own recorded token counts</span></figcaption>' +
      cost.map(function (c) {
        var tip = name[c.model_id] + ': $' + c.avg_usd.toFixed(3) + ' per drawing (n ' + c.n + ')';
        return '<div class="jdc-row jdc-barrow" title="' + esc(tip) + '">' +
          '<span class="jdc-name">' + esc(name[c.model_id] || c.model_id) + '</span>' +
          '<span class="jdc-track"><b class="jdc-bar" style="width:' + (c.avg_usd / cmax * 72).toFixed(2) +
          '%;background:' + ink[c.model_id] + '"></b>' +
          '<span class="jdc-val jdc-endval" style="left:calc(' + (c.avg_usd / cmax * 72).toFixed(2) + '% + 8px)">$' +
          c.avg_usd.toFixed(3) + '<span class="jdc-n">n ' + c.n + '</span></span></span><span></span></div>';
      }).join('') + '</figure>';
    return figs;
  }

  /* ONE CARD PER CHART, AND THE CHARTS SCROLL (owner, 2026-09-27: "instead
     of … blink in and out, have them scroll with their corresponding text,
     like the report cards"). Each chart — and the turns table — is its own
     paper card, one per view the steps name (data-view: turns, grades,
     axes, cost), built once at mount. A change of step is then a change of
     VIEW, and a change of view is a handoff: the card riding out with its
     text, the next one rising behind it on the relay, exactly as the report
     cards do. */
  scenes.analytics = {
    exit: function () {},
    mount: function () {
      var host = sceneEls.analytics;
      return Promise.all([
        fetch(API + '/api/jd-analytics.php').then(function (r) { return r.ok ? r.json() : null; }),
        /* the table is the full record, so this scene — and only this
           scene, when it is prepared — reads the drawer's whole data.php */
        fetch(API + BASE + 'data.php').then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; })
      ]).then(function (res) {
        var a = res[0], full = res[1];
        if (!a || !a.ok) return;
        var figs = chartsHTML(a, (full && full.taxonomy) || {}, full);
        host.__views = host.__views || {};
        Object.keys(figs).forEach(function (fx) {
          /* the measured card is a clear wrapper with room for the paper's
             drop shadow: the scene clips at the card's own box */
          var card = document.createElement('div');
          if (fx === 'turns') {
            /* the table stands on the page by itself */
            card.className = 'jd-inline-card jd-sheet-card';
            card.innerHTML = figs[fx];
          } else {
            card.className = 'jd-inline-card jd-charts-wrap';
            card.innerHTML = '<div class="jd-charts">' + figs[fx] + '</div>';
          }
          host.__views['analytics:' + fx] = { node: card, h: 0 };
        });
      }).catch(function (err) {
        if (window.console) console.warn('about: the charts failed to build (' + (err && err.message) + ')');
      });
    },
    enter: function () {
      var host = sceneEls.analytics;
      prepareViews(host);
      var el = curStep && document.querySelector('.jd-step[data-scene="analytics"][data-step="' + curStep + '"]');
      showView(host, el ? viewOf(el) : firstView('analytics'));
      layout();
    },
    step: function (step) {
      var el = document.querySelector('.jd-step[data-scene="analytics"][data-step="' + step + '"]');
      if (el && showView(sceneEls.analytics, viewOf(el))) layout();
      /* (a step's data-focus is applied by the stepper, from the LIT step —
         see applyFocus) */
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
        if (prerender !== name) { host.classList.remove('is-prerender'); layout(); next(); return; }
        if (sc.enter) sc.enter();
        else if (sc.step) sc.step('try');
        /* the clone is cut only once the card has STOPPED GROWING: three
           polls in a row at the same natural height, and a height a real
           card could have — a card still inlining its drawings or pulling
           its charts would otherwise be photographed half-built */
        var stable = 0, lastH = 0, tries = 0;
        poll(function () {
          if (prerender !== name) { host.classList.remove('is-prerender'); layout(); return true; }
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
          /* the report card's views are fitted here, off-stage, so every
             handoff has its card sized before the reader arrives */
          if (settled && name === 'record' && sc.prepare) sc.prepare();
          return finishWarm();
        }, 80, 160);
        function finishWarm() {
          if (prerender !== name) { host.classList.remove('is-prerender'); layout(); return true; }
          var card = realCard(host);
          if (card && hasContent(card)) snapshot(name);
          prerender = null;
          if (sc.exit) sc.exit();
          closeCards();
          host.classList.remove('is-prerender');
          useGhost(host);
          layout();
          setTimeout(next, 120);
          return true;
        }
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
    var line = focusLine(), lit = litLine();
    var chosen = stepEls[0], lighted = stepEls[0];
    for (var i = 0; i < stepEls.length; i++) {
      var t = stepEls[i].getBoundingClientRect().top;
      if (t <= line) chosen = stepEls[i];
      if (t <= lit) lighted = stepEls[i]; else break;
    }
    /* THE TEXT LIGHTS AS IT ARRIVES (owner, 2026-09-28: "it's only fully
       opaque when it's just beginning to leave"). A step's prose brightens —
       and a step's focus on its card takes hold — when its top crosses the
       LIT line, a fifth of the screen below the focus line, so it is fully
       lit a beat before it reaches its reading place. The scene and card
       changes still turn on the focus line: those are geometry, tied to the
       graphics' own handoffs. */
    if (lighted !== lastLit) {
      lastLit = lighted;
      stepEls.forEach(function (el) { el.classList.toggle('is-on', el === lighted); });
      applyFocus(lighted);
    }
    if (chosen === lastEl) return;
    lastEl = chosen;
    syncTimeline(chosen.getAttribute('data-step'), chosen.getAttribute('data-scene'));
    applyStep(chosen.getAttribute('data-scene'), chosen.getAttribute('data-step'));
  }
  var lastLit = null;
  /* a step can point at part of its card (data-focus; about.css dims the
     rest), set from the LIT step so the emphasis lands as the words do */
  function applyFocus(el) {
    var f = (el && el.getAttribute('data-focus')) || '';
    var host = el && sceneEls[el.getAttribute('data-scene')];
    Object.keys(sceneEls).forEach(function (k) {
      if (sceneEls[k] !== host || !f) sceneEls[k].removeAttribute('data-focus');
    });
    if (host && f) host.setAttribute('data-focus', f);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    var done = false;
    function run() { if (done) return; done = true; pickStep(); }
    if (window.requestAnimationFrame) window.requestAnimationFrame(run);
    setTimeout(run, 48);
  }

  if (!PHONE) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

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
             record: 'The report card', analytics: 'The analysis' }[id] || id;
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

  /* ============================ THE PHONE ===================================
     OPTION C, "STICKY SECTIONS" (owner, 2026-09-29). The pinned pane, the
     handoff, the relay, the fitting and the ghosts are a desktop design: a
     graphic BESIDE its prose. On a phone the page is an article instead,
     and each scene's graphic stands in the flow, above its own steps, as the
     real component in its own phone layout at 1:1 — the drawer's report
     card and turn card already have one. Three graphics are HELD (position:
     sticky, about.css) while the words beneath them point at them: the
     drawer through its three steps, and Gemini's and Kimi's drawings through
     theirs. Everything else scrolls like a page.

     This builds that page once, at load: every step is gathered into a
     section behind its graphic, the drawer and the instrument hosts move out
     of the pane into their sections, the report cards and the charts are
     built straight into theirs. The only thing the scroll still drives is
     scene 1's lift (the succulent's tag at "Every item has a grade") and a
     2px progress line under the banner. */
  var phoneAlt = {};
  function phoneEl(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  /* a card built for a phone figure: its own ids, its own class (NOT
     jd-inline-card, which would re-lay it out for the pinned pane) */
  function phoneCard(el) {
    el.classList.remove('jd-inline-card');
    el.classList.add('jd-ph-card');
    rewriteIds(el, 'rc' + (++cardSeq) + '-');
    return el;
  }
  /* framed once, as landCard does for the pane: the drawings' frames and
     the prompt's fold are earned after layout */
  function phoneFrame(node) {
    var sc = node.querySelector('.rc-scroll');
    if (!node.__jdFramed && sc) {
      if (window.JD_fitAll) window.JD_fitAll(sc);
      var fold = sc.querySelector('.rc-assign.rc-can-fold');
      var fp = fold && fold.querySelector('p');
      if (fp && fp.scrollHeight <= fp.clientHeight + 2) fold.classList.remove('rc-can-fold');
      node.__jdFramed = true;
    }
  }
  /* the replay control, under the plate, where the drawer's own card has it */
  function phoneFilmstrip(node) {
    var plate = node.querySelector('.rc-col-l > .rc-plate');
    var svg = plate && plate.querySelector('.rc-plate-art > svg');
    if (window.JD_filmstrip && svg && !svg.__jdFilmstrip) {
      try {
        window.JD_filmstrip(svg, plate, {
          autoplay: false, pfx: 'fsp' + (++sbSeq) + '_', label: 'Replay the drawing'
        });
      } catch (e) {}
    }
    finishDrawings(node);
  }
  /* the Fable card's sibling strip turns THAT card in place, as on the
     desktop; nothing else on the page moves */
  function phoneTurn(alt) {
    var card = alt.closest('.jd-ph-card');
    var fig = card && card.parentNode;
    if (!fig) return;
    var idx = parseInt(alt.getAttribute('data-resp'), 10);
    itemData(SPECIMEN).then(function (d) {
      var item = d && d.item;
      var r = item && item.responses[idx];
      if (!r || !window.JD_record || !window.JD_record.card) return;
      var ready = phoneAlt[r.rid] || (phoneAlt[r.rid] =
        window.JD_record.card(item, r.rid, d).then(function (el) {
          return el ? phoneCard(el) : null;
        }));
      ready.then(function (el) {
        if (!el || el === card || card.parentNode !== fig) return;
        keepScroll(function () {
          unmountFilmstrip(card);
          if (el.parentNode) el.parentNode.removeChild(el);
          fig.replaceChild(el, card);
          phoneFrame(el);
          phoneFilmstrip(el);
        });
      });
    });
  }

  /* THE TAG STAYS IN THE WELL (round 1, P1-2). The drawer seats a tag above
     its item when there is no room below, and on a phone's small well that
     put it up to 35px above the well, under the banner. It is moved back
     the way a visitor would move it — a drag of the tag itself, which the
     drawer clamps inside the well and re-strings the elastic for — as a
     synthetic press, marked so the wake-on-tap does not take it for one. */
  var tagNudging = false;
  function keepTagInWell() {
    var tag = sceneEls.drawer && sceneEls.drawer.querySelector('.jd-itemtag.is-on');
    var well = tag && tag.parentNode;
    if (!tag || !well || !window.PointerEvent) return;
    var t = parseFloat(tag.style.top) || 0;
    var want = Math.max(8, Math.min(well.clientHeight - tag.offsetHeight - 8, t));
    /* a drawer standing in the flow (short and landscape screens) is wide
       enough that a tag seated below its item lands on OPEN THE DRAWER in
       the corner: there the tag hangs at the top of the well */
    var pin = sceneEls.drawer.closest('.jd-ph-pin');
    if (pin && getComputedStyle(pin).position !== 'sticky') want = 8;
    if (Math.abs(want - t) < 4) return;
    var r = tag.getBoundingClientRect();
    var o = { pointerId: 7919, pointerType: 'touch', isPrimary: true, bubbles: true,
              cancelable: true, clientX: r.left + 40, clientY: r.top + r.height / 2 };
    tagNudging = true;
    try {
      tag.dispatchEvent(new PointerEvent('pointerdown', o));
      o.clientY += want - t;
      tag.dispatchEvent(new PointerEvent('pointermove', o));
      tag.dispatchEvent(new PointerEvent('pointerup', o));
    } catch (e) {}
    tagNudging = false;
  }

  function phoneInit() {
    root.classList.add('jd-about--phone');

    var grid = root.querySelector('.jd-about-grid');
    /* the cards now stand among the steps, and .jd-notes is the drawer's
       field-notes voice (mono 13px, uppercase ruled h2s) — which every card
       would inherit. The steps carry their own type (about.css, THE STEP
       TYPE), so on a phone the column drops the class. */
    var notesEl = root.querySelector('.jd-about-notes');
    if (notesEl) notesEl.classList.remove('jd-notes');
    /* THE TITLE LEADS (audit P1-6): it moves out of the opening step to the
       head of the page, above the drawer (about.css holds its place there
       from the first paint, before this script has run) */
    var head = root.querySelector('.jd-about-head');
    if (head && grid) grid.insertBefore(head, grid.firstChild);

    function stepEl(id) { return root.querySelector('.jd-step[data-step="' + id + '"]'); }
    var PLAN = [
      { name: 'drawer', steps: ['hook', 'premise', 'graded'], pin: true },
      { name: 'instrument', steps: ['try', 'taxonomy'] },
      { name: 'fable', steps: ['claude-fable-5'] },
      { name: 'gemini', steps: ['gemini-3-1-pro', 'gemini-answer', 'gemini-structure'], pin: true, under: true },
      { name: 'kimi', steps: ['kimi-k3'], pin: true, under: true },
      { name: 'turns', steps: ['stack'] },
      { name: 'grades', steps: ['grades'] },
      { name: 'distribution', steps: ['distribution'] },
      { name: 'axes', steps: ['multiples'] },
      { name: 'cost', steps: ['spend'] },
      { name: 'outro', steps: ['outro'], bare: true }
    ];
    var sec = {};
    PLAN.forEach(function (p) {
      var first = stepEl(p.steps[0]);
      if (!first) return;
      var s = phoneEl('section', 'jd-ph-sec' + (p.pin ? ' jd-ph-sec--pin' : ''));
      s.setAttribute('data-ph', p.name);
      first.parentNode.insertBefore(s, first);
      var f = null, u = null;
      if (!p.bare) { f = phoneEl('div', 'jd-ph-fig' + (p.pin ? ' jd-ph-pin' : '')); s.appendChild(f); }
      if (p.under) { u = phoneEl('div', 'jd-ph-fig jd-ph-under'); s.appendChild(u); }
      p.steps.forEach(function (id) { var st = stepEl(id); if (st) s.appendChild(st); });
      sec[p.name] = { sec: s, fig: f, under: u };
    });

    /* scene 1: the drawer itself, poster and live specimen, held */
    if (sec.drawer && sceneEls.drawer) sec.drawer.fig.appendChild(sceneEls.drawer);

    /* scene 2: the real turn card, in its own phone layout, open for good
       (it is the page's one live card: nothing else opens a modal here) */
    var ihost = sceneEls.instrument;
    if (sec.instrument && ihost) {
      sec.instrument.fig.appendChild(ihost);
      ihost.classList.add('is-on');
      var ins = scenes.instrument;
      ins._mounted = true;
      var t0 = Date.now();
      Promise.resolve(ins.mount()).then(function () { ins._open('blank'); }, function () {});
      /* THE CARD TURNS A PAGE (round 1, P1-5). A press that moves the card
         on (NEXT, BACK, a rail stop) re-renders it; once its heading has
         changed, the card's top is brought to just under the banner — only
         when it is above that line, so a reader looking at the card from
         above it is never pulled down. */
      ihost.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-act]');
        if (!b) return;
        var t0 = ihost.querySelector('.jd-turn-title');
        var before = t0 ? t0.textContent : '';
        poll(function () {
          var t = ihost.querySelector('.jd-turn-title');
          if (!t || t.textContent === before) return false;
          var card = ihost.querySelector('.jd-turn');
          if (!card) return true;
          var ban = document.querySelector('.site-banner');
          var line = (ban ? ban.getBoundingClientRect().bottom : 48) + 8;
          var top = card.getBoundingClientRect().top;
          if (top < line) {
            window.scrollTo({ top: Math.round(window.pageYOffset + top - line),
                              behavior: reduceMotion ? 'auto' : 'smooth' });
          }
          return true;
        }, 60, 30);
      }, true);   /* capture: the card re-renders inside its own click */
      /* the honest fallback, only if the card never stands up inline */
      poll(function () {
        if (ihost.querySelector('.jd-turn-scroll > *')) return true;
        if (Date.now() - t0 < 15000) return false;
        var note = phoneEl('p', 'jd-ph-fallback');
        note.innerHTML = 'The grading card is built for a larger screen &mdash; try it on a ' +
          'laptop or in the <a href="' + BASE + '" target="_blank" rel="noopener">full drawer</a>.';
        sec.instrument.fig.appendChild(note);
        return true;
      }, 250, 80);
    }

    /* scene 3: finished report cards, one per figure. Fable's is the whole
       card (it introduces the card); Gemini and Kimi each get the drawing
       HELD (masthead, plate, replay) and, under it in the flow, the same
       card's grades — two copies of one card() render, so they cannot
       disagree. */
    if (window.JD_record && window.JD_record.card) {
      itemData(SPECIMEN).then(function (d) {
        var item = d && d.item;
        if (!item) throw new Error('data.php?item=' + SPECIMEN + ' did not answer');
        function ridOf(model) {
          for (var i = 0; i < item.responses.length; i++) {
            if (item.responses[i].model === model) return item.responses[i].rid;
          }
          return null;
        }
        var want = [['fable', 'claude-fable-5', 'full'],
                    ['gemini', 'gemini-3-1-pro', 'pin'], ['gemini', 'gemini-3-1-pro', 'under'],
                    ['kimi', 'kimi-k3', 'pin'], ['kimi', 'kimi-k3', 'under']];
        return Promise.all(want.map(function (w) {
          return window.JD_record.card(item, ridOf(w[1]), d).then(function (el) {
            return { w: w, el: el, rid: ridOf(w[1]) };
          });
        }));
      }).then(function (built) {
        built.forEach(function (b) {
          var s = sec[b.w[0]];
          var target = s && (b.w[2] === 'under' ? s.under : s.fig);
          if (!b.el || !target) return;
          phoneCard(b.el);
          b.el.classList.add('jd-ph-card--' + b.w[2]);
          target.appendChild(b.el);
          phoneFrame(b.el);
          if (b.w[2] !== 'under') phoneFilmstrip(b.el);
          if (b.w[2] === 'full') phoneAlt[b.rid] = Promise.resolve(b.el);
        });
      }).catch(function (err) {
        if (window.console) console.warn('about: report cards failed to build (' + (err && err.message) + ')');
      });
    }
    ['fable', 'gemini', 'kimi'].forEach(function (k) {
      if (sec[k]) sec[k].sec.addEventListener('click', recordControls);
    });

    /* scene 4: the table and the charts, each above its own step. The
       spread is drawn twice: with the averages above "Insights", and alone,
       its two leaders picked out, above "Same averages…" (the desktop's
       in-place focus, made a figure of its own) */
    var an = scenes.analytics;
    an._mounted = true;
    Promise.resolve(an.mount()).then(function () {
      var v = sceneEls.analytics.__views || {};
      function take(key, target) {
        var x = v[key];
        if (!x || !target) return null;
        target.appendChild(phoneCard(x.node));
        return x.node;
      }
      var t = sec.turns && take('analytics:turns', sec.turns.fig);
      if (t) phoneTable(t);
      var g = sec.grades && take('analytics:grades', sec.grades.fig);
      if (g && sec.distribution) {
        var c = g.cloneNode(true);
        rewriteIds(c, 'ds-');
        sec.distribution.fig.appendChild(c);
      }
      if (sec.axes) take('analytics:axes', sec.axes.fig);
      if (sec.cost) take('analytics:cost', sec.cost.fig);
    });

    phoneScroll();
  }

  /* THE RECORDS TABLE ON A PHONE (audit P0-1, P2-4): no window of its own
     to scroll vertically — the page scrolls, the table only sideways. Ten
     rows, then a button for the rest; a line that says it scrolls sideways,
     and a fade at the edge while there is more to the right. */
  function phoneTable(card) {
    var fig = card.querySelector('figure.jdc-turns') || card;
    var wrap = card.querySelector('.jdc-tablewrap');
    var n = card.querySelectorAll('.jdc-sheet tbody tr').length;
    if (!wrap) return;
    var hint = phoneEl('p', 'jd-ph-hint');
    hint.textContent = 'Scroll for all four models →';
    fig.insertBefore(hint, fig.firstChild);
    var fade = phoneEl('span', 'jd-ph-fade');
    fade.setAttribute('aria-hidden', 'true');
    fig.appendChild(fade);
    var edge = function () {
      fig.classList.toggle('is-end', wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 2);
    };
    wrap.addEventListener('scroll', edge, { passive: true });
    setTimeout(edge, 0);
    if (n > 10) {
      card.classList.add('jd-ph-clip');
      var more = phoneEl('button', 'jd-ph-more');
      more.type = 'button';
      more.textContent = 'Show all ' + n + ' prompts';
      more.addEventListener('click', function () {
        card.classList.remove('jd-ph-clip');
        if (more.parentNode) more.parentNode.removeChild(more);
      });
      card.appendChild(more);
    }
  }

  /* what the scroll still drives on a phone: the progress line, and scene
     1's lift — the step current once its top passes 62% of the screen, so
     "Every item has a grade" is well into view under the held drawer */
  function phoneScroll() {
    var prog = phoneEl('div', 'jd-ph-progress');
    prog.setAttribute('aria-hidden', 'true');
    root.appendChild(prog);
    var cur = null, ticking = false;
    /* a static drawer (short and landscape screens) is out of view by the
       time "Every item has a grade" is read: there the lift comes early,
       while the drawer is in view and the reader has started down the
       opening step, and the tag then stays up */
    var dpin = sceneEls.drawer && sceneEls.drawer.closest('.jd-ph-pin');
    function drawerStatic() { return !!dpin && getComputedStyle(dpin).position !== 'sticky'; }
    var earlyLift = false;
    function lift(step) {
      if (step !== 'graded') {
        if (drawerStatic() && earlyLift) return;
        scenes.drawer.step(step);
        return;
      }
      /* the pile may still be loading: keep asking while the step stands,
         and never take the reader's own pick away from them */
      poll(function () {
        if (curStep !== 'graded' && !earlyLift) return true;
        if (sceneEls.drawer.querySelector('.jd-pile > .jd-item.is-picked')) return true;
        if (!window.JD_pick || !sceneEls.drawer.querySelector('[data-id="' + SPECIMEN + '"]')) return false;
        scenes.drawer.step('graded');
        setTimeout(keepTagInWell, 60);
        setTimeout(keepTagInWell, 450);
        return true;
      }, 150, 200);
    }
    sceneEls.drawer.addEventListener('pointerup', function () {
      setTimeout(keepTagInWell, 80);
      setTimeout(keepTagInWell, 450);
    });
    function tick() {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var f = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;
      prog.style.transform = 'scaleX(' + f.toFixed(4) + ')';
      var line = window.innerHeight * 0.62, chosen = stepEls[0];
      for (var i = 0; i < stepEls.length; i++) {
        if (stepEls[i].getBoundingClientRect().top <= line) chosen = stepEls[i];
        else break;
      }
      if (!earlyLift && drawerStatic() && window.pageYOffset >= 120) {
        var fr = dpin.getBoundingClientRect();
        var seen = Math.min(fr.bottom, window.innerHeight) - Math.max(fr.top, 0);
        if (fr.height && seen / fr.height >= 0.7) { earlyLift = true; curStep = 'graded'; lift('graded'); }
      }
      if (chosen === cur) return;
      cur = chosen;
      curStep = chosen.getAttribute('data-step');
      if (chosen.getAttribute('data-scene') === 'drawer') lift(curStep);
    }
    function onTick() {
      if (ticking) return;
      ticking = true;
      var done = false;
      function run() { if (done) return; done = true; tick(); }
      if (window.requestAnimationFrame) window.requestAnimationFrame(run);
      setTimeout(run, 48);
    }
    window.addEventListener('scroll', onTick, { passive: true });
    /* a phone's toolbar resizes the window mid-scroll, and the pile drops
       its tag on a resize: put the lift back */
    window.addEventListener('resize', function () {
      onTick();
      if (curStep === 'graded') setTimeout(function () { lift('graded'); }, 0);
    });
    tick();
  }

  /* back to the step that was being read before a breakpoint reload
     (see the listener at the top); re-placed for a couple of seconds while
     the page's figures build, unless the reader moves first */
  function restoreStep() {
    var r = null;
    try {
      r = JSON.parse(sessionStorage.getItem('jd-about-restore') || 'null');
      sessionStorage.removeItem('jd-about-restore');
      if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
    } catch (e) {}
    if (!r || !r.step || Date.now() - r.t > 60000) return;
    var el = root.querySelector('.jd-step[data-step="' + r.step + '"]');
    if (!el) return;
    var moved = false;
    var mark = function () { moved = true; };
    ['wheel', 'touchstart', 'keydown'].forEach(function (t) {
      window.addEventListener(t, mark, { passive: true, once: true });
    });
    var n = 0;
    (function place() {
      if (moved) return;
      var line = PHONE ? window.innerHeight * 0.45 : focusLine();
      window.scrollTo({ top: Math.max(0, Math.round(el.getBoundingClientRect().top +
        window.pageYOffset - line + 4)), behavior: 'instant' });
      if (++n < 12) setTimeout(place, 250);
    })();
  }

  if (PHONE) {
    phoneInit();
    restoreStep();
  } else {
  restoreStep();
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
  }

  /* exposed for the harness only: read-only state */
  window.JD_about = {
    scene: function () { return curScene; },
    step: function () { return curStep; },
    handoff: handoff,
    refit: function () { refitAll(); }
  };
})();
