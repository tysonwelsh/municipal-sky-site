/* ============================================================================
   THE JUNK DRAWER — junk-drawer.js (Phase 1)
   Two responsibilities, promoted from mockups/mockup-2-frame-kit.html (the
   proven Phase 0 build; plans: PLAN-FRONTEND §3/§6, PLAN-MOBILE §§1–3):
     1. the pile loader — one request to data.php ({taxonomy, items[]},
        PLAN-BACKEND §7), each item's PRIMARY response SVG inlined into a
        .jd-item wrapper with its entry.json placement applied inline. The
        same payload also renders the field-notes sections in #notes: the
        wall-label count line and the taxonomy-driven grade legend — zero
        hardcoded rubric strings anywhere.
     2. the drag/rotate gesture script — Pointer Events, one code path:
        hold-to-grip on touch, transform-only drag motion, wheel / [ ] keys /
        second-finger twist rotation, silhouette-accurate hit-testing.
   Vanilla JS, no build step. The Safari/Blink notes inline are load-bearing,
   not commentary — do not regress them.
   ========================================================================== */

/* ---- named constants, storage, and shims (contract C5.1/C5.3/C5.6/C5.7) ---
   File scope, above every module below, so all of them share one copy. This
   is the whole list of things the packaged-app stage has to re-point: an API
   base, a client name, the consent record, and the visible strings. */

/* API base; '' = same origin. EVERY fetch in this file is JD_API + an
   ABSOLUTE path — nothing may assume the page and the API share a directory
   (APP constraint 1). Item urls arrive from data.php already root-absolute,
   so they are prefixed at their call sites too. */
var JD_API = '';

/* sent in every POST body and validated server-side against a small enum;
   never sniffed from User-Agent, which in a webview reads as web forever */
var JD_CLIENT = 'web';

/* The third-party-AI disclosure, recorded per submission. This copy is
   canonical: privacy.php §4 quotes it verbatim, and drift between the two is
   a blocking review finding (APP §4.5). The prompt card stopped PRINTING
   these words in round 17 (owner call, 2026-08-14: privacy.php already
   carries the full disclosure live, so the card links to it instead of
   repeating it) — JD_CONSENT.text/.version stay exactly as filed regardless,
   because they are still what gets recorded against the visitor's turn. */
var JD_CONSENT = {
  version: 'jd-consent-4',
  text: 'When you take a turn, the words you type are sent to four AI ' +
    'providers — Anthropic (Claude), OpenAI (GPT), Moonshot AI (Kimi), and ' +
    'Google (Gemini) — which each draw an object from them. Your prompt, ' +
    'the drawings that come back, your ratings, and an anonymous ' +
    'daily-rotating visitor code are stored so the results can be studied ' +
    'and the feature kept honest. Nothing you type here is shown to other ' +
    'visitors.',
  check: 'I understand — send my words to Anthropic, OpenAI, Moonshot AI and Google'
};

/* one slot per pool chair — every model draws every turn (four chairs,
   2026-08-14; the brief draw-3-of-4 rotation lasted a few hours before the
   owner called it: no sit-outs). The generating lines, the plates, the
   rail and the call all read this list. */
var JD_SLOTS = ['a', 'b', 'c', 'd'];

var JD_STRINGS = {
  /* the owner's pick, mockup-9a-labels tasting, 2026-08-11 — it is also the
     wording PRINTED ON the button's lens in turn-object.svg: change the two
     together or the accessible name and the artwork disagree */
  turnButton: 'PUSH FOR JUNK',
  visitorTag: 'YOURS'          /* the paper tag on an item the visitor won */
};

/* One storage accessor (APP constraint 7) — sessionStorage, JSON both ways,
   every call wrapped: private mode throws on write and a null read is the
   contract, not an error. Keys must be 'jd-' prefixed; anything else is
   refused rather than silently creating a second namespace. Session scope is
   deliberate (the won items are session-local by design, master plan §4.5);
   it is also the one place the app swaps in Capacitor Preferences. */
