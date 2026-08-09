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
  var payloadRef = null;   /* the data.php payload, handed to JD_record */
  /* tier box per sizeClass, in cqmin. Fallback only — the live boxes come
     from taxonomy.sizeTiers at load (see sizeBoxes), so the scale is
     data-driven. */
  var BASE = { xs: 6, s: 9, m: 15.5, l: 22, xl: 30 };

  /* ---- size normalization (owner decision, 2026-08-09) -------------------
     Tiers are AREA classes. The tier box is the side of the square every
     item's footprint matches: w·h = box² whatever the artwork's proportions,
     so a tall column and a wide fish filed "m" carry the same visual weight.
     (Before this, --w set the tier box as the WIDTH and height followed the
     viewBox freely — a 0.38-aspect "m" rendered 2.7× the area of a square
     "m" and outgrew every "l".) Two dials ride on top:
       · sizeScale — the owner's per-item fine multiplier, applied AFTER
         normalization so it means the same thing at every aspect;
       · a small deterministic jitter hashed from the item id — stable
         natural variation, so a tier reads as a family of near-sizes, never
         as ranks of uniform boxes. Hashed, not random: an item's size is
         part of its identity, identical on every visit. */
  var SIZE = {
    elong: 1.8,    /* long-side cap, × the tier box: past this elongation the
                      long side stops growing and the item pays in area
                      instead, so slivers (pencil, popsicle) read a touch
                      lighter than tier-mates rather than spanning the well */
    jitter: 0.09   /* ± fraction of linear size (≈ ±18% of area) */
  };

  function sizeJitter(id) {
    var s = String(id), h = 5381, i;
    for (i = 0; i < s.length; i++) { h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; }
    return 1 - SIZE.jitter + (h % 1000) / 999 * 2 * SIZE.jitter;
  }

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
    key: 'jd-scatter-v2',   /* v2: area-normalized sizes — v1 positions were
                               clamped against the old width-only footprints */
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

  /* Namespace one inlined copy of an SVG: prefix every id it declares and
     every reference to one (url(#), href, xlink:href), so copies sharing a
     document can't bind to each other's defs.

     This is not optional hygiene. Item SVGs are authored independently and
     nothing stops two of them choosing the same id — `leaf`, `glow`, `grain`
     and `soft` are all declared by more than one item. A `<use href="#leaf">`
     resolves to the FIRST match in the document, so unprefixed copies fight
     over one definition and the winner depends on DOM order — which pick()
     and returnToPile() change every time an item is selected and dismissed.
     Prefixing per copy makes ids unique whatever a future item declares, and
     makes DOM order irrelevant.

     Both quote styles are matched: models emit double quotes today, but the
     guarantee shouldn't rest on that. (Not handled, because nothing in the
     collection uses them: `#id` selectors inside an SVG <style> block, and
     id references that aren't url(#)/href form — aria-labelledby, SMIL
     begin="other.click". Check before filing an item that uses one.) */
  function svgInst(svg, pfx) {
    return String(svg)
      .replace(/^\s*<\?xml[^>]*\?>\s*/i, '')
      .replace(/\sid=(["'])([^"']+)\1/g, ' id=$1' + pfx + '$2$1')
      .replace(/url\((["']?)#([^)"']+)\1\)/g, 'url($1#' + pfx + '$2$1)')
      .replace(/(\s(?:xlink:)?href=)(["'])#([^"']+)\2/g, '$1$2#' + pfx + '$3$2');
  }
  window.JD_svgInst = svgInst;   /* the record card inlines copies too */

  /* SIZE, as filed — the one display string for how big an item reads in the
     drawer, shown on the specimen tag and the report card. Taxonomy-driven:
     the tier's own label, never a hardcoded name, falling back to the raw
     sizeClass id if the tier isn't registered. The per-item sizeScale is part
     of the size the owner chose, so it is stated too rather than hidden — an
     item filed as "s" × 0.364 reads "Small ×0.36", not "Small". */
  function sizeLabel(tax, item) {
    var tiers = (tax || {}).sizeTiers || [], t = null;
    for (var i = 0; i < tiers.length; i++) {
      if (tiers[i].id === item.sizeClass) { t = tiers[i]; break; }
    }
    var label = t ? t.label : (item.sizeClass || '');
    if (!label) return '';
    /* round FIRST, then decide: a scale of 1.003 displays as ×1, which says
       nothing the tier hasn't already said — so it is dropped rather than
       printed as a distinction the reader can't see */
    var fine = item.sizeScale;
    if (typeof fine === 'number' && fine > 0) {
      var shown = +fine.toFixed(2);
      if (shown !== 1) label += ' ×' + String(shown);
    }
    return label;
  }
  window.JD_sizeLabel = sizeLabel;   /* the record card states it too */

  /* RATINGS, as filed — entries store every rating as a NUMBER: a grade is
     the taxonomy grade's `rank` (5.0 … 1.0) and an annotation is the axis
     value's `rank` (3.0 … 1.0), never the id or label (entry schema 2), so
     the scales' wording can change without touching filed data. Resolve the
     number back to its taxonomy object here; display strings still come
     only from the taxonomy. */
  function byRank(list, value) {
    list = list || [];
    for (var i = 0; i < list.length; i++) {
      if (Number(list[i].rank) === Number(value)) return list[i];
    }
    return null;
  }
  window.JD_byRank = byRank;     /* the record card resolves axis values */
  function gradeOf(tax, value) {
    return byRank((tax || {}).grades, value);
  }
  window.JD_gradeOf = gradeOf;   /* the record card resolves grades too */

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
      /* live axes first, then defunct ones dimmed at the foot — retired
         axes stay listed because old responses still carry their grades */
      var axes = (tax.axes || []).slice().sort(function (a, b) {
        return (a.defunct ? 1 : 0) - (b.defunct ? 1 : 0);
      });
      axes.forEach(function (ax) {
        var row = document.createElement('div');
        row.className = 'jd-axis-row' + (ax.defunct ? ' is-defunct' : '');
        var label = document.createElement('span');
        label.className = 'jd-axis-label';
        label.textContent = ax.label || ax.id;
        if (ax.defunct) {
          var flag = document.createElement('span');
          flag.className = 'jd-axis-flag';
          flag.textContent = 'defunct';
          label.appendChild(flag);
        }
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
      var grade = gradeOf(tax, primary.grade);
      var li = document.createElement('li');
      var t = document.createElement('span');
      t.className = 'jd-inv-title';
      t.textContent = item.title || item.id;
      var m = document.createElement('span');
      m.className = 'jd-inv-model';
      m.textContent = model ? model.label : (primary.model || '');
      var g = document.createElement('span');
      g.className = 'jd-inv-grade';
      g.textContent = grade ? grade.label : (primary.grade == null ? '' : String(primary.grade));
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
      payloadRef = data;   /* the record module renders from this payload */
      /* resolve + fetch every primary response SVG (contract: primary
         always resolves; every response has a ready same-origin url) */
      var tax = data.taxonomy || {};
      function byId(list, id) {
        return (list || []).filter(function (x) { return x.id === id; })[0];
      }
      /* tier boxes are data: taxonomy.sizeTiers is the source of truth, with
         the hardcoded BASE as fallback if an id is missing */
      var tiers = {};
      (tax.sizeTiers || []).forEach(function (t) { tiers[t.id] = t.box; });
      function boxFor(sc) { return tiers[sc] || BASE[sc] || BASE.m; }
      return Promise.all(data.items.map(function (item) {
        var primary = item.responses.filter(function (r) {
          return r.rid === item.primary;
        })[0] || item.responses[0];
        /* display labels for the tap pick-chip, resolved while the
           taxonomy is in scope */
        var model = byId(tax.models, primary.model);
        var grade = gradeOf(tax, primary.grade);
        item._modelLabel = model ? model.label : (primary.model || '');
        item._gradeLabel = grade ? grade.label
          : (primary.grade == null ? '' : String(primary.grade));
        /* the item tag also needs: process, date, the grade's rank on the
           scale (manicule position), the scale size, and the file url */
        var gen = primary.generation || {};
        item._process = gen.mode === 'refined'
          ? 'REFINED ×' + (gen.prompt_count || '?') : 'ONE-SHOT';
        item._date = primary.date || '';
        item._rank = grade ? grade.rank : (+primary.grade || 0);
        item._steps = (tax.grades || []).length || 5;
        item._box = boxFor(item.sizeClass);   /* tier box in cqmin, from taxonomy */
        /* SIZE, as filed: the owner's sizeClass tier read back as its
           taxonomy label, with the fine multiplier appended when one is set
           (so "Small ×0.36" states the whole size, not just the tier) */
        item._sizeLabel = sizeLabel(tax, item);
        item._url = primary.url;
        return fetch(primary.url).then(function (r) {
          if (!r.ok) throw new Error(primary.url + ' ' + r.status);
          return r.text();
        }).then(function (svg) { return { item: item, svg: svg }; });
      }));
    })
    .then(function (loaded) {
      /* build + size every item first (sizeClass only; positions come next) */
      var els = loaded.map(function (rec, i) {
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
        el.dataset.size = item._sizeLabel;
        el.dataset.url = item._url;
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', item.title);
        /* per-item prefix: the pile is many independently-authored SVGs in
           one document, so each copy gets its own id namespace */
        el.innerHTML = svgInst(rec.svg, 'jp' + i + '_');
        /* size: area-normalized (see SIZE above). --w still carries WIDTH
           (the CSS contract is unchanged); width is chosen so the footprint
           lands on the tier's area whatever the viewBox proportions:
             w = box·√aspect  →  h = w/aspect = box/√aspect  →  w·h = box².
           Elongation past SIZE.elong shrinks the whole item to keep the long
           side at box×elong. Then the owner's fine dial and the id-hash
           jitter. The aspect is read from the copy just inlined above. */
        var fine = (typeof item.sizeScale === 'number' && item.sizeScale > 0)
          ? item.sizeScale : 1;
        var sq = Math.sqrt(svgAspect(el));
        var shape = Math.min(1, SIZE.elong / Math.max(sq, 1 / sq));
        el.style.setProperty('--w',
          +((item._box || BASE.m) * sq * shape * fine * sizeJitter(item.id)).toFixed(2));
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
      /* hand the record module the payload + the primary SVG texts (so a
         record opens with zero extra requests), then honor a #<id> deep
         link — loading with a hash opens that item's report card */
      if (window.JD_record) {
        var primaries = {};
        loaded.forEach(function (rec) {
          var it = rec.item;
          var pr = it.responses.filter(function (r) {
            return r.rid === it.primary;
          })[0] || it.responses[0];
          primaries[it.id + '/' + pr.file] = rec.svg;
        });
        window.JD_record.setData(payloadRef, primaries);
        if (location.hash.length > 1) window.JD_record.openFromHash();
      }
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
     Esc / pick another item. Dragging the picked item NO LONGER lets go —
     the elastic has real physics now and follows (owner request,
     2026-08-09); the tag itself can be dragged around too. The picked
     specimen is also turned UPRIGHT for inspection (0deg, CSS) and its
     rotation gestures stand down until it is put back — see spin(). */
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

  /* ---- the red elastic, as an actual elastic (owner request, 2026-08-09) ---
     The tether used to be ONE static quadratic path, drawn once at pick time
     and then frozen. It could not dangle, could not stretch, and the instant
     anything moved it was a lie — which is why dragging a picked item used to
     dismiss the tag outright rather than admit the string had stopped
     following. It is a Verlet chain now: SEGMENTS point masses pinned at both
     ends, gravity plus distance constraints, resimulated per frame while the
     tag is up.

     Four decisions carry the behavior, and each is load-bearing:

     · REST LENGTH IS FIXED AT PIN TIME, not recomputed per frame. The chain
       is handed SLACK× the endpoint distance the moment it is pinned (floored
       at MIN_REST, so a tag seated almost on top of its item still gets a
       visible loop of string rather than a taut hyphen). That fixed length IS
       the physics: drag the item away and the same piece of string runs out
       of slack and pulls straight; bring it back and the slack returns as
       dangle. Re-measuring the rest length every frame would give a rope that
       is always equally slack — i.e. no stretch at all.

     · THE ITEM END ANCHORS AT THE ITEM'S CENTRE, never at an edge. The
       z-sandwich (tag 70 < rope 71 < picked item 72) means the rope passes
       UNDER the artwork, so an anchor at the centre is always buried in ink
       and can never show a gap. The old anchor was the edge-centre of the
       item's PREDICTED rotated/zoomed bounding box, and for a rotated or
       elongated item that point floats well off the drawn shape — the string
       visibly ended in mid-air. Centre anchoring is the fix.

     · THE LOOP SLEEPS. rAF runs only while the tag is on AND something is
       still moving; once every point settles below EPS with both endpoints
       unchanged, the frame cancels itself and an endpoint move wakes it
       again. A picked item sitting still costs exactly nothing.

     · THE STEP IS PER-FRAME, NOT PER-MILLISECOND. Verlet stores velocity as
       (position − previous position), so feeding it a variable dt rescales
       that velocity mid-flight and a single dropped frame launches the chain
       across the well. A fixed step is stable; the cost is that the sag falls
       a little faster on a 120Hz display, which nobody can see. */
  var ROPE = {
    SEGMENTS: 16,     /* point masses in the chain, both ends included */
    SLACK: 1.25,      /* rest length as a multiple of the span at pin time */
    MIN_REST: 60,     /* px — the shortest string we will ever hang */
    GRAVITY: 0.55,    /* px per frame², ~60fps */
    DAMPING: 0.97,    /* velocity kept per frame (1.0 would swing forever) */
    ITER: 4,          /* constraint relaxation passes per frame (alternating) */
    STIFF: 0.09,      /* bending resistance, 0..1 — see ropeStep */
    EPS: 0.05         /* px moved per frame under which the chain is at rest */
  };
  var ropePts = null;         /* the chain: [{x,y,px,py}], 0 = item, last = grommet */
  var ropeSeg = 0;            /* per-segment rest length, frozen at pin time */
  var ropeAx = 0, ropeAy = 0; /* live item-end endpoint, well coords */
  var ropeBx = 0, ropeBy = 0; /* live grommet endpoint, well coords */
  var ropeRAF = 0;
  var ropePath = null, ropeGrom = null;
  /* the tag's height, measured when it is seated. The grommet sits at its
     vertical middle, and we refuse to read offsetHeight inside the rAF loop —
     a forced layout per frame on a drop-shadowed element is exactly the
     repaint stall the drag path already goes out of its way to avoid. */
  var ropeTagH = 0;
  var ropeCalm = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function ropeReduced() { return !!(ropeCalm && ropeCalm.matches); }
  function r1(v) { return Math.round(v * 10) / 10; }

  /* the item's layout-box CENTRE in well coords. The rotation and the picked
     zoom both live on the INNER svg, so the wrapper's rect centre is the
     visual centre whatever the item is doing — this is the one point about an
     item that never needs a transform correction. */
  function ropeCentre(item) {
    var w = well.getBoundingClientRect(), r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2 - w.left, y: r.top + r.height / 2 - w.top };
  }
  /* The tag endpoint is the GROMMET: 10px in from the tag's left edge,
     vertically centred — the same spot the ::before brass ring is painted at
     in the stylesheet. Both places that move the tag (pick's seating and the
     tag drag) already hold its left/top as numbers, so they pass the grommet
     straight to ropeSetTagEnd rather than reading it back off the element. */

  /* ---- where the elastic grabs the object (testing report, 2026-08-09) ----
     Anchoring at the item's CENTRE cured the old bounding-box disconnect, but
     it bought two defects of its own, both caused by the same thing — half
     the string living underneath the artwork:

       · on HOLLOW silhouettes the centre is not ink at all. A rubber band's
         centre is the hole; the toilet's is the notch between seat and tank;
         the fish skeleton's is the gap between two ribs. The tip came to
         rest on bare wood INSIDE the item's own box, which reads as exactly
         the disconnected string we set out to fix.
       · the DANGLE went missing. The belly of a slack rope sits near the
         middle of its span, and with one pin buried at the centre, up to
         55% of the chain was hidden under the artwork — so the visible
         remainder ran dead straight and the elastic read as taut.

     Both are fixed by grabbing the NEAR EDGE of the silhouette instead:
     march from the grommet toward the centre and stop at the first painted
     pixel. The tip is then on ink by construction, whatever shape the item
     is, and almost the whole chain hangs in the open where its sag shows.

     Hit testing does the shape reading, because the shape is the SVG's own
     and nothing else can answer for it: item ink is pointer-events
     visiblePainted, the picked item is the topmost hit-testable thing in the
     well (z 72; every overlay above the pile is pointer-events:none), and
     the rope overlay cannot hit itself. A probe is only accepted when it
     lands on THIS item, so the tag, neighbours and wood are all rejected.

     THE MATRIX CORRECTION IS THE SUBTLE PART. pick() runs at the START of
     the 0.15s zoom-and-straighten transition, so the artwork on screen is
     part-way between its scattered pose and its picked one — probing it
     naively would find ink at coordinates that mean something else once the
     transition lands. So probes are authored in the SETTLED pose (upright,
     ×--pick-scale) as offsets from the centre, then pushed through the svg's
     CURRENT matrix to ask "where is this point right now?" before the hit
     test. getComputedStyle and hit testing read the same in-flight animation
     value, so the two always agree. The anchor is stored as that settled-pose
     offset, which is why it survives drags untouched: a picked item is rigid
     (upright, fixed scale), so centre + offset is the live tip forever. */
  var ANCHOR_STEP = 2;    /* px between probes along the ray */
  var ANCHOR_BITE = 6;    /* px to sink past the first ink, so antialiasing at
                             the silhouette edge can't leave a hairline of
                             wood showing at the tip — but never deeper than
                             the ink runs, or a thin ring's far side is the
                             hole again */
  var ANCHOR_MIN_RUN = 3; /* px of ink along the ray that count as a real
                             purchase rather than a grazed corner */
  /* aim points for the probe fan, as fractions of the item's half-short-side
     either side of the centre. Centre first — it is right for most items and
     costs one ray; the rest only run when the object is concave enough to
     have swallowed the centre line. */
  var ANCHOR_FAN = [0, -0.3, 0.3, -0.6, 0.6, -0.85, 0.85];
  var ropeOffX = 0, ropeOffY = 0;   /* the anchor, as a settled-pose offset */

  function ropeMatrix(el) {
    var m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform || '');
    if (!m) return [1, 0, 0, 1];
    var n = m[1].split(',');
    return [parseFloat(n[0]) || 0, parseFloat(n[1]) || 0,
            parseFloat(n[2]) || 0, parseFloat(n[3]) || 0];
  }

  /* resolve the anchor for `item`, given its centre and the grommet (both in
     well coords). Sets ropeOffX/ropeOffY; falls back to the centre (0,0) if
     nothing is found at all, so the worst case is the old behavior.

     A SINGLE ray at the centre is not enough, because plenty of these
     objects are concave and the centre line runs through the hole. The line
     from a tag up-left of the toilet to the toilet's centre passes over the
     empty air above the bowl, through the notch between bowl and tank, and
     arrives at a centre that is itself unpainted — it never touches the
     toilet at all. So the probe FANS: the centre ray first (cheap, and right
     for the great majority), then progressively wider rays aimed either side
     of the centre, until one finds ink. The elastic ends up hooked on
     whatever part of the object actually faces the tag, which is what a
     string tied round a real object does. */
  function ropeAnchor(item, cx, cy, gx, gy) {
    ropeOffX = 0; ropeOffY = 0;
    var svg = item.querySelector('svg');
    if (!svg || !document.elementFromPoint) return;
    var w = well.getBoundingClientRect();
    var zoom = parseFloat(getComputedStyle(item)
      .getPropertyValue('--pick-scale')) || 1;
    var m = ropeMatrix(svg);
    var r = item.getBoundingClientRect();
    var dx = cx - gx, dy = cy - gy;
    var len0 = Math.sqrt(dx * dx + dy * dy);
    if (len0 < 1) return;
    /* how far off the centre line the widest fan rays aim. The SHORT side of
       the item bounds it, so an aim point stays inside the artwork however
       elongated it is. */
    var spread = zoom * Math.min(r.width, r.height) / 2;
    var nx = -dy / len0 * spread, ny = dx / len0 * spread;
    /* only the stretch of ray that can be inside the item is worth probing —
       start where it enters the settled pose's bounding circle */
    var reach = zoom * Math.sqrt(r.width * r.width + r.height * r.height) / 2;

    /* is the settled-pose offset (vx,vy) from the centre on this item's ink
       as things stand right now? (see the matrix note above) */
    function inkAt(vx, vy) {
      var el = document.elementFromPoint(
        w.left + cx + (m[0] * vx + m[2] * vy) / zoom,
        w.top + cy + (m[1] * vx + m[3] * vy) / zoom);
      return !!(el && el.closest && el.closest('.jd-item') === item);
    }

    var graze = null;
    /* one ray, grommet -> (centre + perpendicular·f). Returns the offset to
       grab, or null when this ray finds no real purchase. */
    function ray(f) {
      var ex = cx + nx * f - gx, ey = cy + ny * f - gy;
      var len = Math.sqrt(ex * ex + ey * ey);
      if (len < 1) return null;
      var ux = ex / len, uy = ey / len;
      var from = Math.max(0, len - reach);
      function at(s) { return inkAt(gx + ux * s - cx, gy + uy * s - cy); }
      var s, a, b, deep, v;
      for (s = from; s <= len; s += ANCHOR_STEP) {
        if (!at(s)) continue;
        /* Found an edge. Measure how far the ink RUNS from here, refining
           both ends at sub-step resolution, and settle in the middle of that
           run — capped at ANCHOR_BITE so a solid body is still gripped near
           its edge (which is what keeps the sag out in the open) while a
           SLIVER is gripped down its spine. Biting a flat few px into a
           popsicle stick crossed near-lengthwise put the tip back out in the
           antialiasing on the far side; centring in the run cannot. */
        a = s; b = s;
        while (a - 0.5 >= from && at(a - 0.5)) { a -= 0.5; }
        while (b + ANCHOR_STEP <= len && b - a < ANCHOR_BITE * 2 && at(b + ANCHOR_STEP)) {
          b += ANCHOR_STEP;
        }
        while (b + 0.5 <= len && b - a < ANCHOR_BITE * 2 && at(b + 0.5)) { b += 0.5; }
        deep = Math.min(a + ANCHOR_BITE, (a + b) / 2);
        v = { x: gx + ux * deep - cx, y: gy + uy * deep - cy };
        /* a GRAZE — the ray clipping a corner or a rounded end, a run barely
           a pixel thick — has no interior to sit in, so even its midpoint is
           within antialiasing of bare wood. Remember it and keep looking for
           ink thick enough to hold a knot; the graze is only used if nothing
           better turns up on any ray. */
        if (b - a < ANCHOR_MIN_RUN) {
          /* keep the THICKEST graze seen, not the first: on a wispy item —
             a peacock feather is all barbs — every crossing is a graze, and
             the fattest one (a quill rather than a barb) is the only place
             with enough ink to hide a rope end in */
          if (!graze || b - a > graze.run) { graze = { v: v, run: b - a }; }
          s = b; continue;
        }
        return v;
      }
      return null;
    }

    var i, hit;
    for (i = 0; i < ANCHOR_FAN.length; i++) {
      hit = ray(ANCHOR_FAN[i]);
      if (hit) { ropeOffX = hit.x; ropeOffY = hit.y; return; }
    }
    if (graze) {
      /* nothing but grazes anywhere: creep the tip a little further in
         toward the centre before giving up. On the wispy items that end up
         here the ink that IS present runs inward — a feather's barbs thicken
         into its quill — so a couple of px that way buys real coverage,
         and on anything else it is a nudge too small to see. */
      var gl = Math.sqrt(graze.v.x * graze.v.x + graze.v.y * graze.v.y);
      var pull = gl > ANCHOR_BITE ? (gl - ANCHOR_BITE / 2) / gl : 1;
      ropeOffX = graze.v.x * pull; ropeOffY = graze.v.y * pull;
    }
  }

  /* pick() probes while the 0.15s zoom is still in flight, and the matrix
     correction above is only as good as a hit test on part-grown artwork:
     a 3px rim in the settled pose is under 2px while the item is still
     small, which is thin enough for antialiasing to answer "wood" on a
     probe that will land on ink a moment later. So the anchor is CONFIRMED
     once, right after the transition lands, against the real geometry. The
     chain is still swinging into its sag at that point, so moving a pinned
     end is invisible — it is the same thing an item drag does. */
  var ZOOM_SETTLE = 200;    /* ms: the 0.15s transform ease, plus slack */
  var ropeArm = 0;
  function ropeConfirmAnchor(item) {
    if (ropeArm) clearTimeout(ropeArm);
    ropeArm = setTimeout(function () {
      ropeArm = 0;
      if (picked === item) ropeReanchor(item);
    }, ZOOM_SETTLE);
  }

  /* the live item endpoint: the anchor, carried by the centre */
  function ropeItemEnd(item) {
    var c = ropeCentre(item);
    return { x: c.x + ropeOffX, y: c.y + ropeOffY };
  }
  /* re-read the anchor against the CURRENT grommet direction and move the
     endpoint to match. Called at the two moments the geometry has just
     changed and everything is at rest — an item drop and a tag drop — because
     the near edge of a silhouette depends on which way the string is pulling.
     Deliberately does NOT re-pin: the rest length stays frozen from pick, so
     a dragged-away item keeps its hard-won tautness. */
  function ropeReanchor(item) {
    if (!ropePts || item !== picked) return;
    var c = ropeCentre(item);
    ropeAnchor(item, c.x, c.y, ropeBx, ropeBy);
    ropeSetItemEnd(c.x + ropeOffX, c.y + ropeOffY);
  }

  /* (re)string the elastic between two points: freeze the rest length, then
     lay the chain out ALREADY BOWED by the slack, at zero velocity. Called at
     every pick — a re-pick gets a fresh string, not a stretched one.

     The bow is not decoration, it is the difference between string and
     squiggle. Laid out dead straight, the extra length has nowhere to go: the
     tag is seated directly below its item most of the time, so the span is
     near-vertical, gravity points along it, and the surplus buckles into a
     little kink near one pin instead of hanging. Seeding a half-sine bow of
     the right amplitude spends the surplus sideways from the first frame —
     for y = A·sin(πt) the arc runs π²A²/4L longer than the chord, so
     A = (2/π)·√(L·(rest−L)) puts exactly the slack we froze into the curve.
     The bow leans DOWNWARD (leftward when the span is perfectly vertical,
     which keeps it off the manila, whose grommet is on its left edge), so
     gravity finishes the shape rather than fighting it. */
  function ropePin(ax, ay, bx, by) {
    var n = ROPE.SEGMENTS, i, t;
    var dx = bx - ax, dy = by - ay;
    var span = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    var rest = Math.max(ROPE.MIN_REST, span * ROPE.SLACK);
    ropeSeg = rest / (n - 1);
    ropeAx = ax; ropeAy = ay; ropeBx = bx; ropeBy = by;
    var amp = 2 / Math.PI * Math.sqrt(span * Math.max(0, rest - span));
    var nx = -dy / span, ny = dx / span;            /* unit perpendicular */
    if (ny < 0) { nx = -nx; ny = -ny; }             /* always bow downward */
    ropePts = [];
    for (i = 0; i < n; i++) {
      t = i / (n - 1);
      var bow = amp * Math.sin(Math.PI * t);
      var x = ax + dx * t + nx * bow, y = ay + dy * t + ny * bow;
      ropePts.push({ x: x, y: y, px: x, py: y });
    }
    if (ropeReduced()) { ropeSettle(); ropeDraw(); }
    else { ropeDraw(); ropeWake(); }
  }
  /* endpoint setters — the ONLY things that wake the loop */
  function ropeSetItemEnd(x, y) {
    if (!ropePts || (x === ropeAx && y === ropeAy)) return;
    ropeAx = x; ropeAy = y; ropeKick();
  }
  function ropeSetTagEnd(x, y) {
    if (!ropePts || (x === ropeBx && y === ropeBy)) return;
    ropeBx = x; ropeBy = y; ropeKick();
  }
  /* reduced motion: no swinging, ever. Run the same constraints to
     convergence in one synchronous pass and draw the settled shape, so the
     string is still correctly slack or taut — it just never sways there. */
  function ropeKick() {
    if (ropeReduced()) { ropeSettle(); ropeDraw(); }
    else ropeWake();
  }

  /* one physics frame. Returns the largest distance any point travelled, so
     the caller can decide whether the chain has come to rest. */
  function ropeStep() {
    var n = ropePts.length, i, k, p, moved = 0;
    for (i = 1; i < n - 1; i++) {          /* verlet integrate the free points */
      p = ropePts[i];
      var vx = (p.x - p.px) * ROPE.DAMPING, vy = (p.y - p.py) * ROPE.DAMPING;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + ROPE.GRAVITY;
    }
    p = ropePts[0]; p.x = p.px = ropeAx; p.y = p.py = ropeAy;      /* pinned */
    p = ropePts[n - 1]; p.x = p.px = ropeBx; p.y = p.py = ropeBy;  /* pinned */
    /* Gauss-Seidel relaxation, ALTERNATING DIRECTION each pass. A one-way
       sweep resolves each link using the already-corrected point behind it,
       so the leftover error is pushed steadily toward the far end: the chain
       coils up against whichever pin the sweep finishes on and takes seconds
       of visible creep to even out. Reversing every other pass sends the
       error back the other way and the slack distributes evenly — the shape
       is symmetric and the chain reaches rest (and therefore sleeps) in a
       fraction of the frames. */
    for (k = 0; k < ROPE.ITER; k++) {
      var back = (k & 1) === 1;
      for (var j = 0; j < n - 1; j++) {
        i = back ? n - 2 - j : j;
        var a = ropePts[i], b = ropePts[i + 1];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        /* half the error each when both ends are free; the whole of it when
           one end is a pin and cannot absorb its share */
        var f = (d - ropeSeg) / d * 0.5;
        var af = i > 0, bf = i + 1 < n - 1;
        if (af && bf) {
          a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
        } else if (af) { a.x += dx * f * 2; a.y += dy * f * 2; }
        else if (bf) { b.x -= dx * f * 2; b.y -= dy * f * 2; }
      }
    }
    /* BENDING RESISTANCE — the thing that makes this an elastic band and not
       a bead chain, and the fix for the last of the "reads taut" cases
       (testing report, 2026-08-09).

       A perfectly limp chain hung between two points that are vertically in
       line has one lowest-energy shape: fold the surplus into a hairpin and
       let it hang straight down as a narrow bight. That is genuinely what a
       bead chain does — and on a tag seated directly above its item it put
       the entire fold inside the artwork, leaving a dead-straight line on
       screen. Correct physics, useless picture, and untrue to the object:
       red elastic cord resists being folded double. It bows.

       Each interior point is nudged toward the midpoint of its neighbours,
       which is a curvature penalty: negligible along a broad sag (the
       neighbours nearly are its midpoint) and strong in a hairpin (where the
       midpoint is far away). So the surplus stops folding and spends itself
       sideways instead, which is both what the real cord does and the shape
       that shows. Applied after the distance constraints and kept small, so
       it shapes the sag without straightening it. */
    for (i = 1; i < n - 1; i++) {
      p = ropePts[i];
      p.x += ((ropePts[i - 1].x + ropePts[i + 1].x) / 2 - p.x) * ROPE.STIFF;
      p.y += ((ropePts[i - 1].y + ropePts[i + 1].y) / 2 - p.y) * ROPE.STIFF;
    }
    for (i = 1; i < n - 1; i++) {
      p = ropePts[i];
      var mx = p.x - p.px, my = p.y - p.py, m = Math.sqrt(mx * mx + my * my);
      if (m > moved) moved = m;
    }
    return moved;
  }
  /* run to rest (reduced motion, and any time a settled shape is wanted
     without animating toward it). Capped so a pathological configuration
     can never spin the main thread. */
  function ropeSettle() {
    for (var i = 0; i < 400; i++) { if (ropeStep() < ROPE.EPS) return; }
  }

  /* one <path> for the whole chain, midpoint-quadratic smoothed so 16 points
     read as string rather than as a surveyor's polyline, plus the grommet
     ring at the tag end. Attributes are written on nodes built once in
     buildTag() — re-parsing innerHTML 60×/second is the one avoidable cost
     here. */
  function ropeDraw() {
    if (!ropePts || !ropePath) return;
    var n = ropePts.length, i;
    var d = 'M ' + r1(ropePts[0].x) + ' ' + r1(ropePts[0].y);
    for (i = 1; i < n - 1; i++) {
      d += ' Q ' + r1(ropePts[i].x) + ' ' + r1(ropePts[i].y) + ' ' +
        r1((ropePts[i].x + ropePts[i + 1].x) / 2) + ' ' +
        r1((ropePts[i].y + ropePts[i + 1].y) / 2);
    }
    d += ' L ' + r1(ropePts[n - 1].x) + ' ' + r1(ropePts[n - 1].y);
    ropePath.setAttribute('d', d);
    ropeGrom.setAttribute('cx', r1(ropeBx));
    ropeGrom.setAttribute('cy', r1(ropeBy));
  }

  function ropeTick() {
    ropeRAF = 0;
    if (!ropePts) return;
    var moved = ropeStep();
    ropeDraw();
    if (moved > ROPE.EPS) ropeWake();     /* still swinging → another frame */
  }
  function ropeWake() {
    if (!ropeRAF && ropePts && !ropeReduced()) {
      ropeRAF = requestAnimationFrame(ropeTick);
    }
  }
  function ropeStop() {
    if (ropeRAF) cancelAnimationFrame(ropeRAF);
    ropeRAF = 0; ropePts = null;
    ropeOffX = 0; ropeOffY = 0;
  }

  /* ---- dragging the tag itself (owner request, 2026-08-09) ---------------
     The tag is furniture now: press anywhere on the manila and it moves,
     clamped to the well with the same 8px margin pick() seats against, with
     the grommet endpoint feeding the rope every frame. Two guards make it
     coexist with what is already on the tag:
       · the two <a class="btn"> links are exempt — a press that starts on one
         never becomes a drag, so DOWNLOAD SVG and REPORT CARD still click;
       · a ~4px slop before the press counts as a drag, so an imprecise tap on
         the manila doesn't shift the tag a pixel under the finger.
     Pointer capture keeps the drag alive off the tag's edge; the document
     dismissal handler already ignores presses inside .jd-itemtag. */
  var TAG_SLOP = 4;
  var tdrag = null;
  function wireTagDrag() {
    tag.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.btn')) return;
      tdrag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, on: false,
                l0: parseFloat(tag.style.left) || 0,
                t0: parseFloat(tag.style.top) || 0 };
      try { tag.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();          /* no text selection dragging the manila */
    });
    tag.addEventListener('pointermove', function (e) {
      if (!tdrag || e.pointerId !== tdrag.id) return;
      var dx = e.clientX - tdrag.sx, dy = e.clientY - tdrag.sy;
      if (!tdrag.on) {
        if (dx * dx + dy * dy < TAG_SLOP * TAG_SLOP) return;
        tdrag.on = true;
        tag.classList.add('is-dragging');
      }
      var w = well.getBoundingClientRect();
      var l = Math.max(8, Math.min(w.width - tag.offsetWidth - 8, tdrag.l0 + dx));
      var t = Math.max(8, Math.min(w.height - ropeTagH - 8, tdrag.t0 + dy));
      tag.style.left = l + 'px';
      tag.style.top = t + 'px';
      ropeSetTagEnd(l + 10, t + ropeTagH / 2);
    });
    function endTagDrag(e) {
      if (!tdrag || e.pointerId !== tdrag.id) return;
      var moved = tdrag.on;
      tag.classList.remove('is-dragging');
      tdrag = null;
      /* the tag has landed somewhere new, so the string pulls on the object
         from a new direction — re-read which edge it grips */
      if (moved && picked) ropeReanchor(picked);
    }
    tag.addEventListener('pointerup', endTagDrag);
    tag.addEventListener('pointercancel', endTagDrag);
  }

  function buildTag() {
    tag = document.createElement('div');
    tag.className = 'jd-itemtag';
    tag.setAttribute('role', 'group');
    rope = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    rope.setAttribute('class', 'jd-rope');
    /* built once, then only ever given new attribute values — see ropeDraw */
    rope.innerHTML =
      '<path fill="none" stroke="#b3402f" stroke-width="2" stroke-linecap="round"/>' +
      '<circle r="4.5" fill="none" stroke="#b3402f" stroke-width="2"/>';
    ropePath = rope.querySelector('path');
    ropeGrom = rope.querySelector('circle');
    well.appendChild(rope);
    well.appendChild(tag);
    wireTagDrag();
  }

  function returnToPile(item) {
    if (item.parentNode === well && pileEl) {
      pileEl.appendChild(item);
      item.style.zIndex = ++zTop;
    }
  }
  function hideTag() {
    if (tag) {
      tag.classList.remove('is-on');
      tag.classList.remove('is-dragging');
      rope.classList.remove('is-on');
    }
    tdrag = null;
    if (ropeArm) { clearTimeout(ropeArm); ropeArm = 0; }
    ropeStop();          /* the chain stops simulating the moment it's gone */
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
    if (picked && picked !== item) {
      picked.classList.remove('is-picked');
      returnToPile(picked);
    }
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
      /* name on its own line(s) — the tag has a fixed width, so a long
         specimen name wraps to a second line instead of stretching the tag
         past the well's edge; model · date · size sit under it. SIZE is
         per-ITEM (the tier the owner picked), not per-response, so it belongs
         on this identifying line rather than in the grade column below. */
      '<div class="l1"><span class="name">' + (d.title || '').toUpperCase() +
      '</span><span class="meta">' + (d.model || '').toUpperCase() +
      '<span class="sep">·</span><span class="dim">' + (d.date || '') + '</span>' +
      (d.size
        ? '<span class="szwrap"><span class="sep">·</span>' +
          '<span class="dim">SIZE: <span class="sz">' + d.size.toUpperCase() +
          '</span></span></span>'
        : '') +
      '</span></div>' +
      '<div class="l2"><span class="gradecol">' +
      '<span class="gradelabel">GRADE: <span class="g">' + (d.grade || '').toUpperCase() + '</span></span>' +
      meterSVG(+d.rank || 1, +d.steps || 5) +
      '</span><span class="btns">' +
      '<a class="btn" href="' + d.url + '" download="' + d.id + '.svg" ' +
      'title="download the SVG as generated">DOWNLOAD<br>SVG ⤓</a>' +
      '<a class="btn jd-fullrecord" href="#' + d.id + '" title="open the report card">REPORT<br>CARD →</a>' +
      '</span></div>';
    var fr = tag.querySelector('.jd-fullrecord');
    fr.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.JD_record) window.JD_record.open(d.id);
    });

    /* seat the tag just below the item, grommet toward it, clamped to the
       well; if there's no room below, it hangs above instead. The wrapper
       div's rect knows nothing of the inner svg's scale (and the picked zoom
       is still transitioning at this point anyway), so the enlarged extent is
       PREDICTED: --pick-scale × the layout height, seated against that —
       otherwise the zoomed artwork lands on top of its own tag.
       This used to also rotate the layout box by --rot × 0.94 to find the
       swept height. It no longer has to: a picked specimen stands UPRIGHT
       (see .jd-item.is-picked svg), so the displayed angle is 0 and the
       layout box IS the extent. One fewer approximation, one less seat
       error — the old projection over-estimated the height of any rotated
       item and pushed its tag further down the well than it needed to go. */
    var w = well.getBoundingClientRect(), r = item.getBoundingClientRect();
    var zoom = parseFloat(getComputedStyle(item)
      .getPropertyValue('--pick-scale')) || 1;
    var vh = zoom * r.height;
    var cx = r.left + r.width / 2 - w.left, cy = r.top + r.height / 2 - w.top;
    var vTop = cy - vh / 2, vBottom = cy + vh / 2;
    var ay = vBottom - 6;                        /* foot of the predicted extent */
    tag.classList.add('is-on');                  /* measurable before placing */
    var tw = tag.offsetWidth, th = tag.offsetHeight;
    var below = ay + 26 + th < w.height - 8;
    var ty = below ? ay + 26 : (vTop - 20 - th);
    function clampX(v) { return Math.max(8, Math.min(w.width - tw - 8, v)); }
    var tx;
    if (below) {
      tx = clampX(cx + 4);
    } else {
      /* SEATED ABOVE — LEAN IT TO ONE SIDE (testing report, 2026-08-09).
         A tag hung straight above its item puts both ends of the elastic on
         one vertical line, and a slack cord between two such points has
         nowhere to put its surplus except a fold hanging straight down —
         i.e. straight into the artwork, where none of it can be seen. The
         string then reads bone-taut however much slack it actually has.
         Leaning the tag sideways by a good fraction of the drop gives the
         sag somewhere to be, and the elastic hangs in an arc the way it
         already does in the (far commoner) seated-below case.
         HOW FAR: the belly of the sag hangs around the midpoint of the two
         ends, so the lean has to be wide enough to swing that midpoint clear
         of the artwork — a lean of half the item's width just parks the
         belly back on top of it. Hence the item's own ZOOMED width (plus a
         margin) as the floor, alongside a fraction of the drop.
         Lean LEFT by preference: the grommet is on the tag's left edge, so
         leaning left slides the body back over ground the tag already
         covered and can't push it off the right wall. If the well runs out
         that way — item hard against the left edge — lean right instead;
         whichever survives clamping with more offset wins. */
      var lean = Math.max(110, 0.62 * (cy - (ty + th / 2)), zoom * r.width + 40);
      var lx = clampX(cx - lean - 10), rx = clampX(cx + lean - 10);
      tx = Math.abs(lx + 10 - cx) >= Math.abs(rx + 10 - cx) ? lx : rx;
    }
    tag.style.left = tx + 'px';
    tag.style.top = ty + 'px';

    /* string the elastic: the item's NEAR EDGE -> the grommet at the tag's
       left edge. The predicted extent above still decides where the tag is
       SEATED (so the zoomed artwork never lands on its own tag); it has no
       say in where the rope starts, because that is read off the silhouette
       itself — see ropeAnchor. Rest length is frozen here — see ROPE. */
    ropeTagH = th;
    var gx = tx + 10, gy = ty + th / 2;
    ropeAnchor(item, cx, cy, gx, gy);
    rope.setAttribute('class', 'jd-rope is-on');
    ropePin(cx + ropeOffX, cy + ropeOffY, gx, gy);
    ropeConfirmAnchor(item);
  }

  /* dismissal: any press that isn't the item or the tag — wood, page,
     notes, anywhere — plus Escape and resize (positions go stale). Note what
     is NOT on this list any more: dragging the picked item. The elastic
     stretches and follows now (2026-08-09), so a drag is inspection, not
     dismissal — only a press on something else lets go. */
  /* every dismissal path stands down while the report card is open — the
     record owns Esc/scrim then, and the selection must survive its close */
  document.addEventListener('pointerdown', function (e) {
    if (window.JD_record && window.JD_record.isOpen()) return;
    if (!e.target.closest || !e.target.closest('.jd-item, .jd-itemtag')) hideTag();
  });
  window.addEventListener('keydown', function (e) {
    if (window.JD_record && window.JD_record.isOpen()) return;
    if (e.key === 'Escape') hideTag();
  });
  window.addEventListener('resize', function () {
    if (window.JD_record && window.JD_record.isOpen()) return;
    hideTag();
  });
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
    /* the clamped x,y IS the item's live centre in well coords — exactly the
       rope's item endpoint, handed over for free. Measuring the element per
       frame instead would force a layout on a filtered, compositor-promoted
       node mid-drag, which is the whole reason this path is transform-only. */
    if (item === picked) ropeSetItemEnd(x + ropeOffX, y + ropeOffY);
  }
  function settle(item, moved) {
    item.classList.remove('is-held');
    if (pendingReturn === item) { returnToPile(item); pendingReturn = null; }
    /* the picked item keeps its place in the z-sandwich (tag 70 < rope 71 <
       item 72) instead of riding the zTop counter — it is still selected and
       the elastic must still pass under it */
    item.style.zIndex = item === picked ? 72 : ++zTop;
    if (moved) {                                 /* bake position, then rest */
      var w = well.getBoundingClientRect();
      item.style.left = (dropX / w.width * 100).toFixed(2) + '%';
      item.style.top = (dropY / w.height * 100).toFixed(2) + '%';
      /* the landing jostle — skipped for a picked item for the same reason
         rotation input is (see spin): it stands upright, so the nudge would
         not be seen now and would only show up as an unexplained kick when
         the tag is dismissed */
      if (item !== picked) {
        var rot = parseFloat(getComputedStyle(item).getPropertyValue('--rot')) || 0;
        rot += (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random());  /* impulse */
        item.style.setProperty('--rot', rot.toFixed(1) + 'deg');
      }
    }
    item.style.removeProperty('--dx');
    item.style.removeProperty('--dy');
    /* one authoritative pass once the position is baked into left/top: the %
       round-trip moves the centre by a fraction of a pixel, and the drop has
       changed which way the string pulls, so the near edge it should be
       gripping has moved too. Both are settled here in one go — a handful of
       hit tests on a stationary item, never per frame. */
    ropeReanchor(item);
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
        /* the elastic used to let go here; it holds on now (2026-08-09) —
           place() feeds the rope the same clamped centre it clamps to */
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
  /* ROTATION IS INHIBITED WHILE PICKED (owner request, 2026-08-09). A picked
     specimen displays upright at 0deg, so every rotation gesture would mutate
     a --rot nothing is currently drawing — invisible until dismissal, at
     which point the item would drop back to the pile at an angle the owner
     never saw it take. Silently banking the change was the alternative and it
     is worse: a gesture with no feedback and a delayed surprise. So the input
     is simply refused while the item is picked; dismiss it and the pile
     gesture works exactly as before. The events are still consumed by the
     handlers below (preventDefault stays), because a wheel or pinch over a
     held item must never scroll or zoom the page out from under it. */
  function rotOf(item) { return parseFloat(getComputedStyle(item).getPropertyValue('--rot')) || 0; }
  function spin(item, d) {
    if (item === picked) return;
    item.style.setProperty('--rot', (rotOf(item) + d).toFixed(1) + 'deg');
  }

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
    if (held === picked) return;              /* upright while picked */
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
    /* the second finger is still SWALLOWED while picked (the twist object
       exists, so it can't grab a neighbour or dismiss the tag) — it just
       doesn't turn an upright specimen */
    if (held === picked) return;
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

/* ---- THE FULL RECORD — the report card (Phase 3, promoted from mockup-7a).
   Self-contained module: the pile loader hands it the data.php payload and
   the already-fetched primary SVG texts via JD_record.setData(); the item
   tag's REPORT CARD button calls JD_record.open(id). The card is built
   entirely from the payload (taxonomy-driven — unknown axes render, nothing
   hardcoded), alternatives' SVGs are fetched lazily on first open, opening
   sets #<id> via pushState (deep links; popstate closes — Android back
   closes the card, not the site), and an item_open event is tracked.
   Inlined SVG copies are id-prefixed (plate jrN_, thumbs jtN_) so they can
   never collide with the pile's inlined primaries or each other. */
(function () {
  var payload = null, svgCache = {};
  var scrim = null, cardEl = null, scrollEl = null;
  var curEntry = null, curResp = 0, isOpen = false, pushed = false;
  var markSeq = 0;
  var JITTER = [-1.7, 1.3, -0.8, 2.0, -1.4, 0.9, -2.1, 1.6];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function byId(list, id) {
    list = list || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    return String(parseInt(p[2], 10)) + ' ' +
      (MONTHS[parseInt(p[1], 10) - 1] || p[1]) + ' ' + p[0];
  }
  /* PROCESS, plainly stated, from the honest turn count */
  function processLabel(gen) {
    if (!gen) return '—';
    if (gen.mode === 'refined') {
      var n = gen.prompt_count || 2;
      return 'refined (' + n + ' prompt' + (n === 1 ? '' : 's') + ')';
    }
    return 'one-shot (1 prompt)';
  }
  /* prefix every id and url(#)/href reference so inlined copies never
     collide (same discipline as the rating instrument). One implementation,
     shared with the pile — see JD_svgInst at the top of this file. */
  var svgInst = window.JD_svgInst;
  /* the filed size, rendered the same way here as on the specimen tag */
  var sizeLabel = window.JD_sizeLabel;
  /* a red-pencil hand mark; each takes its own rotation jitter + waver
     filter so no two sit identically */
  function mark(word) {
    markSeq++;
    var jit = JITTER[markSeq % JITTER.length];
    return '<span class="rc-mark sm" style="--jit:' + jit +
      'deg; filter:url(#jdRcWv' + (markSeq % 4) + ')">' +
      '<span class="rc-mark-word">' + esc(word) + '</span></span>';
  }
  /* an annotation is a bare rank number or { value: <rank>, note } */
  function annOf(resp, axisId) {
    var a = (resp.annotations || {})[axisId];
    if (a == null) return null;
    return typeof a === 'object' ? a : { value: a };
  }
  function fillHTML(label, value) {
    return '<div class="rc-fill">' +
      '<span class="rc-fill-l">' + esc(label) + '</span>' +
      '<span class="rc-fill-v">' + value + '</span></div>';
  }

  /* the vaporwave floor: black-and-white checkerboard projected toward a
     center vanishing point; far rows dissolve into the navy horizon */
  function floorSVG() {
    var W = 600, H = 240, VPX = W / 2, HOR = 96;
    var ROWS = 9, R = 0.7, CW = 104;
    var ts = [1];
    for (var i = 1; i <= ROWS; i++) ts.push(ts[i - 1] * R);
    function px(j, t) { return (VPX + j * CW * t).toFixed(1); }
    function py(t) { return (HOR + t * (H - HOR)).toFixed(1); }
    var cells = '';
    for (var r = 0; r < ROWS; r++) {
      for (var j = -8; j < 8; j++) {
        if (((r + j) % 2 + 2) % 2 === 0) continue;
        var t0 = ts[r], t1 = ts[r + 1];
        cells += '<polygon points="' +
          px(j, t0) + ',' + py(t0) + ' ' + px(j + 1, t0) + ',' + py(t0) + ' ' +
          px(j + 1, t1) + ',' + py(t1) + ' ' + px(j, t1) + ',' + py(t1) +
          '" fill="#e2ded2"/>';
      }
    }
    return '<svg class="rc-floor" viewBox="0 0 ' + W + ' ' + H + '" ' +
      'preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
      '<defs>' +
      '<linearGradient id="jdRcSky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#0a0e24"/>' +
      '<stop offset="0.8" stop-color="#141b44"/>' +
      '<stop offset="1" stop-color="#1c2456"/>' +
      '</linearGradient>' +
      '<linearGradient id="jdRcFade" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#1c2456"/>' +
      '<stop offset="0.55" stop-color="#151b40" stop-opacity="0.55"/>' +
      '<stop offset="1" stop-color="#101010" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<rect x="0" y="0" width="' + W + '" height="' + HOR + '" fill="url(#jdRcSky)"/>' +
      cells +
      '<rect x="0" y="' + HOR + '" width="' + W + '" height="72" fill="url(#jdRcFade)"/>' +
      '</svg>';
  }

  /* grades are filed as the taxonomy rank number — see JD_gradeOf above */
  function gradeOf(value) {
    return window.JD_gradeOf(payload.taxonomy, value) ||
      { label: value == null ? '' : String(value), rank: +value || 0 };
  }
  function modelOf(id) {
    return byId((payload.taxonomy || {}).models, id) || { label: id || '', vendor: '' };
  }

  function subjectsHTML(resp) {
    var rows = '';
    ((payload.taxonomy || {}).axes || []).forEach(function (axis) {
      /* defunct axes never appear on the report card (owner, 2026-07-29);
         their filed gradings live on in the data and the legend still
         lists them dimmed for the record */
      if (axis.defunct) return;
      var a = annOf(resp, axis.id);
      var cell;
      if (!a) {
        cell = '<span class="rc-skip">— · not assessed</span>';
      } else {
        var v = window.JD_byRank(axis.values, a.value);
        cell = mark(v ? v.label : String(a.value));
      }
      rows += '<tr><td><span class="rc-subj-name">' + esc(axis.label || axis.id) +
        '</span></td><td>' + cell + '</td></tr>';
    });
    var g = gradeOf(resp.grade);
    return '<table class="rc-subj"><thead><tr>' +
      '<th style="width:52%">Axis</th><th style="width:48%">Verdict</th>' +
      '</tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td><span class="rc-avg-l">Overall grade</span></td>' +
      '<td>' + mark(g.label) + '</td></tr></tfoot></table>';
  }

  function altsHTML(entry, curIdx) {
    if (!entry.responses || entry.responses.length < 2) return '';
    var h = '<div class="rc-alts">';
    entry.responses.forEach(function (r, i) {
      var m = modelOf(r.model), g = gradeOf(r.grade);
      h += '<button type="button" class="rc-alt' + (i === curIdx ? ' is-cur' : '') +
        '" data-resp="' + i + '">' +
        '<span class="rc-alt-art">' +
        svgInst(svgCache[entry.id + '/' + r.file] || '', 'jt' + i + '_') +
        '</span>' +
        '<span class="rc-alt-cap">' + esc(m.label) +
        '<span class="rc-alt-grade">' + esc(g.label) + '</span>' +
        '</span></button>';
    });
    return h + '</div>';
  }

  function cardHTML(entry, resp, curIdx) {
    var m = modelOf(resp.model);
    var h = '';
    h += '<header class="rc-block rc-masthead">' +
      '<div class="rc-item">' + esc(entry.title) + '</div></header>';
    /* Model/Prompted/Process describe the RESPONSE; Size describes the ITEM
       (one tier per entry, shared by every response), so it holds steady as
       the alternatives are stepped through. */
    h += '<div class="rc-block rc-fillsline">' +
      fillHTML('Model', esc(m.label)) +
      fillHTML('Prompted', esc(fmtDate(resp.date))) +
      fillHTML('Process', esc(processLabel(resp.generation))) +
      fillHTML('Size', esc(sizeLabel(payload.taxonomy, entry) || '—')) +
      '</div>';
    h += '<div class="rc-block rc-plate">' + floorSVG() +
      '<div class="rc-plate-art">' +
      svgInst(svgCache[entry.id + '/' + resp.file] || '', 'jr' + curIdx + '_') +
      '</div></div>';
    h += '<div class="rc-block rc-head">The prompt</div>' +
      '<div class="rc-block rc-assign"><p>“' + esc(entry.prompt) + '”</p></div>';
    h += '<div class="rc-block rc-head">Annotations</div>' +
      '<div class="rc-block">' + subjectsHTML(resp) + '</div>';
    var alts = altsHTML(entry, curIdx);
    if (alts) {
      h += '<div class="rc-block rc-head">Other models, same prompt</div>' +
        '<div class="rc-block">' + alts + '</div>';
    }
    h += '<div class="rc-block rc-prov"><div class="rc-formline">' +
      '<span><a class="rc-dl" href="' + esc(resp.url) + '" download="' +
      esc(entry.id) + '.svg" title="download the SVG as generated">' +
      'Download SVG ⤓</a></span>' +
      '<span class="rc-formno">No. ' + esc(entry.id) + '</span>' +
      '</div></div>';
    return h;
  }

  /* red-pencil waver filters, injected once (stitchTiles="stitch") */
  function injectDefs() {
    if (document.getElementById('jdRcWv0')) return;
    var host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    var f = '';
    [[0.052, 0.14, 3, 1.5], [0.061, 0.12, 11, 1.3],
     [0.047, 0.16, 19, 1.6], [0.058, 0.13, 29, 1.4]].forEach(function (p, i) {
      f += '<filter id="jdRcWv' + i + '" x="-8%" y="-18%" width="116%" height="136%" ' +
        'color-interpolation-filters="sRGB">' +
        '<feTurbulence type="fractalNoise" baseFrequency="' + p[0] + ' ' + p[1] +
        '" numOctaves="2" seed="' + p[2] + '" stitchTiles="stitch" result="t"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="t" scale="' + p[3] +
        '" xChannelSelector="R" yChannelSelector="G"/></filter>';
    });
    host.innerHTML = '<svg width="0" height="0" focusable="false"><defs>' + f + '</defs></svg>';
    document.body.appendChild(host);
  }

  function track(type, label) {
    try {
      fetch('../../api/page-event-tracking.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 'junk-drawer', event_type: type, label: label || null })
      }).catch(function () {});
    } catch (e) {}
  }

  /* fetch any response SVGs not yet cached (primaries arrive from the pile
     loader; alternatives load lazily on first open) */
  function ensureSVGs(entry) {
    return Promise.all(entry.responses.map(function (r) {
      var key = entry.id + '/' + r.file;
      if (svgCache[key]) return null;
      return fetch(r.url).then(function (res) {
        if (!res.ok) throw new Error(r.url + ' ' + res.status);
        return res.text();
      }).then(function (t) { svgCache[key] = t; })
        .catch(function () { svgCache[key] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>'; });
    }));
  }

  function build() {
    if (scrim) return;
    scrim = document.createElement('div');
    scrim.className = 'jd-record-scrim';
    scrim.innerHTML = '<div class="jd-record" role="dialog" aria-modal="true" ' +
      'aria-label="report card">' +
      '<button type="button" class="jd-record-close" aria-label="close">✕</button>' +
      '<div class="rc-scroll"></div></div>';
    document.body.appendChild(scrim);
    cardEl = scrim.querySelector('.jd-record');
    scrollEl = scrim.querySelector('.rc-scroll');
    scrim.addEventListener('pointerdown', function (e) {
      if (e.target === scrim) close();
    });
    scrim.querySelector('.jd-record-close').addEventListener('click', close);
    scrollEl.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.rc-alt') : null;
      if (!b) return;
      var i = parseInt(b.getAttribute('data-resp'), 10);
      if (isNaN(i) || i === curResp) return;
      curResp = i;
      render(false);
    });
  }

  function render(animate) {
    markSeq = 0;
    var resp = curEntry.responses[curResp] || curEntry.responses[0];
    scrollEl.innerHTML = cardHTML(curEntry, resp, curResp);
    if (animate) {
      cardEl.classList.remove('is-enter');
      void cardEl.offsetWidth;
      cardEl.classList.add('is-enter');
    }
  }

  function open(id, viaHistory) {
    if (!payload || isOpen) return;
    var entry = byId(payload.items, id);
    if (!entry) return;
    curEntry = entry;
    curResp = 0;
    for (var i = 0; i < entry.responses.length; i++) {
      if (entry.responses[i].rid === entry.primary) curResp = i;
    }
    injectDefs();
    build();
    isOpen = true;
    scrim.classList.add('is-on');
    document.documentElement.classList.add('jd-record-open');
    /* render immediately with what's cached (the primary always is); the
       strip thumbnails fill in when the lazy fetches land */
    render(true);
    ensureSVGs(entry).then(function () { if (isOpen) render(false); });
    if (!viaHistory) {
      try { history.pushState({ jdRecord: id }, '', '#' + id); pushed = true; }
      catch (e) { pushed = false; }
    } else { pushed = false; }
    track('item_open', id);
  }

  function teardown() {
    if (!isOpen) return;
    isOpen = false;
    if (scrim) scrim.classList.remove('is-on');
    document.documentElement.classList.remove('jd-record-open');
  }

  /* UI close goes through history when we pushed (Android back symmetry);
     popstate performs the actual teardown */
  function close() {
    if (!isOpen) return;
    if (pushed) { history.back(); }
    else {
      teardown();
      try { history.replaceState(null, '', location.pathname + location.search); }
      catch (e) {}
    }
  }

  window.addEventListener('popstate', function () {
    var h = decodeURIComponent(location.hash.slice(1));
    if (isOpen && (!h || !curEntry || h !== curEntry.id)) { teardown(); }
    else if (!isOpen && h && payload && byId(payload.items, h)) { open(h, true); }
  });
  window.addEventListener('keydown', function (e) {
    if (isOpen && e.key === 'Escape') close();
  });

  window.JD_record = {
    setData: function (data, primaries) {
      payload = data;
      var k;
      for (k in (primaries || {})) svgCache[k] = primaries[k];
    },
    open: open,
    close: close,
    isOpen: function () { return isOpen; },
    openFromHash: function () {
      var h = decodeURIComponent(location.hash.slice(1));
      if (h && payload && byId(payload.items, h)) open(h, true);
    }
  };
})();
