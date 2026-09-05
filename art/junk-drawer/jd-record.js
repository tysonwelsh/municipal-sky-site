/* ============================================================================
   THE JUNK DRAWER — jd-record.js
   The report card. Loaded after jd-core.js (JD_esc, JD_byId, JD_zoomLayer,
   JD_drawOn, JD_fitAll, JD_svgInst, JD_barHTML's home). See jd-core.js for
   the file map.
   ========================================================================== */

/* ---- THE FULL RECORD — the report card (Phase 3, promoted from mockup-7a).
   Self-contained module: the pile loader hands it the data.php payload and
   the already-fetched primary SVG texts via JD_record.setData(); the item
   tag's REPORT CARD button calls JD_record.open(id). The card is built
   entirely from the payload (taxonomy-driven — unknown axes render, nothing
   hardcoded), alternatives' SVGs are fetched lazily on first open, opening
   sets #<id> via pushState (deep links; popstate closes — Android back
   closes the card, not the site), and an item_open event is tracked.
   Inlined SVG copies are id-prefixed (plate jrN_, thumbs jtN_, enlargement
   jzN_) so they can never collide with the pile's inlined primaries or each
   other. Pressing the artwork plate ENLARGES it over the card; that layer is
   a second dismissable thing inside one dialog, so Escape peels the
   enlargement before the card (see the keydown handler at the foot). */
