/* ============================================================================
   THE JUNK DRAWER — jd-furniture.js
   The three pieces of furniture in the pile, each a static SVG asset
   fetched through JD_fetchArt (jd-core.js) and injected as a .jd-item that
   data.php has never heard of: the turn object, the instructions sheet and
   the (benched) analytics folder. Loaded after jd-core.js; each module
   waits for the pile loader's ready() call with the tier ruler before it
   builds. See jd-core.js for the file map.
   ========================================================================== */

/* ---- THE TURN OBJECT — the credit button in the pile (PLAN-TURN-OBJECT) --
   The Take-a-Turn trigger is HARDWARE IN THE DRAWER: candidate 9a won mockup
   round 9 (2026-08-11, replacing round 8's doorbell, which camouflaged too
   well) — a backlit arcade credit button, charcoal coin-door housing, glowing
   blue lens with PUSH FOR JUNK printed on the glass, throwing a pool of light
   on the wood. The artwork is a static asset (turn-object.svg) fetched
   alongside data.php and injected as a .jd-item, which buys the whole gesture
   layer for free: silhouette hit-testing and the tap path in particular.

   What makes it hardware rather than collection is one dataset flag,
   data-turn="object", and it is the only special case in the pile:
     · the tap path branches on it (see wireItem's pointerup) — press, never
       pick(), so it can never grow a specimen tag or a report card;
     · it is injected here, not by the loader, so it is in no entry, no
       inventory line, no count, no legend, and data.php has never heard of
       it. Its reserved id 'jd-turn-object' cannot collide with an item id
       (those are <YYYY-MM-DD>-<slug>) or a won item's gen_id (a UUID);
     · the one dev iteration that walks the pile semantically (copy-layout)
       excludes it.

   Accessibility: the wrapper is a real button to the tree (role, tabindex,
   Enter/Space, a visible focus ring in the CSS) labelled from
   JD_STRINGS.turnButton, and it FOCUSES ITSELF on press so it is the modal's
   opener and JD_turn's close() hands focus back to it.

   Discoverability (§1, revised 2026-08-10; inverted 2026-08-11): the button
   is FIXED in the bottom-left corner — the same spot every session, every
   device — at a z above every fresh scatter, and it is LIT: the lens halo is
   the drawer's only light source, and the backlight breathes every ~8s. It
   cannot be dragged or rotated; only junk the visitor deliberately drops on
   it can cover it, and only for that session. */
