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
            (window.JD_turn && window.JD_turn.isOpen()));
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

  /* Taxonomy labels may carry _underscored_ emphasis (v14, owner request:
     "Has _it_"). HTML surfaces render the run in italics; plain-text
     surfaces — native <option> text, aria strings, the report card's
     stamped marks — strip the markers. The data stays honest either way:
     an underscore pair is the whole convention. */
  function labelText(s) {
    return String(s == null ? '' : s).replace(/_([^_]+)_/g, '$1');
  }
  window.JD_labelText = labelText;
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
      function boxFor(sc) { return tiers[sc] || BASE[sc] || BASE.m; }
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
    })
    .catch(function (err) {
      fallbackNote();
      /* the collection is what failed, not the drawer: the turn object is
         frontend-injected and owes data.php nothing, and it is the only
         trigger there is now — so it still goes in, on the fallback tier box */
      if (window.JD_turnObject) window.JD_turnObject.ready(null);
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
  /* the turn object dismisses the selection before it opens the modal, from
     both the pointer and the keyboard press — and it lives outside this IIFE */
  window.JD_hideTag = hideTag;

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
    /* :not([data-turn]) — the turn button is hardware, not a specimen, and this
       readout is a list of where the COLLECTION is lying */
    well.querySelectorAll('.jd-item:not([data-turn])').forEach(function (item) {
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
(function () {
  var payload = null, svgCache = {};
  var scrim = null, cardEl = null, scrollEl = null;
  var curEntry = null, curResp = 0, isOpen = false, pushed = false;
  /* the alternatives strip's window start (owner directive, 2026-08-14 —
     with Kimi K3 filed, entries reached 4 responses and the strip outgrew
     its row): at most 3 thumbnails show at once; ◂ ▸ buttons step the
     window one response at a time. No wraparound — the archive keeps its
     filing order and the buttons go disabled at the ends. State is a
     module var so a full re-render (switching response) never loses the
     visitor's place; nav presses re-render the strip alone, not the card,
     so a long prompt's fold stays as it was left. */
  var altWin = 0;
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
     rating-colour classes rc-r1..3 and rc-g1..5 in the stylesheet —
     owner request, 2026-08-11); no class = the original red. Labels'
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
        var v = window.JD_byRank(axis.values, a.value);
        var cls = v ? 'rc-r' + Math.round(v.rank) : '';
        cell = '<span class="rc-verdict">' +
          (v ? barHTML(Math.round(v.rank), 3, cls) : '') +
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

  function altsHTML(entry, curIdx) {
    if (!entry.responses || entry.responses.length < 2) return '';
    var n = entry.responses.length, paged = n > 3;
    altWin = Math.max(0, Math.min(altWin, n - 3));
    var slice = paged ? entry.responses.slice(altWin, altWin + 3)
                      : entry.responses;
    var h = '<div class="rc-alts">';
    if (paged) {
      h += '<button type="button" class="rc-alt-nav" data-nav="-1"' +
        (altWin === 0 ? ' disabled' : '') +
        ' aria-label="Earlier responses">◂</button>';
    }
    slice.forEach(function (r, j) {
      var i = paged ? altWin + j : j;
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
    if (paged) {
      h += '<button type="button" class="rc-alt-nav" data-nav="1"' +
        (altWin >= n - 3 ? ' disabled' : '') +
        ' aria-label="More responses">▸</button>';
    }
    return h + '</div>';
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
      '<a class="rc-dl" href="' + esc(resp.url) + '" download="' +
      esc(entry.id) + '.svg" title="download the SVG as generated">' +
      'DOWNLOAD SVG ⤓</a>' +
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
      /* the strip's ◂ ▸ pagers (4+ responses): step the thumbnail window
         and rebuild the STRIP ALONE — a full render() would fold a long
         prompt the visitor just opened, and browsing the bench isn't
         switching the response */
      var nav = e.target.closest ? e.target.closest('.rc-alt-nav') : null;
      if (nav) {
        if (nav.disabled) return;
        var step = parseInt(nav.getAttribute('data-nav'), 10);
        altWin = Math.max(0, Math.min(altWin + step,
          curEntry.responses.length - 3));
        var altsBlock = scrollEl.querySelector('.rc-alts-block');
        if (altsBlock) altsBlock.innerHTML = altsHTML(curEntry, curResp);
        return;
      }
      var b = e.target.closest ? e.target.closest('.rc-alt') : null;
      if (!b) return;
      var i = parseInt(b.getAttribute('data-resp'), 10);
      if (isNaN(i) || i === curResp) return;
      curResp = i;
      /* the picked option centers itself in the strip — the same centering
         the open path gives the primary, clamped to the strip's ends */
      if (curEntry.responses.length > 3) {
        altWin = Math.max(0, Math.min(i - 1, curEntry.responses.length - 3));
      }
      drawNext = true;  /* the incoming response draws itself on */
      render(false);
    });
    /* the plate answers Enter/Space like the button it claims to be; Space is
       preventDefault'd or the card scrolls out from under the enlargement */
    scrollEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      /* Enter on the focused DOWNLOAD link is the download, not the zoom */
      if (e.target.closest && e.target.closest('.rc-dl')) return;
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
     and again when the visitor flips to another model's response — the
     photograph doesn't just appear: the artwork draws itself onto the
     plate, stroke by stroke, in SVG document order. Document order is the
     order the generating model actually emitted the shapes, so the reveal
     is a small replay of the generation — provenance as motion, not a
     canned wipe. Stroked paths draw along their measured length (the
     dasharray trick); filled shapes fade in once their outline is mostly
     down; pre-dashed strokes and unmeasurables (text, use) fall back to a
     fade. Each element's share of the run scales with the square root of
     its length, so one long spine can't starve the small bones.
     Guardrails: prefers-reduced-motion skips the whole thing; the
     per-element schedule is measured once per ARTWORK and cached under
     the same key fitView frames with (a re-inlined copy replays without
     re-measuring); and the inline animation styles are stripped after the
     run so the DOM returns to exactly what cardHTML rendered. Scope is
     the card's plate ONLY — the enlargement is the same photograph held
     closer, not a new drawing; the strip's thumbnails and the pile never
     draw at all. */
  var DRAW_SECS = 2.6;
  var DRAW_SEL = 'path,line,polyline,polygon,circle,ellipse,rect,text,use';
  var DRAW_SKIP = 'defs,clipPath,mask,pattern,linearGradient,radialGradient,' +
    'symbol,marker';
  var drawNext = false, drawTimer = 0, drawSeq = 0, drawSched = {};
  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  /* one pass of geometry + paint questions per artwork, answered from a
     fresh inlined copy and remembered by traversal index (the copies are
     re-inlined from one cached source string, so the index is stable) */
  function measureDraw(svg) {
    var els = svg.querySelectorAll(DRAW_SEL);
    var items = [], i, el, cs, L, stroked, filled;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      if (el.closest && el.closest(DRAW_SKIP)) continue;
      cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      L = 0;
      try { if (el.getTotalLength) L = el.getTotalLength(); } catch (e) {}
      stroked = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 &&
        parseFloat(cs.strokeOpacity) > 0 && cs.strokeDasharray === 'none' &&
        L > 0;
      filled = cs.fill !== 'none' && parseFloat(cs.fillOpacity) > 0;
      if (!stroked && !filled) continue;
      items.push({ idx: i, L: Math.max(L, 4), stroked: stroked,
        filled: filled, fo: cs.fillOpacity, op: cs.opacity });
    }
    var totalW = 0;
    for (i = 0; i < items.length; i++) totalW += Math.sqrt(items[i].L);
    var acc = 0;
    for (i = 0; i < items.length; i++) {
      var w = Math.sqrt(items[i].L) / (totalW || 1);
      /* starts pack into the first 90% so the tail still finishes inside
         the run; durations get 1.7x their share, overlapping neighbours
         the way a hand keeps moving before the last stroke dries */
      items[i].startF = acc * 0.9;
      acc += w;
      items[i].durF = Math.min(w * 1.7, 1 - items[i].startF);
    }
    return items;
  }

  function stripDraw(svg) {
    if (!svg || !document.contains(svg)) return;
    var els = svg.querySelectorAll(DRAW_SEL);
    for (var i = 0; i < els.length; i++) {
      els[i].style.animation = '';
      els[i].style.strokeDasharray = '';
      els[i].style.strokeDashoffset = '';
      els[i].style.removeProperty('--jdfo');
      els[i].style.removeProperty('--jdo');
    }
  }

  function drawOn() {
    if (reduceMotion || !scrollEl || !curEntry) return;
    var holder = scrollEl.querySelector('.rc-plate-art');
    var svg = holder ? holder.querySelector('svg') : null;
    if (!svg) return;
    var resp = curEntry.responses[curResp] || curEntry.responses[0];
    var key = fitKey(curEntry, resp);
    var sched = drawSched[key] || (drawSched[key] = measureDraw(svg));
    var els = svg.querySelectorAll(DRAW_SEL);
    var seq = ++drawSeq;
    if (drawTimer) { clearTimeout(drawTimer); drawTimer = 0; }
    for (var i = 0; i < sched.length; i++) {
      var it = sched[i], el = els[it.idx];
      if (!el) continue;
      var start = it.startF * DRAW_SECS;
      var dur = Math.max(it.durF * DRAW_SECS, 0.12);
      if (it.stroked) {
        el.style.strokeDasharray = it.L;
        el.style.strokeDashoffset = it.L;
        var a = 'jdDrawOn ' + dur.toFixed(3) + 's ease-out ' +
          start.toFixed(3) + 's 1 both';
        if (it.filled) {
          el.style.setProperty('--jdfo', it.fo);
          a += ', jdFillOn ' + Math.max(dur * 0.6, 0.15).toFixed(3) +
            's ease-in ' + (start + dur * 0.45).toFixed(3) + 's 1 both';
        }
        el.style.animation = a;
      } else {
        el.style.setProperty('--jdo', it.op);
        el.style.animation = 'jdFadeOn ' +
          Math.max(dur * 0.8, 0.15).toFixed(3) + 's ease-in ' +
          start.toFixed(3) + 's 1 both';
      }
    }
    /* put the plate back to plain rendered state once the run is over; a
       newer draw (response flipped mid-run) owns the plate instead */
    drawTimer = setTimeout(function () {
      drawTimer = 0;
      if (seq === drawSeq) stripDraw(svg);
    }, (DRAW_SECS + 0.4) * 1000);
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
    var entry = byId(payload.items, id);
    if (!entry) return;
    curEntry = entry;
    curResp = 0;
    for (var i = 0; i < entry.responses.length; i++) {
      if (entry.responses[i].rid === entry.primary) curResp = i;
    }
    /* open with the PRIMARY's thumbnail showing: the window centers on it
       (one earlier response visible when there is one), clamped to the
       strip's ends */
    altWin = entry.responses.length > 3
      ? Math.max(0, Math.min(curResp - 1, entry.responses.length - 3))
      : 0;
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
      if (drawTimer && !plateEmpty) {
        var ab = scrollEl.querySelector('.rc-alts-block');
        if (ab) ab.innerHTML = altsHTML(curEntry, curResp);
        if (window.JD_fitAll) window.JD_fitAll(scrollEl);
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
   role="dialog" aria-modal="true", Escape peels ONE layer (the abandon
   confirm before the modal), scrim-press closes the top layer, focus returns
   to the opener. The two dialogs refuse to open over each other.

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
  var K_TURN = 'jd-turn-v1', K_CONSENT = 'jd-consent-v1';
  var K_ITEMS = 'jd-user-items-v1', K_SCATTER = 'jd-scatter-v2';
  var MAX_PROMPT = 500, MAX_NOTE = 500, MAX_ITEMS = 5;
  var SLOW_MS = 60000;      /* past a minute the wait earns its own line */
  var VISITOR_TIER = 'm';   /* every won item is filed "m" (C5.3) */
  var ROT_MAX = 34;         /* the pile's scatter rotation range, ± degrees */

  var payload = null;       /* the data.php payload — the survey renders from it */
  var scrim = null, card = null, headEl = null, bodyEl = null, confirmEl = null;
  var state = '', isOpen = false, confirmOn = false, restored = false;
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
      /* F1 (round-16): the ✕ is now a plain flex child of .jd-turn-head,
         sharing the title's centerline by construction instead of being
         position:absolute against the whole card in a separate coordinate
         frame. It sits OUTSIDE .jd-turn-headline, which is the only part of
         the head paint() rewrites on every state change — so the close
         button (and its one click listener, bound once below) is never torn
         down and never needs rebinding. */
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
    /* a turn from a previous page life was already discarded at init */
    go(!turn ? 'prompt' : state || 'prompt');
    JD_track('turn_open', null);
  }
  /* close paths that are free to leave: nothing is in flight or unfiled */
  function close() {
    if (!isOpen) return;
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
    confirmOn = true;
    confirmEl = document.createElement('div');
    confirmEl.className = 'jd-turn-confirm';
    confirmEl.setAttribute('role', 'alertdialog');
    confirmEl.setAttribute('aria-modal', 'true');
    confirmEl.setAttribute('aria-label', 'abandon this turn?');
    confirmEl.innerHTML =
      '<div class="jd-turn-confirm-card">' +
      '<p>abandon this turn? the machines finish either way — the drawing ' +
      'just goes unrated.</p>' +
      '<div class="jd-turn-actions">' +
      '<button type="button" class="jd-turn-go" data-act="stay" data-autofocus>keep going</button>' +
      '<button type="button" class="jd-turn-alt" data-act="abandon">abandon</button>' +
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

  /* Escape peels ONE layer per press: the abandon confirm first, the modal
     second, and never the page (the pile's own Escape handler stands down
     for as long as this dialog is up — see JD_layerOpen). A third layer —
     an open definitions popover — used to peel first; OVERRIDE 1 (round-16)
     retired the popover outright, so there is one fewer layer to peel. */
  window.addEventListener('keydown', function (e) {
    if (!isOpen || e.key !== 'Escape') return;
    e.preventDefault();
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
  }
  /* every write to the card goes through here: the masthead head() just
     declared, the body, the dialog's accessible name, and the card's
     data-view — the one hook the landscape bench's width and grid ride on
     (see .jd-turn[data-view="bench"] in junk-drawer.css). */
  function paint(h) {
    headEl.innerHTML = headHTML();
    bodyEl.innerHTML = h;
    /* the plates (reveal/bench/call) inline freshly-generated SVGs, which can
       overshoot the frame they declare — reframe them here, post-paint, on
       the live card (fitView needs the rendered DOM for getBBox). Views with
       no plates match nothing and this is a no-op. */
    if (window.JD_fitAll) window.JD_fitAll(bodyEl);
    card.setAttribute('aria-label', stateTitle || 'take a turn');
    card.setAttribute('data-view', (pendingHead && pendingHead.view) || 'form');
  }
  /* the masthead: FORM JD-1 §n · the heading */
  function headHTML() {
    var p = pendingHead || { title: 'take a turn', sec: 1 };
    return '<span class="jd-turn-formno" aria-hidden="true">FORM JD-1<em>§' +
      p.sec + '</em></span>' +
      '<h2 class="jd-turn-title" tabindex="-1"' +
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
     verbatim). While a machine works, its swatch runs its own OLD-SCHOOL
     WEB WAIT INDICATOR printed in ink, keyed stably to the slot letter:
       a — the flipping hourglass (classic Windows wait cursor)
       b — the radial-tick throbber (classic browser-chrome spinner)
       c — the segmented block progress bar (Win95, indeterminate)
       d — the bouncing loading dots
     A fifth slip — "please wait…" in the visitor's pencil hand — floats ON
     TOP of the pile. No FORM JD-1 badge, no title: the masthead collapses to
     an overlay strip so only the ✕ rides the card's top-right corner (the
     button itself is untouched — F1's never-replaced static child — only its
     row is restyled, in the CSS).
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
  /* the pending face: one retro wait indicator per slot, printed in ink on
     the graph paper. All of it is decoration — aria-hidden by the caller. */
  function darkWell(slot) {
    var i, ticks = '';
    if (slot === 'a') {
      return '<svg class="jd-dark-hg" width="34" height="42" viewBox="0 0 36 44">' +
        '<g class="hg">' +
        '<path class="hg-sand hg-sand-top" d="M10.5 8 H25.5 L20 20 H16 Z"/>' +
        '<path class="hg-sand hg-sand-bot" d="M16 24 H20 L25.5 36 H10.5 Z"/>' +
        '<path class="hg-frame" d="M7 4 H29 L21.5 22 L29 40 H7 L14.5 22 Z"/>' +
        '</g></svg>';
    }
    if (slot === 'b') {
      for (i = 0; i < 12; i++) {
        ticks += '<line x1="20" y1="5" x2="20" y2="12"' +
          (i ? ' transform="rotate(' + i * 30 + ' 20 20)"' : '') + '/>';
      }
      return '<svg class="jd-dark-throb" width="40" height="40" viewBox="0 0 40 40">' +
        '<g class="throb">' + ticks + '</g></svg>';
    }
    if (slot === 'c') {
      return '<span class="jd-dark-pbar"><span class="fill"></span></span>';
    }
    return '<span class="jd-dark-dots"><span></span><span></span><span></span></span>';
  }
  function darkSwatch(slot) {
    var st = slotStatus(slot);
    return '<div class="jd-dark-sw jd-dark-sw--' + slot + '" data-slotline="' +
      slot + '" data-state="' + st.state + '">' +
      '<span class="jd-dark-letter" aria-hidden="true">' + slot + '</span>' +
      '<div class="jd-dark-well" aria-hidden="true">' + darkWell(slot) + '</div>' +
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
  function darkroomTitle() {
    var n = pendingCount();
    return n === 4 ? 'Four machines are drawing'
      : n === 3 ? 'Three are still drawing'
      : n === 2 ? 'Two are still drawing' : 'One is still drawing';
  }
  function viewGenerating() {
    /* noFocus: this view's headline is display:none (the slip is the only
       copy), so the landing focus goes to the first real control — the ✕.
       The title still EXISTS (hidden) and still carries darkroomTitle() as
       the dialog's accessible name; paintSlots keeps it in sync as slots
       land, exactly as before. */
    return head(darkroomTitle(), 2, { view: 'darkroom', noFocus: true }) +
      '<div class="jd-dark" aria-live="polite">' +
      JD_SLOTS.map(darkSwatch).join('') +
      /* the wait slip: ONE easily-edited pencilled line, riding on top of
         the pile; the slow-timer line lives under it, behind the same
         data-slow/hidden pattern the timer has always used. This card never
         needs the mockup's summary line — pendingCount() hitting 0 goes
         straight to 'reveal'. */
      '<div class="jd-dark-wait"><span class="jd-dark-line">please wait…</span>' +
      '<span class="jd-dark-slow" data-slow' + (work.slow ? '' : ' hidden') +
      '>Still going. The drawing is long because it is being written line by ' +
      'line.</span></div></div>';
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
    /* the heading is a state display too — once one machine has landed, the
       (here hidden) title stops claiming four are still drawing, and the
       dialog's accessible name moves with it */
    var t = darkroomTitle(), h2 = headEl && headEl.querySelector('.jd-turn-title');
    if (h2 && t !== stateTitle) {
      stateTitle = t;
      if (pendingHead) pendingHead.title = t;
      h2.textContent = t;
      card.setAttribute('aria-label', t);
    }
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
  function plate(slot, opts) {
    var s = work.slots[slot];
    if (!s || s.status !== 'ok') return '';
    opts = opts || {};
    return '<figure class="jd-turn-plate">' +
      '<div class="jd-turn-art" role="img" aria-label="drawing ' +
      slot.toUpperCase() + '">' +
      '<span class="jd-turn-corner tl"></span><span class="jd-turn-corner tr"></span>' +
      '<span class="jd-turn-corner bl"></span><span class="jd-turn-corner br"></span>' +
      /* the generation id keys the frame: the reveal's big plate and the
         bench's pinned one are the same drawing and must be framed alike.
         A slot that somehow arrived without one falls back to this turn's
         own ref — never a bare slot letter, which the NEXT turn's slot A
         would collide with and inherit a stale frame from. */
      '<div class="jd-turn-art-in" data-fit="gen:' +
      esc(s.gen_id || ((turn && turn.client_ref) || 'turn') + ':' + slot) + '">' +
      window.JD_svgInst(s.svg, 'ju' + slot + (instSeq++) + '_') + '</div></div>' +
      (opts.pin ? '' : '<figcaption>' + slot.toUpperCase() + '</figcaption>') +
      '</figure>';
  }
  function okSlots() {
    return JD_SLOTS.filter(function (s) { return work.slots[s].status === 'ok'; });
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
    var COUNT = { 1: 'One drawing came back', 2: 'Two drawings came back',
      3: 'Three drawings came back', 4: 'Four drawings came back' };
    return head(COUNT[ok.length] || COUNT[1], 3, { view: 'plates' }) +
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
     the call is the 5-point likert finale (winner + margin) and closes the
     same state. pillRow above survives for the unveil's keep-chooser only. */

  /* the finale's five stops: winner + strength. strength is the C1.3
     contract addition (see jd-rate.php) — a tie has no margin. The rail is
     strung between the two surviving slots, whatever letters they carry
     (four models fly since 2026-08-14, so a degraded turn's survivors are
     not always A and B); likertStops() builds the run for the pair at hand. */
  function likertStops(x, y) {
    var X = x.toUpperCase(), Y = y.toUpperCase();
    return [
      { id: x + '2', big: X, word: 'decisively', title: X + ' · decisively better',
        desc: 'No contest — ' + X + ' is clearly the stronger drawing.', winner: x, strength: 'decisive' },
      { id: x + '1', big: X, word: 'narrowly', title: X + ' · narrowly better',
        desc: 'A close call, but ' + X + ' edges it.', winner: x, strength: 'slight' },
      { id: 'tie', big: '=', word: 'dead even', title: 'dead even',
        desc: 'No daylight between them — filed as a tie.', winner: 'tie', strength: null },
      { id: y + '1', big: Y, word: 'narrowly', title: Y + ' · narrowly better',
        desc: 'A close call, but ' + Y + ' edges it.', winner: y, strength: 'slight' },
      { id: y + '2', big: Y, word: 'decisively', title: Y + ' · decisively better',
        desc: 'No contest — ' + Y + ' is clearly the stronger drawing.', winner: y, strength: 'decisive' }
    ];
  }
  /* the stops of the call currently on the bench, so the change handler can
     map a picked stop back to winner + margin */
  var curCallStops = [];
  function likertStop(id) {
    for (var i = 0; i < curCallStops.length; i++) if (curCallStops[i].id === id) return curCallStops[i];
    return null;
  }
  /* the id the visitor's stored pick maps back to, so a re-render (step
     navigation) restores the checked stop */
  function likertChosen() {
    if (!work.winner) return null;
    if (work.winner === 'tie') return 'tie';
    return work.winner + (work.strength === 'decisive' ? '2' : '1');
  }

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
     JD_barHTML and the report card's own rc-r… / rc-g… rank classes, not a
     parallel set. (Those prefixes are written out rather than starred: a
     literal asterisk-slash inside a block comment closes it, and that broke
     the whole file once already.) `total` is the scale's own step count (3
     for an axis, 5 for the grade), so the bar always fills against the
     total it's segmented into. Keeping this a function is the fix for a bug
     worth remembering: the gauge used to be inlined in scaleRow() alone, so
     it only ever appeared if you left the step and came back — in the flow
     a visitor actually walks, the select fires change, work.ratings is
     written, and the row itself never re-renders, so the gauge was
     invisible the whole way through a live turn. A mark that reports state
     has to be written wherever the state is written. */
  function gaugeFor(ax, total, chosen) {
    if (chosen == null) return '';
    var picked = ax ? window.JD_byRank(ax.values, chosen)
      : window.JD_gradeOf(tax(), chosen);
    var rank = picked ? Math.round(picked.rank) : 0;
    if (!rank) return '';
    return window.JD_barHTML(rank, total, (ax ? 'rc-r' : 'rc-g') + rank);
  }
  function scaleRow(slot, kind, ax, chosen) {
    var axisId = ax ? ax.id : null;
    var label = ax ? (ax.label || ax.id) : 'overall grade';
    var desc = ax ? (ax.description || '') : 'The drawer’s own five-tier scale, best to worst.';
    var levels = byRankDesc(ax ? ax.values : tax().grades);
    var descId = 'jd-d-' + slot + '-' + (axisId || 'grade');
    var h = '<div class="jd-row' + (ax ? '' : ' jd-row--grade') + '">' +
      '<div class="jd-rowhead">' +
      '<span class="jd-def" data-tt-t="' + esc(label) + '" data-tt-d="' +
      esc(desc) + '"><span>' + esc(label) + '</span></span>' +
      '</div>' +
      '<span class="jd-vh" id="' + descId + '">' + esc(desc) + '</span>' +
      /* the gauge (if any) is the FIRST CHILD of .jd-row-ctrl, not wrapped
         in its own span — paintGauge (below, in the input plumbing) finds
         it with ctrl.querySelector('.rc-bar') and removes/inserts it as a
         direct child on every change, so first paint has to hand it the
         identical shape or the live update's removeChild throws on a node
         that isn't actually its child. */
      '<div class="jd-row-ctrl">' + gaugeFor(ax, levels.length, chosen) +
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
    h += '</select></div>';
    return h + '</div>';
  }
  /* the column head above the rows, mirroring the report card's <thead>
     (owner directive r4 — see .rc-subj th): same two-column split and the
     same left-hand word ("Axis"), but the right column is worded to ASK
     rather than report — the report card's "Verdict" names a fact already
     filed, this one names a blank still waiting to be filled. A plain grid
     row, not a table head, so it carries nothing assistive tech needs; each
     select's own aria-label/aria-describedby already says what it is. */
  function benchHeadHTML() {
    return '<div class="jd-row jd-row--head" aria-hidden="true">' +
      '<span>Axis</span><span>Your rating</span></div>';
  }

  /* the step rail. First pass is linear (a step unlocks when the one before
     it is left), back is always one press; a degraded one-survivor turn has
     no rail at all — one panel, then file. A step the visitor has finished
     carries a PENCIL tick (.is-done): their hand, not the bureau's. */
  function railHTML(ok) {
    var steps = ok.map(function (s) {
      return { id: s, n: ok.indexOf(s) + 1, label: 'drawing ' + s.toUpperCase(), short: s.toUpperCase() };
    });
    steps.push({ id: 'call', n: ok.length + 1, label: 'the call', short: 'CALL' });
    var h = '<div class="jd-rail" role="list">';
    steps.forEach(function (st) {
      var current = work.step === st.id;
      var reached = !!work.reached[st.id];
      h += '<button type="button" role="listitem" class="jd-rail-step' +
        (current ? ' is-current' : reached ? ' is-done' : '') +
        '" data-act="step" data-step="' + st.id +
        '"' + (reached ? '' : ' disabled') +
        (current ? ' aria-current="step"' : '') +
        ' aria-label="step ' + st.n + ' — ' + esc(st.label) + '">' +
        '<b>' + st.n + '</b><span class="jd-rail-long">' + esc(st.label) +
        '</span><span class="jd-rail-short" aria-hidden="true">' +
        esc(st.short) + '</span></button>';
    });
    return h + '</div>';
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
      plate(slot, { pin: true }) + '</div></div>' +
      '<div class="jd-bench-r">' +
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
    /* the report path (APP §4.6); F9 (round-16) — the checkbox label and the
       note's placeholder used to ask the same question twice ("this drawing
       is broken or offensive" / "what is wrong with it?"). The label is
       trimmed to the fact being reported; the placeholder alone asks for the
       reason, once the field is open to ask it. */
    h += '<label class="jd-turn-check jd-turn-flag">' +
      '<input type="checkbox" data-role="flag" data-slot="' + slot + '"' +
      (r.flag ? ' checked' : '') + '>' +
      '<span>broken or offensive</span></label>' +
      '<div data-flagnote="' + slot + '"' + (r.flag ? '' : ' hidden') + '>' +
      '<input type="text" class="jd-turn-note" maxlength="' +
      MAX_NOTE + '" placeholder="what is wrong with it?" ' +
      'aria-label="note on the report for drawing ' + slot.toUpperCase() +
      '" data-role="flagnote" data-slot="' + slot + '" value="' +
      esc(r.flagNote || '') + '"></div>';
    var acts = '';
    if (idx > 0) {
      acts += '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>';
    }
    if (!two) {
      acts += '<button type="button" class="jd-turn-go" data-act="file">file the grades</button>';
    } else {
      var next = idx + 1 < ok.length ? 'drawing ' + ok[idx + 1].toUpperCase() : 'the call';
      acts += '<button type="button" class="jd-turn-go" data-act="next">next — ' +
        esc(next) + ' &rarr;</button>';
    }
    /* the action row closes the PAPERWORK column, not the sheet: on the
       landscape bench it settles against the foot of the exhibit beside it
       (margin-top:auto), and in the portrait stack it is simply the last
       thing on the card, exactly where it was */
    return h + actions(acts) + '</div></div>';
  }

  /* a call is ready to file when a winner is named AND (it's a tie, or the
     margin is picked too). The likert sets winner+margin in one stop, so it
     satisfies this the same way the two-pick call does. */
  function callReady() {
    return !!work.winner && (work.winner === 'tie' || !!work.strength);
  }

  /* THE CALL — the preserved likert finale when exactly two drawings
     survived (mockup 10c salvage, kept by the owner through the round-10
     review: the call as geometry, five title-only stops on a rail strung
     between the two survivors, tooltips per stop, filed as winner + margin).
     With three or more survivors there is no honest LINE to string — a rail
     reads A↔B as the axis and C falls off the world — so the multi-way call
     is two picks in the survey's own pill language: the winner (or dead
     even), then the margin. Same contract either way: winner + strength,
     tie has no margin. (Third model per turn 2026-08-14; fourth later the
     same day.) */
  function callPanel(ok) {
    var h = '<div class="jd-turn-plates jd-turn-plates--call">' +
      ok.map(function (s) { return plate(s); }).join('') + '</div>' +
      '<div class="jd-callhead">' +
      '<span class="jd-def" data-tt-t="the call" data-tt-d="Which ' +
      'drawing belongs in the drawer, and by how much.">' +
      '<span>Which belongs in the drawer?</span></span>' +
      '<span class="jd-req">Required</span></div>' +
      /* one line, like every other def: the per-stop wording is on the
         stops themselves, in the tooltip, and in the hidden descriptions
         below — this one line is the control's own description */
      '<span class="jd-vh" id="jd-d-call-what">The one required answer ' +
      'when more than one drawing survived — filed as a winner plus a ' +
      'margin (a tie has no margin).</span>';
    if (ok.length === 2) {
      var X = ok[0], Y = ok[1];
      curCallStops = likertStops(X, Y);
      var chosen = likertChosen();
      h += '<div class="jd-likert" role="radiogroup" ' +
        'aria-label="the call: which drawing belongs in the drawer" ' +
        'aria-describedby="jd-d-call-what"' +
        (work.winner && work.winner !== 'tie' ? ' data-pick="' + work.winner + '"' : '') + '>' +
        '<span class="jd-lk-end jd-lk-end--a" aria-hidden="true">' + X.toUpperCase() + '</span>' +
        '<div class="jd-lk-rail">';
      curCallStops.forEach(function (o) {
        var on = chosen === o.id;
        h += '<label class="jd-lk-stop' + (on ? ' is-on' : '') + '" data-tt-t="' +
          esc(o.title) + '" data-tt-d="' + esc(o.desc) + '">' +
          '<input type="radio" name="jd-call" value="' + o.id +
          '" data-role="call" aria-describedby="jd-d-call-' + o.id + '"' +
          (on ? ' checked' : '') + '>' +
          '<span class="jd-lk-dot" aria-hidden="true"></span>' +
          '<span class="jd-lk-cap"><b>' + esc(o.big) + '</b><span>' +
          esc(o.word) + '</span></span></label>';
      });
      h += '</div><span class="jd-lk-end jd-lk-end--b" aria-hidden="true">' + Y.toUpperCase() + '</span></div>';
      curCallStops.forEach(function (o) {
        h += '<span class="jd-vh" id="jd-d-call-' + o.id + '">' +
          esc(o.title + ' — ' + o.desc) + '</span>';
      });
    } else {
      curCallStops = [];
      var winOpts = ok.map(function (s) {
        return { value: s, label: 'Drawing ' + s.toUpperCase() };
      });
      winOpts.push({ value: 'tie', label: 'dead even' });
      h += pillRow('jd-callwin', 'which drawing belongs in the drawer',
        winOpts, work.winner, ' data-role="callwin"') +
        '<div data-callmargin' +
        (work.winner && work.winner !== 'tie' ? '' : ' hidden') + '>' +
        '<p class="jd-turn-line jd-callmargin-q">By how much?</p>' +
        pillRow('jd-callmargin', 'the margin', [
          { value: 'slight', label: 'narrowly' },
          { value: 'decisive', label: 'decisively' }
        ], work.strength, ' data-role="callmargin"') +
        '</div>';
    }
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
    return head(call ? 'The call' : 'Grade drawing ' + work.step.toUpperCase(),
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
  /* which slot (if any) the visitor ends up keeping — the fate column below
     states it once */
  function keptSlot() {
    var ok = okSlots();
    if (work.winner === 'tie') return work.kept ? (work.keep || null) : null;
    if (ok.length === 1) return ok[0];
    return (work.winner && ok.indexOf(work.winner) !== -1) ? work.winner : null;
  }
  /* ---------- 7. the unveil (§6) -------------------------------------------- */
  function viewUnveil() {
    var kept = keptSlot();
    var lines = (work.reveal || []).map(function (r) {
      var slot = (r.slot || '').toLowerCase();
      var who = esc(r.label || r.model_id || '');
      var vendor = r.vendor ? ' <i>(' + esc(r.vendor) + ')</i>' : '';
      var fate = r.status && r.status !== 'ok' ? 'didn’t survive'
        : (kept && slot === kept && work.placed) ? 'in the drawer' : 'filed';
      var kls = (kept && slot === kept && work.placed) ? ' kept' : '';
      return '<li><b>' + esc(slot.toUpperCase()) + '</b>' + who + vendor +
        '<span class="fate' + kls + '">' + fate + '</span></li>';
    }).join('');
    var h = head('Who drew what', 6) + '<ul class="jd-turn-reveal">' + lines + '</ul>';
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
    } else {
      h += '<p class="jd-turn-line">' + (work.placed
        ? 'It’s in the drawer — yours only, tagged as such.'
        : 'Nothing kept. The grades are filed all the same.') + '</p>' +
        actions('<button type="button" class="jd-turn-go" data-act="done">done</button>' +
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
    var html = gaugeFor(ax, levels.length, val == null ? null : Number(val));
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
    } else if (role === 'flag') {
      work.ratings[slot].flag = t.checked;
      /* mutate in place — see benchPanel */
      var fn = bodyEl.querySelector('[data-flagnote="' + slot + '"]');
      if (fn) fn.hidden = !t.checked;
    } else if (role === 'call') {
      /* the likert finale: one stop = winner + margin */
      var stop = likertStop(t.value);
      work.winner = stop ? stop.winner : null;
      work.strength = stop ? stop.strength : null;
      var lk = t.closest('.jd-likert');
      if (lk) {
        if (work.winner && work.winner !== 'tie') lk.setAttribute('data-pick', work.winner);
        else lk.setAttribute('data-pick', 'tie');
        Array.prototype.forEach.call(lk.querySelectorAll('.jd-lk-stop'), function (st) {
          var input = st.querySelector('input');
          st.classList.toggle('is-on', !!(input && input.checked));
        });
      }
      setDisabled('[data-act="file"]', !callReady());
    } else if (role === 'callwin') {
      /* the multi-way call's first pick: the winner (or dead even). The
         margin question stands down on a tie — a tie has no margin — and a
         changed winner keeps any margin already picked */
      work.winner = val;
      if (work.winner === 'tie') work.strength = null;
      var mg = bodyEl.querySelector('[data-callmargin]');
      if (mg) mg.hidden = !(work.winner && work.winner !== 'tie');
      setDisabled('[data-act="file"]', !callReady());
    } else if (role === 'callmargin') {
      work.strength = val;
      setDisabled('[data-act="file"]', !callReady());
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
    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b || b.disabled) return;
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
      var dest = act === 'step' ? b.getAttribute('data-step')
        : seq[at + (act === 'next' ? 1 : -1)];
      if (dest && seq.indexOf(dest) !== -1) {
        work.step = dest;
        work.reached[dest] = true;
        render();
      }
    } else if (act === 'file') {
      submitRatings();
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
      submitRatings();
    }
  }

  function blankWork() {
    return {
      prompt: '', notice: '', slow: false,
      slots: blankSlots(),
      ratings: blankRatings(),
      /* the single bench: which step is on the bench, which steps the
         visitor has reached (the rail's first pass is linear), and the
         call's margin alongside its winner */
      step: 'a', reached: { a: true },
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
    JD_SLOTS.forEach(function (slot) {
      /* NO client abort and NO client timeout — the server owns the 90s
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
    if (okSlots().length) { go('reveal'); return; }
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
    /* a comparison is legal as null ONLY in the degraded one-slot path.
       strength is the likert's margin (C1.3 addition, 2026-08-11): absent
       exactly when the call is a tie. */
    var body = {
      submission_id: turn.submission_id,
      client: JD_CLIENT,
      ratings: ratings,
      comparison: okSlots().length > 1
        ? { winner: work.winner, strength: work.winner === 'tie' ? null : work.strength }
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
    var title = shortTitle(rec.prompt);
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
      markCard(el, registerRecord(rec, shortTitle(rec.prompt)));
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

  window.JD_turn = {
    setData: setData,
    open: open,
    close: close,
    isOpen: function () { return isOpen; }
  };
})();