var JD_store = (function () {
  function ours(key) { return typeof key === 'string' && key.indexOf('jd-') === 0; }
  return {
    get: function (key) {
      if (!ours(key)) return null;
      try {
        var raw = sessionStorage.getItem(key);
        return raw == null ? null : JSON.parse(raw);
      } catch (e) { return null; }
    },
    set: function (key, value) {
      if (!ours(key)) return false;
      try { sessionStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove: function (key) {
      if (!ours(key)) return false;
      try { sessionStorage.removeItem(key); return true; } catch (e) { return false; }
    }
  };
})();

/* the haptics shim (APP constraint 8): one site to route through, silent
   where the API is absent (iOS Safari has no vibrate at all) */
function JD_haptic(kind) {
  var ms = { grip: 8, settle: 12, drop: 16, select: 8 }[kind];
  if (!ms || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch (e) {}
}

/* anonymous usage events, fire-and-forget. Every caller on the page goes
   through this one function so the endpoint has exactly one URL. */
function JD_track(type, label) {
  try {
    fetch(JD_API + '/api/page-event-tracking.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 'junk-drawer', event_type: type, label: label || null })
    }).catch(function () {});
  } catch (e) {}
}

/* is a modal layer holding the page? The pile's dismissal paths (pointerdown,
   Escape, resize) stand down while one is up, so Esc peels the top layer and
   never reaches through it to the selection underneath. */
function JD_layerOpen() {
  return !!((window.JD_record && window.JD_record.isOpen()) ||
            (window.JD_turn && window.JD_turn.isOpen()) ||
            /* the analytics folder is the third one (2026-08-28) */
            (window.JD_folder && window.JD_folder.isOpen()));
}

/* ---- the pile loader + field-notes renderer ------------------------------ */
(function () {
  var pile = document.querySelector('.jd-pile');
  var payloadRef = null;   /* the data.php payload, handed to JD_record */
  /* the "m" tier box in cqmin, resolved from the live taxonomy and handed to
     the turn object so the turn button is measured on exactly the ruler the
     collection is measured on (null when data.php never answered — the
     object falls back to BASE.m rather than going missing, since it is now
     the ONLY way to take a turn) */
  var turnBox = null;
  /* tier box per sizeClass, in cqmin. Fallback only — the live boxes come
     from taxonomy.sizeTiers at load (see sizeBoxes), so the scale is
     data-driven. */
  var BASE = { xs: 6, s: 9, m: 15.5, l: 22, xl: 30 };
  /* THE TIER RULER, and why it is declared all the way out here (2026-08-28,
     found while wiring the analytics folder onto the same line): it is
     RESOLVED from the live taxonomy inside the data.php .then, and READ two
     .then's later, by the furniture's ready() calls — separate function
     scopes. Declared as a local `function boxFor` in the first block, the
     sheet's `ready(boxFor('xl'))` in the second threw a ReferenceError
     INSIDE the success handler, so every single load fell through to the
     .catch: the fallback note printed under a pile that had in fact loaded,
     and JD_record.setData / JD_turn.setData / the #<id> deep link never ran
     at all (the report card was dead on every press). Hoisting the binding
     is the whole fix; the fallback body is what a failed load still gets. */
  var boxFor = function (sc) { return BASE[sc] || BASE.m; };

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

  /* REFRAME, never redraw (owner-approved, 2026-08-15). Models are prompted
     to fill the viewBox edge to edge and sometimes draw past it — a headstock
     at negative y, a glow bleeding past the frame. An inline <svg> clips at
     the viewport it declares, so the overshoot is sliced off in the pile, on
     the report card's plate, in the enlargement, and on the turn plates; the
     DOWNLOADED file clips too, but its bytes are its own business — the
     sanitizer passes generation bytes through untouched, so reframing is the
     display layer's job (the sanctioned inverse of the ingest-time viewBox
     tightening in CLAUDE.md).

     The fix is a wider viewBox, NOT overflow:visible: spilled ink would paint
     over the plate's borders and kraft photo corners, and in the pile it
     would break the item's silhouette — drag/hit math trusts the element box
     the viewBox aspect defines (svgAspect, applySize, the scatter clamping).

     `svg` must be IN THE RENDERED DOM: getBBox throws on non-rendered
     subtrees, so callers fit after insertion and before anything measures
     aspect or footprint. A skipped fit is silent and harmless — the drawing
     stays clipped, exactly as it always has.

     ONE FRAME PER ARTWORK, SHARED BY EVERY SURFACE (2026-08-15, second
     pass — the owner reported thumbnails that don't match the drawing
     shown elsewhere). Two things made the fit drift between copies:

       · getBBox is a LAYOUT measurement, not a property of the file. On
         artwork carrying <text> it comes back slightly different at 46px
         than at 350px (font metrics resolve per rendered size), so the
         pile, the plate, the strip thumbnail and the enlargement each
         derived their own frame from their own copy — the same drawing,
         four framings.
       · a copy measured before its box has a size measures nothing.

     So the fit is computed ONCE per artwork and MEMOISED under a caller's
     key (the response's cache key, a generation id — anything stable per
     artwork). Every later copy applies the stored frame without measuring:
     identical framing everywhere, by construction, and one layout pass
     instead of one per copy. A failed measurement is never cached, so the
     first copy that renders in a real box still gets to decide.

     WHAT THE FRAME MAY GROW BY. Ink that pokes a little past the frame is
     a model missing its own edge, and reframing rescues it. Ink that runs
     WELL past the frame is deliberate full bleed — a sunburst, a glow, a
     drop shadow drawn oversize precisely so the viewport crops it — and
     "rescuing" that wrecks the composition: the first pass grew a 1000×1000
     alarm-clock poster to 2000×2000, which drew the clock at half size in a
     field of white with the rays' points now sticking out. So:

       · the pad (getBBox ignores stroke width, so ink AT the edge may paint
         just past it) is 2% of the SHORTER frame side. The old 4% of the
         LONGER side was ruinous on an elongated frame — on a 1000×110
         cigarette it added 40 units of sky and floor, 73% of the height,
         to a drawing whose ink never left the frame at all.
       · each side is rescued ALL OR NOTHING, at 15% of its own dimension.
         Growing "up to a cap" was the worst of both: still clipped AND
         shrunk. Past the cap the authored edge stands and the overshoot
         stays cropped — which is what a full-bleed drawing wants.

     A drawing that already fits is left byte-identical. */
  var FIT_PAD = 0.02, FIT_CAP = 0.15;
  var fitFrames = {};              /* key -> viewBox string ('' = as authored) */

  function fitView(svg, key) {
    if (!svg) return;
    /* the artwork is letterboxed on every surface, whatever the file asks
       for: a root preserveAspectRatio of "none" would stretch the drawing
       to each box's own shape (so the plate and the strip thumbnail would
       disagree), and a "slice" would crop it differently in each. Neither
       is a choice the display layer can honour across boxes of four
       different proportions, so the root is normalised on every copy.
       Curated files declare none of these today; visitor generations are
       passed through the sanitizer's bytes untouched and can. */
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    var vb = String(svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || !(vb[2] > 0) || !(vb[3] > 0)) return;
    if (key && fitFrames[key] !== undefined) {
      if (fitFrames[key]) svg.setAttribute('viewBox', fitFrames[key]);
      return;
    }
    var bb;
    try { bb = svg.getBBox(); } catch (e) { return; }   /* not rendered: don't cache */
    if (!bb || !(bb.width > 0) || !(bb.height > 0)) return;
    var pad = FIT_PAD * Math.min(vb[2], vb[3]);
    var capX = FIT_CAP * vb[2], capY = FIT_CAP * vb[3];
    var x0 = vb[0], y0 = vb[1], x1 = vb[0] + vb[2], y1 = vb[1] + vb[3];
    /* how far each side would have to move to take in the padded ink */
    var wl = x0 - (bb.x - pad), wr = (bb.x + bb.width + pad) - x1;
    var wt = y0 - (bb.y - pad), wb = (bb.y + bb.height + pad) - y1;
    if (wl > 0 && wl <= capX) x0 -= wl;
    if (wr > 0 && wr <= capX) x1 += wr;
    if (wt > 0 && wt <= capY) y0 -= wt;
    if (wb > 0 && wb <= capY) y1 += wb;
    var frame = '';
    if (x0 !== vb[0] || y0 !== vb[1] ||
        x1 !== vb[0] + vb[2] || y1 !== vb[1] + vb[3]) {
      var r = function (n) { return Math.round(n * 100) / 100; };
      frame = [r(x0), r(y0), r(x1 - x0), r(y1 - y0)].join(' ');
      svg.setAttribute('viewBox', frame);
    }
    if (key) fitFrames[key] = frame;
  }
  window.JD_fitView = fitView;   /* every surface that inlines an item SVG */

  /* the one call every surface makes after it writes artwork into the DOM:
     each holder carries data-fit="<key>" and gets the frame filed under that
     key. Keys are per-ARTWORK, never per-copy or per-surface — that is what
     makes a 46px thumbnail and a 350px plate show the same drawing. */
  function fitAll(root) {
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('[data-fit]'), function (el) {
      fitView(el.querySelector('svg'), el.getAttribute('data-fit'));
    });
  }
  window.JD_fitAll = fitAll;

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
  window.JD_sizeLabel = sizeLabel;   /* kept global: the pile loader and the
                                        visitor-item labeler both call it,
                                        though no UI surface displays size
                                        any more (owner, 2026-08-13) */

  /* RATINGS, as filed — entries store every rating as a NUMBER: a grade is
     the taxonomy grade's `rank` (5.0 … 1.0) and an annotation is the axis
     value's `rank` (the axis's top rank — 3.0 or 4.0 — down to 1.0),
     never the id or label (entry schema 2), so
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

  /* Taxonomy labels may carry _underscored_ emphasis (v14, owner request:
     "Has _it_"). HTML surfaces render the run in italics; plain-text
     surfaces — native <option> text, aria strings, the report card's
     stamped marks — strip the markers. The data stays honest either way:
     an underscore pair is the whole convention. */
  function labelText(s) {
    return String(s == null ? '' : s).replace(/_([^_]+)_/g, '$1');
  }
  window.JD_labelText = labelText;

  /* The pencil an axis value writes with. Classes encode rank AND scale
     length, because a rank means nothing without its scale: on a 3-point
     axis rank 3 is the best news there is (dark green), on a 4-point axis
     it is second place (leaf green). 3-point axes keep the original
     rc-r1..3 pencils; 4-point axes (v17) get their own rc-q1..4 ramp in
     the stylesheet. The grade scale's rc-g1..5 is separate (JD_gradeOf). */
  function axisCls(axis, rank) {
    var pts = ((axis || {}).values || []).length;
    return (pts === 4 ? 'rc-q' : 'rc-r') + Math.round(rank);
  }
  window.JD_axisCls = axisCls;   /* the record card and the bench share it */
  function gradeOf(tax, value) {
    return byRank((tax || {}).grades, value);
  }
  window.JD_gradeOf = gradeOf;   /* the record card resolves grades too */

  /* the tier box → the element's --w, area-normalized (see SIZE above):
       w = box·√aspect  →  h = w/aspect = box/√aspect  →  w·h = box².
     Elongation past SIZE.elong shrinks the whole item so the long side stops
     at box×elong; then the owner's fine dial and the id-hashed jitter. The
     aspect is read from the copy already inlined into `el`. Shared, because a
     visitor's won item is filed on the same ruler as a curated one (C5.3). */
  function applySize(el, box, id, fine) {
    var sq = Math.sqrt(svgAspect(el));
    var shape = Math.min(1, SIZE.elong / Math.max(sq, 1 / sq));
    el.style.setProperty('--w',
      +((box || BASE.m) * sq * shape * (fine || 1) * sizeJitter(id)).toFixed(2));
  }
  window.JD_applySize = applySize;

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

  /* ---- the turn button's corner is reserved (owner, 2026-08-10) --------------
     The Take-a-Turn button is FIXED hardware in the bottom-left corner
     (see the turn-object module), so nothing may spawn overlapping it. Its
     rect is replayed here from the module's own geometry (JD_turnObject.GEOM)
     with the same footprint math applySize gives every item, and positions
     are pushed clear at APPLY time rather than only at scatter time: stored
     scatters can predate this rule, and a viewport change moves the rect —
     enforcing per-load is the only version that holds. Nothing is written
     back; where the junk lies is scenery either way. */
  function turnRect(W, H, MIN) {
    var g = window.JD_turnObject && window.JD_turnObject.GEOM;
    if (!g || !(W > 0 && H > 0)) return null;
    var M = SCATTER.inset;
    /* the BUILT button is the truth — the ≤768px ×1.2 size band and the
       44px touch floor are CSS the math below does not see (measured cost
       of trusting math alone: a 15px graze on a phone). Measure the plate
       whenever it exists. */
    var bell = document.querySelector('.jd-item--turn');
    if (bell) {
      var pr = pile.getBoundingClientRect(), br = bell.getBoundingClientRect();
      if (br.width > 0) {
        return { x1: (br.right - pr.left) / W + M, y0: (br.top - pr.top) / H - M };
      }
    }
    /* not built yet (its artwork fetch is async): replay the sizing —
       tier box × aspect × fine × id jitter, plus the mobile band and the
       floor. Approximate on purpose; JD_enforceTurnCorner re-runs against
       the measured plate the moment it is built. */
    var sq = Math.sqrt(g.aspect);
    var shape = Math.min(1, SIZE.elong / Math.max(sq, 1 / sq));
    var band = (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ? 1.2 : 1;
    var wpx = Math.max((turnBox || BASE.m) * sq * shape * g.fine * sizeJitter(g.id) / 100 * MIN * band, 44);
    var hpx = wpx / g.aspect;
    var hw = Math.min(0.5, wpx / 2 / W), hh = Math.min(0.5, hpx / 2 / H);
    /* the corner the button owns: x below x1 AND y above y0, its full plate
       plus the pile's standard clearance as margin */
    return { x1: 2 * hw + g.inset + M, y0: 1 - 2 * hh - g.inset - M };
  }
  /* the exact pass, run by the turn module once the plate is built and
     seated (and so measurable): push anything already lying in the corner
     clear of the REAL rect. Closes the race between the pile's apply pass
     and the turn button's async artwork fetch, whichever lands first. */
  window.JD_enforceTurnCorner = function () {
    var host = pile.getBoundingClientRect();
    var W = host.width || 1, H = host.height || 1, MIN = Math.min(W, H);
    pile.querySelectorAll('.jd-item:not([data-turn])').forEach(function (el) {
      var x = parseFloat(el.style.left) / 100, y = parseFloat(el.style.top) / 100;
      if (!isFinite(x) || !isFinite(y)) return;
      var r = el.getBoundingClientRect();
      var rot = (parseFloat(el.style.getPropertyValue('--rot')) || 0) * Math.PI / 180;
      var c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
      var w = r.width || 40, h = r.height || 40;
      var a = avoidTurn(x, y,
        Math.min(0.5, (w * c + h * s) / 2 / W),
        Math.min(0.5, (w * s + h * c) / 2 / H), W, H, MIN);
      if (a.x !== x || a.y !== y) {
        el.style.left = (a.x * 100) + '%';
        el.style.top = (a.y * 100) + '%';
      }
    });
  };
  function avoidTurn(x, y, hw, hh, W, H, MIN) {
    var R = turnRect(W, H, MIN);
    if (!R) return { x: x, y: y };
    if (x - hw >= R.x1 || y + hh <= R.y0) return { x: x, y: y };   /* clear */
    var pushX = R.x1 + hw;                       /* rightward, off the plate */
    var pushY = R.y0 - hh;                       /* upward, off the plate */
    var okX = pushX <= 1 - hw - SCATTER.inset;
    var okY = pushY >= hh + SCATTER.inset;
    if (okX && (!okY || pushX - x <= y - pushY)) return { x: +pushX.toFixed(4), y: y };
    if (okY) return { x: x, y: +pushY.toFixed(4) };
    return { x: x, y: y };   /* an item too big to fit anywhere else keeps its
                                spot — overlap beats teleporting off the well */
  }
  /* the won-items module spawns into the same pile and honours the same
     reservation; centre + half-sizes in well fractions in, corrected out */
  window.JD_avoidTurn = function (x, y, hw, hh) {
    var host = pile.getBoundingClientRect();
    var W = host.width || 1, H = host.height || 1;
    return avoidTurn(x, y, hw, hh, W, H, Math.min(W, H));
  };

  /* stable-per-session: reuse the stored scatter iff it covers exactly the
     items on the page; otherwise recompute and persist. sessionStorage may be
     unavailable (private mode) — degrade to a fresh scatter each load. */
  function layoutFor(els) {
    var ids = els.map(function (e) { return e.dataset.id; });
    var stored = JD_store.get(SCATTER.key);
    var covers = stored && ids.every(function (id) { return stored[id]; });
    if (covers) { return stored; }
    var fresh = computeScatter(els);
    /* a visitor's won items are merged into this same map under their gen_id
       (C5.3), so the merge base is whatever is already stored */
    if (stored) { Object.keys(stored).forEach(function (k) { if (!fresh[k]) fresh[k] = stored[k]; }); }
    JD_store.set(SCATTER.key, fresh);
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
      /* LIVE axes only (owner, 2026-08-11): the dimmed defunct rows are
         gone from the legend — the field notes describe the survey as it
         is asked today. Retired axes still exist in the taxonomy for the
         old responses that carry their grades (the report card is where
         that history surfaces, when it lands). */
      var axes = (tax.axes || []).filter(function (ax) { return !ax.defunct; });
      axes.forEach(function (ax) {
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

  /* (the inventory — one mono line per item — left the field notes
     2026-08-28, owner call: the pile IS the inventory, and the count line
     above says how many. Every item's paperwork lives on its report card.) */
  function renderNotes(data) {
    renderCount(data);
    renderLegend(data.taxonomy || {});
  }

  /* ---------- one request, then the pile ---------------------------------- */
  fetch(JD_API + '/art/junk-drawer/data.php')
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
      boxFor = function (sc) { return tiers[sc] || BASE[sc] || BASE.m; };
      turnBox = boxFor('m');   /* the turn button is a medium drawer object */
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
           scale (bar fill), the scale size, and the file url */
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
        /* the artwork's identity for the shared display frame — the SAME
           string the report card keys its copies under (see fitView) */
        item._fit = item.id + '/' + primary.file;
        return fetch(JD_API + primary.url).then(function (r) {
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
        pile.appendChild(el);
        /* reframe BEFORE sizing: the fit needs the rendered copy (getBBox
           throws otherwise), and applySize reads aspect off the viewBox —
           the expanded frame must be what it reads. Keyed on the artwork,
           under the SAME key the report card files its copies under, so the
           pile and the card cannot disagree about the frame. See fitView. */
        fitView(el.querySelector('svg'), item._fit);
        /* size: area-normalized on the shared ruler (--w still carries WIDTH;
           the CSS contract is unchanged) — see applySize above */
        applySize(el, item._box, item.id,
          (typeof item.sizeScale === 'number' && item.sizeScale > 0) ? item.sizeScale : 1);
        return el;
      });
      /* positions are computed, never authored — see SCATTER above. One layout
         per session; applied in the same tick so nothing paints un-placed. */
      var layout = layoutFor(els);
      var hostR = pile.getBoundingClientRect();
      var HW = hostR.width || 1, HH = hostR.height || 1, HM = Math.min(HW, HH);
      els.forEach(function (el) {
        var p = layout[el.dataset.id];
        /* pushed clear of the turn button's reserved corner at apply time —
           see turnRect above; the stored scatter itself is left alone.
           The half-sizes are the item's ROTATED bounding box (its scatter
           angle is known here): an unrotated box lets a tilted item's
           corner reach ~15px onto the plate at ±34°. */
        var wpx = (parseFloat(el.style.getPropertyValue('--w')) || BASE.m) / 100 * HM;
        var hpx = wpx / svgAspect(el);
        var rad = (p.rot || 0) * Math.PI / 180;
        var c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
        var a = avoidTurn(p.x, p.y,
          Math.min(0.5, (wpx * c + hpx * s) / 2 / HW),
          Math.min(0.5, (wpx * s + hpx * c) / 2 / HH), HW, HH, HM);
        el.style.left = (a.x * 100) + '%';
        el.style.top = (a.y * 100) + '%';
        el.style.setProperty('--rot', p.rot + 'deg');
        el.style.zIndex = p.z;
      });
      if (window.JD_wirePile) window.JD_wirePile();
      /* the drawer's own hardware goes in on top of the collection: the
         Take-a-Turn button, sized on the tier box just resolved. It is not
         an entry and never was — see the turn-object module below. */
      if (window.JD_turnObject) window.JD_turnObject.ready(turnBox);
      /* …and the instructions sheet, on the xl ruler — furniture in the
         same tradition (see the sheet module below) */
      if (window.JD_sheet) window.JD_sheet.ready(boxFor('xl'));
      /* …and the analytics folder, on the l ruler — the third piece of
         furniture, same tradition (see the folder module below) */
      if (window.JD_folder) window.JD_folder.ready(boxFor('l'));
      /* hand the record module the payload + the primary SVG texts, so a
         record opens with zero extra requests */
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
      }
      /* the turn modal renders its survey from this same taxonomy, and
         restores any items this visitor has already won into the pile now
         that the curated items are placed and wired (C5.4 step 8) */
      if (window.JD_turn) window.JD_turn.setData(payloadRef);
      /* ONLY NOW the #<id> deep link. openFromHash resolves the id against
         payload.items and silently does nothing if it isn't there yet, and
         the visitor's own won items are appended to that list by the call
         above — so checking the hash first meant a reload on #<gen_id> never
         opened the card and left the stale hash sitting in the URL. Curated
         ids are in the payload from the fetch and are unaffected by the
         move; JD_turn.setData is synchronous, so nothing else changes. */
      if (window.JD_record && location.hash.length > 1) {
        window.JD_record.openFromHash();
      }
      /* ?rerun=<item_id> — the rating bench opens the drawer here to re-issue
         a curated item's prompt to the four current models. Handled beside the
         #<id> deep link and for the same reason: it resolves an id against
         payload.items, so it can only run once the payload is in. The bench
         cannot host this itself — the whole point is that a rerun is an
         ordinary turn, and the turn flow lives here. The param is consumed
         from the URL so a refresh does not spend a second generation. */
      var rr = /[?&]rerun=([^&]+)/.exec(location.search);
      if (rr && window.JD_turn) {
        var wanted = decodeURIComponent(rr[1]);
        var item = null;
        for (var ri = 0; ri < payloadRef.items.length; ri++) {
          if (payloadRef.items[ri].id === wanted) { item = payloadRef.items[ri]; break; }
        }
        try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
        if (item && item.prompt) {
          window.JD_turn.rerun(item.prompt);
        } else {
          console.warn('rerun: no such item, or it carries no prompt:', wanted);
        }
      }
    })
    .catch(function (err) {
      fallbackNote();
      /* the collection is what failed, not the drawer: the turn object is
         frontend-injected and owes data.php nothing, and it is the only
         trigger there is now — so it still goes in, on the fallback tier box.
         The instructions sheet rides the same rule. */
      if (window.JD_turnObject) window.JD_turnObject.ready(null);
      if (window.JD_sheet) window.JD_sheet.ready(null);
      /* the folder likewise: its numbers come from jd-analytics.php, which
         data.php's failure says nothing about */
      if (window.JD_folder) window.JD_folder.ready(null);
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
    /* the turn button is FIXED hardware (owner revision, 2026-08-10): it still
       becomes `held` — the pointerup press path requires it — but it never
       lifts, so no is-held shadow and no grip haptic (press() buzzes) */
    if (item.dataset.turn === 'object') return;
    item.classList.remove('is-lifted');          /* releases the demo pin */
    item.classList.add('is-held');
    JD_haptic('grip');       /* Android only; a silent no-op everywhere else */
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

  /* The tag is built with innerHTML, and since C5 a pile item's dataset can
     carry a VISITOR's own words (their prompt is the specimen name of an item
     they won). Everything interpolated below is therefore escaped — the
     dataset is no longer repo-controlled. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* The grade meter: the same segmented bar gauge as the report card —
     rank/steps of the track filled in the grade's ink, with paper-colored
     dividers (the tag's #e8d9a8) drawn OVER the fill, battery-style, so
     the segments stay visible even at 100%. rank === null draws the empty
     track with faint ink dividers: an abstention, not a verdict. The fill
     has to be absent rather than parked at one segment, because a bar
     filled to the first segment is a legible reading — "graded, and graded
     worst" — and that is the one thing an ungraded specimen must not say.
     Width is unchanged either way (fixed 88px box, 66px track — the tag's
     wrap math depends on it) so the layout doesn't shift between a graded
     and an ungraded specimen. */
  function meterSVG(rank, steps) {
    var span = 66, x0 = 2, y = 2, h = 9;
    /* worst → best, matched to the report card's rc-g1..5 ramp */
    var RAMP = ['#8f1d12', '#b0490f', '#a06200', '#46761a', '#0b6a1f'];
    var graded = rank !== null;
    var color = 'rgba(58,42,18,0.55)', fill = '';
    if (graded) {
      var full = Math.max(1, Math.min(steps, rank));
      color = RAMP[steps > 1 ? Math.round((full - 1) / (steps - 1) * 4) : 4];
      fill = '<rect x="' + x0 + '" y="' + y + '" width="' +
        (span * full / steps).toFixed(1) + '" height="' + h +
        '" fill="' + color + '"/>';
    }
    var ticks = '';
    for (var t = 1; t < steps; t++) {
      var tx = (x0 + span * t / steps).toFixed(1);
      ticks += '<line x1="' + tx + '" y1="' + y + '" x2="' + tx +
        '" y2="' + (y + h) + '" stroke="' +
        (graded ? '#e8d9a8' : 'rgba(58,42,18,0.3)') + '" stroke-width="1.5"/>';
    }
    return '<svg width="88" height="14" viewBox="-9 0 88 14" role="img" ' +
      'aria-label="' + (graded ? 'grade ' + rank + ' of ' + steps
        : 'not graded') + '">' +
      '<defs><clipPath id="jd-meterclip"><rect x="' + x0 + '" y="' + y +
      '" width="' + span + '" height="' + h + '" rx="2"/></clipPath></defs>' +
      '<g clip-path="url(#jd-meterclip)">' + fill + ticks + '</g>' +
      '<rect x="' + x0 + '" y="' + y + '" width="' + span + '" height="' + h +
      '" rx="2" fill="none" stroke="' + color + '" stroke-width="1.5"/>' +
      '</svg>';
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
    SLACK: 1.14,      /* rest length as a multiple of the span at pin time.
                         Was 1.25, then 1.17; the excess took another ~20%
                         cut (owner, 2026-08-11) with MIN_REST and the seat
                         gaps — original note: shortened with the seat gaps
                         (owner request, 2026-08-10: the string reads about
                         two-thirds its former length); the surplus that hangs
                         as dangle is what this dial actually sets */
    MIN_REST: 32,     /* px — the shortest string we will ever hang (60→40→32) */
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
     march from the grommet toward the item and stop at the first painted
     pixel (ropeAnchor below, which fans several rays so a concave object
     can't hide behind its own hole). The tip is then on ink by construction,
     whatever shape the item is, and almost the whole chain hangs in the open
     where its sag can be seen.

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
    if (graze) { ropeOffX = graze.v.x; ropeOffY = graze.v.y; }
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
  /* the turn object dismisses the selection before it opens the modal, from
     both the pointer and the keyboard press — and it lives outside this IIFE */
  window.JD_hideTag = hideTag;
  /* the instructions sheet's keyboard path (Enter/Space on the wrapper)
     picks through the same door the tap does — see the sheet module */
  window.JD_pick = pick;

  /* An item lying against a wall zooms straight into the well's
     overflow:hidden and gets a slice shaved off it — the skeleton key lost
     the end of its shaft, the succulent the top of its leaves (testing
     report, 2026-08-09). Selecting a specimen is picking it UP to look at
     it, so before the zoom runs, slide it just far enough off the wall that
     its enlarged self fits. Done once, as a baked left/top in % exactly like
     settle()'s, so it costs one layout move and nothing downstream knows the
     difference; the item keeps the new spot after dismissal, the way an
     object you moved to see better stays where you put it.
     Two limits: an item too big for the well in a given axis is left alone
     in that axis (there is no position that helps), and the slide is capped,
     because the move is instant while the zoom eases — a tap must never fling
     an object across the drawer out from under the finger that chose it. The
     cap is generous next to the shaves it was written for (~14px), but one of
     the XL items jammed into a corner can still keep a sliver behind the
     wall; that is the deliberate trade. */
  var NUDGE_MAX = 48;
  function nudgeIntoWell(item) {
    var w = well.getBoundingClientRect(), r = item.getBoundingClientRect();
    var zoom = parseFloat(getComputedStyle(item)
      .getPropertyValue('--pick-scale')) || 1;
    var hw = zoom * r.width / 2 + 2, hh = zoom * r.height / 2 + 2;
    var cx = r.left + r.width / 2 - w.left, cy = r.top + r.height / 2 - w.top;
    var dx = hw * 2 > w.width ? 0
      : Math.max(hw, Math.min(w.width - hw, cx)) - cx;
    var dy = hh * 2 > w.height ? 0
      : Math.max(hh, Math.min(w.height - hh, cy)) - cy;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    dx = Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, dx));
    dy = Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, dy));
    item.style.left = ((cx + dx) / w.width * 100).toFixed(2) + '%';
    item.style.top = ((cy + dy) / w.height * 100).toFixed(2) + '%';
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
    /* THE INSTRUCTIONS SHEET reads bare (owner, 2026-08-28): the same
       in-place zoom-and-straighten as any pick — hoisted, upright,
       ×--pick-scale, the pile dimmed behind it — with no specimen tag and
       no elastic, because the words on it ARE the paperwork. Nudged into
       the well like every pick so the enlarged sheet can't hang past the
       wall; every standard dismissal (tap away, Esc, resize, hideTag)
       puts it back exactly as it puts back a specimen. */
    if (item.dataset.sheet) { nudgeIntoWell(item); return; }
    if (!tag) buildTag();

    var d = item.dataset;
    /* GRADE, three states, read straight off the dataset — one code path for
       every specimen in the well:
       · data-rank a number → filed grade, the bar filled to it.
         Curated items ALWAYS land here: the loader writes a number (0 when
         the grade doesn't resolve), so their reading is untouched.
       · data-rank empty → the visitor skipped the grade step, and there is
         no verdict to show. Blank label + a bar filled to one segment read
         as a filed worst-grade, so it says UNGRADED over an empty track.
       data-card="none" is the other dataset switch: see dropIntoPile. */
    var ranked = !!d.rank;
    tag.setAttribute('aria-label', 'specimen tag: ' + (d.title || ''));
    tag.innerHTML =
      /* PRESSED & FILED (round 12, mockup-12a, owner pick 2026-08-12): three
         ruled registers — name / filing grid / button bar. The name has a
         fixed width to wrap inside (two lines reserved); MODEL and GRADE
         share one label column so the values align on a common left edge.
         (The filed SIZE and the DATE used to ride the tag too — both dropped
         at the owner's request, 2026-08-12; the report card still shows
         them.) */
      '<div class="name">' + esc((d.title || '').toUpperCase()) + '</div>' +
      '<div class="rows">' +
      '<div class="row"><span class="lab">MODEL</span><span class="val">' +
      esc((d.model || '').toUpperCase()) + '</span></div>' +
      '<div class="row row--grade"><span class="lab">GRADE</span>' +
      '<span class="val g' + (ranked ? '' : ' none') + '">' +
      (ranked ? esc((d.grade || '').toUpperCase()) : 'UNGRADED') + '</span>' +
      meterSVG(ranked ? (+d.rank || 1) : null, +d.steps || 5) +
      '</div></div>' +
      '<div class="btns">' +
      '<a class="btn" href="' + esc(d.url || '') + '" download="' + esc(d.id || '') + '.svg" ' +
      'title="download the SVG as generated">DOWNLOAD SVG ⤓</a>' +
      (d.card === 'none' ? '' :
        '<a class="btn jd-fullrecord" href="#' + esc(d.id || '') + '" title="open the report card">REPORT CARD →</a>') +
      '</div>';
    var fr = tag.querySelector('.jd-fullrecord');
    if (fr) fr.addEventListener('click', function (e) {
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
    nudgeIntoWell(item);      /* before measuring — it may move the item */
    var w = well.getBoundingClientRect(), r = item.getBoundingClientRect();
    var zoom = parseFloat(getComputedStyle(item)
      .getPropertyValue('--pick-scale')) || 1;
    var vh = zoom * r.height;
    var cx = r.left + r.width / 2 - w.left, cy = r.top + r.height / 2 - w.top;
    var vTop = cy - vh / 2, vBottom = cy + vh / 2;
    var ay = vBottom - 6;                        /* foot of the predicted extent */
    tag.classList.add('is-on');                  /* measurable before placing */
    var tw = tag.offsetWidth, th = tag.offsetHeight;
    /* seat gaps trimmed 26→17 / 20→13 (owner request, 2026-08-10), then
       17→14 / 13→10 with the second ~20% cut (owner, 2026-08-11): the tag
       sits closer so the string's span — the part of its length no slack
       dial can shorten — comes down with the ROPE constants */
    var below = ay + 14 + th < w.height - 8;
    var ty = below ? ay + 14 : (vTop - 10 - th);
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
      /* 110→80 / 0.62→0.48 with the shorter string (2026-08-10), then
         80→64 / 0.48→0.38 with the second cut (2026-08-11): less slack
         means a smaller belly to swing clear, so the lean scales with it —
         the zoomed-width floor is geometry and stays */
      var lean = Math.max(64, 0.38 * (cy - (ty + th / 2)), zoom * r.width + 40);
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
    if (JD_layerOpen()) return;
    if (!e.target.closest || !e.target.closest('.jd-item, .jd-itemtag')) hideTag();
  });
  window.addEventListener('keydown', function (e) {
    if (JD_layerOpen()) return;
    if (e.key === 'Escape') hideTag();
  });
  window.addEventListener('resize', function () {
    if (JD_layerOpen()) return;
    hideTag();
  });
  var dropX = 0, dropY = 0;
  /* drag moves are TRANSFORM-only (--dx/--dy): moving a filtered element via
     left/top forces layout repaints, and Blink leaves stale drop-shadow
     trails behind the old positions. The final spot is baked into left/top
     once, at settle, when the element is at rest. */
  function place(item, x, y) {
    /* fixed hardware does not travel: an attempted drag of the turn button
       moves nothing (and pointerup will see drag=true, so it won't press
       either — an aborted drag is not a tap) */
    if (item.dataset.turn === 'object') return;
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
    /* the turn button settles into nothing: it never moved (place() refuses),
       it keeps its fixed z instead of riding zTop, and it gets no landing
       jostle — its seat is not the visitor's to change any more */
    if (item.dataset.turn === 'object') {
      item.style.removeProperty('--dx');
      item.style.removeProperty('--dy');
      return;
    }
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
      /* the turn modal opens a beat AFTER the turn button press so the press can
         be seen (OPEN_MS). Grabbing something else inside that beat means the
         visitor has moved on — stand the pending open down, or the modal pops
         on top of a drag that is still in flight.
         The turn button's OWN re-grip is exempt HERE and handled at the drag
         threshold instead (see pointermove): standing down on its pointerdown
         would break the fast double-tap, because press() debounces at 150ms
         and returns early without re-arming — the second tap would cancel the
         first tap's open and then decline to schedule its own, swallowing the
         modal entirely. A re-grip only has to cancel once it stops being a
         tap. */
      if (item.dataset.turn !== 'object' &&
          window.JD_turnObject && window.JD_turnObject.standDown) {
        window.JD_turnObject.standDown();
      }
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
        if (!drag && dx * dx + dy * dy > tapSlop * tapSlop) {
          drag = true;
          /* the turn button cancelling its own pending open, at the exact moment
             this gesture stops being a tap. A re-grip that becomes a DRAG
             never reaches press(), so without this the previous tap's
             openTimer would still fire. The button itself no longer travels
             (place() refuses fixed hardware), but the principle stands: a
             gesture that outgrew the slop is not a tap, and must not open
             the modal. Deliberately here and not on pointerdown — see the
             note there. */
          if (item.dataset.turn === 'object' &&
              window.JD_turnObject && window.JD_turnObject.standDown) {
            window.JD_turnObject.standDown();
          }
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
        /* press-release without a drag = tap. For a specimen that is pick();
           for the drawer's one piece of HARDWARE (the Take-a-Turn button,
           flagged data-turn) it is a PRESS instead — no specimen tag, no
           report card, because it is not collection. Everything before this
           line is identical for both: same grip, same drag, same settle. */
        if (!drag) {
          if (item.dataset.turn === 'object') {
            /* press() dismisses any live specimen tag itself, on both the
               pointer and the keyboard path — see the turn-object module */
            if (window.JD_turnObject) window.JD_turnObject.press();
          } else if (item.dataset.sheet) {
            /* the instructions sheet: tap = larger (a bare pick — see the
               data-sheet branch in pick()), tap again = back down. Tapping
               away, Esc and resize already put it back via hideTag. */
            if (item === picked) hideTag();
            else pick(item);
          } else if (item.dataset.folder) {
            /* the analytics folder: a tap OPENS it into its dialog. No pick,
               no specimen tag, no report card — it is not collection either,
               and what is inside it is a dashboard, not an object. */
            if (window.JD_folder) window.JD_folder.open();
          } else {
            pick(item);
          }
        }
      }
      pend = held = null; drag = false; twist = null;
    });
    item.addEventListener('pointercancel', function (e) {
      if (e.pointerId !== pid) return;
      if (held === item) settle(item, drag);
      pend = held = null; drag = false; twist = null;
    });
  }
  /* idempotent: a won item is appended to the pile long after load and calls
     this again, so already-wired items must not collect a second set of
     listeners (which would grip and pick twice per press) */
  window.JD_wirePile = function () {
    well.querySelectorAll('.jd-item:not([data-wired])').forEach(function (item) {
      item.setAttribute('data-wired', '');
      wireItem(item);
    });
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
    if (item.dataset.turn === 'object') return;  /* fixed hardware: no rotation */
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
    if (held.dataset.turn === 'object') return;  /* fixed hardware */
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
    if (held.dataset.turn === 'object') return;  /* fixed hardware */
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
    /* :not([data-turn]):not([data-sheet]) — the turn button and the
       instructions sheet are furniture, not specimens, and this readout is
       a list of where the COLLECTION is lying */
    well.querySelectorAll('.jd-item:not([data-turn]):not([data-sheet])').forEach(function (item) {
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

  /* The artwork is a served asset like the stylesheet and this script, so it
     is cache-busted like them: index.php lists it in $jd_assets (which also
     puts it inside the footer's build fingerprint and 'deployed' mtime, so an
     art-only edit moves the human-checkable stamp) and stamps the content
     hash onto this script's tag. The bare path is the fallback for a host
     that didn't — a dev harness or a mockup page — where a stale copy costs
     nothing. */
  function assetUrl() {
    var tag = document.querySelector('script[data-jd-turn-object]');
    var v = tag && tag.getAttribute('data-jd-turn-object');
    return ASSET + (v ? '?v=' + encodeURIComponent(v) : '');
  }

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
     trigger must not queue behind the collection. It is also RETRIED twice
     before giving up (a flaky first request on a phone shouldn't cost the
     visitor the feature), and whatever happens the object gets BUILT: out of
     tries, it is built on FALLBACK_ART instead. */
  var RETRY_MS = [600, 1800];
  function loadArt(tries) {
    fetch(JD_API + assetUrl())
      .then(function (r) {
        if (!r.ok) throw new Error(ASSET + ' ' + r.status);
        return r.text();
      })
      .then(function (text) {
        /* a captive-portal login page or an HTML 404 body served with 200
           would otherwise be injected as the turn button */
        if (text.indexOf('<svg') < 0) throw new Error(ASSET + ' is not an SVG');
        art = text; build();
      })
      .catch(function (err) {
        if (tries < RETRY_MS.length) {
          window.setTimeout(function () { loadArt(tries + 1); }, RETRY_MS[tries]);
          return;
        }
        /* worth saying out loud rather than failing silently — the drawer is
           now wearing the understudy */
        if (window.console && console.warn) {
          console.warn('junk drawer: the turn object did not load (' +
            err.message + ') — falling back to the inline plate');
        }
        art = FALLBACK_ART; build();
      });
  }
  loadArt(0);

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

  /* cache-busted exactly as the turn object's artwork is — the hash rides
     the script tag because there is no <link> or <img> to hang it on */
  function assetUrl() {
    var tag = document.querySelector('script[data-jd-instructions]');
    var v = tag && tag.getAttribute('data-jd-instructions');
    return ASSET + (v ? '?v=' + encodeURIComponent(v) : '');
  }

  /* retried like the turn object's fetch, but with NO inline fallback: a
     drawer without its instructions still works — the sheet is furniture,
     not the feature — so a failed deploy just leaves the pile one scrap
     lighter and says so in the console. */
  var RETRY_MS = [600, 1800];
  function loadArt(tries) {
    fetch(JD_API + assetUrl())
      .then(function (r) {
        if (!r.ok) throw new Error(ASSET + ' ' + r.status);
        return r.text();
      })
      .then(function (text) {
        if (text.indexOf('<svg') < 0) throw new Error(ASSET + ' is not an SVG');
        art = text; build();
      })
      .catch(function (err) {
        if (tries < RETRY_MS.length) {
          window.setTimeout(function () { loadArt(tries + 1); }, RETRY_MS[tries]);
          return;
        }
        if (window.console && console.warn) {
          console.warn('junk drawer: the instructions sheet did not load (' +
            err.message + ')');
        }
      });
  }
  loadArt(0);

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

  /* every module in this file carries its own — the interpolations below are
     model labels and axis labels out of a JSON payload, and they go into both
     markup and SVG attribute values */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* cache-busted exactly as the turn object's and the sheet's artwork are —
     the hash rides the script tag because there is no <link> or <img> to
     hang it on */
  function assetUrl() {
    var tag = document.querySelector('script[data-jd-analytics]');
    var v = tag && tag.getAttribute('data-jd-analytics');
    return ASSET + (v ? '?v=' + encodeURIComponent(v) : '');
  }

  /* retried like the sheet's fetch, and with NO inline fallback for the same
     reason: a drawer without its folder still works — the numbers are a
     curiosity, not the feature — so a failed deploy leaves the pile one
     object lighter and says so in the console. */
  var RETRY_MS = [600, 1800];
  function loadArt(tries) {
    fetch(JD_API + assetUrl())
      .then(function (r) {
        if (!r.ok) throw new Error(ASSET + ' ' + r.status);
        return r.text();
      })
      .then(function (text) {
        if (text.indexOf('<svg') < 0) throw new Error(ASSET + ' is not an SVG');
        art = text; build();
      })
      .catch(function (err) {
        if (tries < RETRY_MS.length) {
          window.setTimeout(function () { loadArt(tries + 1); }, RETRY_MS[tries]);
          return;
        }
        if (window.console && console.warn) {
          console.warn('junk drawer: the analytics folder did not load (' +
            err.message + ')');
        }
      });
  }
  if (!BENCHED) loadArt(0);

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
        'turns; ratings count the current rubric only; spend includes the ' +
        'curated bench — counted ' +
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
   Inlined SVG copies are id-prefixed (plate jrN_, thumbs jtN_, enlargement
   jzN_) so they can never collide with the pile's inlined primaries or each
   other. Pressing the artwork plate ENLARGES it over the card; that layer is
   a second dismissable thing inside one dialog, so Escape peels the
   enlargement before the card (see the keydown handler at the foot). */
/* ============================================================================
   THE DRAW-ON ENGINE — window.JD_drawOn(svg, opts)
   Animates an inlined SVG as if it were being drawn: every element plays in
   DOCUMENT ORDER — the order the generating model actually emitted the
   shapes — so the reveal is a small replay of the generation, provenance as
   motion rather than a canned wipe. Stroked paths draw along their measured
   length (the dasharray trick); filled shapes fade in once their outline is
   mostly down; pre-dashed strokes and unmeasurables (text, use) fall back
   to a fade. Each element's share of the run scales with the square root of
   its length, so one long spine can't starve the small bones.
   Two customers: the report card's plate (open / response flip / REPLAY)
   and the turn's reveal, where the fresh drawings' first appearance is the
   whole point. opts: { force: play even under prefers-reduced-motion — an
   explicit request is not ambient animation; secs: run length — omit it
   and the run is paced by the DRAWING (below) }. Returns the seconds the
   run will take (truthy), or false if it didn't play. The inline
   animation styles are stripped when the run ends, so the DOM goes back
   to exactly what was rendered; overlapping runs on one svg settle by a
   sequence stamp on the element — the newer run owns the artwork.
   Keyframes live in junk-drawer.css beside .rc-plate-art.

   PACING (owner rev, 2026-08-16 — "simple objects drew in slow motion"):
   a fixed run length made every drawing finish in the same time, so a
   one-path paperclip crawled while a 600-element portrait sprinted. The
   default now models a hand moving at constant speed: the run length is
   total measured ink (every element's length, min-clamped) divided by
   the artwork's viewBox diagonal — a scale-free "diagonals of ink"
   number — drawn at WORK_RATE diagonals/second, clamped to
   [SECS_MIN, SECS_MAX] so a two-stroke doodle still registers and a
   monster can't run half a minute. Calibrated on the live items:
   paperclip work≈3 → 1.2s, fish skeleton ≈5 → 1.6s, subway rat ≈9 →
   3.0s, crystal ball ≈25 and up → the 4.2s cap. */
(function () {
  var SEL = 'path,line,polyline,polygon,circle,ellipse,rect,text,use';
  var SKIP = 'defs,clipPath,mask,pattern,linearGradient,radialGradient,' +
    'symbol,marker';
  var WORK_RATE = 3, SECS_MIN = 1.2, SECS_MAX = 4.2;
  var seq = 0;
  function strip(svg) {
    if (!svg || !document.contains(svg)) return;
    var els = svg.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) {
      els[i].style.animation = '';
      els[i].style.strokeDasharray = '';
      els[i].style.strokeDashoffset = '';
      els[i].style.removeProperty('--jdfo');
      els[i].style.removeProperty('--jdo');
    }
  }
  window.JD_drawOn = function (svg, opts) {
    opts = opts || {};
    var reduce = false;
    try {
      reduce = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}
    if (!svg || (reduce && !opts.force)) return false;
    var els = svg.querySelectorAll(SEL);
    var items = [], i, el, cs, L, stroked, filled, ink = 0;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      if (el.closest && el.closest(SKIP)) continue;
      cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      L = 0;
      try { if (el.getTotalLength) L = el.getTotalLength(); } catch (e) {}
      stroked = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 &&
        parseFloat(cs.strokeOpacity) > 0 && cs.strokeDasharray === 'none' &&
        L > 0;
      filled = cs.fill !== 'none' && parseFloat(cs.fillOpacity) > 0;
      if (!stroked && !filled) continue;
      items.push({ el: el, L: Math.max(L, 4), stroked: stroked,
        filled: filled, fo: cs.fillOpacity, op: cs.opacity });
      ink += Math.max(L, 4);
    }
    var secs = opts.secs;
    if (!secs) {
      /* pace by the drawing, not the clock (see PACING above). The
         diagonal comes from the declared viewBox — the same frame the
         lengths are measured in; a viewBox-less artwork (none in the
         collection, but the validator doesn't forbid it) falls back to
         its rendered bounding box. */
      var diag = 0;
      var vb = svg.viewBox && svg.viewBox.baseVal;
      if (vb && vb.width > 0) {
        diag = Math.sqrt(vb.width * vb.width + vb.height * vb.height);
      } else {
        try {
          var bb = svg.getBBox();
          diag = Math.sqrt(bb.width * bb.width + bb.height * bb.height);
        } catch (e) {}
      }
      var work = diag > 0 ? ink / diag : 0;
      secs = Math.min(SECS_MAX, Math.max(SECS_MIN, work / WORK_RATE));
    }
    var totalW = 0;
    for (i = 0; i < items.length; i++) totalW += Math.sqrt(items[i].L);
    var acc = 0, my = ++seq;
    svg.__jdDrawSeq = my;
    for (i = 0; i < items.length; i++) {
      var it = items[i];
      var w = Math.sqrt(it.L) / (totalW || 1);
      /* starts pack into the first 90% so the tail still finishes inside
         the run; durations get 1.7x their share, overlapping neighbours
         the way a hand keeps moving before the last stroke dries */
      var startF = acc * 0.9;
      acc += w;
      var durF = Math.min(w * 1.7, 1 - startF);
      var start = startF * secs;
      var dur = Math.max(durF * secs, 0.12);
      if (it.stroked) {
        it.el.style.strokeDasharray = it.L;
        it.el.style.strokeDashoffset = it.L;
        var a = 'jdDrawOn ' + dur.toFixed(3) + 's ease-out ' +
          start.toFixed(3) + 's 1 both';
        if (it.filled) {
          it.el.style.setProperty('--jdfo', it.fo);
          a += ', jdFillOn ' + Math.max(dur * 0.6, 0.15).toFixed(3) +
            's ease-in ' + (start + dur * 0.45).toFixed(3) + 's 1 both';
        }
        it.el.style.animation = a;
      } else {
        it.el.style.setProperty('--jdo', it.op);
        it.el.style.animation = 'jdFadeOn ' +
          Math.max(dur * 0.8, 0.15).toFixed(3) + 's ease-in ' +
          start.toFixed(3) + 's 1 both';
      }
    }
    /* put the artwork back to plain rendered state once the run is over;
       a newer run on the same svg owns it instead */
    setTimeout(function () {
      if (svg.__jdDrawSeq === my) strip(svg);
    }, (secs + 0.4) * 1000);
    return secs;
  };
})();

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
  var zoomEl = null, zoomOn = false, zoomFrom = null;
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
        var calm = window.matchMedia
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  /* The layer hangs off <body>, not off the scrim. The scrim's z-index makes
     it a stacking context, so a child of it can never paint above the fixed
     site banner however high its own z-index — and the enlargement has to
     cover the whole viewport to be worth doing (see junk-drawer.css). Being
     outside the scrim also keeps these presses away from the scrim's
     click-to-close-the-card: the card stays put underneath. */
  function buildZoom() {
    if (zoomEl) return;
    zoomEl = document.createElement('div');
    zoomEl.className = 'jd-record-zoom';
    /* it must be a dialog in its own right: the card carries aria-modal, so
       assistive tech ignores everything outside the card — and this layer,
       living on <body>, is outside it. Focus moves in here on open, which is
       what scopes AT to this dialog rather than the card behind it. */
    zoomEl.setAttribute('role', 'dialog');
    zoomEl.setAttribute('aria-modal', 'true');
    zoomEl.setAttribute('aria-label', 'enlarged artwork');
    document.body.appendChild(zoomEl);
    /* one dismissal path for every press inside the layer — the artwork
       itself ("click it again"), the caption, or the dark surround
       ("click outside it"). All three mean: put it back. */
    zoomEl.addEventListener('click', function () { closeZoom(); });
    zoomEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      closeZoom();
    });
  }

  /* fill (or refill) the layer from whatever response the card is showing —
     called on open and again whenever the card re-renders under it, so the
     enlargement can never drift onto a stale response */
  function syncZoom() {
    if (!zoomOn || !zoomEl || !curEntry) return;
    var resp = curEntry.responses[curResp] || curEntry.responses[0];
    zoomEl.innerHTML = zoomHTML(curEntry, resp, curResp);
    /* the zoom re-inlines the same svg string, so it needs its own reframe —
       fitted before zoomGridScale measures the figure. Same artwork key as
       the plate, so the enlargement is the plate's drawing, held closer. */
    if (window.JD_fitAll) window.JD_fitAll(zoomEl);
    zoomGridScale();
  }

  /* the print's grid grows with the print (owner, 2026-08-14): the
     enlargement is the same photograph held closer, so its graph squares
     — and rule weights — scale by the factor the paper itself grew. The
     factor is measured, not assumed: fig width over plate width, fed to
     the gradient math on .rc-zoom-fig via --gk. Skips silently while the
     layer is display:none (rects are 0 there); openZoom re-runs it once
     the layer is up. */
  function zoomGridScale() {
    if (!zoomOn || !zoomEl || !scrollEl) return;
    var pl = scrollEl.querySelector('.rc-plate');
    var fig = zoomEl.querySelector('.rc-zoom-fig');
    if (!pl || !fig) return;
    var pw = pl.getBoundingClientRect().width;
    var fw = fig.getBoundingClientRect().width;
    if (pw > 0 && fw > 0) fig.style.setProperty('--gk', (fw / pw).toFixed(3));
  }

  function openZoom(from) {
    if (!isOpen || zoomOn || !curEntry) return;
    buildZoom();
    zoomOn = true;
    zoomFrom = from || null;
    syncZoom();
    zoomEl.classList.add('is-on');
    /* syncZoom's own fit ran while the layer was still display:none, where
       getBBox has nothing to measure — the reframe only counts once the
       layer is up, the same reason zoomGridScale re-runs here. (A frame
       already filed for this artwork is applied without measuring at all,
       so this is usually a no-op that costs nothing.) */
    if (window.JD_fitAll) window.JD_fitAll(zoomEl);
    zoomGridScale();
    /* focus follows the artwork so Space/Enter/Esc all land here, and so a
       keyboard visitor isn't left tabbing the card hidden behind the layer */
    var fig = zoomEl.querySelector('.rc-zoom-fig');
    if (fig) { try { fig.focus(); } catch (e) {} }
    /* deliberately NOT tracked: the enlargement is a toggle, and the events
       endpoint's allowlist doesn't carry this page anyway (item_open above
       is the one call the module makes, and it is already the exception) */
  }

  /* `silent` closes without handing focus back — used when the whole card is
     going away and the plate we came from is about to be hidden anyway */
  function closeZoom(silent) {
    if (!zoomOn) return;
    zoomOn = false;
    if (zoomEl) { zoomEl.classList.remove('is-on'); zoomEl.innerHTML = ''; }
    var back = zoomFrom;
    zoomFrom = null;
    if (!silent && back && document.contains(back)) {
      try { back.focus(); } catch (e) {}
    }
  }

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
    if (zoomOn) {
      syncZoom();
      zoomFrom = scrollEl.querySelector('.rc-plate');
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
    if (zoomOn) { closeZoom(); return; }
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
    if (zoomOn) { closeZoom(); return; }
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
    jdDriftMount(bodyEl);
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
  /* a fresh plotted circuit for slot A (round 18, owner pick 2026-08-17):
     a random spanning tree over a 5×3 grid of cells, then the closed tour
     that walks the fine 10×6 lattice around it — the classic plotter-art
     construction. Every intersection is visited exactly once, the line
     never crosses itself, and it ends where it began, so the CSS dash loop
     is seamless. ~1,242 distinct circuits observed over 2,000 seeds; the
     seed is the turn's client_ref, so every TURN draws a different circuit
     while repaints and restored turns re-derive the same one (paintSlots
     never rewrites a pending swatch, but the guarantee costs nothing).
     Geometry: 9px pitch + 4.5px margin = viewBox 0 0 90 54, and pathLength
     100 normalizes the dash arithmetic no matter where the turns fall. */
  function darkPlotCircuit(seed) {
    var CW = 5, CH = 3, PITCH = 9, MARGIN = 4.5;
    /* FNV-1a fold of the seed, then xorshift32 — tiny, seedable, plenty */
    var h = 2166136261 >>> 0, i;
    for (i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    if (!h) h = 88172645; /* xorshift must never sit at zero */
    function rnd() {
      h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
      return h / 4294967296;
    }
    /* randomized DFS spanning tree over the coarse cells; conn[cell] is a
       4-bit mask of tree edges: 1 up, 2 right, 4 down, 8 left */
    var conn = [], seen = [], stack = [], c, n, k;
    for (i = 0; i < CW * CH; i++) { conn.push(0); seen.push(false); }
    c = (rnd() * CW * CH) | 0;
    seen[c] = true; stack.push(c);
    while (stack.length) {
      c = stack[stack.length - 1];
      var cx = c % CW, cy = (c / CW) | 0, opts = [];
      if (cy > 0      && !seen[c - CW]) opts.push([c - CW, 1, 4]);
      if (cx < CW - 1 && !seen[c + 1])  opts.push([c + 1, 2, 8]);
      if (cy < CH - 1 && !seen[c + CW]) opts.push([c + CW, 4, 1]);
      if (cx > 0      && !seen[c - 1])  opts.push([c - 1, 8, 2]);
      if (!opts.length) { stack.pop(); continue; }
      k = opts[(rnd() * opts.length) | 0];
      n = k[0];
      conn[c] |= k[1]; conn[n] |= k[2];
      seen[n] = true; stack.push(n);
    }
    /* walk the fine lattice clockwise around the tree: at each vertex the
       move follows from its corner of the cell and the tree's edges —
       top-left goes up if the tree does (else right), and so on around */
    var x = 0, y = 0, px = [], py = [], v = 0;
    do {
      px.push(x); py.push(y);
      var m = conn[(y >> 1) * CW + (x >> 1)], ex = x & 1, ey = y & 1;
      if (!ex && !ey)     { if (m & 1) y--; else x++; }
      else if (ex && !ey) { if (m & 2) x++; else y++; }
      else if (ex && ey)  { if (m & 4) y++; else x--; }
      else                { if (m & 8) x--; else y--; }
      v++;
    } while ((x || y) && v <= CW * CH * 4);
    /* merge straight runs so the d stays short: keep only the turns */
    var d = 'M' + (MARGIN + px[0] * PITCH) + ' ' + (MARGIN + py[0] * PITCH), j;
    for (j = 1; j < px.length; j++) {
      var a = j - 1, b = (j + 1) % px.length;
      if ((px[a] === px[j] && px[j] === px[b]) ||
          (py[a] === py[j] && py[j] === py[b])) continue;
      d += 'L' + (MARGIN + px[j] * PITCH) + ' ' + (MARGIN + py[j] * PITCH);
    }
    return d + 'Z';
  }
  /* ---- the scatterword's ink ruler (owner report, 2026-08-30) ------------
     The stray's lesson, learned again one indicator over: the flight math
     runs on each glyph's BOX, but the eye watches the INK — and a glyph box
     carries half-leading above the ascender, air under the baseline, and
     side bearings plus the 0.08em tracking's trailing space, so when the box
     turned back at the roam wall the ink still had visible air on every
     side (the owner: the letters bounce off walls they never reach). Same
     cure as darkStrayInkInsets, per GLYPH this time — an L and a dot carry
     very different ink: offscreen clones of the assembled word (real
     classes, movers stilled, font pinned to a large px so cqw can't wobble
     the probe; two clones — see below — because the baseline probes cost
     tracking space) are measured in two steps. (1) THE BOX AND ITS BASELINE come
     from the DOM: each glyph span's rect, plus a zero-size inline-block
     probe inside it — an inline-block's baseline is its bottom edge, so the
     probe pins the glyph's baseline exactly where inline layout puts it
     (the dots' line-height:0 boxes measure 0px tall; their rects still
     carry the truth). (2) THE INK comes from canvas: the glyph drawn with
     its own computed font at that DOM baseline, alpha-scanned — and here
     the scatter needs one more idea than the stray did, because its glyphs
     SPIN. A wall is a straight edge, so the only ink that can ever touch
     it is the ink's CONVEX HULL; and a spinning glyph meets the wall at a
     different hull point every bounce. So instead of four box insets, the
     ruler returns each glyph's SUPPORT FUNCTION — how far the hull reaches
     from the box centre (the transform origin the flight translates and
     spins about) in each of 72 sampled directions, in em of the glyph's
     own font-size, the currency the track is emitted in. fly() reads it at
     the glyph's spin angle at each step, which is exact tangency: the
     bbox's mostly-empty corner never inflates the hit, and the real
     nearest ink lands on the wall whatever the tumble. A 0.025em safety
     (≈ stray's 0.4px at the sizes the swatch runs) keeps antialiased edges
     off the clipped wall. On any failure this returns null and the
     scatterword falls back to the old constant roam box — never a clip. */
  function darkScatterInkReach() {
    if (darkScatterInkReach.v !== undefined) return darkScatterInkReach.v;
    darkScatterInkReach.v = null;
    try {
      var CHARS = 'LOADING...';   /* must match darkScatterword's GLYPHS */
      var SAFE = 0.025, S = 2, SN = 72, i;   /* SN: support samples, 5° apart */
      var PROBE = '<span data-p style="display:inline-block;width:0;height:0"></span>';
      /* TWO clones of the word, because the probes are not free: tracking
         (letter-spacing 0.08em) applies after every character unit — a
         zero-size inline-block probe included — so a probed glyph's box is
         one tracking unit too wide and the error walks down the word, a
         glyph's worth per glyph. Clone A is pristine (and keeps the class's
         position:absolute, which blockifies the span exactly as the live
         word is blockified — a relative override leaves it inline, whose
         rect is a different animal): its rects are the live geometry, box
         centres included. Clone B carries the probes and answers ONE
         question, per glyph: how far below the box top the baseline sits —
         a vertical, which tracking cannot touch. */
      var mkA = '', mkB = '';
      for (i = 0; i < CHARS.length; i++) {
        var open2 = '<span class="jd-dark-gl jd-dark-gl' + i +
          '" style="animation:none;transform:none">' + CHARS.charAt(i);
        mkA += open2 + '</span>';
        mkB += open2 + PROBE + '</span>';
      }
      var host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-9999px;top:0;' +
        'visibility:hidden;pointer-events:none';
      host.innerHTML =
        '<span class="jd-dark-word" style="animation:none;left:0;top:0;' +
        'transform:none;font-size:44.2px">' + mkA + '</span>' +
        '<span class="jd-dark-word" style="animation:none;left:0;top:200px;' +
        'transform:none;font-size:44.2px">' + mkB + '</span>';
      document.body.appendChild(host);
      var word = host.querySelector('.jd-dark-word');
      var baseFs = parseFloat(getComputedStyle(word).fontSize);
      var gsA = word.querySelectorAll('.jd-dark-gl');
      var gsB = host.querySelectorAll('.jd-dark-word + .jd-dark-word .jd-dark-gl');
      var out = [], cv = document.createElement('canvas');
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) { document.body.removeChild(host); return null; }
      for (i = 0; i < gsA.length; i++) {
        var g = gsA[i], gB = gsB[i], probe = gB.querySelector('[data-p]');
        var gr = g.getBoundingClientRect();
        var baseAbs = gr.top + (probe.getBoundingClientRect().top -
          gB.getBoundingClientRect().top);
        var cs = getComputedStyle(g);
        var fs = parseFloat(cs.fontSize);
        if (!(fs > 0) || !(gr.width > 0)) { out = null; break; }
        /* margins catch overhang on every side; no letter-spacing on the
           canvas — tracking pads the ADVANCE after a glyph, never its ink */
        var M = fs * 1.25;
        cv.width = Math.ceil((gr.width + 2 * M) * S);
        cv.height = Math.ceil((fs + 2 * M) * S);
        ctx.setTransform(S, 0, 0, S, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        ctx.textAlign = 'left';          /* the span's text starts at its left edge */
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#000';
        ctx.fillText(CHARS.charAt(i), M, M);   /* canvas y=M ⇔ the DOM baseline */
        var img = ctx.getImageData(0, 0, cv.width, cv.height).data;
        /* per-row ink extents — the only pixels that can sit on the hull */
        var rows = [], any = false, x, y, rw;
        for (y = 0; y < cv.height; y++) {
          rw = null;
          for (x = 0; x < cv.width; x++) {
            if (img[(y * cv.width + x) * 4 + 3] > 16) {
              if (!rw) rw = [x, x]; else rw[1] = x;
              any = true;
            }
          }
          rows.push(rw);
        }
        if (!any) { out = null; break; }
        /* hull candidate points: the outer corners of each row's extreme
           pixels, as em offsets from the BOX CENTRE — the transform origin
           the flight spins about */
        var ox = gr.left + gr.width / 2, oy = gr.top + gr.height / 2;
        var pts = [], px2, py2, k2;
        for (y = 0; y < rows.length; y++) {
          if (!rows[y]) continue;
          for (k2 = 0; k2 < 4; k2++) {
            px2 = (k2 & 1) ? rows[y][1] + 1 : rows[y][0];
            py2 = (k2 & 2) ? y + 1 : y;
            pts.push([
              (gr.left + (px2 / S - M) - ox) / fs,
              (baseAbs + (py2 / S - M) - oy) / fs
            ]);
          }
        }
        /* the support samples: farthest reach among those points in each of
           SN directions (every candidate not on the hull can never win a
           max, so no explicit hull pass is needed), PLUS the safety — an
           inflated reach is what holds the ink that hair short of the
           clipped wall (deflating it, mirrored, would slice) */
        var sup = [], j2, ux, uy, bestd, d2, p2;
        for (j2 = 0; j2 < SN; j2++) {
          ux = Math.cos(j2 * 2 * Math.PI / SN);
          uy = Math.sin(j2 * 2 * Math.PI / SN);
          bestd = -1e9;
          for (p2 = 0; p2 < pts.length; p2++) {
            d2 = pts[p2][0] * ux + pts[p2][1] * uy;
            if (d2 > bestd) bestd = d2;
          }
          sup.push(bestd + SAFE);
        }
        /* the glyph's HOME CENTRE, measured off the same clone: its box
           centre relative to the word's, in em of the word's base type.
           The scatterword's CX/CY constants were measured 2026-08-18 on
           one platform's font; the live face can seat glyphs — the dots
           especially — a few tenths of a px elsewhere, and a flight
           anchored to a stale centre carries that error into every wall
           hit. Measured here, the anchor is platform-true; the constants
           stay as the no-ruler fallback. */
        var wr2 = word.getBoundingClientRect();
        out.push({
          sup: sup,
          cx: (ox - (wr2.left + wr2.width / 2)) / baseFs,
          cy: (oy - (wr2.top + wr2.height / 2)) / baseFs
        });
      }
      document.body.removeChild(host);
      darkScatterInkReach.v = out;
      return out;
    } catch (e) { return null; }
  }
  /* the scatterword for slot C (round-22 swap, owner pick 2026-08-18; the
     Win95 segmented block progress bar retires — mockup approved with seeded
     trajectories and the 3-bang super-cycle): the word LOADING… blown apart
     and pulled back together, forever.

     OWNER TUNING, 2026-08-18, three dials moved together and nothing else:
       · the type is 15% smaller (13 → 11.05 real-scale px) against an
         UNCHANGED 140×110 flight field, so the word sits more modestly on
         the paper while the explosion still throws it across the whole
         swatch. Only CX/CY/EM moved — the roam box did not;
       · the ellipsis is inked like the rest of the word (the blue is gone;
         see the CSS) — a sizing change only as far as this file cares; and
       · the bang runs at the 6s "house tempo" the owner picked off the
         variant sheet, up from the 4.2s "hard bang": a longer hold, a
         gentler impulse (V0 260 not 385) over a longer drag time (TAU 0.30
         not 0.24), lazier CURL, half the SPIN, and a slightly roomier ZOOP.
         Same choreography, walked instead of sprinted. BANGS stays 3, so
         the super-cycle is 18s.

     ONE BANG, IN BEATS. The word holds assembled just long enough to read.
     Then every glyph takes an impulse straight out along its own ray and
     FLIES — fastest at the instant of the bang, decelerating the whole way
     under quadratic drag, speed(t) = V0 / (1 + t/TAU). The float is not a
     second motion bolted on after the explosion; it IS the explosion's dying
     tail. The glyphs slow, curve (a slow constant CURL, so the early flight
     is a straight radial line and the late flight arcs lazily), knock back
     off the swatch's edges while they still have speed, and are barely
     moving by the end. Then the suction takes them: the zoop, a hard
     ease-IN that accelerates them inward and stops dead as the word snaps
     back onto its typed positions. Angular speed rides the same profile, so
     a glyph spins hardest right after the bang and the last of the spin is
     finished by the zoop — every glyph lands on a whole number of turns.

     WHY THIS IS GENERATED rather than hand-authored CSS, two reasons:
       · every TURN gets its own explosion — new rays, new spins, new walls
         to knock off — the way slot A gets its own circuit; and
       · the deceleration is baked into the WAYPOINT SPACING, not into an
         easing curve. Waypoints come out dense where the glyph is fast and
         sparse where it loiters (adaptive decimation to sub-pixel
         tolerance) and every flight keyframe is joined `linear`. That is
         what makes the outward throw readable frame by frame instead of
         reading as a cut, and no easing function in CSS draws that curve.
     A super-cycle is BANGS=3 of these end to end (owner-approved), so the
     swatch does not visibly repeat for 18s — three different explosions,
     each stratified into its own sector of the circle so no two of them can
     come out looking like the same bang.

     Seeded the house way (same FNV-1a → xorshift32 fold as darkPlotCircuit,
     from the turn's client_ref), so a repaint or a restored turn re-derives
     the identical animation, byte for byte. Emits a <style> block plus the
     glyph spans; the keyframe names and the binding selectors are all
     scoped by a prefix derived from that same hash, so two turns — or two
     slots, or a swatch left over mid-transition — can never collide.

     GEOMETRY. Everything is computed in "real-scale" px against a 140×110
     FIELD (the approved mockup's card) with an 11.05px glyph, then divided
     by each glyph's own font-size and emitted in em — so one generated
     stylesheet drives the swatch at every size the card ever takes. CX/CY
     are the glyph centres MEASURED in-browser from the assembled pose, and
     EM is the font-size each glyph's translate() resolves against (the
     three ellipsis dots are set 1.45×). They are only true for the exact
     type in the CSS: var(--tmono) at 700 with letter-spacing 0.08em and the
     dots' 1.45em / line-height 0 / −0.186em advance trim. Change any of
     those — including the glyph SIZE, as the 2026-08-18 tuning did — and
     these numbers must be re-measured, not adjusted by eye.
     The FIELD is deliberately not part of that: it stayed 140×110 through
     the shrink, which is why the roam box below is untouched and the
     explosion still covers as much of the swatch as it did before. */
  function darkScatterword(seed) {
    /* ---- choreography: FIXED for every seed, the 6s "house tempo" the
           owner picked off the variant sheet (2026-08-18) ----------------- */
    var BANG    = 6.0;      /* one bang, seconds                             */
    var BANGS   = 3;        /* bangs per super-cycle                         */
    var HOLD    = 0.70;     /* assembled hold, split across the loop seam    */
    var LEAD    = 0.35;     /* fraction of that hold before the impulse      */
    var ZOOP    = 0.38;     /* suction home, seconds                         */
    var EZ_ZOOP = 'cubic-bezier(.7,.05,.9,.92)'; /* accelerate in, dead stop */
    /* ---- physics: also fixed ------------------------------------------- */
    var V0  = 260;          /* muzzle speed, px/s at real scale              */
    var TAU = 0.30;         /* drag time constant, s                         */
    /* ---- what the seed is allowed to vary ------------------------------ */
    var V0_JITTER = 0.15;   /* ± fraction of V0                              */
    var RAY_JITTER = 10;    /* ± deg off the glyph's slot in the fan         */
    var SECTOR_JITTER = 32; /* ± deg a bang may wander inside its sector     */
    var CURL_MIN = 8, CURL_MAX = 17;      /* deg/s, either direction         */
    var SPIN_MIN = 450, SPIN_MAX = 700;   /* deg of spin during the flight   */
    var SPIN_LEFT_MIN = 80, SPIN_LEFT_MAX = 150; /* deg left for the snap    */
    /* ---- simulation / emission tuning ---------------------------------- */
    var DT = 0.003;         /* integration step, s                           */
    var POS_TOL = 0.60;     /* max waypoint error, real-scale px             */
    var ROT_TOL = 4.0;      /* …and degrees                                  */
    /* NEAR A WALL THE TOLERANCES TIGHTEN (2026-08-30, part of the ink-flush
       collision): the chord error is symmetric, so with the ink riding the
       wall exactly, POS_TOL of drift toward it — and the reach swing that
       ROT_TOL of rotation error buys — became a momentary CLIP under the
       well's overflow:hidden (measured up to ~0.9 real px on the dots).
       Within WALL_NEAR of any wall the chord must stay this much truer;
       elsewhere the old numbers stand, so the style barely grows. Their
       sum sits under the ruler's 0.025em safety — flush, never cut. */
    var WALL_NEAR = 2.0;    /* real px of clearance that counts as "near"    */
    var POS_TOL_W = 0.15;   /* near-wall waypoint error, real px             */
    var ROT_TOL_W = 1.0;    /* …and degrees                                  */
    var MAX_GAP = 0.20;     /* never leave a gap longer than this, s         */
    var ERR_PROBES = 6;     /* interior points probed per candidate chord    */
    var AIM_SWEEP = 54;     /* deg the ray may be nudged for clearance       */
    var AIM_STEP = 3;       /* granularity of that search, deg               */
    var AIM_CLEAR = 44;     /* px of clear run we try to buy                 */
    var AIM_COST = 0.45;    /* px of score paid per deg off the fan slot.
                               Deliberately steep: a weak penalty here lets
                               clearance override the seeded ray, and then
                               different seeds pick the SAME heading and the
                               bangs stop looking different from each other. */
    var EM_DP = 2, DEG_DP = 1, PCT_DP = 3;  /* 0.01em ≈ 0.11px at real scale */
    /* ---- the glyphs, measured (re-measured 2026-08-18 for the 11.05px
           type; the word now spans 0.537 of the field's width, was 0.632).
           Since 2026-08-30 CX/CY are the FALLBACK home centres: when the
           ink ruler runs, the live platform's own centres are measured off
           the same clone (HCX/HCY below) — these constants are one
           platform's 2026-08-18 reading, and a few tenths of a px of
           stale anchor shows once the ink bounces flush. ------------------ */
    var GLYPHS = 'LOADING...';
    var NG = 10;
    var CX = [36.16, 43.67, 51.19, 58.70, 66.22, 73.73, 81.25, 90.26, 97.79, 105.32];
    var CY = [55.00, 55.00, 55.00, 55.00, 55.00, 55.00, 55.00, 53.48, 53.48, 53.48];
    var EM = [11.05, 11.05, 11.05, 11.05, 11.05, 11.05, 11.05, 16.02, 16.02, 16.02];
    /* roam box for glyph CENTRES. Since 2026-08-30 (owner report: the
       letters bounced off walls they never reached) this is only (a) the
       clearance heuristic aim()/freeRun() score headings against, and
       (b) the FALLBACK walls when the ink ruler cannot run — the real
       collision below uses each glyph's measured ink extents, rotated to
       the glyph's spin at the moment of the hit, against the WELL's own
       edges, so the visible ink is what strikes the wall (the stray's
       principle, one indicator over; see darkScatterInkReach). */
    var XMIN = 8, XMAX = 132, YMIN = 12, YMAX = 98;
    /* THE WALLS THE INK STRIKES. Horizontally the field IS the well — the
       CSS sizes the field's 140-unit width to the swatch exactly (7.893cqw).
       Vertically the field (140×110, aspect 1.273) is letterboxed inside
       the well (41%×33% of the square card, aspect 41/33 ≈ 1.242), so the
       well's top and bottom edges sit a strip of (140·33/41 − 110)/2 ≈
       1.34 field-units beyond the field's own — the walls are pushed out
       to THEM, or a bounce would still turn back with the letterbox strip
       showing. Ink support samples per glyph arrive in em from the ruler
       and are cashed into real-scale px against EM here. */
    var YEXT = (140 * 33 / 41 - 110) / 2;
    var WX0 = 0, WX1 = 140, WY0 = -YEXT, WY1 = 110 + YEXT;
    var inkEm = darkScatterInkReach();
    var INK = null, HCX = CX, HCY = CY;
    if (inkEm && inkEm.length === NG) {
      INK = []; HCX = []; HCY = [];
      for (i = 0; i < NG; i++) {
        var sup2 = [], j2;
        for (j2 = 0; j2 < inkEm[i].sup.length; j2++) {
          sup2.push(inkEm[i].sup[j2] * EM[i]);
        }
        INK.push(sup2);
        /* the word is centred in the well, and the field is centred in the
           well, so the word's box centre IS the field's (70, 55): the
           measured em offsets seat each glyph's live home centre exactly.
           EM[0] is the base type the offsets are counted in. */
        HCX.push(70 + inkEm[i].cx * EM[0]);
        HCY.push(55 + inkEm[i].cy * EM[0]);
      }
    }

    var DEG = Math.PI / 180;
    var CYCLE = BANG * BANGS;
    var T1 = HOLD * LEAD;                   /* impulse, local to the bang    */
    var T3 = BANG - (HOLD - T1) - ZOOP;     /* the suction grabs them        */
    var T4 = T3 + ZOOP;                     /* home                          */

    /* the house fold: FNV-1a of the seed string, then xorshift32 */
    var h = 2166136261 >>> 0, i;
    for (i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    var prefix = 'jdsw' + h.toString(36);   /* scopes classes AND keyframes  */
    var st = h || 88172645;                 /* xorshift must never sit at 0  */
    function rnd() {
      st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0;
      return st / 4294967296;
    }
    function span(lo, hi) { return lo + rnd() * (hi - lo); }
    function coin() { return rnd() < 0.5 ? 1 : -1; }

    /* distance from (x, y) along `ang` before the roam box */
    function freeRun(x, y, ang) {
      var dx = Math.cos(ang), dy = Math.sin(ang), t = Infinity;
      if (dx > 1e-9) t = Math.min(t, (XMAX - x) / dx);
      else if (dx < -1e-9) t = Math.min(t, (XMIN - x) / dx);
      if (dy > 1e-9) t = Math.min(t, (YMAX - y) / dy);
      else if (dy < -1e-9) t = Math.min(t, (YMIN - y) / dy);
      return t;
    }
    /* Nudge a fan ray so the glyph has room to actually FLY outward: stay
       within ±AIM_SWEEP of its slot in the fan (the ten headings still cover
       the circle) but prefer a heading with a long clear run, so nothing
       smacks a wall 80ms in and loses its radial read. */
    function aim(x, y, target) {
      var best = target, bestScore = -1e9, dev, a, sc;
      for (dev = -AIM_SWEEP; dev <= AIM_SWEEP; dev += AIM_STEP) {
        a = target + dev * DEG;
        sc = Math.min(freeRun(x, y, a), AIM_CLEAR) - AIM_COST * Math.abs(dev);
        if (sc > bestScore) { bestScore = sc; best = a; }
      }
      return best;
    }
    /* one glyph's whole flight, integrated at DT; walls reflect elastically.
       THE COLLISION BODY IS THE INK (owner report, 2026-08-30 — the glyphs
       used to reverse with air showing on every side): when the ruler ran,
       `ink` carries this glyph's real-scale support samples — how far its
       ink's convex hull reaches from the box centre in each of 72
       directions — and each step reads them at the glyph's ROTATION at
       that instant. The reach toward a wall whose inward normal points
       along world direction φ is the hull's support at (φ − spin), so the
       walls for the CENTRE sit wherever the tumbling ink says: at the
       reversal the nearest real ink — a stem's end, a dot's rim, whatever
       the pose presents — is what touches the well, not a padded box and
       not a bounding rectangle's empty corner. Without the ruler, the old
       constant roam box falls out — never a clip, exactly the stray's
       degrade. */
    function fly(cx, cy, ang, v0, curl, rTotal, ink) {
      var n = Math.max(1, Math.round((T3 - T1) / DT));
      var dt = (T3 - T1) / n;
      var cc = Math.cos(curl * dt), ss = Math.sin(curl * dt);
      var denom = Math.log(1 + (T3 - T1) / TAU);
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var x = cx, y = cy;
      var ts = [T1], xs = [cx], ys = [cy], rs = [0], bz = [0], gs = [1e9];
      var k, t, sp, nx, ny, ndx, hit, r;
      var xlo = XMIN, xhi = XMAX, ylo = YMIN, yhi = YMAX;
      var SN = ink ? ink.length : 0;
      /* support at a world angle (degrees), linearly interpolated between
         the ruler's 5° samples — sub-hundredth-px error at glyph radii */
      function reach(phi) {
        var p = (phi / 360 * SN) % SN;
        if (p < 0) p += SN;
        var i0 = p | 0, f = p - i0;
        return ink[i0] * (1 - f) + ink[(i0 + 1) % SN] * f;
      }
      for (k = 1; k <= n; k++) {
        t = T1 + k * dt;
        /* spin on the same log profile as distance, normalised to rTotal —
           computed BEFORE the wall test since it is the collision's pose */
        r = rTotal * Math.log(1 + (t - T1) / TAU) / denom;
        if (ink) {
          xlo = WX0 + reach(180 - r); xhi = WX1 - reach(-r);
          ylo = WY0 + reach(-90 - r); yhi = WY1 - reach(90 - r);
        }
        sp = v0 / (1 + (k - 0.5) * dt / TAU);          /* midpoint speed */
        ndx = dx * cc - dy * ss; dy = dx * ss + dy * cc; dx = ndx;
        nx = x + dx * sp * dt;
        ny = y + dy * sp * dt;
        hit = 0;
        if (nx < xlo) { nx = 2 * xlo - nx; dx = -dx; hit = 1; }
        else if (nx > xhi) { nx = 2 * xhi - nx; dx = -dx; hit = 1; }
        if (ny < ylo) { ny = 2 * ylo - ny; dy = -dy; hit = 1; }
        else if (ny > yhi) { ny = 2 * yhi - ny; dy = -dy; hit = 1; }
        x = nx < xlo ? xlo : (nx > xhi ? xhi : nx);
        y = ny < ylo ? ylo : (ny > yhi ? yhi : ny);
        ts.push(t); xs.push(x); ys.push(y); bz.push(hit);
        rs.push(r);
        /* wall clearance at this step, for the decimator's near-wall gate */
        gs.push(Math.min(x - xlo, xhi - x, y - ylo, yhi - y));
      }
      return { ts: ts, xs: xs, ys: ys, rs: rs, bz: bz, gs: gs };
    }
    /* Does the straight chord i→cand stay within tolerance of the real
       flight? Probed at up to ERR_PROBES evenly spaced interior points: a
       segment never spans a bounce (those always cut), so between its ends
       the path is a smooth arc under monotonically decaying speed and has no
       high-frequency structure for the probes to step over. Keeping this
       O(1) per candidate is what keeps the whole generator linear. */
    function chordOk(s, i2, cand) {
      var steps = cand - i2, sp, probes, p, k, f, pt, rt;
      if (steps < 2) return true;
      sp = s.ts[cand] - s.ts[i2];
      probes = (steps - 1 < ERR_PROBES) ? steps - 1 : ERR_PROBES;
      for (p = 1; p <= probes; p++) {
        k = i2 + Math.round(steps * p / (probes + 1));
        if (k <= i2 || k >= cand) continue;
        f = (s.ts[k] - s.ts[i2]) / sp;
        /* the near-wall gate (see WALL_NEAR above): flush ink affords the
           chord no room to drift wallward, so truth is held tighter there */
        pt = s.gs[k] < WALL_NEAR ? POS_TOL_W : POS_TOL;
        rt = s.gs[k] < WALL_NEAR ? ROT_TOL_W : ROT_TOL;
        if (Math.abs(s.xs[i2] + (s.xs[cand] - s.xs[i2]) * f - s.xs[k]) > pt ||
            Math.abs(s.ys[i2] + (s.ys[cand] - s.ys[i2]) * f - s.ys[k]) > pt ||
            Math.abs(s.rs[i2] + (s.rs[cand] - s.rs[i2]) * f - s.rs[k]) > rt) {
          return false;
        }
      }
      return true;
    }
    /* Keep the fewest waypoints whose LINEAR-IN-TIME interpolation stays
       inside tolerance: dense while fast, sparse while loitering. Every
       bounce is forced to be a waypoint so the turn-back stays crisp. */
    function decimate(s) {
      var n = s.ts.length, keep = [0], i2 = 0, j, cand;
      while (i2 < n - 1) {
        j = i2 + 1;
        if (!s.bz[j]) {
          while (j + 1 < n) {
            cand = j + 1;
            if (s.ts[cand] - s.ts[i2] > MAX_GAP) break;
            if (!chordOk(s, i2, cand)) break;
            j = cand;
            if (s.bz[cand]) break;
          }
        }
        keep.push(j);
        i2 = j;
      }
      return keep;
    }
    /* one bang: ten independent flights. `base` and `fanDir` come from the
       super-cycle below, not from here — a bang's fan is a rigid golden-angle
       ring, so if two bangs drew similar bases independently the two
       explosions would look the same. The caller stratifies them instead. */
    function simulateBang(base, fanDir) {
      var out = [], g, ang, v0, curl, sg, turns, rTotal, rHome, s;
      for (g = 0; g < NG; g++) {
        /* golden angle between NEIGHBOURING glyphs, so adjacent letters —
           and the three dots, which start out touching — tear apart in very
           different directions while the ten headings still cover the circle */
        ang = aim(HCX[g], HCY[g],
          (base + fanDir * g * 137.5 + span(-RAY_JITTER, RAY_JITTER)) * DEG);
        v0 = V0 * (1 + span(-V0_JITTER, V0_JITTER));
        curl = span(CURL_MIN, CURL_MAX) * coin() * DEG;
        sg = coin();
        /* land the flight's spin a controlled 80–150deg short of a whole
           number of turns, so the zoop finishes it with a quarter-turn snap */
        turns = Math.max(1, Math.round(span(SPIN_MIN, SPIN_MAX) / 360));
        rTotal = sg * (360 * turns - span(SPIN_LEFT_MIN, SPIN_LEFT_MAX));
        rHome = sg * 360 * turns;
        s = fly(HCX[g], HCY[g], ang, v0, curl, rTotal, INK && INK[g]);
        out.push({ s: s, keep: decimate(s), rHome: rHome });
      }
      return out;
    }
    function tf(dx, dy, rot, em) {
      return 'translate(' + (dx / em).toFixed(EM_DP) + 'em,' +
        (dy / em).toFixed(EM_DP) + 'em) rotate(' + rot.toFixed(DEG_DP) + 'deg)';
    }
    function pc(t) { return (t / CYCLE * 100).toFixed(PCT_DP); }

    /* Stratify the three bangs around the circle instead of drawing three
       independent bases: each gets its own 360/BANGS sector (plus jitter,
       plus a coin flip on which way its fan is dealt round the circle). */
    var bangs = [], b, base0 = rnd() * 360;
    for (b = 0; b < BANGS; b++) {
      bangs.push(simulateBang(base0 + b * (360 / BANGS) +
        span(-SECTOR_JITTER, SECTOR_JITTER), coin()));
    }

    var out = ['<style>'], j, idx, rotAcc, tOff, tr, keep, s;
    for (i = 0; i < NG; i++) {
      out.push('@keyframes ', prefix, '_', i, '{0%{transform:', tf(0, 0, 0, EM[i]), '}');
      rotAcc = 0;
      for (b = 0; b < BANGS; b++) {
        tOff = b * BANG;
        tr = bangs[b][i]; s = tr.s; keep = tr.keep;
        /* flat hold right up to the impulse — the word must be EXACTLY the
           typed word for the whole beat, not merely near it */
        out.push(pc(tOff + T1), '%{transform:', tf(0, 0, rotAcc, EM[i]), '}');
        for (j = 1; j < keep.length; j++) {
          idx = keep[j];
          out.push(pc(tOff + s.ts[idx]), '%{transform:',
            tf(s.xs[idx] - HCX[i], s.ys[idx] - HCY[i], rotAcc + s.rs[idx], EM[i]));
          /* the last flight waypoint is where the suction takes over, and
             it carries the only easing curve in the whole animation */
          if (j === keep.length - 1) out.push(';animation-timing-function:', EZ_ZOOP);
          out.push('}');
        }
        rotAcc += tr.rHome;
        out.push(pc(tOff + T4), '%');
        if (b === BANGS - 1) out.push(',100%');
        out.push('{transform:', tf(0, 0, rotAcc, EM[i]), '}');
      }
      out.push('}');
    }
    /* The bindings live inside the reduced-motion guard, so a visitor who
       has asked for stillness gets the base pose — the assembled word — and
       the @keyframes above go inert with nothing referencing them. The
       DURATION is emitted here too, from CYCLE: change BANG or BANGS and the
       super-cycle length can never drift out of sync with a hand-written
       number in the stylesheet. Everything else about the loop
       (iteration-count, the linear joins, fill-mode) is in junk-drawer.css
       with the other slots. */
    out.push('@media (prefers-reduced-motion:no-preference){');
    out.push('.', prefix, ' .jd-dark-gl{animation-duration:', CYCLE.toFixed(2), 's}');
    for (i = 0; i < NG; i++) {
      out.push('.', prefix, ' .jd-dark-gl', i, '{animation-name:', prefix, '_', i, '}');
    }
    out.push('}</style><span class="jd-dark-word ', prefix, '">');
    for (i = 0; i < NG; i++) {
      out.push('<span class="jd-dark-gl jd-dark-gl', i, '">', GLYPHS.charAt(i), '</span>');
    }
    out.push('</span>');
    return out.join('');
  }
  /* the honest bar (rounds 24–25, owner pick 2026-08-21 — the pool's first
     member beyond the original four; tuned on mockup-24-honest-bar.html's
     bench, dressed by mockup-25-bar-styles.html's hatched-stripes option):
     a hand-wobbled ink bar outline whose hatched fill climbs SLOWLY, stalls,
     takes real setbacks, and once it gets above ~80 starts second-guessing
     itself in wider swings — never finishing, never quite erratic, and when
     the super-cycle ends it sighs and starts the climb over. No percentage,
     no "est. remaining": the commentary is entirely in the motion.
     OWNER TUNING, 2026-08-21 (pasted off the bench's copy-parameters
     button): rate 6, setback 0.17, depth 18, thresh 80, amp 12, tick 300ms.
     GENERATED, the house way (darkScatterword's precedent): the whole climb
     is simulated once per turn from the turn's client_ref and baked into a
     seed-scoped @keyframes track — one waypoint per tick, every segment
     joined steps(1, end), so the bar HOLDS each value for a tick and then
     jumps, like ink laid down one stroke at a time. A repaint or a restored
     turn re-derives the same climb byte for byte; reduced-motion visitors
     get the static base (parked at 68%) with the track inert. The loop seam
     is the joke completing itself: fluctuating in the high eighties at
     100%, then 0%. */
  function darkHonestBar(seed) {
    /* THE TELETYPE (owner pick, mockups/mockup-38-honest-bars.html option B,
       2026-08-26; the wobbled frame and hatched fill retire). The bar is set
       entirely in type, kin to the wait-words: the word LOADING (no
       ellipsis) shivering above a typed track — [####··········] — and a
       two-digit readout that LIES on its own schedule: usually the truth,
       every few ticks a number from nowhere, occasionally a ?? shrug. The
       joke said twice.
       Same architecture as before: everything is baked into this generated
       <style> from the seeded track — the cells are stacked #/· glyph pairs
       toggled by change-point keyframes, the readout is two one-glyph
       odometer strips stepped by translateY, the shiver is its own short
       seeded loop — so the whole thing runs on the animation clock with no
       JS ticking, pauses with the settle states, and a repaint re-derives
       the identical performance. */
    /* the bench's knobs, fixed by the owner 2026-08-21 */
    var RATE = 6, SETBACK = 0.17, DEPTH = 18, THRESH = 80, AMP = 12;
    var TICK = 0.3;          /* seconds per tick                              */
    var TICKS = 150;         /* the super-cycle: 150 × 0.3s = 45s             */
    var SEG = 14;            /* typed cells between the brackets              */
    /* the house fold: FNV-1a of the seed string, then xorshift32 */
    var h = 2166136261 >>> 0, i;
    for (i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    var prefix = 'jdhb' + h.toString(36);   /* scopes classes AND keyframes */
    var st = h || 88172645;                 /* xorshift must never sit at 0 */
    function rnd() {
      st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0;
      return st / 4294967296;
    }
    /* the bench's motion model, verbatim: below the threshold a slow climb
       with stalls and setbacks; above it a mean-reverting wander around the
       high eighties — wider swings, but it never sprints, never finishes,
       and never falls apart. Alongside the true track, the readout's track:
       strip indices 0–9 are digits, 10 is the ? and 11 the blank tens of a
       single-digit value. */
    var fills = [], tens = [], units = [], v = 0, r, lie, shown, k;
    for (k = 0; k <= TICKS; k++) {
      fills.push(Math.round(v / 100 * SEG));
      lie = rnd();
      shown = lie < 0.12 ? Math.round(rnd() * 99)
            : lie < 0.18 ? -1 : Math.round(v);
      tens.push(shown < 0 ? 10 : shown < 10 ? 11 : Math.floor(shown / 10));
      units.push(shown < 0 ? 10 : shown % 10);
      r = rnd();
      if (v < THRESH) {
        if (r < SETBACK) v -= rnd() * DEPTH;            /* a setback */
        else if (r < SETBACK + 0.18) { /* a stall: hold this tick */ }
        else v += rnd() * RATE;                         /* the climb */
      } else {
        v += (THRESH + 5 - v) * 0.12 + (rnd() - 0.5) * 2 * AMP * 0.4;
      }
      v = Math.max(0, Math.min(98, v));
    }
    /* one keyframes block per series, CHANGE POINTS only — steps(1,end)
       between stops holds each value to the next, so a cell that toggles
       six times a cycle costs six lines, not 150 */
    function stepsKf(name, series, fmt) {
      var o = ['@keyframes ', prefix, name, '{'], prev = null, k;
      for (k = 0; k < series.length; k++) {
        if (series[k] === prev && k !== series.length - 1) continue;
        o.push((k / TICKS * 100).toFixed(3), '%{', fmt(series[k]),
          ';animation-timing-function:steps(1,end)}');
        prev = series[k];
      }
      return o.join('') + '}';
    }
    var DUR = (TICKS * TICK).toFixed(1) + 's';
    var out = ['<style>'];
    var binds = [];
    for (i = 0; i < SEG; i++) {
      var cell = fills.map(function (f) { return i < f ? 1 : 0; });
      out.push(stepsKf('_c' + i, cell, function (on) { return 'opacity:' + on; }));
      out.push(stepsKf('_e' + i, cell, function (on) { return 'opacity:' + (1 - on); }));
      binds.push('.', prefix, ' .t-c:nth-child(', i + 1, ') .gf{animation:',
        prefix, '_c', i, ' ', DUR, ' linear infinite both}',
        '.', prefix, ' .t-c:nth-child(', i + 1, ') .ge{animation:',
        prefix, '_e', i, ' ', DUR, ' linear infinite both}');
    }
    function slide(idx) { return 'transform:translateY(-' + idx + 'em)'; }
    out.push(stepsKf('_dt', tens, slide), stepsKf('_du', units, slide));
    binds.push('.', prefix, ' .t-dt .t-ds{animation:', prefix, '_dt ', DUR,
      ' linear infinite both}',
      '.', prefix, ' .t-du .t-ds{animation:', prefix, '_du ', DUR,
      ' linear infinite both}');
    /* the shiver: the word worries in place — a short seeded loop of
       one-pixel-ish lurches, stepwise like everything else here */
    out.push('@keyframes ', prefix, '_sh{');
    for (k = 0; k < 8; k++) {
      out.push((k / 8 * 100).toFixed(1), '%{transform:translateX(',
        (rnd() * 3 - 1.5).toFixed(1), 'px)}');
    }
    out.push('100%{transform:translateX(0)}}');
    binds.push('.', prefix, ' .t-word{animation:', prefix, '_sh 2.7s ',
      'steps(1,end) infinite}');
    out.push('@media (prefers-reduced-motion:no-preference){',
      binds.join(''), '}</style>');
    /* the markup: the word, then the typed track and its readout */
    out.push('<span class="jd-dark-tele ', prefix, '">',
      '<b class="t-word">LOADING</b>',
      '<span class="t-line">[');
    for (i = 0; i < SEG; i++) {
      out.push('<span class="t-c"><i class="gf">#</i><i class="ge">·</i></span>');
    }
    var strip = '<span class="t-ds"><i>0</i><i>1</i><i>2</i><i>3</i><i>4</i>' +
      '<i>5</i><i>6</i><i>7</i><i>8</i><i>9</i><i>?</i><i>&nbsp;</i></span>';
    out.push('] <span class="t-d t-dt">', strip, '</span>',
      '<span class="t-d t-du">', strip, '</span>%</span></span>');
    return out.join('');
  }
  /* the pending face: one retro wait indicator per slot, printed in ink on
     the graph paper. All of it is decoration — aria-hidden by the caller. */
  /* THE ROTATION (round 24, owner directive 2026-08-21): the waiting
     indicators are a POOL, not a seating chart — dealt fresh every turn so
     two runs of a prompt no longer show the same card and no two swatches
     in a turn ever match. The pool has run six deep; with 'words' benched
     (2026-08-30) it holds exactly four, so the deal is a full permutation
     and no indicator sits a turn out any more. The deal is a
     Fisher–Yates shuffle of the pool, seeded the house way from the turn's
     client_ref, so a repaint or a restored turn re-derives the same
     arrangement. The slot letters now mean POSITION only (the pencilled
     corner labels the later cards reference); which indicator a position
     hosts is the turn's own business. Each well wears its indicator's name
     — jd-dark-well--plot/stray/scatter/watch/bar/drift/words — and the
     CSS keys the full-bleed and overflow tailoring to THAT, not to the slot. */
  /* ---- the word drift (round 27) ------------------------------------------
     The rain, rewritten in English. Columns of words fall one letter to a
     printed square, strike the bottom rule, are thrown off it, and settle into
     a heap along the floor. How deep the heap is, is how long you have waited.

     It replaces the carbon rain — 78 writing systems and 5987 generated
     characters — which read as texture rather than as language. The owner
     wanted the wait said in words you can read. The falling is unchanged; the
     alphabet and the landing are new, and the generated character pool and its
     per-script font-size table are gone with it.

     ONE LETTER, ONE ELEMENT, created when it is due and gone when it is spent.
     No pool, nothing recycled. The bench version began with a fixed set of
     glyphs per column passed round — land one, relaunch it, retire it into the
     heap, mint a replacement — which needs the pool sized against a round
     trip, retire and replace to balance exactly, and a starvation guard for
     when they don't. Any slip there quietly shrinks the column, and words lose
     letters the longer it runs. A letter per element cannot drift out of
     balance. The cost is a few DOM nodes a second per column.
     -------------------------------------------------------------------- */
  var JD_DRIFT_WORDS = ['LOADING', 'STAND BY', 'PLEASE WAIT',
                        'ONE MOMENT PLEASE', 'PENDING', 'PROCESSING',
                        'PLEASE HOLD', 'ASSEMBLING', 'COMPUTING',
                        'AWAITING RESPONSES', 'TRANSMISSION IN PROGRESS',
                        'DO NOT ADJUST YOUR SET', 'TRANSMITTING',
                        'DO NOT REFRESH', 'REMAIN SEATED',
                        'PATIENCE IS APPRECIATED'];
  /* the owner's bench settings, 2026-08-23 (mockup-33-word-drift.html) */
  var JD_DRIFT = { cell: 9, density: 0.2, speedLo: 30, speedHi: 60,
                   throwLo: 50, throwHi: 200, liftLo: 70, liftHi: 230,
                   gravity: 1600, gap: 20, maxDepth: 10, cap: 900 };

  function jdDriftRnd(n) { return (Math.random() * n) | 0; }

  /* the floor is the sheet's OWN floor (owner report 2026-08-29): the
     darkroom paints while the card is still transitioning, so the height
     jdDriftBuild reads can run tens of px deep — and every letter landed
     below the frame until the heap grew back into view. Re-read the host
     before each letter is dealt: any bucket still at the virgin floor
     follows the container's real bottom edge; a bucket already carrying
     heap keeps its surface, so nothing landed ever moves. */
  function jdDriftSync(st) {
    var H = st.host.clientHeight;
    if (!H || H === st.H) return;
    for (var b = 0; b < st.top.length; b++) if (st.top[b] === st.H) st.top[b] = H;
    st.H = H;
    st.floorLimit = H - JD_DRIFT.maxDepth * JD_DRIFT.cell;
  }

  /* the heap's height field, in buckets a third of a square wide */
  function jdDriftSurface(st, x) {
    var C = JD_DRIFT.cell;
    var b0 = Math.max(0, Math.floor(x / st.bw));
    var b1 = Math.min(st.top.length - 1, Math.floor((x + C) / st.bw));
    var y = st.H;
    for (var b = b0; b <= b1; b++) if (st.top[b] < y) y = st.top[b];
    return y;
  }
  function jdDriftDeposit(st, x, restY) {
    var C = JD_DRIFT.cell;
    var b0 = Math.max(0, Math.floor(x / st.bw));
    var b1 = Math.min(st.top.length - 1, Math.floor((x + C) / st.bw));
    var t = restY + C * 0.56;              /* the next letter nests into this one */
    for (var b = b0; b <= b1; b++) if (t < st.top[b]) st.top[b] = t;
  }
  /* gravity down, reflected off the side walls, stopped by the heap */
  function jdDriftFly(st, x0, y0, vx, vy) {
    var C = JD_DRIFT.cell, dt = 1 / 60;
    var pts = [{ x: x0, y: y0 }], x = x0, y = y0;
    for (var n = 0; n < 240; n++) {
      vy += JD_DRIFT.gravity * dt; x += vx * dt; y += vy * dt;
      if (x <= 0) { x = -x; vx = -vx * 0.46; }
      else if (x >= st.W - C) { x = 2 * (st.W - C) - x; vx = -vx * 0.46; }
      var floorY = jdDriftSurface(st, x) - C;
      if (y >= floorY && vy > 0) { y = floorY; pts.push({ x: x, y: y }); break; }
      pts.push({ x: x, y: y });
    }
    return pts;
  }

  /* a lane is free only if nothing has RESERVED it and nothing is falling in
     it — reservation alone let a finished word's lane be taken while its last
     letters were still on their way down, and two words shared a column */
  function jdDriftClaim(st, owner, avoid) {
    var free = [], i;
    for (i = 0; i < st.cols; i++) if (!st.busy[i] && !st.lane[i]) free.push(i);
    if (!free.length) { st.busy[avoid] = owner; return avoid; }
    var p = free[jdDriftRnd(free.length)];
    st.busy[p] = owner;
    return p;
  }

  /* the next letter this column owes. REVERSED when a word is taken up:
     letters are dealt one per beat and each is a beat behind the last, so the
     letter sent first ends up LOWEST. Queued in reading order a word comes out
     upside down — LOADING reads GNIDAOL down the sheet. */
  function jdDriftNext(col) {
    var st = col.st;
    if (!col.queue.length) {
      if (col.rest > 0) { col.rest--; return null; }    /* the gap between words */
      /* no word twice on one sheet (owner, 2026-08-26): a column releases
         its word only here, when it is done spelling it, and deals the next
         from the words no other column holds. The fallback deck cannot be
         reached at 5 columns over 16 words; it is there so a future tuning
         (more columns, fewer words) degrades to repetition, not to a stall. */
      if (col.word) { delete st.inPlay[col.word]; col.word = null; }
      var deck = st.words.filter(function (w) { return !st.inPlay[w]; });
      if (!deck.length) deck = st.words;
      col.word = deck[jdDriftRnd(deck.length)];
      st.inPlay[col.word] = 1;
      col.queue = Array.from(col.word).reverse();
      col.rest = JD_DRIFT.gap;
      if (st.busy[col.c] === col) st.busy[col.c] = null;
      col.c = jdDriftClaim(st, col, col.c);             /* a new word, a new lane */
      col.x = col.c * JD_DRIFT.cell;
    }
    return col.queue.shift();
  }

  /* delayMs is how far from NOW this letter was actually due — negative when
     the metronome fired late. Handing it to the animation makes the letter's
     position depend on the schedule rather than on when the timer happened to
     run; without it, jitter of a tenth of a second puts a letter most of a
     square out and it lands on the one below. */
  function jdDriftEmit(col, delayMs) {
    var st = col.st, C = JD_DRIFT.cell;
    jdDriftSync(st);              /* the landing floor = the container floor */
    var ch = jdDriftNext(col);
    if (ch === null || ch === ' ') return;              /* the beat still passes */

    var x0 = col.x;
    var g = document.createElement('i');
    g.textContent = ch;
    g.style.left = x0 + 'px';
    col.el.appendChild(g);

    var lane = Math.round(x0 / C);
    st.lane[lane] = (st.lane[lane] || 0) + 1;

    var impactY = jdDriftSurface(st, x0) - C;
    var fallMs = Math.max(60, (impactY - col.y0) / col.speed * 1000);
    var vx = (Math.random() < 0.5 ? -1 : 1) *
             (JD_DRIFT.throwLo + Math.random() * (JD_DRIFT.throwHi - JD_DRIFT.throwLo));
    var vy = -(JD_DRIFT.liftLo + Math.random() * (JD_DRIFT.liftHi - JD_DRIFT.liftLo));
    var pts = jdDriftFly(st, x0, impactY, vx, vy);
    var flightMs = (pts.length - 1) / 60 * 1000;
    var spin = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 340);
    var total = fallMs + flightMs, i, f;

    /* sampled, not eased: no easing curve expresses constant acceleration, and
       an approximated one reads as a hang at the top of the throw */
    var frames = [
      { transform: 'translate(0px,' + col.y0 + 'px) rotate(0deg)', offset: 0, easing: 'linear' },
      { transform: 'translate(0px,' + impactY + 'px) rotate(0deg)',
        offset: fallMs / total, easing: 'linear' }];
    for (i = 1; i < pts.length; i++) {
      f = i / (pts.length - 1);
      frames.push({ transform: 'translate(' + (pts[i].x - x0).toFixed(1) + 'px,' +
        pts[i].y.toFixed(1) + 'px) rotate(' + (spin * f).toFixed(0) + 'deg)',
        offset: Math.min(1, (fallMs + f * flightMs) / total), easing: 'linear' });
    }
    var anim = g.animate(frames, { duration: total, delay: delayMs || 0, fill: 'both' });
    var rest = pts[pts.length - 1];

    /* POLLED, not evented: this WebView does not fire animation finish events
       while the page is hidden, and a wait that starts in a background tab
       would never land a single letter */
    var poll = setInterval(function () {
      if (anim.playState !== 'finished') return;
      clearInterval(poll);
      var ix = st.polls.indexOf(poll); if (ix >= 0) st.polls.splice(ix, 1);
      if (st.lane[lane]) st.lane[lane]--;
      if (st.n < JD_DRIFT.cap && rest.y > st.floorLimit) {
        anim.cancel();
        g.style.left = rest.x.toFixed(1) + 'px';
        g.style.top = rest.y.toFixed(1) + 'px';
        g.style.transform = 'rotate(' + ((spin % 360) + (jdDriftRnd(19) - 9)) + 'deg)';
        st.layer.appendChild(g);              /* the same letter, now at rest */
        jdDriftDeposit(st, rest.x, rest.y);
        st.n++;
      } else {
        g.remove();                           /* the heap is full: it is spent */
      }
    }, 40);
    st.polls.push(poll);
  }

  /* every drift on the page, so a repaint or a settle can stop them all */
  var jdDriftSheets = [];
  function jdDriftStopAll() {
    jdDriftSheets.forEach(function (st) {
      st.beats.forEach(clearInterval);
      st.polls.forEach(clearInterval);
      st.beats = []; st.polls = [];
    });
    jdDriftSheets = [];
  }

  function jdDriftBuild(host) {
    var C = JD_DRIFT.cell;
    var W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return false;
    host.innerHTML = '';
    var st = { W: W, H: H, host: host, bw: C / 3, cols: Math.floor(W / C), top: [],
               busy: {}, lane: {}, n: 0, words: JD_DRIFT_WORDS, inPlay: {},
               floorLimit: H - JD_DRIFT.maxDepth * C, beats: [], polls: [] };
    for (var b = 0; b < Math.ceil(W / st.bw) + 1; b++) st.top.push(H);
    var layer = document.createElement('span');
    layer.className = 'drift';
    host.appendChild(layer);
    st.layer = layer;
    jdDriftSheets.push(st);

    var bag = [], i, j, t;
    for (i = 0; i < st.cols; i++) bag.push(i);
    for (i = bag.length - 1; i > 0; i--) {
      j = jdDriftRnd(i + 1); t = bag[i]; bag[i] = bag[j]; bag[j] = t;
    }
    bag.slice(0, Math.max(1, Math.round(st.cols * JD_DRIFT.density)))
       .forEach(function (idx) {
      var el = document.createElement('span');
      el.className = 'col';
      host.appendChild(el);
      var speed = JD_DRIFT.speedLo + Math.random() * (JD_DRIFT.speedHi - JD_DRIFT.speedLo);
      var col = { el: el, c: idx, x: idx * C, st: st, speed: speed,
                  y0: -(C * (2 + jdDriftRnd(5))), beat: C / speed * 1000,
                  queue: [], word: null, rest: jdDriftRnd(JD_DRIFT.gap) };
      st.busy[idx] = col;
      /* One metronome per column, but WHEN EACH LETTER IS DUE is kept on a
         cursor rather than taken from when the timer fired. A beat is exactly
         one square of falling, so letters stay a square apart however badly
         the timer behaves. */
      col.next = performance.now() + Math.random() * 600;
      st.beats.push(setInterval(function () {
        /* while the tab is hidden the animation clock stops but timers do not,
           so emitting would mint letters that can never fall, land, or be
           cleared up — they pile up for as long as the visitor is elsewhere */
        if (document.hidden) { col.next = performance.now(); return; }
        var now = performance.now();
        if (now - col.next > col.beat * 6) col.next = now;   /* woke up behind */
        while (col.next <= now + 4) {
          jdDriftEmit(col, col.next - now);
          col.next += col.beat;
        }
      }, Math.max(24, col.beat / 2)));
    });
    return true;
  }

  function jdDriftMount(root) {
    jdDriftStopAll();
    var hosts = (root || document).querySelectorAll('.jd-drift');
    if (!hosts.length) return;
    /* setTimeout, NOT requestAnimationFrame: rAF is parked while the tab is
       hidden, and the swatch must be built and measured even if the visitor
       sent the turn and switched away immediately */
    Array.prototype.forEach.call(hosts, function (host) {
      var tries = 0;
      (function attempt() {
        if (jdDriftBuild(host)) return;
        if (++tries < 20) setTimeout(attempt, 40);   /* not laid out yet */
      })();
    });
  }

  /* 'bar' — the honest progress bar — is BENCHED, not deleted (owner,
     2026-08-21): darkHonestBar(), its darkWell branch and its CSS are all
     still here and still work. Put the string back in this array and it
     rejoins the rotation; nothing else needs touching.
     'plot' — the plotter circuit — joined it on the bench (owner,
     2026-08-26), on the same terms: darkPlotCircuit(), its darkWell branch
     and its CSS all stay.
     'words' — the Kimi's Take word mesh — joined them (benched, owner call
     2026-08-30): its falling word-streams cross the sheet and leave without
     ever piling, and twice running the owner took them for a broken word
     drift. One letters animation in the pool, the one that piles; the mesh's
     darkWell branch, its CSS and mini.php all stay, and the full piece
     lives on at /art/kimis-take/. */
  var DARK_POOL = ['stray', 'scatter', 'watch', 'drift'];
  function darkDeal() {
    var seed = ((turn && turn.client_ref) || 'jd') + ':rota';
    var h = 2166136261 >>> 0, i;
    for (i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    if (!h) h = 88172645; /* xorshift must never sit at zero */
    function rnd() {
      h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
      return h / 4294967296;
    }
    var deck = DARK_POOL.slice(), j, t;
    for (i = deck.length - 1; i > 0; i--) {
      j = (rnd() * (i + 1)) | 0;
      t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;   /* slot a takes deck[0], b deck[1], and so on */
  }
  /* ---- the stray's ink ruler (owner directive, 2026-08-26) ---------------
     The ricochet's travel math runs on the word's BOX, but the eye watches
     the INK — and every face in the .sy stack (Snell Roundhand down to the
     cursive fallback) seats its ink differently inside that box: half-leading
     above the ascenders, no descenders at all on "wait", swash overhangs at
     the sides. So the box used to kiss the wall while the ink hung back —
     up to ~17px of air at the bottom. This ruler measures where the ink
     actually IS, in two steps that split the truth between the two renderers
     that each hold half of it. (1) THE BOX AND ITS BASELINES come from the
     DOM: an offscreen clone of the real .sy (real classes, movers stilled)
     is probed with zero-size inline-blocks — an inline-block's baseline is
     its bottom edge, so each probe's rect pins its line's baseline exactly
     where Chrome's inline layout puts it. No canvas font metric stands in
     for the line box math (an earlier draft did exactly that, and canvas
     fontBoundingBoxAscent seats the block 1–2px lower than real layout).
     (2) THE INK comes from canvas: the same two lines + dots (dots painted —
     they hold their space always, and a lit dot must never be the thing
     that clips), drawn with the clone's own computed font at those DOM
     baselines, alpha-scanned for the ink bbox. Each side's box-edge-to-ink
     distance (minus a 0.4px safety so antialiased swash tips never cross
     the wall) goes onto the mover as a --jd-si-* custom property, and the
     jdDarkStrayX/Y keyframes push the box PAST each wall by exactly that
     side's number, so the ink itself lands flush. Runtime measurement, not
     constants, because the stack resolves to different faces (with
     different overhangs) per platform. On any failure the zeros fall out
     and the bounce degrades to the old box-kiss — never a clip. */
  function darkStrayInkInsets() {
    if (darkStrayInkInsets.v) return darkStrayInkInsets.v;
    var zero = { l: 0, r: 0, t: 0, b: 0 };
    try {
      var SAFE = 0.4, S = 2;
      var PROBE = '<span data-p style="display:inline-block;width:0;height:0"></span>';
      var host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-9999px;top:0;' +
        'visibility:hidden;pointer-events:none';
      host.innerHTML =
        '<span class="jd-dark-stray" style="animation:none;position:relative;' +
        'left:0;top:0;transform:none;display:inline-block">' +
        '<span class="sy" style="animation:none;position:static;top:auto;' +
        'transform:none">please' + PROBE + '<br>wait...' + PROBE +
        '</span></span>';
      document.body.appendChild(host);
      var sy = host.querySelector('.sy');
      var probes = host.querySelectorAll('[data-p]');
      var box = sy.getBoundingClientRect();
      var b1 = probes[0].getBoundingClientRect().top - box.top;
      var b2 = probes[1].getBoundingClientRect().top - box.top;
      var cs = getComputedStyle(sy);
      var font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var lsp = cs.letterSpacing;
      var bw = box.width, bh = box.height;
      var M = parseFloat(cs.fontSize) * 1.5;  /* margin catches any overhang */
      document.body.removeChild(host);
      if (!(bw > 0) || !(bh > 0) || !(b2 > b1)) return zero;
      var cv = document.createElement('canvas');
      cv.width = Math.ceil((bw + 2 * M) * S);
      cv.height = Math.ceil((bh + 2 * M) * S);
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) return zero;
      ctx.scale(S, S);
      ctx.font = font;
      if ('letterSpacing' in ctx && lsp !== 'normal') ctx.letterSpacing = lsp;
      ctx.textAlign = 'center';        /* .sy centres each line, so does this */
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#000';
      ctx.fillText('please', M + bw / 2, M + b1);
      ctx.fillText('wait...', M + bw / 2, M + b2);
      var img = ctx.getImageData(0, 0, cv.width, cv.height).data;
      var minx = cv.width, miny = cv.height, maxx = -1, maxy = -1, x, y;
      for (y = 0; y < cv.height; y++) {
        for (x = 0; x < cv.width; x++) {
          if (img[(y * cv.width + x) * 4 + 3] > 16) {
            if (x < minx) minx = x;
            if (x > maxx) maxx = x;
            if (y < miny) miny = y;
            if (y > maxy) maxy = y;
          }
        }
      }
      if (maxx < 0) return zero;
      var side = function (v) {
        return Math.max(0, Math.round((v - SAFE) * 100) / 100);
      };
      darkStrayInkInsets.v = {
        l: side(minx / S - M),
        r: side(M + bw - (maxx + 1) / S),
        t: side(miny / S - M),
        b: side(M + bh - (maxy + 1) / S)
      };
      return darkStrayInkInsets.v;
    } catch (e) { return zero; }
  }
  function darkWell(slot, anim) {
    if (anim === 'plot') {
      /* the ink and the nib are the SAME path: the ink is a 15-unit dash
         window crawling around the circuit, the nib a 0.01-unit dot riding
         15 units ahead of the window's tail — i.e. exactly at its head */
      var d = darkPlotCircuit(((turn && turn.client_ref) || 'jd') + ':' + slot);
      return '<svg class="jd-dark-plot" width="90" height="54" viewBox="0 0 90 54">' +
        '<path class="plot-ink" d="' + d + '" pathLength="100"/>' +
        '<path class="plot-nib" d="' + d + '" pathLength="100"/>' +
        '</svg>';
    }
    if (anim === 'stray') {
      /* two nested movers, one axis each — the CSS runs them at
         incommensurate periods so the ricochet never visibly repeats */
      /* round-23 reword (owner pick 2026-08-18): the drifting word drops
         LOADING for the office's own plea — "please / wait", two lines, in
         an old-fashioned script hand (see .sy in the CSS). The trailing
         ellipsis (owner, 2026-08-26) blinks into place a dot at a time —
         none, one, two, three, back to none — on a stepped cycle; the dots
         hold their space whether lit or not, so the ricochet's measured
         box never changes mid-flight. */
      /* the --jd-si-* numbers are the ink ruler's per-side box-to-ink
         distances (see darkStrayInkInsets above): the keyframes read them
         so the INK, not the box, is what kisses each wall (owner directive,
         2026-08-26 — the word used to bounce with air under it) */
      var si = darkStrayInkInsets();
      return '<span class="jd-dark-stray" style="--jd-si-l:' + si.l +
        'px;--jd-si-r:' + si.r + 'px;--jd-si-t:' + si.t +
        'px;--jd-si-b:' + si.b + 'px"><span class="sy">please<br>wait' +
        '<i>.</i><i>.</i><i>.</i></span></span>';
    }
    if (anim === 'scatter') {
      /* the whole track is generated per turn (see darkScatterword): a
         <style> carrying ten seed-scoped keyframe blocks, then the ten
         glyphs that ride them. Style-via-innerHTML applies — a <style>
         element inserted this way is live, and it is display:none so it
         never counts as a child of the well's flex box. */
      return darkScatterword(((turn && turn.client_ref) || 'jd') + ':' + slot);
    }
    if (anim === 'drift') {
      /* cannot be a string on its own: it measures the well it lands in and
         starts a metronome per column, so it is built by jdDriftMount() from
         paint(), once this markup is in the document. */
      return '<span class="jd-drift"></span>';
    }
    if (anim === 'words') {
      /* BENCHED from the rotation (owner call 2026-08-30, see DARK_POOL):
         kept whole on the bar/plot terms — put 'words' back in the array
         and this branch serves it again unchanged. */
      /* the word mesh (owner directive 2026-08-23, mockup-34's tuning):
         Kimi's Take (art/kimis-take/) run small in word mode — every
         string is one of the office's sixteen wait-words, all of them
         commissioned (stubborn 100) to cross the whole swatch, at
         mockup-34's 2.8–5 cells/sec. The cast is 32 (owner call, same
         day) — more than a swatch can hold at once, which is the show:
         the traffic manager places what clear spacetime it finds and the
         rest of the cast waits its turn.
         It cannot be built in place the rain's way: the engine holds ONE
         sheet of state per page, and a darkroom can need four sheets at
         once. The frame is the isolation — same-origin, our own paper,
         our own ink, and mini.php re-deals itself if the swatch changes
         size. The well is aria-hidden, so the frame is too (tabindex
         keeps it out of the tab order); the status line beside it still
         does the talking. (The character-mode run of the same piece was
         in this rotation 2026-08-22 – 2026-08-26; the owner kept the wait
         said in words and retired the plain-character cast — the full
         piece lives on at /art/kimis-take/.) */
      return '<iframe class="jd-dark-mesh" ' +
        'src="/art/kimis-take/mini.php?words=1&n=32&stubborn=100&speedLo=2.8&speedHi=5" ' +
        'title="streams of words" tabindex="-1" scrolling="no"></iframe>';
    }
    if (anim === 'bar') {
      /* the whole climb is generated per turn (see darkHonestBar): a
         <style> carrying the seeded keyframe track, then the wobbled frame
         and the fill that rides it. Style-via-innerHTML applies — the
         scatterword's precedent. */
      return darkHonestBar(((turn && turn.client_ref) || 'jd') + ':' + slot);
    }
    /* watch — the wristwatch. The hands' base angles ride inline as CSS vars,
       seeded from the turn ref (same fold as darkPlotCircuit's) so each
       wait starts at a different plausible time: the minute hand lands ON
       a tick (a multiple of 30deg — steps(12) must stay on ticks) and the
       hour hand sits proportionally between its own ticks, the way a real
       watch holds its hour hand at ten past. The keyframes add 360deg to
       whatever these say, so the loop closes from any start. */
    var ws = ((turn && turn.client_ref) || 'jd') + ':' + slot;
    var wh = 2166136261 >>> 0, wj;
    for (wj = 0; wj < ws.length; wj++) {
      wh ^= ws.charCodeAt(wj);
      wh = (wh + (wh << 1) + (wh << 4) + (wh << 7) + (wh << 8) + (wh << 24)) >>> 0;
    }
    var wm = wh % 12, whr = (wh >> 4) % 12;
    return '<svg class="jd-dark-watch" width="62" height="67" viewBox="0 0 40 44"' +
      ' style="--jdwm:' + (wm * 30) + 'deg;--jdwh:' + (whr * 30 + wm * 2.5) + 'deg">' +
      '<rect class="w-lug" x="15" y="0.5" width="10" height="6" rx="1.5"/>' +
      '<rect class="w-lug" x="15" y="37.5" width="10" height="6" rx="1.5"/>' +
      '<circle class="w-case" cx="20" cy="22" r="15"/>' +
      '<circle class="w-ticks" cx="20" cy="22" r="12.5" pathLength="12"/>' +
      '<line class="w-min" x1="20" y1="22" x2="20" y2="11.5"/>' +
      '<line class="w-hr" x1="20" y1="22" x2="20" y2="15.5"/>' +
      '<circle class="w-pin" cx="20" cy="22" r="1.2"/></svg>';
  }
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
      darkWell(slot, anim) + '</div>' +
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
    var deal = darkDeal();   /* one shuffle per turn; slot i takes deal[i] */
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
  var zoomEl = null, zoomOn = false, zoomFrom = null;
  /* the layer hangs off <body>, not off the scrim — the scrim's z-index
     makes it a stacking context capped below the fixed site banner, and the
     enlargement has to cover the whole viewport to be worth doing (the
     standing note on .jd-record-zoom in junk-drawer.css). Being outside the
     scrim also keeps its presses away from the scrim's
     press-to-request-close entirely. */
  function buildZoom() {
    if (zoomEl) return;
    zoomEl = document.createElement('div');
    zoomEl.className = 'jd-record-zoom';
    /* a dialog in its own right: the turn card carries aria-modal, so
       assistive tech ignores everything outside it — and this layer, living
       on <body>, is outside it. Focus moves in here on open, which is what
       scopes AT to this dialog rather than the form behind it. */
    zoomEl.setAttribute('role', 'dialog');
    zoomEl.setAttribute('aria-modal', 'true');
    zoomEl.setAttribute('aria-label', 'enlarged artwork');
    document.body.appendChild(zoomEl);
    /* one dismissal path for every press inside the layer — the artwork
       itself, the caption, or the dark surround. All three mean: put it
       back. */
    zoomEl.addEventListener('click', function () { closeZoom(); });
    zoomEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      e.preventDefault();
      closeZoom();
    });
  }
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
  /* the print's grid grows with the print (owner, 2026-08-14 on the record
     card, same mechanism here): the enlargement's graph squares — and rule
     weights — scale by the factor the paper itself grew. Measured, not
     assumed: fig width over the plate we lifted from, fed to the gradient
     math on .rc-zoom-fig via --gk. Skips silently while the layer is
     display:none (rects are 0 there); openZoom re-runs it once the layer
     is up. */
  function zoomGridScale() {
    if (!zoomOn || !zoomEl) return;
    var fig = zoomEl.querySelector('.rc-zoom-fig');
    if (!fig || !zoomFrom || !document.contains(zoomFrom)) return;
    var pw = zoomFrom.getBoundingClientRect().width;
    var fw = fig.getBoundingClientRect().width;
    if (pw > 0 && fw > 0) fig.style.setProperty('--gk', (fw / pw).toFixed(3));
  }
  function openZoom(from) {
    if (!isOpen || zoomOn || !work) return;
    var slot = from.getAttribute('data-slot');
    var s = slot && work.slots[slot];
    if (!s || s.status !== 'ok') return;
    buildZoom();
    zoomOn = true;
    zoomFrom = from;
    var artIn = from.querySelector('.jd-turn-art-in');
    zoomEl.innerHTML = zoomHTML(slot, artIn ? artIn.getAttribute('data-fit') : '');
    zoomEl.classList.add('is-on');
    /* the reframe only counts once the layer is up: getBBox has nothing to
       measure while the layer is display:none. (A frame already filed for
       this artwork's gen: key — and the plate's own paint filed one — is
       applied without measuring at all, so this is usually a no-op that
       costs nothing.) zoomGridScale re-runs here for the same reason. */
    if (window.JD_fitAll) window.JD_fitAll(zoomEl);
    zoomGridScale();
    /* focus follows the artwork so Space/Enter/Esc all land here, and so a
       keyboard visitor isn't left tabbing the form hidden behind the layer */
    var fig = zoomEl.querySelector('.rc-zoom-fig');
    if (fig) { try { fig.focus(); } catch (e) {} }
  }
  /* `silent` closes without handing focus back — used when the card is
     re-rendering or going away and the plate we came from is about to be
     replaced anyway */
  function closeZoom(silent) {
    if (!zoomOn) return;
    zoomOn = false;
    if (zoomEl) { zoomEl.classList.remove('is-on'); zoomEl.innerHTML = ''; }
    var back = zoomFrom;
    zoomFrom = null;
    if (!silent && back && document.contains(back)) {
      try { back.focus(); } catch (e) {}
    }
  }
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
    setDisabled('[data-act="file"]', !callReady());
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
  function railHTML(ok) {
    var steps = ok.map(function (s) {
      return { id: s, n: ok.indexOf(s) + 1, label: 'drawing ' + s.toUpperCase(),
        face: s.toUpperCase() };
    });
    /* "best to worst" — the ranking step's public name (owner, 2026-08-26;
       it opened life as "the call", which survives in the internal ids).
       Its ring wears the one-word form RANKING where words are worn. */
    steps.push({ id: 'call', n: ok.length + 1, label: 'best to worst',
      face: RAIL_SCALES, word: 'ranking' });
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
    if (!two) {
      acts += '<button type="button" class="jd-turn-go" data-act="file"' +
        gate + '>file the grades</button>';
    } else {
      /* the ranking step's button wears the one-word form (owner,
         2026-08-27), like the docket ring's word — "best to worst" stays
         the card's own title */
      var next = idx + 1 < ok.length ? 'drawing ' + ok[idx + 1].toUpperCase() : 'ranking';
      acts += '<button type="button" class="jd-turn-go" data-act="next"' +
        gate + '>next — ' + esc(next) + ' &rarr;</button>';
    }
    /* the action row closes the PAPERWORK column, not the sheet: on the
       landscape bench it settles against the foot of the exhibit beside it
       (margin-top:auto), and in the portrait stack it is simply the last
       thing on the card, exactly where it was */
    return h + actions(acts) + '</div></div>';
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
    return h + actions(
      '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>' +
      '<button type="button" class="jd-turn-go" data-act="file"' +
      (callReady() ? '' : ' disabled') + '>file the grades</button>');
  }

  /* §4 the bench, §5 the call. Neither carries an instruction line: they are
     the two cards where the visitor is working, so they are the two with the
     least to read. The heading names the drawing on the bench, the rail says
     where in the steps it sits, and each row's own label (with its
     hover/focus definition) carries the rest. */
  function viewRate() {
    var ok = okSlots();
    /* a restored or degraded turn may hold a step that no longer exists */
    if (work.step !== 'call' && ok.indexOf(work.step) === -1) work.step = ok[0];
    if (work.step === 'call' && ok.length < 2) work.step = ok[0];
    work.reached[work.step] = true;
    var two = ok.length > 1;
    var call = work.step === 'call';
    return head(call ? 'Best to worst' : 'Grade drawing ' + work.step.toUpperCase(),
      call ? 5 : 4, { view: call ? 'call' : 'bench' }) +
      (two ? railHTML(ok) : '') +
      (call ? callPanel(ok) : benchPanel(work.step, ok));
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
      var seq = okSlots();
      if (seq.length > 1) seq = seq.concat(['call']);
      var at = seq.indexOf(work.step);
      /* the gate, held at the door as well as on the button (the disabled
         attribute is state the DOM could lose; this check can't) */
      if (act === 'next' && work.step !== 'call' && !benchRated(work.step)) return;
      var dest = act === 'step' ? b.getAttribute('data-step')
        : seq[at + (act === 'next' ? 1 : -1)];
      if (dest && seq.indexOf(dest) !== -1) {
        work.step = dest;
        work.reached[dest] = true;
        render();
      }
    } else if (act === 'file') {
      /* the one-survivor bench files directly — same gate as next */
      if (work.step !== 'call' && !benchRated(work.step)) return;
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
    el.dataset.size = window.JD_sizeLabel(tax(), { sizeClass: VISITOR_TIER }) || '';
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
      window.JD_applySize(el, tierBox(VISITOR_TIER), rec.gen_id, 1);
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
      visitor: true, sizeClass: VISITOR_TIER, primary: 'r1',
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
      if (firstOpenSlot) {
        work.step = firstOpenSlot;
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
    curJob.file(per).then(function () {
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

/* ---- THE CURATOR'S BENCH (?bench) — JD_bench ------------------------------
   The re-rating driver for the curated backlog (owner, 2026-08-28; successor
   to rating-bench.html, which was its own page in its own visual language).
   The INSTRUMENT is the turn card itself — JD_turn.curate() seats an item's
   existing responses on the same bench, rail and podium a visitor gets, so
   the hours spent working the backlog are spent inside the real flow, and
   every refinement made along the way ships to visitors. This module is only
   the furniture AROUND that card: the key gate, the queue, the bottom strip,
   and the curator-only acts (scrap, rerun, skip, prev). Nothing of the
   card's chrome is duplicated here.

   STATE IS SERVER-SIDE (jd_ratings / jd_ranks, via jd-item-rate.php with
   replace-on-refile semantics), which is what keeps a phone and a desktop
   working the same backlog in sync: finish an item on one, and the other
   learns on its next queue load — the strip refetches whenever the tab comes
   back to the front. Scrap and rerun are INTENTS, filed as flag rows for a
   session to apply later (`retired` lives in git-tracked entry.json; a
   rerun's drawings land as turn rows) — the bench itself commits nothing.

   A RERUN IS A REAL TURN, exactly as the old bench held: the flag row goes
   on the record, then JD_turn.rerun() runs the ordinary four-model turn —
   darkroom, blind bench, podium, unveil — and its ratings file through
   jd-rate.php like any visitor's. The strip resumes the backlog when that
   turn's card comes down. */
(function () {
  if (!/[?&]bench(?:=|&|$)/.test(location.search)) return;

  /* DIRECT ADDRESSING (owner, 2026-08-29): ?bench&item=<item_id> opens that
     one item on the bench whatever its flags say — the door back onto the
     bench for a LEGACY response the owner wants to keep in the drawer (rate
     it under the current rubric here, then scripts/keep-legacy.py applies
     the ratings and pins it). The queue only backs an item's ORIGINAL
     responses with generations, so exactly those are what get seated. */
  var directM = /[?&]item=([^&]+)/.exec(location.search);
  var directId = directM ? decodeURIComponent(directM[1]) : null;

  var API_Q = JD_API + '/api/jd-bench-queue.php';
  var API_R = JD_API + '/api/jd-item-rate.php';
  var BASE = '/art/junk-drawer/';
  var K_KEY = 'jd-bench-key';

  var Q = null;             /* the queue payload */
  var curId = null;         /* the item on (or awaiting) the bench */
  var visited = [];         /* item_ids opened this session — prev walks it */
  var filedNow = {};        /* item_id -> true once its batch filed */
  var svgCache = {};        /* svg path -> document text */
  var intent = null;        /* why the card is coming down: scrap|skip|prev|rerun */
  var rerunFor = null;      /* item_id whose rerun turn holds the stage */
  var stale = false;        /* a deploy landed since this page loaded */
  var sync = { state: 'idle', detail: '' };
  var bar = null, sheet = null;

  function bkey() {
    try { return sessionStorage.getItem(K_KEY) || ''; } catch (e) { return ''; }
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function itemById(id) {
    var list = (Q && Q.items) || [];
    for (var i = 0; i < list.length; i++) if (list[i].item_id === id) return list[i];
    return null;
  }

  /* ---------- what still needs the curator ------------------------------- */
  /* the write path REPLACES flag rows per generation, so the last word wins;
     an UNRETIRE/UNRERUN note is the flag standing down */
  function flagged(it, which) {
    for (var i = 0; i < it.responses.length; i++) {
      var fs = it.responses[i].flags || [];
      for (var k = 0; k < fs.length; k++) {
        if (fs[k].axis_id === which &&
            String(fs[k].note || '').indexOf('UN') !== 0) return true;
      }
    }
    return false;
  }
  function itemDone(it) {
    var multi = it.responses.length > 1;
    for (var i = 0; i < it.responses.length; i++) {
      var r = it.responses[i];
      if (!r.complete) return false;
      if (multi && !(r.rank >= 1)) return false;
    }
    return true;
  }
  /* AN INTENT IS NOT AN OUTCOME (owner report, 2026-08-30). Pressing RERUN
     files the flag at once, and the flag alone used to retire an item from
     the backlog — so a rerun that never finished (a closed window, a turn
     left unrated, a slot that timed out) left the item in LIMBO: marked
     sent, never returned, never decided. Four items sat there. Now the flag
     only settles an item once the rerun LANDED (a rated turn on the same
     prompt — the queue answers that with rerun_landed), and an unlanded one
     comes back to the bench for the owner to scrap or rerun afresh. SCRAP
     is different and stays absolute: it is a decision, not a pending act.
     (An older queue payload carries no rerun_landed; treating the flag as
     landed then keeps the pre-2026-08-30 behaviour rather than flooding a
     stale client's backlog with items it thinks are already handled.) */
  function rerunPending(it) {
    return flagged(it, 'rerun-request') && it.rerun_landed === false;
  }
  function workable(it) {
    if (it.retired || flagged(it, 'retire-request')) return false;
    if (!it.responses.some(function (r) { return !!r.svg; })) return false;
    if (rerunPending(it)) return true;      /* unfinished business, always */
    return !itemDone(it) && !flagged(it, 'rerun-request');
  }
  function firstWorkable(afterId) {
    var list = (Q && Q.items) || [], start = 0, i;
    if (afterId) {
      for (i = 0; i < list.length; i++) {
        if (list[i].item_id === afterId) { start = i + 1; break; }
      }
    }
    for (i = start; i < list.length; i++) if (workable(list[i])) return list[i];
    /* wrap once — items skipped earlier come round again */
    for (i = 0; i < start; i++) if (workable(list[i])) return list[i];
    return null;
  }
  function counts() {
    var list = (Q && Q.items) || [];
    var c = { left: 0, scrapped: 0, rerun: 0, resp: 0, respDone: 0 };
    list.forEach(function (it) {
      if (it.retired) return;
      if (flagged(it, 'retire-request')) { c.scrapped++; return; }
      /* a rerun the owner asked for and that LANDED is settled; one that
         never landed is back in the queue, so it counts as work to go */
      if (flagged(it, 'rerun-request') && !rerunPending(it)) { c.rerun++; return; }
      if (rerunPending(it) || !itemDone(it)) c.left++;
      it.responses.forEach(function (r) {
        c.resp++;
        if (r.complete) c.respDone++;
      });
    });
    return c;
  }

  /* ---------- the wire ---------------------------------------------------- */
  function post(body) {
    return fetch(API_R, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bench-Key': bkey() },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () {
        return { ok: false, error: { code: 'server_error' } };
      });
    }).then(function (j) {
      if (!j || !j.ok) throw ((j && j.error) || { code: 'network' });
      /* the write endpoint names its own build — a mismatch means a deploy
         landed under this page, and the rubric could have moved */
      if (j.build && Q && Q.build && j.build !== Q.build.build) stale = true;
      return j;
    });
  }
  function setSync(state, detail) {
    sync = { state: state, detail: detail || '' };
    paintBar();
  }

  /* the curate card's file() callback: one item, every response, filed
     sequentially. Replace-on-refile makes a retry after a partial landing
     converge rather than double. */
  function fileItem(it, per) {
    setSync('saving');
    var chain = Promise.resolve();
    per.forEach(function (p) {
      chain = chain.then(function () {
        var ratings = [];
        Object.keys(p.axes || {}).forEach(function (a) {
          ratings.push({ kind: 'axis', axis_id: a, value: p.axes[a] });
        });
        if (p.grade != null) ratings.push({ kind: 'grade', value: p.grade });
        if (p.rank >= 1) ratings.push({ kind: 'rank', value: p.rank });
        if (!ratings.length) return null;
        return post({ generation_id: p.generation_id, ratings: ratings });
      });
    });
    return chain.then(function () {
      filedNow[it.item_id] = true;
      /* fold the answers back into the queue copy, so done/left arithmetic
         and any revisit read what the server now holds */
      it.responses.forEach(function (r) {
        for (var i = 0; i < per.length; i++) {
          if (per[i].generation_id !== r.generation_id) continue;
          r.axes = per[i].axes;
          r.grade = per[i].grade;
          if (per[i].rank >= 1) r.rank = per[i].rank;
          r.complete = true;   /* it passed the card's own gate to get here */
        }
      });
      setSync('saved');
    }, function (err) {
      setSync('failed', (err && err.code) || '');
      throw err;
    });
  }

  /* an intent flag on the item's record — retire-request or rerun-request —
     filed against its first response's generation, with the note carrying
     which item and which way ('RETIRE x' / 'RERUN x') */
  function fileFlag(it, which, note) {
    var gen = null;
    for (var i = 0; i < it.responses.length; i++) {
      if (it.responses[i].generation_id) { gen = it.responses[i].generation_id; break; }
    }
    if (!gen) return;
    setSync('saving');
    post({
      generation_id: gen,
      ratings: [{ kind: 'flag', axis_id: which }],
      note: note
    }).then(function () { setSync('saved'); },
      function (err) { setSync('failed', (err && err.code) || ''); });
    /* the local queue copy learns it now — the strip must not re-offer an
       item the curator just dispatched, whatever the wire is doing */
    if (it.responses[0]) {
      it.responses[0].flags = (it.responses[0].flags || []).concat(
        [{ axis_id: which, note: note }]);
    }
  }

  /* ---------- seating an item on the bench ------------------------------- */
  function openItem(it) {
    if (!it) { curId = null; paintBar(); return; }
    curId = it.item_id;
    if (visited[visited.length - 1] !== it.item_id) visited.push(it.item_id);
    hideSheet();
    paintBar();
    var usable = it.responses.filter(function (r) { return !!r.svg; });
    Promise.all(usable.map(function (r) {
      if (svgCache[r.svg]) return null;
      return fetch(BASE + r.svg).then(function (res) {
        if (!res.ok) throw new Error('svg ' + res.status);
        return res.text();
      }).then(function (t) { svgCache[r.svg] = t; });
    })).then(function () {
      if (curId !== it.item_id) return;   /* the curator moved on mid-fetch */
      var models = (Q && Q.models) || {};
      window.JD_turn.curate({
        prompt: it.prompt,
        responses: usable.map(function (r) {
          return {
            generation_id: r.generation_id,
            svg: svgCache[r.svg] || '',
            model_id: r.model_id,
            label: models[r.model_id] || r.model_id,
            axes: r.axes || {},
            grade: r.grade,
            grade_seed: r.grade_seed,
            rank: r.rank
          };
        }),
        file: function (per) { return fileItem(it, per); }
      });
      paintBar();
    }, function () {
      setSync('failed', 'svg fetch');
    });
  }

  /* ---------- the card coming down --------------------------------------- */
  window.addEventListener('jd-turn-close', function () {
    var why = intent;
    intent = null;
    if (why === 'rerun') {
      var rr = itemById(rerunFor);
      if (rr && window.JD_turn.rerun(rr.prompt)) { paintBar(); return; }
      rerunFor = null;                   /* the turn refused to start */
      openItem(firstWorkable(curId));
      return;
    }
    if (rerunFor) {
      /* the rerun turn itself just closed — back to the backlog */
      rerunFor = null;
      openItem(firstWorkable(curId));
      return;
    }
    if (why === 'scrap' || why === 'skip') { openItem(firstWorkable(curId)); return; }
    if (why === 'prev') return;          /* act() reopens the earlier item */
    if (curId && filedNow[curId] && itemById(curId) && !workable(itemById(curId))) {
      openItem(firstWorkable(curId));    /* filed and dismissed — next */
      return;
    }
    paintBar();                          /* set aside — the strip offers resume */
  });

  /* ---------- the strip's acts ------------------------------------------- */
  function act(kind) {
    var it = itemById(curId);
    var open = window.JD_turn.isOpen();
    if (kind === 'skip') {
      if (open) { intent = 'skip'; window.JD_turn.close(); }
      else openItem(firstWorkable(curId));
    } else if (kind === 'scrap') {
      if (!it) return;
      fileFlag(it, 'retire-request', 'RETIRE ' + it.item_id);
      if (open) { intent = 'scrap'; window.JD_turn.close(); }
      else openItem(firstWorkable(curId));
    } else if (kind === 'rerun') {
      if (!it) return;
      fileFlag(it, 'rerun-request', 'RERUN ' + it.item_id);
      rerunFor = it.item_id;
      if (open) { intent = 'rerun'; window.JD_turn.close(); }
      else if (!window.JD_turn.rerun(it.prompt)) { rerunFor = null; }
      paintBar();
    } else if (kind === 'resume') {
      if (!open) openItem(it || firstWorkable(null));
    } else if (kind === 'prev') {
      if (visited.length < 2) return;
      visited.pop();
      var back = itemById(visited[visited.length - 1]);
      if (open) { intent = 'prev'; window.JD_turn.close(); }
      if (back) openItem(back);
    } else if (kind === 'prompt') {
      toggleSheet();
    }
  }

  /* ---------- the strip --------------------------------------------------- */
  function buildBar() {
    if (bar) return;
    document.documentElement.classList.add('jd-bench-on');
    sheet = document.createElement('div');
    sheet.className = 'jd-bench-sheet';
    sheet.hidden = true;
    document.body.appendChild(sheet);
    bar = document.createElement('div');
    bar.className = 'jd-bench-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'curator’s bench');
    document.body.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-bench]') : null;
      if (b) act(b.getAttribute('data-bench'));
    });
  }
  function hideSheet() { if (sheet) sheet.hidden = true; }
  function toggleSheet() {
    var it = itemById(curId);
    if (!sheet || !it) return;
    if (!sheet.hidden) { sheet.hidden = true; return; }
    sheet.innerHTML =
      '<b>' + esc(it.title) + '</b> · ' + esc(String(it.created).slice(0, 10)) +
      ' · ' + it.responses.length +
      (it.responses.length === 1 ? ' response' : ' responses') +
      '<p>' + esc(it.prompt) + '</p>';
    sheet.hidden = false;
  }
  function syncHTML() {
    if (sync.state === 'saving') return '<span class="jd-bench-sync is-saving">saving…</span>';
    if (sync.state === 'saved') return '<span class="jd-bench-sync is-saved">✓ filed</span>';
    if (sync.state === 'failed') {
      return '<span class="jd-bench-sync is-failed">⚠ ' +
        esc(sync.detail || 'failed') + '</span>';
    }
    return '';
  }
  function paintBar() {
    if (!bar) return;
    var c = counts();
    var it = itemById(curId);
    var open = window.JD_turn.isOpen();
    var left = '';
    if (rerunFor) {
      left = '<span class="jd-bench-note">rerun running — it files as a real turn</span>';
    } else if (it) {
      left = '<span class="jd-bench-pos">' + c.left + ' to go</span>' +
        '<button type="button" class="jd-bench-title" data-bench="prompt" ' +
        'title="the item’s prompt">' + esc(it.title) + '</button>' +
        (!open ? '<button type="button" data-bench="resume">resume</button>' : '');
    } else {
      left = '<span class="jd-bench-note">backlog clear — ' + c.respDone + '/' +
        c.resp + ' responses filed' +
        (c.scrapped ? ', ' + c.scrapped + ' scrapped' : '') +
        (c.rerun ? ', ' + c.rerun + ' sent to rerun' : '') + '</span>';
    }
    var acts = (it && !rerunFor)
      ? '<div class="jd-bench-acts">' +
        (visited.length > 1 ? '<button type="button" data-bench="prev" title="previous item">&larr;</button>' : '') +
        '<button type="button" data-bench="skip" title="set this item aside for now">skip &rarr;</button>' +
        '<button type="button" class="jd-bench-scrap" data-bench="scrap" ' +
        'title="flag this item to be retired from the drawer">scrap ✕</button>' +
        '<button type="button" class="jd-bench-rerun" data-bench="rerun" ' +
        'title="re-issue this prompt to the four current models, as a real turn">rerun ↻</button>' +
        '</div>'
      : '';
    var stamp = Q && Q.build
      ? '<span class="jd-bench-build' + (stale ? ' is-stale' : '') + '">' +
        (stale ? 'a deploy landed — reload before rating on'
          : esc(Q.build.version + ' · ' + Q.build.build +
                ' · tax v' + Q.taxonomy_version)) + '</span>'
      : '';
    bar.innerHTML =
      '<span class="jd-bench-tag" aria-hidden="true">BENCH</span>' +
      left + syncHTML() + acts + stamp;
  }

  /* ---------- the gate and the queue -------------------------------------- */
  function gate(msg) {
    if (!bar) buildBar();
    bar.innerHTML =
      '<span class="jd-bench-tag" aria-hidden="true">BENCH</span>' +
      '<label class="jd-bench-gate">' + (msg ? esc(msg) + ' ' : '') +
      'bench key <input type="password" autocomplete="off"></label>';
    var input = bar.querySelector('input');
    input.focus();
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      try { sessionStorage.setItem(K_KEY, input.value); } catch (err) {}
      loadQueue(false);
    });
  }
  function loadQueue(quiet) {
    if (!quiet) {
      if (bar) {
        bar.innerHTML = '<span class="jd-bench-tag" aria-hidden="true">BENCH</span>' +
          '<span class="jd-bench-note">loading the queue…</span>';
      }
    }
    /* the timestamp defeats any cache that ignores the endpoint's no-store
       headers (the host's edge cache was caught serving a stale queue,
       2026-08-28) — a cached queue would quietly break cross-device sync */
    fetch(API_Q + '?t=' + Date.now(), { headers: { 'X-Bench-Key': bkey() } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) {
          if (j && j.error && j.error.code === 'forbidden') {
            gate(quiet ? '' : 'the key was refused —');
            return;
          }
          if (!quiet) gate('queue failed (' + esc(((j || {}).error || {}).code || 'network') + ') —');
          return;
        }
        Q = j;
        var open = window.JD_turn.isOpen();
        /* the directly-addressed item takes the stage first, flags or not —
           once, so filing it advances into the ordinary queue */
        if (directId && !open && !rerunFor) {
          var direct = itemById(directId);
          directId = null;
          if (direct) { openItem(direct); return; }
        }
        if (!open && !rerunFor) {
          /* nothing on the stage: seat the current item if it still needs
             work (it may have been finished on another device), else move on */
          var cur = itemById(curId);
          if (!cur || !workable(cur)) openItem(firstWorkable(curId));
          else paintBar();
        } else {
          paintBar();
        }
      }, function () {
        if (!quiet) gate('the queue endpoint didn’t answer —');
      });
  }

  window.addEventListener('jd-turn-open', function () { paintBar(); });

  /* the other device may have moved the backlog — refetch when this tab
     comes back to the front (never mid-card: an open card is not disturbed) */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && Q) loadQueue(true);
  });

  buildBar();
  /* try first, gate on refusal: dev serves the queue keyless, and production
     answers 403, which routes to the key prompt */
  loadQueue(false);
})();