(function () {
  var ID = 'jd-turn-object';       /* reserved: see the collision note above */
  var ASSET = '/art/junk-drawer/turn-object.svg';
  var SCATTER_KEY = 'jd-scatter-v2';   /* only to sweep a stale seat — see seat() */
  var FALLBACK_BOX = 15.5;         /* = BASE.m, for a drawer that failed to load */
  /* The 9a mockup's measurement note: at m × 1.15 the element lands 58×72px
     on a 375px phone — the same numbers the doorbell measured, because the
     candidate kept the 240×300 box precisely so this dial, GEOM and the
     corner reservation all carry over unchanged. Only 83% of that width is
     pressable housing (the outer band is halo light, pointer-events:none in
     the CSS), which is why the CSS touch floor rose 44 → 53px: 53px of
     element is 44px of plastic. */
  var FINE = 1.15;
  /* FIXED HARDWARE (owner revision, 2026-08-10): the turn button is screwed to
     the bottom-left corner of the drawer floor. It no longer scatters, drags,
     rotates, or persists a seat — same spot, every session, every device.
     Dead straight (rot 0), owner's call: it is a BUTTON in the corner, not a
     specimen pretending it was scattered — no tilt, and no hover grow either
     (see the :hover exemption in junk-drawer.css). */
  var CORNER = { inset: 0.035, rot: 0 };
  /* geometry the pile loader replays to reserve this corner from the scatter
     (loader: turnRect / JD_avoidTurn). aspect is the asset's 240×300
     viewBox — keep in step if the artwork's proportions ever change. */
  var GEOM = { id: 'jd-turn-object', fine: FINE, aspect: 240 / 300, inset: CORNER.inset };
  var Z_FIXED = 99;   /* over every scattered item (their z runs 1..N) and
                         under zTop (100+), where anything the visitor drags
                         goes — junk deliberately dropped on the button still
                         covers it, but a fresh scatter never buries it */
  var PRESS_MS = 640, PRESS_MS_CALM = 320, OPEN_MS = 200;

  var calm = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var art = null, box = null, armed = false, el = null;
  var pressTimer = 0, openTimer = 0, lastPress = -1e9;
  /* armed by a POINTER press, spent on the focus the modal hands back — the
     one blur/focus pair the visitor never asked for. See press(). */
  var quietRestore = false;

  /* THE BACKSTOP PLATE. turn-object.svg is now the ONLY way to take a turn —
     the corner button it replaced was static markup in index.php and could not
     fail to exist, so a fetch that never lands must not be allowed to remove
     the feature from the page. This is a credit button drawn inline, in the
     same 240×300 viewBox with the same geometry and class hooks (.cw-lens /
     .cw-glowcore / .cw-flash), so the tier math, the touch-floor arithmetic
     (housing at 83% of the box), the press keyframes and the reduced-motion
     pose all drive it unchanged. It is deliberately plain — flat fills, no
     halo, no bloom, no gradients — because its only job is to be unmistakably
     a pressable lit button on the day the artwork is missing. If a visitor
     ever sees it, the deploy is broken; the turn still works. */
  var FALLBACK_ART = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 300">',
    '<rect x="20" y="25" width="200" height="250" rx="20" fill="#2b2830"',
    ' stroke="#08070a" stroke-width="4"/>',
    '<rect x="46" y="54" width="148" height="192" rx="12" fill="#17151b"/>',
    '<g class="cw-lens">',
    '<rect x="54" y="62" width="132" height="176" rx="10" fill="#4fb2f2"',
    ' stroke="#093f78" stroke-width="3"/>',
    '<g class="cw-glowcore" opacity="0.55">',
    '<ellipse cx="120" cy="142" rx="66" ry="88" fill="#d9f1ff"/>',
    '</g>',
    '<g fill="#0a1626" font-weight="700" text-anchor="middle"',
    ' font-family="\'Arial Narrow\', \'Franklin Gothic Medium\', Impact, sans-serif">',
    '<rect x="78" y="88" width="84" height="10" rx="2"/>',
    '<rect x="78" y="104" width="84" height="10" rx="2"/>',
    '<text x="120" y="164" font-size="31" letter-spacing="1" textLength="104"',
    ' lengthAdjust="spacingAndGlyphs">PUSH FOR</text>',
    '<text x="120" y="216" font-size="50" letter-spacing="2" textLength="100"',
    ' lengthAdjust="spacingAndGlyphs">JUNK</text>',
    '</g>',
    '<rect class="cw-flash" x="54" y="62" width="132" height="176" rx="10"',
    ' fill="#ffffff" opacity="0" pointer-events="none"/>',
    '</g></svg>'
  ].join('');

  /* the asset request goes out immediately, in parallel with data.php — the
     trigger must not queue behind the collection (JD_fetchArt retries and
     refuses non-SVG bodies) — and whatever happens the object gets BUILT:
     out of tries, it is built on FALLBACK_ART instead. */
  JD_fetchArt({
    attr: 'data-jd-turn-object', asset: ASSET,
    onArt: function (text) { art = text; build(); },
    onFail: function (err) {
      /* worth saying out loud rather than failing silently — the drawer is
         now wearing the understudy */
      if (window.console && console.warn) {
        console.warn('junk drawer: the turn object did not load (' +
          err.message + ') — falling back to the inline plate');
      }
      art = FALLBACK_ART; build();
    }
  });

  /* called by the pile loader once the tier boxes are known (or once it has
     given up); `build` runs when BOTH the artwork and the ruler are in */
  function ready(tierBox) {
    box = (typeof tierBox === 'number' && tierBox > 0) ? tierBox : FALLBACK_BOX;
    armed = true;
    build();
  }

  function build() {
    if (el || !armed || !art) return;
    var pile = document.querySelector('.jd-pile');
    if (!pile || !window.JD_svgInst || !window.JD_applySize) return;
    el = document.createElement('div');
    el.className = 'jd-item jd-item--turn';
    el.dataset.id = ID;
    el.dataset.turn = 'object';       /* the one flag the pile branches on */
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-haspopup', 'dialog');
    el.setAttribute('aria-label', JD_STRINGS.turnButton);
    /* the same per-copy id namespacing every inlined SVG in this document
       gets — the asset's ids are all cw_ prefixed, its CLASS names are all
       cw- (hyphen), so the swap can never touch a hook the stylesheet needs */
    el.innerHTML = window.JD_svgInst(art, 'jto_');
    /* NO fitView here: turn-object.svg is controlled repo art whose frame is
       honest by construction — the reframe is for model-generated ink only */
    var svg = el.querySelector('svg');
    if (svg) {
      /* the wrapper is the button; the drawing must not announce itself twice */
      svg.removeAttribute('role');
      svg.removeAttribute('aria-label');
      svg.setAttribute('aria-hidden', 'true');
    }
    pile.appendChild(el);
    /* area-normalized on the shared ruler, with the SVG's own 240×300 aspect
       — the identical call a specimen gets */
    window.JD_applySize(el, box, ID, FINE);
    seat(el, pile);
    /* the reserved corner is exactly measurable only now — push any junk
       already lying on the plate clear of the real rect (closes the race
       between the pile's apply pass and this module's artwork fetch) */
    if (window.JD_enforceTurnCorner) window.JD_enforceTurnCorner();
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();          /* Space must not scroll the page */
        press(true);
      }
    });
    /* the pointer-focus flag is only good for as long as this focus lasts */
    el.addEventListener('blur', function () { el.classList.remove('is-tap'); });
    /* …except across the modal, which is the one blur the visitor did not
       ask for. press() arms this when the press came from a pointer; the
       modal takes focus (clearing the flag on the way in), and when it hands
       focus back here — by ✕, by scrim, by Escape — the flag is restored so
       a mouse round-trip lights nothing at all. It is consumed on that one
       focus, so the next Tab is a keyboard arrival like any other. */
    el.addEventListener('focus', function () {
      if (!quietRestore) return;
      quietRestore = false;
      el.classList.add('is-tap');
    });
    /* wired through the same pile plumbing as everything else — but the
       gesture code treats it as FIXED hardware: grip never lifts it, place()
       and every rotation path refuse it, settle() releases it unmoved. What
       remains of the shared wiring is exactly the tap. Idempotent, so the
       loader having already wired the collection costs nothing */
    if (window.JD_wirePile) window.JD_wirePile();
  }

  /* position: the fixed bottom-left corner, computed fresh every load from
     the well's live proportions — nothing stored, nothing to honour. The
     centre sits half the plate plus the inset off each wall, so it never
     lands guillotined at any viewport. Sessions from the draggable era may
     still carry a seat under our id in the pile's layout key; it is swept so
     the stored map holds only truths. */
  function seat(node, pile) {
    var host = pile.getBoundingClientRect(), r = node.getBoundingClientRect();
    var hw = Math.min(0.45, (r.width || 40) / 2 / (host.width || 1));
    var hh = Math.min(0.45, (r.height || 40) / 2 / (host.height || 1));
    node.style.left = ((hw + CORNER.inset) * 100).toFixed(2) + '%';
    node.style.top = ((1 - hh - CORNER.inset) * 100).toFixed(2) + '%';
    node.style.setProperty('--rot', CORNER.rot + 'deg');
    node.style.zIndex = Z_FIXED;
    var map = JD_store.get(SCATTER_KEY);
    if (map && map[ID]) { delete map[ID]; JD_store.set(SCATTER_KEY, map); }
  }

  /* THE PRESS. One class on the wrapper; junk-drawer.css owns every frame of
     it (the lens sinking a step into the housing, the backlight flaring
     white-hot, the halo surging off the plate) — and because the motion is
     CSS and not SMIL baked into the asset, prefers-reduced-motion can turn it
     into a discrete held state instead. The modal follows once the press has
     had time to READ; opening on the same tick would swallow it. */
  function press(viaKey) {
    if (!el) return;
    var now = Date.now();
    if (now - lastPress < 150) return;   /* one press per gesture */
    lastPress = now;
    /* a press puts the drawer down: any specimen still picked is dismissed
       (tag, elastic, zoom) before the modal covers the stage. It lives HERE
       rather than at the pointer call site so the keyboard path gets it too —
       Enter on a focused doorbell used to leave a picked specimen zoomed and
       tagged underneath the scrim, and still tagged after the modal closed. */
    if (window.JD_hideTag) window.JD_hideTag();
    JD_haptic('select');
    el.classList.remove('is-pressed');
    void el.offsetWidth;                 /* restart the keyframes */
    el.classList.add('is-pressed');
    window.clearTimeout(pressTimer);
    pressTimer = window.setTimeout(function () {
      el.classList.remove('is-pressed');
    }, (calm && calm.matches) ? PRESS_MS_CALM : PRESS_MS);
    /* Focus it before the modal opens: JD_turn records document.activeElement
       as the opener and hands focus back there on close, and the opener is
       this object now. A tap has to be focused EXPLICITLY — the wrapper is
       pointer-events:none (the ink takes the hit, see .jd-item), so a press
       on the artwork never focuses it natively the way a press on a <button>
       would. But Chromium matches :focus-visible on a programmatic focus, so
       doing that alone leaves a keyboard ring standing on the plate after a
       mouse click. Hence .is-tap.
       It DOES survive the modal (owner, 2026-08-15). It used not to: opening
       blurred the object and cleared the flag, so closing the prompt card —
       Escape especially, which leaves Chromium's last input modality set to
       keyboard — handed focus back to an object that then drew its focus
       state unbidden. The visitor pressed a button with a finger and got
       something they never asked for on the way out. `quietRestore` re-arms
       the flag on the ONE focus the modal returns (see the listener in
       ready()); a pointer round-trip therefore lights nothing, and a Tab
       after it is a keyboard arrival like any other and lights the lamp.
       Keyboard presses never arm it: Enter opened the card, so focus coming
       back must be visible. */
    if (viaKey) el.classList.remove('is-tap');
    else el.classList.add('is-tap');
    try { el.focus({ preventScroll: true }); } catch (e) {}
    /* set AFTER the focus above, which fires its own focus event — arming
       first would spend the flag on this press instead of on the return */
    quietRestore = !viaKey;
    window.clearTimeout(openTimer);
    openTimer = window.setTimeout(function () {
      if (window.JD_turn) window.JD_turn.open();
    }, OPEN_MS);
  }

  /* the pending modal open, stood down: called when the visitor grips some
     other item inside OPEN_MS of a press (see wireItem's pointerdown) */
  function standDown() { window.clearTimeout(openTimer); openTimer = 0; }

  window.JD_turnObject = {
    ready: ready, press: press, standDown: standDown, GEOM: GEOM
  };
})();

