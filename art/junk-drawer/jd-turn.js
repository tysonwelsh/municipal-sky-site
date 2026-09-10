/* ============================================================================
   THE JUNK DRAWER — jd-turn.js
   TAKE A TURN: the modal, its state machine, the bench, the podium, the
   unveil, the won item's drop into the pile, and curate mode. The
   darkroom's wait indicators live in jd-darkroom.js (JD_dark); the
   enlargement layer, the seeded RNG and the escape helper in jd-core.js.
   Loaded after those two. See jd-core.js for the file map.
   ========================================================================== */

/* ---- TAKE A TURN — the visitor commissions an object (contract C5) -------
   One modal, one state machine: consent → prompt → generating → reveal →
   rate (the single bench: response A, response B, the call) → unveil.
   Two providers draw the same prompt in parallel
   and are labelled only A and B until the ratings are in — blindness is
   enforced by the server (jd-generate never names a model), and this module
   never learns an identity before jd-rate answers.

   Conventions borrowed wholesale from JD_record, deliberately: scrim + card,
   role="dialog" aria-modal="true", Escape peels ONE layer (the enlargement,
   then the abandon confirm, then the modal), scrim-press closes the top
   layer, focus returns to the opener. The ratings screen borrows the record
   card's two plate tricks too — REPLAY and press-to-enlarge, on the same
   shared engine and the same .jd-record-zoom layer (2026-08-21). The two
   dialogs refuse to open over each other.

   Nothing here is hardcoded from the rubric: every grade, axis, value and
   size label is resolved from the taxonomy in the data.php payload the pile
   loader already fetched, exactly as the legend and the report card are.

   THE TRIGGER LIVES ELSEWHERE (2026-08-10). The corner brass card-holder is
   retired: the turn button in the pile is the sole opener, and it calls
   JD_turn.open() through the module interface at the foot of this file. This
   module owns the modal and the state machine and nothing about the control
   that summons it — which is why re-seating the trigger touched none of it. */
