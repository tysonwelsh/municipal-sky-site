/* ============================================================================
   THE JUNK DRAWER — jd-furniture.js
   The three pieces of furniture in the pile, each a static SVG asset
   fetched through JD_fetchArt (jd-core.js) and injected as a .jd-item that
   data.php has never heard of: the turn object, the instructions sheet and
   the (benched) analytics folder. Loaded after jd-core.js; each module
   waits for the pile loader's ready() call with the tier ruler before it
   builds. See jd-core.js for the file map.
   ========================================================================== */

/* ONE SCOPE AROUND THE THREE (2026-10-01, refactor — no behaviour of its
   own). The three modules below are still three IIFEs, run in the same
   order; this outer one only gives them somewhere to share the skeleton
   they all repeated without making a new global: the tier-box fallback,
   the furniture element, the Enter/Space press, the load warning, and —
   for the sheet and the folder — the seat's half-sizes and its apply.
   They are small helpers, not a factory, so each module still makes its
   calls in its own order (the sheet sizes before it appends; the turn
   object strips its drawing's role; the folder pins its z). */
(function () {
  /* the tier box the pile loader handed over, or the module's own fallback
     when that is not a usable box. A drawer that failed to load no longer
     hands over null: the loader's catch passes jd-core's BASE value for the
     tier — the same number each module keeps as its FALLBACK_BOX */
  function tierOr(tierBox, fallback) {
    return (typeof tierBox === 'number' && tierBox > 0) ? tierBox : fallback;
  }
  /* a piece of furniture's wrapper: a .jd-item the pile wires like any
     other, a real button to the tree. `flags` are its dataset flags, set in
     the order given — the one the tap path branches on first (attribute
     order is markup; the caller adds its own aria after) */
  function makeItem(cls, id, flags) {
    var node = document.createElement('div');
    node.className = 'jd-item ' + cls;
    node.dataset.id = id;
    Object.keys(flags).forEach(function (k) { node.dataset[k] = flags[k]; });
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    return node;
  }
  /* Enter or Space presses the furniture like the button it claims to be;
     preventDefault, or Space scrolls the page */
  function onActivate(node, fn) {
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        fn();
      }
    });
  }
  /* an asset that never landed says so in the console, by name */
  function warnFail(what, err, tail) {
    if (window.console && console.warn) {
      console.warn('junk drawer: the ' + what + ' did not load (' +
        err.message + ')' + (tail || ''));
    }
  }
  /* a seat's half-sizes, as fractions of the well (a node or well not yet
     measured reads as 40px / 1px, and no half exceeds 0.45) */
  function halfSizes(node, pile) {
    var host = pile.getBoundingClientRect(), r = node.getBoundingClientRect();
    return {
      hw: Math.min(0.45, (r.width || 40) / 2 / (host.width || 1)),
      hh: Math.min(0.45, (r.height || 40) / 2 / (host.height || 1))
    };
  }
  /* the seat applied: pushed clear of the turn button's reserved corner at
     apply time, same as every other item; the stored seat itself stays
     untouched */
  function applySeat(node, p, hw, hh) {
    var a = window.JD_avoidTurn ? window.JD_avoidTurn(p.x, p.y, hw, hh) : p;
    node.style.left = (a.x * 100) + '%';
    node.style.top = (a.y * 100) + '%';
    node.style.setProperty('--rot', (p.rot || 0) + 'deg');
  }

  /* ---- THE TURN OBJECT — the credit button in the pile (PLAN-TURN-OBJECT) --
     The Take-a-Turn trigger is HARDWARE IN THE DRAWER: candidate 9a won mockup
     round 9 (2026-08-11, replacing round 8's doorbell, which camouflaged too
     well) — a backlit arcade credit button, charcoal coin-door housing, glowing
     blue lens with PUSH / 4 MORE / JUNK printed on the glass, throwing a pool of light
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
    var FALLBACK_BOX = 15.5;         /* = BASE.m, for a drawer that failed to load */
    /* The 9a mockup's measurement note: at m × 1.15 the element lands 58×72px
       on a 375px phone — the same numbers the doorbell measured, because the
       candidate kept the 240×300 box precisely so this dial, GEOM and the
       corner reservation all carry over unchanged. Only 83% of that width is
       pressable housing (the outer band is halo light, pointer-events:none in
       the CSS), which is why the CSS touch floor rose 44 → 53px: 53px of
       element is 44px of plastic.
       RAISED 1.15 → 1.5 on 2026-09-10 (owner: "bigger", with the relettered
       PUSH / 4 MORE / JUNK lens): ~30% more on each side, so the phone
       measurement above reads ~76×95px now. GEOM carries the same dial, so
       the corner the scatter reserves grows with it. */
    var FINE = 1.5;
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
    var GEOM = { id: ID, fine: FINE, aspect: 240 / 300, inset: CORNER.inset };
    var Z_FIXED = JD_Z_BAND.other + 99;   /* over every scattered item (their
                           z runs band + 1..N — the top band since the layers,
                           2026-09-10) and under the raise counter (band +
                           1000+), where anything the visitor drags goes — junk
                           deliberately dropped on the button still covers it,
                           but a fresh scatter never buries it */
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
      '<text x="120" y="115" font-size="48" letter-spacing="2" textLength="106"',
      ' lengthAdjust="spacingAndGlyphs">PUSH</text>',
      '<text x="120" y="167" font-size="48" letter-spacing="2" textLength="112"',
      ' lengthAdjust="spacingAndGlyphs">4 MORE</text>',
      '<text x="120" y="219" font-size="48" letter-spacing="2" textLength="106"',
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
        warnFail('turn object', err, ' — falling back to the inline plate');
        art = FALLBACK_ART; build();
      }
    });

    /* called by the pile loader once the tier boxes are known (or once it has
       given up); `build` runs when BOTH the artwork and the ruler are in */
    function ready(tierBox) {
      box = tierOr(tierBox, FALLBACK_BOX);
      armed = true;
      build();
    }

    function build() {
      if (el || !armed || !art) return;
      var pile = document.querySelector('.jd-pile');
      if (!pile || !window.JD_svgInst || !window.JD_applySize) return;
      el = makeItem('jd-item--turn', ID,
        { turn: 'object' });            /* the one flag the pile branches on */
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
      seat(el, pile.getBoundingClientRect());
      /* the reserved corner is exactly measurable only now — push any junk
         already lying on the plate clear of the real rect (closes the race
         between the pile's apply pass and this module's artwork fetch) */
      if (window.JD_enforceTurnCorner) window.JD_enforceTurnCorner();
      /* …and re-seated whenever the drawer changes size — above all the moment
         a drawer that was hidden gets its dimensions (see seat) — with the
         corner cleared of junk again each time */
      if (window.ResizeObserver) {
        var lastW = 0, lastH = 0;
        new ResizeObserver(function () {
          var pr = pile.getBoundingClientRect();
          if (!(pr.width > 0 && pr.height > 0)) return;
          if (Math.abs(pr.width - lastW) < 0.5 && Math.abs(pr.height - lastH) < 0.5) return;
          lastW = pr.width; lastH = pr.height;
          /* the button never leaves the pile (it is never picked, so never
             hoisted into the well), so the rect just read IS its host's */
          if (el && el.parentNode && seat(el, pr) && window.JD_enforceTurnCorner) {
            window.JD_enforceTurnCorner();
          }
        }).observe(pile);
      }
      onActivate(el, function () { press(true); });
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
       the stored map holds only truths — at the first seat that lands, and
       not again: nothing writes that id back (the scatter, the sheet, the
       folder and the won items each store under their own ids), so re-reading
       the whole map on every resize swept nothing. A write that failed is
       tried again at the next seat. `host` is the pile's rect, measured by
       the caller (the size watch has just read it). */
    var swept = false;
    function seat(node, host) {
      var r = node.getBoundingClientRect();
      /* A DRAWER WITH NO SIZE IS NOT SEATED AGAINST (2026-09-27). Measured
         while hidden (the /about/ walkthrough restores mid-page with the
         drawer's scene display:none), host and node both read 0, the half-
         sizes clamp to 0.45, and the corner math put the button in the MIDDLE
         of the drawer — its no-junk zone with it. The size watch below seats
         it the moment the drawer has real dimensions. */
      if (!(host.width > 0 && host.height > 0 && r.width > 0)) return false;
      var hw = Math.min(0.45, r.width / 2 / host.width);
      var hh = Math.min(0.45, r.height / 2 / host.height);
      node.style.left = ((hw + CORNER.inset) * 100).toFixed(2) + '%';
      node.style.top = ((1 - hh - CORNER.inset) * 100).toFixed(2) + '%';
      node.style.setProperty('--rot', CORNER.rot + 'deg');
      node.style.zIndex = Z_FIXED;
      if (!swept) {
        var map = JD_store.get(JD_SCATTER_KEY);
        if (map && map[ID]) { delete map[ID]; swept = JD_store.set(JD_SCATTER_KEY, map); }
        else swept = true;
      }
      return true;
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
      JD_restart(el, 'is-pressed');        /* restart the keyframes */
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
         the flag on the ONE focus the modal returns (see the focus listener
         in build()); a pointer round-trip therefore lights nothing, and a Tab
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
  /* STEP 5 ("and it's all free of charge") removed at the owner's ask,
     2026-09-29 — four steps again. */
  /* REWRITTEN FOR A FIRST VISIT (owner, 2026-09-10): four steps, one sentence
     each, none assuming the reader knows what a specimen tag or a report card
     is. And a CLOSE MARK in the paper's corner (.ins-close in the asset): a
     press takes the sheet out of the drawer until the next load, so it stops
     taking up room once it has been read. Nothing persists — every refresh
     deals the sheet back. */
  /* FOLDED IN HALF (owner ask, 2026-09-29): the sheet was taking too much of
     the floor and covering the other items, so it now lies in the pile FOLDED,
     bottom half back behind the top — the heading and the first steps
     showing, the fold along the bottom edge of what you see — and a press
     UNFOLDS it: the same lift as before (upright, ×--pick-scale, pile dimmed)
     while the bottom half swings down around the crease. Put back, it folds
     again. The mechanism: the asset is inlined TWICE, each copy cropped to
     one side of the fold line (data-fold on the asset's root, exactly half
     by the owner's call) by its viewBox; the bottom copy is absolutely
     positioned below the top and hinged on rotateX in the stylesheet
     (.jd-sheet-bot). The element's box is therefore the FOLDED size — seat,
     drag clamps and the button clearance all see half the height, which is
     the point — and two custom properties tell the pile how the open sheet
     differs: --sheet-bot (bottom height ÷ top height, the translate that
     keeps the open sheet centred on its seat) and --pick-tall (open height ÷
     folded height, read by nudgeIntoWell in jd-core.js so the enlarged sheet
     still clears the walls). The fold state IS the picked state: no second
     state machine, and every dismissal that puts the sheet back folds it. */
  (function () {
    var ID = 'jd-instructions';
    var ASSET = '/art/junk-drawer/instructions-object.svg';
    var FALLBACK_BOX = 30;               /* = BASE.xl, if the drawer never loaded */
    var Z_SHEET_MIN = JD_Z_BAND.other + 101;   /* floor: over the top band's
                                            scatter (1..N) and the turn button
                                            (+99) even if the pile reads empty
                                            (bands: 2026-09-10). Restored wins
                                            land on the raise counter (JD_zRaise,
                                            +1001 up), above this floor; seat()'s
                                            max + 1 is what clears them */
    var ROT = 7;                         /* load tilt, ± degrees */
    var SEAM_OVERLAP = 3;                /* viewBox units the two copies share at the fold */

    var art = null, box = null, armed = false, el = null;

    /* the full text, for assistive tech: the artwork's <text> runs are
       aria-hidden with the rest of the svg, and this one string is what the
       wrapper actually says */
    var SHEET_TEXT = 'Instructions. 1: feel free to dig around and look at ' +
      'stuff. click an item for a closer look. 2: help yourself to something ' +
      'new by pressing the big blue button. 3: each prompt returns ' +
      'four drawings from different large language models. 4: you\'re ' +
      'not done until you leave a grade and rank them!';

    /* fetched like the turn object's artwork, but with NO inline fallback: a
       drawer without its instructions still works — the sheet is furniture,
       not the feature — so a failed deploy just leaves the pile one scrap
       lighter and says so in the console. */
    JD_fetchArt({
      attr: 'data-jd-instructions', asset: ASSET,
      onArt: function (text) { art = text; build(); },
      onFail: function (err) { warnFail('instructions sheet', err); }
    });

    /* called by the pile loader with the xl tier box (or, when the drawer
       itself failed to load, with jd-core's BASE.xl — this module's
       FALLBACK_BOX value); `build` runs when both artwork and ruler are in */
    function ready(tierBox) {
      box = tierOr(tierBox, FALLBACK_BOX);
      armed = true;
      build();
    }

    function build() {
      if (el || !armed || !art) return;
      var pile = document.querySelector('.jd-pile');
      if (!pile || !window.JD_svgInst || !window.JD_applySize) return;
      el = makeItem('jd-item--sheet', ID,
        { sheet: 'instructions' });    /* the one flag the tap path branches on */
      el.setAttribute('aria-label', 'Instructions, folded — press to unfold and enlarge; Delete removes the sheet');
      el.setAttribute('aria-expanded', 'false');
      /* sized on the WHOLE sheet first: applySize reads the first svg's
         viewBox for the aspect, and the width must be the unfolded sheet's
         (the fold halves the height, never the width) */
      el.innerHTML = window.JD_svgInst(art, 'jio_');
      window.JD_applySize(el, box, ID, 1);
      /* then rebuilt as the two halves — see the banner */
      var vb = viewBoxOf(art), fold = foldOf(art, vb);
      /* THE SEAM (2026-09-29): the bottom copy starts SEAM_OVERLAP units ABOVE
         the fold and is seated that far up the top copy, so the two crops
         overlap. Cut exactly at the fold, the top copy lost its last pixel or
         two to layout rounding and the ascenders of the line the fold runs
         through came out sliced flat; with the overlap, the bottom copy
         repaints that strip (same paper, same ink, same user space) and the
         words read whole. The hinge is moved down the same amount so the
         swing still turns on the crease. */
      el.innerHTML =
        '<div class="jd-sheet">' +
          '<div class="jd-sheet-half jd-sheet-top">' +
            window.JD_svgInst(cropTo(art, vb, vb.y, fold), 'jit_') + '</div>' +
          '<div class="jd-sheet-half jd-sheet-bot">' +
            window.JD_svgInst(cropTo(art, vb, fold - SEAM_OVERLAP, vb.y + vb.h), 'jib_') + '</div>' +
        '</div>' +
        '<span class="jd-vh">' + SHEET_TEXT + '</span>';
      el.querySelectorAll('svg').forEach(function (svg) {
        svg.setAttribute('aria-hidden', 'true');
      });
      var topH = fold - vb.y, botH = vb.y + vb.h - fold;
      el.style.setProperty('--sheet-bot', (botH / topH).toFixed(4));
      el.style.setProperty('--pick-tall', ((topH + botH) / topH).toFixed(4));
      /* where the bottom copy sits (a fraction of the top copy's height) and
         where its hinge is (a fraction of its own height) — see THE SEAM */
      el.style.setProperty('--sheet-seam', ((topH - SEAM_OVERLAP) / topH * 100).toFixed(3) + '%');
      el.style.setProperty('--sheet-hinge', (SEAM_OVERLAP / (botH + SEAM_OVERLAP) * 100).toFixed(3) + '%');
      /* aria-expanded follows the fold, which follows .is-picked — toggled by
         pick()/hideTag() in jd-core.js, which know nothing of this attribute.
         Bound to the node, not the module's `el`: dismiss() nulls that, and
         the observer runs one microtask later. */
      if (window.MutationObserver) {
        (function (node) {
          new MutationObserver(function () {
            node.setAttribute('aria-expanded',
              node.classList.contains('is-picked') ? 'true' : 'false');
          }).observe(node, { attributes: true, attributeFilter: ['class'] });
        })(el);
      }
      /* THE CLOSE MARK (owner, 2026-09-10): the × drawn in the paper's top
         corner takes the sheet out of the drawer for the rest of this load —
         nothing is remembered, a refresh deals it back. The mark is part of
         the artwork (rotates, tilts and enlarges with the paper), so the pile's
         grip must not see the press: pointerdown stops here, and the release
         on the mark is the dismissal. */
      var closeMark = el.querySelector('.ins-close');
      if (closeMark) {
        closeMark.addEventListener('pointerdown', function (e) {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.stopPropagation();
          if (e.pointerType === 'mouse') e.preventDefault();
        });
        closeMark.addEventListener('pointerup', function (e) {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          e.stopPropagation();
          dismiss();
        });
      }
      pile.appendChild(el);
      /* NO fitView: controlled repo art, frame honest by construction (the
         turn object's rule) — sized on the shared ruler like everything else
         (applied above, before the halves were cut) */
      seat(el, pile);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();          /* the keyboard's close mark */
          dismiss();
          return;
        }
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
          /* both paths MOVE the node (pick hoists it into the well, the
             dismissal returns it to the pile), and a moved node drops focus —
             so the second Enter, or the Delete after it, went nowhere. The
             keyboard keeps its place on the sheet. */
          if (el && el.focus) el.focus({ preventScroll: true });
        }
      });
      /* ordinary pile plumbing — drag, twist, settle; the tap branch in
         wireItem is what routes a press here instead of pick() */
      if (window.JD_wirePile) window.JD_wirePile();
    }

    /* the asset's frame, and the fold line inside it (data-fold on the root,
       exactly half when the attribute is missing) */
    function viewBoxOf(text) {
      var m = /<svg[^>]*\sviewBox=["']([^"']+)["']/i.exec(text);
      var n = m ? m[1].trim().split(/[\s,]+/).map(Number) : [];
      return n.length === 4 && n[2] > 0 && n[3] > 0
        ? { x: n[0], y: n[1], w: n[2], h: n[3] } : { x: 0, y: 0, w: 330, h: 460 };
    }
    function foldOf(text, vb) {
      var m = /<svg[^>]*\sdata-fold=["']([\d.]+)["']/i.exec(text);
      var f = m ? parseFloat(m[1]) : NaN;
      return f > vb.y && f < vb.y + vb.h ? f : vb.y + vb.h / 2;
    }
    /* one copy of the asset cropped to the band y0..y1: the root's viewBox is
       rewritten, and an outer <svg> clips to its viewport, so everything past
       the band simply isn't painted (or hit) */
    function cropTo(text, vb, y0, y1) {
      return text.replace(/(<svg[^>]*\sviewBox=["'])[^"']+(["'])/i,
        '$1' + vb.x + ' ' + y0 + ' ' + vb.w + ' ' + (y1 - y0) + '$2');
    }

    /* out of the drawer until the next load. An enlarged sheet is put down
       first so the pile's dim and pick state clear with it; the node then
       leaves the DOM — its seat in the scatter map is kept, so the next load
       deals it back to the same spot. */
    function dismiss() {
      if (!el) return;
      if (el.classList.contains('is-picked') && window.JD_hideTag) window.JD_hideTag();
      if (el.parentNode) el.parentNode.removeChild(el);
      el = null;
    }

    /* the seat: stable per session through the shared scatter map (layoutFor
       merges unknown ids forward, exactly as it keeps a won item's spot), a
       fresh gently-tilted spot otherwise. z is NEVER stored — pinned per load. */
    function seat(node, pile) {
      var hs = halfSizes(node, pile), hw = hs.hw, hh = hs.hh;
      var map = JD_store.get(JD_SCATTER_KEY) || {};
      var p = map[ID];
      if (!p) {
        /* NOT the pile's anywhere-scatter (owner, 2026-08-28): the sheet
           deals centred on the x-axis (a whisper of jitter so it never reads
           machine-placed) and inside the well's upper two-thirds — the whole
           sheet, so its centre stays above 2/3 minus its own half-height.
           A sheet too tall for that band just centres in what room there is.
           FOLDED (2026-09-29), the box is half a sheet, but the seat must
           still leave room for the sheet it UNFOLDS into — --pick-tall × the
           pick zoom, centred on this same spot — because nudgeIntoWell's
           slide is capped and a high seat left the heading behind the top
           rail. So the floor of the band is the open sheet's half-height. */
        var cs = getComputedStyle(node);
        var openHH = hh * (parseFloat(cs.getPropertyValue('--pick-tall')) || 1) *
          (parseFloat(cs.getPropertyValue('--pick-scale')) || 1);
        var loY = Math.max(hh, Math.min(0.45, openHH)) + JD_SCATTER_INSET;
        /* A THIRD OF THE WAY DOWN (owner, 2026-09-29: "1/3 the way down
           instead of 1/2"): the centre deals at 1/3 of the well with a
           whisper of jitter, never above loY — the room the open sheet
           needs — so on a short well it simply sits as high as it can. */
        p = {
          x: +(0.5 + (Math.random() * 2 - 1) * 0.05).toFixed(4),
          y: +Math.max(loY, 1 / 3 + (Math.random() * 2 - 1) * 0.02).toFixed(4),
          rot: +((Math.random() * 2 - 1) * ROT).toFixed(1)
        };
        map[ID] = p;
        JD_store.set(JD_SCATTER_KEY, map);
      }
      applySeat(node, p, hw, hh);   /* clear of the turn button's corner */
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
     tradition of the tag's meterSVG (jd-core.js) and the report card's
     barHTML (jd-record.js): no libraries, no build step, everything
     interpolated through the local esc(). The design
     brief is Tufte × the drawer — no chart frames, no graph paper behind the
     marks, no legend where a direct label fits, value labels instead of axis
     ticks, and every chart's subtitle states its population honestly. The
     fun lives in the folder, the tab and the paper cards; the marks stay
     flat. */
  (function () {
    /* BENCHED from 2026-08-28 (owner call, the darkroom pool's own terms)
       to 2026-09-10, when the owner asked for it back with a smaller brief:
       TWO CHARTS, cost and quality — see render(). Everything else stands
       (the ledger, first places, the axes and the spend line are still built
       here, just not rendered); flipping this flag to true benches the folder
       again with nothing else to touch, and while true the artwork is never
       even fetched. */
    var BENCHED = false;

    var ID = 'jd-analytics';
    var ASSET = '/art/junk-drawer/analytics-folder.svg';
    var API = '/api/jd-analytics.php';
    var FALLBACK_BOX = 22;               /* = BASE.l, if the drawer never loaded */
    var ROT = 8;                         /* a small tilt: jammed in the corner
                                            (below), the pile's full ±34° would
                                            poke it out past the walls */
    var Z_FOLDER = 0;                    /* THE BOTTOM OF THE DRAWER (owner,
                                            2026-09-29): under every scattered
                                            item — their z runs from 1 in the
                                            lowest band — and it STAYS there:
                                            data-z-pinned tells settle() in
                                            jd-core.js not to raise it after a
                                            drag. (Was JD_Z_BAND.l + 50, "large
                                            junk in the large layer".) */

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
        onFail: function (err) { warnFail('analytics folder', err); }
      });
    }

    /* called by the pile loader with the l tier box (or, when the drawer
       itself failed to load, with jd-core's BASE.l — this module's
       FALLBACK_BOX value); `build` runs when both artwork and ruler are in */
    function ready(tierBox) {
      if (BENCHED) return;
      box = tierOr(tierBox, FALLBACK_BOX);
      armed = true;
      build();
    }

    function build() {
      if (el || !armed || !art) return;
      var pile = document.querySelector('.jd-pile');
      if (!pile || !window.JD_svgInst || !window.JD_applySize) return;
      el = makeItem('jd-item--folder', ID, {
        folder: 'analytics',             /* the one flag the tap path branches on */
        zPinned: String(Z_FOLDER)        /* settle() keeps it on the floor */
      });
      el.setAttribute('aria-label', 'Analytics — press to open the folder');
      el.innerHTML = window.JD_svgInst(art, 'jaf_');
      var svg = el.querySelector('svg');
      if (svg) svg.setAttribute('aria-hidden', 'true');
      pile.appendChild(el);
      /* NO fitView: controlled repo art, frame honest by construction (the
         turn object's rule) — sized on the shared ruler like everything else */
      window.JD_applySize(el, box, ID, 1);
      seat(el, pile);
      onActivate(el, open);   /* Enter/Space opens the folder */
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
      var hs = halfSizes(node, pile), hw = hs.hw, hh = hs.hh;
      /* zone(): a centre inside [zoneLo..zoneHi] of the well on that axis,
         shrunk as needed so the whole object still clears the walls — the
         scatter's inside() rule with a band instead of the full run. The
         BOTTOM-RIGHT band is the owner's call (2026-08-28): the folder deals
         into the drawer's lower-right region — away from the sheet's
         upper-centre spawn and the turn button's lower-left corner — rather
         than anywhere in the well. JD_avoidTurn below still has the last
         word if a small well squeezes the bands toward the button. */
      function zone(half, zoneLo, zoneHi) {
        var lo = Math.max(half + JD_SCATTER_INSET, zoneLo);
        var hi = Math.min(1 - half - JD_SCATTER_INSET, zoneHi);
        if (hi < lo) {
          hi = lo = Math.max(half + JD_SCATTER_INSET,
            Math.min(1 - half - JD_SCATTER_INSET, (zoneLo + zoneHi) / 2));
        }
        return +(lo + Math.random() * (hi - lo)).toFixed(4);
      }
      var map = JD_store.get(JD_SCATTER_KEY) || {};
      var p = map[ID];
      /* THE CORNER (owner, 2026-09-29: "more down, in the bottom and the
         right, almost as far as it will go"): the band was 58–92% on both
         axes, which put the folder anywhere in the lower-right quadrant —
         just right of centre on some loads, mid-height on others. Now both
         bands start at 88% and zone() clamps them to the wall, so the folder
         deals tucked into the corner with a whisper of jitter. A seat stored
         under the old band is stale and re-dealt. */
      if (p && (p.x < 0.8 || p.y < 0.8)) p = null;
      if (!p) {
        p = {
          x: zone(hw, 0.88, 1), y: zone(hh, 0.88, 1),
          rot: +((Math.random() * 2 - 1) * ROT).toFixed(1)
        };
        map[ID] = p;
        JD_store.set(JD_SCATTER_KEY, map);
      }
      applySeat(node, p, hw, hh);   /* clear of the turn button's corner */
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
    /* the grade inks are JD_GRADE_RAMP (jd-core.js), worst→best — the ramp
       meterSVG prints the specimen tag in: the grade book has to speak the
       ramp visitors already learned on the specimen tag */

    function indexModels() {
      mmap = {};
      /* the marked set: every model that will put a colored rect or dot on
         the page. The axes no longer do (2026-09-30): their bars are coloured
         by severity, the same for every model, and the rows are named. */
      var marked = {};
      (data.cost || []).forEach(function (c) { marked[c.model_id] = 1; });
      (data.firsts || []).forEach(function (f) { marked[f.model_id] = 1; });
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

    /* ISSUE RATES (owner, 2026-09-30): one category's rank counts (the
       endpoint's per-axis 'hist', rank => count) split into the two segments
       the charts draw. On a problem axis the top rank is clean, the rank below
       it is a small problem and everything lower a big one (on Understanding
       Assignment's four levels: Mostly = small, Somewhat or Barely = big). On
       a HIT axis (je ne sais quoi, which measures what goes right) the top
       rank is "has it" and the one below "just a hint". strong is the dark
       segment, light the pale one; lo/hi are the 95% Wilson interval on the
       whole bar. Exported for /about/, which draws the same numbers. */
    var HIT_AXES = { jnsq: 1 };
    function axisRates(hist, points, axisId) {
      var n = 0, top = +points || 3, strong = 0, light = 0;
      Object.keys(hist || {}).forEach(function (k) {
        var rank = Math.round(+k), c = +hist[k] || 0;
        n += c;
        if (HIT_AXES[axisId]) {
          if (rank === top) strong += c;
          else if (rank === top - 1) light += c;
        } else if (rank === top - 1) light += c;
        else if (rank < top - 1) strong += c;
      });
      var total = strong + light, lo = 0, hi = 0;
      if (n) {
        var z = 1.959964, p = total / n, z2 = z * z, den = 1 + z2 / n;
        var mid = (p + z2 / (2 * n)) / den;
        var half = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / den;
        lo = Math.max(0, mid - half); hi = Math.min(1, mid + half);
      }
      return { n: n, strong: strong, light: light, total: total,
               rate: n ? total / n : 0, lo: lo, hi: hi, hit: !!HIT_AXES[axisId] };
    }
    window.JD_axisRates = axisRates;

    function num(n) {
      return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    /* OWNER-BENCHED: used only by ledgerHTML/spendHTML, kept with them by owner request (2026-09-10). */
    function day(iso) { return String(iso || '').slice(0, 10); }

    /* TITLES ONLY (owner, 2026-09-10): the population line under each title
       is no longer printed with a chart — the title and the marks are the
       card. The sentence is still composed by every card, and it is what a
       card with NOTHING TO PLOT shows in place of its chart (a bare title
       would read as a rendering failure), so the shortfall and the models
       left off are still stated there. */
    function cardHTML(cls, title, sub, inner) {
      return '<section class="fx-card ' + cls + '">' +
        '<h3 class="fx-title">' + esc(title) + '</h3>' +
        (inner ? inner : '<p class="fx-sub">' + esc(sub) + '</p>') + '</section>';
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
    /* OWNER-BENCHED: not rendered, kept by owner request (2026-09-10) — see render(). */
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
        s += rowLabel(y, r.id) +
             '<rect x="' + BAR0 + '" y="' + (y + 1.5) + '" width="' + w.toFixed(1) +
             '" height="11" fill="' + mColor(r.id) + '"/>' +
             '<text x="' + (BAR0 + w + 5).toFixed(1) + '" y="' + (y + 10.6) +
             '" class="fx-t-val">' + esc(r.value) + '</text>';
        if (r.tail) s += rowTail(y, r.tail);
      });
      return chartSVG(W, h, alt, s);
    }
    /* what every row on the shared ruler prints at its two edges (the row's
       top is y): the model's name in the label gutter, and the small figure
       at the right margin */
    function rowLabel(y, id) {
      var lb = labFor(id);
      return '<text x="' + (LAB - 8) + '" y="' + (y + 10.4) +
        '" text-anchor="end" class="' + lb.cls + '">' + esc(lb.t) + '</text>';
    }
    function rowTail(y, text) {
      return '<text x="' + (W - 2) + '" y="' + (y + 10.4) +
        '" text-anchor="end" class="fx-t-tail">' + esc(text) + '</text>';
    }
    /* one chart's frame: the svg every fx-chart is, w × h user units */
    function chartSVG(w, h, alt, inner) {
      return '<svg class="fx-chart" viewBox="0 0 ' + w + ' ' + h +
        '" role="img" aria-label="' + esc(alt) + '">' + inner + '</svg>';
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
        'average provider cost per drawing, by model — every drawing that ' +
        'came back whole, the curated bench included',
        barsSVG(rows, altOf('Average cost per surviving response', rows)));
    }

    /* WHO TAKES FIRST — the BAR is the rate, so the number AT the bar's end is
       the rate too (design review, 2026-08-28). It used to print the raw count
       there, which put "8 of 22" at the end of a bar longer than the one
       ending "9 of 31" — a longer mark carrying a smaller printed number is
       the one thing a bar chart may never do. The count has not gone away and
       must not: a rate off 22 turns and a rate off 31 are not the same claim,
       so it moves to the tail column, in the cost card's "n 86" seat. */
    /* OWNER-BENCHED: not rendered, kept by owner request (2026-09-10) — see render(). */
    function firstsHTML() {
      var src = data.firsts || [];
      if (!src.length) {
        return cardHTML('fx-firsts', 'Who takes first',
          'no four-model turn has been ranked yet', '');
      }
      var rows = src.map(function (f) {
        return { id: f.model_id, v: +f.rate || 0,
                 value: Math.round((+f.rate || 0) * 100) + '%',
                 tail: num(f.firsts) + ' of ' + num(f.judged) };
      });
      return cardHTML('fx-firsts', 'Who takes first',
        'first place on ranked four-model turns, visitor and bench alike; ' +
        'the denominator is the turns that model survived',
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
         every grade.

       The track is drawn by trackSVG below, shared with the turn table's
       cell-size gauge (gaugeSVG), which is the same track at 40 × 8. */
    var GRADE_STEPS = 5;   /* the permanent 1..5 rank scale (PLAN-ANALYTICS §1) */
    /* a mean on that scale, held inside it (no mean reads as the floor, 1) */
    function clampGrade(v) { return Math.max(1, Math.min(GRADE_STEPS, +v || 1)); }
    /* the ramp tier is the WHOLE grade the mean sits in — floor, not a
       rescale-and-round, which put the tier boundaries at 1.5/2.5/… and
       coloured a 3.4 and a 3.6 differently for no reason a reader of the
       1–5 scale could name */
    function gradeInk(v) { return JD_GRADE_RAMP[Math.min(4, Math.max(0, Math.floor(v) - 1))]; }
    /* one track, its top-left at x, y, w × h user units, filled to the
       (clamped) grade v: the fill, the dividers over it, the outline */
    function trackSVG(x, y, w, h, v) {
      var fw = w * v / GRADE_STEPS;
      var s = '<rect x="' + x + '" y="' + y + '" width="' + fw.toFixed(1) +
        '" height="' + h + '" fill="' + gradeInk(v) + '"/>';
      for (var t = 1; t < GRADE_STEPS; t++) {
        var tx = x + w * t / GRADE_STEPS;
        s += '<line x1="' + tx.toFixed(1) + '" y1="' + y + '" x2="' +
             tx.toFixed(1) + '" y2="' + (y + h) + '" class="' +
             (tx <= x + fw ? 'fx-seg' : 'fx-seg-out') + '"/>';
      }
      return s + '<rect x="' + x + '" y="' + y + '" width="' + w +
        '" height="' + h + '" fill="none" stroke="rgba(74,53,18,0.28)" ' +
        'stroke-width="1"/>';
    }
    function gradesHTML() {
      var src = data.grades || [];
      if (!src.length) return '';
      /* MIN_N: a mean over one or two ratings is a person, not a reading, and
         a grade bar states it with the same authority as a mean over forty.
         Dropped rows are named in the subtitle rather than vanishing. */
      var rows = [], dropped = [];
      src.forEach(function (g) {
        if ((+g.n || 0) < MIN_N) dropped.push({ id: g.model_id, n: +g.n || 0 });
        else rows.push(g);
      });
      if (!rows.length) {
        /* the card stays even when no model has earned a bar yet (2026-09-10,
           with the folder's return): a missing chart reads as a broken
           folder, a stated shortfall reads as the truth */
        return cardHTML('fx-grades', 'Overall grade',
          'no model has ' + MIN_N + ' grades on visitor turns under the ' +
          'current rubric yet' + notPlotted(dropped), '');
      }
      var s = '', alt = [];
      rows.forEach(function (g, i) {
        var v = clampGrade(g.avg);
        var y = 4 + i * ROWH;
        s += rowLabel(y, g.model_id) +
             trackSVG(BAR0, y + 1.5, BARW, 11, v) +
             '<text x="' + (BAR0 + BARW + 7) + '" y="' + (y + 10.6) +
             '" class="fx-t-val">' + v.toFixed(1) + ' of ' + GRADE_STEPS + '</text>' +
             rowTail(y, 'n ' + num(g.n));
        alt.push(mLabel(g.model_id) + ', ' + v.toFixed(1) + ' of ' + GRADE_STEPS +
          ', n ' + num(g.n));
      });
      var svg = chartSVG(W, rows.length * ROWH + 6,
        'Average overall grade. ' + alt.join('. '), s);
      return cardHTML('fx-grades', 'Overall grade',   /* owner, 2026-09-11 */
        /* "current rubric" = the v17 rework onward — the endpoint's era gate
           (owner call, 2026-08-28): pre-v17 grades are the old demo era and
           re-enter by being re-rated, never by being grandfathered */
        'average overall grade on the 1–5 scale, by model — every grade ' +
        'filed on a visitor turn under the current rubric, n ' + MIN_N +
        ' and up' + notPlotted(dropped), svg);
    }

    /* THE FOUR AXES — issue rates, as small multiples (owner, 2026-09-30,
       from mockup-47). The folder used to plot each category's AVERAGE rank;
       it now counts how often each model had a problem, which is what the
       categories were built to find ("each designed to isolate a single type
       of failure"). Why a rate and not a mean: the levels are labels, not
       measurements, and a mean folds how OFTEN and how BAD into one figure —
       many small slips and a few ruined drawings can land on the same 2.3.

       - Every panel is one 0–100% ruler, so for the first time the four
         categories compare with each other, not only within themselves.
       - The bar is split by severity: the dark segment at the base is the big
         problems, the light one the small. The printed figure is the whole
         bar (any problem). Understanding Assignment has four levels, so its
         "Mostly Understands" is the small problem and Somewhat or Barely the
         big one (JD_axisRates below).
       - Je ne sais quoi measures what goes RIGHT, so it is counted the other
         way, in green: the hit rate, Has it (dark) plus Just a hint (light).
       - One colour pair per meaning, the same for every model (owner call):
         the model names label the rows, so the bars need no model ink.
       - The whisker is a 95% Wilson interval on the whole bar. At these n it
         is wide on purpose: bars whose whiskers overlap are not a difference.
       - Tapping a row prints its counts under the panel (the delegated
         handler in buildDialog).

       models[] still arrives in the global order in every panel and is NOT
       re-sorted: a row has to mean the same model in all four panels.

       THE KEY GUTTER IS PAID FOR ONCE (design review, 2026-08-28). The key is
       drawn into EVERY panel, so all four keep byte-identical geometry, but on
       a wide folder only the lead panel shows the gutter: panels 2–4 crop it
       out of their viewBox at PLAB. Below 900px every panel keeps its key.

       MIN_N applies here too: a row whose n is 1 or 2 is dropped, and the
       dropped models are named in the card's subtitle. */
    var ISSUE_BIG = JD_GRADE_RAMP[0], ISSUE_SMALL = '#cf6e56';   /* Utility red, and a lighter brick */
    var HIT_HAS = JD_GRADE_RAMP[4], HIT_HINT = '#6ea456';        /* Prime green, and a lighter moss */
    function pct(x) { return Math.round(x * 100) + '%'; }
    function axesHTML() {
      var axes = data.axes || [];
      if (!axes.length) return '';
      function plottable(r) {
        return (+r.n || 0) >= MIN_N && axisRates(r.hist, 3).n > 0;
      }
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
      /* each axis's plottable rows, sifted once: the panels draw these, and
         whether ANY axis has a row is read off them */
      var rowsOf = axes.map(function (ax) { return (ax.models || []).filter(plottable); });
      var anyRow = rowsOf.some(function (rows) { return rows.length > 0; });
      if (!anyRow) {
        /* stays up with the shortfall stated (2026-09-10, the folder's
           return) — four bare rulers would read as a failure, no card at all
           reads as a missing chart; a sentence reads as the truth */
        return cardHTML('fx-axes', 'The four categories',
          'no model has ' + MIN_N + ' category ratings on four-model turns ' +
          'under the current rubric yet' + notPlotted(dropped), '');
      }
      /* KEYS ON EVERY PANEL BELOW 900px (owner, 2026-09-11) — read off the
         same media query whose listener (axesMQ, under render()) re-renders
         when the width crosses the line; a MediaQueryList answers .matches
         live, so this is the reading a fresh matchMedia would give */
      var keysEverywhere = !!(axesMQ && axesMQ.matches) ||
        document.documentElement.classList.contains('jd-about-page');
      var panels = axes.map(function (ax, pi) {
        var cropped = pi > 0 && !keysEverywhere;
        return '<div class="fx-panel' + (cropped ? ' fx-panel--cropped' : '') + '"><h4>' + esc(ax.label) + '</h4>' +
          panelSVG(ax, rowsOf[pi], cropped) +
          '<p class="fx-readout" aria-live="polite"></p></div>';
      }).join('');
      return cardHTML('fx-axes', 'The four categories',
        'issue rate per category on four-model turns — how often a small or ' +
        'big problem was filed — and for je ne sais quoi the hit rate; every ' +
        'rating under the current rubric, live axes only, n ' + MIN_N +
        ' and up' + notPlotted(dropped),
        legendHTML() + '<div class="fx-axgrid">' + panels + '</div>');
    }
    /* one category's panel drawing: its plottable rows on the 0–100% ruler,
       the key gutter cropped out of the viewBox when `cropped` */
    function panelSVG(ax, rows, cropped) {
      var BARH = 7;
      var pts = +ax.points || 3;
      var hit = !!HIT_AXES[ax.axis_id];
      var h = 2 + rows.length * PROWH + 4, s = '', alt = [];
      /* the 50% hairline, behind every row */
      s += '<line x1="' + (PX0 + PXW / 2) + '" y1="2" x2="' + (PX0 + PXW / 2) +
           '" y2="' + (h - 4) + '" class="fx-mid"/>';
      rows.forEach(function (r, i) {
        var q = axisRates(r.hist, pts, ax.axis_id);
        var y = 2 + i * PROWH + PROWH / 2, by = y - BARH / 2;
        var ws = PXW * q.strong / q.n, wt = PXW * q.total / q.n;
        var read = mLabel(r.model_id) + ' — ' + (hit ? 'hit rate ' : 'issue rate ') +
          pct(q.rate) + ' (95% ' + pct(q.lo) + '–' + pct(q.hi) + ') · ' +
          (hit ? 'has it ' + q.strong + ', a hint ' + q.light + ', missed '
               : 'big ' + q.strong + ', small ' + q.light + ', clean ') +
          (q.n - q.total) + ' · n ' + num(q.n);
        s += '<g class="fx-row" tabindex="0" role="button" data-read="' + esc(read) +
             '" aria-label="' + esc(read) + '">' +
             '<rect class="fx-row-hit" x="0" y="' + (y - PROWH / 2) +
             '" width="' + PW + '" height="' + PROWH + '"/>' +
             '<rect class="fx-track-bar" x="' + PX0 + '" y="' + by + '" width="' + PXW +
             '" height="' + BARH + '"/>';
        if (ws > 0) {
          s += '<rect x="' + PX0 + '" y="' + by + '" width="' + ws.toFixed(2) +
               '" height="' + BARH + '" fill="' + (hit ? HIT_HAS : ISSUE_BIG) + '"/>';
        }
        /* the pale segment butts straight onto the dark one, no seam
           (owner, 2026-10-01) */
        var lx = PX0 + ws, lw = wt - ws;
        if (lw > 0.3) {
          s += '<rect x="' + lx.toFixed(2) + '" y="' + by + '" width="' + lw.toFixed(2) +
               '" height="' + BARH + '" fill="' + (hit ? HIT_HINT : ISSUE_SMALL) + '"/>';
        }
        /* the whisker: a thin grey line, capped, no halo (owner, 2026-10-01) */
        var x1 = (PX0 + PXW * q.lo).toFixed(2), x2 = (PX0 + PXW * q.hi).toFixed(2);
        var d = 'M' + x1 + ' ' + (y - 2.6) + 'v5.2M' + x1 + ' ' + y + 'H' + x2 +
                'M' + x2 + ' ' + (y - 2.6) + 'v5.2';
        s += '<path d="' + d + '" class="fx-ci"/>' +
             '<text x="' + (PW - 2) + '" y="' + (y + 2.6) +
             '" text-anchor="end" class="fx-t-axval">' + pct(q.rate) + '</text>' +
             '<text x="' + PLAB + '" y="' + (y + 2.6) +
             '" text-anchor="end" class="fx-t-key fx-key">' +
             esc(keyFor(r.model_id)) + '</text></g>';
        alt.push(mLabel(r.model_id) + ' ' + pct(q.rate) + ', 95% interval ' +
          pct(q.lo) + ' to ' + pct(q.hi));
      });
      var vb = !cropped ? '0 0 ' + PW + ' ' + h
                        : PLAB + ' 0 ' + (PW - PLAB) + ' ' + h;
      return '<svg viewBox="' + vb + '" role="img" aria-label="' +
        esc(ax.label + ', ' + (hit ? 'hit rate' : 'issue rate') + '. ' + alt.join('. ')) + '">' +
        s + '</svg>';
    }
    /* the card's one key to the four panels' inks and whisker */
    function legendHTML() {
      function sw(c, label) {
        return '<li><i class="fx-sw" style="background:' + c + '"></i>' + esc(label) + '</li>';
      }
      return '<ul class="fx-legend">' +
        sw(ISSUE_BIG, 'big problem') + sw(ISSUE_SMALL, 'small problem') +
        sw(HIT_HAS, 'has it') + sw(HIT_HINT, 'just a hint') +
        '<li><svg class="fx-sw-ci" viewBox="0 0 16 8" aria-hidden="true">' +
        '<path d="M1 1v6M1 4h14M15 1v6" class="fx-ci"/></svg>95% interval</li>' +
        '<li class="fx-legend-tap">tap a bar for its counts</li></ul>';
    }

    /* THE TURN TABLE (owner, 2026-09-10): one row per four-model turn on
       display, newest first — the date, the prompt cut to its first PROMPT_CUT
       characters, and each model's overall grade as the number and the grade
       book's five-segment gauge at cell size. Five rows show; the rest scroll
       inside the card (the CSS fixes the row height and caps the scroll box
       at five rows plus the header, which stays put). The model columns are
       the models that graded on any listed turn, in the payload's order, so
       a column means the same model all the way down. */
    var PROMPT_CUT = 48;
    /* the grade book's track at cell size (see trackSVG), inset half a unit
       in its 41 × 9 box */
    function gaugeSVG(v) {
      var TW = 40, TH = 8;
      return '<svg class="fx-gauge" viewBox="0 0 ' + (TW + 1) + ' ' + (TH + 1) + '" aria-hidden="true">' +
        trackSVG(0.5, 0.5, TW, TH, clampGrade(v)) + '</svg>';
    }
    function turnsHTML() {
      var rows = data.turns || [];
      if (!rows.length) {
        return cardHTML('fx-turns', 'Turn by turn',
          'no four-model turn is on display yet', '');
      }
      /* the columns: every model that graded on a listed turn, payload order */
      var present = {};
      rows.forEach(function (r) { Object.keys(r.grades || {}).forEach(function (m) { present[m] = true; }); });
      var cols = (data.models || []).map(function (m) { return m.model_id; }).filter(function (id) { return present[id]; });
      Object.keys(present).forEach(function (id) { if (cols.indexOf(id) < 0) cols.push(id); });
      var h = '<div class="fx-turns-wrap"><table class="fx-turns-t"><thead><tr>' +
        '<th class="fx-th-date">date</th><th class="fx-th-prompt">prompt</th>';
      cols.forEach(function (id) { h += '<th class="fx-th-model">' + esc(mLabel(id)) + '</th>'; });
      h += '</tr></thead><tbody>';
      rows.forEach(function (r) {
        var p = String(r.prompt || '').replace(/\s+/g, ' ').trim();
        var cut = p.length > PROMPT_CUT ? p.slice(0, PROMPT_CUT - 1).replace(/\s+\S*$/, '') + '…' : p;
        h += '<tr><td class="fx-td-date">' + esc(r.date) + '</td>' +
             '<td class="fx-td-prompt" title="' + esc(p) + '">' + esc(cut) + '</td>';
        cols.forEach(function (id) {
          var g = r.grades && r.grades[id];
          h += '<td class="fx-td-grade">' + (g == null ? '<span class="fx-td-none">—</span>'
            : '<span class="fx-td-num">' + esc(String(+g)) + '</span>' + gaugeSVG(g)) + '</td>';
        });
        h += '</tr>';
      });
      h += '</tbody></table></div>';
      /* JUST THE TABLE (owner, 2026-09-29): no "Turn by turn" title and no
         card around it — the sheet lies in the folder on its own, and gains
         the card's padding as width */
      return '<section class="fx-card fx-turns fx-bare" aria-label="turn by turn">' + h + '</section>';
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
    /* OWNER-BENCHED: not rendered, kept by owner request (2026-09-10) — see render(). */
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
        chartSVG(W2, H2, 'Cumulative provider spend from ' + day(rows[0].date) +
          ' to ' + day(last.date) + ', ending at $' + max.toFixed(2), s));
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
          /* THE TAB IS A TAB (owner, 2026-09-29): ANALYTICS rides the folder's
             top edge as a real file-folder tab — larger, cut from the same
             manila, opening straight into the folder with no head band behind
             it. The ✕ that used to share the band is a second, smaller tab at
             the right end of the same edge. Both are positioned children of
             the card (junk-drawer.css); the card itself is just the folder. */
          /* (owner, 2026-09-29, second pass) ONE TAB, cut like the folder in
             the drawer (analytics-folder.svg): inset from the left edge, a
             trapezoid with slanted sides, and the ✕ riding inside it to the
             left of the word — no second tab at the far end. */
          '<div class="jd-folder-tab">' +
          '<button type="button" class="jd-folder-close" aria-label="close">' +
          JD_X_MARK + '</button>' +
          '<span class="jd-folder-tab-word" aria-hidden="true">ANALYTICS</span>' +
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
      /* the category panels' readout (2026-09-30): tapping, focusing or
         hovering a row prints its counts under its own panel, and marks the
         row. Delegated here because render() rebuilds the panels. A row
         already marked is already printed — only this writes is-on and the
         readout, and render() starts every panel clean — so the mouse moving
         about inside the marked row costs nothing. */
      function readRow(row) {
        if (row.classList.contains('is-on')) return;
        var panel = row.closest('.fx-panel');
        if (!panel) return;
        var out = panel.querySelector('.fx-readout');
        panel.querySelectorAll('.fx-row.is-on').forEach(function (r) {
          r.classList.remove('is-on');
        });
        row.classList.add('is-on');
        if (out) out.textContent = row.getAttribute('data-read') || '';
      }
      function rowOf(e) {
        var t = e.target;
        return t && t.closest ? t.closest('.fx-row') : null;
      }
      bodyEl.addEventListener('click', function (e) {
        var row = rowOf(e); if (row) readRow(row);
      });
      bodyEl.addEventListener('focusin', function (e) {
        var row = rowOf(e); if (row) readRow(row);
      });
      bodyEl.addEventListener('pointerover', function (e) {
        if (e.pointerType !== 'mouse') return;
        var row = rowOf(e); if (row) readRow(row);
      });
      bodyEl.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var row = rowOf(e); if (!row) return;
        e.preventDefault(); readRow(row);
      });
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
      /* THREE CARDS (owner, 2026-09-10, settled the same evening the folder
         returned): what a drawing costs and how the drawings graded side by
         side, then the four axes running the full width, its panels in one
         row. Who takes first was on for an hour and taken off again; it, the
         ledger figures and the spend line stay built (firstsHTML, ledgerHTML,
         spendHTML) for the day they are wanted. */
      bodyEl.innerHTML = costHTML() + gradesHTML() + axesHTML() + turnsHTML();
    }

    /* the axes panels change shape at 900px (keys on every panel below it):
       an open folder re-renders from cache when the width crosses the line.
       axesHTML reads this same list for which side of the line it is on. */
    if (window.matchMedia) {
      var axesMQ = window.matchMedia('(max-width: 900px)');
      var onMQ = function () { if (isOpen && data) render(); };
      if (axesMQ.addEventListener) axesMQ.addEventListener('change', onMQ);
      else if (axesMQ.addListener) axesMQ.addListener(onMQ);
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
      JD_restart(cardEl, 'is-enter');
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
})();