/* ---- THE INSTRUCTIONS SHEET — furniture in the pile (owner, 2026-08-28) --
   A torn scrap of paper carrying the drawer's how-to, in the turn object's
   tradition: injected here from a static asset (instructions-object.svg,
   cache-busted through index.php's $jd_assets like turn-object.svg), never
   an entry — no count line, no legend row, and data.php has never heard of
   it. One dataset flag, data-sheet="instructions", buys its one difference:
   a tap gives it the ordinary pick's in-place zoom-and-straighten — a bit
   bigger, upright, the pile dimmed but visible behind it — with NO specimen
   tag and NO report card (the data-sheet branch in pick(); a first draft
   lifted it onto the record card's full-screen reading layer, and the owner
   called it down the same day: in the drawer, over the junk, no graph-paper
   backdrop). Tap it again, tap away, Esc or resize puts it back — the
   standard dismissals, shared verbatim. Everything else is ordinary junk
   behaviour: it drags, twists, and settles like any scrap, and its seat
   persists in the session scatter like a won item's.

   ON TOP ON EVERY LOAD (the owner's one hard requirement): at build time
   it takes one MORE than the highest z already in the pile — above the
   fresh scatter (1..N), above the turn button's fixed 99, above restored
   won items (100) — and its stored seat never records a z, so no session
   can bury it across a reload. The button needs no z protection from
   this: its corner is a spatial reservation (turnRect/JD_avoidTurn) and
   the sheet is pushed clear of it like everything else. Junk the visitor
   DRAGS afterward rides the zTop counter past the sheet, so deliberately
   dropping a scrap on it covers it for that session — the turn button's
   own rule — and a reload deals the sheet back on top. Its load rotation
   is capped at a small tilt — a sheet you are meant to read arrives
   readable, not at the pile's full ±34°. */
(function () {
  var ID = 'jd-instructions';
  var ASSET = '/art/junk-drawer/instructions-object.svg';
  var SCATTER_KEY = 'jd-scatter-v2';   /* the shared seat map — see layoutFor */
  var FALLBACK_BOX = 30;               /* = BASE.xl, if the drawer never loaded */
  var Z_SHEET_MIN = 101;               /* floor: over scatter (1..N), the turn
                                          button (99) and restored wins (100)
                                          even if the pile reads empty */
  var ROT = 7;                         /* load tilt, ± degrees */
  var INSET = 0.012;                   /* same wall clearance as the scatter */

  var art = null, box = null, armed = false, el = null;

  /* the full text, for assistive tech: the artwork's <text> runs are
     aria-hidden with the rest of the svg, and this one string is what the
     wrapper actually says */
  var SHEET_TEXT = 'Instructions. 1: Dig around — drag the junk; twist it ' +
    'while held. 2: Tap an object for its specimen tag; REPORT CARD opens ' +
    'its full grades. 3: Press PUSH FOR JUNK and four AIs draw your idea — ' +
    'grade them blind, rank them, see who drew what; your pick joins the ' +
    'drawer.';

  /* fetched like the turn object's artwork, but with NO inline fallback: a
     drawer without its instructions still works — the sheet is furniture,
     not the feature — so a failed deploy just leaves the pile one scrap
     lighter and says so in the console. */
  JD_fetchArt({
    attr: 'data-jd-instructions', asset: ASSET,
    onArt: function (text) { art = text; build(); },
    onFail: function (err) {
      if (window.console && console.warn) {
        console.warn('junk drawer: the instructions sheet did not load (' +
          err.message + ')');
      }
    }
  });

  /* called by the pile loader with the xl tier box (or null when the drawer
     itself failed to load); `build` runs when both artwork and ruler are in */
  function ready(tierBox) {
    box = (typeof tierBox === 'number' && tierBox > 0) ? tierBox : FALLBACK_BOX;
    armed = true;
    build();
  }

  function build() {
    if (el || !armed || !art) return;
    var pile = document.querySelector('.jd-pile');
    if (!pile || !window.JD_svgInst || !window.JD_applySize) return;
    el = document.createElement('div');
    el.className = 'jd-item jd-item--sheet';
    el.dataset.id = ID;
    el.dataset.sheet = 'instructions';   /* the one flag the tap path branches on */
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Instructions — press to enlarge');
    el.innerHTML = window.JD_svgInst(art, 'jio_') +
      '<span class="jd-vh">' + SHEET_TEXT + '</span>';
    var svg = el.querySelector('svg');
    if (svg) svg.setAttribute('aria-hidden', 'true');
    pile.appendChild(el);
    /* NO fitView: controlled repo art, frame honest by construction (the
       turn object's rule) — sized on the shared ruler like everything else */
    window.JD_applySize(el, box, ID, 1);
    seat(el, pile);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        /* the keyboard reads as the tap does: larger, or back down. One
           dialog at a time still holds — a pick can't happen under a
           modal, and the sheet can't take focus while one is up anyway. */
        if (el.classList.contains('is-picked')) {
          if (window.JD_hideTag) window.JD_hideTag();
        } else if (window.JD_pick) {
          window.JD_pick(el);
        }
      }
    });
    /* ordinary pile plumbing — drag, twist, settle; the tap branch in
       wireItem is what routes a press here instead of pick() */
    if (window.JD_wirePile) window.JD_wirePile();
  }

  /* the seat: stable per session through the shared scatter map (layoutFor
     merges unknown ids forward, exactly as it keeps a won item's spot), a
     fresh gently-tilted spot otherwise. z is NEVER stored — pinned per load. */
  function seat(node, pile) {
    var host = pile.getBoundingClientRect(), r = node.getBoundingClientRect();
    var hw = Math.min(0.45, (r.width || 40) / 2 / (host.width || 1));
    var hh = Math.min(0.45, (r.height || 40) / 2 / (host.height || 1));
    var map = JD_store.get(SCATTER_KEY) || {};
    var p = map[ID];
    if (!p) {
      /* NOT the pile's anywhere-scatter (owner, 2026-08-28): the sheet
         deals centred on the x-axis (a whisper of jitter so it never reads
         machine-placed) and inside the well's upper two-thirds — the whole
         sheet, so its centre stays above 2/3 minus its own half-height.
         A sheet too tall for that band just centres in what room there is. */
      var loY = hh + INSET, hiY = Math.max(loY, 2 / 3 - hh);
      p = {
        x: +(0.5 + (Math.random() * 2 - 1) * 0.05).toFixed(4),
        y: +(loY + Math.random() * (hiY - loY)).toFixed(4),
        rot: +((Math.random() * 2 - 1) * ROT).toFixed(1)
      };
      map[ID] = p;
      JD_store.set(SCATTER_KEY, map);
    }
    /* pushed clear of the turn button's reserved corner at apply time, same
       as every other item; the stored seat itself stays untouched */
    var a = window.JD_avoidTurn ? window.JD_avoidTurn(p.x, p.y, hw, hh) : p;
    node.style.left = (a.x * 100) + '%';
    node.style.top = (a.y * 100) + '%';
    node.style.setProperty('--rot', (p.rot || 0) + 'deg');
    /* one more than whatever is already lying there — see the banner */
    var maxZ = 0;
    pile.querySelectorAll('.jd-item').forEach(function (n) {
      if (n === node) return;
      var z = parseInt(n.style.zIndex, 10) || 0;
      if (z > maxZ) maxZ = z;
    });
    node.style.zIndex = Math.max(Z_SHEET_MIN, maxZ + 1);
  }

  window.JD_sheet = { ready: ready };
})();

