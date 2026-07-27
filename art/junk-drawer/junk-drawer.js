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

  /* ---- procedural scatter -------------------------------------------------
     Item positions are COMPUTED at load, never authored. Each browsing
     session gets ONE scatter, persisted in sessionStorage, so the layout is
     stable across refreshes but fresh on the next visit. An adaptive jittered
     grid (cell count tracks the item count) keeps things spread as the
     collection grows; generous jitter plus a wide rotation range give the
     loose, overlapping "junk pile" read. This retires both the hand-authored
     entry.placement blocks and the old MOBILE_POUR table — desktop and mobile
     now share one computed layout, and nobody hand-places items. */
  var SCATTER = {
    key: 'jd-scatter-v1',
    jitter: 0.62,   /* random offset as a fraction of the cell; >0.5 lets
                       neighbours cross and cluster → the looser pile */
    rotMax: 34,     /* rotation range, ± degrees */
    inset: 0.012    /* keep item centres at least this far off the well edge */
  };

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function seq(n) { var a = [], i; for (i = 0; i < n; i++) { a.push(i); } return a; }

  /* aspect (w/h) from the inlined SVG's viewBox; the item box is that wide by
     that tall, so it tells us how much room the item claims for clamping */
  function svgAspect(el) {
    var svg = el.querySelector('svg'), vb = svg && svg.getAttribute('viewBox');
    if (vb) {
      var n = vb.split(/[\s,]+/).map(Number);
      if (n.length === 4 && n[2] > 0 && n[3] > 0) { return n[2] / n[3]; }
    }
    return 1;
  }

  /* fresh scatter for every element in `els` (each already sized + in the DOM,
     so its footprint and aspect are measurable). Returns id -> {x,y,rot,z},
     x/y as 0..1 fractions of the well (resize-safe). */
  function computeScatter(els) {
    var host = pile.getBoundingClientRect();
    var W = host.width || 1, H = host.height || 1, MIN = Math.min(W, H);
    var N = els.length;
    var cols = Math.max(1, Math.round(Math.sqrt(N * (W / H))));
    var rows = Math.max(1, Math.ceil(N / cols));
    var cells = shuffle(seq(rows * cols));   /* random item -> cell mapping */
    var zs = shuffle(seq(N));                /* random, distinct stack order */
    var cellW = 1 / cols, cellH = 1 / rows, out = {};
    els.forEach(function (el, i) {
      var wpx = (parseFloat(el.style.getPropertyValue('--w')) || BASE.m) / 100 * MIN;
      var hpx = wpx / svgAspect(el);
      var hw = Math.min(0.5, wpx / 2 / W), hh = Math.min(0.5, hpx / 2 / H);
      var cell = cells[i], cc = cell % cols, cr = Math.floor(cell / cols);
      var x = (cc + 0.5) * cellW + (Math.random() * 2 - 1) * SCATTER.jitter * cellW;
      var y = (cr + 0.5) * cellH + (Math.random() * 2 - 1) * SCATTER.jitter * cellH;
      var loX = hw + SCATTER.inset, hiX = 1 - hw - SCATTER.inset;
      var loY = hh + SCATTER.inset, hiY = 1 - hh - SCATTER.inset;
      out[el.dataset.id] = {
        x: +(hiX > loX ? Math.max(loX, Math.min(hiX, x)) : 0.5).toFixed(4),
        y: +(hiY > loY ? Math.max(loY, Math.min(hiY, y)) : 0.5).toFixed(4),
        rot: +((Math.random() * 2 - 1) * SCATTER.rotMax).toFixed(1),
        z: zs[i] + 1
      };
    });
    return out;
  }

  /* stable-per-session: reuse the stored scatter iff it covers exactly the
     items on the page; otherwise recompute and persist. sessionStorage may be
     unavailable (private mode) — degrade to a fresh scatter each load. */
  function layoutFor(els) {
    var ids = els.map(function (e) { return e.dataset.id; }), stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(SCATTER.key) || 'null'); }
    catch (e) { stored = null; }
    var covers = stored && ids.every(function (id) { return stored[id]; });
    if (covers) { return stored; }
    var fresh = computeScatter(els);
    try { sessionStorage.setItem(SCATTER.key, JSON.stringify(fresh)); } catch (e) {}
    return fresh;
  }

  /* arrange mode: the copy-layout link renders ONLY under ?arrange=1 (a dev
     affordance; the gesture script binds it by id when present). Since items
     are now auto-scattered (no entry.placement), this is a debug readout of
     the live/dragged positions, not an authoring step. Inserted before the
     gesture IIFE runs, so the binding below always sees it. */
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
        /* the item tag also needs: process, date, the grade's rank on the
           scale (manicule position), the scale size, and the file url */
        var gen = primary.generation || {};
        item._process = gen.mode === 'refined'
          ? 'REFINED ×' + (gen.prompt_count || '?') : 'ONE-SHOT';
        item._date = primary.date || '';
        item._rank = grade ? grade.rank : 0;
        item._steps = (tax.grades || []).length || 5;
        item._url = primary.url;
        return fetch(primary.url).then(function (r) {
          if (!r.ok) throw new Error(primary.url + ' ' + r.status);
          return r.text();
        }).then(function (svg) { return { item: item, svg: svg }; });
      }));
    })
    .then(function (loaded) {
      /* build + size every item first (sizeClass only; positions come next) */
      var els = loaded.map(function (rec) {
        var item = rec.item;
        var el = document.createElement('div');
        el.className = 'jd-item';
        el.dataset.id = item.id;
        el.dataset.scale = 1;                    /* copy-layout passthrough */
        el.dataset.title = item.title;
        el.dataset.model = item._modelLabel;
        el.dataset.grade = item._gradeLabel;
        el.dataset.process = item._process;
        el.dataset.date = item._date;
        el.dataset.rank = item._rank;
        el.dataset.steps = item._steps;
        el.dataset.url = item._url;
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', item.title);
        el.innerHTML = rec.svg.replace(/^\s*<\?xml[^>]*\?>\s*/i, '');
        /* size = coarse sizeClass tier × optional per-item fine scale. The
           per-item sizeScale is the continuous dial (formerly carried by the
           retired placement.scale) that the tiers alone can't express — e.g.
           the paperclip sits well below the smallest tier. */
        var fine = (typeof item.sizeScale === 'number' && item.sizeScale > 0)
          ? item.sizeScale : 1;
        el.style.setProperty('--w',
          +((BASE[item.sizeClass] || BASE.m) * fine).toFixed(2));
        pile.appendChild(el);
        return el;
      });
      /* positions are computed, never authored — see SCATTER above. One layout
         per session; applied in the same tick so nothing paints un-placed. */
      var layout = layoutFor(els);
      els.forEach(function (el) {
        var p = layout[el.dataset.id];
        el.style.left = (p.x * 100) + '%';
        el.style.top = (p.y * 100) + '%';
        el.style.setProperty('--rot', p.rot + 'deg');
        el.style.zIndex = p.z;
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

  /* tap = pick: pop to front, brief lift pulse, and the ITEM TAG — a manila
     specimen tag tethered to the picked object by a red elastic through its
     grommet (owner design, mockup-6). Persists until dismissed: tap wood /
     Esc / pick another item / drag the picked item. */
  var tag = null, rope = null, picked = null, pendingReturn = null;
  var pileEl = well.querySelector('.jd-pile');

  function meterSVG(rank, steps) {
    var span = 66, x0 = 2;
    var ticks = '', gap = span / (steps - 1);
    for (var i = 0; i < steps; i++) {
      var tx = x0 + i * gap, end = (i === 0 || i === steps - 1);
      ticks += '<line x1="' + tx + '" y1="' + (end ? 3.5 : 5) + '" x2="' + tx +
        '" y2="10" stroke="rgba(58,42,18,0.55)" stroke-width="1"/>';
    }
    var mx = x0 + (rank - 1) * gap;
    return '<svg width="88" height="26" viewBox="-9 0 88 26" role="img" ' +
      'aria-label="grade ' + rank + ' of ' + steps + '">' +
      '<line x1="2" y1="7.5" x2="68" y2="7.5" stroke="rgba(58,42,18,0.55)" stroke-width="1"/>' +
      ticks +
      '<text x="' + mx + '" y="24" text-anchor="middle" font-size="15" ' +
      'fill="#3a2a12" font-family="inherit">☝︎</text></svg>';
  }

  function buildTag() {
    tag = document.createElement('div');
    tag.className = 'jd-itemtag';
    tag.setAttribute('role', 'group');
    rope = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    rope.setAttribute('class', 'jd-rope');
    well.appendChild(rope);
    well.appendChild(tag);
  }

  function returnToPile(item) {
    if (item.parentNode === well && pileEl) {
      pileEl.appendChild(item);
      item.style.zIndex = ++zTop;
    }
  }
  function hideTag() {
    if (tag) { tag.classList.remove('is-on'); rope.classList.remove('is-on'); }
    if (picked) {
      picked.classList.remove('is-picked');
      /* mid-drag dismissal: moving the node now would break pointer
         capture — settle() performs the return instead */
      if (held === picked) pendingReturn = picked;
      else returnToPile(picked);
      picked = null;
    }
    well.classList.remove('jd-has-pick');
  }

  function pick(item) {
    item.style.zIndex = ++zTop;
    if (picked && picked !== item) picked.classList.remove('is-picked');
    picked = item;
    item.classList.add('is-picked');       /* persists: selected = lifted */
    well.classList.add('jd-has-pick');     /* the rest of the pile dims */
    /* hoist the object out of the pile's stacking context so it renders
       ABOVE the elastic (tag 70 < rope 71 < item 72). Same positioning
       box — the pile is inset:0 of the well. Returned on dismissal. */
    if (item.parentNode !== well) well.appendChild(item);
    item.style.zIndex = 72;
    if (!tag) buildTag();

    var d = item.dataset;
    tag.setAttribute('aria-label', 'specimen tag: ' + (d.title || ''));
    tag.innerHTML =
      '<div class="l1">' + (d.title || '').toUpperCase() +
      '<span class="sep">·</span>' + (d.model || '').toUpperCase() +
      '<span class="sep">·</span><span class="dim">' + (d.date || '') + '</span></div>' +
      '<div class="l2"><span class="gradecol">' +
      '<span class="gradelabel">GRADE: <span class="g">' + (d.grade || '').toUpperCase() + '</span></span>' +
      meterSVG(+d.rank || 1, +d.steps || 5) +
      '</span><span class="btns">' +
      '<a class="btn" href="' + d.url + '" download="' + d.id + '.svg" ' +
      'title="download the SVG as generated">DOWNLOAD<br>SVG ⤓</a>' +
      '<a class="btn jd-fullrecord" href="#" title="the full record is the next build">FULL RECORD →</a>' +
      '</span></div>';
    var fr = tag.querySelector('.jd-fullrecord');
    fr.addEventListener('click', function (e) { e.preventDefault(); });

    /* seat the tag just below the item, grommet toward it, clamped to the
       well; if there's no room below, it hangs above instead */
    var w = well.getBoundingClientRect(), r = item.getBoundingClientRect();
    var ax = r.left + r.width / 2 - w.left;      /* anchor: item bottom centre */
    var ay = r.bottom - w.top - 6;
    tag.classList.add('is-on');                  /* measurable before placing */
    var tw = tag.offsetWidth, th = tag.offsetHeight;
    var below = ay + 26 + th < w.height - 8;
    var ty = below ? ay + 26 : (r.top - w.top - 20 - th);
    var tx = Math.max(8, Math.min(w.width - tw - 8, ax + 4));
    tag.style.left = tx + 'px';
    tag.style.top = ty + 'px';

    /* the red elastic: item anchor -> a loop through the grommet (which
       sits at the tag's left edge, vertically centred) */
    var gx = tx + 10, gy = ty + th / 2;
    var sag = below ? 10 : -10;
    rope.setAttribute('class', 'jd-rope is-on');
    rope.innerHTML =
      '<path d="M ' + ax + ' ' + (below ? ay : r.top - w.top + 6) +
      ' Q ' + ((ax + gx) / 2 + 6) + ' ' + ((ay + gy) / 2 + sag) +
      ', ' + gx + ' ' + gy + '" fill="none" stroke="#b3402f" ' +
      'stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="' + gx + '" cy="' + gy + '" r="4.5" fill="none" ' +
      'stroke="#b3402f" stroke-width="2"/>';
  }

  /* dismissal: any press that isn't the item or the tag — wood, page,
     notes, anywhere — plus Escape and resize (positions go stale) */
  document.addEventListener('pointerdown', function (e) {
    if (!e.target.closest || !e.target.closest('.jd-item, .jd-itemtag')) hideTag();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideTag();
  });
  window.addEventListener('resize', hideTag);
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
    if (pendingReturn === item) { returnToPile(item); pendingReturn = null; }
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
        if (!drag && dx * dx + dy * dy > tapSlop * tapSlop) {
          drag = true;
          if (picked === item) hideTag();   /* the elastic lets go */
        }
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

  /* arrange-mode: dump the pile's current positions (x/y 0..1 fractions of the
     well, item centre), keyed by full item id. Debug readout only — items are
     auto-scattered now, so this is for inspecting a layout, not authoring one;
     nothing consumes a pasted-back block. */
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
