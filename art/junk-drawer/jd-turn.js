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
   enforced by the server (jd2-generate never names a model), and this module
   never learns an identity before jd2-rate answers.

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
  /* DATASET v2 (2026-10-01, PLAN-V2 Phase 4a): the card files through the
     jd2 endpoints — a turn is a RUN (run_id, prompt_id from jd2-generate),
     and the filing is one SESSION on it (jd2-rate: ratings by slot, the
     podium's ranking with the pedestal card's gaps — the server derives the
     pairs — or, on the bench's ?pairs=1 audit, the six head-to-head pairs
     asked directly). The v1 endpoints stay
     for the legacy exhibit at /art/junk-drawer/legacy/, which keeps its own
     copy of this file. */
  var API_GEN = '/api/jd2-generate.php';
  var API_RATE = '/api/jd2-rate.php';
  var API_INTAKE = '/api/jd2-intake.php';
  /* v2's own storage keys: the legacy page deletes jd-turn-v1 on every load
     and keeps the v1 names, so the two drawers never read each other's
     turn, consent record or won items. Nothing is migrated. */
  var K_TURN = 'jd2-turn', K_CONSENT = 'jd2-consent';
  var K_ITEMS = 'jd2-user-items';   /* the scatter map's key is jd-core's JD_SCATTER_KEY */
  /* MAX_PROMPT mirrors JD_PROMPT_MAX_CHARS in api/jd-config.php (500) — change both together */
  var MAX_PROMPT = 500, MAX_NOTE = 500, MAX_ITEMS = 5;
  /* the sitting's note (jd2_sessions.note) — jd2-rate.php clips at 2000 too */
  var MAX_SITTING_NOTE = 2000;
  var SLOW_MS = 60000;      /* past a minute the wait earns its own line */
  var VISITOR_TIER = 'm';   /* every won item is filed "m" (C5.3) */

  var payload = null;       /* the data.php payload — the survey renders from it */
  var scrim = null, card = null, headEl = null, bodyEl = null, confirmEl = null;
  var state = '', isOpen = false, confirmOn = false;
  /* CURATE MODE (the re-rating bench, 2026-08-28): while this is set, the
     card is seated with an existing curated item's responses instead of a
     fresh turn — same bench, same rail, same podium, filed through the
     contract's file() callback (JD_bench's outbox) instead of jd2-rate.php.
     Null on every visitor turn. See curateOpen() below. */
  var curJob = null;
  /* THE OWNER'S RUN (dataset v2, Phase 4b): while this is set the darkroom
     is drawing for the owner — a new prompt from the bench or a rerun —
     through jd2-generate's owner path (the bench key, the `bench` profile,
     the slots one after another on one client_ref). Nothing persists to the
     turn store, nothing is tracked as a turn, and when the last slot lands
     the card comes down and hands the run to whoever listens for
     jd-turn-close (event.detail.owner_run). See ownerRun() below. */
  var ownerJob = null, ownerResult = null;
  /* set only at the go('reveal') that ends the darkroom wait: the next
     render draws the fresh plates on (see the hook at render()'s foot) */
  var revealFresh = false;
  var turn = null;          /* the persisted in-flight record (C5.3) */
  var work = null;          /* the working copy: svgs, ratings, ranks, pairs */
  var token = 0;            /* per-turn token — a settling fetch from an
                               abandoned turn must not touch the live one */
  var lastFocus = null, instSeq = 0, slowTimer = 0;
  /* the masthead the next paint will print — the heading — and the card's
     data-view. head() fills it; the view string is built before paint
     runs, so the two can never disagree. Its title is also the dialog's
     accessible name (paint sets it), so the name changes with the step
     instead of naming the whole flow once. */
  var pendingHead = null;

  /* ---------- small helpers ---------------------------------------------- */
  var esc = JD_esc, byId = JD_byId;
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
  /* the turn's three POSTs — the title, a generation, the filing: a JSON
     body out, the parsed answer back, or `bad` (each caller's own stand-in)
     when the answer will not parse. A request that never completes rejects
     straight through, to each caller's own network handler. `keyed` sends
     the bench key (JD_admin) — the owner's runs only, never a visitor's. */
  function postJSON(path, body, bad, keyed) {
    var hdr = { 'Content-Type': 'application/json' };
    if (keyed && window.JD_admin) hdr = JD_admin.headers(hdr);
    return fetch(JD_API + path, {
      method: 'POST',
      headers: hdr,
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (j) { return j; }, function () { return bad; });
    });
  }
  /* a specimen name for a won item: the visitor's own words, cut to
     something a manila tag can carry (the full prompt is kept verbatim and
     shown on the report card) */
  function shortTitle(prompt) {
    var s = String(prompt || '').replace(/\s+/g, ' ').trim();
    return s.length > 52 ? s.slice(0, 51).replace(/\s+\S*$/, '') + '…' : s;
  }
  function tax() { return (payload || {}).taxonomy || {}; }
  /* what is read off it — the live axes, a scale best first, a tier's box —
     is jd-core's: JD_liveAxes(tax()), JD_byRankDesc(list), JD_tierBox(tax(), id) */

  /* ---------- payload ----------------------------------------------------- */
  /* The visitor's own items are restored WITHOUT this (see the init block at
     the foot of the module): they are stored whole, and a drawer that failed
     to load is exactly the moment not to lose them too. The payload, when it
     turns up, only supplies the taxonomy strings on their specimen tags and
     the entries behind their report cards. */
  function setData(data) {
    payload = data;
    hydrateWon();
  }
  /* the pile loader hands the payload over on success; if the drawer itself
     failed to load, the survey fetches its own copy rather than inventing a
     rubric (C5.4 step 5) — the full payload: no ?slim=1 here, even on a
     page that set JD_SLIM */
  function ensurePayload() {
    if (payload) return Promise.resolve(payload);
    return fetch(JD_API + JD_DATA_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('data.php ' + r.status);
        return r.json();
      })
      .then(function (d) { setData(d); return payload; });
  }

  /* ---------- the persisted turn (C5.3) ----------------------------------- */
  function persist() {
    if (turn && !ownerJob) JD_store.set(K_TURN, turn);
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
  /* the acknowledgment, recorded once, when words are first actually sent
     — by the generate press and by a rerun alike */
  function recordConsent() {
    if (!hasConsent()) {
      JD_store.set(K_CONSENT, {
        version: JD_CONSENT.version, at: new Date().toISOString()
      });
    }
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
      JD_X_MARK + '</button></header>' +
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
    /* the catalogue entry's scope notes: pointed at, focused, or held */
    bodyEl.addEventListener('pointerover', catOver);
    bodyEl.addEventListener('pointerout', catOut);
    bodyEl.addEventListener('focusin', catOver);
    bodyEl.addEventListener('pointerdown', catDown);
    bodyEl.addEventListener('pointermove', catMove);
    bodyEl.addEventListener('pointerup', catUp);
    bodyEl.addEventListener('pointercancel', catUp);
    /* a held chip on Android raises the context menu: not on a chip */
    bodyEl.addEventListener('contextmenu', function (e) {
      if (catChipOf(e)) e.preventDefault();
    });
    /* the bench/call plate answers Enter/Space like the button it claims to
       be (role="button" — see plate()); Space is preventDefault'd or the
       card scrolls out from under the enlargement. The paper swap is a real
       <button>, so the UA turns these keys into its click — onClick above
       swaps the paper, nothing here should zoom. */
    bodyEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      if (e.target.closest && e.target.closest('.jd-turn-paper')) return;
      var p = e.target.closest ? e.target.closest('.jd-turn-plate') : null;
      if (!p || p.getAttribute('role') !== 'button') return;
      e.preventDefault();
      openZoom(p);
    });
    /* the head-to-head's keys: 1–7 and the arrows pick, Enter advances */
    card.addEventListener('keydown', onPairKey);
    /* the pedestal card's: ↑/↓ on a focused pedestal set its margin, and
       focusing a pedestal makes its pair the question (see BY HOW MUCH) */
    card.addEventListener('keydown', onPedKey);
    card.addEventListener('focusin', onPedFocus);
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
    /* card, not bodyEl: the heading — the landing place for most states —
       lives in the masthead outside the scroller now */
    var scope = confirmOn && confirmEl ? confirmEl : card;
    var f = focusables(scope);
    var pref = scope.querySelector('[data-autofocus]');
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
    if (!curJob && !ownerJob) JD_track('turn_open', null);
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
    /* the bar goes with the innerHTML below; its parked animations do not */
    if (filmstrip) { try { filmstrip.destroy(); } catch (e) {} filmstrip = null; }
    /* …and neither do the darkroom's word drifts: their metronomes live on
       timers, not on the elements (see paint), so a close mid-wait would
       leave them minting letters onto a detached sheet until the next mount */
    if (window.JD_dark) window.JD_dark.stopAll();
    bodyEl.innerHTML = '';
    if (lastFocus && document.contains(lastFocus)) {
      try { lastFocus.focus(); } catch (e) {}
    }
    lastFocus = null;
    curJob = null;
    /* an owner's run says how it ended: the result when its last slot
       landed, else (stopped mid-wait) whatever run it had reached */
    var detail = null;
    if (ownerJob) {
      detail = { owner_run: ownerResult || { abandoned: true,
        run_id: ownerJob.run_id || null, prompt_id: ownerJob.prompt_id || null,
        rerun_of: ownerJob.rerun_of || null, ok: 0 } };
    }
    ownerJob = null;
    ownerResult = null;
    /* the LAST act of closing, after every bit of state above is settled:
       JD_bench listens for this to advance the backlog (or offer resume),
       and its handler may synchronously reopen this same modal — including
       via ownerRun(), which checks isOpen. Nothing may run after the dispatch. */
    try {
      window.dispatchEvent(new CustomEvent('jd-turn-close', { detail: detail }));
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
      curJob ? 'set this item aside?' : ownerJob ? 'stop this run?' : 'abandon this turn?');
    /* the curate card costs nothing to leave — but the grades on it file as
       one item at the end, so leaving mid-card does drop this card's unfiled
       answers. Different stake, different sentence. */
    confirmEl.innerHTML =
      '<div class="jd-turn-confirm-card">' +
      (curJob
        ? '<p>set this item aside? grades file when the whole item files — ' +
          'this card’s answers aren’t saved yet.</p>'
        : ownerJob
        ? '<p>stop this run? the drawing in flight finishes; the slots not yet ' +
          'asked for are not asked.</p>'
        : '<p>abandon this turn? the machines finish either way — the drawing ' +
          'just goes unrated.</p>') +
      '<div class="jd-turn-actions">' +
      '<button type="button" class="jd-turn-go" data-act="stay" data-autofocus>keep going</button>' +
      '<button type="button" class="jd-turn-alt" data-act="abandon">' +
      (curJob ? 'set it aside' : ownerJob ? 'stop' : 'abandon') + '</button>' +
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

  /* (the definition layer — OVERRIDE 1's fixed singleton tooltip, shown on
     hover and on keyboard focus over a [data-tt-t] anchor — retired when
     the press-to-open disclosure replaced it, owner 2026-08-28; see
     scaleRow. Its last code, which nothing could trigger any more, went
     2026-10-01.) */

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
    requestClose();
  });

  /* ---------- the state machine ------------------------------------------- */
  function go(next) {
    /* (the mappings for the retired 'compare' (2026-08-11) and 'consent'
       (2026-08-14) states are gone: they caught a stored turn parked on
       either, and no stored turn is ever read back — init discards it) */
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
    /* the pedestal card's heights are measured off the painted DOM (its
       notch and print sizes are CSS tokens that change at the phone break) */
    pedMount();
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
  /* THE FILMSTRIP (owner, 2026-09-16): the replay/scrub control goes INSIDE
     the bench's pinned plate, under the artwork, so the sticky pin and the
     landscape grid are untouched. Only the bench gets one: the reveal and the
     call show several plates at once, and n × twelve parked animation sets is
     a cost the bench's single plate does not pay. Every write to the card goes
     through paint, so mounting here is mounting once per view — and the old
     control is destroyed first, since its bar goes with the innerHTML but its
     parked animations would not. */
  var filmstrip = null, fsSeq = 0;
  function mountFilmstrip() {
    if (filmstrip) { try { filmstrip.destroy(); } catch (e) {} filmstrip = null; }
    if (!window.JD_filmstrip || !bodyEl) return;
    var art = bodyEl.querySelector('.jd-bench .jd-turn-pin .jd-turn-plate .jd-turn-art');
    var svg = art && art.querySelector('.jd-turn-art-in > svg');
    if (!svg) return;
    try {
      filmstrip = window.JD_filmstrip(svg, art, {
        /* autoplay:false — the bench's plate never drew itself on arrival
           (the pencil was the only way), and the play button is that pencil
           now; the control parks at the finished drawing instead */
        autoplay: false,
        pfx: 'fst' + (++fsSeq) + '_',
        label: 'Replay this drawing'
      });
    } catch (e) {}
  }

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
    /* the plates carry their drawings as slots (JD_svgSlot): parse them in
       as XML now, before anything below fits, walks or replays them — the
       inline parse, jd-core.js (never innerHTML for a drawing) */
    if (window.JD_svgMount) window.JD_svgMount(bodyEl);
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
    mountFilmstrip();
    card.setAttribute('aria-label', (pendingHead && pendingHead.title) || 'take a turn');
    card.setAttribute('data-view', (pendingHead && pendingHead.view) || 'form');
  }
  /* the masthead: just the heading (the FORM JD-1 §n badge that used to
     lead this row was retired 2026-08-16, owner call — head() still takes
     the section number so the flow's §1–§6 order stays declared at the
     call sites, but nothing prints it) */
  function headHTML() {
    var p = pendingHead || { title: 'take a turn' };
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
    var msg = work && work.notice ? noticeHTML(esc(work.notice)) : '';
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
      /* the placeholder INSTRUCTS rather than suggests (owner, 2026-09-10):
         the sample object it used to show ("a brass fish that is also a
         whistle") read as strange to a first visitor */
      'placeholder="Describe an object you would like to see drawn as an SVG.">' + esc(draft) + '</textarea>' +
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
      /* 2026-10-01 (legal audit): the line now says the turn goes public,
         because it does — jd-consent-6 */
      '<p class="jd-turn-fine">Sent to Anthropic, OpenAI, Moonshot AI and ' +
      'Google to be drawn and studied; a random code kept in your browser ' +
      'links your turns. Once rated, your turn joins the public drawer ' +
      'unless you keep it out — see our <a class="jd-turn-link" ' +
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
      if (st.state === 'ok' || st.state === 'fail') stopDriftAfterFade(sw);
    });
    var slow = bodyEl.querySelector('[data-slow]');
    if (slow && work.slow) slow.removeAttribute('hidden');
    /* (the round-17 countdown title — "Three are still drawing" — retired
       with round 26's fixed PLEASE STAND BY heading; the per-slot status
       lines above are the progress announcements now) */
  }
  /* A landed swatch's word drift is stopped once its well has faded out.
     The CSS pause on a landed swatch only governs CSS animations; the
     drift's letters fall on element.animate() and are minted by a metronome
     on a timer, so without this the swatch would go on minting letters
     behind its fade until the next paint. Not AT the landing: the letters
     that fall during the well's 0.5s fade are part of what the visitor
     watches go. After it: the well's own opacity transitionend, or a 600ms
     fallback, whichever comes first, once. The fallback is for the fade
     that never fires an end (reduced motion has no transition — and no
     drift either, so there it finds nothing to stop); it waits instead
     while the tab is hidden or the fade is provably still running (a
     hidden tab only starts the fade once the visitor is back), for as long
     as the swatch is still on the card. Only a swatch dealt the drift has
     anything to stop. */
  function stopDriftAfterFade(sw) {
    var drift = sw.querySelector('.jd-drift');
    if (!drift) return;
    var well = sw.querySelector('.jd-dark-well'), timer = 0, done = false;
    function fading() {
      if (!well || !well.getAnimations) return false;
      return well.getAnimations().some(function (a) {
        return a.transitionProperty === 'opacity' && a.playState !== 'finished';
      });
    }
    function stop(e) {
      if (done) return;
      if (e && (e.target !== well || e.propertyName !== 'opacity')) return;
      if (!e && document.contains(sw) && (document.hidden || fading())) {
        timer = setTimeout(stop, 600);
        return;
      }
      done = true;
      if (well) well.removeEventListener('transitionend', stop);
      clearTimeout(timer);
      if (window.JD_dark && window.JD_dark.stop) window.JD_dark.stop(drift);
    }
    if (well) well.addEventListener('transitionend', stop);
    timer = setTimeout(stop, 600);
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
  /* THE PAPER, on the bench (owner ask, 2026-09-14): the report card has
     carried the graph/blueprint swap since 2026-09-10; the exhibit being
     graded gets the same button now — grading a light drawing on cream
     graph paper has the same readability problem the report card's swap
     was built for. window.JD_paper (jd-core.js) is the one shared
     preference; the button and its toggle mirror jd-record.js's rc-paper
     exactly, down to the markup, so the mark is the same wherever a
     viewer meets it — only the wrapping class differs, for this card's
     own paper/ink tokens. */
  function paperBtnHTML() {
    var blue = window.JD_paper.get() === 'blueprint';
    return '<button type="button" class="jd-turn-paper" data-act="paper" aria-pressed="' +
      (blue ? 'true' : 'false') + '" title="' +
      (blue ? 'back to graph paper' : 'blueprint paper — for light artwork') +
      '" aria-label="' + (blue ? 'Switch to graph paper' : 'Switch to blueprint paper') + '">' +
      window.JD_paper.icon() + '</button>';
  }
  /* `figEl` is the currently rendered plate (there is only ever one on the
     bench — see benchPanel); the enlargement, if standing, wears the same
     paper as the report card's does (see zoomHTML). */
  function togglePaper(figEl) {
    var next = window.JD_paper.get() === 'blueprint' ? 'graph' : 'blueprint';
    window.JD_paper.set(next);
    var art = figEl && figEl.querySelector('.jd-turn-art');
    if (art) {
      art.classList.toggle('is-blueprint', next === 'blueprint');
      var btn = art.querySelector('.jd-turn-paper');
      if (btn) btn.outerHTML = paperBtnHTML();
    }
    var fig = document.querySelector('.rc-zoom-fig');
    if (fig) fig.classList.toggle('is-blueprint', next === 'blueprint');
  }
  function plate(slot, opts) {
    var s = work.slots[slot];
    if (!s || s.status !== 'ok') return '';
    opts = opts || {};
    /* two optional fittings, both worn only by the RATE plates (bench +
       call) — the reveal's stay plain, since its drawings just drew
       themselves on arrival and grading hasn't begun. `zoom` makes the
       whole figure the enlarge control, the record card's plate idiom
       (role/tabindex on the photograph, handlers at onClick and the
       anonymous plate keydown wired in build()); `paper` mounts its
       graph/blueprint swap (bench only — see benchPanel). (A third,
       `replay` — the report photograph's REPLAY button on the print's own
       corner — retired 2026-09-16, when the bench's filmstrip took the
       replay over.) The figure's data-slot is how the delegated handlers
       learn which drawing a press belongs to. */
    return '<figure class="jd-turn-plate"' +
      (opts.zoom ? ' role="button" tabindex="0" data-slot="' + slot + '"' +
        ' aria-label="Enlarge the artwork"' : '') + '>' +
      '<div class="jd-turn-art' + (opts.paper && window.JD_paper.get() === 'blueprint' ? ' is-blueprint' : '') + '">' +
      '<span class="jd-turn-corner tl"></span><span class="jd-turn-corner tr"></span>' +
      (opts.paper ? paperBtnHTML() : '') +
      '<span class="jd-turn-corner bl"></span><span class="jd-turn-corner br"></span>' +
      /* the generation id keys the frame: the reveal's big plate and the
         bench's pinned one are the same drawing and must be framed alike.
         A slot that somehow arrived without one falls back to this turn's
         own ref — never a bare slot letter, which the NEXT turn's slot A
         would collide with and inherit a stale frame from. The role="img"
         lives HERE, on the svg-only wrapper, not on .jd-turn-art: role=img
         makes every child presentational, which would hide the plate's
         own controls (the paper swap, the filmstrip) from assistive tech
         (the record card's .rc-plate-art carries no role for the same
         reason). */
      '<div class="jd-turn-art-in" role="img" aria-label="drawing ' +
      slot.toUpperCase() + '" data-fit="gen:' +
      esc(s.gen_id || ((turn && turn.client_ref) || 'turn') + ':' + slot) + '">' +
      window.JD_svgSlot(s.svg, 'ju' + slot + (instSeq++) + '_') + '</div>' +
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
      /* the head-to-head's blind letter, pencilled over the artwork the
         podium's way (aria-hidden: the art's own label names the drawing) */
      (opts.label
        ? '<span class="jd-pair-tag" aria-hidden="true">' + esc(opts.label) + '</span>'
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
     this" going dead would be the worse accessibility outcome). (The
     plate's own REPLAY button retired 2026-09-16 — the filmstrip under the
     bench plate carries the replay now — and the same rule holds for the
     enlargement's REDRAW, wired in openZoom.) ENLARGE is the record card's
     own full-viewport layer reused class-for-class
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
     modal (the window keydown handler above). */
  var zoom = JD_zoomLayer();
  var zoomWired = false;   /* the layer's kept controls, wired once (openZoom) */
  /* the enlargement's contents: the SAME drawing the plate shows, on the
     same graph-paper swatch (.rc-zoom-fig's CSS is shared with the record
     card). Its inlined copy takes a `juz` prefix — the plate's own copy is
     `ju<slot>N_`, still in the card underneath, and the record card's `jz`
     belongs to a dialog that refuses to be open alongside this one.
     `fit` is the plate's own data-fit key, carried over verbatim so
     JD_fitAll reframes the copy exactly as it framed the plate. */
  function zoomHTML(slot, fit) {
    var s = work.slots[slot];
    /* REDRAW and the ✕ ride the enlargement here as they do on the report
       card's (owner, 2026-09-11: "the button to redraw isn't there when I
       enlarge"). Same classes, same bands (.rc-zoom-fig's CSS is shared),
       same .rc-zoom-keep exemption from the layer's press-to-close; the
       clicks are wired in openZoom(). No DOWNLOAD — a drawing under
       judgment is not yet anyone's to keep. Wears the current paper
       (2026-09-14) the same unconditional way the report card's does —
       whichever plate opened it, an enlarged drawing gets the readability
       swap if the viewer has it on. */
    return '<div class="rc-zoom-fig' + (window.JD_paper.get() === 'blueprint' ? ' is-blueprint' : '') + '" role="button" tabindex="0" ' +
      'aria-label="Shrink the artwork">' +
      '<div class="rc-zoom-art" data-fit="' + esc(fit) + '">' +
      window.JD_svgSlot(s.svg, 'juz' + slot + (instSeq++) + '_') +
      '</div>' +
      '<button type="button" class="rc-zoom-close rc-zoom-keep" aria-label="close">' +
      JD_X_MARK + '</button>' +
      '<div class="rc-plate-btns rc-zoom-keep">' +
      '<button type="button" class="rc-draw" title="watch the drawing draw itself again" ' +
      'aria-label="Replay drawing ' + slot.toUpperCase() + '">' +
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path d="M13.4 8a5.4 5.4 0 1 1-1.7-3.9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>' +
      '<path d="M13.6 2.4v3.4h-3.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg><span>REDRAW</span></button></div>' +
      '</div>' +
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
    /* the enlargement's kept controls, wired once on this dialog's own
       layer: REDRAW draws the enlargement's copy on again; the ✕ shrinks
       the enlargement and stops there — the bench underneath stays */
    if (!zoomWired) {
      zoomWired = true;
      zoom.el().addEventListener('click', function (e) {
        var t = e.target;
        if (!t.closest) return;
        if (t.closest('.rc-draw')) {
          var svg = zoom.el().querySelector('.rc-zoom-art svg');
          if (svg && window.JD_drawOn) window.JD_drawOn(svg, { force: true });
        } else if (t.closest('.rc-zoom-close')) {
          closeZoom();
        }
      });
    }
  }
  function closeZoom(silent) { zoom.close(silent); }

  /* the status slip above a card's content: the brief's rate-limit notice,
     the results' count of what was lost. `inner` arrives escaped. */
  function noticeHTML(inner) {
    return '<p class="jd-turn-notice" role="status">' + inner + '</p>';
  }
  /* the results' notice, by how many machines' drawings were lost; none
     lost (or, never reached, all four) prints nothing */
  var LOST_LINE = {
    3: 'three machines’ drawings didn’t survive — you’ll grade this one alone.',
    2: 'two machines’ drawings didn’t survive — you’ll grade the two that came back.',
    1: 'one machine’s drawing didn’t survive — you’ll grade the three that came back.'
  };
  function viewReveal() {
    var ok = okSlots();
    var lost = JD_SLOTS.length - ok.length;
    var notice = LOST_LINE[lost] ? noticeHTML(LOST_LINE[lost]) : '';
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
     (pillRow, the two-panel pill survey's row, retired with the single
     bench, 2026-08-11; it lingered for the unveil's tie keep-chooser until
     that went too, 2026-10-01.) */
  /* THE SINGLE BENCH (owner pick, mockup round 10, 2026-08-11). One response
     on the bench at a time — a step rail (response A → response B → the
     call), the artwork pinned sticky while its response is graded, every
     scale a native <select> (titles only on the control and in the list;
     skip is the honest default), and ONE definition system: a hover/focus
     tooltip anchored to a plain-text label (OVERRIDE 1, round-16 — the
     click-to-unfold ⓘ popover it used to pair with is retired outright;
     the tooltip itself gave way to the press-to-open disclosure, 2026-08-28
     — see scaleRow).
     The two-panel pill survey and the separate compare state are retired;
     the call is THE PODIUM (below) and closes the same state. */

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
     be minted (the unveil's tie chooser, kept a while for old/cached
     flows, is gone: no stored turn is ever read back).
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
     drag the DOM does not change at all, so the rects stay honest. (The
     drag alone holds on to nodes: it resolves the row, the tray and the
     steps once, at the lift, and re-reads only their rects on every move —
     see podParts, which looks them up afresh if a repaint has swapped the
     podium out from under it.) */
  function podRoot() { return bodyEl ? bodyEl.querySelector('.jd-pod') : null; }
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
    setDisabled('[data-act="next"], [data-act="file"]', !callReady());
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
      pointerId: e.pointerId, over: null, parts: null
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
    podParts();   /* the drop targets, resolved once for the whole drag */
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
  /* the drag's drop targets — the podium, its row of steps, the tray and the
     steps themselves — kept on podDrag from the lift on, so a pointermove
     reads rects, not selectors. Keyed on the live podium: if anything has
     repainted it mid-drag they are looked up afresh, exactly as an uncached
     lookup would find them, and once the podium is gone there are none. */
  function podParts() {
    var root = podRoot();
    if (!root) return null;
    if (podDrag && podDrag.parts && podDrag.parts.root === root) return podDrag.parts;
    var parts = {
      root: root,
      row: root.querySelector('.jd-pod-row'),
      tray: root.querySelector('.jd-pod-tray'),
      tiers: root.querySelectorAll('.jd-pod-tier')
    };
    if (podDrag) podDrag.parts = parts;
    return parts;
  }
  /* nearest step by horizontal distance — the gaps between the blocks, and
     the empty air above a short block, all belong to the step nearest them */
  function podNearest(x, tiers) {
    var best = 1, d = Infinity;
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
    var p = podParts();
    if (!p) return null;
    var row = p.row, tray = p.tray;
    if (row && podIn(podGrow(row.getBoundingClientRect(), 14, 8, 4), x, y)) return podNearest(x, p.tiers);
    if (tray && podIn(podGrow(tray.getBoundingClientRect(), 6, 8, 14), x, y)) return 0;
    return null;
  }
  function podOver(k) {
    if (!podDrag || k === podDrag.over) return;
    podDrag.over = k;
    var p = podParts(), tiers = p ? p.tiers : [];
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
    /* read, then write: the hit test reads the row/tray/step rects, and
       moving the ghost first made every pointermove a synchronous layout.
       The ghost is position:fixed and pointer-events:none, so where it
       stands cannot move those rects — the order changes no answer. */
    var a = podAim(e), k = podHit(a.x, a.y);
    podDrag.ghost.style.left = (e.clientX - podDrag.dx) + 'px';
    podDrag.ghost.style.top = (e.clientY - podDrag.dy) + 'px';
    podOver(k);
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
     mouse users on hover over the label, and needs no toggle state at all.
     (The hover half retired 2026-08-28: sighted visitors open it by
     pressing the row's head — see THE DISCLOSURE below.) */
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
  function scaleRow(slot, ax, chosen) {
    var axisId = ax ? ax.id : null;
    var label = ax ? (ax.label || ax.id) : 'overall grade';
    var levels = JD_byRankDesc(ax ? ax.values : tax().grades);
    /* THE OVERALL GRADE'S GUIDANCE (owner, 2026-09-29): unfolding the row
       gives the rater the question the grade answers, then every tier's own
       description from taxonomy.json, best to worst — one tier a line.
       descHTML is the sighted disclosure; desc (plain text) is what a screen
       reader hears at the select. */
    var GRADE_LEAD = 'Judge the drawing as a whole: could you use it, and ' +
      'how much work would it take to get there?';
    var desc = ax ? (ax.description || '') : GRADE_LEAD + ' ' +
      levels.map(function (l) {
        return window.JD_labelText(l.label || l.id) + ': ' + (l.description || '');
      }).join(' ');
    var descHTML = ax ? esc(desc) : esc(GRADE_LEAD) +
      levels.map(function (l) {
        return '<br><b>' + esc(window.JD_labelText(l.label || l.id)) + '</b> &mdash; ' +
          esc(l.description || '');
      }).join('');
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
      'aria-label="what ' + esc(window.JD_labelText(label)) +
      ' means"></button>' +
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
      '<div class="jd-row-exp" hidden>' + descHTML + '</div>';
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
  /* THE HOUSE RULE (owner, 2026-10-02, taxonomy v35): what every model was
     told, in one sentence from taxonomy.json `houseRule`, above the rating
     panel — visitors and the bench alike — because three axes (Structural
     Coherence's framing, Layering's setting, Paintwork's shadow beneath)
     are judged against a system prompt no rater otherwise sees. Small
     print under the rail, across the whole card: one line on the desktop
     bench, two on a phone. A taxonomy without the key prints nothing. */
  function houseRuleHTML() {
    var t = String(tax().houseRule || '').trim();
    return t ? '<p class="jd-turn-rule">' + esc(t) + '</p>' : '';
  }
  /* THE PRUNED PREFILL (taxonomy v35): a bench reopen whose earlier sitting
     carried a value on a retired axis, or off an axis's current scale,
     starts without it (jd2-queue's prefill_pruned, and curateOpen's own
     check) — say so once, above the rows, so a blank row is not a mystery */
  function prunedHTML() {
    return work && work.prefillPruned
      ? '<p class="jd-turn-pruned" role="note">earlier answers on a retired or ' +
        'rescaled axis were not carried over</p>'
      : '';
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
    return JD_liveAxes(tax()).every(function (ax) { return r.axes[ax.id] != null; });
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
     ranking when there is more than one, then THE PEDESTAL CARD — "by how
     much", one card asking each adjacent pair's margin (owner, 2026-10-02;
     see BY HOW MUCH below) — or, on the bench's ?pairs=1 audit only, one
     head-to-head card per unordered pair instead (dataset v2, 2026-10-01 —
     see THE HEAD TO HEAD). Never both in one sitting. Then the size card
     that closes it (owner, 2026-08-30) — on the bench, the catalogue entry
     (0.13.0), which carries the size among the rest of the entry. */
  function stepSeq() {
    var seq = okSlots();
    if (seq.length > 1) seq = seq.concat(['call']).concat(gapsOn() ? ['gaps'] : pairSteps());
    if (sizeTiers().length) seq = seq.concat(['size']);
    return seq;
  }

  /* the size step's ring mark: two nested squares, the scale itself */
  var RAIL_SIZE =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" ' +
    'aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="1"/>' +
    '<rect x="9.5" y="9.5" width="5" height="5" rx="0.5"/></svg>';

  /* the catalogue entry's ring mark (0.13.0): an index card, its heading
     line drawn heavier than the two entry lines under it */
  var RAIL_ENTRY =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" ' +
    'stroke-linecap="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="1"/>' +
    '<path d="M6 9.5h12"/><path d="M6 13h8M6 16h10" stroke-width="1.1"/></svg>';

  /* the head-to-head's ring mark: two prints side by side, a rule between */
  var RAIL_PAIRS =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" ' +
    'aria-hidden="true"><rect x="2.5" y="6" width="7.5" height="12" rx="0.8"/>' +
    '<rect x="14" y="6" width="7.5" height="12" rx="0.8"/>' +
    '<path d="M12 3.5v17" stroke-width="1.1" stroke-dasharray="1.6 1.9"/></svg>';

  /* the pedestal card's ring mark: two pedestals on a floor, the left one
     raised by a course — the margin itself */
  var RAIL_GAPS =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" ' +
    'aria-hidden="true"><path d="M2.5 20.5h19"/>' +
    '<rect x="4" y="7" width="7" height="13.5"/><rect x="13" y="13" width="7" height="7.5"/>' +
    '<path d="M4 13h7" stroke-width="1.1"/></svg>';

  function railHTML(ok, tiers) {
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
    /* BY HOW MUCH IS ONE NODE (2026-10-02): the pedestal card asks every
       adjacent pair inside one card ("Question k of n−1" is the card's own
       tab), so the docket carries one station for it */
    if (gapsOn()) {
      steps.push({ id: 'gaps', n: steps.length + 1, label: 'by how much',
        face: RAIL_GAPS, word: 'by how much' });
    }
    /* THE HEAD TO HEAD IS ONE NODE (2026-10-01): six pairs would be six more
       rings — twelve on a 390px phone — so the docket carries a single
       node for the whole run of pair cards, and its word counts the card
       you stand on ("head to head 3/6"). It reads as reached once any pair
       has been, and a press lands on the first pair still unanswered. */
    var deck = pairDeck();
    if (deck.length) {
      var at = isPairStep(work.step) ? deck.indexOf(pairOf(work.step)) + 1 : 0;
      steps.push({ id: 'pairs', n: steps.length + 1, label: 'head to head' +
          (at ? ', ' + at + ' of ' + deck.length : ''),
        face: RAIL_PAIRS, word: 'head to head',
        count: at ? at + '/' + deck.length : '' });
    }
    /* the size card closes a curation (owner, 2026-08-30): its ring wears
       the nested-squares mark — the scale itself, small inside large. On
       the bench it is THE CATALOGUE ENTRY (0.13.0), which carries the size
       among the rest of the entry: the same station (its step id stays
       'size'), an index card on the ring and its own word */
    if (tiers.length) {
      steps.push(catalogueOn()
        ? { id: 'size', n: steps.length + 1, label: 'the catalogue entry',
            face: RAIL_ENTRY, word: 'catalogue entry' }
        : { id: 'size', n: steps.length + 1, label: 'how big is it',
            face: RAIL_SIZE, word: 'size' });
    }
    /* seven nodes outgrow a phone's sheet at the default link length: the
       --long modifier shortens the connectors there (the CSS) */
    var h = '<div class="jd-rail' + (steps.length > 6 ? ' jd-rail--long' : '') +
      '" role="list">';
    steps.forEach(function (st, i) {
      var pairsNode = st.id === 'pairs';
      var current = pairsNode ? isPairStep(work.step) : work.step === st.id;
      var reached = pairsNode
        ? deck.some(function (p) { return !!work.reached[PAIR_PFX + p.key]; })
        : !!work.reached[st.id];
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
        (st.id === 'gaps' ? ' jd-rail-step--gaps' : '') +
        (pairsNode ? ' jd-rail-step--pairs' : '') +
        (current ? ' is-current' : reached ? ' is-done' : '') +
        '" data-act="step" data-step="' + st.id +
        '"' + (reached ? '' : ' disabled') +
        (current ? ' aria-current="step"' : '') +
        ' aria-label="step ' + st.n + ' — ' + esc(st.label) + '">' +
        '<span class="jd-rail-ring">' + st.face + '</span>' +
        '<span class="jd-rail-word">' + esc(st.word || st.label) +
        (st.count ? ' <span class="jd-rail-count">' + esc(st.count) + '</span>' : '') +
        '</span></button>';
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
  function benchPanel(slot, ok, tiers) {
    var r = work.ratings[slot];
    var idx = ok.indexOf(slot);
    var two = ok.length > 1;
    var h = houseRuleHTML() + '<div class="jd-bench">' +
      '<div class="jd-bench-l"><div class="jd-turn-pin">' +
      /* no REPLAY pencil since 2026-09-16 — the filmstrip mounted under
         this plate by paint() carries the replay now, and the pencil beside
         it would be a second button doing the same thing */
      plate(slot, { pin: true, zoom: true, paper: true }) + '</div></div>' +
      '<div class="jd-bench-r">' +
      /* the prompt OPENS the paperwork column, above the rows (owner,
         2026-08-28) — and, the wrappers being display:contents in the
         portrait stack, sits between the sticky plate and the rows there */
      briefHTML() +
      prunedHTML() +
      benchHeadHTML();
    /* axes first, in taxonomy order, THEN the overall grade (owner
       directive r4): the report card files axes in <tbody> and the overall
       grade alone in <tfoot> below a rule — the SAME rubric was reading in
       the opposite order here, one click away. .jd-row--grade already
       carries the 2px top rule that reads as a tfoot break; it just needed
       the grade row to actually be last for that rule to mean what it looks
       like it means. */
    JD_liveAxes(tax()).forEach(function (ax) {
      h += scaleRow(slot, ax, r.axes[ax.id]);
    });
    h += scaleRow(slot, null, r.grade);
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
    var sized = tiers.length;
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
    var spark = gaugeFor(null, JD_byRankDesc(tax().grades).length, rt ? rt.grade : null);
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
  function callPanel(ok, tiers) {
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
    /* the ranking hands on rather than filing when a card follows it: the
       pedestal card (owner, 2026-10-02) — or the bench's head-to-head audit
       (dataset v2, 2026-10-01) — and/or the size (owner, 2026-08-30). The
       podium itself is untouched — only its button's destination moved. */
    var toGaps = gapsOn();
    var toPairs = !toGaps && pairDeck().length > 0;
    var more = toGaps || toPairs || tiers.length;
    return h + (more ? '' : suppressHTML()) + actions(
      '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>' +
      '<button type="button" class="jd-turn-go" data-act="' +
      (more ? 'next' : 'file') + '"' + (callReady() ? '' : ' disabled') + '>' +
      (toGaps ? 'next — by how much &rarr;'
        : toPairs ? 'next — head to head &rarr;'
        : more ? 'next — size &rarr;' : 'file the grades') + '</button>');
  }

  /* ═══════════════════════════════════════════════════════════════════════
     THE HEAD TO HEAD (dataset v2, PLAN-V2 §4 "A. Direct pairwise", owner
     2026-10-01) — THE BENCH'S AUDIT since 2026-10-02 (owner): the pedestal
     card (BY HOW MUCH, below) is the instrument, and these cards run only
     on ?bench&pairs=1, in its place. After the podium, one card per UNORDERED PAIR of surviving
     drawings — four drawings, six cards — each showing the two side by side
     (stacked on a phone, the scale between them) under their blind letters,
     with the 7-point comparison scale rendered from taxonomy.comparison:
     the values and their labels are data, listed in display order, +3
     ("the first much better") at the left end through 0 ("about the same")
     to −3 at the right. "First" is the drawing on the left (on top, on a
     phone); the letters at the scale's two ends say which that is.
     One answer per pair is required (the button is gated as the bench's
     is); back is always allowed. The podium stays exactly as it was and
     comes first, so the owner's gaps card ("by how much", designed
     elsewhere) can slot in after it without touching this one.

     The answers live in work.pairs, keyed by the CANONICAL pair 'a|c'
     (slot letters in order), the score signed the canonical way: positive
     means the alphabetically-first slot was preferred — jd2_pairs' own
     convention, so nothing is re-signed twice. Which drawing stood on the
     left is dealt once per sitting (work.pairDeck: the pair order shuffled,
     each pair's sides a coin toss) and filed as shown_left, so position
     bias is measurable, as pair_order made it for slots in v1. Nothing is
     derived here: the scores filed are exactly the ones asked.
     ═══════════════════════════════════════════════════════════════════════ */
  var PAIR_PFX = 'pair:';
  function isPairStep(id) { return typeof id === 'string' && id.indexOf(PAIR_PFX) === 0; }
  /* THE AUDIT (owner, 2026-10-02): the pedestal card is THE instrument for
     visitors and the bench alike; these side-by-side cards stay as the
     bench's audit mode, behind an explicit flag the bench reads from its
     URL (?bench&pairs=1 → job.pairsAudit). In that mode the pedestal step
     is skipped and the six cards run, filing direct pairs and a ranking
     with no gaps. A visitor's turn never runs them. */
  function pairsAudit() { return !!(curJob && curJob.pairsAudit); }
  /* the scale, best-for-the-first first, as the taxonomy lists it; empty
     when the payload carries none — then there is no pair step at all */
  function compValues() {
    var c = tax().comparison;
    return (c && c.values && c.values.length) ? c.values : [];
  }
  /* the sitting's deal: every unordered pair of survivors once, in a
     shuffled order, each with its sides tossed. Dealt on first need and
     kept on `work`, so a repaint or a step back shows the same card. */
  function pairDeck() {
    if (!work || !pairsAudit()) return [];
    var ok = okSlots();
    if (ok.length < 2 || !compValues().length) return [];
    var sig = ok.join('');
    if (work.pairDeck && work.pairDeck.sig === sig) return work.pairDeck.list;
    var list = [];
    for (var i = 0; i < ok.length; i++) {
      for (var j = i + 1; j < ok.length; j++) {
        var flip = Math.random() < 0.5;
        list.push({ key: ok[i] + '|' + ok[j],
          left: flip ? ok[j] : ok[i], right: flip ? ok[i] : ok[j] });
      }
    }
    JD_shuffle(list);
    work.pairDeck = { sig: sig, list: list };
    return list;
  }
  function pairSteps() {
    return pairDeck().map(function (p) { return PAIR_PFX + p.key; });
  }
  function pairOf(step) {
    if (!isPairStep(step)) return null;
    var k = step.slice(PAIR_PFX.length), deck = pairDeck();
    for (var i = 0; i < deck.length; i++) if (deck[i].key === k) return deck[i];
    return null;
  }
  /* the stored (canonical) score, read from the LEFT drawing's side — the
     sign the card's own scale speaks in */
  function pairLeftScore(p) {
    var s = p && work.pairs ? work.pairs[p.key] : null;
    if (s == null) return null;
    return p.left === p.key.charAt(0) ? s : -s;
  }
  function firstOpenPair() {
    var deck = pairDeck();
    for (var i = 0; i < deck.length; i++) if (work.pairs[deck[i].key] == null) return deck[i];
    return null;
  }
  function pairsDone() { return !firstOpenPair(); }
  /* where the docket's one head-to-head node lands: the first pair still
     unanswered once the visitor has reached it, else the first card */
  function pairsEntry() {
    var deck = pairDeck();
    if (!deck.length) return null;
    var open = firstOpenPair();
    if (open && work.reached[PAIR_PFX + open.key]) return PAIR_PFX + open.key;
    return PAIR_PFX + deck[0].key;
  }
  /* the line under the scale: the chosen value's label, or — before an
     answer — the scale's own question, both from the taxonomy */
  function pairSay(leftScore) {
    var vals = compValues();
    if (leftScore != null) {
      for (var i = 0; i < vals.length; i++) {
        if (+vals[i].value === leftScore) return vals[i].label || vals[i].id;
      }
    }
    return (tax().comparison || {}).description || 'Which is better?';
  }
  function pairPanel(step, ok, tiers) {
    var p = pairOf(step), deck = pairDeck();
    if (!p) return '';
    var idx = deck.indexOf(p), chosen = pairLeftScore(p);
    var L = p.left.toUpperCase(), R = p.right.toUpperCase();
    var descId = 'jd-pd-' + p.left + p.right;
    var h = '<div class="jd-pair" data-pair="' + p.key + '">' +
      '<div class="jd-pair-side jd-pair-side--l">' +
      plate(p.left, { zoom: true, pin: true, label: 'Drawing ' + L }) + '</div>' +
      '<div class="jd-pair-scale">' +
      '<span class="jd-vh" id="' + descId + '">The first drawing is drawing ' + L +
      ', on the left (above, on a narrow screen); the second is drawing ' + R +
      '. Number keys 1 to ' + compValues().length + ' or the arrow keys choose; ' +
      'Enter goes on.</span>' +
      '<div class="jd-pair-stops" role="radiogroup" aria-label="Drawing ' + L +
      ' against drawing ' + R + '" aria-describedby="' + descId + '">' +
      '<span class="jd-pair-end jd-pair-end--l" aria-hidden="true">' +
      '<i class="jd-pair-arr"></i>' + L + '</span>';
    compValues().forEach(function (v) {
      var val = +v.value, on = chosen != null && val === chosen;
      /* roving tabindex: the chosen stop, or the middle before an answer */
      var tab = on || (chosen == null && val === 0) ? '0' : '-1';
      h += '<button type="button" class="jd-pair-stop' + (on ? ' is-on' : '') +
        '" role="radio" aria-checked="' + (on ? 'true' : 'false') + '" tabindex="' + tab +
        '" data-act="pairpick" data-score="' + val + '" data-mag="' +
        Math.min(3, Math.abs(val)) + '" aria-label="' + esc(v.label || v.id) + '" title="' +
        esc((v.label || v.id) + (v.description ? ' — ' + v.description : '')) + '">' +
        '<span class="jd-pair-dot" aria-hidden="true"></span></button>';
    });
    h += '<span class="jd-pair-end jd-pair-end--r" aria-hidden="true">' + R +
      '<i class="jd-pair-arr"></i></span></div>' +
      '<p class="jd-pair-say' + (chosen != null ? ' is-set' : '') + '" aria-live="polite">' +
      esc(pairSay(chosen)) + '</p></div>' +
      '<div class="jd-pair-side jd-pair-side--r">' +
      plate(p.right, { zoom: true, pin: true, label: 'Drawing ' + R }) + '</div></div>';
    var next = deck[idx + 1];
    var last = !next && !tiers.length;
    var acts = '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>' +
      '<button type="button" class="jd-turn-go" data-act="' + (last ? 'file' : 'next') + '"' +
      (chosen == null ? ' disabled' : '') + '>' +
      (last ? 'file the grades' : next ? 'next pair &rarr;' : 'next — size &rarr;') +
      '</button>';
    return h + (last ? suppressHTML() : '') + actions(acts);
  }
  /* an answer lands IN PLACE — no repaint, so focus stays on the stop and
     the keyboard can keep walking the scale. `leftScore` is the card's own
     sign (positive = the left drawing); it is filed canonically. */
  function pairPick(leftScore, focus) {
    var p = pairOf(work && work.step);
    if (!p) return;
    work.pairs[p.key] = p.left === p.key.charAt(0) ? leftScore : -leftScore;
    var root = bodyEl.querySelector('.jd-pair');
    if (!root) return;
    var hitEl = null;
    Array.prototype.forEach.call(root.querySelectorAll('.jd-pair-stop'), function (s) {
      var on = Number(s.getAttribute('data-score')) === leftScore;
      s.classList.toggle('is-on', on);
      s.setAttribute('aria-checked', on ? 'true' : 'false');
      s.setAttribute('tabindex', on ? '0' : '-1');
      if (on) hitEl = s;
    });
    var say = root.querySelector('.jd-pair-say');
    if (say) { say.textContent = pairSay(leftScore); say.classList.add('is-set'); }
    setDisabled('[data-act="next"], [data-act="file"]', false);
    if (focus && hitEl) { try { hitEl.focus({ preventScroll: true }); } catch (e) {} }
  }
  /* the card's keys on a pair (the select-and-go convention the bench's
     native selects already give): 1–7 pick a stop counting from the left,
     ← → walk the scale from wherever it stands (↑ ↓ too, inside the
     scale), Enter presses the card's forward button once an answer is in.
     A press on any other button keeps its own Enter. */
  function onPairKey(e) {
    if (!isOpen || confirmOn || zoom.isOn() || state !== 'rate' || !work ||
        !isPairStep(work.step)) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    var vals = compValues().map(function (v) { return +v.value; });
    var cur = pairLeftScore(pairOf(work.step));
    var k = e.key;
    if (/^[1-9]$/.test(k) && Number(k) <= vals.length) {
      e.preventDefault();
      pairPick(vals[Number(k) - 1], true);
      return;
    }
    var inScale = !!(t && t.closest && t.closest('.jd-pair-stops'));
    var dir = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1
      : (inScale && k === 'ArrowUp') ? -1 : (inScale && k === 'ArrowDown') ? 1 : 0;
    if (dir) {
      if (t && t.closest && t.closest('.jd-rail')) return;
      e.preventDefault();
      var mid = vals.indexOf(0);
      var i = cur == null ? (mid === -1 ? 0 : mid) + dir : vals.indexOf(cur) + dir;
      pairPick(vals[Math.max(0, Math.min(vals.length - 1, i))], true);
      return;
    }
    if (k === 'Enter') {
      if (t && t.closest && t.closest('button, a, [role="button"]') &&
          !t.closest('.jd-pair-stop')) return;
      e.preventDefault();
      var go = bodyEl.querySelector('.jd-turn-actions .jd-turn-go');
      if (go && !go.disabled) go.click();
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     BY HOW MUCH — THE PEDESTAL CARD (owner design, mockups/mockup-50-
     pedestal-margins.html, integrated 2026-10-02). After the podium, ONE
     card asks, one adjacent pair at a time, how much better each place is
     than the one below it; the visitor answers by ticking one of four
     words or by raising the pedestal. The answer is a GAP (0..3) on each
     place of the ranking the card already files; jd2-rate derives every
     pairwise 7-point score from it (spaced-rank-v1) — this card computes
     and sends no scores, and files `pairs: null` (one sitting, one method).
     It is THE instrument for visitors and the bench alike; the side-by-side
     cards above are the bench's ?pairs=1 audit.

     Owner rulings, as they bite below (PLAN-PEDESTAL-INTEGRATION §6):
       — HEIGHT IS THE ANSWER. Raising a pedestal lays a COURSE under it and
         under every pedestal to its left, in the margin's band colour with
         a hairline at each whole notch; each course sits at the same height
         under every pedestal it runs beneath, so the courses line up as
         strata. Height of rank r = base + Σ drawn height of every margin
         from r down. The 4th is the floor and never moves.
       — NEGLIGIBLY IS A BRASS SHIM, a different material from the stone,
         never a half block. Shims never stack: only the first negligible
         pair from the 1st side draws one; a later one draws nothing and its
         pedestals stand level. A shim always files as gap 0.
       — An UNSET margin draws flat: nothing is claimed before an answer.
       — The row's height is RESERVED as base + every OTHER margin's height
         + three notches of headroom + the print, so the floor never moves
         under a finger; it resizes only when the question moves.
       — The two pedestals in the question stay at full strength; every
         other one FADES WHOLE. "Rides along ↑" marks the pedestals an
         answer actually lifted, for ~1.1 s.
       — The gutters are CLEAR: the level line, the 1/2/3 rule and the
         ? / ≈ badges are built and positioned but switched off with one
         CSS rule (.jd-ped-pod .jd-ped-refline, …), for the owner to bring
         any of them back.
       — The labels are the taxonomy's `gaps` (labels in the ballot, `short`
         in the slips); the card never says "about the same", because the
         ranking already said which drawing is above.
     The state lives on `work`: work.gaps (slot of the HIGHER place → its
     margin; internally 0.5 = negligibly, 1..3 notches — notches() turns it
     into the filed gap at the edge, so 0.5 is never sent), work.gapAt (the
     pair being asked, 0..n−2) and work.gapSig (the podium order the gaps
     describe: if the order changes, every gap is cleared — they described
     a different order). The in-flight bits (a drag, the flashes) are `ped`.
     ═══════════════════════════════════════════════════════════════════════ */
  var PED_STOPS = [0.5, 1, 2, 3];
  var ped = { live: null, carry: null, carryT: 0, bumps: {}, drag: null };

  /* the gaps scale by filed value (0..3), from the taxonomy */
  function pedScale() {
    var g = tax().gaps, by = {};
    ((g && g.values) || []).forEach(function (v) { by[+v.value] = v; });
    return by;
  }
  /* the card runs when there is a ranking to space (two or more drawings),
     the taxonomy carries the four gap values, and this is not the audit */
  function gapsOn() {
    if (!work || pairsAudit() || okSlots().length < 2) return false;
    var by = pedScale();
    return !!(by[0] && by[1] && by[2] && by[3]);
  }
  /* WHAT THE PEDESTALS SHOW IS WHAT IS FILED: the visible notches. A shim
     ("negligibly") draws no notch, so it files 0 — never 0.5. */
  function pedNotches(v) { return v === 0.5 ? 0 : v; }
  function pedEntry(v) { return pedScale()[pedNotches(v)] || {}; }
  function pedLabel(v) { var e = pedEntry(v); return String(e.label || e.id || ''); }
  function pedPhrase(v) { return pedLabel(v).toLowerCase(); }
  function pedShort(v) { var e = pedEntry(v); return e['short'] ? String(e['short']) : pedPhrase(v); }

  function pedN() { return okSlots().length; }
  /* the podium, best first */
  function pedOrder() {
    var n = pedN(), o = [];
    for (var k = 1; k <= n; k++) o.push(podAt(k));
    return o;
  }
  function pedSig() { return callReady() ? pedOrder().join('') : ''; }
  /* the margin of pair m (place m+1 over place m+2), as stored */
  function pedGet(m) {
    var s = pedOrder()[m], v = s && work.gaps ? work.gaps[s] : null;
    return v == null ? null : v;
  }
  function pedPut(m, v) {
    var s = pedOrder()[m];
    if (!s) return;
    if (!work.gaps) work.gaps = {};
    if (v == null) delete work.gaps[s]; else work.gaps[s] = v;
  }
  /* RE-RANKING RESETS THE GAPS (the mockup's signature rule): checked
     whenever the card is entered or its answer is read, with a full podium */
  function pedSync() {
    if (!work || !callReady()) return;
    var sig = pedSig();
    if (sig !== work.gapSig) {
      work.gaps = {};
      work.gapAt = 0;
      work.gapSig = sig;
      pedPersist();
    }
    var n = pedN();
    if (!(work.gapAt >= 0 && work.gapAt <= n - 2)) work.gapAt = 0;
  }
  function pedAllSet() {
    if (!callReady()) return false;
    for (var m = 0; m < pedN() - 1; m++) if (pedGet(m) == null) return false;
    return true;
  }
  function pedFirstUnset() {
    for (var m = 0; m < pedN() - 1; m++) if (pedGet(m) == null) return m;
    return 0;
  }
  /* THE CONTRACT'S SHAPE (the mockup's JD_pedestal hooks): the answer as
     jd2-rate's ranking — [{slot, rank, gap}], gap the visible notches 0..3
     on every place but the last, null while unset (and then complete is
     false) — and the same shape back in, for back/forward, the turn's
     persistence and the bench's prefill. A gap of 0 restores as
     "negligibly" (the shim). */
  function pedAnswer() {
    var o = pedOrder(), n = o.length, ranking = [], complete = n > 1 && callReady();
    o.forEach(function (s, r) {
      if (!s) { complete = false; return; }
      var row = { slot: s, rank: r + 1 };
      if (r < n - 1) {
        var g = pedGet(r);
        row.gap = g == null ? null : pedNotches(g);
        if (g == null) complete = false;
      }
      ranking.push(row);
    });
    return { ranking: ranking, complete: complete };
  }
  function pedRestore(ranking) {
    if (!work) return false;
    var ok = okSlots(), n = ok.length;
    work.ranks = {};
    work.gaps = {};
    (ranking || []).forEach(function (row) {
      if (!row || ok.indexOf(row.slot) === -1) return;
      var r = Number(row.rank);
      if (!(r >= 1 && r <= n && r === Math.floor(r))) return;
      work.ranks[row.slot] = r;
      if (row.gap != null && r < n) {
        var g = Number(row.gap);
        if (g >= 0 && g <= 3 && g === Math.floor(g)) work.gaps[row.slot] = g === 0 ? 0.5 : g;
      }
    });
    podNormalize(ok);
    /* a gap on a slot that no longer stands above another place is dropped */
    var o = pedOrder();
    Object.keys(work.gaps).forEach(function (s) {
      var at = o.indexOf(s);
      if (at === -1 || at >= n - 1) delete work.gaps[s];
    });
    work.gapSig = pedSig();
    work.gapAt = pedFirstUnset();
    pedPersist();
    return true;
  }
  /* the filed gaps by slot (0..3, the last place absent), or null unless
     EVERY adjacent pair is answered for the podium as it stands — the
     server's rule is a gap on every place but the last, or on none */
  function pedGapsOut() {
    if (!gapsOn() || !callReady()) return null;
    pedSync();
    var o = pedOrder(), out = {};
    for (var m = 0; m < o.length - 1; m++) {
      var v = pedGet(m);
      if (v == null) return null;
      out[o[m]] = pedNotches(v);
    }
    return out;
  }
  /* THE TURN'S PERSISTENCE (v2 key jd2-turn): the turn record carries the
     card's answer in the contract's shape. Curate mode has no turn record. */
  function pedPersist() {
    if (turn && !ownerJob && work && gapsOn()) {
      turn.pedestal = pedAnswer().ranking;
      persist();
    }
  }

  /* ---- the geometry (the mockup's, verbatim in substance) ---------------- */
  function pedRoot() { return bodyEl ? bodyEl.querySelector('.jd-ped') : null; }
  function pedPx(name) {
    var root = pedRoot();
    return root ? (parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0) : 0;
  }
  /* ONE SHIM AT MOST: a negligible margin draws a shim only when no pair
     UPSTREAM of it (nearer the 1st) already has one */
  function pedUpstreamShim(m) {
    for (var q = 0; q < m; q++) if (pedValNow(q) === 0.5) return true;
    return false;
  }
  function pedHairPx(m) { return pedUpstreamShim(m) ? 0 : pedPx('--shim'); }
  /* a margin's drawn height. Unset draws flat: nothing has been claimed. */
  function pedPxOf(v, m) { return v == null ? 0 : v === 0.5 ? pedHairPx(m) : v * pedPx('--notch'); }
  function pedMpx(m) { return (ped.live && ped.live.m === m) ? ped.live.px : pedPxOf(pedGet(m), m); }
  function pedHeightAt(r) {
    var h = pedPx('--b');
    for (var m = r; m < pedN() - 1; m++) h += pedMpx(m);
    return h;
  }
  function pedSnap(p, m) {
    var n = pedPx('--notch'), c = [[0.5, pedHairPx(m)], [1, n], [2, 2 * n], [3, 3 * n]], best = c[0];
    c.forEach(function (x) { if (Math.abs(p - x[1]) < Math.abs(p - best[1])) best = x; });
    return best[0];
  }
  /* the value a live drag would land on right now, or the stored one */
  function pedValNow(m) {
    return (ped.live && ped.live.m === m) ? pedSnap(ped.live.px, ped.live.m) : pedGet(m);
  }

  /* one print, as the podium carries it (the same framed artwork, label and
     grade spark), but not the podium's handle: here a press on a print is a
     press on its pedestal — it raises it — never "enlarge" */
  function pedPrintHTML(slot) {
    var rt = work.ratings[slot];
    var spark = gaugeFor(null, JD_byRankDesc(tax().grades).length, rt ? rt.grade : null);
    if (spark) spark = '<span class="jd-pod-spark" aria-hidden="true">' + spark + '</span>';
    return '<div class="jd-ped-print" data-slot="' + slot + '" draggable="false">' +
      plate(slot, { overlay: true, spark: spark }) + '</div>';
  }
  /* the ballot's icon is the pair itself: a base block under each, and on
     the left one a SEGMENT per notch (a brass sliver for negligibly) */
  function pedPicoHTML(v) {
    var segs = '';
    if (v === 0.5) segs = '<span class="jd-ped-sg is-shim"></span>';
    else for (var i = 0; i < pedNotches(v); i++) segs += '<span class="jd-ped-sg"></span>';
    return '<span class="jd-ped-pico" aria-hidden="true"><span class="jd-ped-p">' +
      '<span class="jd-ped-bs"></span>' + segs + '</span>' +
      '<span class="jd-ped-p"><span class="jd-ped-bs"></span></span></span>';
  }

  /* THE CARD, top to bottom: the ledger of slips, the podium in rank order,
     the question (the questionnaire box), the actions. Built ONCE per
     render; from then on everything is classes, styles and the question's
     text written in place (pedLayout / pedPaint), so a drag survives and
     focus stays where the visitor put it. */
  function pedPanel(ok, tiers) {
    if (ped.drag) pedDragEnd(null);
    ped.live = null; ped.carry = null; ped.bumps = {};
    clearTimeout(ped.carryT);
    var o = pedOrder(), n = o.length, m, r;
    var h = '<div class="jd-ped" style="--pairs:' + (n - 1) + '">' +
      /* the record, ABOVE the podium: one slip per adjacent pair, positions
         only, never model letters; no "implied" line (the server derives
         the non-adjacent pairs) */
      '<div class="jd-ped-ledger">';
    for (m = 0; m < n - 1; m++) {
      h += '<button type="button" class="jd-ped-slip" data-act="gappair" data-m="' + m + '">' +
        '<span class="jd-ped-k"><i class="jd-ped-sw" aria-hidden="true"></i>' +
        POD_ORD[m] + ' › ' + POD_ORD[m + 1] + '</span>' +
        '<span class="jd-ped-w"></span></button>';
    }
    h += '</div><div class="jd-ped-pod"><div class="jd-ped-row">';
    for (r = 0; r < n; r++) {
      var floor = r === n - 1;
      h += '<div class="jd-ped-tier' + (floor ? ' is-floor' : '') + '" data-r="' + r + '"' +
        (floor ? '' : ' tabindex="0" role="slider" aria-orientation="vertical"' +
          ' aria-valuemin="0" aria-valuemax="3"') + '>' +
        '<div class="jd-ped-stand">' + pedPrintHTML(o[r]) + '</div><div class="jd-ped-block">';
      for (m = r; m < n - 1; m++) h += '<div class="jd-ped-course" data-m="' + m + '"></div>';
      h += '<div class="jd-ped-base">' + POD_ORD[r] + '</div></div>' +
        (floor ? '' : '<span class="jd-ped-carry" aria-hidden="true">rides along ↑</span>') + '</div>';
    }
    /* the switched-off gutter furniture: a badge per pair, the level line,
       the 1/2/3 rule with its marker (see the CSS switch) */
    for (m = 0; m < n - 1; m++) {
      h += '<span class="jd-ped-gmark" data-m="' + m + '" aria-hidden="true"></span>';
    }
    h += '<div class="jd-ped-refline" aria-hidden="true"></div>' +
      '<div class="jd-ped-ruler" aria-hidden="true">' +
      '<i class="jd-ped-tk" data-s="0.5"><b>≈</b></i><i class="jd-ped-tk" data-s="1"><b>1</b></i>' +
      '<i class="jd-ped-tk" data-s="2"><b>2</b></i><i class="jd-ped-tk" data-s="3"><b>3</b></i>' +
      '<span class="jd-ped-mk"></span></div></div>' +
      '<div class="jd-pod-floor" aria-hidden="true"></div></div>' +
      '<div class="jd-ped-q"></div>' +
      '<span class="jd-vh jd-ped-live" role="status" aria-live="polite"></span></div>';
    /* the button's act and words are pedPaint's: the next pair, or — on the
       last — whatever follows (the size, or the filing). This card files
       when nothing follows it, so it carries the keep-out then. */
    return h + (tiers.length ? '' : suppressHTML()) + actions(
      '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>' +
      '<button type="button" class="jd-turn-go" data-act="gapnext" disabled>next pedestal &rarr;</button>');
  }

  /* heights, positions and classes only — safe mid-drag */
  function pedLayout() {
    var root = pedRoot();
    if (!root || !work) return;
    var n = pedN(), k = work.gapAt;
    var nt = pedPx('--notch'), b = pedPx('--b'), pw = pedPx('--pw');
    var row = root.querySelector('.jd-ped-row');
    /* headroom: everything already standing, plus the full three notches
       the pair being set could still reach — independent of that pair's
       own value, so the floor never slides away from the finger */
    var reserve = 3 * nt;
    for (var q0 = 0; q0 < n - 1; q0++) if (q0 !== k) reserve += pedPxOf(pedGet(q0), q0);
    row.style.height = (b + reserve + pw + 26) + 'px';
    var tiers = row.querySelectorAll('.jd-ped-tier'), rr = row.getBoundingClientRect();
    var o = pedOrder();
    Array.prototype.forEach.call(tiers, function (t, r) {
      t.querySelector('.jd-ped-block').style.height = pedHeightAt(r) + 'px';
      t.querySelector('.jd-ped-base').style.height = b + 'px';
      t.classList.toggle('is-active', r === k);
      t.classList.toggle('is-ref', r === k + 1);
      t.classList.toggle('is-dim', r !== k && r !== k + 1);
      t.classList.toggle('is-carried', ped.carry != null && r < ped.carry);
      Array.prototype.forEach.call(t.querySelectorAll('.jd-ped-course'), function (c) {
        var m = +c.getAttribute('data-m'), below = b;
        for (var q = m + 1; q < n - 1; q++) below += pedMpx(q);
        var hpx = pedMpx(m), dragging = ped.live && ped.live.m === m;
        c.style.bottom = below + 'px';
        c.style.height = hpx + 'px';
        c.classList.toggle('is-active', m === k);
        c.classList.toggle('is-zero', hpx < 1);
        c.classList.toggle('is-shim', !dragging && pedGet(m) === 0.5 && hpx > 0);
      });
      if (r < n - 1) {
        var sv = pedGet(r);
        t.setAttribute('aria-valuenow', String(sv == null ? 0 : sv));
        t.setAttribute('aria-valuetext', sv == null ? 'not set' : pedPhrase(sv));
        t.setAttribute('aria-label', POD_ORD[r] + ', Model ' + String(o[r]).toUpperCase() +
          ', over Model ' + String(o[r + 1]).toUpperCase());
      }
    });
    /* every pair's state in its own gutter (? unset, ≈ negligibly) — built
       and placed, and switched off in the CSS */
    Array.prototype.forEach.call(root.querySelectorAll('.jd-ped-gmark'), function (gm) {
      var m = +gm.getAttribute('data-m'), A = tiers[m], B = tiers[m + 1];
      if (!A || !B) return;
      var ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect(), val = pedValNow(m);
      gm.style.left = ((ra.right + rb.left) / 2 - rr.left) + 'px';
      gm.style.bottom = (pedHeightAt(m + 1) + 14) + 'px';
      gm.className = 'jd-ped-gmark';
      if (val == null) { gm.textContent = '?'; gm.classList.add('is-unset'); }
      else if (val === 0.5) { gm.textContent = '≈'; gm.classList.add('is-hair'); }
      else { gm.textContent = ''; gm.classList.add('is-hidden'); }
      gm.setAttribute('title', val == null ? 'not set yet' : pedPhrase(val));
      if (m === k) gm.classList.add('is-hidden');   /* the ruler speaks for the active pair */
    });
    var A2 = tiers[k], B2 = tiers[k + 1];
    if (!A2 || !B2) return;
    var ra2 = A2.getBoundingClientRect(), rb2 = B2.getBoundingClientRect(), ref = pedHeightAt(k + 1);
    var ruler = root.querySelector('.jd-ped-ruler'), line = root.querySelector('.jd-ped-refline');
    ruler.style.left = (ra2.right - rr.left) + 'px';
    ruler.style.width = (rb2.left - ra2.right) + 'px';
    ruler.style.bottom = ref + 'px';
    ruler.style.height = (3 * nt) + 'px';
    var cur = pedValNow(k);
    Array.prototype.forEach.call(ruler.querySelectorAll('.jd-ped-tk'), function (tk) {
      var s = +tk.getAttribute('data-s');
      tk.style.bottom = pedPxOf(s, k) + 'px';
      tk.classList.toggle('is-on', cur === s);
    });
    var mk = ruler.querySelector('.jd-ped-mk');
    mk.style.bottom = pedMpx(k) + 'px';
    mk.classList.toggle('is-unset', cur == null);
    line.style.left = (ra2.left - rr.left) + 'px';
    line.style.width = (rb2.left - ra2.left + 6) + 'px';
    line.style.bottom = ref + 'px';
  }

  /* the slips: positions, the band swatch, the answer in the pencil hand
     (or a faint "not yet"); the asked pair's slip wears the graphite */
  function pedLedger() {
    var root = pedRoot();
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('.jd-ped-slip'), function (sl) {
      var m = +sl.getAttribute('data-m'), val = pedValNow(m);
      sl.classList.toggle('is-on', m === work.gapAt);
      sl.classList.toggle('is-unset', val == null);
      sl.classList.toggle('is-bump', !!ped.bumps['m' + m]);
      if (m === work.gapAt) sl.setAttribute('aria-current', 'true');
      else sl.removeAttribute('aria-current');
      var w = val == null ? 'not yet' : (val === 0.5 ? '≈ ' : '') + pedShort(val);
      var wEl = sl.querySelector('.jd-ped-w');
      if (wEl.textContent !== w) wEl.textContent = w;
      sl.setAttribute('aria-label', POD_ORD[m] + ' over ' + POD_ORD[m + 1] + ': ' +
        (val == null ? 'not answered yet' : pedPhrase(val)));
    });
  }
  /* THE QUESTION (the questionnaire): the card asks, and stays asking. The
     ranking already said which is better, so it says so back and asks only
     how MUCH; the answer is the ticked box plus the raised pedestal. Its
     words are rewritten only when the question moves; the ballot's ticks
     follow the LIVE value, so they track a dragged pedestal before release. */
  function pedQuestion() {
    var root = pedRoot(), q = root && root.querySelector('.jd-ped-q');
    if (!q) return;
    var o = pedOrder(), n = o.length, k = work.gapAt;
    var key = k + ':' + o.join('');
    if (q.getAttribute('data-k') !== key) {
      q.setAttribute('data-k', key);
      q.innerHTML = '<span class="jd-ped-q-tab">Question ' + (k + 1) + ' of ' + (n - 1) + '</span>' +
        /* the two model names in bold (owner, 2026-10-01) */
        '<p class="jd-ped-q-said">You’ve indicated that <b>Model ' + String(o[k]).toUpperCase() +
        '</b> is better than <b>Model ' + String(o[k + 1]).toUpperCase() + '</b>.</p>' +
        '<p class="jd-ped-q-ask">How <em>much</em> better is it?</p>' +
        '<div class="jd-ped-q-opts" role="group" aria-label="How much better">' +
        PED_STOPS.map(function (v) {
          return '<button type="button" class="jd-ped-qo" data-act="gapstop" data-gap="' + v +
            '" aria-pressed="false">' + pedPicoHTML(v) +
            '<span class="jd-ped-qo-l">' + esc(pedLabel(v)) + '</span>' +
            '<span class="jd-ped-qo-box" aria-hidden="true"></span></button>';
        }).join('') + '</div>';
    }
    var cur = pedValNow(k);
    Array.prototype.forEach.call(q.querySelectorAll('.jd-ped-qo'), function (bt) {
      var on = Number(bt.getAttribute('data-gap')) === cur;
      if (bt.getAttribute('aria-pressed') !== String(on)) bt.setAttribute('aria-pressed', String(on));
      var box = bt.querySelector('.jd-ped-qo-box');
      var mark = on ? '<i>✓</i>' : '';
      if (box.innerHTML !== mark) box.innerHTML = mark;
    });
  }
  /* the slips, the question and the buttons. Gating as the mockup's: each
     pair's NEXT waits for that pair's answer; the last pair's button hands
     on to the size (or files) and waits for every answer; BACK on the
     first pair returns to the podium, and back is always allowed. */
  function pedPaint() {
    if (!pedRoot()) return;
    pedLedger();
    pedQuestion();
    var n = pedN(), k = work.gapAt, last = k >= n - 2, sized = sizeTiers().length > 0;
    var go = bodyEl.querySelector('.jd-turn-actions .jd-turn-go');
    var back = bodyEl.querySelector('.jd-turn-actions .jd-turn-alt');
    if (go) {
      go.setAttribute('data-act', last ? (sized ? 'next' : 'file') : 'gapnext');
      go.disabled = last ? !pedAllSet() : pedGet(k) == null;
      var words = last ? (sized ? 'next — size &rarr;' : 'file the grades') : 'next pedestal &rarr;';
      if (go.getAttribute('data-words') !== words) {
        go.setAttribute('data-words', words);
        go.innerHTML = words;
      }
    }
    if (back) back.setAttribute('data-act', k > 0 ? 'gapback' : 'back');
  }
  /* the card's first measure, after paint (render() calls it) */
  function pedMount() {
    if (!pedRoot()) return;
    pedLayout();
    pedPaint();
  }
  function pedSay(msg) {
    var root = pedRoot(), live = root && root.querySelector('.jd-ped-live');
    if (live) live.textContent = msg || '';
  }
  function pedSayAnswer(m) {
    var o = pedOrder(), v = pedGet(m);
    if (v == null) return;
    pedSay('Model ' + String(o[m]).toUpperCase() + ' ' + pedPhrase(v) +
      ' than Model ' + String(o[m + 1]).toUpperCase());
  }

  /* what changed: the slips that flash, and the pedestals that ride along
     — only when the drawn height really moved (an unshimmed "negligibly"
     lifts nothing) */
  function pedSnapshot() {
    var o = {};
    for (var m = 0; m < pedN() - 1; m++) o['m' + m] = pedValNow(m);
    return o;
  }
  function pedFlash(before, m) {
    var after = pedSnapshot();
    ped.bumps = {};
    Object.keys(after).forEach(function (key) { if (after[key] !== before[key]) ped.bumps[key] = true; });
    ped.carry = (m > 0 && pedPxOf(before['m' + m], m) !== pedPxOf(after['m' + m], m)) ? m : null;
    clearTimeout(ped.carryT);
    ped.carryT = setTimeout(function () {
      ped.bumps = {}; ped.carry = null;
      if (pedRoot() && work) { pedLayout(); pedLedger(); }
    }, 1100);
  }
  function pedSetGap(m, val) {
    var before = pedSnapshot();
    pedPut(m, val);
    pedFlash(before, m);
    pedLayout();
    pedPaint();
    pedPersist();
    pedSayAnswer(m);
  }
  function pedSetActive(m) {
    var n = pedN();
    if (!(m >= 0 && m <= n - 2)) return;
    work.gapAt = m;
    pedLayout();
    pedPaint();
  }

  /* ---- the lift: drag a pedestal (print or block) up or down -------------
     TOUCH GRIPS AT ONCE (2026-10-02): the pedestals are touch-action:none
     and a press starts the lift immediately, the live podium's and the
     drawer's own convention (jd-core: the ~180ms hold-to-grip was retired,
     G5 revision 3, 2026-07-26, once ink owned the gesture). On the 100svh
     card the page still scrolls from the slips, the question box and the
     margins around the row. Like the podium's drag it lives on the WINDOW
     (capture phase, filtered by pointerId), and nothing re-renders a
     pedestal while it is in the hand: only styles and classes change. At
     least 26px of travel per notch on phones; it snaps to the nearest drawn
     stop (shim, 1, 2, 3) on release. */
  function pedDown(e) {
    if (ped.drag || !work || !bodyEl || !isOpen || confirmOn || zoom.isOn()) return;
    if (e.button !== undefined && e.button > 0) return;
    var t = (e.target && e.target.closest) ? e.target.closest('.jd-ped-tier') : null;
    if (!t || !bodyEl.contains(t)) return;
    var r = +t.getAttribute('data-r');
    if (r >= pedN() - 1) return;
    e.preventDefault();
    try { t.focus({ preventScroll: true }); } catch (err) {}
    if (work.gapAt !== r) pedSetActive(r);
    ped.drag = { m: r, y0: e.clientY, p0: pedMpx(r), id: e.pointerId, moved: false, el: t,
      before: pedSnapshot() };
    try { t.setPointerCapture(e.pointerId); } catch (err) {}
    window.addEventListener('pointermove', pedMove, true);
    window.addEventListener('pointerup', pedUp, true);
    window.addEventListener('pointercancel', pedUp, true);
    window.addEventListener('blur', pedBlur);
  }
  function pedMove(e) {
    var d = ped.drag;
    if (!d || e.pointerId !== d.id) return;
    var dy = d.y0 - e.clientY;
    if (!d.moved && Math.abs(dy) < 4) return;
    if (!d.moved) {
      d.moved = true;
      var root = pedRoot();
      if (root) root.classList.add('is-drag');
      document.body.classList.add('jd-ped-drag');
    }
    var nt = pedPx('--notch'), gain = nt / Math.max(nt, 26);
    ped.live = { m: d.m, px: Math.max(0, Math.min(3 * nt, d.p0 + dy * gain)) };
    ped.carry = d.m > 0 ? d.m : null;
    pedLayout(); pedLedger(); pedQuestion();
    if (e.cancelable) e.preventDefault();
  }
  /* every exit runs through here; `e` null = a repaint or a blur took it */
  function pedDragEnd(e) {
    var d = ped.drag;
    if (!d) return;
    ped.drag = null;
    window.removeEventListener('pointermove', pedMove, true);
    window.removeEventListener('pointerup', pedUp, true);
    window.removeEventListener('pointercancel', pedUp, true);
    window.removeEventListener('blur', pedBlur);
    try { d.el.releasePointerCapture(d.id); } catch (err) {}
    var root = pedRoot();
    if (root) root.classList.remove('is-drag');
    document.body.classList.remove('jd-ped-drag');
    if (d.moved && ped.live && e && e.type === 'pointerup') {
      var val = pedSnap(ped.live.px, ped.live.m);
      ped.live = null;
      pedPut(d.m, val);
      pedFlash(d.before, d.m);
      pedLayout(); pedPaint();
      pedPersist();
      pedSayAnswer(d.m);
    } else {
      ped.live = null; ped.carry = null;
      if (root) { pedLayout(); pedPaint(); }
    }
  }
  function pedUp(e) {
    if (!ped.drag || (e.pointerId !== undefined && e.pointerId !== ped.drag.id)) return;
    pedDragEnd(e);
  }
  function pedBlur() { pedDragEnd(null); }
  window.addEventListener('pointerdown', pedDown, true);
  window.addEventListener('resize', function () {
    if (!pedRoot()) return;
    cancelAnimationFrame(ped.rz);
    ped.rz = requestAnimationFrame(function () { if (pedRoot() && work) pedLayout(); });
  });
  /* ↑/↓ (and →/←) on a focused pedestal: from unset, ↓ says "negligibly"
     and ↑ says "slightly"; then one stop per press */
  function onPedKey(e) {
    if (!isOpen || confirmOn || zoom.isOn() || state !== 'rate' || !work || work.step !== 'gaps') return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('jd-ped-tier')) return;
    var r = +t.getAttribute('data-r');
    if (r >= pedN() - 1) return;
    var up = e.key === 'ArrowUp' || e.key === 'ArrowRight';
    var dn = e.key === 'ArrowDown' || e.key === 'ArrowLeft';
    if (!up && !dn) return;
    e.preventDefault();
    work.gapAt = r;
    var cur = pedGet(r);
    var i = cur == null ? (up ? 1 : 0) : PED_STOPS.indexOf(cur) + (up ? 1 : -1);
    pedSetGap(r, PED_STOPS[Math.max(0, Math.min(PED_STOPS.length - 1, i))]);
  }
  /* focusing a pedestal makes its pair the question */
  function onPedFocus(e) {
    if (!isOpen || state !== 'rate' || !work || work.step !== 'gaps' || ped.drag) return;
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('jd-ped-tier')) return;
    var r = +t.getAttribute('data-r');
    if (r < pedN() - 1 && r !== work.gapAt) pedSetActive(r);
  }

  /* §4 the bench, §5 the call. Neither carries an instruction line: they are
     the two cards where the visitor is working, so they are the two with the
     least to read. The heading names the drawing on the bench, the rail says
     where in the steps it sits, and each row's own label (with its
     press-to-open definition) carries the rest. */
  /* ---------- 5b. HOW BIG IS IT — the bench's closing card ------------------
     (owner, 2026-08-30.) The one curatorial judgment the rubric never asked
     for: how large the object reads in the drawer, on the five-tier scale
     the taxonomy has always carried. It closes a CURATION only — a visitor's
     won item is filed at the fixed visitor tier (C5.3) and never sees this.
     The tiers render from the queue's size_tiers, so the scale stays data.
     A tier already on file (the entry's own, or one the bench filed earlier)
     arrives selected. Filing is gated on a choice: the drawer's sizes are
     the owner's, and a silent default would put a size in the collection
     nobody chose (the standing rule in CLAUDE.md's filing procedure).
     SINCE 0.13.0 the bench closes on THE CATALOGUE ENTRY instead (below),
     which carries this same chooser among the heading and the headings; the
     plain size card is now only a visitor's, when intake failed. */
  /* THE SCALE, wherever the card is standing (owner, 2026-08-30): a
     curation reads the tiers the bench handed it; a visitor's turn reads
     the same five straight out of the taxonomy the payload already carries.
     Every turn now closes on the size, because every finished turn now goes
     into the drawer and the drawer needs to know how big it reads. */
  function sizeTiers() {
    if (curJob) return curJob.sizeTiers || [];
    /* a visitor's turn the intake clerk sized has no size step — unless the
       visitor already stood on it before the answer landed (then it stays,
       and their pick is filed as theirs) */
    if (work && work.modelSize && !work.reached.size) return [];
    return (tax().sizeTiers || []).map(function (t) {
      return { id: t.id, label: t.label || t.id,
               description: t.description || '', box: t.box };
    });
  }

  /* the five tiers alone — the size card's chooser, and the catalogue
     entry's (0.13.0) */
  function sizeTiersHTML(tiers) {
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
    return h + '</div>';
  }
  function sizePanel(tiers) {
    var chosen = work.size || null;
    var h = sizeTiersHTML(tiers);
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
      suppressHTML() + sittingNoteHTML() +
      actions(
      '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>' +
      '<button type="button" class="jd-turn-go" data-act="file"' +
      (chosen ? '' : ' disabled') + '>' +
      (chosen ? 'file the grades' : 'choose a size first') + '</button>');
  }

  /* NOTES FOR THE RECORD (owner, Phase 4b): the sitting's rationale, on the
     size card that closes a curation — ONLY in curate mode, and only for a
     job that asks for it (the bench; the /about/ walkthrough does not). It
     files as jd2_sessions.note. Typed in place (onInput), never repainted. */
  function sittingNoteHTML() {
    if (!curJob || !curJob.withNote) return '';
    return '<label class="jd-size-hint" style="display:block;margin-top:var(--sp-2)">' +
      'notes for the record' +
      '<textarea class="jd-turn-note" data-role="sitting-note" rows="3" maxlength="' +
      MAX_SITTING_NOTE + '" placeholder="why this sitting reads the way it does (optional)">' +
      esc((work && work.note) || '') + '</textarea></label>';
  }

  /* ---------- THE CATALOGUE ENTRY (0.13.0, owner 2026-10-02) ---------------
     On the BENCH the closing card is the catalogue entry: what the intake
     clerk (api/jd2-intake.php) filed for this prompt, every part of it
     correctable before the sitting files —
       — THE HEADING, the prompt's title, in a text field (the inverted
         catalogue form "Noun (kind), descriptor, descriptor" is expected,
         never enforced);
       — THE SIZE, on the same five-tier chooser the size card always had,
         pre-selected on the tier on file;
       — THE HEADINGS under each facet (subject / treatment / probe), as
         chips: a tap files or unfiles one, inside the facet's min..max (the
         last subject cannot come off); each heading's SCOPE NOTE is its
         tooltip and its long-press text — the scope notes double as app copy
         here (the owner's pin) — and shows in the line under its facet;
       — the clerk's one-line REASONS as small print, and the intake's
         version and model as a footnote ("intake failed" when it fell back);
       — the "notes for the record", as before.
     Only a curation whose job carries `catalogue` (jd-bench.js) gets it; a
     visitor never does (their size card shows only when intake failed, and
     it is the plain size card), nor does the /about/ walkthrough. The step's
     id stays 'size' everywhere inside this file — the rail station, the
     gate and the resume all key on it.
     WHAT FILES: only what the owner changed. curateFile hands the job's
     file() a fifth argument, the entry — {title, size, size_pressed, tags,
     tags_touched} — and the bench sends jd2-curate the fields that differ
     from what is on file. The size rule (owner's, decided here): pressing a
     tier — even the clerk's own, pre-selected one — makes the size the
     OWNER's (size_by 'owner'); filing without pressing leaves the size as it
     stands (the clerk's stays size_by 'model'). */
  function catalogueOn() { return !!(curJob && curJob.catalogue); }
  function catFacets() { return (curJob && curJob.catalogue && curJob.catalogue.facets) || []; }
  /* a scope note as the card prints it: the taxonomy's *see-also* asterisks
     become italics (escaped first), or are dropped for a title attribute */
  function scopeHTML(text) {
    return esc(String(text || '')).replace(/\*([^*]+)\*/g, '<i>$1</i>');
  }
  function scopePlain(text) { return String(text || '').replace(/\*([^*]+)\*/g, '$1'); }
  /* the working entry, from the job's catalogue: every facet present (an
     empty list where nothing is filed), the heading as filed */
  function catBlank(c) {
    var tags = {};
    var onFile = c.tags && typeof c.tags === 'object' ? c.tags : null;
    catFacets().forEach(function (f) {
      var live = f.headings.map(function (h) { return h.id; });
      tags[f.id] = ((onFile && onFile[f.id]) || []).filter(function (id) {
        return live.indexOf(id) !== -1;
      });
    });
    return {
      title: c.title_on_file ? String(c.title_on_file) : '',
      tags: tags, tagsTouched: false, sizePressed: false
    };
  }
  function catFacet(fid) {
    var fs = catFacets();
    for (var i = 0; i < fs.length; i++) if (fs[i].id === fid) return fs[i];
    return null;
  }
  function catHeading(f, hid) {
    for (var i = 0; i < f.headings.length; i++) if (f.headings[i].id === hid) return f.headings[i];
    return null;
  }
  function catBounds(f) {
    return f.min === f.max ? String(f.min) : f.min + '–' + f.max;
  }
  /* why a chip will not move, or '' when it will */
  function catLock(f, hid) {
    var on = work.entry.tags[f.id] || [];
    var isOn = on.indexOf(hid) !== -1;
    if (isOn && on.length <= f.min) {
      return f.label + ' needs at least ' + f.min + ' heading' + (f.min === 1 ? '' : 's');
    }
    if (!isOn && on.length >= f.max) {
      return f.label + ' takes at most ' + f.max + ' heading' + (f.max === 1 ? '' : 's');
    }
    return '';
  }
  /* the classification's own gate: only a classification the owner touched
     is filed, and it must sit inside every facet's bounds (a failed intake
     starts with nothing, so a treatment tapped on first leaves subject
     short until a subject is chosen too) */
  function catProblem() {
    if (!work.entry || !work.entry.tagsTouched) return '';
    var fs = catFacets();
    for (var i = 0; i < fs.length; i++) {
      var n = (work.entry.tags[fs[i].id] || []).length;
      if (n < fs[i].min || n > fs[i].max) {
        return fs[i].label.toLowerCase() + ' takes ' + catBounds(fs[i]) + ' heading' +
          (fs[i].max === 1 ? '' : 's');
      }
    }
    return '';
  }
  function catFileWord() {
    if (!work.size) return 'choose a size first';
    var why = catProblem();
    return why ? why + ' first' : 'file the grades';
  }
  function catChipHTML(f, hd) {
    var on = (work.entry.tags[f.id] || []).indexOf(hd.id) !== -1;
    var lock = catLock(f, hd.id);
    return '<button type="button" class="jd-cat-chip' + (on ? ' is-on' : '') +
      (lock ? ' is-locked' : '') + '" data-act="tag" data-facet="' + esc(f.id) +
      '" data-heading="' + esc(hd.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '"' +
      (lock ? ' aria-disabled="true"' : '') +
      ' title="' + esc(hd.label + ' — ' + scopePlain(hd.scope)) + '">' + esc(hd.label) + '</button>';
  }
  /* the size's standing in words: whose tier is on file, or that pressing
     one makes it the owner's */
  function catSizeWho() {
    var c = curJob.catalogue;
    if (!work.size) return '';
    if (work.entry.sizePressed) return 'yours — it files as the owner’s size';
    var by = c.size_by;
    if (by === 'owner') return 'on file: yours';
    if (by === 'model') return 'on file: the clerk’s — press a tier to make it yours; left alone, it stays the clerk’s';
    if (by === 'visitor') return 'on file: the visitor’s — press a tier to make it yours';
    return 'on file — press a tier to make it yours';
  }
  function catFootHTML() {
    var c = curJob.catalogue;
    if (c.fallback) {
      return 'intake failed' + (c.intake_error ? ' (' + esc(c.intake_error) + ')' : '') +
        ' — the clerk filed nothing; the entry is yours to make';
    }
    if (!c.intake_at) return 'not catalogued — the intake clerk has not filed this prompt';
    return 'catalogued by the intake clerk · ' + esc(c.intake_version || '?') + ' · ' +
      esc(c.intake_model || '?') + ' · ' + esc(String(c.intake_at).slice(0, 10));
  }
  function catWhyHTML(text) {
    if (!text) return '';
    return '<p class="jd-cat-why"><span>the clerk’s reason</span> ' + esc(text) + '</p>';
  }
  function entryPanel(tiers) {
    var c = curJob.catalogue, e = work.entry;
    var reasons = c.reasons || {};
    var h = '<div class="jd-cat">';
    /* THE HEADING */
    h += '<div class="jd-cat-sec"><label class="jd-cat-label" for="jd-cat-title">heading</label>' +
      '<div class="jd-cat-body">' +
      '<input type="text" id="jd-cat-title" class="jd-cat-title" data-role="entry-title" maxlength="80" ' +
      'autocomplete="off" spellcheck="true" value="' + esc(e.title) + '" ' +
      'placeholder="Noun (kind), descriptor, descriptor">' +
      '<p class="jd-cat-small">' + (c.title_on_file
        ? 'inverted, as a card catalogue files it: Noun (kind), descriptor, descriptor'
        : 'no heading on file — the drawer shows the prompt’s first words until one is') +
      '</p></div></div>';
    /* THE SIZE — the size card's own chooser */
    h += '<div class="jd-cat-sec"><span class="jd-cat-label">size</span><div class="jd-cat-body">' +
      sizeTiersHTML(tiers) +
      '<p class="jd-cat-small" data-role="size-who">' + (work.size ? esc(catSizeWho())
        : 'no size on file — pick one to file this item; it sets how big the object reads in the drawer') +
      '</p>' + catWhyHTML(reasons.size) + '</div></div>';
    /* THE HEADINGS, facet by facet */
    h += '<div class="jd-cat-sec jd-cat-sec--tags"><span class="jd-cat-label">headings</span><div class="jd-cat-body">';
    catFacets().forEach(function (f) {
      h += '<div class="jd-cat-facet" data-facet="' + esc(f.id) + '">' +
        '<div class="jd-cat-fhead"><b>' + esc(f.label) + '</b>' +
        '<span class="jd-cat-bounds">' + esc(catBounds(f)) + '</span></div>' +
        '<div class="jd-cat-chips" role="group" aria-label="' + esc(f.label + ': ' + f.question) + '">';
      f.headings.forEach(function (hd) { h += catChipHTML(f, hd); });
      h += '</div><p class="jd-cat-scope" data-scope-for="' + esc(f.id) + '" aria-live="polite">' +
        esc(f.question) + '</p></div>';
    });
    h += catWhyHTML(reasons.classification) + '</div></div>';
    h += '</div>';
    var ready = !!work.size && !catProblem();
    return h + sittingNoteHTML() +
      '<p class="jd-cat-foot' + (c.fallback ? ' is-failed' : '') + '">' + catFootHTML() + '</p>' +
      actions(
        '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>' +
        '<button type="button" class="jd-turn-go" data-act="file"' +
        (ready ? '' : ' disabled') + '>' + esc(catFileWord()) + '</button>');
  }
  /* after any answer on the card, in place (no repaint — the title field
     and the note keep their caret, the sheet its scroll): every chip's lock,
     the size's words, the file button's gate and wording */
  function catRefresh() {
    if (!bodyEl || !work || !work.entry) return;
    Array.prototype.forEach.call(bodyEl.querySelectorAll('.jd-cat-chip'), function (b) {
      var f = catFacet(b.getAttribute('data-facet'));
      if (!f) return;
      var hid = b.getAttribute('data-heading');
      var on = (work.entry.tags[f.id] || []).indexOf(hid) !== -1;
      var lock = catLock(f, hid);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-locked', !!lock);
      if (lock) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
    });
    var who = bodyEl.querySelector('[data-role="size-who"]');
    if (who && work.size) who.textContent = catSizeWho();
    var go = bodyEl.querySelector('[data-act="file"]');
    if (go) {
      go.disabled = !(work.size && !catProblem());
      go.textContent = catFileWord();
    }
  }
  /* a chip's press: file or unfile the heading, unless the facet's bounds
     forbid it — then the line under the facet says why */
  function catToggle(b) {
    var f = catFacet(b.getAttribute('data-facet'));
    if (!f || !work.entry) return;
    var hid = b.getAttribute('data-heading');
    var lock = catLock(f, hid);
    if (lock) { catScope(f.id, null, lock); return; }
    var list = work.entry.tags[f.id] || (work.entry.tags[f.id] = []);
    var at = list.indexOf(hid);
    if (at !== -1) list.splice(at, 1);
    else {
      list.push(hid);
      /* kept in the taxonomy's order, as the ledger and the clerk list them */
      var order = f.headings.map(function (x) { return x.id; });
      list.sort(function (x, y) { return order.indexOf(x) - order.indexOf(y); });
    }
    work.entry.tagsTouched = true;
    catRefresh();
    catScope(f.id, hid);
  }
  /* the line under a facet: a heading's scope note, a refusal, or (with
     neither) the facet's own question */
  function catScope(fid, hid, said) {
    var line = bodyEl && bodyEl.querySelector('.jd-cat-scope[data-scope-for="' + fid + '"]');
    var f = catFacet(fid);
    if (!line || !f) return;
    var hd = hid ? catHeading(f, hid) : null;
    line.classList.toggle('is-said', !!said);
    line.innerHTML = said ? esc(said)
      : hd ? '<b>' + esc(hd.label) + '</b> — ' + scopeHTML(hd.scope)
      : esc(f.question);
  }
  /* THE SCOPE NOTE ON DEMAND: pointing at a chip (mouse) or focusing it
     (keyboard) shows its note under the facet; on a touch screen a LONG
     PRESS (~450ms, held still) shows it without filing anything — the press
     that follows the hold is swallowed. The listeners sit on the card body
     once (build) and do nothing off the catalogue card. */
  var catHold = { t: 0, x: 0, y: 0, ate: false };
  function catChipOf(e) {
    return e.target && e.target.closest ? e.target.closest('.jd-cat-chip') : null;
  }
  function catOver(e) {
    var b = catChipOf(e);
    if (b) catScope(b.getAttribute('data-facet'), b.getAttribute('data-heading'));
  }
  function catOut(e) {
    /* a touch's pointerout follows its lift: the note stays up for reading */
    if (e.pointerType === 'touch') return;
    var b = catChipOf(e);
    if (!b) return;
    var to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('.jd-cat-chip') : null;
    if (to && to.getAttribute('data-facet') === b.getAttribute('data-facet')) return;
    catScope(b.getAttribute('data-facet'), null);
  }
  function catDown(e) {
    var b = catChipOf(e);
    clearTimeout(catHold.t);
    catHold.ate = false;
    if (!b || e.pointerType === 'mouse') return;
    catHold.x = e.clientX; catHold.y = e.clientY;
    catHold.t = setTimeout(function () {
      catHold.ate = true;
      catScope(b.getAttribute('data-facet'), b.getAttribute('data-heading'));
    }, 450);
  }
  function catMove(e) {
    if (!catHold.t) return;
    if (Math.abs(e.clientX - catHold.x) > 8 || Math.abs(e.clientY - catHold.y) > 8) {
      clearTimeout(catHold.t); catHold.t = 0;
    }
  }
  function catUp() { clearTimeout(catHold.t); catHold.t = 0; }

  function viewRate() {
    var ok = okSlots();
    /* the scale is read once per render and handed down: the rail, the
       panel and its buttons all ask the same question of it */
    var tiers = sizeTiers(), sizes = tiers.length;
    /* a restored or degraded turn may hold a step that no longer exists */
    if (isPairStep(work.step) && !pairOf(work.step)) work.step = ok.length > 1 ? 'call' : ok[0];
    /* the pedestal card spaces a FULL podium: reached by the rail with a
       place left empty, it is the podium that comes up */
    if (work.step === 'gaps' && !gapsOn()) work.step = ok.length > 1 ? 'call' : ok[0];
    if (work.step === 'gaps' && !callReady()) work.step = 'call';
    if (work.step !== 'call' && work.step !== 'size' && work.step !== 'gaps' &&
        !isPairStep(work.step) && ok.indexOf(work.step) === -1) {
      work.step = ok[0];
    }
    if (work.step === 'call' && ok.length < 2) work.step = sizes ? 'size' : ok[0];
    if (work.step === 'size' && !sizes) work.step = ok.length > 1 ? 'call' : ok[0];
    work.reached[work.step] = true;
    var two = ok.length > 1;
    var call = work.step === 'call', size = work.step === 'size';
    var gaps = work.step === 'gaps';
    var pair = isPairStep(work.step);
    var deck = pair ? pairDeck() : null;
    /* entering the pedestal card: a podium re-ranked since the gaps were
       answered clears them (they described a different order) */
    if (gaps) pedSync();
    /* the closing card: the catalogue entry on the bench, the size card
       everywhere else (a visitor whose intake failed) */
    var entry = size && catalogueOn() && !!work.entry;
    return head(entry ? 'The catalogue entry' : size ? 'How big is it' : call ? 'Best to worst'
        : gaps ? 'By how much'
        : pair ? 'Head to head · ' + (deck.indexOf(pairOf(work.step)) + 1) + ' of ' + deck.length
        : 'Grade drawing ' + work.step.toUpperCase(),
      size ? 6 : (call || gaps || pair) ? 5 : 4,
      { view: entry ? 'entry' : size ? 'size' : call ? 'call' : gaps ? 'gaps' : pair ? 'pair' : 'bench' }) +
      (two || sizes ? railHTML(ok, tiers) : '') +
      (entry ? entryPanel(tiers) : size ? sizePanel(tiers) : call ? callPanel(ok, tiers)
        : gaps ? pedPanel(ok, tiers)
        : pair ? pairPanel(work.step, ok, tiers) : benchPanel(work.step, ok, tiers));
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
  /* THE HEAD TO HEAD, SAID (dataset v2, 2026-10-01): under the podium, each
     drawing's result in the pairs the visitor just answered, in plain words
     and in place order — "preferred over 2 of 3", with any level calls
     named. Counted from the session's own direct scores (work.pairs);
     nothing is derived, and a sitting with no pairs prints nothing. */
  function h2hHTML(ok) {
    var deck = pairDeck();
    if (ok.length < 2 || !deck.length) return '';
    var rows = [];
    for (var k = 1; k <= ok.length; k++) {
      var s = podAt(k);
      if (!s) continue;
      var won = 0, level = 0, of = 0;
      deck.forEach(function (p) {
        var v = work.pairs[p.key];
        if (v == null || p.key.indexOf(s) === -1) return;
        of++;
        var mine = p.key.charAt(0) === s ? v : -v;
        if (mine > 0) won++; else if (mine === 0) level++;
      });
      if (!of) continue;
      var r = revealFor(s);
      rows.push('<li><b>' + esc((r && (r.label || r.model_id)) || ('Model ' + s.toUpperCase())) +
        '</b> preferred over ' + won + ' of ' + of +
        (level ? ', level with ' + level : '') + '</li>');
    }
    return rows.length
      ? '<ul class="jd-pod-h2h" aria-label="head to head">' + rows.join('') + '</ul>' : '';
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
    h += steps + h2hHTML(ok);
    /* the ones that never arrived: named, not staged */
    var lost = (work.reveal || []).filter(function (x) {
      return x.status && x.status !== 'ok';
    }).map(function (x) {
      return esc(x.label || x.model_id || 'a machine') + ' — didn’t survive';
    });
    if (lost.length) {
      h += '<p class="jd-turn-line jd-pod-lost">' + lost.join('<br>') + '</p>';
    }
    if (curJob) {
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
      /* an owner's run is retried from the bench strip (rerun), never from
         the visitor's brief this button would open */
      actions((ownerJob ? '' : '<button type="button" class="jd-turn-go" data-act="again">try again</button>') +
        '<button type="button" class="jd-turn-alt" data-act="done">close</button>');
  }

  /* THE MASTHEAD. Every card is FORM JD-1; what changes is the heading (the
     section number, §1 brief → §6 unveil, is still declared at every call
     but neither printed nor kept — see headHTML). head() declares the next
     paint's masthead and contributes NOTHING to the body string — it
     returns '' so the views can go on reading as one concatenation.

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
    pendingHead = {
      title: t, noFocus: !!opts.noFocus,
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
    var levels = JD_byRankDesc(ax ? ax.values : tax().grades);
    var html = gaugeFor(ax, levels.length, val == null ? null : Number(val), true);
    if (html) ctrl.insertAdjacentHTML('afterbegin', html);
  }
  function onChange(e) {
    var t = e.target, role = t.getAttribute && t.getAttribute('data-role');
    if (!role) return;
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
      paintGauge(t, byId(JD_liveAxes(tax()), t.getAttribute('data-axis')), val);
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
    } else if (role === 'sitting-note') {
      if (work) work.note = t.value.slice(0, MAX_SITTING_NOTE);
    } else if (role === 'entry-title') {
      /* the catalogue entry's heading, typed in place (never repainted) */
      if (work && work.entry) work.entry.title = t.value.slice(0, 80);
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
    if (!e.target.closest) return;   /* nothing below could match */
    var pp = e.target.closest('.jd-pod-print');
    if (pp) {
      /* on the unveil the press never reached podDown, so the click is the
         press — and on that card a drawing can only get bigger */
      if (pp.closest('.jd-pod--said')) openZoom(pp);
      return;
    }
    /* the filed podium arms nothing */
    if (e.target.closest('.jd-pod--said')) return;
    var pt = e.target.closest('.jd-pod-tier');
    if (pt) { podArm(Number(pt.getAttribute('data-rank'))); return; }
    var ptr = e.target.closest('.jd-pod-tray');
    if (ptr) { podArm(0); return; }
    var b = e.target.closest('[data-act]');
    if (!b || b.disabled) {
      /* not an action press — the bench/call plate itself is the enlarge
         control (the reveal's plates carry no role and fall through) */
      var p = e.target.closest('.jd-turn-plate');
      if (p && p.getAttribute('role') === 'button') openZoom(p);
      return;
    }
    var act = b.getAttribute('data-act');
    if (act === 'tag') {
      /* a catalogue chip: a long press showed its scope note and files
         nothing — the click that trails the hold is swallowed */
      if (catHold.ate) { catHold.ate = false; return; }
      catToggle(b);
      return;
    }
    if (act === 'generate') {
      /* the acknowledgment is recorded at the moment the words are sent —
         the disclosure sits right on this card (the gating consent card
         retired 2026-08-14, owner call) */
      recordConsent();
      startTurn();
    } else if (act === 'rate') {
      ensurePayload().then(function () { go('rate'); }, function () { go('rate'); });
    } else if (act === 'pairpick') {
      /* a head-to-head answer — in place, see pairPick */
      pairPick(Number(b.getAttribute('data-score')), true);
    } else if (act === 'gapstop') {
      /* the pedestal card's ballot: the asked pair's margin, in place */
      if (work && work.step === 'gaps') pedSetGap(work.gapAt, Number(b.getAttribute('data-gap')));
    } else if (act === 'gappair') {
      /* a slip jumps to its pair */
      if (work && work.step === 'gaps') pedSetActive(Number(b.getAttribute('data-m')));
    } else if (act === 'gapnext') {
      /* the next pair, once this one is answered (the button's own gate) */
      if (work && work.step === 'gaps' && pedGet(work.gapAt) != null) pedSetActive(work.gapAt + 1);
    } else if (act === 'gapback') {
      if (work && work.step === 'gaps' && work.gapAt > 0) pedSetActive(work.gapAt - 1);
    } else if (act === 'step' || act === 'next' || act === 'back') {
      /* bench navigation. The whole panel re-renders (state lives in `work`,
         so nothing is lost) and focus lands back on the heading. */
      var seq = stepSeq();
      var at = seq.indexOf(work.step);
      /* the gate, held at the door as well as on the button (the disabled
         attribute is state the DOM could lose; this check can't) */
      if (act === 'next' && !stepAnswered(work.step)) return;
      var dest = act === 'step' ? b.getAttribute('data-step')
        : seq[at + (act === 'next' ? 1 : -1)];
      /* the docket's one head-to-head node stands for every pair card */
      if (dest === 'pairs') dest = pairsEntry();
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
      /* on the catalogue entry a press — the clerk's own tier included —
         makes the size the owner's; the entry re-gates itself */
      if (catalogueOn() && work.entry) {
        work.entry.sizePressed = true;
        catRefresh();
        return;
      }
      setDisabled('[data-act="file"]', false);
      var fileBtn = bodyEl.querySelector('[data-act="file"]');
      if (fileBtn) fileBtn.textContent = 'file the grades';
      /* the "pick a size" line only (a <p>): the bench's notes-for-the-
         record label wears the same class, and with a tier already on file
         (the intake clerk's) there is no line, so a bare class selector
         used to find the label and drop the note with it */
      var hint = bodyEl.querySelector('p.jd-size-hint');
      if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
    } else if (act === 'file') {
      /* the one-survivor bench files directly — same gate as next */
      if (!stepAnswered(work.step)) return;
      /* every pair needs its answer before anything files: one the rail
         let the visitor skip past is where the card goes instead */
      var openPair = firstOpenPair();
      if (openPair) {
        work.step = PAIR_PFX + openPair.key;
        work.reached[work.step] = true;
        render();
        return;
      }
      /* …and so does every margin on the pedestal card, for the podium as
         it stands now (a re-ranking since cleared them) */
      if (gapsOn()) {
        pedSync();
        if (!pedAllSet()) {
          work.step = 'gaps';
          work.gapAt = pedFirstUnset();
          work.reached.gaps = true;
          render();
          return;
        }
      }
      /* a curation files at the SIZE card, which closes it; the size is the
         owner's call and never defaulted (CLAUDE.md's filing rule) — and the
         catalogue entry's headings must sit inside their facets' bounds */
      if (curJob && work.step === 'size' && !work.size) return;
      if (curJob && work.step === 'size' && catalogueOn() && catProblem()) return;
      fileNow();
    } else if (act === 'again') {
      clearTurn();
      work = blankWork();
      go('prompt');
    } else if (act === 'done') {
      clearTurn();
      close();
    } else if (act === 'retry-file') {
      fileNow();
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
        /* the boxed mark reads + closed, − open — drawn in CSS off
           aria-expanded (junk-drawer.css .jd-defx), so there's no glyph
           to write here any more */
      }
    } else if (act === 'paper') {
      /* the plate's own graph/blueprint swap — see togglePaper() above */
      togglePaper(b.closest('.jd-turn-plate'));
    }
  }

  /* the forward gate, per step: a drawing's every scale, the full podium,
     every margin on the pedestal card, a pair's one answer; the size card
     gates its own button */
  function stepAnswered(step) {
    if (step === 'size') return true;
    if (step === 'call') return callReady();
    if (step === 'gaps') { pedSync(); return pedAllSet(); }
    if (isPairStep(step)) return pairLeftScore(pairOf(step)) != null;
    return benchRated(step);
  }

  function blankWork() {
    var reached = {};
    reached[JD_SLOTS[0]] = true;
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
      step: JD_SLOTS[0], reached: reached,
      ranks: {},
      /* THE HEAD TO HEAD's answers (dataset v2): canonical pair key 'a|c'
         → score −3..+3, positive = the first slot preferred; pairDeck is
         the sitting's deal of pair order and sides (see pairDeck) */
      pairs: {}, pairDeck: null,
      /* THE PEDESTAL CARD's answers (owner, 2026-10-02 — see BY HOW MUCH):
         slot of the higher place → its margin (0.5 = negligibly, 1..3
         notches; absent = unset), the pair being asked, and the podium
         order they describe */
      gaps: {}, gapAt: 0, gapSig: '',
      winner: null, strength: null, reveal: null
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
       we never received. A random v4 (JD_uuid): it only has to be unique per
       visitor, the server never trusts it for anything but convergence */
    turn = {
      client_ref: JD_uuid(), state: 'generating', run_id: null, prompt_id: null,
      slots: blankSlots()
    };
    persist();
    work.slow = false;
    work.notice = '';
    work.slots = blankSlots();
    go('generating');
    startSlowTimer();
    JD_track('turn_submit', null);
    /* THE INTAKE (2026-10-02, PLAN-INTAKE): one Sonnet call files the
       prompt in the catalogue — its heading (the tag's title), its size
       tier and its classification — on the prompt row, server-side. It
       replaces the titler (owner, 2026-08-29) on the same footing: fired
       here so it rides the darkroom wait, invisible, and a missing intake
       never holds up a turn. A fallback answer (the call failed) carries no
       title worth filing, so work.title stays unset and shortTitle() carries
       on as before. One retry after 4s covers the race where no slot's
       prompt row has landed yet (jd2-intake answers no_turn until one has). */
    (function fetchIntake(attempt) {
      function retry() {
        setTimeout(function () {
          if (mine === token) fetchIntake(attempt + 1);
        }, 4000);
      }
      postJSON(API_INTAKE, { client_ref: turn.client_ref, prompt: text }, null)
        .then(function (j) {
          if (mine !== token || !work) return;
          if (j && j.ok) {
            if (j.title && !j.fallback) {
              work.title = j.title;
              if (turn) { turn.title = j.title; persist(); }
            }
            /* THE SIZE IS THE CLERK'S (owner, 2026-10-02): a visitor is no
               longer asked how big the object is when intake sized it —
               the size step leaves this turn (sizeTiers), the won record
               carries the model's tier, and the filing sends no size. A
               failed intake answers size_class null, and the size card
               closes the turn as before. */
            if (j.size_class && !j.fallback) work.modelSize = String(j.size_class);
          } else if (attempt < 2) {
            retry();
          }
        }, function () {
          if (mine === token && attempt < 2) retry();
        });
    })(1);
    JD_SLOTS.forEach(function (slot) {
      /* NO client abort and NO client timeout — the server owns the 150s
         budget, and a fetch cancelled here would abandon a generation the
         server is still paying for (C5.4) */
      postJSON(API_GEN, {
        client_ref: turn.client_ref,
        slot: slot,
        prompt: text,
        client: JD_CLIENT,
        consent: { version: JD_CONSENT.version },
        /* the device code, made now if this is the browser's first turn
           (JD_deviceRef in jd-core.js, owner 2026-09-10) */
        device_ref: window.JD_deviceRef ? JD_deviceRef(true) : null,
        website: honey
      }, { ok: false, error: { code: 'server_error' } }).then(function (j) {
        settleSlot(mine, slot, j);
      }, function () {
        settleSlot(mine, slot, { ok: false, error: { code: 'network' } });
      });
    });
  }

  /* each slot lands on its own — the UI never waits for the full bench */
  function settleSlot(mine, slot, res) {
    if (mine !== token || !work || !turn) return;
    /* the run and its prompt arrive with every answer that got that far —
       a failed slot's envelope carries them too, when the server knew them */
    if (res && res.run_id) turn.run_id = res.run_id;
    if (res && res.prompt_id) turn.prompt_id = res.prompt_id;
    if (ownerJob) {
      ownerJob.run_id = turn.run_id;
      ownerJob.prompt_id = turn.prompt_id;
    }
    if (res && res.ok && res.svg) {
      work.slots[slot] = { status: 'ok', gen_id: res.gen_id, svg: res.svg };
      turn.slots[slot] = { status: 'ok', gen_id: res.gen_id };
    } else {
      var err = (res && res.error) || {};
      work.slots[slot] = {
        status: 'failed', code: err.code || 'server_error',
        message: err.message || '', retry_after: res && res.retry_after
      };
      turn.slots[slot] = { status: 'failed' };
      if (!ownerJob) JD_track('turn_error', err.code || 'server_error');
    }
    persist();
    paintSlots();
    if (pendingCount() > 0) return;
    stopSlowTimer();
    if (ownerJob) { finishOwnerRun(); return; }
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
    go('apology');   /* go() files the state on the turn and persists it */
  }

  /* ---------- filing: one batch, then the only unveil ---------------------- */
  /* the head-to-head answers on the wire: one per pair, named by SLOT, the
     score signed from the LEFT drawing's side with shown_left saying which
     that was (jd2-rate re-signs into canonical order). Null when the
     sitting has no pairs — one survivor, or no comparison scale. The bench
     callback gets the same list plus the job's generation ids. */
  function pairsOut() {
    var deck = pairDeck();
    if (!deck.length) return null;
    var out = [];
    deck.forEach(function (p) {
      var s = pairLeftScore(p);
      if (s == null) return;
      out.push({ slot_a: p.left, slot_b: p.right, score: s, shown_left: p.left });
    });
    return out.length ? out : null;
  }
  /* THE RANKING ON THE WIRE: one entry per surviving slot, ranks dense from
     1, exactly one 1st — the podium can't produce anything else — and, when
     the pedestal card is the instrument, each place's GAP (0..3) on every
     place but the last. The server's rule is a gap on every place but the
     last OR ON NONE, so an unanswered margin sends no gaps at all: the
     sitting files, and is incomplete (the card's gates make that rare).
     Null when there is no call (one drawing). */
  function rankingOut() {
    var ok = okSlots();
    if (ok.length < 2 || !callReady()) return null;
    var ranking = ok.map(function (s) {
      return { slot: s, rank: podRankOf(s) };
    }).sort(function (p, q) { return p.rank - q.rank; });
    var gaps = pedGapsOut();
    if (gaps) {
      ranking.forEach(function (p) {
        if (p.rank < ok.length) p.gap = gaps[p.slot];
      });
    }
    return ranking;
  }
  function submitRatings() {
    if (!turn || !turn.run_id) { go('apology'); return; }
    var ratings = [];
    okSlots().forEach(function (slot) {
      var r = work.ratings[slot];
      /* drawings are named by SLOT on the v2 wire — the server maps slot →
         generation inside the run, so no id the client holds can file
         onto a foreign run */
      if (r.grade != null) ratings.push({ slot: slot, kind: 'grade', value: r.grade });
      Object.keys(r.axes).forEach(function (axisId) {
        if (r.axes[axisId] == null) return;
        /* values only — the per-axis note field left the survey with the
           rest of the note UI (owner request, 2026-08-12); the API still
           accepts notes, this client just never files one */
        ratings.push({ slot: slot, kind: 'axis', axis_id: axisId, value: r.axes[axisId] });
      });
      /* (no 'flag' row: v2 has no flag kind. The benched report path's
         state — r.flag / r.flagNote — is kept for the day it returns with
         a v2 home of its own.) */
    });
    /* THE CALL ON THE WIRE (podium, 2026-08-22; gaps 2026-10-02): see
       rankingOut. `pairs` is null whenever the pedestal card is the
       instrument — a visitor's turn always — so the server derives them
       (one sitting, one method). Both are null in the degraded one-slot
       path, where there is no call at all. */
    var ranking = rankingOut();
    var dev = window.JD_deviceRef ? JD_deviceRef(false) : null;
    var body = {
      run_id: turn.run_id,
      /* the proof this turn is OURS: jd2-rate files a visitor sitting only
         when the client_ref the turn was drawn under comes with it (a run id
         is public once the item is live; the client_ref never leaves this
         browser's turn record) */
      client_ref: turn.client_ref,
      client: JD_CLIENT,
      /* the object's name and the visitor's wish about showing it — both
         belong to the record now that a rated turn joins the drawer */
      title: work.title || null,
      suppress: !!work.suppress,
      ratings: ratings,
      ranking: ranking,
      pairs: gapsOn() ? null : pairsOut()
    };
    /* the size only when the visitor chose one (the size card shows only
       when intake did not size the turn): an absent size leaves the
       clerk's tier on the prompt (jd2-rate never files a null over it) */
    if (work.size) body.size = work.size;
    /* the device code the turn already sent with its generations, so the
       sitting is stamped with it too (jd2_sessions.device_ref); never made
       here — only a turn makes one */
    if (dev) body.device_ref = dev;
    /* same guard as a generation (C5.4): the filing is not aborted when the
       turn is abandoned, so its answer has to identify the turn it belongs
       to or it lands on whatever turn is live when it arrives */
    var mine = armFiling();
    postJSON(API_RATE, body, { ok: false, error: { code: 'server_error' } })
      .then(function (j) { onFiled(mine, j); }, function () {
        onFiled(mine, { ok: false, error: { code: 'network' } });
      });
  }
  /* the two filing presses — the card's own button and the failure card's
     retry — file the same way: a curation through its job, a turn to
     jd2-rate */
  function fileNow() {
    if (curJob) curateFile(); else submitRatings();
  }
  /* a filing leaves: both its buttons go dead until the answer is in (the
     answer repaints either way), and the turn's token goes with it, for the
     answer to be matched against */
  function armFiling() {
    setDisabled('[data-act="file"]', true);
    setDisabled('[data-act="retry-file"]', true);
    return token;
  }
  /* a filing that didn't take, in either flow: the same shape as the
     apology (§6) — same prose-only pattern, no stamp. `sentence` says what
     the failure means for the grades still on the card. */
  function paintFileFailure(code, sentence, title) {
    paint(head(title || 'The grades didn’t file', 6) +
      '<p class="jd-turn-line">The drawer couldn’t record them ' +
      '(<b>' + esc(code) + '</b>). ' + sentence + '</p>' +
      actions('<button type="button" class="jd-turn-go" data-act="retry-file">try filing again</button>' +
        '<button type="button" class="jd-turn-alt" data-act="done">close</button>'));
    focusFirst();
  }
  function onFiled(mine, res) {
    if (mine !== token || !isOpen || !work) return;
    if (!res || !res.ok) {
      var code = ((res || {}).error || {}).code || 'server_error';
      JD_track('turn_error', code);
      paintFileFailure(code, 'Nothing was written — the whole batch goes ' +
        'together or not at all, and your grades are still here.');
      return;
    }
    work.reveal = res.reveal || [];
    if (turn) {
      if (res.run_id) turn.run_id = res.run_id;
      if (res.prompt_id) turn.prompt_id = res.prompt_id;
    }
    var ok = okSlots();
    JD_track('turn_complete', ok.length > 1 ? (work.winner || 'tie') : 'degraded');
    /* the winner is placed from the reveal payload — a degraded turn keeps
       its survivor. (A tie used to ask the visitor, at the unveil; the
       podium can no longer mint one — see podSync.) */
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
  /* the cost fields ride a record only when there is something to say:
     tokens when usage was recorded, cost_usd when the model is priced.
     `src` is wherever they were filed — a reveal row, a stored record. */
  function withCost(o, src) {
    if (src.tokens) o.tokens = src.tokens;
    if (src.cost_usd != null) o.cost_usd = src.cost_usd;
    return o;
  }
  /* A WON ITEM'S IDENTITY IS ITS PROMPT (dataset v2, 2026-10-01): data.php
     serves a turn as the item whose id is the prompt id, so the visitor's
     local copy takes the same id — the pile loader's de-dup, the scatter
     seat, the size jitter and the #<id> deep link all agree before and after
     a reload. The winning gen_id stands in only for a record that somehow
     lacks a prompt id. */
  function recId(rec) { return (rec && (rec.prompt_id || rec.gen_id)) || ''; }
  function placeWinner(slot) {
    var s = work.slots[slot];
    if (!s || s.status !== 'ok' || !s.svg) return;
    var rv = revealFor(slot) || {};
    var r = work.ratings[slot];
    var rec = {
      gen_id: s.gen_id,
      slot: slot,
      run_id: turn.run_id,
      prompt_id: turn.prompt_id,
      rank: podRankOf(slot) || (okSlots().length === 1 ? 1 : null),
      /* the sitting's head-to-head answers, canonical (see work.pairs) */
      pairs: work.pairs || {},
      svg: s.svg,
      prompt: work.prompt,
      /* the model-written tag title (jd2-intake.php); records without one
         fall back to shortTitle(prompt) wherever they're read */
      title: work.title || null,
      model_id: rv.model_id || '',
      label: rv.label || '',
      won_at: new Date().toISOString(),
      /* the visitor's pick, else the intake clerk's tier, else the fixed tier */
      sizeClass: work.size || work.modelSize || VISITOR_TIER,
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
    withCost(rec, rv);
    /* the OTHER bench responses ride along (owner request, 2026-08-12;
       generalized to the trio 2026-08-14): the report card shows every
       option from the turn, the losers filed as alternative responses on
       the same entry. Only the winner joins the pile — this is
       record-keeping, not extra items. Records persisted before the trio
       carry a single `also` object; new ones carry `others` (array), and
       registerRecord reads both. */
    /* in place order, as data.php serves a turn (rid r1 = 1st, r2 = 2nd…) */
    var others = okSlots().filter(function (x) { return x !== slot; })
      .sort(function (x, y) { return (podRankOf(x) || 99) - (podRankOf(y) || 99); });
    rec.others = [];
    others.forEach(function (other) {
      var os = work.slots[other];
      if (os && os.status === 'ok' && os.svg && os.gen_id) {
        var orv = revealFor(other) || {};
        /* the losers' costs file too — the card's "same prompt" strip shows
           every option, and each response's notes state their own spend */
        rec.others.push(withCost({
          gen_id: os.gen_id, svg: os.svg, slot: other, rank: podRankOf(other) || null,
          model_id: orv.model_id || '', label: orv.label || '',
          grade: work.ratings[other].grade,
          annotations: ratingAnnotations(work.ratings[other])
        }, orv));
      }
    });
    if (!rec.others.length) delete rec.others;
    var list = JD_store.get(K_ITEMS) || [];
    list = [rec].concat(list.filter(function (x) { return recId(x) !== recId(rec); }));
    if (list.length > MAX_ITEMS) list = list.slice(0, MAX_ITEMS);
    /* one 300KB SVG × 5 is the worst case; on a quota refusal drop the oldest
       and try once more, then give up — the item still shows this page-load */
    if (!JD_store.set(K_ITEMS, list) && list.length > 1) {
      JD_store.set(K_ITEMS, list.slice(0, list.length - 1));
    }
    dropIntoPile(rec, true);
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
    el.dataset.tier = rec.sizeClass || VISITOR_TIER;   /* the z band (JD_zBase) */
  }

  function dropIntoPile(rec, animate, batch) {
    var pile = document.querySelector('.jd-pile');
    if (!pile || !rec || !rec.svg || !window.JD_svgNode) return null;
    var id = recId(rec);
    if (pile.querySelector('[data-id="' + id + '"]')) return null;
    var title = rec.title || shortTitle(rec.prompt);
    var el = document.createElement('div');
    el.className = 'jd-item jd-item--visitor';
    el.dataset.id = id;
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
       for any SVG that did not come from this repo (APP §4.12) — and the
       same inline parse: as XML, never innerHTML (JD_svgNode, jd-core.js).
       A drawing that will not parse is not dropped in, like one with no svg. */
    var art = window.JD_svgNode(rec.svg, 'juw' + (instSeq++) + '_');
    if (!art) return null;
    el.appendChild(art);
    pile.appendChild(el);
    /* reframe before sizing: a live-generated drawing can overshoot the
       frame it declares, and applySize's aspect read (svgAspect) must see
       the expanded viewBox — see fitView in jd-core.js. Same
       generation key the turn plates used, so the won item lands in the
       drawer framed exactly as it was on the bench. */
    if (window.JD_fitView) window.JD_fitView(el.querySelector('svg'), 'gen:' + rec.gen_id);
    if (window.JD_applySize) {
      window.JD_applySize(el, JD_tierBox(tax(), rec.sizeClass || VISITOR_TIER), id, 1);
    }
    /* position: the visitor's own scatter entry, reused across reloads the
       way every other item's is — under the item id, so the drawer's own
       copy of this turn lands in the same seat after a reload */
    var map = JD_store.get(JD_SCATTER_KEY) || {};
    var p = map[id];
    /* the pile's rect and the item's, read once for both uses below (a
       fresh spot, the corner push) — nothing between them writes */
    var host_ = null, r_ = null;
    if (!p || window.JD_avoidTurn) {
      host_ = pile.getBoundingClientRect(); r_ = el.getBoundingClientRect();
    }
    if (!p) {
      p = freshSpot(host_, r_);
      map[id] = p;
      JD_store.set(JD_SCATTER_KEY, map);
    }
    /* pushed clear of the turn button's reserved corner at apply time, same as
       the curated pile — a stored spot can predate the rule or a viewport
       change; the stored value itself stays untouched */
    if (window.JD_avoidTurn) {
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
    /* a won item lands on TOP of the pile, whatever its size — the layers
       are dealt at load (JD_zBase), and this is a drop, not a load */
    el.style.zIndex = window.JD_zRaise ? JD_zRaise() : JD_zBase(el) + (p.z || 100);
    if (animate) {
      el.classList.add('is-dropped');
      JD_haptic('drop');
    }
    /* it is a standard .jd-item from here: drag, rotate, tap-to-pick and the
       specimen tag all bind through the ordinary wiring, no special case.
       (A batch — restoreWon — does the wiring and the filing itself, once
       the last of its items is down.) */
    if (batch) return el;
    if (window.JD_wirePile) window.JD_wirePile();
    markCard(el, registerRecord(rec, title));
    return el;
  }

  /* `host` and `r`: the pile's rect and the item's, read by dropIntoPile */
  function freshSpot(host, r) {
    var hw = Math.min(0.45, (r.width || 40) / 2 / (host.width || 1));
    var hh = Math.min(0.45, (r.height || 40) / 2 / (host.height || 1));
    function inside(half) {
      var lo = half + JD_SCATTER_INSET, span = Math.max(0, 1 - 2 * lo);
      return +(lo + Math.random() * span).toFixed(4);
    }
    return {
      x: inside(hw), y: inside(hh),
      rot: +((Math.random() * 2 - 1) * JD_ROT_MAX).toFixed(1),
      z: 100
    };
  }

  /* one response of a won item's entry, as the report card reads it: the
     winner's (`src` = the stored record, rid r1) and each loser's alike.
     The cost fields (2026-08-15) ride the RESPONSE, not the entry, so the
     strip's per-response notes can each state their own spend. Records
     persisted before this simply lack them, and the card omits the lines. */
  function respFor(rid, src, day) {
    return withCost({
      /* gen_id rides the response so the card frames this drawing under the
         SAME key the bench and the pile used for it (see fitKey in
         jd-record.js, fitView in jd-core.js) */
      rid: rid, file: src.gen_id + '.svg', gen_id: src.gen_id, model: src.model_id, date: day,
      generation: { mode: 'one-shot', prompt_count: 1 },
      /* the place on the podium (the strip's medal) and the slot — data.php's
         response shape carries the first; the slot maps the pairs below */
      rank: src.rank != null ? src.rank : null, slot: src.slot || null,
      grade: src.grade, annotations: src.annotations || {},
      /* a data: URL, and the ONLY thing the card may do with it is hang it
         off the download link — the entry's `visitor: true` (registerRecord)
         stops ensureSVGs from ever treating it as a path to join to JD_API
         (APP §4.1); the SVG text itself is primed into the cache there */
      url: svgDataUrl(src.svg), transcript_url: null
    }, src);
  }

  /* The report card renders entirely from the payload, so a won item earns a
     real one by being filed as an entry: its own prompt, its model, and the
     grades the visitor just gave it. Without this the specimen tag's REPORT
     CARD button would be a dead control on visitor items — and the tag is
     shared gesture code we are not allowed to special-case. */
  function registerRecord(rec, title) {
    if (!payload || !payload.items || !window.JD_record) return false;
    var id = recId(rec);
    if (byId(payload.items, id)) return true;   /* already filed */
    var file = rec.gen_id + '.svg';
    var day = String(rec.won_at || '').slice(0, 10);
    var responses = [respFor('r1', rec, day)];
    var primed = {};
    /* the card's cache key is entry id + file (cacheKey in jd-record.js) */
    primed[id + '/' + file] = rec.svg;
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
      responses.push(respFor('r' + (ai + 2), alt, day));
      primed[id + '/' + afile] = alt.svg;
    });
    /* the head-to-head, in data.php's item shape: {a: rid, b: rid, score
       (positive = a preferred), source} — the record's canonical slot-keyed
       answers mapped onto this entry's rids */
    var ridOf = {};
    responses.forEach(function (r) { if (r.slot) ridOf[r.slot] = r.rid; });
    var pairs = [];
    Object.keys(rec.pairs || {}).forEach(function (k) {
      var ab = k.split('|');
      if (ridOf[ab[0]] && ridOf[ab[1]] && rec.pairs[k] != null) {
        pairs.push({ a: ridOf[ab[0]], b: ridOf[ab[1]], score: rec.pairs[k], source: 'direct' });
      }
    });
    payload.items.unshift({
      id: id, run_id: rec.run_id || null, prompt_id: rec.prompt_id || null,
      title: title, prompt: rec.prompt, created: day,
      visitor: true, sizeClass: rec.sizeClass || VISITOR_TIER, primary: 'r1',
      responses: responses, pairs: pairs
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
    var down = [];
    try {
      storedWon().slice().reverse().forEach(function (rec) {
        if (!(rec && rec.gen_id && rec.svg)) return;
        var el = dropIntoPile(rec, false, true);
        if (el) down.push({ el: el, rec: rec });
      });
    } finally {
      /* …then the pile is wired ONCE rather than once per item (JD_wirePile
         is idempotent and walks the whole well every call), and each item's
         card is filed after it, as a single drop does it, so every item
         ends up exactly as a drop leaves it. Only if something actually
         went down: with nothing restored, nothing is wired early. */
      if (down.length) {
        if (window.JD_wirePile) window.JD_wirePile();
        down.forEach(function (d) {
          markCard(d.el, registerRecord(d.rec, d.rec.title || shortTitle(d.rec.prompt)));
        });
      }
    }
  }
  /* the payload arrived after the items were already down: fill in the tag
     strings that only the taxonomy can supply, and file the report cards */
  function hydrateWon() {
    var pile = document.querySelector('.jd-pile');
    storedWon().forEach(function (rec) {
      if (!rec || !rec.gen_id) return;
      var el = pile && pile.querySelector('[data-id="' + recId(rec) + '"]');
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
  restoreWon();

  /* THE OWNER'S RUN (dataset v2, PLAN-V2 §5, Phase 4b) — a new prompt from
     the bench, or a RERUN of a prompt on file. Both go through jd2-generate's
     OWNER path: the bench key on every request, the `bench` profile (every
     model at the server's default owner setting, medium thinking since
     2026-10-02 — the benchmark condition; see JD_EFFORT), and the
     slots asked for ONE AFTER ANOTHER on one client_ref (a bench call can
     take minutes; four at once is the visitor's turn, not the owner's). A
     new prompt converges on its client_ref; a rerun's first slot (rerun_of,
     no run_id) makes the new run and every later slot joins it by run_id.
     The wait is the ordinary darkroom. When the last slot lands the card
     comes down (no reveal, no visitor bench — the owner rates on the bench,
     blind) and jd-turn-close carries {owner_run: {run_id, prompt_id,
     rerun_of, ok, failed}}; a run stopped mid-wait carries abandoned: true.
     A rerun is never a visitor turn in v2: without a bench key this refuses.

     job: { prompt?, rerun_of?, profile? ('bench'), redirect? } — redirect
     sends the page to ?bench&prompt=<id> when the run lands (the ?rerun=
     door, which has no bench strip to hand the run to). */
  function ownerRun(job) {
    if (isOpen || !job) return false;
    if (!(window.JD_admin && JD_admin.key())) return false;
    var text = String(job.prompt || '');
    if (!job.rerun_of && (!text.trim().length || text.length > MAX_PROMPT)) return false;
    clearTurn();
    work = blankWork();
    work.prompt = text.slice(0, MAX_PROMPT);
    ownerJob = { rerun_of: job.rerun_of || null, profile: job.profile || 'bench',
      redirect: !!job.redirect, run_id: null, prompt_id: job.rerun_of || null };
    ownerResult = null;
    open();
    if (!isOpen) { ownerJob = null; return false; }
    startOwnerRun();
    return true;
  }
  function startOwnerRun() {
    var job = ownerJob, mine = ++token, text = work.prompt;
    turn = {
      client_ref: JD_uuid(), state: 'generating', run_id: null,
      prompt_id: job.rerun_of, slots: blankSlots()
    };
    work.slow = false;
    work.notice = '';
    work.slots = blankSlots();
    go('generating');
    startSlowTimer();
    var i = 0;
    (function next() {
      if (mine !== token || !turn || i >= JD_SLOTS.length) return;
      var slot = JD_SLOTS[i++];
      /* a rerun whose first slot never made its run cannot converge: asking
         again without a run_id would mint a second run, so the rest stand down */
      if (job.rerun_of && i > 1 && !turn.run_id) {
        settleSlot(mine, slot, { ok: false, error: { code: 'no_run',
          message: 'the rerun was not filed' } });
        next();
        return;
      }
      var body = { client_ref: turn.client_ref, slot: slot, client: JD_CLIENT,
        website: '', profile: job.profile };
      if (job.rerun_of) {
        body.rerun_of = job.rerun_of;
        if (turn.run_id) body.run_id = turn.run_id;
      } else {
        body.prompt = text;
      }
      postJSON(API_GEN, body, { ok: false, error: { code: 'server_error' } }, true)
        .then(function (j) { settleSlot(mine, slot, j); next(); }, function () {
          settleSlot(mine, slot, { ok: false, error: { code: 'network' } });
          next();
        });
    })();
  }
  /* every slot is in: the run goes to the bench (or, with nothing drawn,
     the apology says so and its close hands the empty run over) */
  function finishOwnerRun() {
    var job = ownerJob;
    var failed = JD_SLOTS.filter(function (s) {
      return work.slots[s].status === 'failed';
    }).map(function (s) { return work.slots[s].code || 'server_error'; });
    ownerResult = { run_id: (turn && turn.run_id) || null,
      prompt_id: (turn && turn.prompt_id) || null, rerun_of: job.rerun_of,
      ok: okSlots().length, failed: failed };
    var res = ownerResult;
    if (!res.ok) {
      work.notice = 'Nothing came back from the run (' + failed.join(', ') + ').';
      go('apology');
      return;
    }
    clearTurn();
    close();
    if (job.redirect && res.prompt_id) {
      location.href = location.pathname + '?bench&prompt=' + encodeURIComponent(res.prompt_id);
    }
  }

  /* A RERUN — kept as the module's public door (jd-core's ?rerun=<id>
     calls it with the item's prompt text). In v2 it is the OWNER'S path:
     the prompt is found on the payload (by id, or by its exact text) and
     redrawn as a rerun of that prompt with the bench key; when it lands,
     the page goes to the bench seated on it. No key, or no such prompt on
     the payload: refused (false) — a rerun is never a visitor turn. */
  function rerun(arg) {
    var id = null, text = '';
    if (arg && typeof arg === 'object') { id = arg.prompt_id || null; text = arg.prompt || ''; }
    else text = String(arg || '');
    var items = (payload && payload.items) || [];
    for (var i = 0; !id && i < items.length; i++) {
      if (items[i].id === text || (text && items[i].prompt === text)) {
        id = items[i].id;
        text = items[i].prompt || '';
      }
    }
    if (!id) { console.warn('rerun: no prompt on file for that'); return false; }
    var ok = ownerRun({ rerun_of: id, prompt: text, redirect: !(arg && arg.redirect === false) });
    if (!ok) console.warn('rerun: the owner path needs the bench key (?bench), and a closed card');
    return ok;
  }

  /* ---------- CURATE MODE — the re-rating bench (owner, 2026-08-28) --------
     The backlog instrument IS this card. JD_bench (the ?bench driver,
     jd-bench.js) hands over one curated item at a time and the card
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
       — filing goes through the job's file() callback (JD_bench's outbox)
         instead of jd2-rate.php. The head to head runs here too (the one
         instrument), and its answers go to file() as a third argument —
         see curateFile.
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
      /* the deal is BLIND: slots are shuffled so the curator cannot know
         which model drew which print. `fixedOrder` opts out — the only
         caller is the /about/ walkthrough, which has to be able to say
         "this one is Kimi's" and drive the rail to it. The bench never
         sets it, so its blind deal is untouched (2026-09-14). */
      if (!job.fixedOrder) JD_shuffle(order);
      /* THE PREFILL CARRIES ONLY WHAT THIS CARD CAN FILE (taxonomy v35): an
         answer on a retired axis, or off its axis's current scale (a grade
         off the grade scale), is left out rather than carried into the new
         sitting — jd2-rate would refuse the whole filing over it. The queue
         prunes first and says so (job.prefillPruned); this is the card's
         own check of the same rule against the taxonomy it renders. */
      var liveAx = {}, pruned = !!job.prefillPruned;
      JD_liveAxes(tax()).forEach(function (ax) { liveAx[ax.id] = ax; });
      function onGradeScale(v) { return v != null && !!window.JD_gradeOf(tax(), v); }
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
        if (r.grade != null && !onGradeScale(r.grade)) { r.grade = null; pruned = true; }
        Object.keys(resp.axes || {}).forEach(function (a) {
          var v = resp.axes[a];
          if (v == null) return;
          if (!liveAx[a] || !window.JD_byRank(liveAx[a].values, v)) { pruned = true; return; }
          r.axes[a] = v;
        });
        /* a filed rank resumes only while it fits this podium — a stale row
           from a different response count would seat a print on a step that
           doesn't exist (or, on a one-drawing item, on none at all) */
        if (resp.rank >= 1 && resp.rank <= n) work.ranks[slot] = resp.rank;
      });
      /* THE HEAD TO HEAD PREFILLED (Phase 4b): job.pairs are the answers on
         file, named by each drawing's REAL slot (the queue's, not this
         card's shuffled seat) with the score from slot_a's side. They are
         re-seated here onto the card's canonical seat pair, re-signed so
         positive still means the alphabetically-first SEAT was preferred. */
      var seatOf = {};
      order.forEach(function (resp, k) {
        if (resp.slot) seatOf[resp.slot] = JD_SLOTS[k];
      });
      (job.pairs || []).forEach(function (p) {
        var sa = seatOf[p.slot_a], sb = seatOf[p.slot_b];
        if (!sa || !sb || sa === sb || p.score == null) return;
        if (sa < sb) work.pairs[sa + '|' + sb] = +p.score;
        else work.pairs[sb + '|' + sa] = -p.score;
      });
      /* THE MARGINS PREFILLED (2026-10-02): each response's gap_after (the
         owner's last sitting, by response — so by this card's seat) is
         restored through the pedestal card's own contract shape, exactly
         as back/forward and the turn's persistence restore it. On the
         ?pairs=1 audit the gaps are not the instrument and stay unread. */
      if (gapsOn()) {
        var shape = [];
        order.forEach(function (resp, k) {
          if (resp.rank >= 1 && resp.rank <= n) {
            shape.push({ slot: JD_SLOTS[k], rank: resp.rank,
              gap: resp.gap_after != null ? resp.gap_after : null });
          }
        });
        pedRestore(shape);
      }
      work.prefillPruned = pruned;
      /* the sitting's note starts empty: it is this sitting's rationale */
      work.note = '';
      /* THE CATALOGUE ENTRY (0.13.0): the bench's job carries what is on
         file for the prompt — the heading, the size and who set it, the
         headings per facet, the clerk's reasons and stamp — and the card
         works on a copy of it (see THE CATALOGUE ENTRY above) */
      work.entry = job.catalogue ? catBlank(job.catalogue) : null;
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
      /* the head to head resumes after a full podium: a ranked item opens
         on its first pair still unanswered (2026-10-01; prefilled pairs
         count as answered — see job.pairs above) */
      var openPair = ranked ? firstOpenPair() : null;
      /* …and the pedestal card likewise, on its first margin still unset
         (prefilled gaps count as answered, and reach its rail station) */
      var gapsOpen = ranked && gapsOn() && !pedAllSet();
      if (ranked && gapsOn() && pedAllSet()) work.reached.gaps = true;
      if (firstOpenSlot) {
        work.step = firstOpenSlot;
      } else if (openPair) {
        work.step = PAIR_PFX + openPair.key;
        work.reached.call = true;
        work.reached[work.step] = true;
      } else if (gapsOpen) {
        work.step = 'gaps';
        work.gapAt = pedFirstUnset();
        work.reached.call = true;
        work.reached.gaps = true;
      } else if (sizeStep && ranked && !work.size) {
        work.step = 'size';
        work.reached.size = true;
        ok.forEach(function (s2) { work.reached[s2] = true; });
        if (ok.length > 1) work.reached.call = true;
        if (gapsOn()) work.reached.gaps = true;
        pairSteps().forEach(function (st) { work.reached[st] = true; });
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
     failure is safe by construction.
     THE GAPS RIDE ON THE RANKING (2026-10-02): each `per` entry carries
     `gap` — its place's margin 0..3 from the pedestal card, null on the
     last place and on every place unless every margin is answered (the
     server's all-or-none rule) — and `pairs` is null: the server derives
     them. Only on the ?pairs=1 audit is it the other way round.
     THE PAIRS RIDE ALONG (dataset v2, 2026-10-01): file(per, size, pairs,
     note), `pairs` the head-to-head answers in the jd2-rate wire shape
     ({slot_a, slot_b, score, shown_left}, score from slot_a's side — these
     slots are the card's SEATS) plus gen_a/gen_b, the job's own generation
     ids for those seats — or null. Each `per` entry carries `slot`, the
     drawing's REAL slot as the job gave it (resp.slot), so the bench maps
     the shuffled seats back to the run's slots (Phase 4b). `note` is the
     sitting's "notes for the record" (null when blank). `entry` (0.13.0)
     is the catalogue entry card's state on the bench — {title, size,
     size_pressed, tags, tags_touched} — and null for any job without a
     `catalogue`; the bench files only what differs from the record, through
     jd2-curate, BEFORE the sitting. The /about/ walkthrough's no-op
     callback ignores all of it. */
  function curateFile() {
    if (!curJob) return;
    var ok = okSlots();
    var gaps = pedGapsOut();
    var per = ok.map(function (s) {
      var r = work.ratings[s], axes = {};
      Object.keys(r.axes).forEach(function (a) {
        if (r.axes[a] != null) axes[a] = r.axes[a];
      });
      return {
        generation_id: work.slots[s].gen_id,
        slot: (work.slots[s].cur || {}).slot || null,
        grade: r.grade,
        axes: axes,
        rank: ok.length > 1 ? (podRankOf(s) || null) : null,
        gap: gaps && gaps[s] != null ? gaps[s] : null
      };
    });
    var pairs = gapsOn() ? null : pairsOut();
    if (pairs) {
      pairs.forEach(function (p) {
        p.gen_a = work.slots[p.slot_a].gen_id;
        p.gen_b = work.slots[p.slot_b].gen_id;
      });
    }
    var note = String(work.note || '').trim();
    /* the catalogue entry as the card holds it — the job's file() decides
       what differs from the record (only that is sent); null off the bench */
    var entry = null;
    if (catalogueOn() && work.entry) {
      var tags = {};
      Object.keys(work.entry.tags).forEach(function (f) { tags[f] = work.entry.tags[f].slice(); });
      entry = {
        title: String(work.entry.title || '').trim().slice(0, 80),
        size: work.size || null,
        size_pressed: !!work.entry.sizePressed,
        tags: tags,
        tags_touched: !!work.entry.tagsTouched
      };
    }
    var mine = armFiling();
    curJob.file(per, work.size || null, pairs, note ? note.slice(0, MAX_SITTING_NOTE) : null, entry).then(function () {
      if (mine !== token || !isOpen || !curJob) return;
      /* what just filed is now the record: a refile after a later failure
         re-sends nothing the record already holds */
      if (work.entry) { work.entry.sizePressed = false; work.entry.tagsTouched = false; }
      curateUnveil();
    }, function (err) {
      if (mine !== token || !isOpen || !curJob) return;
      var code = (err && err.code) || 'server_error';
      /* the bench files the catalogue entry first, then the sitting: a
         failure says which half stood (err.stage, jd-bench.js) */
      if (err && err.stage === 'entry') {
        paintFileFailure(code, 'Nothing was filed — the grades wait for ' +
          'the entry, and your answers are still on the card.', 'The catalogue entry didn’t file');
      } else if (err && err.stage === 'grades' && err.entryFiled) {
        paintFileFailure(code, 'The catalogue entry was filed; the grades ' +
          'were not. Your answers are still on the card, and filing again ' +
          'files only what is missing.');
      } else {
        paintFileFailure(code, 'Your answers are still on the card, and ' +
          'refiling replaces rather than doubles.');
      }
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
    ownerRun: ownerRun,
    curate: curateOpen,
    /* the pedestal card's contract hooks (the mockup's JD_pedestal): the
       answer as jd2-rate's ranking with gaps, and the same shape back in.
       Null / false when no sitting with a pedestal card is on the card. */
    pedestal: {
      answer: function () { return work && gapsOn() ? pedAnswer() : null; },
      restore: function (ranking) {
        if (!work || !gapsOn()) return false;
        var done = pedRestore(ranking);
        if (done && isOpen && state === 'rate') render();
        return done;
      }
    },
    isOpen: function () { return isOpen; }
  };
})();