/* ---- THE ANALYTICS FOLDER — the drawer's own paperwork ---------------------
   (owner commission, 2026-08-28; the contract is PLAN-ANALYTICS §2–§3)

   A closed manila folder lying in the pile: furniture in the instructions
   sheet's and the turn object's tradition — a static asset
   (analytics-folder.svg, cache-busted through index.php's $jd_assets like
   its two siblings) injected from here, never an entry. data.php has never
   heard of it, it earns no count line and no legend row. One dataset flag,
   data-folder="analytics", buys its one difference: a tap does NOT pick it
   and never raises a specimen tag — it OPENS the folder into a dialog
   carrying the drawer's own numbers, so a curious visitor can see what is
   actually being measured.

   IT SCATTERS ANYWHERE, AT THE FULL TILT, AT AN ORDINARY z — and that is
   the deliberate opposite of the instructions sheet's rule two modules up.
   The sheet is signage: it has to be found, so it deals centred, nearly
   upright, and above everything on every load. The folder is junk that
   happens to be furniture. A visitor who buries it under a handful of
   scraps has done nothing wrong, and a reload will not dig it back out.

   THE DASHBOARD IS FETCHED LAZILY — on the first open only, then cached for
   the page life and re-rendered from cache on every open after. A visitor
   who never taps the folder never pays for the aggregate queries, and the
   drawer's own first paint is never behind them. A failed fetch renders a
   quiet mono note inside the open folder (the fallbackNote voice), never a
   broken dashboard.

   Charts are inline SVG strings built here from the payload, in the
   meterSVG/barHTML tradition at the top of this file: no libraries, no
   build step, everything interpolated through the local esc(). The design
   brief is Tufte × the drawer — no chart frames, no graph paper behind the
   marks, no legend where a direct label fits, value labels instead of axis
   ticks, and every chart's subtitle states its population honestly. The
   fun lives in the folder, the tab and the paper cards; the marks stay
   flat. */