(function () {
  var API_GEN = '/api/jd-generate.php';
  var API_RATE = '/api/jd-rate.php';
  var API_TITLE = '/api/jd-title.php';
  var K_TURN = 'jd-turn-v1', K_CONSENT = 'jd-consent-v1';
  var K_ITEMS = 'jd-user-items-v1', K_SCATTER = 'jd-scatter-v2';
  var MAX_PROMPT = 500, MAX_NOTE = 500, MAX_ITEMS = 5;
  var SLOW_MS = 60000;      /* past a minute the wait earns its own line */
  var VISITOR_TIER = 'm';   /* every won item is filed "m" (C5.3) */
  var ROT_MAX = 34;         /* the pile's scatter rotation range, ± degrees */

  var payload = null;       /* the data.php payload — the survey renders from it */
  var scrim = null, card = null, headEl = null, bodyEl = null, confirmEl = null;
  var state = '', isOpen = false, confirmOn = false, restored = false;
  /* CURATE MODE (the re-rating bench, 2026-08-28): while this is set, the
     card is seated with an existing curated item's responses instead of a
     fresh turn — same bench, same rail, same podium, filed through the
     contract's file() callback (JD_bench's jd-item-rate.php outbox) instead
     of jd-rate.php. Null on every visitor turn. See curateOpen() below. */
  var curJob = null;
  /* set only at the go('reveal') that ends the darkroom wait: the next
     render draws the fresh plates on (see the hook at render()'s foot) */
  var revealFresh = false;
  var turn = null;          /* the persisted in-flight record (C5.3) */
  var work = null;          /* the working copy: svgs, ratings, comparison */
  var token = 0;            /* per-turn token — a settling fetch from an
                               abandoned turn must not touch the live one */
  var lastFocus = null, instSeq = 0, slowTimer = 0;
  var stateTitle = '';      /* the current state's heading — also the dialog's
                               accessible name, so the name changes with the
                               step instead of naming the whole flow once */
  /* the masthead the next paint will print: FORM JD-1 §n and the heading.
     head() fills it; the view string is built before paint runs, so the two
     can never disagree. */
  var pendingHead = null;

  /* ---------- small helpers ---------------------------------------------- */
  var esc = JD_esc, byId = JD_byId;
  /* crypto.randomUUID is present at the iOS 16 floor but only in a secure
     context, so the harness on a bare IP gets the getRandomValues path and
     Math.random is the last resort — the ref only has to be unique per
     visitor, the server never trusts it for anything but convergence */
  function uuid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      if (window.crypto && crypto.getRandomValues) {
        var b = new Uint8Array(16);
        crypto.getRandomValues(b);
        b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
        var h = [], i;
        for (i = 0; i < 16; i++) h.push((b[i] + 0x100).toString(16).slice(1));
        return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' +
          h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' +
          h.slice(10, 16).join('');
      }
    } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  /* retry_after, in words a person can act on */
  function humanWait(sec) {
    sec = Math.max(0, parseInt(sec, 10) || 0);
    if (!sec) return 'a little while';
    if (sec < 90) return 'a minute';
    if (sec < 3600) return Math.round(sec / 60) + ' minutes';
    if (sec < 5400) return 'an hour';
    if (sec < 86400) return Math.round(sec / 3600) + ' hours';
    return 'a day';
  }
  function svgDataUrl(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  /* a specimen name for a won item: the visitor's own words, cut to
     something a manila tag can carry (the full prompt is kept verbatim and
     shown on the report card) */
  function shortTitle(prompt) {
    var s = String(prompt || '').replace(/\s+/g, ' ').trim();
    return s.length > 52 ? s.slice(0, 51).replace(/\s+\S*$/, '') + '…' : s;
  }
  function tax() { return (payload || {}).taxonomy || {}; }
  function liveAxes() {
    return ((tax().axes) || []).filter(function (a) { return !a.defunct; });
  }
  function byRankDesc(list) {
    return (list || []).slice().sort(function (a, b) {
      return (b.rank || 0) - (a.rank || 0);
    });
  }
  function tierBox(id) {
    var tiers = tax().sizeTiers || [];
    for (var i = 0; i < tiers.length; i++) if (tiers[i].id === id) return tiers[i].box;
    return null;
  }

  /* ---------- payload ----------------------------------------------------- */
  /* The visitor's own items are restored WITHOUT this (see the init block at
     the foot of the module): they are stored whole, and a drawer that failed
     to load is exactly the moment not to lose them too. The payload, when it
     turns up, only supplies the taxonomy strings on their specimen tags and
     the entries behind their report cards. */
  function setData(data) {
    payload = data;
    if (!restored) { restored = true; restoreWon(); }
    else hydrateWon();
  }
  /* the pile loader hands the payload over on success; if the drawer itself
     failed to load, the survey fetches its own copy rather than inventing a
     rubric (C5.4 step 5) */
  function ensurePayload() {
    if (payload) return Promise.resolve(payload);
    return fetch(JD_API + '/art/junk-drawer/data.php')
      .then(function (r) {
        if (!r.ok) throw new Error('data.php ' + r.status);
        return r.json();
      })
      .then(function (d) { setData(d); return payload; });
  }

  /* ---------- the persisted turn (C5.3) ----------------------------------- */
  function persist() {
    if (turn) JD_store.set(K_TURN, turn);
  }
  /* discarding the turn also retires its token: the generate/rate calls are
     never aborted (the server finishes either way), so an answer that arrives
     after this point must find no turn to attach itself to */
  function clearTurn() {
    token++;
    turn = null; work = null;
    JD_store.remove(K_TURN);
  }
  function hasConsent() {
    var c = JD_store.get(K_CONSENT);
    return !!(c && c.version === JD_CONSENT.version);
  }

  /* ---------- the modal shell -------------------------------------------- */
  function build() {
    if (scrim) return;
    scrim = document.createElement('div');
    scrim.className = 'jd-turn-scrim';
    /* FORM JD-1 (round-15 redesign): the masthead lives OUTSIDE the scroller
       — the sheet's identity (form number, section, heading) never scrolls
       away from the words it names. (The round seals that used to share this
       masthead, and the sprite that defined their arc paths, were removed
       2026-08-14 — owner call, see the CSS banner.) */
    scrim.innerHTML =
      '<div class="jd-turn" role="dialog" aria-modal="true" ' +
      'aria-label="take a turn">' +
      /* F1 (round-16, seat revised 2026-08-16): the ✕ belongs to
         .jd-turn-head — pinned to the row's own top-right corner in the
         CSS, never positioned against the whole card in a separate
         coordinate frame. It sits OUTSIDE .jd-turn-headline, which is the
         only part of the head paint() rewrites on every state change — so
         the close button (and its one click listener, bound once below) is
         never torn down and never needs rebinding. */
      '<header class="jd-turn-head"><div class="jd-turn-headline"></div>' +
      '<button type="button" class="jd-turn-close" aria-label="close">' +
      '<span aria-hidden="true">✕</span></button></header>' +
      '<div class="jd-turn-scroll"></div></div>';
    document.body.appendChild(scrim);
    card = scrim.querySelector('.jd-turn');
    headEl = scrim.querySelector('.jd-turn-headline');
    bodyEl = scrim.querySelector('.jd-turn-scroll');
    scrim.addEventListener('pointerdown', function (e) {
      if (e.target === scrim) requestClose();
    });
    scrim.querySelector('.jd-turn-close').addEventListener('click', requestClose);
    bodyEl.addEventListener('click', onClick);
    bodyEl.addEventListener('change', onChange);
    bodyEl.addEventListener('input', onInput);
    /* the bench/call plate answers Enter/Space like the button it claims to
       be (role="button" — see plate()); Space is preventDefault'd or the
       card scrolls out from under the enlargement. REPLAY is a real
       <button>, so the UA turns these keys into its click — onClick above
       redraws, nothing here should zoom. */
    bodyEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      if (e.target.closest && e.target.closest('.jd-turn-draw')) return;
      var p = e.target.closest ? e.target.closest('.jd-turn-plate') : null;
      if (!p || p.getAttribute('role') !== 'button') return;
      e.preventDefault();
      openZoom(p);
    });
    ttInit();
    /* the trap: Tab cycles inside whichever layer is on top */
    card.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var scope = confirmOn && confirmEl ? confirmEl : card;
      var f = focusables(scope);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      } else if (scope.contains(document.activeElement)) {
        return;
      } else {
        e.preventDefault(); first.focus();
      }
    });
  }
  /* the honeypot carries tabindex="-1" and is excluded here by construction —
     a bot filling every input is the point, a keyboard visitor reaching it is
     not */
  function focusables(root) {
    var sel = 'a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), ' +
      'input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), ' +
      'select:not([disabled]):not([tabindex="-1"]), [tabindex="0"]';
    return Array.prototype.filter.call(root.querySelectorAll(sel), function (el) {
      return el.offsetParent !== null || el === document.activeElement;
    });
  }
  function focusFirst() {
    var f = focusables(confirmOn && confirmEl ? confirmEl : card);
    /* card, not bodyEl: the heading — the landing place for most states —
       lives in the masthead outside the scroller now */
    var pref = (confirmOn && confirmEl ? confirmEl : card)
      .querySelector('[data-autofocus]');
    var target = pref || f[0];
    if (target) { try { target.focus(); } catch (e) {} }
  }

  /* ---------- open / close ------------------------------------------------ */
  function open() {
    if (isOpen) return;
    /* one modal at a time (C5.4): the record card owns Escape while it is up */
    if (window.JD_record && window.JD_record.isOpen()) return;
    /* …and the analytics folder, which is a third such dialog (2026-08-28) */
    if (window.JD_folder && window.JD_folder.isOpen()) return;
    /* the working copy is minted by whoever opens the modal; since the opener
       is now an object in the pile rather than a button this module owns, it
       is minted HERE so every entry point gets the same clean start */
    if (!work) work = blankWork();
    build();
    lastFocus = document.activeElement;
    isOpen = true;
    confirmOn = false;
    scrim.classList.add('is-on');
    document.documentElement.classList.add('jd-turn-open');
    /* a turn from a previous page life was already discarded at init;
       a curated item skips the brief outright — its prompt is on record
       and its drawings already exist, so the card opens on the bench */
    go(curJob ? 'rate' : (!turn ? 'prompt' : state || 'prompt'));
    /* the curator working the backlog is not a visitor taking a turn — the
       analytics count real turns only */
    if (!curJob) JD_track('turn_open', null);
    /* close's twin, for the same one listener: JD_bench repaints its strip
       when the card actually stands (curate opens async behind a payload
       fetch, so the caller can't know this moment) */
    try {
      window.dispatchEvent(new CustomEvent('jd-turn-open'));
    } catch (e) {}
  }
  /* close paths that are free to leave: nothing is in flight or unfiled */
  function close() {
    if (!isOpen) return;
    closeZoom(true);   /* the layer outlives the card's DOM if it isn't peeled */
    isOpen = false;
    confirmOn = false;
    dismissConfirm();
    stopSlowTimer();
    scrim.classList.remove('is-on');
    document.documentElement.classList.remove('jd-turn-open');
    bodyEl.innerHTML = '';
    if (lastFocus && document.contains(lastFocus)) {
      try { lastFocus.focus(); } catch (e) {}
    }
    lastFocus = null;
    curJob = null;
    /* the LAST act of closing, after every bit of state above is settled:
       JD_bench listens for this to advance the backlog (or offer resume),
       and its handler may synchronously reopen this same modal — including
       via rerun(), which checks isOpen. Nothing may run after the dispatch. */
    try {
      window.dispatchEvent(new CustomEvent('jd-turn-close'));
    } catch (e) {}
  }
  /* Escape / scrim / ✕. Mid-flow states cost something to leave, so they ask
     once; the in-flight fetches are NOT aborted — the server finishes and
     records the generations, and an unrated submission is itself the
     abandonment datum (C5.4). */
  function requestClose() {
    if (!isOpen) return;
    if (confirmOn) { dismissConfirm(); return; }
    if (state === 'generating' || state === 'reveal' || state === 'rate') {
      showConfirm();
      return;
    }
    if (state === 'unveil' || state === 'apology') clearTurn();
    close();
  }
  function showConfirm() {
    if (confirmOn) return;
    /* the confirm must never open UNDER a still-open enlargement — the
       zoom layer paints above everything on the page, so peel it first
       (silently: the confirm, not the plate, is about to take focus) */
    closeZoom(true);
    confirmOn = true;
    confirmEl = document.createElement('div');
    confirmEl.className = 'jd-turn-confirm';
    confirmEl.setAttribute('role', 'alertdialog');
    confirmEl.setAttribute('aria-modal', 'true');
    confirmEl.setAttribute('aria-label',
      curJob ? 'set this item aside?' : 'abandon this turn?');
    /* the curate card costs nothing to leave — but the grades on it file as
       one item at the end, so leaving mid-card does drop this card's unfiled
       answers. Different stake, different sentence. */
    confirmEl.innerHTML =
      '<div class="jd-turn-confirm-card">' +
      (curJob
        ? '<p>set this item aside? grades file when the whole item files — ' +
          'this card’s answers aren’t saved yet.</p>'
        : '<p>abandon this turn? the machines finish either way — the drawing ' +
          'just goes unrated.</p>') +
      '<div class="jd-turn-actions">' +
      '<button type="button" class="jd-turn-go" data-act="stay" data-autofocus>keep going</button>' +
      '<button type="button" class="jd-turn-alt" data-act="abandon">' +
      (curJob ? 'set it aside' : 'abandon') + '</button>' +
      '</div></div>';
    confirmEl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b) return;
      if (b.getAttribute('data-act') === 'stay') { dismissConfirm(); focusFirst(); }
      else { clearTurn(); confirmOn = false; dismissConfirm(); close(); }
    });
    card.appendChild(confirmEl);
    focusFirst();
  }
  function dismissConfirm() {
    confirmOn = false;
    if (confirmEl && confirmEl.parentNode) confirmEl.parentNode.removeChild(confirmEl);
    confirmEl = null;
  }

  /* ---------- the definition layer (OVERRIDE 1, round-16) -----------------
     ONE system for every "what does this mean," and it is now JUST the
     fixed singleton tooltip: mouseover for pointer hover, focusin for
     keyboard focus on the CONTROL the definition is about (never the label
     itself — .jd-def is a plain <span>, not a tab stop). Screen readers get
     every definition natively via aria-describedby, pointed at a permanent
     .jd-vh node — see scaleRow/callPanel. The click-to-unfold ⓘ popover
     that used to sit beside the tooltip (owner: "an awkward little eye") is
     retired outright, not replaced with a second widget. Touch-without-a-
     screen-reader is a known, accepted gap: no hover, no focus ring, and a
     tap on a <select> hands off to the OS picker before any custom tooltip
     could show — the row label IS the definition's subject and the
     select's own option words carry the actual scale, which is judged
     self-explanatory enough to leave the gap open rather than patch it with
     another click affordance. The tooltip itself is pointer-events:none so
     it can never take a press a control should have had. */
  var ttEl = null;
  function ttInit() {
    if (ttEl) return;
    ttEl = document.createElement('div');
    ttEl.className = 'jd-tt';
    ttEl.setAttribute('aria-hidden', 'true');
    ttEl.hidden = true;
    document.body.appendChild(ttEl);
    bodyEl.addEventListener('mouseover', function (e) {
      if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
      var t = e.target.closest ? e.target.closest('[data-tt-t]') : null;
      if (t) ttShow(t); else ttHide();
    });
    bodyEl.addEventListener('mouseleave', ttHide);
    bodyEl.addEventListener('focusin', function (e) {
      var t = e.target.closest ? e.target.closest('[data-tt-t]') : null;
      var fv = false;
      try { fv = e.target.matches(':focus-visible'); } catch (err) {}
      if (t && fv) ttShow(t); else ttHide();
    });
    bodyEl.addEventListener('focusout', ttHide);
    /* the modal's own scroller — a tooltip pinned to a moved anchor lies */
    bodyEl.addEventListener('scroll', ttHide, true);
  }
  function ttShow(anchor) {
    if (!ttEl) return;
    ttEl.innerHTML = '<b>' + esc(anchor.getAttribute('data-tt-t')) + '</b>' +
      esc(anchor.getAttribute('data-tt-d'));
    ttEl.hidden = false;
    var r = anchor.getBoundingClientRect();
    ttEl.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 286)) + 'px';
    ttEl.style.top = Math.max(8, r.top - ttEl.offsetHeight - 8) + 'px';
  }
  function ttHide() { if (ttEl) ttEl.hidden = true; }

  /* Escape peels ONE layer per press: an open enlargement first, the abandon
     confirm second, the modal third, and never the page (the pile's own
     Escape handler stands down for as long as this dialog is up — see
     JD_layerOpen). A fourth layer — an open definitions popover — used to
     peel first; OVERRIDE 1 (round-16) retired the popover outright, so there
     is one fewer layer to peel. The enlargement joined the stack later
     (2026-08-21) and sits on top of everything, so it peels first. */
  window.addEventListener('keydown', function (e) {
    if (!isOpen || e.key !== 'Escape') return;
    e.preventDefault();
    if (zoom.isOn()) { closeZoom(); return; }
    ttHide();
    requestClose();
  });

  /* ---------- the state machine ------------------------------------------- */
  function go(next) {
    /* 'compare' retired 2026-08-11: the single bench's call step absorbed
       it. A stored turn from the two-state era maps onto the bench's last
       step rather than a state that no longer renders. */
    if (next === 'compare') {
      next = 'rate';
      if (work) { work.step = 'call'; work.reached.call = true; }
    }
    /* 'consent' retired 2026-08-14 (owner): the gating card is gone — the
       flow opens on the prompt, which carries the disclosure as fine print
       and records the acknowledgment when the words are actually sent. A
       stored turn parked on the old card lands on the prompt. */
    if (next === 'consent') next = 'prompt';
    state = next;
    if (turn) { turn.state = next; persist(); }
    render();
  }
  function render() {
    if (!isOpen) return;
    var h = '';
    if (state === 'prompt') h = viewPrompt();
    else if (state === 'generating') h = viewGenerating();
    else if (state === 'reveal') h = viewReveal();
    else if (state === 'rate') h = viewRate();
    else if (state === 'unveil') h = viewUnveil();
    else if (state === 'apology') h = viewApology();
    paint(h);
    bodyEl.scrollTop = 0;
    focusFirst();
    /* the assignment's fold is only honest if the words actually overflow
       it: measured here, on the painted DOM (the record card's discipline —
       its render strips rc-can-fold the same way). is-fit lifts the mask
       and hides the expander in one class. */
    var asn = bodyEl.querySelector('.jd-turn-assign');
    if (asn) {
      var ap = asn.querySelector('p');
      if (ap && ap.scrollHeight <= ap.clientHeight + 2) asn.classList.add('is-fit');
    }
    /* the fresh drawings' first appearance draws itself on (owner,
       2026-08-16 — "it should feel magical"): all surviving plates at
       once, via the shared engine, and ONLY on the arrival from the
       darkroom — revealFresh is set at the go('reveal') that ends the
       wait, so a restored or revisited reveal shows finished prints
       rather than replaying the trick. Respects reduced motion (no
       force: this is ambient, not a press). */
    if (state === 'reveal' && revealFresh) {
      revealFresh = false;
      if (window.JD_drawOn) {
        var fresh = bodyEl.querySelectorAll('.jd-turn-plates svg');
        for (var fi = 0; fi < fresh.length; fi++) window.JD_drawOn(fresh[fi]);
      }
    }
  }
  /* every write to the card goes through here: the masthead head() just
     declared, the body, the dialog's accessible name, and the card's
     data-view — the one hook the landscape bench's width and grid ride on
     (see .jd-turn[data-view="bench"] in junk-drawer.css). */
  function paint(h) {
    /* an open enlargement belongs to the plate it was lifted from, and this
       paint is about to replace that plate — peel the layer (silently: the
       node focus would return to is going away) rather than let it drift
       onto a stale step's paperwork. Unlike the report card, which re-syncs
       its enlargement across re-renders, the bench's whole navigation IS a
       re-render, so closing is the honest move. The peel lives HERE, not in
       render(): every write to the card goes through paint, including the
       filing-failure repaint in onFiled that bypasses render. */
    closeZoom(true);
    headEl.innerHTML = headHTML();
    bodyEl.innerHTML = h;
    /* the plates (reveal/bench/call) inline freshly-generated SVGs, which can
       overshoot the frame they declare — reframe them here, post-paint, on
       the live card (fitView needs the rendered DOM for getBBox). Views with
       no plates match nothing and this is a no-op. */
    if (window.JD_fitAll) window.JD_fitAll(bodyEl);
    /* the word drift builds itself from the painted DOM (it needs the well's
       measured size); any view without one matches nothing here. It also
       clears any drift left running from the previous paint — those live on
       timers, not on the elements, so dropping the DOM would not stop them. */
    if (window.JD_dark) window.JD_dark.mount(bodyEl);
    card.setAttribute('aria-label', stateTitle || 'take a turn');
    card.setAttribute('data-view', (pendingHead && pendingHead.view) || 'form');
  }
  /* the masthead: just the heading (the FORM JD-1 §n badge that used to
     lead this row was retired 2026-08-16, owner call — head() still takes
     the section number so the flow's §1–§6 order stays declared at the
     call sites, but nothing prints it) */
  function headHTML() {
    var p = pendingHead || { title: 'take a turn', sec: 1 };
    return '<h2 class="jd-turn-title" tabindex="-1"' +
      (p.noFocus ? '' : ' data-autofocus') + '>' + esc(p.title) + '</h2>';
  }

  /* (the consent card — C5.2's gating checkbox — retired 2026-08-14, owner
     call: the flow opens on the prompt. The DISCLOSURE survives: JD_CONSENT
     stays canonical for privacy.php and rides the prompt card as fine
     print; the acknowledgment is recorded when the words are sent.) */

  /* ---------- 1. the brief (§1) -------------------------------------------- */
  function viewPrompt() {
    var draft = (work && work.prompt) || '';
    var msg = work && work.notice
      ? '<p class="jd-turn-notice" role="status">' + esc(work.notice) + '</p>' : '';
    var n = draft.length;
    /* the one card that can come back WITHOUT the visitor having acted: a
       rate-limited turn returns here with work.notice explaining why (set in
       settleSlot) and the words the visitor typed stay put. Nothing is
       disabled — pressing send simply asks again. */
    /* CUTS §1 (round-16): the "two machines draw it, you grade both and keep
       one" line is cut — the heading says "describe an object," and every
       card after this one narrates its own step as the visitor reaches it
       ("two drawings came back," "grade drawing A"). The flow tells its own
       story; this card doesn't need to tell it in advance too. */
    return head('Describe an object', 1, { noFocus: true }) +
      msg +
      '<div class="jd-turn-fieldwrap">' +
      '<textarea id="jd-turn-prompt" class="jd-turn-input" rows="5" ' +
      'data-role="prompt" data-autofocus spellcheck="true" ' +
      'aria-label="describe an object for the drawer" ' +
      'placeholder="a brass fish that is also a whistle">' + esc(draft) + '</textarea>' +
      '<p class="jd-turn-count' + (n > MAX_PROMPT ? ' is-over' : '') +
      '" aria-live="polite">' + n + ' / ' + MAX_PROMPT + '</p></div>' +
      /* the honeypot: off-screen rather than display:none (which most bots
         skip), never in the tab order, never announced */
      '<div class="jd-turn-hp" aria-hidden="true">' +
      '<label for="jd-turn-website">leave this empty</label>' +
      '<input type="text" id="jd-turn-website" name="website" data-role="hp" ' +
      'tabindex="-1" autocomplete="off" value=""></div>' +
      actions(
        '<button type="button" class="jd-turn-go" data-act="generate"' +
        (draft.trim().length && n <= MAX_PROMPT ? '' : ' disabled') +
        '>send it</button>') +
      /* R2 addendum (owner, 2026-08-14): the card no longer prints
         JD_CONSENT.text — privacy.php §4 already quotes it verbatim and is
         live, so repeating it here was the redundant kind of bloat this
         round was cutting. One line naming where the words go, linking to
         the page that carries the full disclosure. JD_CONSENT.text/.version
         are unchanged and still what gets recorded on submission — this is
         a change to what the card SHOWS, not what the visitor agrees to. */
      '<p class="jd-turn-fine">Sent to Anthropic, OpenAI, Moonshot AI and ' +
      'Google to be drawn and studied — see our <a class="jd-turn-link" ' +
      'href="/privacy.php">privacy</a> page.</p>';
  }

  /* ---------- 3. the darkroom (§2) ------------------------------------------
     ROUND-17 REDESIGN (owner pick 2026-08-14, mockups/mockup-17a-loading-
     scatter.html, ported faithfully): the waiting card is a SQUARE sheet
     carrying four graph-paper print swatches in a tight 2×2 — the same
     swatch the finished drawings land in (.jd-turn-art's background, reused
     verbatim). While a machine works, its swatch runs an OLD-SCHOOL WEB
     WAIT INDICATOR printed in ink, dealt per turn from a pool of seven
     (round-24 rotation, owner directive 2026-08-21 — see darkDeal; before
     then each indicator was keyed stably to its slot letter):
       plotter — a generated circuit, fresh every turn (round-20
           swap, owner pick 2026-08-17 — the flipping hourglass retires;
           see darkPlotCircuit below for the construction)
       stray — "please / wait" ricocheting off the swatch's own edges
           (the DVD-menu screensaver; round-19 swap, owner pick 2026-08-16 —
           replaced the radial-tick throbber; round-23 reword 2026-08-18)
       scatter — LOADING… explodes, drifts, and zoops back
           together, three different bangs to a super-cycle, the whole
           flight generated fresh every turn (round-22 swap, owner pick
           2026-08-18 — the Win95 segmented progress bar retires; see
           darkScatterword below for the construction)
       watch — the classic Mac wait cursor, hands seeded from
           the turn ref so every wait starts at a different time (round-21
           swap, owner pick 2026-08-17 — the bouncing dots retire)
       bar — the honest bar: a hatched ink fill that climbs slowly,
           stalls, takes setbacks, and second-guesses itself above ~80,
           never finishing (rounds 24–25, owner pick 2026-08-21; see
           darkHonestBar below for the construction)
       words — Kimi's Take (art/kimis-take/) run small, in word mode:
           the traffic-managed streams crossing the swatch in all four
           directions on its own 9px grid, iframed from mini.php, every
           string one of the office's sixteen wait-words (owner
           directives 2026-08-22/23, mockup-34's tuning; see darkWell.
           The plain-character mode of the same piece was retired from
           the rotation 2026-08-26 — the wait is said in words here)
     ROUND 26 (owner pick 2026-08-21, mockup-26-standby-claude rev. 3): the
     fifth slip — "please wait…" in the pencil hand, floated ON TOP of the
     pile — is retired; it covered the indicators, which are the whole show.
     In its place the masthead is VISIBLE on this card (PLEASE STAND BY,
     centred as a full-width overlay band; the ✕ keeps its corner seat —
     F1's never-replaced static child, only its row is restyled in the CSS)
     and a plain mono sentence sits in the sheet's bottom margin, with the
     slow-timer line beneath it as before.
     The theatrics are aria-hidden; each swatch carries a visually-hidden
     status line that the wrapper's aria-live="polite" announces. paintSlots
     touches ONLY the swatch whose state changed — rewriting a still-pending
     swatch's markup would restart its loop every time a neighbour lands. */
  /* the failure word for a slot, by the code the server (or the wire) sent —
     owner directive, round 17: "didn't survive" is retired on THIS card for
     phrases that say what actually happened. Written to be reusable: the
     reveal's notices and the unveil's fate column keep their own copy for
     now (their redesign is a later card), but anything new asks this first. */
  var FAIL_WORDS = {
    provider_failed: 'the machine didn’t answer',
    sanitizer_rejected: 'the drawer refused the drawing',
    network: 'lost on the wire',
    rate_limited: 'out of turns for now',
    drawer_resting: 'the drawer is resting',
    slot_in_progress: 'already at work'
  };
  function failWord(code) {
    return FAIL_WORDS[code] || 'came back blank';
  }
  /* one slot's standing, read off the working copy — a restored or degraded
     turn lands here too, so a slot that is neither ok nor failed is pending */
  function slotStatus(slot) {
    var s = work.slots[slot] || {};
    if (s.status === 'ok') return { state: 'ok', word: 'arrived' };
    if (s.status === 'failed') return { state: 'fail', word: failWord(s.code) };
    return { state: 'pending', word: 'still drawing' };
  }
  /* the settled face of a swatch: its letter inks in over the verdict */
  function darkResultInner(slot, st) {
    return '<span class="jd-dark-big">' + slot.toUpperCase() + '</span>' +
      '<span class="jd-dark-verdict jd-dark-verdict--' + st.state + '">' +
      '<span class="m" aria-hidden="true">' + (st.state === 'ok' ? '✓' : '✗') +
      '</span> ' + esc(st.word) + '</span>';
  }
  /* the seed every generated indicator derives from: the turn's own
     client_ref, so a repaint or a restored turn re-derives the same show */
  function darkSeed() { return (turn && turn.client_ref) || 'jd'; }
  function darkSwatch(slot, anim) {
    var st = slotStatus(slot);
    return '<div class="jd-dark-sw jd-dark-sw--' + slot + '" data-slotline="' +
      slot + '" data-state="' + st.state + '">' +
      /* the kraft photo corners (round 26 rev. 4, owner directive): the
         waiting swatch wears the same hardware the Results plates do, so a
         slot visibly IS the frame its drawing will arrive in */
      '<span class="jd-turn-corner tl"></span><span class="jd-turn-corner tr"></span>' +
      '<span class="jd-turn-corner bl"></span><span class="jd-turn-corner br"></span>' +
      /* the label (rounds 28–29, owner calls): the whole phrase in the
         pencil hand, seated by the CSS beneath the frame */
      '<span class="jd-dark-label" aria-hidden="true">Model ' +
      slot.toUpperCase() + '</span>' +
      '<div class="jd-dark-well jd-dark-well--' + anim + '" aria-hidden="true">' +
      window.JD_dark.well(slot, anim, darkSeed()) + '</div>' +
      '<div class="jd-dark-result" aria-hidden="true">' +
      (st.state === 'pending' ? '' : darkResultInner(slot, st)) + '</div>' +
      /* the words the live region actually announces */
      '<span class="jd-vh" data-slotsr>slot ' + slot + ': ' + esc(st.word) +
      '</span></div>';
  }
  function pendingCount() {
    return JD_SLOTS.filter(function (s) {
      return work.slots[s].status === 'pending';
    }).length;
  }
  function viewGenerating() {
    /* THE MASTHEAD IS VISIBLE on this card since round 26 (owner pick,
       2026-08-21, mockups/mockup-26-standby-claude.html rev. 3): PLEASE
       STAND BY in the form's own serif, centred over the pile — the
       broadcast slate as a heading, not a slip. It is a fixed phrase, so
       the title no longer counts down as slots land (the round-17
       darkroomTitle() countdown retired with the sync in paintSlots);
       every landing still reaches assistive tech through each swatch's
       visually-hidden status line inside the wrapper's aria-live. The
       heading is also the landing focus now that it is visible (C5.8 —
       this card has no field of its own). */
    var deal = window.JD_dark.deal(darkSeed());   /* one shuffle per turn; slot i takes deal[i] */
    return head('Please stand by', 2, { view: 'darkroom' }) +
      '<div class="jd-dark" aria-live="polite">' +
      JD_SLOTS.map(function (s, i) { return darkSwatch(s, deal[i]); }).join('') +
      '</div>' +
      /* the margin line (round 26): the pencilled wait slip retired — it
         covered the indicators, which are the whole show. One plain
         sentence in the sheet's bottom margin instead, with a working
         ellipsis (aria-hidden: the words carry the meaning, the dots are
         theatre). The slow-timer line keeps its seat beneath it, behind
         the same data-slow/hidden pattern the timer has always used. This
         card still needs no summary line — pendingCount() hitting 0 goes
         straight to 'reveal'.
         The foot is a SIBLING of the pile since 2026-08-26 (owner catch):
         as a child pinned to the square's bottom 3%, the phone-width
         two-line wrap — and the slow line under it — climbed up into the
         Model C/D labels. The scroller is the same box as the pile on
         desktop, so the absolute seat is unchanged there; ≤600px the card
         grows below the square and this foot flows into the new band (see
         the darkroom media block in junk-drawer.css). */
      '<div class="jd-dark-foot"><span class="jd-dark-line">Your SVGs are ' +
      'being drawn. This could take a few minutes<span class="jd-dark-dots" ' +
      'aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></span>' +
      '<span class="jd-dark-slow" data-slow' + (work.slow ? '' : ' hidden') +
      '>Still going. The drawing is long because it is being written line by ' +
      'line.</span></div>';
  }
  function paintSlots() {
    if (!isOpen || state !== 'generating') return;
    JD_SLOTS.forEach(function (slot) {
      var sw = bodyEl.querySelector('[data-slotline="' + slot + '"]');
      if (!sw) return;
      var st = slotStatus(slot);
      /* untouched swatches are left alone — reprinting a pending swatch
         would restart its loop mid-drain every time a neighbour lands */
      if (sw.getAttribute('data-state') === st.state) return;
      sw.setAttribute('data-state', st.state);
      var res = sw.querySelector('.jd-dark-result');
      if (res) res.innerHTML = darkResultInner(slot, st);
      var sr = sw.querySelector('[data-slotsr]');
      if (sr) sr.textContent = 'slot ' + slot + ': ' + st.word;
    });
    var slow = bodyEl.querySelector('[data-slow]');
    if (slow && work.slow) slow.removeAttribute('hidden');
    /* (the round-17 countdown title — "Three are still drawing" — retired
       with round 26's fixed PLEASE STAND BY heading; the per-slot status
       lines above are the progress announcements now) */
  }
  function startSlowTimer() {
    stopSlowTimer();
    slowTimer = setTimeout(function () {
      slowTimer = 0;
      if (!work) return;
      work.slow = true;
      paintSlots();
    }, SLOW_MS);
  }
  function stopSlowTimer() {
    if (slowTimer) clearTimeout(slowTimer);
    slowTimer = 0;
  }

  /* ---------- 4. the reveal (§3, ATTACHED) ---------------------------------
     The exhibit is the record card's photograph, reused exactly: a
     graph-paper print swatch held down by kraft photo corners, floating a
     millimetre off the sheet. An attached photograph is an attached
     photograph. `pin` drops the caption — on the bench the heading already
     says which drawing this is. */
  /* the replay button's sketch mark: a pencil mid-stroke and the line it's
     leaving behind (see the replay note in plate() below) */
  var SKETCH_ICON =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2 20.8 C4.5 18.5, 6.5 22.5, 10 21.4"/>' +
    '<path d="M11 18.2 L19.8 5.8 L22.8 7.9 L14 20.3 Z"/>' +
    '<path d="M11 18.2 L10 21.6 L14 20.3 Z" fill="currentColor"/></svg>';

  function plate(slot, opts) {
    var s = work.slots[slot];
    if (!s || s.status !== 'ok') return '';
    opts = opts || {};
    /* two optional fittings, both worn only by the RATE plates (bench +
       call) — the reveal's stay plain, since its drawings just drew
       themselves on arrival and grading hasn't begun. `zoom` makes the
       whole figure the enlarge control, the record card's plate idiom
       (role/tabindex on the photograph, handlers at onClick and the
       anonymous plate keydown wired in build()); `replay` mounts the
       report photograph's REPLAY button on the print's own corner. The
       figure's data-slot is how the delegated handlers learn which drawing
       a press belongs to. */
    return '<figure class="jd-turn-plate"' +
      (opts.zoom ? ' role="button" tabindex="0" data-slot="' + slot + '"' +
        ' aria-label="Enlarge the artwork"' : '') + '>' +
      '<div class="jd-turn-art">' +
      '<span class="jd-turn-corner tl"></span><span class="jd-turn-corner tr"></span>' +
      '<span class="jd-turn-corner bl"></span><span class="jd-turn-corner br"></span>' +
      /* the generation id keys the frame: the reveal's big plate and the
         bench's pinned one are the same drawing and must be framed alike.
         A slot that somehow arrived without one falls back to this turn's
         own ref — never a bare slot letter, which the NEXT turn's slot A
         would collide with and inherit a stale frame from. The role="img"
         lives HERE, on the svg-only wrapper, not on .jd-turn-art: role=img
         makes every child presentational, which would hide the REPLAY
         button from assistive tech (the record card's .rc-plate-art
         carries no role for the same reason). */
      '<div class="jd-turn-art-in" role="img" aria-label="drawing ' +
      slot.toUpperCase() + '" data-fit="gen:' +
      esc(s.gen_id || ((turn && turn.client_ref) || 'turn') + ':' + slot) + '">' +
      window.JD_svgInst(s.svg, 'ju' + slot + (instSeq++) + '_') + '</div>' +
      (opts.replay
        /* icon-only since 2026-08-29 (owner, provisional pick "for now"):
           the pencil mid-stroke with the squiggle it's leaving — the button
           depicts the PROCESS it replays, not repetition (the ↻ family) and
           not the word. Inline currentColor SVG, the docket-scales idiom,
           so the hover inversion carries it. The word survives in title +
           aria-label. */
        ? '<button type="button" class="jd-turn-draw jd-turn-draw--icon" data-act="replay" ' +
          'data-slot="' + slot + '" ' +
          'title="watch the drawing draw itself again" ' +
          'aria-label="Replay drawing ' + slot.toUpperCase() + '">' +
          SKETCH_ICON + '</button>'
        : '') +
      /* the OVERLAY fittings (owner, 2026-08-26, best-to-worst prints):
         the Model label rides INSIDE the frame, top-centred over the
         artwork — bare text, no ground — and `spark` (pre-built by the
         caller) lays the visitor's own overall-grade gauge along the
         foot. Neither touches the artwork's box: both are absolutely
         placed, so the drawing sits exactly where it did unlabelled.
         aria-hidden — the pod wrapper's aria-label already says the name. */
      (opts.overlay
        ? '<span class="jd-pod-tag" aria-hidden="true">Model ' +
          slot.toUpperCase() + '</span>' + (opts.spark || '')
        : '') +
      '</div>' +
      /* "Model A" since rounds 28–29 (owner): the Results view restyles this
         caption as the darkroom's tape label; a plate worn with `overlay`
         (the podium prints) says it inside the frame instead */
      (opts.pin || opts.overlay
        ? '' : '<figcaption>Model ' + slot.toUpperCase() + '</figcaption>') +
      '</figure>';
  }
  function okSlots() {
    return JD_SLOTS.filter(function (s) { return work.slots[s].status === 'ok'; });
  }

  /* ---------- the bench's enlargement + REPLAY (owner, 2026-08-21) ----------
     The ratings screen borrows the report card's two plate tricks verbatim.
     REPLAY rides each grading plate's corner and plays the drawing again on
     request — an explicit press is requested motion, so it plays under
     prefers-reduced-motion too ({ force: true }; the rationale at the record
     card's drawOn applies unchanged: a button whose whole job is "animate
     this" going dead would be the worse accessibility outcome). ENLARGE is
     the record card's own full-viewport layer reused class-for-class
     (.jd-record-zoom/.rc-zoom-fig/.rc-zoom-art/.rc-zoom-cap), so the print
     held closer looks identical wherever it was lifted from.
     Two deliberate differences from the record card, both because the bench
     is BLIND and the bench NAVIGATES by re-rendering:
       — the caption names the visitor's prompt and the slot letter, never
         the model. The report card prints "title · model"; here that would
         leak which machine drew which before the unveil tells it.
       — a re-render CLOSES the layer rather than re-syncing it the way the
         report card's syncZoom does. The card re-renders under an open
         enlargement only when the response flips; the bench re-renders on
         every step, and an enlargement left open across a step change would
         hang over the wrong drawing's paperwork (the peel lives at paint()'s
         head, so the filing-failure repaint is covered too).
     State lives here, as JD_record's does, because Escape has to know which
     layer it is peeling: enlargement first, then the confirm, then the
     modal (the window keydown handler below). */
  var zoom = JD_zoomLayer();
  /* the enlargement's contents: the SAME drawing the plate shows, on the
     same graph-paper swatch (.rc-zoom-fig's CSS is shared with the record
     card). Its inlined copy takes a `juz` prefix — the plate's own copy is
     `ju<slot>N_`, still in the card underneath, and the record card's `jz`
     belongs to a dialog that refuses to be open alongside this one.
     `fit` is the plate's own data-fit key, carried over verbatim so
     JD_fitAll reframes the copy exactly as it framed the plate. */
  function zoomHTML(slot, fit) {
    var s = work.slots[slot];
    return '<div class="rc-zoom-fig" role="button" tabindex="0" ' +
      'aria-label="Shrink the artwork">' +
      '<div class="rc-zoom-art" data-fit="' + esc(fit) + '">' +
      window.JD_svgInst(s.svg, 'juz' + slot + (instSeq++) + '_') +
      '</div></div>' +
      '<div class="rc-zoom-cap">' +
      '<span class="rc-zoom-cap-t">' + esc(shortTitle(work.prompt)) +
      ' · drawing ' + slot.toUpperCase() + '</span>' +
      '<span class="rc-zoom-cap-h">click, or press Esc, to shrink</span>' +
      '</div>';
  }
  /* the enlargement is the shared layer (JD_zoomLayer, jd-core.js); the
     bench's one job is to say WHAT goes on it — the plate's own drawing,
     under the plate's own data-fit key, so JD_fitAll reframes the copy
     exactly as it framed the plate — and the grid scale is measured
     against the plate we lifted from. */
  function openZoom(from) {
    if (!isOpen || zoom.isOn() || !work) return;
    var slot = from.getAttribute('data-slot');
    var s = slot && work.slots[slot];
    if (!s || s.status !== 'ok') return;
    var artIn = from.querySelector('.jd-turn-art-in');
    zoom.open(from, zoomHTML(slot, artIn ? artIn.getAttribute('data-fit') : ''));
  }
  function closeZoom(silent) { zoom.close(silent); }
  /* REPLAY's half of the pair: find the plate's own svg and hand it to the
     shared draw-on engine with force — see the block comment above. Each
     plate replays its OWN drawing (the button carries data-slot, but the
     plate it rides is authority enough). */
  function replayPlate(btn) {
    /* the bench's REPLAY rides INSIDE the plate; the podium's sits under it,
       outside the figure, because there the figure is a drag handle. Either
       ancestor names the same one drawing. */
    var pl = btn.closest
      ? (btn.closest('.jd-turn-plate') || btn.closest('.jd-pod-print')) : null;
    var svg = pl ? pl.querySelector('.jd-turn-art-in svg') : null;
    if (svg && window.JD_drawOn) window.JD_drawOn(svg, { force: true });
  }

  function viewReveal() {
    var ok = okSlots();
    var lost = JD_SLOTS.length - ok.length;
    var notice = lost === 3
      ? '<p class="jd-turn-notice" role="status">three machines’ drawings ' +
        'didn’t survive — you’ll grade this one alone.</p>'
      : lost === 2
        ? '<p class="jd-turn-notice" role="status">two machines’ drawings ' +
          'didn’t survive — you’ll grade the two that came back.</p>'
      : lost === 1
        ? '<p class="jd-turn-notice" role="status">one machine’s drawing ' +
          'didn’t survive — you’ll grade the three that came back.</p>' : '';
    /* "The results" (round 26 rev. 4, owner rename — was the per-count
       "Four drawings came back" family): one fixed title, the darkroom's
       PLEASE STAND BY discipline; the notice line above the plates still
       states the count when a machine's drawing was lost */
    return head('The results', 3, { view: 'plates' }) +
      notice +
      '<div class="jd-turn-plates">' + ok.map(function (s) { return plate(s); }).join('') +
      '</div>' +
      /* CUTS §3 (round-16): "grade them first — the names come after" is cut
         — the button right below it already says "grade them," so the
         sentence was explaining a button whose own label is the same
         instruction. Who drew which is answered on its own turn, at the
         unveil. */
      actions('<button type="button" class="jd-turn-go" data-act="rate">grade them</button>');
  }

  /* ---------- 5. rate — the survey, rendered from the taxonomy -------------
     pillRow survives for the unveil's tie keep-chooser alone (the two-panel
     pill survey retired with the single bench, 2026-08-11). Its tick is
     GRAPHITE, not stamp red: the election is the visitor's own hand. */
  function pillRow(name, label, options, chosen, meta) {
    var h = '<div class="jd-pillrow" role="radiogroup" aria-label="' + esc(label) + '">';
    options.forEach(function (o) {
      var on = String(chosen == null ? '' : chosen) === String(o.value);
      h += '<label class="jd-pill' + (on ? ' is-on' : '') + '">' +
        '<input type="radio" name="' + esc(name) + '" value="' + esc(o.value) + '"' +
        meta + (on ? ' checked' : '') + '>' +
        '<span class="jd-pill-tick" aria-hidden="true">✓</span>' +
        esc(o.label) + '</label>';
    });
    return h + '</div>';
  }
  /* THE SINGLE BENCH (owner pick, mockup round 10, 2026-08-11). One response
     on the bench at a time — a step rail (response A → response B → the
     call), the artwork pinned sticky while its response is graded, every
     scale a native <select> (titles only on the control and in the list;
     skip is the honest default), and ONE definition system: a hover/focus
     tooltip anchored to a plain-text label (OVERRIDE 1, round-16 — the
     click-to-unfold ⓘ popover it used to pair with is retired outright).
     The two-panel pill survey and the separate compare state are retired;
     the call is THE PODIUM (below) and closes the same state. pillRow above
     survives for the unveil's keep-chooser only. */

  /* ═══════════════════════════════════════════════════════════════════════
     THE PODIUM (owner pick, mockups/mockup-32-podium.html, 2026-08-22).
     The call files a RANK ORDER now, not a winner and a margin. Four blocks
     descend left to right — tallest is 1st — and exactly one print stands
     on each; the survivors wait in a row underneath until they are dragged,
     tapped or Entered up onto a step, and dropping on a taken step SWAPS
     the two, so a visitor can reorder without ever clearing a place first.
     Two survivors build two steps, three build three. The height alone
     carries the order, so the card's only words are the four ordinals and
     the button: no instruction line, no margin question, no likert.

     The answer lives in work.ranks (slot → rank, 1 = first). work.winner is
     kept in step with whoever stands on 1st, so the unveil, the pile and
     the tracking beacon downstream need no notion of a ranking at all — and
     because the podium holds exactly one 1st, a 'tie' winner can no longer
     be minted (the unveil's tie chooser stays put for old/cached flows).
     ═══════════════════════════════════════════════════════════════════════ */
  var POD_ORD = ['1st', '2nd', '3rd', '4th'];
  /* THE ARMED PLACE — the no-drag path, inverted (owner, 2026-08-23). It used
     to be the PRINT you picked up first; now it is the PLACE you arm first,
     which frees the print's own press to mean "let me see this bigger" with
     no icon on it at all. null = nothing armed, 0 = the row, 1..n = a step. */
  var podArmed = null;
  var podDrag = null;   /* the drag in flight, or null */

  /* Nothing is cached across paints: the card is repainted by assigning an
     HTML string, so a held reference is a reference to a node that may
     already be off the document. Every lookup below is live, and during a
     drag the DOM does not change at all, so the rects stay honest. */
  function podRoot() { return bodyEl ? bodyEl.querySelector('.jd-pod') : null; }
  function podTiers() {
    var r = podRoot();
    return r ? r.querySelectorAll('.jd-pod-tier') : [];
  }
  function podTier(k) {
    var r = podRoot();
    return r ? r.querySelector('.jd-pod-tier[data-rank="' + k + '"]') : null;
  }
  function podPrintEl(slot) {
    var r = podRoot();
    return r ? r.querySelector('.jd-pod-print[data-pod="' + slot + '"]') : null;
  }
  function podRankOf(slot) {
    var r = (work && work.ranks) ? work.ranks[slot] : 0;
    return r > 0 ? r : 0;
  }
  function podAt(rank) {
    var ok = okSlots();
    for (var i = 0; i < ok.length; i++) if (podRankOf(ok[i]) === rank) return ok[i];
    return null;
  }
  /* the one bridge to everything downstream: whoever stands on 1st IS the
     winner, and the podium has no margin concept, so strength is always null */
  function podSync() {
    work.winner = podAt(1);
    work.strength = null;
  }
  /* a restored or degraded turn may hold ranks for slots that didn't survive,
     or ranks past the end of a shorter podium — drop them rather than build a
     step nobody can reach */
  function podNormalize(ok) {
    if (!work.ranks) work.ranks = {};
    var seen = {};
    JD_SLOTS.forEach(function (s) {
      var r = work.ranks[s];
      if (r == null) return;
      if (ok.indexOf(s) === -1 || !(r >= 1) || r > ok.length || seen[r]) delete work.ranks[s];
      else seen[r] = true;
    });
    podSync();
  }
  /* land `slot` on rank k (0 = back to the row). A taken step swaps its
     occupant into whatever place the incoming print just left; if the
     incoming print came from the row, the displaced one goes to the row. */
  function podMove(slot, k) {
    var from = podRankOf(slot);
    var sitting = k ? podAt(k) : null;
    if (from) delete work.ranks[slot];
    if (k) {
      work.ranks[slot] = k;
      if (sitting && sitting !== slot) {
        if (from) work.ranks[sitting] = from;
        else delete work.ranks[sitting];
      }
    }
    podArmed = null;
    podSync();
    podPaint();
    podSay('Model ' + slot.toUpperCase() +
      (k ? ' on ' + POD_ORD[k - 1] : ' back in the row') +
      (callReady() ? '. Ready to file.' : '.'));
  }
  /* arm a place and wait for a drawing. Arming the armed place disarms it. */
  function podArm(k) {
    podArmed = (podArmed === k) ? null : k;
    podPaint();
    podSay(podArmed === null ? 'Nothing waiting.'
      : (podArmed === 0 ? 'The row' : POD_ORD[podArmed - 1]) +
        ' is waiting — choose a drawing.');
  }
  /* a press on a print: it fills the armed place if one is waiting, and
     otherwise it does the only other thing a drawing can do — get bigger. */
  function podTap(slot) {
    if (podArmed !== null) { podMove(slot, podArmed); return; }
    var el = podPrintEl(slot);
    if (el) openZoom(el);
  }

  /* Move a print into its place — and ONLY if it isn't already there. Every
     re-parent detaches the node, and detaching the node the pointer is
     holding releases its pointer capture and fires pointercancel, which would
     kill the drag the instant it began. So: never touch a node whose place
     has not changed, and never touch the node currently in the air at all. */
  function podSeat(el, host) {
    if (!el || !host || el.parentNode === host) return;
    if (podDrag && podDrag.live && podDrag.el === el) return;
    var had = document.activeElement === el;
    host.appendChild(el);
    if (had) { try { el.focus({ preventScroll: true }); } catch (err) {} }
  }
  /* the in-place update. Classes, attributes and seating only — this never
     writes HTML, so it is safe to run with a drag in flight. */
  function podPaint() {
    var root = podRoot();
    if (!root) return;
    var ok = okSlots(), n = ok.length, placed = 0, k;
    for (k = 1; k <= n; k++) {
      var t = podTier(k);
      if (!t) continue;
      var occ = podAt(k), hole = t.querySelector('.jd-pod-hole');
      if (hole) hole.hidden = !!occ;
      t.classList.toggle('is-waiting', podArmed === k);
      t.setAttribute('aria-label', POD_ORD[k - 1] +
        (occ ? ', Model ' + occ.toUpperCase() : ', empty') +
        (podArmed === k ? ', waiting for a drawing' : ''));
    }
    ok.forEach(function (s, i) {
      var el = podPrintEl(s), r = podRankOf(s);
      if (!el) return;
      if (r) {
        placed++;
        var t2 = podTier(r);
        podSeat(el, t2 ? t2.querySelector('.jd-pod-stand') : null);
      } else {
        podSeat(el, root.querySelector('.jd-pod-cell[data-cell="' + i + '"]'));
      }
      /* the label states what THIS press will do, because that changes with
         whether a place is waiting */
      el.setAttribute('aria-label', 'Model ' + s.toUpperCase() +
        (r ? ', ' + POD_ORD[r - 1] : ', unplaced') +
        (podArmed === null ? '. Press to enlarge'
          : '. Press to put on ' + (podArmed === 0 ? 'the row' : POD_ORD[podArmed - 1])));
    });
    var tray = root.querySelector('.jd-pod-tray');
    if (tray) {
      tray.classList.toggle('is-bare', placed === n);
      tray.classList.toggle('is-waiting', podArmed === 0);
      tray.setAttribute('aria-label', 'The row' +
        (podArmed === 0 ? ', waiting for a drawing' : ''));
    }
    /* the ranking's own button is FILE on a visitor's turn and NEXT on a
       curation (the size card follows) — arm whichever is there */
    setDisabled('[data-act="file"], [data-act="next"]', !callReady());
  }
  /* the only words the podium ever produces, and they are never printed:
     a visually-hidden status line, for the visitors who can't see the steps */
  function podSay(msg) {
    var root = podRoot();
    var live = root ? root.querySelector('.jd-pod-live') : null;
    if (live) live.textContent = msg || '';
  }

  /* ---- the drag, and why it lives on the WINDOW ---------------------------
     This card is repainted by assigning an HTML string, and any re-render or
     re-parent of the dragged node releases its pointer capture and fires
     pointercancel — which killed this design's first draft outright. Two
     rules keep it alive: (1) while a drag is in flight nothing re-renders
     or re-parents a print (podPaint writes classes only; podSeat refuses to
     touch the one in the air), and (2) move/up/cancel are watched on the
     WINDOW, capture phase, filtered by pointerId — so whatever happens to
     the print's node, the pointer stream keeps arriving. A window blur
     cancels, and every exit runs through podDone(), so there is never a
     stuck ghost, a stuck faded print or a stale armed step left behind. */
  function podDown(e) {
    if (podDrag) return;
    if (e.button !== undefined && e.button > 0) return;
    if (!work || !bodyEl) return;
    var el = (e.target && e.target.closest) ? e.target.closest('.jd-pod-print') : null;
    if (!el || !bodyEl.contains(el)) return;
    /* the unveil's podium is a photograph of a filed answer, not a working
       one: nothing on it may start a drag, or a press after the grades are
       in would quietly rewrite work.ranks. Its presses are answered as
       clicks instead (onClick), and they only ever enlarge. */
    if (el.closest('.jd-pod--said')) return;
    e.preventDefault();          /* no native drag, no text selection, no scroll */
    try { el.focus({ preventScroll: true }); } catch (err) {}
    podDrag = {
      slot: el.getAttribute('data-pod'), el: el, live: false, ghost: null,
      gw: 0, dx: 0, dy: 0, x0: e.clientX, y0: e.clientY,
      pointerId: e.pointerId, over: null
    };
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    window.addEventListener('pointermove', podOnMove, true);
    window.addEventListener('pointerup', podOnUp, true);
    window.addEventListener('pointercancel', podOnCancel, true);
    window.addEventListener('blur', podOnCancel);
  }
  function podLift(e) {
    var el = podDrag.el, r = el.getBoundingClientRect(), root = podRoot();
    /* a drag supersedes an armed place — classes only, no repaint */
    if (podArmed !== null) {
      podArmed = null;
      if (root) {
        Array.prototype.forEach.call(root.querySelectorAll('.is-waiting'),
          function (p) { p.classList.remove('is-waiting'); });
      }
    }
    var g = document.createElement('div');
    g.className = 'jd-pod-ghost';
    g.style.width = r.width + 'px';
    var c = el.cloneNode(true);
    c.removeAttribute('tabindex'); c.removeAttribute('role');
    c.removeAttribute('data-pod'); c.removeAttribute('aria-label');
    c.setAttribute('aria-hidden', 'true');
    g.appendChild(c);
    /* the ghost is appended to the SCRIM, not <body>: the form's tokens are
       scoped there, and the scrim carries no transform or filter, so
       position:fixed still means the viewport */
    (scrim || document.body).appendChild(g);
    podDrag.live = true; podDrag.ghost = g; podDrag.gw = r.width;
    podDrag.dx = e.clientX - r.left; podDrag.dy = e.clientY - r.top;
    el.classList.add('is-lifted');
    document.body.classList.add('jd-pod-drag');
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount) { try { sel.removeAllRanges(); } catch (err) {} }
  }
  /* the drop is judged from the middle of the swatch the visitor can actually
     see, not the raw pointer — highlight and landing then agree by
     construction, because both read this one point */
  function podAim(e) {
    return { x: e.clientX - podDrag.dx + podDrag.gw / 2,
             y: e.clientY - podDrag.dy + podDrag.gw / 2 };
  }
  function podGrow(r, top, side, bottom) {
    return { left: r.left - side, right: r.right + side,
             top: r.top - top, bottom: r.bottom + bottom };
  }
  function podIn(r, x, y) { return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
  /* nearest step by horizontal distance — the gaps between the blocks, and
     the empty air above a short block, all belong to the step nearest them */
  function podNearest(x) {
    var tiers = podTiers(), best = 1, d = Infinity;
    for (var i = 0; i < tiers.length; i++) {
      var q = tiers[i].getBoundingClientRect();
      var dd = Math.abs(x - (q.left + q.right) / 2);
      if (dd < d) { d = dd; best = Number(tiers[i].getAttribute('data-rank')); }
    }
    return best;
  }
  /* rank 1..N, 0 for the row, null for nowhere. Rects are read fresh every
     time, so a scroll or a reflow mid-drag can never aim at a stale target. */
  function podHit(x, y) {
    var root = podRoot();
    if (!root) return null;
    var row = root.querySelector('.jd-pod-row');
    var tray = root.querySelector('.jd-pod-tray');
    if (row && podIn(podGrow(row.getBoundingClientRect(), 14, 8, 4), x, y)) return podNearest(x);
    if (tray && podIn(podGrow(tray.getBoundingClientRect(), 6, 8, 14), x, y)) return 0;
    return null;
  }
  function podOver(k) {
    if (!podDrag || k === podDrag.over) return;
    podDrag.over = k;
    var tiers = podTiers();
    for (var i = 0; i < tiers.length; i++) {
      tiers[i].classList.toggle('is-armed',
        Number(tiers[i].getAttribute('data-rank')) === k);
    }
  }
  function podOnMove(e) {
    if (!podDrag || e.pointerId !== podDrag.pointerId) return;
    if (!podDrag.live) {
      if (Math.abs(e.clientX - podDrag.x0) < 6 && Math.abs(e.clientY - podDrag.y0) < 6) return;
      podLift(e);
    }
    podDrag.ghost.style.left = (e.clientX - podDrag.dx) + 'px';
    podDrag.ghost.style.top = (e.clientY - podDrag.dy) + 'px';
    var a = podAim(e);
    podOver(podHit(a.x, a.y));
    if (e.cancelable) e.preventDefault();
  }
  function podDone() {
    if (!podDrag) return null;
    var d = podDrag;
    podDrag = null;
    window.removeEventListener('pointermove', podOnMove, true);
    window.removeEventListener('pointerup', podOnUp, true);
    window.removeEventListener('pointercancel', podOnCancel, true);
    window.removeEventListener('blur', podOnCancel);
    try { d.el.releasePointerCapture(d.pointerId); } catch (err) {}
    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    var root = podRoot();
    if (root) {
      Array.prototype.forEach.call(root.querySelectorAll('.jd-pod-tier.is-armed'),
        function (t) { t.classList.remove('is-armed'); });
    }
    d.el.classList.remove('is-lifted');
    document.body.classList.remove('jd-pod-drag');
    if (d.live) podSwallowClick();   /* the click it is about to emit is not a tap */
    return d;
  }
  function podOnUp(e) {
    if (!podDrag || e.pointerId !== podDrag.pointerId) return;
    if (!podDrag.live) { var s = podDrag.slot; podDone(); podTap(s); return; }
    var a = podAim(e), k = podHit(a.x, a.y), moved = podDrag.slot;
    podDone();
    if (k === null) { podPaint(); return; }   /* dead space: back where it was */
    podMove(moved, k);
  }
  function podOnCancel(e) {
    if (!podDrag) return;
    if (e && e.pointerId !== undefined && e.pointerId !== podDrag.pointerId) return;
    podDone();
    podPaint();
  }
  /* A finished drag emits one trailing click on the print it started from
     (pointer capture puts it there even if the finger ended elsewhere). Eat
     exactly that one, and only inside the podium, so a drag can never also
     read as a tap — and so this can never swallow the back button, the
     brass button, or anything else on the card. */
  function podSwallowClick() {
    var timer = 0;
    function eat(ev) {
      document.removeEventListener('click', eat, true);
      if (timer) clearTimeout(timer);
      var root = podRoot();
      if (root && ev.target && root.contains(ev.target)) {
        ev.stopPropagation(); ev.preventDefault();
      }
    }
    document.addEventListener('click', eat, true);
    timer = setTimeout(function () {
      document.removeEventListener('click', eat, true);
    }, 800);
  }
  /* Bound once, on the window, capture phase — the card's own delegated
     listeners are re-bound to nothing here, and a print's pointerdown has to
     be seen before the scrim's. Both bail immediately unless the press
     actually landed on a podium that is on screen. */
  window.addEventListener('pointerdown', podDown, true);
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    if (!work || !bodyEl) return;
    var t = e.target;
    if (!t || !t.closest || !bodyEl.contains(t)) return;
    /* the keyboard reads the same model as the finger: a place arms, a
       drawing fills the armed place or, with none armed, gets bigger */
    var said = t.closest('.jd-pod--said');
    var p = t.closest('.jd-pod-print');
    if (p) {
      e.preventDefault(); e.stopPropagation();
      if (said) openZoom(p); else podTap(p.getAttribute('data-pod'));
      return;
    }
    if (said) return;          /* a filed podium arms nothing */
    var tier = t.closest('.jd-pod-tier');
    if (tier) {
      e.preventDefault(); e.stopPropagation();
      podArm(Number(tier.getAttribute('data-rank')));
      return;
    }
    var trayEl = t.closest('.jd-pod-tray');
    if (trayEl) {
      e.preventDefault(); e.stopPropagation();
      podArm(0);
    }
  }, true);

  /* one question row: the label (a plain, non-interactive gloss — OVERRIDE
     1, round-16), a permanently-present hidden definition wired to the
     select via aria-describedby, and the select itself. (The folded
     per-axis note was removed at the owner's request, 2026-08-12 — the
     survey files values only. The report path's flag note below is
     separate and stays.) Re-rendering is safe: every answer lives in `work`
     and is written back as selected state here.

     THE DEFINITION IS ONE LINE (round-15 design, still true post-OVERRIDE-1):
     the axis's own definition and nothing else. The level-by-level schedule
     it used to unfold was twelve lines explaining a four-option select whose
     options are already words — and those words are in the select, which is
     where a person reads them. It used to reach the visitor through a
     click-to-unfold popover (owner: "an awkward little eye"); now it reaches
     keyboard and screen-reader users the moment they focus the select, and
     mouse users on hover over the label, and needs no toggle state at all. */
  /* The chosen-value gauge, built in ONE place because two callers need the
     identical mark: scaleRow() paints it with whatever was already answered,
     and onChange() re-paints it the instant the visitor picks (below). Owner
     directive r4: once a row has an actual answer it grows the SAME
     segmented bar the report card shows for that same value — window.
     JD_barHTML and the report card's own rc-r… / rc-q… / rc-g… rank classes,
     not a parallel set. (Those prefixes are written out rather than starred: a
     literal asterisk-slash inside a block comment closes it, and that broke
     the whole file once already.) `total` is the scale's own step count (3
     or 4 for an axis since v17, 5 for the grade), so the bar always fills against the
     total it's segmented into. Keeping this a function is the fix for a bug
     worth remembering: the gauge used to be inlined in scaleRow() alone, so
     it only ever appeared if you left the step and came back — in the flow
     a visitor actually walks, the select fires change, work.ratings is
     written, and the row itself never re-renders, so the gauge was
     invisible the whole way through a live turn. A mark that reports state
     has to be written wherever the state is written. */
  /* `empty` (owner, 2026-08-29): the bench's rows keep their gauge on show
     even before an answer — the same rc-bar shell at the same size, grayed,
     no fill, its segment ticks drawn in the gray so the scale's step count
     still reads. An answer swaps it for the real filled bar in place
     (paintGauge finds either by the shared .rc-bar class); clearing back to
     skip swaps the empty one back in. Callers that DON'T pass empty keep
     the old contract — the podium's grade spark still sparks nothing for a
     skipped grade (owner call, 2026-08-26). */
  function gaugeFor(ax, total, chosen, empty) {
    if (chosen == null) {
      if (!empty) return '';
      var eh = '<span class="rc-bar jd-bar--empty" aria-hidden="true">';
      for (var t = 1; t < total; t++) {
        eh += '<span class="rc-bar-tick" style="left:' +
          (100 * t / total).toFixed(1) + '%"></span>';
      }
      return eh + '</span>';
    }
    var picked = ax ? window.JD_byRank(ax.values, chosen)
      : window.JD_gradeOf(tax(), chosen);
    var rank = picked ? Math.round(picked.rank) : 0;
    if (!rank) return '';
    return window.JD_barHTML(rank, total,
      ax ? window.JD_axisCls(ax, rank) : 'rc-g' + rank);
  }
  function scaleRow(slot, kind, ax, chosen) {
    var axisId = ax ? ax.id : null;
    var label = ax ? (ax.label || ax.id) : 'overall grade';
    var desc = ax ? (ax.description || '') : 'The drawer’s own five-tier scale, best to worst.';
    var levels = byRankDesc(ax ? ax.values : tax().grades);
    var descId = 'jd-d-' + slot + '-' + (axisId || 'grade');
    /* THE DISCLOSURE (owner, 2026-08-28, replacing OVERRIDE 1's hover/focus
       tooltip): the definition now opens by PRESS, not hover — a caret
       beside the label toggles the row's explanation open under the whole
       row (see .jd-row-exp: last child, so the collapsed grid is untouched
       and the open text spans both columns). One behavior on desktop and
       phone alike, which also closes the touch gap the tooltip always had.
       The label goes back to plain print: no data-tt anchor, no dotted
       rule. aria-describedby on the select stays — a screen reader hears
       the definition at the control whether or not the sighted disclosure
       is open. */
    /* the WHOLE head is the toggle (owner, round 5): data-act rides the
       rowhead, so the label text and the air around it all answer the
       press — the caret (now LEADING the label, and grown to be seen) is
       kept as the tab stop and the state-bearer, its own click simply
       bubbling into the rowhead's. */
    var h = '<div class="jd-row' + (ax ? '' : ' jd-row--grade') + '">' +
      '<div class="jd-rowhead" data-act="def">' +
      '<button type="button" class="jd-defx" aria-expanded="false" ' +
      'aria-label="what ' + esc(window.JD_labelText ? window.JD_labelText(label) : label) +
      ' means"><span aria-hidden="true">+</span></button>' +
      '<span class="jd-def"><span>' + esc(label) + '</span></span>' +
      '</div>' +
      '<span class="jd-vh" id="' + descId + '">' + esc(desc) + '</span>' +
      /* the gauge (if any) is the FIRST CHILD of .jd-row-ctrl, not wrapped
         in its own span — paintGauge (below, in the input plumbing) finds
         it with ctrl.querySelector('.rc-bar') and removes/inserts it as a
         direct child on every change, so first paint has to hand it the
         identical shape or the live update's removeChild throws on a node
         that isn't actually its child. */
      '<div class="jd-row-ctrl">' + gaugeFor(ax, levels.length, chosen, true) +
      '<select class="jd-turn-select' + (chosen != null ? ' is-set' : '') + '" ' +
      'data-role="' + (ax ? 'axis' : 'grade') + '" data-slot="' + slot + '"' +
      (axisId ? ' data-axis="' + esc(axisId) + '"' : '') +
      ' aria-label="' + esc(label) + ' for response ' + slot.toUpperCase() +
      '" aria-describedby="' + descId + '">' +
      '<option value=""' + (chosen == null ? ' selected' : '') + '>skip</option>';
    levels.forEach(function (l) {
      var on = chosen != null && String(chosen) === String(l.rank);
      /* native option text cannot carry markup — the emphasis strips */
      h += '<option value="' + l.rank + '"' + (on ? ' selected' : '') + '>' +
        esc(window.JD_labelText(l.label || l.id)) + '</option>';
    });
    h += '</select></div>' +
      /* LAST child, deliberately: hidden it leaves the grid exactly as it
         was; open it auto-places on the next grid row spanning both
         columns — and the stacked narrow-band folds inherit it with no
         extra rules */
      '<div class="jd-row-exp" hidden>' + esc(desc) + '</div>';
    return h + '</div>';
  }
  /* the column head above the rows, mirroring the report card's <thead>
     (owner directive r4 — see .rc-subj th): same two-column split, but the
     left word is SUBJECT (owner, 2026-08-27 — a school report card's word;
     "Axis" is the taxonomy's word, and the visitor isn't reading the
     taxonomy), and the right column is worded to ASK rather than report —
     the report card's "Verdict" names a fact already filed, this one names
     a blank still waiting to be filled. A plain grid row, not a table head,
     so it carries nothing assistive tech needs; each select's own
     aria-label/aria-describedby already says what it is. */
  function benchHeadHTML() {
    return '<div class="jd-row jd-row--head" aria-hidden="true">' +
      '<span>Subject</span><span>Your rating</span></div>';
  }
  /* the bench gate (owner, 2026-08-27): a drawing's panel doesn't hand off
     — to the next drawing or to the ranking — until every scale on it is
     answered, the overall grade included. Same disabled-until-done contract
     the podium's FILE THE GRADES button already keeps; "skip" stays in the
     list as the unanswered state's own name, but it no longer walks through
     the gate. */
  function benchRated(slot) {
    var r = work.ratings[slot];
    if (!r || r.grade == null) return false;
    return liveAxes().every(function (ax) { return r.axes[ax.id] != null; });
  }

  /* THE DOCKET (owner redesign, 2026-08-26; discovered in mockups/
     mockup-39-rail-alternatives.html, replacing the numbered boxed rail).
     A centred strip of circled letters: a ring the visitor has finished
     FILLS IN — solid graphite, its letter reading paper (their pencil, not
     the bureau's tick) — the current ring is red-rung and red-lettered on
     raised paper, an unreached one sits dim and dead. The fifth ring is
     THE SCALES (drawn inline in currentColor — the ⚖ character is
     illegible at ring size), standing for "best to worst": the one node
     that isn't a letter, as its step is the one step that isn't a single
     drawing. Hairline connectors run between the rings — solid behind the
     visitor, dashed on the road ahead. First pass is still linear (a step
     unlocks when the one before it is left), back is always one press; a
     degraded one-survivor turn has no rail at all — one panel, then file. */
  var RAIL_SCALES =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M3.5 6 H20.5"/><circle cx="12" cy="3.8" r="1.2"/>' +
    '<path d="M12 6 V18.5 M8.5 19.5 H15.5"/>' +
    '<path d="M6 6 L3.5 11.5 M6 6 L8.5 11.5"/>' +
    '<path d="M2.5 11.5 A3.5 3.5 0 0 0 9.5 11.5"/>' +
    '<path d="M18 6 L15.5 11.5 M18 6 L20.5 11.5"/>' +
    '<path d="M14.5 11.5 A3.5 3.5 0 0 0 21.5 11.5"/></svg>';
  /* the steps this turn walks, in order: a drawing per surviving slot, the
     ranking when there is more than one, and — curation only — the size
     card that closes it (owner, 2026-08-30) */
  function stepSeq() {
    var seq = okSlots();
    if (seq.length > 1) seq = seq.concat(['call']);
    if (sizeTiers().length) seq = seq.concat(['size']);
    return seq;
  }

  /* the size step's ring mark: two nested squares, the scale itself */
  var RAIL_SIZE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" ' +
    'aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="1"/>' +
    '<rect x="9.5" y="9.5" width="5" height="5" rx="0.5"/></svg>';

  function railHTML(ok) {
    var steps = ok.map(function (s) {
      return { id: s, n: ok.indexOf(s) + 1, label: 'drawing ' + s.toUpperCase(),
        face: s.toUpperCase() };
    });
    /* "best to worst" — the ranking step's public name (owner, 2026-08-26;
       it opened life as "the call", which survives in the internal ids).
       Its ring wears the one-word form RANKING where words are worn. */
    if (ok.length > 1) {
      steps.push({ id: 'call', n: ok.length + 1, label: 'best to worst',
        face: RAIL_SCALES, word: 'ranking' });
    }
    /* the size card closes a curation (owner, 2026-08-30): its ring wears
       the nested-squares mark — the scale itself, small inside large */
    if (sizeTiers().length) {
      steps.push({ id: 'size', n: steps.length + 1, label: 'how big is it',
        face: RAIL_SIZE, word: 'size' });
    }
    var h = '<div class="jd-rail" role="list">';
    steps.forEach(function (st, i) {
      var current = work.step === st.id;
      var reached = !!work.reached[st.id];
      /* the link INTO a node is walked once that node has been reached —
         so the rule runs solid up to wherever the visitor has stood */
      if (i > 0) {
        h += '<i class="jd-rail-lnk' + (reached ? ' is-walked' : '') +
          '" aria-hidden="true"></i>';
      }
      /* on the wide-viewport bench the node is a PILL wearing its word and
         the ring stands down (the letter would repeat the word's own);
         the phone and the narrow best-to-worst sheet keep bare rings —
         CSS decides, keyed on width, data-view and the --call modifier */
      h += '<button type="button" role="listitem" class="jd-rail-step' +
        (st.id === 'call' ? ' jd-rail-step--call' : '') +
        (current ? ' is-current' : reached ? ' is-done' : '') +
        '" data-act="step" data-step="' + st.id +
        '"' + (reached ? '' : ' disabled') +
        (current ? ' aria-current="step"' : '') +
        ' aria-label="step ' + st.n + ' — ' + esc(st.label) + '">' +
        '<span class="jd-rail-ring">' + st.face + '</span>' +
        '<span class="jd-rail-word">' + esc(st.word || st.label) + '</span>' +
        '</button>';
    });
    return h + '</div>';
  }

  /* THE PROMPT ON THE BENCH (owner, 2026-08-28; reseated same day): the
     prompt, verbatim, at the head of the paperwork column — exhibit on the
     left, then the words, then the ratings they're judged against, a rule
     dividing prompt from paperwork. In the portrait stack the same DOM
     reads sticky plate → prompt → rows. No label on it (owner: "just put
     the prompt", the THE ASSIGNMENT tag was too cute) — the rule and the
     spacing carry the division. Judging "Understanding the Assignment" with
     the prompt off the card meant grading against memory; now every word is
     in reach. The fold is the record card's own idiom (three lines, a mask
     fade over the last, SHOW FULL PROMPT to unfold) — render() measures
     after paint and marks is-fit when the words never overflowed, which
     hides the expander. The toggle flips classes in place
     (data-act="brief"), never a re-render, so the native selects and
     scroll position stay put. */
  /* The header returned by owner call (2026-08-28, round 3): unlabelled, the
     words floated with nothing saying what they were. It reads PROMPT — the
     plain word, not the retired THE ASSIGNMENT flourish. The fold now trips
     only on genuinely long prompts (seven lines — see the CSS), so most
     cards show every word with no control at all; when it does fold, the
     pair is SHOW FULL PROMPT / HIDE. */
  function briefHTML() {
    var words = (work && work.prompt) || '';
    if (!words.trim()) return '';
    return '<div class="jd-turn-assign">' +
      '<span class="jd-turn-assign-tag" aria-hidden="true">prompt</span>' +
      '<p>' + esc(words) + '</p>' +
      '<button type="button" class="jd-turn-pv" data-act="brief">show full prompt</button>' +
      '</div>';
  }

  /* THE LANDSCAPE BENCH (owner modification on the round-15 pick,
     2026-08-13). The bench borrows the report card's two-column pattern: the
     exhibit on the LEFT, the paperwork on the RIGHT. The wrappers are layout
     only — under 700px they go display:contents and this same DOM reads as
     the portrait flow, with the exhibit sticky at the top of the scroller.
     The card widens to carry the two columns and narrows again the moment it
     stops (see paint's data-view). */
  function benchPanel(slot, ok) {
    var r = work.ratings[slot];
    var idx = ok.indexOf(slot);
    var two = ok.length > 1;
    var h = '<div class="jd-bench">' +
      '<div class="jd-bench-l"><div class="jd-turn-pin">' +
      plate(slot, { pin: true, zoom: true, replay: true }) + '</div></div>' +
      '<div class="jd-bench-r">' +
      /* the prompt OPENS the paperwork column, above the rows (owner,
         2026-08-28) — and, the wrappers being display:contents in the
         portrait stack, sits between the sticky plate and the rows there */
      briefHTML() +
      benchHeadHTML();
    /* axes first, in taxonomy order, THEN the overall grade (owner
       directive r4): the report card files axes in <tbody> and the overall
       grade alone in <tfoot> below a rule — the SAME rubric was reading in
       the opposite order here, one click away. .jd-row--grade already
       carries the 2px top rule that reads as a tfoot break; it just needed
       the grade row to actually be last for that rule to mean what it looks
       like it means. */
    liveAxes().forEach(function (ax) {
      h += scaleRow(slot, 'axis', ax, r.axes[ax.id]);
    });
    h += scaleRow(slot, 'grade', null, r.grade);
    /* the report path (APP §4.6) is BENCHED from the form (owner,
       2026-08-26): the "broken or offensive" checkbox and its note took
       bench space the owner would rather spend on the scales, and reports
       weren't proving necessary. Deliberately NOT dismantled — the state
       (r.flag / r.flagNote), the flag/flagnote handlers, the wire fields
       and the .jd-turn-flag styles all stand, so restoring the instrument
       is re-adding the markup below, not an excavation.
       (The retired markup, for that day:
       '<label class="jd-turn-check jd-turn-flag">' +
         '<input type="checkbox" data-role="flag" data-slot="' + slot + '"' +
         (r.flag ? ' checked' : '') + '><span>broken or offensive</span></label>' +
       '<div data-flagnote="' + slot + '"' + (r.flag ? '' : ' hidden') + '>' +
         '<input type="text" class="jd-turn-note" maxlength="' + MAX_NOTE +
         '" placeholder="what is wrong with it?" aria-label="note on the report ' +
         'for drawing ' + slot.toUpperCase() + '" data-role="flagnote" ' +
         'data-slot="' + slot + '" value="' + esc(r.flagNote || '') + '"></div>') */
    var acts = '';
    if (idx > 0) {
      acts += '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>';
    }
    /* the gate: disabled until benchRated — onChange re-arms it live */
    var gate = benchRated(slot) ? '' : ' disabled';
    var sized = sizeTiers().length;
    if (!two) {
      /* one drawing, no ranking — but a curation still closes on the size */
      acts += sized
        ? '<button type="button" class="jd-turn-go" data-act="next"' + gate +
          '>next — size &rarr;</button>'
        : '<button type="button" class="jd-turn-go" data-act="file"' +
          gate + '>file the grades</button>';
    } else {
      /* the ranking step's button wears the one-word form (owner,
         2026-08-27), like the docket ring's word — "best to worst" stays
         the card's own title */
      var next = idx + 1 < ok.length ? 'drawing ' + ok[idx + 1].toUpperCase() : 'ranking';
      acts += '<button type="button" class="jd-turn-go" data-act="next"' +
        gate + '>next — ' + esc(next) + ' &rarr;</button>';
    }
    if (!two && !sized) { acts = suppressHTML() + acts; }   /* the last card */
    /* the action row closes the PAPERWORK column, not the sheet: on the
       landscape bench it settles against the foot of the exhibit beside it
       (margin-top:auto), and in the portrait stack it is simply the last
       thing on the card, exactly where it was */
    return h + actions(acts) + '</div></div>';
  }

  /* KEEP IT OUT OF THE DRAWER (owner, 2026-08-30). A finished turn now takes
     a real place in the drawer rather than living in one browser's storage,
     so the visitor needs a way to say "record it, don't show it" — the data
     is filed either way, which is the point: the drawer loses the object,
     the record keeps everything. Curation mode never shows it: the owner
     scraps from the bench strip instead, which files the same intent under
     its own flag. */
  function suppressHTML() {
    if (curJob) return '';
    return '<label class="jd-turn-check jd-suppress">' +
      '<input type="checkbox" data-role="suppress"' +
      (work && work.suppress ? ' checked' : '') + '>' +
      '<span>keep this one out of the drawer</span></label>';
  }

  /* a call is ready to file when the podium is FULL: every surviving drawing
     stands on a step, and exactly one of them stands on 1st. (One survivor
     is no call at all — that panel files from the bench.) */
  function callReady() {
    var ok = okSlots();
    if (ok.length < 2) return true;
    var ones = 0;
    for (var i = 0; i < ok.length; i++) {
      var r = podRankOf(ok[i]);
      if (!r) return false;
      if (r === 1) ones++;
    }
    return ones === 1;
  }

  /* one print, as the podium carries it: the exhibit plate at print size,
     wrapped in the handle the drag and the tap both read, with ENLARGE and
     the print IS the enlarge control (owner, 2026-08-23: "just click on it to
     enlarge it, no separate icon"). The icon pair that briefly lived under
     each print is gone, and REPLAY with it — it stays on the BENCH, one step
     back, which is where the owner put it on 2026-08-21.
     What makes one press mean two things without an icon is the INVERSION in
     podArm/podTap above: the place is armed first, so a press on a drawing is
     only ever "put it there" when somewhere is already waiting, and "let me
     see it bigger" the rest of the time.
     data-slot rides the WRAPPER because openZoom() reads it there and finds
     the artwork by descending — which is exactly what the bench's figure does,
     one element out. */
  function podPrintHTML(slot) {
    var r = podRankOf(slot);
    /* the spark at the print's foot: the visitor's own overall grade for
       this drawing, as the report card's segmented gauge — no words
       (owner, 2026-08-26). A skipped grade sparks nothing. */
    var rt = work.ratings[slot];
    var spark = gaugeFor(null, byRankDesc(tax().grades).length, rt ? rt.grade : null);
    if (spark) spark = '<span class="jd-pod-spark" aria-hidden="true">' + spark + '</span>';
    return '<div class="jd-pod-print" data-pod="' + slot + '" data-slot="' + slot +
      '" role="button" tabindex="0" draggable="false" aria-label="Model ' +
      slot.toUpperCase() + (r ? ', ' + POD_ORD[r - 1] : ', unplaced') +
      '. Press to enlarge">' + plate(slot, { overlay: true, spark: spark }) + '</div>';
  }

  /* THE CALL — THE PODIUM (owner pick, mockup-32, 2026-08-22; the likert
     finale and the two-pill multi-way call are both retired). The panel is
     built ONCE per paint, with every print already standing where work.ranks
     says it stands; from then on the podium only ever moves nodes and toggles
     classes (podPaint/podSeat), never rewrites this HTML — which is what lets
     a drag survive on a card that otherwise repaints by assigning a string.
     Two survivors build two steps, three build three, four build four. */
  function callPanel(ok) {
    if (podDrag) podDone();
    podNormalize(ok);
    podArmed = null;
    var n = ok.length, k, occ;
    var h = '<div class="jd-pod"><div class="jd-pod-row">';
    for (k = 1; k <= n; k++) {
      occ = podAt(k);
      h += '<div class="jd-pod-tier" data-rank="' + k + '" role="button" tabindex="0"' +
        ' aria-label="' + POD_ORD[k - 1] +
        (occ ? ', Model ' + occ.toUpperCase() : ', empty') + '">' +
        '<div class="jd-pod-stand">' +
        '<div class="jd-pod-hole"' + (occ ? ' hidden' : '') + ' aria-hidden="true"></div>' +
        (occ ? podPrintHTML(occ) : '') + '</div>' +
        '<div class="jd-pod-block">' + POD_ORD[k - 1] + '</div></div>';
    }
    h += '</div><div class="jd-pod-floor" aria-hidden="true"></div>';
    var placed = 0;
    ok.forEach(function (s) { if (podRankOf(s)) placed++; });
    /* every drawing keeps its own column in the row, so nothing shuffles
       sideways when its neighbour is lifted onto a step */
    h += '<div class="jd-pod-tray' + (placed === n ? ' is-bare' : '') +
      '" role="button" tabindex="0" aria-label="The row">';
    ok.forEach(function (s, i) {
      h += '<div class="jd-pod-cell" data-cell="' + i + '">' +
        (podRankOf(s) ? '' : podPrintHTML(s)) + '</div>';
    });
    h += '</div><span class="jd-vh jd-pod-live" role="status" aria-live="polite"></span></div>';
    /* a curation has one more card after this one — the size (owner,
       2026-08-30) — so the ranking hands on rather than filing */
    var more = sizeTiers().length;
    return h + (more ? '' : suppressHTML()) + actions(
      '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>' +
      '<button type="button" class="jd-turn-go" data-act="' +
      (more ? 'next' : 'file') + '"' + (callReady() ? '' : ' disabled') + '>' +
      (more ? 'next — size &rarr;' : 'file the grades') + '</button>');
  }

  /* §4 the bench, §5 the call. Neither carries an instruction line: they are
     the two cards where the visitor is working, so they are the two with the
     least to read. The heading names the drawing on the bench, the rail says
     where in the steps it sits, and each row's own label (with its
     hover/focus definition) carries the rest. */
  /* ---------- 5b. HOW BIG IS IT — the bench's closing card ------------------
     (owner, 2026-08-30.) The one curatorial judgment the rubric never asked
     for: how large the object reads in the drawer, on the five-tier scale
     the taxonomy has always carried. It closes a CURATION only — a visitor's
     won item is filed at the fixed visitor tier (C5.3) and never sees this.
     The tiers render from the queue's size_tiers, so the scale stays data.
     A tier already on file (the entry's own, or one the bench filed earlier)
     arrives selected. Filing is gated on a choice: the drawer's sizes are
     the owner's, and a silent default would put a size in the collection
     nobody chose (the standing rule in CLAUDE.md's filing procedure). */
  /* THE SCALE, wherever the card is standing (owner, 2026-08-30): a
     curation reads the tiers the bench handed it; a visitor's turn reads
     the same five straight out of the taxonomy the payload already carries.
     Every turn now closes on the size, because every finished turn now goes
     into the drawer and the drawer needs to know how big it reads. */
  function sizeTiers() {
    if (curJob) return curJob.sizeTiers || [];
    return (tax().sizeTiers || []).map(function (t) {
      return { id: t.id, label: t.label || t.id,
               description: t.description || '', box: t.box };
    });
  }

  function sizePanel() {
    var tiers = sizeTiers();
    var chosen = work.size || null;
    var h = '<div class="jd-size">';
    tiers.forEach(function (t) {
      h += '<button type="button" class="jd-size-tier' +
        (chosen === t.id ? ' is-on' : '') + '" data-act="size" data-size="' +
        esc(t.id) + '" aria-pressed="' + (chosen === t.id ? 'true' : 'false') + '">' +
        '<span class="jd-size-swatch" style="--sbox:' +
        (t.box ? (+t.box).toFixed(2) : 15.5) + '" aria-hidden="true"></span>' +
        '<span class="jd-size-name">' + esc(t.label) + '</span>' +
        '<span class="jd-size-desc">' + esc(t.description || '') + '</span>' +
        '</button>';
    });
    h += '</div>';
    /* THE ONE CARD THAT SAYS WHAT IT WANTS (owner report, 2026-08-30: "it
       won't let me submit"). The bench and the ranking carry no instruction
       line — they are self-evident, and their gates are visibly unmet rows
       and empty steps. This card's gate is invisible: with nothing chosen
       the button is simply dead, and an item that arrives with no size on
       file (every turn does) reads as stuck. So the button says what it is
       waiting for, and a line under the tiers says why. */
    return h + (chosen ? '' :
      '<p class="jd-size-hint">Pick a size to file this item — it sets how ' +
      'big the object reads among the others in the drawer.</p>') +
      suppressHTML() +
      actions(
      '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>' +
      '<button type="button" class="jd-turn-go" data-act="file"' +
      (chosen ? '' : ' disabled') + '>' +
      (chosen ? 'file the grades' : 'choose a size first') + '</button>');
  }

  function viewRate() {
    var ok = okSlots();
    var sizes = sizeTiers().length;
    /* a restored or degraded turn may hold a step that no longer exists */
    if (work.step !== 'call' && work.step !== 'size' && ok.indexOf(work.step) === -1) {
      work.step = ok[0];
    }
    if (work.step === 'call' && ok.length < 2) work.step = sizes ? 'size' : ok[0];
    if (work.step === 'size' && !sizes) work.step = ok.length > 1 ? 'call' : ok[0];
    work.reached[work.step] = true;
    var two = ok.length > 1;
    var call = work.step === 'call', size = work.step === 'size';
    return head(size ? 'How big is it' : call ? 'Best to worst'
        : 'Grade drawing ' + work.step.toUpperCase(),
      size ? 6 : call ? 5 : 4,
      { view: size ? 'size' : call ? 'call' : 'bench' }) +
      (two || sizes ? railHTML(ok) : '') +
      (size ? sizePanel() : call ? callPanel(ok) : benchPanel(work.step, ok));
  }

  /* ---------- 7. unveil ---------------------------------------------------- */
  function revealFor(slot) {
    var list = (work.reveal || []);
    for (var i = 0; i < list.length; i++) if (list[i].slot === slot) return list[i];
    return null;
  }
  /* ---------- 7. the unveil (§6) --------------------------------------------
     THE PODIUM STANDS (owner, 2026-08-23). The reveal used to be a list —
     slot letter, name, vendor, fate — which said everything and staged
     nothing. It is now the same podium the visitor just built, untouched:
     same steps, same heights, every drawing still standing exactly where
     they ranked it. The only thing that changes is that each pedestal
     LEARNS WHOSE IT WAS — the model's name prints across the base of its own
     block, under the ordinal that was always there, so a block reads rank at
     the top and name at the foot.
     The pencilled "Model A" under each print stays: it is the anonymous
     label the whole turn ran under, and it sitting directly above the true
     name is the point of the card.
     Nothing here is draggable — the ranking is filed — so a press on a print
     always means enlarge, with no armed place to check.
     A model that never arrived has no pedestal to stand on, so it is named
     in a printed line beneath the steps instead of being given a ghost step
     it never earned. */
  /* the name — and, since 2026-08-28 (owner call), what the drawing COST:
     the reveal payload's exact provider spend prints under the name, the
     same number the report card's Cost line states. It appears HERE and
     nowhere earlier — the price is part of the answer, and the answer
     waits for the ranking to be filed. Omitted entirely (never $0) when
     the model is unpriced or no usage was recorded — the house rule.
     Otherwise the 2026-08-23 discipline stands: no vendor on the pedestal,
     no fate badge on the winner. work.reveal still carries .vendor — it is
     simply not this card's business. */
  function revealName(r) {
    var cost = (r && r.cost_usd != null && isFinite(+r.cost_usd))
      ? '<span class="jd-pod-cost">$' + (+r.cost_usd).toFixed(4) + '</span>'
      : '';
    return '<span class="jd-pod-who"><b>' +
      esc((r && (r.label || r.model_id)) || 'unknown') + '</b>' + cost + '</span>';
  }
  function viewUnveil() {
    var ok = okSlots(), n = ok.length, k;
    var h = head('Who drew what', 6, { view: 'said' });
    /* the steps, best first, each holding the drawing that stands on it */
    var steps = '<div class="jd-pod jd-pod--said"><div class="jd-pod-row">';
    for (k = 1; k <= n; k++) {
      var occ = podAt(k);
      var r = occ ? revealFor(occ) : null;
      /* the countdown: last place is named first, the winner last. The delay
         is written per step because it depends on how many survived — with
         two steps the pause before 1st must be one beat, not three. */
      steps += '<div class="jd-pod-tier" data-rank="' + k +
        '" style="--pdelay:' + ((n - k) * 180) + 'ms">' +
        '<div class="jd-pod-stand">' +
        (occ ? podPrintHTML(occ) : '') + '</div>' +
        '<div class="jd-pod-block"><span class="jd-pod-ord">' + POD_ORD[k - 1] +
        '</span>' + (occ ? revealName(r) : '') +
        '</div></div>';
    }
    steps += '</div><div class="jd-pod-floor" aria-hidden="true"></div></div>';
    h += steps;
    /* the ones that never arrived: named, not staged */
    var lost = (work.reveal || []).filter(function (x) {
      return x.status && x.status !== 'ok';
    }).map(function (x) {
      return esc(x.label || x.model_id || 'a machine') + ' — didn’t survive';
    });
    if (lost.length) {
      h += '<p class="jd-turn-line jd-pod-lost">' + lost.join('<br>') + '</p>';
    }
    if (work.winner === 'tie' && !work.kept) {
      var keepOpts = okSlots().map(function (s) {
        return { value: s, label: 'Drawing ' + s.toUpperCase() };
      });
      keepOpts.push({ value: '', label: okSlots().length > 2 ? 'None of them' : 'Neither' });
      h += '<p class="jd-turn-line">A tie is filed as a tie. Keep one for your ' +
        'drawer anyway?</p>' +
        pillRow('jd-keep', 'which drawing to keep', keepOpts,
          work.keep, ' data-role="keep"') +
        actions('<button type="button" class="jd-turn-go" data-act="keep">put it in the drawer</button>');
    } else if (curJob) {
      /* the backlog's unveil closes to the NEXT ITEM, not to another turn —
         JD_bench hears the close and seats the next card */
      h += actions('<button type="button" class="jd-turn-go" data-act="done">next item &rarr;</button>');
    } else {
      /* the card does not narrate the drawer (owner, 2026-08-23). The winner
         still goes into the pile — placeWinner ran at filing time — it is
         only the sentence about it that is gone. */
      h += actions('<button type="button" class="jd-turn-go" data-act="done">done</button>' +
          '<button type="button" class="jd-turn-alt" data-act="again">take another turn</button>');
    }
    return h;
  }

  /* ---------- the failure end (§2) ------------------------------------------ */
  function viewApology() {
    return head('Nothing came back', 2) +
      '<p class="jd-turn-line">' + esc(work && work.notice
        ? work.notice
        : 'The machines all failed. This cost you nothing — the drawer will ' +
          'try again whenever you like.') + '</p>' +
      actions('<button type="button" class="jd-turn-go" data-act="again">try again</button>' +
        '<button type="button" class="jd-turn-alt" data-act="done">close</button>');
  }

  /* THE MASTHEAD. Every card is FORM JD-1; what changes is the heading and
     the section number on the badge (§1 brief → §6 unveil). head() declares
     the next paint's masthead and contributes NOTHING to the body string —
     it returns '' so the views can go on reading as one concatenation.

     The heading is the landing place for every state that has no field of
     its own to fill in (C5.8): moving through the flow should read as the
     step you just reached, not as the dismiss control that happens to come
     first in the DOM. tabindex="-1" makes it focusable without adding a tab
     stop. The one state with a field of its own (prompt) passes noFocus and
     keeps it.

     opts: { noFocus, view } — `view` is the card's data-view ('bench',
     'call' and 'plates' mean something to the CSS). */
  function head(t, sec, opts) {
    opts = opts || {};
    stateTitle = t;
    pendingHead = {
      title: t, sec: sec, noFocus: !!opts.noFocus,
      view: opts.view || 'form'
    };
    return '';
  }
  function actions(inner) { return '<div class="jd-turn-actions">' + inner + '</div>'; }

  /* ---------- input plumbing ---------------------------------------------- */
  /* swap the row's gauge for the value just chosen — in place, because a
     full repaint here would close the native picker's own row under the
     visitor's finger and lose the scroll position mid-survey. Clearing back
     to "skip" removes the mark, the same as the report card showing nothing
     for an axis that was never assessed. */
  function paintGauge(select, ax, val) {
    var ctrl = select.parentNode;
    if (!ctrl || !ctrl.classList || !ctrl.classList.contains('jd-row-ctrl')) return;
    var old = ctrl.querySelector('.rc-bar');
    if (old) ctrl.removeChild(old);
    var levels = byRankDesc(ax ? ax.values : tax().grades);
    var html = gaugeFor(ax, levels.length, val == null ? null : Number(val), true);
    if (html) ctrl.insertAdjacentHTML('afterbegin', html);
  }
  function onChange(e) {
    var t = e.target, role = t.getAttribute && t.getAttribute('data-role');
    if (!role) return;
    if (t.type === 'radio') {
      var row = t.closest('.jd-pillrow');
      if (row) {
        Array.prototype.forEach.call(row.querySelectorAll('.jd-pill'), function (p) {
          var input = p.querySelector('input');
          p.classList.toggle('is-on', !!(input && input.checked));
        });
      }
      JD_haptic('select');
    }
    var slot = t.getAttribute('data-slot');
    var val = t.value === '' ? null : t.value;
    if (role === 'grade') {
      work.ratings[slot].grade = val == null ? null : Number(val);
      t.classList.toggle('is-set', val != null);
      paintGauge(t, null, val);
    } else if (role === 'axis') {
      work.ratings[slot].axes[t.getAttribute('data-axis')] =
        val == null ? null : Number(val);
      t.classList.toggle('is-set', val != null);
      paintGauge(t, byId(liveAxes(), t.getAttribute('data-axis')), val);
    }
    if (role === 'grade' || role === 'axis') {
      /* the bench gate re-arms (or re-locks — a scale set back to skip
         closes it) on every answer; back is never gated */
      setDisabled('[data-act="next"], [data-act="file"]', !benchRated(slot));
    }
    if (role === 'suppress') {
      work.suppress = !!t.checked;
      return;
    }
    if (role === 'flag') {
      work.ratings[slot].flag = t.checked;
      /* mutate in place — see benchPanel */
      var fn = bodyEl.querySelector('[data-flagnote="' + slot + '"]');
      if (fn) fn.hidden = !t.checked;
      /* (the call has no <input> of its own any more — the podium files its
         answer through pointer/keyboard handlers, not a change event) */
    } else if (role === 'keep') {
      work.keep = val;
    }
  }
  function onInput(e) {
    var t = e.target, role = t.getAttribute && t.getAttribute('data-role');
    if (!role) return;
    if (role === 'prompt') {
      work = work || blankWork();
      work.prompt = t.value;
      var n = t.value.length;
      var c = bodyEl.querySelector('.jd-turn-count');
      if (c) {
        c.textContent = n + ' / ' + MAX_PROMPT;
        c.classList.toggle('is-over', n > MAX_PROMPT);
      }
      setDisabled('[data-act="generate"]',
        !(t.value.trim().length && n <= MAX_PROMPT));
    } else if (role === 'flagnote') {
      work.ratings[t.getAttribute('data-slot')].flagNote = t.value.slice(0, MAX_NOTE);
    }
  }
  function setDisabled(sel, off) {
    var b = bodyEl.querySelector(sel);
    if (b) b.disabled = !!off;
  }
  function onClick(e) {
    /* THE PODIUM's taps, first and by themselves. A print's own press is
       answered on pointerup (podOnUp), so the click it trails is absorbed
       here — otherwise a tap would read twice, and it would fall through to
       the row underneath it as "put this back". A step, or the row, places
       whatever is in hand. Prints are tested BEFORE steps: a seated print
       sits inside its own tier. */
    /* a print's press is answered on pointerup (podTap), because podDown
       preventDefaults and a prevented pointerdown may emit no click at all;
       the click it does emit is absorbed here so nothing reads twice */
    var pp = e.target.closest ? e.target.closest('.jd-pod-print') : null;
    if (pp) {
      /* on the unveil the press never reached podDown, so the click is the
         press — and on that card a drawing can only get bigger */
      if (pp.closest('.jd-pod--said')) openZoom(pp);
      return;
    }
    /* the filed podium arms nothing */
    if (e.target.closest && e.target.closest('.jd-pod--said')) return;
    var pt = e.target.closest ? e.target.closest('.jd-pod-tier') : null;
    if (pt) { podArm(Number(pt.getAttribute('data-rank'))); return; }
    var ptr = e.target.closest ? e.target.closest('.jd-pod-tray') : null;
    if (ptr) { podArm(0); return; }
    /* REPLAY rides the plate: it redraws, never zooms (the record card's
       handler exempts its .rc-draw the same way). An explicit press is
       requested motion, so it plays under reduced-motion too — replayPlate
       passes force. */
    var dr = e.target.closest ? e.target.closest('.jd-turn-draw') : null;
    if (dr) { replayPlate(dr); return; }
    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b || b.disabled) {
      /* not an action press — the bench/call plate itself is the enlarge
         control (the reveal's plates carry no role and fall through) */
      var p = e.target.closest ? e.target.closest('.jd-turn-plate') : null;
      if (p && p.getAttribute('role') === 'button') openZoom(p);
      return;
    }
    var act = b.getAttribute('data-act');
    if (act === 'generate') {
      /* the acknowledgment is recorded at the moment the words are sent —
         the disclosure sits right on this card (the gating consent card
         retired 2026-08-14, owner call) */
      if (!hasConsent()) {
        JD_store.set(K_CONSENT, {
          version: JD_CONSENT.version, at: new Date().toISOString()
        });
      }
      startTurn();
    } else if (act === 'rate') {
      ensurePayload().then(function () { go('rate'); }, function () { go('rate'); });
    } else if (act === 'step' || act === 'next' || act === 'back') {
      /* bench navigation. The whole panel re-renders (state lives in `work`,
         so nothing is lost) and focus lands back on the heading. */
      var seq = stepSeq();
      var at = seq.indexOf(work.step);
      /* the gate, held at the door as well as on the button (the disabled
         attribute is state the DOM could lose; this check can't) */
      if (act === 'next' && work.step !== 'call' && work.step !== 'size'
          && !benchRated(work.step)) return;
      var dest = act === 'step' ? b.getAttribute('data-step')
        : seq[at + (act === 'next' ? 1 : -1)];
      if (dest && seq.indexOf(dest) !== -1) {
        work.step = dest;
        work.reached[dest] = true;
        render();
      }
    } else if (act === 'size') {
      /* the closing card's answer — in place, so the chosen tier lights and
         the file button arms without repainting the whole sheet */
      work.size = b.getAttribute('data-size');
      Array.prototype.forEach.call(bodyEl.querySelectorAll('[data-act="size"]'),
        function (el) {
          var on = el === b;
          el.classList.toggle('is-on', on);
          el.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      setDisabled('[data-act="file"]', false);
      var fileBtn = bodyEl.querySelector('[data-act="file"]');
      if (fileBtn) fileBtn.textContent = 'file the grades';
      var hint = bodyEl.querySelector('.jd-size-hint');
      if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
    } else if (act === 'file') {
      /* the one-survivor bench files directly — same gate as next */
      if (work.step !== 'call' && work.step !== 'size' && !benchRated(work.step)) return;
      /* a curation files at the SIZE card, which closes it; the size is the
         owner's call and never defaulted (CLAUDE.md's filing rule) */
      if (curJob && work.step === 'size' && !work.size) return;
      if (curJob) curateFile(); else submitRatings();
    } else if (act === 'keep') {
      if (work.keep) placeWinner(work.keep);
      work.kept = true;
      render();
    } else if (act === 'again') {
      clearTurn();
      work = blankWork();
      go('prompt');
    } else if (act === 'done') {
      clearTurn();
      close();
    } else if (act === 'retry-file') {
      if (curJob) curateFile(); else submitRatings();
    } else if (act === 'brief') {
      /* in place, no re-render — a repaint here would close the native
         picker under a finger mid-survey and lose the scroll position */
      var asn2 = b.closest('.jd-turn-assign');
      if (asn2) {
        var on = asn2.classList.toggle('is-open');
        b.textContent = on ? 'hide' : 'show full prompt';
      }
    } else if (act === 'def') {
      /* the subject's disclosure — in place, like the prompt's fold: a
         repaint would close a native picker and lose the scroll. `b` may be
         the rowhead or the caret inside it; the caret is always the element
         that wears the state. */
      var row = b.closest('.jd-row');
      var exp = row && row.querySelector('.jd-row-exp');
      var caret = row && row.querySelector('.jd-defx');
      if (exp && caret) {
        exp.hidden = !exp.hidden;
        caret.setAttribute('aria-expanded', exp.hidden ? 'false' : 'true');
        caret.classList.toggle('is-open', !exp.hidden);
        /* the boxed mark reads + closed, − open (round 9; U+2212, a real
           minus, so the two glyphs sit on the same optical centre) */
        var glyph = caret.querySelector('span');
        if (glyph) glyph.textContent = exp.hidden ? '+' : '−';
      }
    }
  }

  function blankWork() {
    return {
      prompt: '', notice: '', slow: false,
      slots: blankSlots(),
      ratings: blankRatings(),
      /* the single bench: which step is on the bench, and which steps the
         visitor has reached (the rail's first pass is linear). THE CALL'S
         ANSWER is `ranks` — slot → rank, 1 = first, one entry per drawing
         standing on the podium. `winner` is derived from it (whoever is on
         1st) and kept only because everything downstream — the unveil, the
         pile, the tracking beacon — was built to read a winner; `strength`
         survives as a permanent null, the podium having no margin. */
      step: 'a', reached: { a: true },
      ranks: {},
      winner: null, strength: null,
      keep: null, kept: false, placed: false, reveal: null
    };
  }
  function blankRating() {
    return { grade: null, axes: {}, notes: {}, flag: false, flagNote: '' };
  }
  function blankSlots() {
    var o = {};
    JD_SLOTS.forEach(function (s) { o[s] = { status: 'pending' }; });
    return o;
  }
  function blankRatings() {
    var o = {};
    JD_SLOTS.forEach(function (s) { o[s] = blankRating(); });
    return o;
  }

  /* ---------- generating: four parallel calls, one shared client_ref ------- */
  function startTurn() {
    var text = (work && work.prompt) || '';
    if (!text.trim().length || text.length > MAX_PROMPT) return;
    var hp = bodyEl.querySelector('[data-role="hp"]');
    var honey = hp ? hp.value : '';
    var mine = ++token;
    /* the recoverability handle is minted and PERSISTED before either fetch
       leaves (APP §4.11): PHP cannot stream a partial answer, so a killed
       request is recovered by re-sending the same ref, never by a server id
       we never received */
    turn = {
      client_ref: uuid(), state: 'generating', submission_id: null,
      slots: blankSlots()
    };
    persist();
    work.slow = false;
    work.notice = '';
    work.slots = blankSlots();
    go('generating');
    startSlowTimer();
    JD_track('turn_submit', null);
    /* THE TAG'S TITLE (owner, 2026-08-29): a small fast model names the
       object in 2–5 words, replacing the 52-char prompt truncation that
       used to run on ("A crystal ball the kind a fortune teller might…").
       Fired here so it rides the darkroom wait, invisible; every failure
       path leaves work.title unset and shortTitle() carries on as before.
       One retry after 4s covers the race where no slot's submission row
       has landed yet (the endpoint answers no_turn until one has). */
    (function fetchTitle(attempt) {
      fetch(JD_API + API_TITLE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_ref: turn.client_ref, prompt: text })
      }).then(function (r) {
        return r.json().catch(function () { return null; });
      }).then(function (j) {
        if (mine !== token || !work) return;
        if (j && j.ok && j.title) {
          work.title = j.title;
          if (turn) { turn.title = j.title; persist(); }
        } else if (attempt < 2) {
          setTimeout(function () {
            if (mine === token) fetchTitle(attempt + 1);
          }, 4000);
        }
      }, function () {
        if (mine === token && attempt < 2) {
          setTimeout(function () {
            if (mine === token) fetchTitle(attempt + 1);
          }, 4000);
        }
      });
    })(1);
    JD_SLOTS.forEach(function (slot) {
      /* NO client abort and NO client timeout — the server owns the 150s
         budget, and a fetch cancelled here would abandon a generation the
         server is still paying for (C5.4) */
      fetch(JD_API + API_GEN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_ref: turn.client_ref,
          slot: slot,
          prompt: text,
          client: JD_CLIENT,
          consent: { version: JD_CONSENT.version },
          website: honey
        })
      }).then(function (r) {
        return r.json().then(function (j) { return j; },
          function () { return { ok: false, error: { code: 'server_error' } }; });
      }).then(function (j) {
        settleSlot(mine, slot, j);
      }, function () {
        settleSlot(mine, slot, { ok: false, error: { code: 'network' } });
      });
    });
  }

  /* each slot lands on its own — the UI never waits for the full bench */
  function settleSlot(mine, slot, res) {
    if (mine !== token || !work || !turn) return;
    if (res && res.ok && res.svg) {
      work.slots[slot] = { status: 'ok', gen_id: res.gen_id, svg: res.svg };
      turn.slots[slot] = { status: 'ok', gen_id: res.gen_id };
      if (res.submission_id) turn.submission_id = res.submission_id;
    } else {
      var err = (res && res.error) || {};
      work.slots[slot] = {
        status: 'failed', code: err.code || 'server_error',
        message: err.message || '', retry_after: res && res.retry_after
      };
      turn.slots[slot] = { status: 'failed' };
      if (res && res.submission_id) turn.submission_id = res.submission_id;
      JD_track('turn_error', err.code || 'server_error');
    }
    persist();
    paintSlots();
    if (pendingCount() > 0) return;
    stopSlowTimer();
    if (okSlots().length) { revealFresh = true; go('reveal'); return; }
    /* nothing survived: a limit refusal goes back to the brief with honest
       copy (no submission was created), anything else is an apology */
    var codes = JD_SLOTS.map(function (s) { return work.slots[s].code; });
    var limited = codes.filter(function (c) {
      return c === 'rate_limited' || c === 'drawer_resting';
    })[0];
    if (limited) {
      var wait = null;
      JD_SLOTS.forEach(function (s) {
        if (wait === null) wait = work.slots[s].retry_after || null;
      });
      var notice = limited === 'drawer_resting'
        ? 'the drawer is resting — it has drawn all it can today. come back ' +
          'tomorrow.'
        : 'you’ve had a few turns already. the drawer will take another ' +
          'in about ' + humanWait(wait) + '.';
      var draft = work.prompt;
      clearTurn();                 /* no submission was created — nothing to keep */
      work = blankWork();
      work.prompt = draft;
      work.notice = notice;        /* the brief comes back explaining why, in prose */
      go('prompt');
      return;
    }
    work.notice = codes.indexOf('sanitizer_rejected') !== -1
      ? 'the machines answered with something the drawer wouldn’t accept ' +
        '— it rejects rather than repairs. This cost you nothing.'
      : 'All four machines failed. This cost you nothing — the drawer will ' +
        'try again whenever you like.';
    turn.state = 'apology';
    persist();
    go('apology');
  }

  /* ---------- filing: one batch, then the only unveil ---------------------- */
  function submitRatings() {
    if (!turn || !turn.submission_id) { go('apology'); return; }
    var ratings = [];
    okSlots().forEach(function (slot) {
      var gen = work.slots[slot].gen_id, r = work.ratings[slot];
      if (!gen) return;
      if (r.grade != null) ratings.push({ gen_id: gen, kind: 'grade', value: r.grade });
      Object.keys(r.axes).forEach(function (axisId) {
        if (r.axes[axisId] == null) return;
        /* values only — the per-axis note field left the survey with the
           rest of the note UI (owner request, 2026-08-12); the API still
           accepts notes, this client just never files one */
        ratings.push({ gen_id: gen, kind: 'axis', axis_id: axisId, value: r.axes[axisId] });
      });
      if (r.flag) {
        var f = { gen_id: gen, kind: 'flag' };
        if (r.flagNote) f.note = r.flagNote.slice(0, MAX_NOTE);
        ratings.push(f);
      }
    });
    /* THE CALL ON THE WIRE (podium, 2026-08-22). `ranking` is the real
       answer now: one entry per surviving slot, ranks dense from 1, exactly
       one 1st — the podium can't produce anything else. `comparison` is sent
       alongside it exactly as before, naming the rank-1 slot, so nothing
       downstream regresses and a cached older client posting only a
       comparison still means the same thing. strength is permanently null:
       the podium has no margin. Both are null in the degraded one-slot
       path, where there is no call at all. */
    var okNow = okSlots();
    var ranking = null;
    if (okNow.length > 1 && callReady()) {
      ranking = okNow.map(function (s) {
        return { slot: s, rank: podRankOf(s) };
      }).sort(function (p, q) { return p.rank - q.rank; });
    }
    var body = {
      submission_id: turn.submission_id,
      client: JD_CLIENT,
      /* the object's name and the visitor's wish about showing it — both
         belong to the record now that a rated turn joins the drawer */
      title: work.title || null,
      suppress: !!work.suppress,
      size: work.size || null,
      ratings: ratings,
      ranking: ranking,
      comparison: okNow.length > 1
        ? { winner: ranking ? ranking[0].slot : work.winner, strength: null }
        : null
    };
    setDisabled('[data-act="file"]', true);
    setDisabled('[data-act="retry-file"]', true);
    /* same guard as a generation (C5.4): the filing is not aborted when the
       turn is abandoned, so its answer has to identify the turn it belongs
       to or it lands on whatever turn is live when it arrives */
    var mine = token;
    fetch(JD_API + API_RATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) { return j; },
        function () { return { ok: false, error: { code: 'server_error' } }; });
    }).then(function (j) { onFiled(mine, j); }, function () {
      onFiled(mine, { ok: false, error: { code: 'network' } });
    });
  }
  function onFiled(mine, res) {
    if (mine !== token || !isOpen || !work) return;
    if (!res || !res.ok) {
      var code = ((res || {}).error || {}).code || 'server_error';
      JD_track('turn_error', code);
      /* the same shape as the apology (§6) — same prose-only pattern, no stamp */
      paint(head('The grades didn’t file', 6) +
        '<p class="jd-turn-line">The drawer couldn’t record them ' +
        '(<b>' + esc(code) + '</b>). Nothing was written — the whole batch ' +
        'goes together or not at all, and your grades are still here.</p>' +
        actions('<button type="button" class="jd-turn-go" data-act="retry-file">try filing again</button>' +
          '<button type="button" class="jd-turn-alt" data-act="done">close</button>'));
      focusFirst();
      return;
    }
    work.reveal = res.reveal || [];
    var ok = okSlots();
    JD_track('turn_complete', ok.length > 1 ? (work.winner || 'tie') : 'degraded');
    /* the winner is placed from the reveal payload — a degraded turn keeps
       its survivor, a tie asks the visitor (a purely local choice) */
    if (ok.length === 1) placeWinner(ok[0]);
    else if (work.winner && work.winner !== 'tie') placeWinner(work.winner);
    go('unveil');
  }

  /* ---------- the won item joins the pile (C5.3 / C5.4 step 7) ------------- */
  /* the visitor's filing for one slot, in the annotations shape the report
     card renders (a bare rank, or {value, note} — notes only exist on works
     persisted before the note field left the survey, 2026-08-12) */
  function ratingAnnotations(r) {
    var annotations = {};
    Object.keys(r.axes).forEach(function (axisId) {
      if (r.axes[axisId] == null) return;
      annotations[axisId] = (r.notes && r.notes[axisId])
        ? { value: r.axes[axisId], note: r.notes[axisId] }
        : r.axes[axisId];
    });
    return annotations;
  }
  function placeWinner(slot) {
    var s = work.slots[slot];
    if (!s || s.status !== 'ok' || !s.svg) return;
    var rv = revealFor(slot) || {};
    var r = work.ratings[slot];
    var rec = {
      gen_id: s.gen_id,
      submission_id: turn.submission_id,
      svg: s.svg,
      prompt: work.prompt,
      /* the model-written tag title (jd-title.php); records without one
         fall back to shortTitle(prompt) wherever they're read */
      title: work.title || null,
      model_id: rv.model_id || '',
      label: rv.label || '',
      won_at: new Date().toISOString(),
      sizeClass: work.size || VISITOR_TIER,
      /* additive to the C5.3 shape: the visitor's own filing, so a restored
         item's specimen tag and report card still state what they graded */
      grade: r.grade,
      annotations: ratingAnnotations(r)
    };
    /* what the drawing COST rides the record too (2026-08-15): the reveal
       payload's per-slot tokens/cost_usd, so the report card can state them
       after a reload. Omitted when the reveal carries none (a survivor with
       no usage recorded); cost_usd alone stays null when the model is
       unpriced — the card omits hollow lines rather than printing them. */
    if (rv.tokens) rec.tokens = rv.tokens;
    if (rv.cost_usd != null) rec.cost_usd = rv.cost_usd;
    /* the OTHER bench responses ride along (owner request, 2026-08-12;
       generalized to the trio 2026-08-14): the report card shows every
       option from the turn, the losers filed as alternative responses on
       the same entry. Only the winner joins the pile — this is
       record-keeping, not extra items. Records persisted before the trio
       carry a single `also` object; new ones carry `others` (array), and
       registerRecord reads both. */
    var others = okSlots().filter(function (x) { return x !== slot; });
    rec.others = [];
    others.forEach(function (other) {
      var os = work.slots[other];
      if (os && os.status === 'ok' && os.svg && os.gen_id) {
        var orv = revealFor(other) || {};
        rec.others.push({
          gen_id: os.gen_id, svg: os.svg,
          model_id: orv.model_id || '', label: orv.label || '',
          grade: work.ratings[other].grade,
          annotations: ratingAnnotations(work.ratings[other])
        });
        /* the losers' costs file too — the card's "same prompt" strip shows
           every option, and each response's notes state their own spend */
        if (orv.tokens) rec.others[rec.others.length - 1].tokens = orv.tokens;
        if (orv.cost_usd != null) rec.others[rec.others.length - 1].cost_usd = orv.cost_usd;
      }
    });
    if (!rec.others.length) delete rec.others;
    var list = JD_store.get(K_ITEMS) || [];
    list = [rec].concat(list.filter(function (x) { return x.gen_id !== rec.gen_id; }));
    if (list.length > MAX_ITEMS) list = list.slice(0, MAX_ITEMS);
    /* one 300KB SVG × 5 is the worst case; on a quota refusal drop the oldest
       and try once more, then give up — the item still shows this page-load */
    if (!JD_store.set(K_ITEMS, list) && list.length > 1) {
      JD_store.set(K_ITEMS, list.slice(0, list.length - 1));
    }
    work.placed = !!dropIntoPile(rec, true);
  }

  /* the taxonomy-derived half of a won item's specimen tag. Split out because
     a restored item may exist before the payload does: it is placed with these
     fields blank and they are filled in when the drawer's data arrives. */
  function labelItem(el, rec) {
    var grade = window.JD_gradeOf(tax(), rec.grade);
    el.dataset.grade = grade ? grade.label : '';
    /* data-rank is the tag's graded/ungraded switch (see pick()), so it may
       be empty ONLY when no grade was filed. Until the taxonomy arrives the
       grade cannot be NAMED, but grades are filed as the rank number itself,
       so the raw value stands in — the same fallback the pile loader and the
       report card already use. Without it a graded item would read UNGRADED
       for as long as data.php is late, and forever if it never answers. */
    el.dataset.rank = grade ? grade.rank
      : (rec.grade == null ? '' : (+rec.grade || ''));
    el.dataset.steps = (tax().grades || []).length || 5;
    el.dataset.size = window.JD_sizeLabel(tax(),
      { sizeClass: rec.sizeClass || VISITOR_TIER }) || '';
  }

  function dropIntoPile(rec, animate) {
    var pile = document.querySelector('.jd-pile');
    if (!pile || !rec || !rec.svg || !window.JD_svgInst) return null;
    if (pile.querySelector('[data-id="' + rec.gen_id + '"]')) return null;
    var title = rec.title || shortTitle(rec.prompt);
    var el = document.createElement('div');
    el.className = 'jd-item jd-item--visitor';
    el.dataset.id = rec.gen_id;
    el.dataset.scale = 1;
    el.dataset.title = title;
    el.dataset.model = rec.label || '';
    el.dataset.process = 'ONE-SHOT';
    el.dataset.date = String(rec.won_at || '').slice(0, 10);
    el.dataset.url = svgDataUrl(rec.svg);
    el.dataset.visitor = JD_STRINGS.visitorTag;
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', title);
    labelItem(el, rec);
    /* the same id-namespacing discipline as a curated item — non-negotiable
       for any SVG that did not come from this repo (APP §4.12) */
    el.innerHTML = window.JD_svgInst(rec.svg, 'juw' + (instSeq++) + '_');
    pile.appendChild(el);
    /* reframe before sizing: a live-generated drawing can overshoot the
       frame it declares, and applySize's aspect read (svgAspect) must see
       the expanded viewBox — see fitView at the top of the file. Same
       generation key the turn plates used, so the won item lands in the
       drawer framed exactly as it was on the bench. */
    if (window.JD_fitView) window.JD_fitView(el.querySelector('svg'), 'gen:' + rec.gen_id);
    if (window.JD_applySize) {
      window.JD_applySize(el, tierBox(rec.sizeClass || VISITOR_TIER), rec.gen_id, 1);
    }
    /* position: the visitor's own scatter entry, reused across reloads the
       way every other item's is */
    var map = JD_store.get(K_SCATTER) || {};
    var p = map[rec.gen_id];
    if (!p) {
      p = freshSpot(el, pile);
      map[rec.gen_id] = p;
      JD_store.set(K_SCATTER, map);
    }
    /* pushed clear of the turn button's reserved corner at apply time, same as
       the curated pile — a stored spot can predate the rule or a viewport
       change; the stored value itself stays untouched */
    if (window.JD_avoidTurn) {
      var host_ = pile.getBoundingClientRect(), r_ = el.getBoundingClientRect();
      var rad_ = (p.rot || 0) * Math.PI / 180;
      var c_ = Math.abs(Math.cos(rad_)), s_ = Math.abs(Math.sin(rad_));
      var w_ = r_.width || 40, h_ = r_.height || 40;
      var av = window.JD_avoidTurn(p.x, p.y,
        Math.min(0.45, (w_ * c_ + h_ * s_) / 2 / (host_.width || 1)),
        Math.min(0.45, (w_ * s_ + h_ * c_) / 2 / (host_.height || 1)));
      p = { x: av.x, y: av.y, rot: p.rot, z: p.z };
    }
    el.style.left = (p.x * 100) + '%';
    el.style.top = (p.y * 100) + '%';
    el.style.setProperty('--rot', p.rot + 'deg');
    el.style.zIndex = p.z || 100;
    if (animate) {
      el.classList.add('is-dropped');
      JD_haptic('drop');
    }
    /* it is a standard .jd-item from here: drag, rotate, tap-to-pick and the
       specimen tag all bind through the ordinary wiring, no special case */
    if (window.JD_wirePile) window.JD_wirePile();
    markCard(el, registerRecord(rec, title));
    return el;
  }

  function freshSpot(el, pile) {
    var host = pile.getBoundingClientRect(), r = el.getBoundingClientRect();
    var hw = Math.min(0.45, (r.width || 40) / 2 / (host.width || 1));
    var hh = Math.min(0.45, (r.height || 40) / 2 / (host.height || 1));
    function inside(half) {
      var lo = half + 0.012, span = Math.max(0, 1 - 2 * lo);
      return +(lo + Math.random() * span).toFixed(4);
    }
    return {
      x: inside(hw), y: inside(hh),
      rot: +((Math.random() * 2 - 1) * ROT_MAX).toFixed(1),
      z: 100
    };
  }

  /* The report card renders entirely from the payload, so a won item earns a
     real one by being filed as an entry: its own prompt, its model, and the
     grades the visitor just gave it. Without this the specimen tag's REPORT
     CARD button would be a dead control on visitor items — and the tag is
     shared gesture code we are not allowed to special-case. */
  function registerRecord(rec, title) {
    if (!payload || !payload.items || !window.JD_record) return false;
    if (byId(payload.items, rec.gen_id)) return true;   /* already filed */
    var file = rec.gen_id + '.svg';
    var day = String(rec.won_at || '').slice(0, 10);
    var responses = [{
      /* gen_id rides the response so the card frames this drawing under the
         SAME key the bench and the pile used for it (see fitKey / fitView) */
      rid: 'r1', file: file, gen_id: rec.gen_id, model: rec.model_id, date: day,
      generation: { mode: 'one-shot', prompt_count: 1 },
      grade: rec.grade, annotations: rec.annotations || {},
      /* a data: URL, and the ONLY thing the card may do with it is hang it
         off the download link — `visitor: true` above stops ensureSVGs from
         ever treating it as a path to join to JD_API (APP §4.1); the SVG
         text itself is primed into the cache below */
      url: svgDataUrl(rec.svg), transcript_url: null
    }];
    /* the cost fields (2026-08-15) ride the RESPONSE, not the entry, so the
       strip's per-response notes can each state their own spend. Records
       persisted before this simply lack them, and the card omits the lines. */
    if (rec.tokens) responses[0].tokens = rec.tokens;
    if (rec.cost_usd != null) responses[0].cost_usd = rec.cost_usd;
    var primed = {};
    primed[rec.gen_id + '/' + file] = rec.svg;
    /* the turn's OTHER responses file as r2, r3 (owner request, 2026-08-12;
       trio-generalized 2026-08-14), so the card's "same prompt" strip shows
       every option with the grades the visitor gave each. `primary: 'r1'`
       below pins the WINNER as the shown response — without the pin,
       best-grade-wins would re-point the card (and the drawer) at a loser
       the visitor happened to grade higher. Records stored before this
       change have a single `also` (or nothing) and file accordingly. */
    var loserRecs = rec.others || (rec.also ? [rec.also] : []);
    loserRecs.forEach(function (alt, ai) {
      if (!alt.svg || !alt.gen_id) return;
      var afile = alt.gen_id + '.svg';
      responses.push({
        rid: 'r' + (ai + 2), file: afile, gen_id: alt.gen_id, model: alt.model_id, date: day,
        generation: { mode: 'one-shot', prompt_count: 1 },
        grade: alt.grade, annotations: alt.annotations || {},
        url: svgDataUrl(alt.svg), transcript_url: null
      });
      if (alt.tokens) responses[responses.length - 1].tokens = alt.tokens;
      if (alt.cost_usd != null) responses[responses.length - 1].cost_usd = alt.cost_usd;
      primed[rec.gen_id + '/' + afile] = alt.svg;
    });
    payload.items.unshift({
      id: rec.gen_id, title: title, prompt: rec.prompt, created: day,
      visitor: true, sizeClass: rec.sizeClass || VISITOR_TIER, primary: 'r1',
      responses: responses
    });
    window.JD_record.setData(payload, primed);
    return true;
  }

  /* …and the tag reads the answer off the item. When data.php never answered
     there is no entry to render a card from, so REPORT CARD would be a dead
     control — the tag builder omits the button on data-card="none" and shows
     DOWNLOAD SVG alone (the stored SVG needs no payload). This is the same
     declarative dataset switch the tag already uses for SIZE and GRADE: the
     shared gesture code stays one path with no visitor branch in it. The flag
     is cleared when a late payload files the entry, so the button appears the
     next time the item is picked. */
  function markCard(el, filed) {
    if (!el) return;
    if (filed) delete el.dataset.card;
    else el.dataset.card = 'none';
  }

  /* page load: the visitor's won items go back where they were (C5.4 step 8).
     Stored records carry their own SVG, so this needs nothing from the server
     — it runs whether or not data.php answered. */
  function storedWon() {
    var list = JD_store.get(K_ITEMS);
    return (list && list.length) ? list : [];
  }
  function restoreWon() {
    /* oldest first, so the newest ends up nearest the top of the pile */
    storedWon().slice().reverse().forEach(function (rec) {
      if (rec && rec.gen_id && rec.svg) dropIntoPile(rec, false);
    });
  }
  /* the payload arrived after the items were already down: fill in the tag
     strings that only the taxonomy can supply, and file the report cards */
  function hydrateWon() {
    var pile = document.querySelector('.jd-pile');
    storedWon().forEach(function (rec) {
      if (!rec || !rec.gen_id) return;
      var el = pile && pile.querySelector('[data-id="' + rec.gen_id + '"]');
      if (!el) return;                /* not in the drawer, so no card for it */
      labelItem(el, rec);
      markCard(el, registerRecord(rec, rec.title || shortTitle(rec.prompt)));
    });
  }

  /* ---------- init (C5.4 step 8) ------------------------------------------ */
  /* A turn left in flight by a PREVIOUS page life is discarded here rather
     than at first open: it is dead the moment the page it belonged to went
     away, and a visitor who never opens the modal should not be carrying it.
     (The reserved read endpoint, C1.4, is the future recovery path.) */
  JD_store.remove(K_TURN);
  /* the won items go back into the drawer now, on the visitor's own stored
     copies — the payload is not a precondition (see setData) */
  restored = true;
  restoreWon();

  /* A RERUN — the curator re-issuing a curated item's original prompt to the
     four models currently in the pool, to see how they draw it now.
     Deliberately the SAME path a visitor's turn takes: same generation
     endpoint, same slot animations, same blind rating, same reveal. The only
     difference is where the words came from. Anything that forked here would
     drift from the real flow and stop being comparable to it. */
  function rerun(promptText) {
    if (!promptText || !promptText.trim().length) { return false; }
    if (isOpen) { return false; }
    clearTurn();
    work = blankWork();
    work.prompt = String(promptText).slice(0, MAX_PROMPT);
    open();
    /* the acknowledgment the generate button would have recorded — the
       disclosure lives on the card itself since 2026-08-14 */
    if (!hasConsent()) {
      JD_store.set(K_CONSENT, {
        version: JD_CONSENT.version, at: new Date().toISOString()
      });
    }
    startTurn();
    return true;
  }

  /* ---------- CURATE MODE — the re-rating bench (owner, 2026-08-28) --------
     The backlog instrument IS this card. JD_bench (the ?bench driver at the
     foot of this file) hands over one curated item at a time and the card
     runs its ordinary rate machinery on it — the same benchPanel, rail and
     podium a visitor gets, so every hour spent re-rating is spent inside the
     real instrument, and every refinement made to it ships to visitors.

     What curation changes, and ONLY this:
       — entry: no brief, no darkroom. The item's existing drawings are
         seated straight onto the bench (open() routes to 'rate').
       — blindness is reconstructed: the responses are dealt into slots in a
         shuffled order, so the letter says nothing about the model. Ratings
         key on generation ids, so a reshuffle on a later resume changes
         nothing recorded. The names still wait for the unveil.
       — filing goes through the job's file() callback (jd-item-rate.php,
         which replaces this curator's prior answers) instead of jd-rate.php.
       — resume is server-truth: answers already filed arrive prefilled, the
         rail opens at the first unfinished drawing, and a fully-answered
         item opens on the podium.
       — nothing joins the pile, nothing persists to the turn store, and
         nothing is tracked as a turn. */
  function curateOpen(job) {
    if (isOpen || !job || !job.responses || !job.file) return false;
    var n = job.responses.length;
    if (n < 1 || n > JD_SLOTS.length) return false;
    clearTurn();
    curJob = job;
    /* the rubric renders from the payload; without it the bench would paint
       zero axis rows and the gate would pass vacuously */
    ensurePayload().then(function () {
      if (!curJob || isOpen) return;
      work = blankWork();
      work.prompt = String(job.prompt || '').slice(0, MAX_PROMPT);
      /* the size already on file arrives selected: the tier the bench last
         filed, else the one the entry carries today (owner, 2026-08-30) */
      work.size = job.size || null;
      var order = job.responses.slice();
      for (var i = order.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = order[i]; order[i] = order[j]; order[j] = t;
      }
      order.forEach(function (resp, k) {
        var slot = JD_SLOTS[k];
        work.slots[slot] = {
          status: 'ok', gen_id: resp.generation_id, svg: resp.svg, cur: resp
        };
        var r = work.ratings[slot];
        /* the seed grade (carried from entry.json by the backfill) prefills
           like a prior answer: it is a deliberate, recent judgment on a
           scale the taxonomy reworks did not touch */
        r.grade = resp.grade != null ? resp.grade
          : (resp.grade_seed != null ? resp.grade_seed : null);
        Object.keys(resp.axes || {}).forEach(function (a) {
          r.axes[a] = resp.axes[a];
        });
        /* a filed rank resumes only while it fits this podium — a stale row
           from a different response count would seat a print on a step that
           doesn't exist (or, on a one-drawing item, on none at all) */
        if (resp.rank >= 1 && resp.rank <= n) work.ranks[slot] = resp.rank;
      });
      /* the rail's linear first pass, resumed: every finished drawing is
         reached, the first unfinished one is the bench's opening step */
      var ok = okSlots(), firstOpenSlot = null;
      for (var s = 0; s < ok.length; s++) {
        work.reached[ok[s]] = true;
        if (!benchRated(ok[s])) { firstOpenSlot = ok[s]; break; }
      }
      var sizeStep = job.sizeTiers && job.sizeTiers.length;
      /* everything already judged and only the size outstanding: open ON
         the size card rather than walking the visitor back through work
         they have finished (2026-08-30) */
      var ranked = ok.length < 2 || ok.every(function (s2) {
        return work.ranks[s2] >= 1;
      });
      if (firstOpenSlot) {
        work.step = firstOpenSlot;
      } else if (sizeStep && ranked && !work.size) {
        work.step = 'size';
        work.reached.size = true;
        ok.forEach(function (s2) { work.reached[s2] = true; });
        if (ok.length > 1) work.reached.call = true;
      } else if (ok.length > 1) {
        work.step = 'call';
        work.reached.call = true;
      } else {
        work.step = ok[0];
      }
      open();
    }, function () {
      curJob = null;   /* no rubric, no bench — the driver shows the failure */
    });
    return true;
  }

  /* filing, curate-shaped: the whole item goes through the job's file()
     callback as one batch — same moment the real flow files, same gate. The
     writes replace this curator's prior answers, so a retry after a partial
     failure is safe by construction. */
  function curateFile() {
    if (!curJob) return;
    var ok = okSlots();
    var per = ok.map(function (s) {
      var r = work.ratings[s], axes = {};
      Object.keys(r.axes).forEach(function (a) {
        if (r.axes[a] != null) axes[a] = r.axes[a];
      });
      return {
        generation_id: work.slots[s].gen_id,
        grade: r.grade,
        axes: axes,
        rank: ok.length > 1 ? (podRankOf(s) || null) : null
      };
    });
    setDisabled('[data-act="file"]', true);
    setDisabled('[data-act="retry-file"]', true);
    var mine = token;
    curJob.file(per, work.size || null).then(function () {
      if (mine !== token || !isOpen || !curJob) return;
      curateUnveil();
    }, function (err) {
      if (mine !== token || !isOpen || !curJob) return;
      var code = (err && err.code) || 'server_error';
      paint(head('The grades didn’t file', 6) +
        '<p class="jd-turn-line">The drawer couldn’t record them ' +
        '(<b>' + esc(code) + '</b>). Your answers are still on the card, and ' +
        'refiling replaces rather than doubles.</p>' +
        actions('<button type="button" class="jd-turn-go" data-act="retry-file">try filing again</button>' +
          '<button type="button" class="jd-turn-alt" data-act="done">close</button>'));
      focusFirst();
    });
  }

  /* the unveil, built from what the queue already knew: no server reveal to
     wait for — the names were on file all along, just withheld */
  function curateUnveil() {
    var ok = okSlots();
    /* a one-drawing item has no call, but its print still deserves to stand
       somewhere on the unveil — same seat the degraded turn gives a winner */
    if (ok.length === 1 && !podRankOf(ok[0])) work.ranks[ok[0]] = 1;
    work.reveal = ok.map(function (s) {
      var c = work.slots[s].cur || {};
      return {
        slot: s, status: 'ok',
        model_id: c.model_id || '',
        label: c.label || c.model_id || ''
      };
    });
    podSync();
    go('unveil');
  }

  window.JD_turn = {
    setData: setData,
    open: open,
    close: close,
    rerun: rerun,
    curate: curateOpen,
    isOpen: function () { return isOpen; }
  };
})();