(function () {
  var payload = null, svgCache = {};
  var scrim = null, cardEl = null, scrollEl = null;
  var curEntry = null, curResp = 0, isOpen = false, pushed = false;
  /* (the alternatives strip's window index retired 2026-08-15 — the strip
     is a scroll port now and its position IS its scrollLeft. See altsHTML.) */
  /* THE ARTWORK'S KEY for the shared display frame (see fitView). One string
     per DRAWING, so the plate, the strip thumbnail, the enlargement and — for
     a won item — the bench and the pile all reframe identically instead of
     each measuring its own copy in its own box. A visitor response carries
     its generation id and is keyed on that, because its filename is scoped to
     whichever response won the turn; a curated one is keyed on its path. */
  function fitKey(entry, resp) {
    return resp.gen_id ? 'gen:' + resp.gen_id : entry.id + '/' + resp.file;
  }
  /* THE ENLARGEMENT (owner, 2026-08-09): the artwork plate is small — it has
     to be, the card is a form and the art is one field on it — so pressing
     the plate lifts the same artwork onto a full-viewport layer where it can
     actually be read. State lives here rather than in the DOM because Esc
     has to know which layer it is peeling: enlargement first, card second. */
  var zoom = JD_zoomLayer();
  var markSeq = 0;
  var JITTER = [-1.7, 1.3, -0.8, 2.0, -1.4, 0.9, -2.1, 1.6];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  var esc = JD_esc, byId = JD_byId;
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
  /* (the filed size tier shows nowhere in the UI any more — the specimen
     tag dropped it 2026-08-12, the report card 2026-08-13; the data keeps
     it, and window.JD_sizeLabel still serves the loader/legend) */
  /* a hand-pencilled mark; each takes its own rotation jitter + waver
     filter so no two sit identically. `cls` picks the pencil (the
     rating-colour classes rc-r1..3, rc-q1..4 and rc-g1..5 in the
     stylesheet — owner request, 2026-08-11); no class = the original red. Labels'
     _emphasis_ pairs render in italics here (escape first, so nothing
     can smuggle markup). */
  function mark(word, cls) {
    markSeq++;
    var jit = JITTER[markSeq % JITTER.length];
    return '<span class="rc-mark sm' + (cls ? ' ' + cls : '') +
      '" style="--jit:' + jit +
      'deg; filter:url(#jdRcWv' + (markSeq % 4) + ')">' +
      '<span class="rc-mark-word">' +
      esc(word).replace(/_([^_]+)_/g, '<i>$1</i>') + '</span></span>';
  }
  /* the verdict gauge (owner pick, mockup 11 option C, 2026-08-11 —
     replacing the dot sparkline): ONE segmented bar per verdict, every
     row the same fixed span, filled to rank/steps of ITS OWN scale.
     The step dividers are paper-coloured and drawn OVER the fill (owner
     rev, 2026-08-11), battery-style — so a 100% bar still reads as its
     segments, and a 3-step axis and the 5-tier grade stay honestly
     distinguishable. aria-hidden; the word carries the meaning. */
  function barHTML(rank, total, cls) {
    var full = Math.max(1, Math.min(total, rank));
    var h = '<span class="rc-bar ' + cls + '" aria-hidden="true">' +
      '<span class="rc-bar-fill" style="width:' +
      (100 * full / total).toFixed(1) + '%"></span>';
    for (var t = 1; t < total; t++) {
      h += '<span class="rc-bar-tick" style="left:' +
        (100 * t / total).toFixed(1) + '%"></span>';
    }
    return h + '</span>';
  }
  window.JD_barHTML = barHTML;  /* the bench (r4, owner directive) reuses this
    gauge verbatim once a value is picked, instead of inventing a second one —
    a filled-in bench and the report card it produces are meant to speak the
    same visual language */
  /* an annotation is a bare rank number or { value: <rank>, note } */
  function annOf(resp, axisId) {
    var a = (resp.annotations || {})[axisId];
    if (a == null) return null;
    return typeof a === 'object' ? a : { value: a };
  }

  /* RETIRED — kept as a backup on the same terms as checkerFloorSVG below
     (round 13, owner pick 2026-08-13: the display container went paper —
     mockup-13b's graph-grid photo swatch, all CSS on .rc-plate — so the
     dark stage left the card and the enlargement together, and the
     shape-tuned rc-art-square envelope went with it; the photograph frames
     every aspect the same). This was the vaporwave floor, mk II (owner,
     2026-08-12): TWIN perspective grids — a floor below the artwork and a
     ceiling above it — teal-blue wireframe lines all converging on one
     central vanishing point; both grids dissolve into a hazy glow band at
     the shared horizon. The viewBox is square to match the retired square
     plate; the enlargement cropped it center-out (slice). `pfx` namespaces
     the gradient ids so the plate and enlargement copies never fought over
     one id. Not called anywhere; to restore it, re-point cardHTML/zoomHTML
     at it and give .rc-plate back a dark ground. */
  function floorSVG(pfx) {  /* eslint-disable-line no-unused-vars */
    pfx = pfx || '';
    var W = 600, H = 600, VPX = W / 2, HOR = H / 2;
    /* true one-point perspective: equally spaced ground lines at depth n sit
       at y = HOR ± DEPTH/n — wide apart underfoot, compressing hard at the
       horizon. GAP holds an empty band at the horizon so the two grids never
       actually meet; each grid also fades out through a luminance-mask
       gradient before it gets there. */
    /* SQUARE TILES (owner, 2026-08-13): rows recede GEOMETRICALLY, not
       harmonically. With geometric spacing the on-screen cell aspect is
       CONSTANT at every depth — cell width at a row is S·dy/DEPTH, cell
       height is dy·(1−R), so R = 1 − S/DEPTH makes width equal height:
       every tile reads as a square, all the way down. (The earlier
       harmonic series was "truer" optics but its cell aspect varies —
       squares mid-field flattened into wide letterbox slats near the
       horizon, which is what the owner was seeing.) Rows run until finer
       than roughly half the GAP, dissolving INTO the glow.
       COLS runs far past the frame: an outermost ray at ±COLS·S exits
       through the side edge at y ≈ HOR + DEPTH²/(COLS·S), so 44 columns
       carry the fan to within ~1px of the gap and the surface never
       visibly stops generating at the sides (26 left dead wedges there —
       owner report). Rays and rows are kept in separate strings because
       the rays draw a step thicker (at equal width the converging lines
       read thinner than the crossing ones they meet). */
    /* S is the density dial (owner: "widen the space between the lines" —
       88 → 112). ROWK flattens the tiles: cell depth = ROWK × cell width
       on screen (owner, 2026-08-13 — screen-SQUARE cells read as stretched
       away toward the horizon; real square floor tiles foreshorten flatter
       than that at a glancing view, so 0.62 is what "square tiles" actually
       look like). R follows both so the proportion holds at every depth.
       GAP doubled 22 → 44 on the same date's owner call — the old band
       felt claustrophobic — and COLS is sized to keep the outermost ray
       entering inside the (now wider) gap. */
    var DEPTH = H - HOR, GAP = 44, COLS = 20, S = 112, ROWK = 0.62,
      R = 1 - ROWK * S / DEPTH;
    function ln(x1, y1, x2, y2) {
      return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
        '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
    }
    var rowsF = '', rowsC = '', raysF = '', raysC = '';
    for (var dy = DEPTH * R; dy > GAP * 0.55; dy *= R) {
      rowsF += ln(0, HOR + dy, W, HOR + dy);
      rowsC += ln(0, HOR - dy, W, HOR - dy);
    }
    for (var j = -COLS; j <= COLS; j++) {
      var xN = VPX + j * S;             /* the ray at the near (screen) edge */
      var xF = VPX + j * S * (GAP / DEPTH);   /* …stopped at the gap's edge */
      raysF += ln(xN, H, xF, HOR + GAP);
      raysC += ln(xN, 0, xF, HOR - GAP);
    }
    function mask(id, y0, y1) {
      /* white = keep, black = drop: full strength at the near edge, dying
         away inside the glow (critic round 1: near/far contrast, and let the
         finest lines fade into the light rather than before it) */
      return '<linearGradient id="' + id + 'g" x1="0" y1="' + y0 +
        '" x2="0" y2="' + y1 + '" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0" stop-color="#fff"/>' +
        '<stop offset="0.5" stop-color="#c4c4c4"/>' +
        '<stop offset="0.82" stop-color="#737373"/>' +
        '<stop offset="1" stop-color="#000"/>' +
        '</linearGradient>' +
        '<mask id="' + id + '"><rect x="0" y="0" width="' + W + '" height="' +
        H + '" fill="url(#' + id + 'g)"/></mask>';
    }
    return '<svg class="rc-floor" viewBox="0 0 ' + W + ' ' + H + '" ' +
      'preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs>' +
      '<linearGradient id="' + pfx + 'jdRcBg" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#0a0e24"/>' +
      '<stop offset="0.5" stop-color="#152451"/>' +
      '<stop offset="1" stop-color="#0a0e24"/>' +
      '</linearGradient>' +
      /* the horizon's own light: a thin bright core over a soft wide swell —
         a luminous horizon line, not a fog bank (critic round 1) */
      '<linearGradient id="' + pfx + 'jdRcGlow" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#2fd0c9" stop-opacity="0"/>' +
      '<stop offset="0.42" stop-color="#37d8cf" stop-opacity="0.07"/>' +
      '<stop offset="0.5" stop-color="#54e8dd" stop-opacity="0.32"/>' +
      '<stop offset="0.58" stop-color="#37d8cf" stop-opacity="0.07"/>' +
      '<stop offset="1" stop-color="#2fd0c9" stop-opacity="0"/>' +
      '</linearGradient>' +
      /* corner vignette so the brightest strokes don't hit the frame at full
         strength; keeps the eye on the artwork */
      '<radialGradient id="' + pfx + 'jdRcVig" cx="0.5" cy="0.5" r="0.72">' +
      '<stop offset="0" stop-color="#060a18" stop-opacity="0"/>' +
      '<stop offset="0.72" stop-color="#060a18" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="#060a18" stop-opacity="0.42"/>' +
      '</radialGradient>' +
      mask(pfx + 'jdRcMf', H, HOR + GAP * 0.5) +
      mask(pfx + 'jdRcMc', 0, HOR - GAP * 0.5) +
      '</defs>' +
      '<rect x="0" y="0" width="' + W + '" height="' + H +
      '" fill="url(#' + pfx + 'jdRcBg)"/>' +
      '<g stroke="#2fd0c9" stroke-opacity="0.6" stroke-width="1.25" ' +
      'fill="none" mask="url(#' + pfx + 'jdRcMf)">' + rowsF + '</g>' +
      '<g stroke="#2fd0c9" stroke-opacity="0.6" stroke-width="1.7" ' +
      'fill="none" mask="url(#' + pfx + 'jdRcMf)">' + raysF + '</g>' +
      '<g stroke="#2fd0c9" stroke-opacity="0.6" stroke-width="1.25" ' +
      'fill="none" mask="url(#' + pfx + 'jdRcMc)">' + rowsC + '</g>' +
      '<g stroke="#2fd0c9" stroke-opacity="0.6" stroke-width="1.7" ' +
      'fill="none" mask="url(#' + pfx + 'jdRcMc)">' + raysC + '</g>' +
      '<rect x="0" y="' + (HOR - GAP - 31) + '" width="' + W + '" height="' +
      (2 * GAP + 62) + '" fill="url(#' + pfx + 'jdRcGlow)"/>' +
      '<rect x="0" y="0" width="' + W + '" height="' + H +
      '" fill="url(#' + pfx + 'jdRcVig)"/>' +
      '</svg>';
  }

  /* RETIRED — kept as a backup on the owner's request (2026-08-12): the mk-I
     floor, a black-and-white checkerboard projected toward a center vanishing
     point, far rows dissolving into the navy horizon. Not called anywhere;
     to restore it, point the two floorSVG() call sites here (its 600×240
     viewBox suits the old 224px landscape plate, not the square one). */
  function checkerFloorSVG(pfx) {  /* eslint-disable-line no-unused-vars */
    pfx = pfx || '';
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
      '<linearGradient id="' + pfx + 'jdRcSky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#0a0e24"/>' +
      '<stop offset="0.8" stop-color="#141b44"/>' +
      '<stop offset="1" stop-color="#1c2456"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + pfx + 'jdRcFade" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#1c2456"/>' +
      '<stop offset="0.55" stop-color="#151b40" stop-opacity="0.55"/>' +
      '<stop offset="1" stop-color="#101010" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<rect x="0" y="0" width="' + W + '" height="' + HOR +
      '" fill="url(#' + pfx + 'jdRcSky)"/>' +
      cells +
      '<rect x="0" y="' + HOR + '" width="' + W + '" height="72" ' +
      'fill="url(#' + pfx + 'jdRcFade)"/>' +
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

  /* every axis name is a disclosure (owner, 2026-08-13): press it and a
     row unfolds beneath with the axis's own taxonomy description. The
     description rows ship in the table, hidden; build()'s click handler
     flips them. One card renders at a time, so the fixed ids are safe. */
  /* the expander sits LEFT of the name as a boxed +/− (owner rev,
     2026-08-13 — appendix-index style, not a dropdown arrow); the glyph
     itself is CSS content keyed off aria-expanded */
  function axisBtn(inner, descId) {
    return '<button type="button" class="rc-axbtn" aria-expanded="false" ' +
      'aria-controls="' + descId + '" data-axd="' + descId + '">' +
      '<span class="rc-axcaret" aria-hidden="true"></span>' + inner +
      '</button>';
  }
  function descRow(descId, text) {
    return '<tr class="rc-axdesc" id="' + descId + '" hidden>' +
      '<td colspan="2">' + esc(text) + '</td></tr>';
  }
  function subjectsHTML(resp) {
    var rows = '', di = 0;
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
        /* the bar fills against the axis's OWN step count — 3- and 4-point
           scales coexist since v17 — and the pencil class is scale-aware
           for the same reason (JD_axisCls) */
        var v = window.JD_byRank(axis.values, a.value);
        var steps = (axis.values || []).length || 3;
        var cls = v ? window.JD_axisCls(axis, v.rank) : '';
        cell = '<span class="rc-verdict">' +
          (v ? barHTML(Math.round(v.rank), steps, cls) : '') +
          mark(v ? v.label : String(a.value), cls) + '</span>';
      }
      var descId = 'rc-axd-' + (di++);
      rows += '<tr><td>' +
        axisBtn('<span class="rc-subj-name">' + esc(axis.label || axis.id) +
          '</span>', descId) +
        '</td><td>' + cell + '</td></tr>' +
        descRow(descId, axis.description || '');
    });
    var g = gradeOf(resp.grade);
    var gCls = g.rank ? 'rc-g' + Math.round(g.rank) : '';
    /* the overall row unfolds the scale itself, plus the earned tier's own
       description when the taxonomy carries one */
    var gDesc = 'The drawer’s own five-tier scale, best to worst.' +
      (g.description ? ' ' + g.label + ': ' + g.description : '');
    return '<table class="rc-subj"><thead><tr>' +
      /* 52/48 → 44/56 → 47/53 (owner, 2026-08-12): the verdict column
         carries the gauge AND the pencilled word, the axis column only a
         name — but 44% squeezed the axis names a touch too hard */
      '<th style="width:47%">Axis</th><th style="width:53%">Verdict</th>' +
      '</tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td>' +
      axisBtn('<span class="rc-avg-l">Overall grade</span>', 'rc-axd-g') +
      '</td><td><span class="rc-verdict">' +
      (g.rank ? barHTML(Math.round(g.rank), 5, gCls) : '') +
      mark(g.label, gCls) +
      '</span></td></tr>' + descRow('rc-axd-g', gDesc) + '</tfoot></table>';
  }

  /* THE STRIP IS A SCROLLER (owner, 2026-08-15: "I'd also like to be able to
     scrub my finger across them"). It used to be a WINDOW: three thumbnails
     rendered at a time out of N, with ◂ ▸ swapping which three. That is why
     a finger did nothing on it — there was nothing beside the three to scrub
     TO, and no scroll box to scrub in. Every response is in the DOM now, in
     one horizontal scroll port, so the platform's own panning does the work:
     momentum, rubber-banding at the ends, and snapping, on a phone for free.

     The pagers stay and now scroll the port by one thumbnail instead of
     re-rendering the strip; their disabled state reads off scrollLeft. The
     window index is gone entirely — position is the scroll offset, which is
     a fact about the DOM rather than a number we have to keep in step with
     it, and every thumbnail is reachable by Tab now instead of only the
     three currently framed. */
  function altsHTML(entry, curIdx) {
    if (!entry.responses || entry.responses.length < 2) return '';
    var n = entry.responses.length, paged = n > 3;
    var h = '<div class="rc-alts">';
    if (paged) {
      h += '<button type="button" class="rc-alt-nav" data-nav="-1"' +
        ' aria-label="Earlier responses">◂</button>';
    }
    /* is-many is what fixes each thumbnail at a third of the port so the
       next one peeks past the edge — the affordance that says "these
       scroll". With three or fewer they share the port and nothing moves. */
    h += '<div class="rc-alt-port' + (paged ? ' is-many' : '') + '">';
    entry.responses.forEach(function (r, i) {
      var m = modelOf(r.model), g = gradeOf(r.grade);
      h += '<button type="button" class="rc-alt' + (i === curIdx ? ' is-cur' : '') +
        '" data-resp="' + i + '">' +
        /* data-fit is the artwork's key, not the thumbnail's: the strip
           shows the drawing the plate shows, at the frame the plate uses */
        '<span class="rc-alt-art" data-fit="' + esc(fitKey(entry, r)) + '">' +
        svgInst(svgCache[entry.id + '/' + r.file] || '', 'jt' + i + '_') +
        '</span>' +
        '<span class="rc-alt-cap">' + esc(m.label) +
        /* the strip's little grades wear the same coloured pencils as the
           card's marks (rc-g1..5 share their colour rules) */
        '<span class="rc-alt-grade' +
        (g.rank ? ' rc-g' + Math.round(g.rank) : '') + '">' +
        esc(g.label) + '</span>' +
        '</span></button>';
    });
    h += '</div>';
    if (paged) {
      h += '<button type="button" class="rc-alt-nav" data-nav="1"' +
        ' aria-label="More responses">▸</button>';
    }
    return h + '</div>';
  }

  /* one thumbnail's worth of travel, gap included — the pagers' step and the
     unit the centring below thinks in */
  function altStep(port) {
    var a = port.querySelector('.rc-alt');
    if (!a) return port.clientWidth;
    var gap = parseFloat(getComputedStyle(port).columnGap);
    return a.getBoundingClientRect().width + (isFinite(gap) ? gap : 8);
  }
  /* the pagers go dim at the ends of the TRAVEL, not at the ends of a window
     index — one tolerance for the sub-pixel scrollLeft a snap can leave */
  function syncAltNav(strip) {
    var port = strip.querySelector('.rc-alt-port');
    if (!port) return;
    var max = port.scrollWidth - port.clientWidth;
    var l = strip.querySelector('.rc-alt-nav[data-nav="-1"]');
    var r = strip.querySelector('.rc-alt-nav[data-nav="1"]');
    if (l) l.disabled = port.scrollLeft <= 1;
    if (r) r.disabled = port.scrollLeft >= max - 1;
  }
  /* put the shown response under the visitor's eye. scrollLeft is assigned
     rather than scrollIntoView'd on purpose: scrollIntoView would also walk
     up and move the card's own vertical scroller, which on a re-render means
     the card jumping while the visitor is reading it. */
  function centerAlt(strip, idx, smooth) {
    var port = strip.querySelector('.rc-alt-port');
    if (!port) return;
    var a = port.querySelector('.rc-alt[data-resp="' + idx + '"]');
    if (!a) return;
    /* measured off the RECTS, not offsetLeft: offsetLeft is relative to the
       nearest positioned ancestor, and the port is static — so it answered
       with the thumbnail's distance from somewhere up in the card (511px in
       a port 446px wide), every centring clamped to the far end, and the
       card opened with its own selected thumbnail sliced to a sliver at the
       edge. The rects are relative to the viewport and the difference
       between them is the distance actually wanted. */
    var pr = port.getBoundingClientRect(), ar = a.getBoundingClientRect();
    var to = port.scrollLeft + (ar.left - pr.left) - (port.clientWidth - ar.width) / 2;
    to = Math.max(0, Math.min(to, port.scrollWidth - port.clientWidth));
    if (smooth && port.scrollTo) { port.scrollTo({ left: to, behavior: 'smooth' }); }
    else { port.scrollLeft = to; }
  }

  /* THE SCRUB. Touch and trackpad need nothing from us — a scroll port pans
     itself, and hijacking that would cost the momentum and the rubber-band
     that make it feel native, which is the whole point of the request. What
     the platform does NOT give is dragging with a held mouse button, so that
     alone is synthesised here, for pointerType 'mouse' only.

     A drag must not also pick a thumbnail. Past a few pixels of travel the
     gesture is a scrub, and the click that follows pointerup is swallowed by
     a one-shot capture listener — cleared on the next task either way, so a
     drag that ends without a click can never eat a later one. */
  function wireAltScrub(strip) {
    var port = strip.querySelector('.rc-alt-port');
    if (!port) return;
    port.addEventListener('scroll', function () { syncAltNav(strip); }, { passive: true });
    var down = false, moved = false, x0 = 0, left0 = 0;
    port.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      down = true; moved = false; x0 = e.clientX; left0 = port.scrollLeft;
    });
    port.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - x0;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) {
        moved = true;
        port.classList.add('is-scrubbing');
        try { port.setPointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();                     /* no text/image drag under it */
      port.scrollLeft = left0 - dx;
    });
    var end = function (e) {
      if (!down) return;
      down = false;
      port.classList.remove('is-scrubbing');
      try { port.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!moved) return;
      var kill = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
      port.addEventListener('click', kill, true);
      window.setTimeout(function () {
        port.removeEventListener('click', kill, true);
      }, 0);
    };
    port.addEventListener('pointerup', end);
    port.addEventListener('pointercancel', end);
  }

  /* THE CARD, landscape (round 13, owner pick 2026-08-13: mockup-13a's
     layout carrying mockup-13b's paper display container). One masthead
     across two columns: the photograph and its fill-in caption on the left,
     the paperwork — prompt, annotations, strip, footer — on the right. The
     grid areas live in junk-drawer.css; under 700px the column wrappers go
     display:contents and this same DOM reads as the portrait flow (which is
     why the source order below IS the portrait order). */
  function cardHTML(entry, resp, curIdx) {
    var m = modelOf(resp.model);
    var h = '';
    h += '<header class="rc-block rc-masthead">' +
      '<div class="rc-item">' + esc(entry.title) + '</div></header>';
    /* the plate is the enlargement's handle: role/tabindex make it a real
       button for keyboard and screen readers without wrapping the artwork in
       a <button>, whose UA box model would fight the absolutely-positioned
       photo layers. The corner hint is there for touch, where there is no
       hover to discover the affordance with. The four spans are the kraft
       photo corners holding the print to the form. */
    /* the response's data rides ON the photograph as margin notes (owner
       pick, mockup-14 option B, 2026-08-13): typed straight onto the graph
       paper in the print's lower-left, lab-proof style. MODEL and DATE
       always; PROCESS only when the response was refined — one-shot is the
       default story and doesn't need saying (owner call, same date). SIZE
       left the card entirely on that call: it now shows nowhere in the UI
       and lives on in the data. */
    var artSrc = svgCache[entry.id + '/' + resp.file] || '';
    var gen = resp.generation || {};
    /* what the drawing COST (2026-08-15): token counts and provider spend
       ride the reveal payload into the visitor record, so a won item's card
       states them — after a reload too. Only visitor responses carry these
       fields; curated items omit the lines entirely, and an unpriced model
       loses just the Cost line (the house rule: omit, never print null). */
    var tkTotal = resp.tokens && isFinite(+resp.tokens.total) ? +resp.tokens.total : null;
    var tkCost = resp.cost_usd != null && isFinite(+resp.cost_usd) ? +resp.cost_usd : null;
    var notes =
      '<span class="rc-note-line"><span class="rc-note-l">Model</span>' +
      '<span class="rc-note-v">' + esc(m.label) + '</span></span>' +
      '<span class="rc-note-line"><span class="rc-note-l">Date</span>' +
      '<span class="rc-note-v">' + esc(fmtDate(resp.date)) + '</span></span>' +
      (tkTotal !== null
        ? '<span class="rc-note-line"><span class="rc-note-l">Tokens</span>' +
          '<span class="rc-note-v">' + esc(tkTotal.toLocaleString('en-US')) + '</span></span>'
        : '') +
      (tkCost !== null
        ? '<span class="rc-note-line"><span class="rc-note-l">Cost</span>' +
          '<span class="rc-note-v">$' + esc(tkCost.toFixed(4)) + '</span></span>'
        : '') +
      (gen.mode === 'refined'
        ? '<span class="rc-note-line"><span class="rc-note-l">Process</span>' +
          '<span class="rc-note-v">' + esc(processLabel(gen)) + '</span></span>'
        : '');
    /* the photograph stays the enlarge control (role/tabindex, whole
       surface); its corner carries the DOWNLOAD SVG button — the "⤢
       enlarge" hint retired for it (owner rev, 2026-08-13). The click/key
       handlers in build() exempt .rc-dl so a download never also zooms.
       The file number prints beneath the button (owner rev, 2026-08-15 —
       it used to tail the notes, a line too many once Tokens/Cost
       joined). */
    h += '<div class="rc-col-l">' +
      '<div class="rc-block rc-plate" role="button" tabindex="0" ' +
      'aria-label="Enlarge the artwork">' +
      '<span class="rc-corner tl"></span><span class="rc-corner tr"></span>' +
      '<span class="rc-corner bl"></span><span class="rc-corner br"></span>' +
      '<div class="rc-plate-art" data-fit="' + esc(fitKey(entry, resp)) + '">' +
      svgInst(artSrc, 'jr' + curIdx + '_') +
      '</div>' +
      '<div class="rc-notes">' + notes + '</div>' +
      /* the photograph's button row (owner rev, 2026-08-16: REPLAY joined
         DOWNLOAD on one row): REPLAY plays the drawing again on request —
         the click/key handlers exempt both buttons from the plate's zoom.
         The row is one positioned flex box, so the buttons never need to
         guess each other's widths. */
      '<div class="rc-plate-btns">' +
      '<button type="button" class="rc-draw" ' +
      'title="watch the drawing draw itself again" ' +
      'aria-label="Replay the drawing">REPLAY ✎</button>' +
      '<a class="rc-dl" href="' + esc(resp.url) + '" download="' +
      esc(entry.id) + '.svg" title="download the SVG as generated">' +
      'DOWNLOAD SVG ⤓</a>' +
      '</div>' +
      '<span class="rc-note-no">' + esc(entry.id) + '</span>' +
      '</div></div>';
    /* the prompt renders foldable; render() measures it after paint and
       strips the fold when it actually fits three lines — so the expander
       only ever appears on prompts that need it */
    h += '<div class="rc-col-r">' +
      '<div class="rc-block rc-head">The prompt</div>' +
      '<div class="rc-block rc-assign rc-can-fold"><p>“' + esc(entry.prompt) +
      '”</p>' +
      '<button type="button" class="rc-pv" aria-expanded="false">' +
      '<span class="rc-pv-more">show full prompt ▾</span>' +
      '<span class="rc-pv-less">show less ▴</span></button></div>';
    h += '<div class="rc-block rc-head">Grades</div>' +
      '<div class="rc-block">' + subjectsHTML(resp) + '</div>';
    var alts = altsHTML(entry, curIdx);
    if (alts) {
      h += '<div class="rc-block rc-head">Other models, same prompt</div>' +
        '<div class="rc-block rc-alts-block">' + alts + '</div>';
    }
    /* (no footer any more: the download button lives on the photograph and
       the file number in its margin notes — owner rev, 2026-08-13) */
    return h + '</div>';
  }

  /* the enlargement's contents: the SAME response the card is showing, on
     the same graph-paper photo swatch (its CSS twin lives on .rc-zoom-fig),
     so it reads as the photograph held up off the form rather than a
     different picture. Its inlined copy takes a `jz` prefix — the `jr` copy
     is still in the card underneath it. */
  function zoomHTML(entry, resp, curIdx) {
    var m = modelOf(resp.model);
    return '<div class="rc-zoom-fig" role="button" tabindex="0" ' +
      'aria-label="Shrink the artwork">' +
      '<div class="rc-zoom-art" data-fit="' + esc(fitKey(entry, resp)) + '">' +
      svgInst(svgCache[entry.id + '/' + resp.file] || '', 'jz' + curIdx + '_') +
      '</div></div>' +
      '<div class="rc-zoom-cap">' +
      '<span class="rc-zoom-cap-t">' + esc(entry.title) + ' · ' + esc(m.label) +
      '</span>' +
      '<span class="rc-zoom-cap-h">click, or press Esc, to shrink</span>' +
      '</div>';
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

  /* fetch any response SVGs not yet cached (primaries arrive from the pile
     loader; alternatives load lazily on first open) */
  function ensureSVGs(entry) {
    return Promise.all(entry.responses.map(function (r) {
      var key = entry.id + '/' + r.file;
      if (svgCache[key]) return null;
      /* a visitor's own won item has no file on the server: its SVG is primed
         into the cache when the entry is filed, and its `url` is a data: URL
         for the download link only — never a path to join to JD_API */
      if (entry.visitor) {
        svgCache[key] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>';
        return null;
      }
      return fetch(JD_API + r.url).then(function (res) {
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
      /* the DOWNLOAD button rides ON the plate: it must never also zoom */
      if (e.target.closest && e.target.closest('.rc-dl')) return;
      /* REPLAY rides the plate too: it redraws, never zooms. An explicit
         press is requested motion, so it plays under reduced-motion too. */
      if (e.target.closest && e.target.closest('.rc-draw')) {
        drawOn(true);
        return;
      }
      if (e.target.closest && e.target.closest('.rc-plate')) {
        openZoom(e.target.closest('.rc-plate'));
        return;
      }
      /* the prompt's fold (round 13): the expander toggles the block open;
         state is DOM-only on purpose — a re-render folds a long prompt
         back down, which is right when the response (and card height
         budget) just changed */
      var pv = e.target.closest ? e.target.closest('.rc-pv') : null;
      if (pv) {
        var box = pv.closest('.rc-assign');
        var open = box.classList.toggle('is-open');
        pv.setAttribute('aria-expanded', open ? 'true' : 'false');
        return;
      }
      /* an axis name unfolds its taxonomy description (owner, 2026-08-13) */
      var ax = e.target.closest ? e.target.closest('.rc-axbtn') : null;
      if (ax) {
        var dr = scrollEl.querySelector('#' + ax.getAttribute('data-axd'));
        if (dr) {
          var opening = dr.hidden;
          dr.hidden = !opening;
          ax.setAttribute('aria-expanded', opening ? 'true' : 'false');
        }
        return;
      }
      /* the strip's ◂ ▸ pagers (4+ responses): one thumbnail of travel in
         the scroll port. They move the SAME strip the finger moves — no
         re-render, so a long prompt the visitor just unfolded stays
         unfolded, and browsing the bench still isn't switching the
         response. Smooth, unless the visitor asked for less motion. */
      var nav = e.target.closest ? e.target.closest('.rc-alt-nav') : null;
      if (nav) {
        if (nav.disabled) return;
        var strip = scrollEl.querySelector('.rc-alts');
        var port = strip && strip.querySelector('.rc-alt-port');
        if (!port) return;
        var by = parseInt(nav.getAttribute('data-nav'), 10) * altStep(port);
        var calm = JD_reduced();
        if (port.scrollBy) port.scrollBy({ left: by, behavior: calm ? 'auto' : 'smooth' });
        else port.scrollLeft += by;
        return;
      }
      var b = e.target.closest ? e.target.closest('.rc-alt') : null;
      if (!b) return;
      var i = parseInt(b.getAttribute('data-resp'), 10);
      if (isNaN(i) || i === curResp) return;
      curResp = i;
      drawNext = true;  /* the incoming response draws itself on */
      render(false);
    });
    /* the plate answers Enter/Space like the button it claims to be; Space is
       preventDefault'd or the card scrolls out from under the enlargement */
    scrollEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      /* Enter on the focused DOWNLOAD link is the download, not the zoom;
         REPLAY is a real <button>, so the UA turns these keys into its
         click — the handler above redraws, nothing here should zoom */
      if (e.target.closest && e.target.closest('.rc-dl')) return;
      if (e.target.closest && e.target.closest('.rc-draw')) return;
      var p = e.target.closest ? e.target.closest('.rc-plate') : null;
      if (!p) return;
      e.preventDefault();
      openZoom(p);
    });
  }

  /* the enlargement is the shared layer (JD_zoomLayer in jd-core.js): the
     record card's one job is to say WHAT goes on it — the response the card
     is showing, re-synced whenever the card re-renders under it (see
     render) so the enlargement can never drift onto a stale response — and
     which plate its grid scale is measured against. Deliberately NOT
     tracked: the enlargement is a toggle, and the events endpoint's
     allowlist doesn't carry this page anyway (item_open is the one call the
     module makes, and it is already the exception). */
  function zoomBody() {
    var resp = curEntry.responses[curResp] || curEntry.responses[0];
    return zoomHTML(curEntry, resp, curResp);
  }
  function plateEl() { return scrollEl ? scrollEl.querySelector('.rc-plate') : null; }
  function openZoom(from) {
    if (!isOpen || zoom.isOn() || !curEntry) return;
    zoom.open(from || null, zoomBody(), plateEl());
  }
  function closeZoom(silent) { zoom.close(silent); }

  /* THE DRAW-ON REVEAL (owner, 2026-08-16): when the report card opens —
     and again when the visitor flips to another model's response, or
     presses REPLAY — the photograph doesn't just appear: the artwork draws
     itself onto the plate via window.JD_drawOn (the shared engine at the
     top of this file; the turn's reveal drinks from the same well). Scope
     here is the card's plate ONLY — the enlargement is the same photograph
     held closer, not a new drawing; the strip's thumbnails and the pile
     never draw at all. */
  var drawNext = false, drawUntil = 0;
  /* `force` is the REPLAY button's explicit press: requested motion plays
     even when prefers-reduced-motion is on — the preference guards against
     ambient animation, and a button whose whole job is "animate this" going
     dead would be the worse accessibility outcome. No `secs`: the engine
     paces each artwork by its own measured ink (owner rev, 2026-08-16 —
     a paperclip sketches in a moment, a portrait takes its time). */
  function drawOn(force) {
    if (!scrollEl || !curEntry || !window.JD_drawOn) return;
    var holder = scrollEl.querySelector('.rc-plate-art');
    var svg = holder ? holder.querySelector('svg') : null;
    var secs = svg && window.JD_drawOn(svg, { force: !!force });
    if (secs) {
      /* the lazy-fetch guard's window: while this hasn't elapsed, a draw
         is (or may be) in flight on the plate */
      drawUntil = Date.now() + (secs + 0.4) * 1000;
    }
  }

  function render(animate) {
    markSeq = 0;
    var resp = curEntry.responses[curResp] || curEntry.responses[0];
    scrollEl.innerHTML = cardHTML(curEntry, resp, curResp);
    /* the prompt renders foldable, then earns it: measured here, after
       layout, because "three lines" depends on the column's real width —
       a character count lies in one orientation or the other. A prompt
       that fits its three lines loses the fold and the expander both. */
    var fold = scrollEl.querySelector('.rc-assign.rc-can-fold');
    if (fold) {
      var fp = fold.querySelector('p');
      if (fp && fp.scrollHeight <= fp.clientHeight + 2) {
        fold.classList.remove('rc-can-fold');
      }
    }
    /* reframe after paint, in the same post-paint pass: the plate and the
       strip thumbs inlined above may declare a frame their geometry
       overshoots — fitView widens the viewBox, never the drawing. Every
       holder carries the ARTWORK's key, so a 46px thumbnail is handed the
       frame the 350px plate resolved rather than measuring its own. */
    if (window.JD_fitAll) window.JD_fitAll(scrollEl);
    /* the strip is a fresh node after every render, so its scrub listeners
       are wired here rather than delegated (scroll doesn't bubble anyway),
       and the shown response is brought under the eye without animating —
       this is a repaint of the card, not a move the visitor made. */
    var strip = scrollEl.querySelector('.rc-alts');
    if (strip) {
      wireAltScrub(strip);
      centerAlt(strip, curResp, false);
      syncAltNav(strip);
    }
    /* a re-render replaces the plate node, so an open enlargement re-syncs to
       the new response and re-points its way home (the lazy alternative SVGs
       landing is the common case; switching response while enlarged is the
       other) */
    if (zoom.isOn()) {
      zoom.fill(zoomBody(), plateEl());
      zoom.setFrom(plateEl());
    }
    if (animate) {
      cardEl.classList.remove('is-enter');
      void cardEl.offsetWidth;
      cardEl.classList.add('is-enter');
    }
    /* the reveal runs only where a caller asked for it (open, response
       flip) — a plain re-render, like the strip filling in, must never
       restart a drawing */
    if (drawNext) { drawNext = false; drawOn(); }
  }

  function open(id, viaHistory) {
    if (!payload || isOpen) return;
    /* one modal at a time: the turn modal owns Esc and the scrim while it is
       up, and two aria-modal dialogs on one page is a trap (C5.4) */
    if (window.JD_turn && window.JD_turn.isOpen()) return;
    /* …and the analytics folder, which is a third such dialog (2026-08-28) */
    if (window.JD_folder && window.JD_folder.isOpen()) return;
    var entry = byId(payload.items, id);
    if (!entry) return;
    curEntry = entry;
    curResp = 0;
    for (var i = 0; i < entry.responses.length; i++) {
      if (entry.responses[i].rid === entry.primary) curResp = i;
    }
    /* (opening on the PRIMARY's thumbnail is render()'s job now — it centres
       whatever curResp is in the scroll port, clamped to the ends) */
    injectDefs();
    build();
    isOpen = true;
    scrim.classList.add('is-on');
    document.documentElement.classList.add('jd-record-open');
    /* render immediately with what's cached (the primary always is); the
       strip thumbnails fill in when the lazy fetches land */
    drawNext = true;  /* opening the card draws the photograph on */
    render(true);
    ensureSVGs(entry).then(function () {
      if (!isOpen) return;
      /* the lazy fetches usually land while the reveal is still running,
         and all they change is the strip — the plate's own SVG was cached
         before first paint. A full render here would cut the drawing dead,
         so while a draw is in flight refresh the strip alone. The full
         path still runs when the plate is actually missing its artwork
         (an alternative was picked before its fetch landed): then the
         landing IS the reveal, and it draws. */
      var plateEmpty = !scrollEl.querySelector('.rc-plate-art svg');
      if (drawUntil > Date.now() && !plateEmpty) {
        var ab = scrollEl.querySelector('.rc-alts-block');
        if (ab) ab.innerHTML = altsHTML(curEntry, curResp);
        if (window.JD_fitAll) window.JD_fitAll(scrollEl);
        /* the replaced strip is a fresh node, so it takes the same wiring
           render() gives one — scrub, centring, nav sync */
        var st = scrollEl.querySelector('.rc-alts');
        if (st) {
          wireAltScrub(st);
          centerAlt(st, curResp, false);
          syncAltNav(st);
        }
        return;
      }
      drawNext = plateEmpty;
      render(false);
    });
    if (!viaHistory) {
      try { history.pushState({ jdRecord: id }, '', '#' + id); pushed = true; }
      catch (e) { pushed = false; }
    } else { pushed = false; }
    JD_track('item_open', id);
  }

  function teardown() {
    if (!isOpen) return;
    closeZoom(true);
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
  /* Escape peels ONE layer per press: the enlargement first, the card only
     once the artwork is back down on its plate. (The pile's own Esc handler
     is already standing down for the whole time the record is open, so this
     is the only claim on the key here — no capture-phase interception
     needed, just the order of these two branches.) */
  window.addEventListener('keydown', function (e) {
    if (!isOpen || e.key !== 'Escape') return;
    if (zoom.isOn()) { closeZoom(); return; }
    close();
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
