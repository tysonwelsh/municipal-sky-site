/* ============================================================================
   THE JUNK DRAWER — junk-drawer.js (Phase 1)
   Two responsibilities, promoted from mockups/mockup-2-frame-kit.html (the
   proven Phase 0 build; plans: PLAN-FRONTEND §3/§6, PLAN-MOBILE §§1–3):
     1. the pile loader — one request to data.php ({taxonomy, items[]},
        PLAN-BACKEND §7), each item's PRIMARY response SVG inlined into a
        .jd-item wrapper with its entry.json placement applied inline. The
        same payload also renders the field-notes sections in #notes: the
        wall-label count line, the taxonomy-driven grade legend, and the
        inventory list — zero hardcoded rubric strings anywhere.
     2. the drag/rotate gesture script — Pointer Events, one code path:
        hold-to-grip on touch, transform-only drag motion, wheel / [ ] keys /
        second-finger twist rotation, silhouette-accurate hit-testing.
   Vanilla JS, no build step. The Safari/Blink notes inline are load-bearing,
   not commentary — do not regress them.
   ========================================================================== */

/* ---- the pile loader + field-notes renderer ------------------------------ */
(function () {
  var pile = document.querySelector('.jd-pile');
  var BASE = { s: 9, m: 15.5, l: 22 };   /* --w per sizeClass, in cqmin */

  /* MOBILE_POUR — the hand-tuned PORTRAIT re-seat, keyed by item id;
     values override left/top/--rot on wells ≤768px wide. Interim: a later
     phase replaces this constant with a deterministic portrait re-seat
     computed from the same placement data (PLAN-MOBILE §2). */
  var MOBILE_POUR = {
    '2026-07-26-three-of-hearts': { x: 0.6,  y: 0.38,   rot: -13 },
    '2026-07-26-pocket-mirror':   { x: 0.33, y: 0.15,   rot: -7 },
    '2026-07-26-matchbook':       { x: 0.5292, y: 0.1211, rot: 26 },
    '2026-07-26-button':          { x: 0.59, y: 0.1752, rot: -21 },
    '2026-07-26-scissors':        { x: 0.508, y: 0.449, rot: -34 },
    '2026-07-26-skeleton-key':    { x: 0.575, y: 0.3692, rot: 76 },
    '2026-07-26-ticket-stub':     { x: 0.39, y: 0.2424, rot: -49 },
    '2026-07-26-pencil-stub':     { x: 0.6585, y: 0.8023,    rot: 118 },
    '2026-07-26-rubber-band':     { x: 0.6691, y: 0.8201,  rot: 9 },
    '2026-07-26-paperclip':       { x: 0.2409, y: 0.3109, rot: 104 }
  };

  /* arrange mode: the copy-layout link renders ONLY under ?arrange=1 (a dev
     affordance for hand-tuning placements; the gesture script binds it by id
     when present). Inserted before the gesture IIFE runs, so the binding
     below always sees it. */
  if (location.search.indexOf('arrange=1') !== -1) {
    var stage = document.querySelector('.jd-stage');
    var arr = document.createElement('p');
    arr.className = 'jd-arrange';
    arr.innerHTML = 'arrange mode &mdash; <a href="#" id="copy-layout">copy layout</a>';
    stage.parentNode.insertBefore(arr, stage.nextSibling);
  }

  /* fallback: shown when data.php is unreachable — a quiet mono note in the
     well, nothing else (the painted drawer stands alone as a coherent image) */
  function fallbackNote() {
    var note = document.createElement('p');
    note.className = 'jd-fallback';
    note.innerHTML = 'the drawer is stuck &mdash; its contents load from ' +
      '<code>data.php</code>, which did not answer. ' +
      '<a href="">pull again</a>';
    pile.appendChild(note);
  }

  /* ---------- the field notes, rendered from the same payload ------------- */

  function findById(list, id) {
    list = list || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /* the wall label's live line: "10 items · 2026" (year range once it spans) */
  function renderCount(data) {
    var el = document.getElementById('jd-count');
    if (!el) return;
    var items = data.items || [];
    var lo = '', hi = '';
    items.forEach(function (item) {
      var y = String(item.created || '').slice(0, 4);
      if (!y) return;
      if (!lo || y < lo) lo = y;
      if (!hi || y > hi) hi = y;
    });
    var span = lo ? (lo === hi ? lo : lo + '–' + hi) : '';
    el.textContent = items.length + (items.length === 1 ? ' item' : ' items') +
      (span ? ' · ' + span : '');
  }

  /* HOW TO READ THE GRADES — grade scale in rank order (higher = better,
     contract guarantee 1), then the annotation axes. Labels and descriptions
     come from the taxonomy block only; a taxonomy edit updates this legend
     with no frontend change. */
  function renderLegend(tax) {
    var gradesEl = document.getElementById('jd-grades');
    var axesEl = document.getElementById('jd-axes');
    if (gradesEl) {
      (tax.grades || []).slice()
        .sort(function (a, b) { return (b.rank || 0) - (a.rank || 0); })
        .forEach(function (g) {
          var row = document.createElement('div');
          row.className = 'jd-grade-row';
          var mark = document.createElement('span');
          mark.className = 'jd-grade-mark';
          mark.textContent = g.label || g.id;
          var desc = document.createElement('span');
          desc.className = 'jd-grade-desc';
          desc.textContent = g.description || '';
          row.appendChild(mark);
          row.appendChild(desc);
          gradesEl.appendChild(row);
        });
    }
    if (axesEl) {
      (tax.axes || []).forEach(function (ax) {
        var row = document.createElement('div');
        row.className = 'jd-axis-row';
        var label = document.createElement('span');
        label.className = 'jd-axis-label';
        label.textContent = ax.label || ax.id;
        var desc = document.createElement('span');
        desc.className = 'jd-axis-desc';
        desc.textContent = ax.description || '';
        row.appendChild(label);
        row.appendChild(desc);
        axesEl.appendChild(row);
      });
    }
  }

  /* the inventory — one mono line per item: title, primary model, overall
     grade. Plain text for now; the lines become links when the specimen
     card lands (Phase 3). Display strings resolve through the taxonomy's
     model/grade registries (guarantee 1), raw ids as fallback. */
  function renderInventory(data) {
    var inv = document.getElementById('jd-inventory');
    if (!inv) return;
    var tax = data.taxonomy || {};
    (data.items || []).forEach(function (item) {
      var primary = null;
      (item.responses || []).forEach(function (r) {
        if (r.rid === item.primary) primary = r;
      });
      primary = primary || (item.responses || [])[0] || {};
      var model = findById(tax.models, primary.model);
      var grade = findById(tax.grades, primary.grade);
      var li = document.createElement('li');
      var t = document.createElement('span');
      t.className = 'jd-inv-title';
      t.textContent = item.title || item.id;
      var m = document.createElement('span');
      m.className = 'jd-inv-model';
      m.textContent = model ? model.label : (primary.model || '');
      var g = document.createElement('span');
      g.className = 'jd-inv-grade';
      g.textContent = grade ? grade.label : (primary.grade || '');
      li.appendChild(t);
      li.appendChild(m);
      li.appendChild(g);
      inv.appendChild(li);
    });
  }

  function renderNotes(data) {
    renderCount(data);
    renderLegend(data.taxonomy || {});
    renderInventory(data);
  }

  /* ---------- one request, then the pile ---------------------------------- */
  fetch('data.php')
    .then(function (r) {
      if (!r.ok) throw new Error('data.php ' + r.status);
      return r.json();
    })
    .then(function (data) {
      /* contract guarantee 6: skipped/malformed entries are logged, never
         rendered */
      if (data.errors && data.errors.length && window.console && console.warn) {
        console.warn('junk drawer: data.php skipped entries', data.errors);
      }
      renderNotes(data);
      /* resolve + fetch every primary response SVG (contract: primary
         always resolves; every response has a ready same-origin url) */
      var tax = data.taxonomy || {};
      function byId(list, id) {
        return (list || []).filter(function (x) { return x.id === id; })[0];
      }
      return Promise.all(data.items.map(function (item) {
        var primary = item.responses.filter(function (r) {
          return r.rid === item.primary;
        })[0] || item.responses[0];
        /* display labels for the tap pick-chip, resolved while the
           taxonomy is in scope */
        var model = byId(tax.models, primary.model);
        var grade = byId(tax.grades, primary.grade);
        item._modelLabel = model ? model.label : (primary.model || '');
        item._gradeLabel = grade ? grade.label : (primary.grade || '');
        return fetch(primary.url).then(function (r) {
          if (!r.ok) throw new Error(primary.url + ' ' + r.status);
          return r.text();
        }).then(function (svg) { return { item: item, svg: svg }; });
      }));
    })
    .then(function (loaded) {
      var mobile = window.matchMedia('(max-width: 768px)').matches;
      loaded.forEach(function (rec) {
        var item = rec.item;
        /* placement is optional in the contract; a centred default keeps a
           placement-less entry visible (a computed seeded placement is the
           eventual fallback — PLAN-BACKEND §7.4) */
        var p = item.placement || { x: 0.5, y: 0.5, rotation: 0, scale: 1, z: 1 };
        var el = document.createElement('div');
        el.className = 'jd-item';
        el.dataset.id = item.id;
        el.dataset.scale = p.scale;              /* copy-layout passthrough */
        el.dataset.title = item.title;
        el.dataset.model = item._modelLabel;
        el.dataset.grade = item._gradeLabel;
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', item.title);
        el.innerHTML = rec.svg.replace(/^\s*<\?xml[^>]*\?>\s*/i, '');
        el.style.left = (p.x * 100) + '%';
        el.style.top = (p.y * 100) + '%';
        el.style.setProperty('--rot', p.rotation + 'deg');
        el.style.zIndex = p.z;
        el.style.setProperty('--w',
          +((BASE[item.sizeClass] || BASE.m) * p.scale).toFixed(2));
        var pour = mobile && MOBILE_POUR[item.id];
        if (pour) {
          el.style.left = (pour.x * 100) + '%';
          el.style.top = (pour.y * 100) + '%';
          el.style.setProperty('--rot', pour.rot + 'deg');
        }
        pile.appendChild(el);
      });
      if (window.JD_wirePile) window.JD_wirePile();
    })
    .catch(function (err) {
      fallbackNote();
      if (window.console && console.warn) console.warn('junk drawer: ' + err.message);
    });
})();

/* ---- dragging the pile — Pointer Events, one code path (PLAN-FRONTEND §3,
   PLAN-MOBILE §2). Mouse: press-and-drag immediately; click without drag
   (≤8px slop) just brings the item to front. Touch: items are
   touch-action: pan-y, so a quick swipe scrolls the page (we get
   pointercancel and release cleanly); holding ~180ms without moving >10px
   grips the item — the lift animation is the acknowledgment — and a
   non-passive touchmove preventDefault() keeps the drag from panning.
   On settle the item's rendered centre is baked back into its inline
   left/top in % of the well (the same coordinate space the loader applied
   from placement data). Drops clamp to the well minus a clearance margin
   (the overflow guillotine). Session-only; no persistence. Rotation
   while held: mouse wheel, [ / ] keys, or a second finger twisting
   around the gripping finger on touch — all mutate --rot, which the
   settle impulse and copy-layout already speak. Hit-testing is
   silhouette-accurate (shapes are pointer-events: visiblePainted, the
   wrapper and svg root none), so events target inner SVG shapes and
   bubble up to these item listeners. */
(function () {
  var well = document.querySelector('.jd-well');
  /* touch slops are wider than mouse: real thumbs jitter well past the
     10px that works in a simulator, and every misread press became a
     scroll (then a page-flip) on device — owner report, 2026-07-26 */
  var SLOP = 8, TOUCH_SLOP = 14, CLEAR = 6;
  var tapSlop = SLOP;
  var zTop = 100;
  var pend = null, held = null, drag = false;
  var sx = 0, sy = 0, ox = 0, oy = 0;
  var pid = -1, fx = 0, fy = 0, twist = null;

  function grip(item) {
    held = item;
    item.classList.remove('is-lifted');          /* releases the demo pin */
    item.classList.add('is-held');
  }

  /* tap = pick: pop to front, brief lift pulse, and an interim info chip
     (title · model · grade) at the drawer's front edge — visible feedback
     until the specimen card (Phase 3) replaces it */
  var chip = null, chipTimer = 0, pickTimer = 0, picked = null;
  function pick(item) {
    item.style.zIndex = ++zTop;
    if (picked) picked.classList.remove('is-picked');
    picked = item;
    item.classList.add('is-picked');
    clearTimeout(pickTimer);
    pickTimer = setTimeout(function () {
      item.classList.remove('is-picked');
      if (picked === item) picked = null;
    }, 700);
    if (!chip) {
      chip = document.createElement('div');
      chip.className = 'jd-picktip';
      chip.setAttribute('aria-live', 'polite');
      var stage = document.querySelector('.jd-stage');
      if (stage) stage.appendChild(chip);
    }
    chip.textContent = '';
    var t = document.createElement('span');
    t.textContent = item.dataset.title || '';
    var m = document.createElement('span');
    m.className = 'jd-picktip-model';
    m.textContent = ' · ' + (item.dataset.model || '');
    var g = document.createElement('span');
    g.className = 'jd-picktip-grade';
    g.textContent = ' · ' + (item.dataset.grade || '');
    chip.appendChild(t); chip.appendChild(m); chip.appendChild(g);
    chip.classList.add('is-on');
    clearTimeout(chipTimer);
    chipTimer = setTimeout(function () { chip.classList.remove('is-on'); }, 2600);
  }
  var dropX = 0, dropY = 0;
  /* drag moves are TRANSFORM-only (--dx/--dy): moving a filtered element via
     left/top forces layout repaints, and Blink leaves stale drop-shadow
     trails behind the old positions. The final spot is baked into left/top
     once, at settle, when the element is at rest. */
  function place(item, x, y) {
    var w = well.getBoundingClientRect();
    var mx = item.offsetWidth / 2 + CLEAR, my = item.offsetHeight / 2 + CLEAR;
    x = Math.max(mx, Math.min(w.width - mx, x));
    y = Math.max(my, Math.min(w.height - my, y));
    dropX = x; dropY = y;
    item.style.setProperty('--dx', (x - ox).toFixed(1) + 'px');
    item.style.setProperty('--dy', (y - oy).toFixed(1) + 'px');
  }
  function settle(item, moved) {
    item.classList.remove('is-held');
    item.style.zIndex = ++zTop;                  /* stays on top of the pile */
    if (moved) {                                 /* bake position, then rest */
      var w = well.getBoundingClientRect();
      item.style.left = (dropX / w.width * 100).toFixed(2) + '%';
      item.style.top = (dropY / w.height * 100).toFixed(2) + '%';
      var rot = parseFloat(getComputedStyle(item).getPropertyValue('--rot')) || 0;
      rot += (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random());  /* impulse */
      item.style.setProperty('--rot', rot.toFixed(1) + 'deg');
    }
    item.style.removeProperty('--dx');
    item.style.removeProperty('--dy');
  }

  /* per-item wiring is deferred: the pile is BUILT by the loader above, so
     the loader calls window.JD_wirePile() once the items exist in the DOM.
     Touch grips IMMEDIATELY, same as mouse (G5 revision 3, 2026-07-26):
     the old ~180ms hold existed only to prove a touch wasn't a page-scroll
     starting — moot now that item ink is touch-action:none. Touch-and-move
     drags right away; press-and-release within the slop is a tap/pick. */
  function wireItem(item) {
    item.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (held && e.pointerId !== pid) return;   /* second finger: twist owns it */
      pend = item; drag = false;
      pid = e.pointerId;
      tapSlop = e.pointerType === 'touch' ? TOUCH_SLOP : SLOP;
      sx = fx = e.clientX; sy = fy = e.clientY;
      var w = well.getBoundingClientRect(), r = item.getBoundingClientRect();
      ox = r.left + r.width / 2 - w.left;
      oy = r.top + r.height / 2 - w.top;
      try { item.setPointerCapture(e.pointerId); } catch (_) {}
      if (e.pointerType === 'mouse') e.preventDefault();
      grip(item);
    });
    item.addEventListener('pointermove', function (e) {
      if (pend !== item || e.pointerId !== pid) return;
      fx = e.clientX; fy = e.clientY;            /* twist pivots on this finger */
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (held === item) {
        if (!drag && dx * dx + dy * dy > tapSlop * tapSlop) drag = true;
        if (drag) place(item, ox + dx, oy + dy);
      }
    });
    item.addEventListener('touchmove', function (e) {
      if (held === item) e.preventDefault();     /* non-passive: stop the pan */
    }, { passive: false });
    item.addEventListener('pointerup', function (e) {
      if (e.pointerId !== pid) return;           /* second finger up ≠ release */
      if (held === item) {
        settle(item, drag);
        if (!drag) pick(item);                   /* press-release = tap/pick */
      }
      pend = held = null; drag = false; twist = null;
    });
    item.addEventListener('pointercancel', function (e) {
      if (e.pointerId !== pid) return;
      if (held === item) settle(item, drag);
      pend = held = null; drag = false; twist = null;
    });
  }
  window.JD_wirePile = function () {
    well.querySelectorAll('.jd-item').forEach(wireItem);
  };

  /* ---- rotating the held item ------------------------------------------ */
  function rotOf(item) { return parseFloat(getComputedStyle(item).getPropertyValue('--rot')) || 0; }
  function spin(item, d) { item.style.setProperty('--rot', (rotOf(item) + d).toFixed(1) + 'deg'); }

  window.addEventListener('wheel', function (e) {
    if (!held) return;
    e.preventDefault();                          /* no page scroll mid-hold */
    /* both axes: on macOS trackpads two-finger swipes arrive as wheel
       deltas in x AND y, so any two-finger stroke direction rotates */
    spin(held, Math.max(-30, Math.min(30, e.deltaY + e.deltaX)) * 0.2);
  }, { passive: false });

  /* macOS Safari exposes the trackpad two-finger ROTATE gesture as
     non-standard gesture events carrying a cumulative rotation angle.
     Chrome never fires these (its trackpad path is the wheel handler
     above). Only engaged while holding, so page pinch-zoom is untouched
     otherwise. */
  var gBase = 0;
  window.addEventListener('gesturestart', function (e) {
    if (!held) return;
    e.preventDefault(); gBase = rotOf(held);
  });
  window.addEventListener('gesturechange', function (e) {
    if (!held) return;
    e.preventDefault();
    held.style.setProperty('--rot', (gBase + e.rotation).toFixed(1) + 'deg');
  });
  window.addEventListener('gestureend', function (e) { if (held) e.preventDefault(); });

  window.addEventListener('keydown', function (e) {
    if (!held) return;
    if (e.key === '[') { e.preventDefault(); spin(held, -5); }
    else if (e.key === ']') { e.preventDefault(); spin(held, 5); }
  });

  /* second finger, anywhere: twist around the gripping finger */
  document.addEventListener('pointerdown', function (e) {
    if (!held || twist || e.pointerId === pid) return;
    twist = { id: e.pointerId,
              a0: Math.atan2(e.clientY - fy, e.clientX - fx),
              r0: rotOf(held) };
    e.stopPropagation(); e.preventDefault();
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!twist || !held || e.pointerId !== twist.id) return;
    var a = Math.atan2(e.clientY - fy, e.clientX - fx);
    held.style.setProperty('--rot',
      (twist.r0 + (a - twist.a0) * 180 / Math.PI).toFixed(1) + 'deg');
  }, true);
  function endTwist(e) { if (twist && e.pointerId === twist.id) twist = null; }
  document.addEventListener('pointerup', endTwist, true);
  document.addEventListener('pointercancel', endTwist, true);

  /* while gripping, two fingers must never pinch-zoom the page */
  document.addEventListener('touchmove', function (e) {
    if (held) e.preventDefault();
  }, { passive: false });

  /* arrange-mode: copy the pile's current placements as entry.json-shaped
     blocks — keyed by full item id, each value ready to paste straight into
     that entry's "placement" field (x/y 0..1 fractions of the well, item
     centre; scale passed through from the loaded entry) */
  var copy = document.getElementById('copy-layout');
  if (copy) copy.addEventListener('click', function (e) {
    e.preventDefault();
    var w = well.getBoundingClientRect(), out = {};
    well.querySelectorAll('.jd-item').forEach(function (item) {
      var r = item.getBoundingClientRect();
      out[item.dataset.id || 'item'] = {
        x: +(((r.left + r.width / 2 - w.left) / w.width).toFixed(4)),
        y: +(((r.top + r.height / 2 - w.top) / w.height).toFixed(4)),
        rotation: +(parseFloat(getComputedStyle(item).getPropertyValue('--rot')) || 0).toFixed(1),
        scale: parseFloat(item.dataset.scale) || 1,
        z: parseInt(getComputedStyle(item).zIndex, 10) || 0
      };
    });
    var json = JSON.stringify(out, null, 2), a = e.target, label = a.textContent;
    function done(ok) {
      a.textContent = ok ? 'copied ✓' : 'clipboard blocked — see prompt';
      setTimeout(function () { a.textContent = label; }, 1200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(
        function () { done(true); },
        function () { window.prompt('layout JSON:', json); done(false); });
    } else { window.prompt('layout JSON:', json); done(false); }
  });
})();

/* ---- immersive chrome (G5 revision 4, 2026-07-26) -----------------------
   Mobile only: the fixed site banner hides while the drawer is in view
   (the drawer owns the full 100svh on load) and slides back once the
   visitor scrolls toward the notes. The CSS lives in junk-drawer.css, so
   the behavior is scoped to this page; every other page's banner is
   untouched. */
(function () {
  var mq = window.matchMedia('(max-width: 768px)');
  var stage = document.querySelector('.jd-stage');
  if (!stage) return;
  function update() {
    /* one scrollY read + an idempotent class toggle: cheap enough to run
       unthrottled on scroll (rAF-gating proved unreliable in throttled/
       background contexts) */
    var show = !mq.matches || window.scrollY > stage.offsetHeight * 0.5;
    document.documentElement.classList.toggle('jd-chrome', show);
  }
  window.addEventListener('scroll', update, { passive: true });
  if (mq.addEventListener) mq.addEventListener('change', update);
  else if (mq.addListener) mq.addListener(update);
  update();
})();