(function () {
  /* BENCHED, not deleted (owner call, 2026-08-28, the darkroom pool's own
     terms): the folder does not appear in the drawer for now. Everything
     stands — the module, the dialog, the charts, analytics-folder.svg,
     api/jd-analytics.php, the tap branch, the loader's ready() calls —
     and flipping this ONE flag to false puts it back in the pile; nothing
     else needs touching. While true, the artwork is never even fetched. */
  var BENCHED = true;

  var ID = 'jd-analytics';
  var ASSET = '/art/junk-drawer/analytics-folder.svg';
  var API = '/api/jd-analytics.php';
  var SCATTER_KEY = 'jd-scatter-v2';   /* the shared seat map — see layoutFor */
  var FALLBACK_BOX = 22;               /* = BASE.l, if the drawer never loaded */
  var ROT = 34;                        /* the pile's own scatter range, ± deg */
  var Z_FOLDER = 50;                   /* above nothing in particular: it is
                                          ordinary junk, and it says so */
  var INSET = 0.012;                   /* same wall clearance as the scatter */

  var art = null, box = null, armed = false, el = null;
  var scrim = null, cardEl = null, bodyEl = null;
  var isOpen = false, lastFocus = null;
  var data = null, mmap = null, inflight = null, failed = false;

  /* the interpolations below are model labels and axis labels out of a JSON
     payload, and they go into both markup and SVG attribute values */
  var esc = JD_esc;

  /* fetched like the sheet's artwork, and with NO inline fallback for the
     same reason: a drawer without its folder still works — the numbers are
     a curiosity, not the feature — so a failed deploy leaves the pile one
     object lighter and says so in the console. */
  if (!BENCHED) {
    JD_fetchArt({
      attr: 'data-jd-analytics', asset: ASSET,
      onArt: function (text) { art = text; build(); },
      onFail: function (err) {
        if (window.console && console.warn) {
          console.warn('junk drawer: the analytics folder did not load (' +
            err.message + ')');
        }
      }
    });
  }

  /* called by the pile loader with the l tier box (or null when the drawer
     itself failed to load); `build` runs when both artwork and ruler are in */
  function ready(tierBox) {
    if (BENCHED) return;
    box = (typeof tierBox === 'number' && tierBox > 0) ? tierBox : FALLBACK_BOX;
    armed = true;
    build();
  }

  function build() {
    if (el || !armed || !art) return;
    var pile = document.querySelector('.jd-pile');
    if (!pile || !window.JD_svgInst || !window.JD_applySize) return;
    el = document.createElement('div');
    el.className = 'jd-item jd-item--folder';
    el.dataset.id = ID;
    el.dataset.folder = 'analytics';   /* the one flag the tap path branches on */
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Analytics — press to open the folder');
    el.innerHTML = window.JD_svgInst(art, 'jaf_');
    var svg = el.querySelector('svg');
    if (svg) svg.setAttribute('aria-hidden', 'true');
    pile.appendChild(el);
    /* NO fitView: controlled repo art, frame honest by construction (the
       turn object's rule) — sized on the shared ruler like everything else */
    window.JD_applySize(el, box, ID, 1);
    seat(el, pile);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();   /* or Space scrolls the page under the dialog */
        open();
      }
    });
    /* ordinary pile plumbing — drag, twist, settle; the tap branch in
       wireItem is what routes a press here instead of pick() */
    if (window.JD_wirePile) window.JD_wirePile();
  }

  /* the seat: stable per session through the shared scatter map (layoutFor
     merges unknown ids forward, exactly as it keeps a won item's spot), a
     fresh spot in the well's BOTTOM-RIGHT band otherwise (owner call,
     2026-08-28 — was anywhere-in-the-well), at the pile's full tilt.
     z is NEVER stored: it is pinned flat at Z_FOLDER on every load — the
     folder is ordinary junk, deliberately NOT the instructions sheet's
     always-on-top (owner, same call) — so a session can neither promote
     nor permanently entomb it. */
  function seat(node, pile) {
    var host = pile.getBoundingClientRect(), r = node.getBoundingClientRect();
    var hw = Math.min(0.45, (r.width || 40) / 2 / (host.width || 1));
    var hh = Math.min(0.45, (r.height || 40) / 2 / (host.height || 1));
    /* zone(): a centre inside [zoneLo..zoneHi] of the well on that axis,
       shrunk as needed so the whole object still clears the walls — the
       scatter's inside() rule with a band instead of the full run. The
       BOTTOM-RIGHT band is the owner's call (2026-08-28): the folder deals
       into the drawer's lower-right region — away from the sheet's
       upper-centre spawn and the turn button's lower-left corner — rather
       than anywhere in the well. JD_avoidTurn below still has the last
       word if a small well squeezes the bands toward the button. */
    function zone(half, zoneLo, zoneHi) {
      var lo = Math.max(half + INSET, zoneLo);
      var hi = Math.min(1 - half - INSET, zoneHi);
      if (hi < lo) { hi = lo = Math.max(half + INSET, Math.min(1 - half - INSET, (zoneLo + zoneHi) / 2)); }
      return +(lo + Math.random() * (hi - lo)).toFixed(4);
    }
    var map = JD_store.get(SCATTER_KEY) || {};
    var p = map[ID];
    if (!p) {
      p = {
        x: zone(hw, 0.58, 0.92), y: zone(hh, 0.58, 0.92),
        rot: +((Math.random() * 2 - 1) * ROT).toFixed(1)
      };
      map[ID] = p;
      JD_store.set(SCATTER_KEY, map);
    }
    /* pushed clear of the turn button's reserved corner at apply time, same
       as every other item; the stored seat itself stays untouched */
    var a = window.JD_avoidTurn ? window.JD_avoidTurn(p.x, p.y, hw, hh) : p;
    node.style.left = (a.x * 100) + '%';
    node.style.top = (a.y * 100) + '%';
    node.style.setProperty('--rot', (p.rot || 0) + 'deg');
    node.style.zIndex = Z_FOLDER;
  }

  /* ---- the data ----------------------------------------------------------
     One fetch per page life. `failed` is sticky on purpose: a visitor who
     opens the folder again after the endpoint fell over gets the note back
     immediately rather than a second spinner and a second dead request. */
  function load() {
    if (inflight) return;
    inflight = fetch(JD_API + API)
      .then(function (r) {
        if (!r.ok) throw new Error(API + ' ' + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.ok) throw new Error(API + ' answered without ok:true');
        data = j; indexModels(); inflight = null;
        if (isOpen) render();
      })
      .catch(function (err) {
        failed = true; inflight = null;
        if (window.console && console.warn) {
          console.warn('junk drawer: the analytics folder is empty (' +
            err.message + ')');
        }
        if (isOpen) render();
      });
  }

  /* ---- ONE COLOR PER MODEL, EVERYWHERE (the brief's hardest line) ---------
     A fixed ordered list of print inks chosen to sit on warm paper, assigned
     by POSITION — but position among the models that actually DRAW a
     colored mark, not position in the payload's models[] array (design
     review, 2026-08-28). The registry carries models that appear in no
     chart, or only in rows the MIN_N filter drops; letting those consume
     inks pushed the visible marks down the list and landed cobalt next to
     slate teal, which is the one adjacency this palette cannot survive.
     Walking data.models order and handing the next ink to each model that
     survives into cost, firsts or a plotted axis row keeps the top of the
     list — the maximally separated end — doing the work, and still gives a
     model the SAME ink in the cost bars, the first-place bars and all four
     axis panels, which is what makes the small multiples readable without a
     legend in every panel. The grade book is the one chart that does NOT
     use these — a grade has its own meaning-carrying ramp (worst→best) and
     the model's identity is already in its label — so it consumes no ink. */
  var PALETTE = ['#b8541f',   /* burnt orange */
                 '#1f7a63',   /* teal green */
                 '#2b5aa3',   /* cobalt */
                 '#7a3b66',   /* plum */
                 '#6f7a1e',   /* olive */
                 '#9b2d3a',   /* crimson */
                 '#46707a',   /* slate teal */
                 '#8a6a1a'];  /* bronze */
  /* the report card's worst→best grade ramp, copied from meterSVG at the top
     of this file — the grade book has to speak the ramp visitors already
     learned on the specimen tag */
  var RAMP = ['#8f1d12', '#b0490f', '#a06200', '#46761a', '#0b6a1f'];

  function indexModels() {
    mmap = {};
    /* the marked set: every model that will put a colored rect or dot on
       the page. The axes contribute only rows that survive MIN_N, because a
       dropped row draws nothing and an ink spent on it is an ink wasted. */
    var marked = {};
    (data.cost || []).forEach(function (c) { marked[c.model_id] = 1; });
    (data.firsts || []).forEach(function (f) { marked[f.model_id] = 1; });
    (data.axes || []).forEach(function (ax) {
      (ax.models || []).forEach(function (r) {
        if ((+r.n || 0) >= MIN_N) marked[r.model_id] = 1;
      });
    });
    var ink = 0;
    (data.models || []).forEach(function (m) {
      mmap[m.model_id] = {
        label: m.label || m.model_id,
        /* unmarked models get no ink at all — mColor's warm-brown fallback
           covers them if one ever does reach a mark */
        color: marked[m.model_id] ? PALETTE[ink++ % PALETTE.length] : null
      };
    });
  }
  function mLabel(id) { return (mmap && mmap[id] && mmap[id].label) || id; }
  function mColor(id) { return (mmap && mmap[id] && mmap[id].color) || '#5b4526'; }

  /* Direct labels only work if they FIT: the gutter is a fixed number of user
     units and SVG text does not wrap or clip itself — an over-long name just
     runs off the left of the viewBox and is silently beheaded (which is what
     "Claude Sonnet 5 → Opus 5 refine" did on first paint). One step down in
     size buys the long names most of their length back; past that they are
     truncated with an ellipsis, and the chart's aria-label still carries
     every name in full. */
  function labFor(id) {
    var s = mLabel(id);
    if (s.length <= 17) return { t: s, cls: 'fx-t-lab' };
    return { t: s.length > 22 ? s.slice(0, 21) + '…' : s, cls: 'fx-t-lab is-long' };
  }
  function keyFor(id) {
    var s = mLabel(id);
    return s.length > 14 ? s.slice(0, 13) + '…' : s;
  }

  /* ---- chart geometry ----------------------------------------------------
     Every bar chart shares ONE ruler (user units, viewBox width W): the same
     label gutter, the same bar origin and the same maximum bar length, so
     cost, firsts and grades stack as three readings of one instrument
     rather than three drawings. The CSS caps the rendered width, which is
     what keeps the type near its natural size at every card width instead
     of ballooning with the column. */
  var W = 340;        /* bar-chart viewBox width */
  var LAB = 104;      /* the label gutter's right edge */
  var BAR0 = 110;     /* where every bar and every track starts */
  var BARW = 118;     /* the longest bar / the full 5-segment track */
  var ROWH = 21;
  /* the axis panels are narrower than they were (design review, 2026-08-28):
     the old 200-unit box rendered its type a full step below the bar
     charts', and three of the four panels were paying for a key gutter that
     CSS then hid. PW/PLAB/PX0/PXW all come down together so the ruler keeps
     its proportions while the rendered px-per-unit goes up. */
  var PW = 172;       /* an axis panel's viewBox width */
  var PLAB = 62,      /* the key gutter's right edge — also the crop line for
                         panels 2–4, which drop the gutter entirely */
      PX0 = 68, PXW = 84, PROWH = 15;
  /* PXW 90 → 84 (2026-08-28): a dot at the scale's CEILING sat at the
     ruler's end, 158, and painted over the head of its own value label
     (anchored end at 170 — "3.0" read ".0"). Ending the ruler at 152 buys
     the label its clearance at every value the scale can produce; every
     panel shares the constant, so the rulers stay geometrically identical. */
  /* below this a mean is one person's opinion, not a reading */
  var MIN_N = 3;

  function num(n) {
    return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function day(iso) { return String(iso || '').slice(0, 10); }

  function cardHTML(cls, title, sub, inner) {
    return '<section class="fx-card ' + cls + '">' +
      '<h3 class="fx-title">' + esc(title) + '</h3>' +
      '<p class="fx-sub">' + esc(sub) + '</p>' + inner + '</section>';
  }

  /* the footnote a MIN_N drop owes the reader: the models left off this
     chart, each named with the n that disqualified it. Dropping them in
     silence would read as "these models have no data", which is a different
     and false claim — the subtitle is the only place that can say so. */
  function notPlotted(list) {
    if (!list || !list.length) return '';
    return ' — not plotted: ' + list.map(function (x) {
      return mLabel(x.id) + ' (n ' + num(x.n) + ')';
    }).join(', ');
  }

  /* THE LEDGER — four figures, not a chart. Tufte's own rule: a handful of
     numbers is a table, and a table beats a graph of it.

     ITS FOUR FIGURES SPAN TWO POPULATIONS and the subtitle has to say so
     (design review, 2026-08-28 — it used to read "everything on file",
     which is true of nothing here). Turns and drawings are visitor turns
     only: the curated backfill sits at status='generated' forever and never
     was a turn. Ratings count the CURRENT RUBRIC only (owner call,
     2026-08-28 — the endpoint's v17+ era gate; the old demo-era grades
     re-enter by re-rating). Spend includes the curated bench, because its
     generations cost real money whatever rubric was live. Four figures
     under one honest line beats four figures under a wrong one. */
  function ledgerHTML() {
    var t = data.totals || {};
    function fig(v, label) {
      return '<div class="fx-fig"><span class="fx-fig-v">' + esc(v) + '</span>' +
        '<span class="fx-fig-l">' + esc(label) + '</span></div>';
    }
    return '<section class="fx-card fx-ledger">' +
      '<div class="fx-figs">' +
        fig(num(t.turns), 'turns taken') +
        fig(num(t.survived), 'drawings survived') +
        fig(num(t.rated_responses), 'responses rated') +
        fig('$' + (+t.cost_usd || 0).toFixed(2), 'provider spend') +
      '</div>' +
      '<p class="fx-sub fx-ledger-sub">turns and drawings are visitor ' +
        'turns; the model charts count the current rubric and the four-model ' +
        'turns only — the older corpus was never a controlled comparison; ' +
        'spend includes the curated bench — counted ' +
        esc(day(data.generated)) + '</p>' +
      '</section>';
  }

  /* the shared horizontal-bar drawing. rows: {id, v, value, tail} — v sets
     the length (scaled to the largest v in THIS chart, never across charts:
     dollars and rates are different quantities), value is printed at the
     bar's end, tail is the optional small figure at the right margin. */
  function barsSVG(rows, alt) {
    var h = rows.length * ROWH + 6, max = 0, s = '';
    rows.forEach(function (r) { if (r.v > max) max = r.v; });
    if (max <= 0) max = 1;
    rows.forEach(function (r, i) {
      var y = 4 + i * ROWH;
      var w = Math.max(1.5, BARW * r.v / max);
      var lb = labFor(r.id);
      s += '<text x="' + (LAB - 8) + '" y="' + (y + 10.4) +
           '" text-anchor="end" class="' + lb.cls + '">' + esc(lb.t) + '</text>' +
           '<rect x="' + BAR0 + '" y="' + (y + 1.5) + '" width="' + w.toFixed(1) +
           '" height="11" fill="' + mColor(r.id) + '"/>' +
           '<text x="' + (BAR0 + w + 5).toFixed(1) + '" y="' + (y + 10.6) +
           '" class="fx-t-val">' + esc(r.value) + '</text>';
      if (r.tail) {
        s += '<text x="' + (W - 2) + '" y="' + (y + 10.4) +
             '" text-anchor="end" class="fx-t-tail">' + esc(r.tail) + '</text>';
      }
    });
    return '<svg class="fx-chart" viewBox="0 0 ' + W + ' ' + h +
      '" role="img" aria-label="' + esc(alt) + '">' + s + '</svg>';
  }
  function altOf(title, rows) {
    return title + '. ' + rows.map(function (r) {
      return mLabel(r.id) + ', ' + r.value + (r.tail ? ', ' + r.tail : '');
    }).join('. ');
  }

  /* WHAT A DRAWING COSTS — pre-sorted by the endpoint, descending; the order
     is the finding, so it is never re-sorted here. Three decimals, not four
     (design review, 2026-08-28): $0.0479 is a claim about the fourth digit
     that an n of 86 across two model versions does not earn, and the
     endpoint's own figure is untouched — this is a printing decision. */
  function costHTML() {
    var src = data.cost || [];
    if (!src.length) return '';
    var rows = src.map(function (c) {
      return { id: c.model_id, v: +c.avg_usd || 0,
               value: '$' + (+c.avg_usd || 0).toFixed(3),
               tail: 'n ' + num(c.n) };
    });
    return cardHTML('fx-cost', 'What a drawing costs',
      'average provider cost per surviving response, every harness, the ' +
      'curated bench included',
      barsSVG(rows, altOf('Average cost per surviving response', rows)));
  }

  /* WHO TAKES FIRST — the BAR is the rate, so the number AT the bar's end is
     the rate too (design review, 2026-08-28). It used to print the raw count
     there, which put "8 of 22" at the end of a bar longer than the one
     ending "9 of 31" — a longer mark carrying a smaller printed number is
     the one thing a bar chart may never do. The count has not gone away and
     must not: a rate off 22 turns and a rate off 31 are not the same claim,
     so it moves to the tail column, in the cost card's "n 86" seat. */
  function firstsHTML() {
    var src = data.firsts || [];
    if (!src.length) return '';
    var rows = src.map(function (f) {
      return { id: f.model_id, v: +f.rate || 0,
               value: Math.round((+f.rate || 0) * 100) + '%',
               tail: num(f.firsts) + ' of ' + num(f.judged) };
    });
    return cardHTML('fx-firsts', 'Who takes first',
      'first place on judged visitor turns; the denominator is the turns ' +
      'that model survived',
      barsSVG(rows, altOf('First place on judged visitor turns', rows)));
  }

  /* THE GRADE BOOK — the report card's segmented gauge, rebuilt at chart
     size: a 5-segment track filled to the mean in the grade ramp's ink and
     the paper-coloured dividers drawn OVER the fill (battery-style, so a
     nearly full bar still reads as its segments).

     THREE THINGS THE FIRST BUILD GOT WRONG (design review, 2026-08-28):

     - The empty part of the track drew nothing, so a 1.9 showed one short
       segment and four units of blank paper — the reader could not see what
       the mark was short OF. The dividers past the fill edge now draw in
       the faint rule instead of the paper (fx-seg-out), so all five
       segments stand whether or not they are filled.
     - An ink tick was drawn at the fill edge. The fill edge already IS the
       mean, to the pixel — the tick restated it and encoded nothing. Gone.
     - The full-track outline was stroked in the GRADE ink, which drew a red
       rectangle the whole width of the track for a 1.9 and let it read as a
       full red bar at a glance. The outline is scaffolding; only the fill
       carries the datum, so the outline is now the same neutral brown at
       every grade. */
  function gradesHTML() {
    var src = data.grades || [];
    if (!src.length) return '';
    var STEPS = 5;   /* the permanent 1..5 rank scale (PLAN-ANALYTICS §1) */
    /* MIN_N: a mean over one or two ratings is a person, not a reading, and
       a grade bar states it with the same authority as a mean over forty.
       Dropped rows are named in the subtitle rather than vanishing. */
    var rows = [], dropped = [];
    src.forEach(function (g) {
      if ((+g.n || 0) < MIN_N) dropped.push({ id: g.model_id, n: +g.n || 0 });
      else rows.push(g);
    });
    if (!rows.length) return '';
    var s = '', alt = [];
    rows.forEach(function (g, i) {
      var v = Math.max(1, Math.min(STEPS, +g.avg || 1));
      var y = 4 + i * ROWH;
      /* the ramp tier is the WHOLE grade the mean sits in — floor, not a
         rescale-and-round, which put the tier boundaries at 1.5/2.5/… and
         coloured a 3.4 and a 3.6 differently for no reason a reader of the
         1–5 scale could name */
      var ink = RAMP[Math.min(4, Math.max(0, Math.floor(v) - 1))];
      var w = BARW * v / STEPS;
      var lb = labFor(g.model_id);
      s += '<text x="' + (LAB - 8) + '" y="' + (y + 10.4) +
           '" text-anchor="end" class="' + lb.cls + '">' + esc(lb.t) + '</text>' +
           '<rect x="' + BAR0 + '" y="' + (y + 1.5) + '" width="' + w.toFixed(1) +
           '" height="11" fill="' + ink + '"/>';
      for (var t = 1; t < STEPS; t++) {
        var tx = BAR0 + BARW * t / STEPS;
        s += '<line x1="' + tx.toFixed(1) + '" y1="' + (y + 1.5) + '" x2="' +
             tx.toFixed(1) + '" y2="' + (y + 12.5) + '" class="' +
             (tx <= BAR0 + w ? 'fx-seg' : 'fx-seg-out') + '"/>';
      }
      s += '<rect x="' + BAR0 + '" y="' + (y + 1.5) + '" width="' + BARW +
           '" height="11" fill="none" stroke="rgba(74,53,18,0.28)" ' +
           'stroke-width="1"/>' +
           '<text x="' + (BAR0 + BARW + 7) + '" y="' + (y + 10.6) +
           '" class="fx-t-val">' + v.toFixed(1) + ' of ' + STEPS + '</text>' +
           '<text x="' + (W - 2) + '" y="' + (y + 10.4) +
           '" text-anchor="end" class="fx-t-tail">n ' + esc(num(g.n)) + '</text>';
      alt.push(mLabel(g.model_id) + ', ' + v.toFixed(1) + ' of ' + STEPS +
        ', n ' + num(g.n));
    });
    var svg = '<svg class="fx-chart" viewBox="0 0 ' + W + ' ' +
      (rows.length * ROWH + 6) + '" role="img" aria-label="' +
      esc('Average overall grade. ' + alt.join('. ')) + '">' + s + '</svg>';
    return cardHTML('fx-grades', 'The grade book',
      /* "current rubric" = the v17 rework onward — the endpoint's era gate
         (owner call, 2026-08-28): pre-v17 grades are the old demo era and
         re-enter by being re-rated, never by being grandfathered */
      'average overall grade on the 1–5 scale, every rating filed under ' +
      'the current rubric, n ' + MIN_N + ' and up' +
      notPlotted(dropped), svg);
  }

  /* THE FOUR AXES — small multiples. models[] arrives in the global models[]
     order inside every panel, deliberately, and is NOT re-sorted here: a row
     has to mean the same model in all four panels or the comparison the
     panels exist for is a lie. The scales are NEVER normalized together —
     a 3-point axis and a 4-point axis are different rulers, and each panel
     states its own.

     THE KEY GUTTER IS PAID FOR ONCE (design review, 2026-08-28). The key is
     still drawn into EVERY panel, so all four keep byte-identical geometry
     — that is what makes them small multiples — but only the lead panel
     shows the gutter: panels 2–4 crop it out of their viewBox at PLAB, so
     their whole width goes to the ruler instead of to reserved white space.
     Same user units, same ruler, three-quarters less waste; the CSS caps
     each panel's rendered width in the same proportion, so the px-per-unit
     is identical across all four and the type does not change size from
     panel to panel.

     MIN_N applies here too: a row whose n is 1 or 2 is dropped before the
     loop, so a panel never plots a dot it cannot stand behind, and the
     dropped models are named in the card's subtitle. */
  function axesHTML() {
    var axes = data.axes || [];
    if (!axes.length) return '';
    /* worst case per model across the four axes — if even its largest n is
       under the floor, the model is nowhere on this card and is named */
    var thin = {}, dropped = [];
    axes.forEach(function (ax) {
      (ax.models || []).forEach(function (r) {
        var n = +r.n || 0;
        if (n >= MIN_N) { thin[r.model_id] = -1; return; }
        if (thin[r.model_id] !== -1) {
          thin[r.model_id] = Math.max(thin[r.model_id] || 0, n);
        }
      });
    });
    Object.keys(thin).forEach(function (id) {
      if (thin[id] !== -1) dropped.push({ id: id, n: thin[id] });
    });
    /* when NO model clears the floor on ANY axis, the card omits itself —
       the empty-payload discipline firsts and the grade book already keep.
       Four bare rulers with no dots read as a rendering failure, and a
       young database (or the dev sandbox) sits in exactly that state. */
    var anyRow = axes.some(function (ax) {
      return (ax.models || []).some(function (r) { return (+r.n || 0) >= MIN_N; });
    });
    if (!anyRow) return '';
    var panels = axes.map(function (ax, pi) {
      var pts = +ax.points || 3;
      var rows = (ax.models || []).filter(function (r) {
        return (+r.n || 0) >= MIN_N;
      });
      var h = 8 + rows.length * PROWH + 14, s = '', key = '', alt = [];
      rows.forEach(function (r, i) {
        var y = 8 + i * PROWH + PROWH / 2;
        var v = Math.max(1, Math.min(pts, +r.avg || 1));
        var x = PX0 + PXW * (pts > 1 ? (v - 1) / (pts - 1) : 1);
        s += '<line x1="' + PX0 + '" y1="' + y + '" x2="' + (PX0 + PXW) +
             '" y2="' + y + '" class="fx-track"/>' +
             '<circle cx="' + x.toFixed(1) + '" cy="' + y + '" r="3.4" fill="' +
             mColor(r.model_id) + '"/>' +
             '<text x="' + (PW - 2) + '" y="' + (y + 2.6) +
             '" text-anchor="end" class="fx-t-axval">' + v.toFixed(1) + '</text>';
        key += '<text x="' + PLAB + '" y="' + (y + 2.6) +
               '" text-anchor="end" class="fx-t-key">' +
               esc(keyFor(r.model_id)) + '</text>';
        alt.push(mLabel(r.model_id) + ' ' + v.toFixed(1));
      });
      var base = 8 + rows.length * PROWH + 9;
      s += '<text x="' + PX0 + '" y="' + base + '" class="fx-t-scale">1</text>' +
           '<text x="' + (PX0 + PXW) + '" y="' + base +
           '" text-anchor="end" class="fx-t-scale">' + pts + '</text>';
      /* the lead panel keeps the whole box, key gutter and all; every panel
         after it starts its viewBox at the gutter's right edge, which shows
         the identical ruler and simply never renders the key it carries */
      var vb = pi === 0 ? '0 0 ' + PW + ' ' + h
                        : PLAB + ' 0 ' + (PW - PLAB) + ' ' + h;
      return '<div class="fx-panel"><h4>' + esc(ax.label) +
        ' <span class="fx-of">of ' + pts + '</span></h4>' +
        '<svg viewBox="' + vb + '" role="img" aria-label="' +
        esc(ax.label + ', 1 to ' + pts + '. ' + alt.join('. ')) + '">' +
        '<g class="fx-key">' + key + '</g>' + s + '</svg></div>';
    }).join('');
    return cardHTML('fx-axes', 'The four axes',
      'average per axis, every rating filed under the current rubric, ' +
      'live axes only, n ' + MIN_N +
      ' and up — each panel is its own ruler and the scales are never ' +
      'pooled' + notPlotted(dropped),
      '<div class="fx-axgrid">' + panels + '</div>');
  }

  /* THE METER RUNS — one ink line, cumulative, x spaced by real DATE (not by
     row index: the drawer is not used every day, and index spacing would
     quietly redraw a quiet fortnight as steady work). No y axis, no
     gridlines: the ends are labelled and the total is printed where the line
     stops, which is the whole reading. Sparkline humility.

     ITS BOX IS ITS OWN, NOT the bar charts' W (design review, 2026-08-28).
     The line has no label gutter and no tail column, so borrowing the
     340-unit bar box left it stopping two-thirds of the way across its card
     with a quarter of the paper blank. W2 is exactly what the line needs:
     the x0/x1/y0/y1 constants below are untouched — this widens nothing and
     redraws nothing, it just stops reserving room the chart never used. */
  function spendHTML() {
    var rows = data.spend || [];
    if (!rows.length) return '';
    var x0 = 6, x1 = 264, y0 = 16, y1 = 84, H2 = 112, W2 = 306;
    var max = 0;
    rows.forEach(function (r) { if ((+r.cum_usd || 0) > max) max = +r.cum_usd; });
    if (max <= 0) max = 1;
    function dnum(s) {
      var t = Date.parse(String(s) + 'T00:00:00Z');
      return isNaN(t) ? 0 : t / 86400000;
    }
    var d0 = dnum(rows[0].date), span = dnum(rows[rows.length - 1].date) - d0;
    function px(r) { return span > 0 ? x0 + (x1 - x0) * (dnum(r.date) - d0) / span : x1; }
    function py(v) { return y1 - (y1 - y0) * ((+v || 0) / max); }
    var d = rows.map(function (r, i) {
      return (i ? 'L' : 'M') + px(r).toFixed(1) + ' ' + py(r.cum_usd).toFixed(1);
    }).join(' ');
    var last = rows[rows.length - 1];
    var lx = px(last), ly = py(last.cum_usd);
    var s = (rows.length > 1
        ? '<path d="' + d + '" class="fx-line"/>'
        : '') +
      '<circle cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) +
      '" r="2.6" class="fx-dot"/>' +
      '<text x="' + (lx + 6).toFixed(1) + '" y="' + (ly + 3.4).toFixed(1) +
      '" class="fx-t-val">$' + max.toFixed(2) + '</text>' +
      '<text x="' + x0 + '" y="' + (H2 - 6) + '" class="fx-t-scale">' +
      esc(day(rows[0].date)) + '</text>' +
      '<text x="' + x1 + '" y="' + (H2 - 6) +
      '" text-anchor="end" class="fx-t-scale">' + esc(day(last.date)) + '</text>';
    return cardHTML('fx-spend', 'The meter runs',
      'cumulative provider spend, every model and harness, on the ' +
      num(rows.length) + ' days with any',
      '<svg class="fx-chart" viewBox="0 0 ' + W2 + ' ' + H2 +
      '" role="img" aria-label="' +
      esc('Cumulative provider spend from ' + day(rows[0].date) + ' to ' +
        day(last.date) + ', ending at $' + max.toFixed(2)) + '">' + s + '</svg>');
  }

  /* ---- the dialog: the folder OPENED ------------------------------------
     JD_record's scrim + card. THE HEAD IS A SLIM BAND (owner calls,
     2026-08-28, two rounds): "The drawer, by the numbers" and its dek
     were cut as unnecessary — the cards say the rest — but cutting the
     WHOLE band left the ✕ floating over the ledger's big figures, so
     the band came back at tab height: the small ANALYTICS tab on the
     left, the ✕ seated on the right, no title, no dek. No
     history/pushState: the record card needs deep links because a
     report card is a thing you send someone; the folder is a drawer
     you opened. */
  function buildDialog() {
    if (scrim) return;
    scrim = document.createElement('div');
    scrim.className = 'jd-folder-scrim';
    scrim.innerHTML =
      '<div class="jd-folder-card" role="dialog" aria-modal="true" ' +
      'aria-label="analytics">' +
        '<div class="jd-folder-head">' +
          '<div class="jd-folder-tabrow">' +
            '<span class="jd-folder-tab">ANALYTICS</span></div>' +
          '<button type="button" class="jd-folder-close" aria-label="close">' +
          '<span>✕</span></button>' +
        '</div>' +
        '<div class="jd-folder-scroll"></div>' +
      '</div>';
    document.body.appendChild(scrim);
    cardEl = scrim.querySelector('.jd-folder-card');
    bodyEl = scrim.querySelector('.jd-folder-scroll');
    scrim.addEventListener('pointerdown', function (e) {
      if (e.target === scrim) close();
    });
    scrim.querySelector('.jd-folder-close').addEventListener('click', close);
  }

  function render() {
    if (!bodyEl) return;
    if (!data) {
      /* the fallbackNote voice: say what did not answer, name the file, and
         stop — a half-drawn dashboard would be worse than none */
      bodyEl.innerHTML = '<p class="fx-stuck">the paperwork is stuck — the ' +
        'numbers load from jd-analytics.php, which did not answer</p>';
      return;
    }
    bodyEl.innerHTML = ledgerHTML() + costHTML() + firstsHTML() +
      gradesHTML() + axesHTML() + spendHTML();
  }

  function open() {
    if (isOpen || !el) return;
    /* ONE MODAL AT A TIME (C5.4): two aria-modal dialogs on one page is a
       trap, and whichever is up owns Escape. Both of the others carry the
       mirror-image line for this folder. */
    if (window.JD_record && window.JD_record.isOpen()) return;
    if (window.JD_turn && window.JD_turn.isOpen()) return;
    /* a live specimen tag belongs to the pile, not under this dialog */
    if (window.JD_hideTag) window.JD_hideTag();
    buildDialog();
    lastFocus = document.activeElement;
    isOpen = true;
    scrim.classList.add('is-on');
    document.documentElement.classList.add('jd-folder-open');
    cardEl.classList.remove('is-enter');
    void cardEl.offsetWidth;
    cardEl.classList.add('is-enter');
    if (data || failed) render();
    else {
      bodyEl.innerHTML = '<p class="fx-stuck">pulling the file&hellip;</p>';
      load();
    }
    var b = scrim.querySelector('.jd-folder-close');
    if (b) { try { b.focus(); } catch (e) {} }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    scrim.classList.remove('is-on');
    document.documentElement.classList.remove('jd-folder-open');
    /* home is the folder itself: a pointer tap leaves activeElement on
       <body>, and dumping focus there would send the next Tab back to the
       top of the page instead of to the object the visitor just closed */
    var back = (lastFocus && lastFocus !== document.body &&
                document.contains(lastFocus)) ? lastFocus : el;
    if (back) { try { back.focus({ preventScroll: true }); } catch (e) {} }
    lastFocus = null;
  }

  /* Escape closes. Guarded on isOpen so it is a claim on the key only while
     the folder is actually up — the pile's own Escape handler is already
     standing down for that whole time (JD_layerOpen). */
  window.addEventListener('keydown', function (e) {
    if (!isOpen || e.key !== 'Escape') return;
    e.preventDefault();
    close();
  });

  window.JD_folder = {
    ready: ready,
    open: open,
    close: close,
    isOpen: function () { return isOpen; }
  };
})();
