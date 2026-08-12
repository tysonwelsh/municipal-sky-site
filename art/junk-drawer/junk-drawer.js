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
   canonical: privacy.php quotes the same words, and drift between the two is
   a blocking review finding (APP §4.5). */
var JD_CONSENT = {
  version: 'jd-consent-1',
  text: 'When you take a turn, the words you type are sent to two AI ' +
    'providers — Anthropic (Claude) and OpenAI (GPT) — which each draw an ' +
    'object from them. Your prompt, the drawings that come back, your ' +
    'ratings, and an anonymous daily-rotating visitor code are stored so ' +
    'the results can be studied and the feature kept honest. Nothing you ' +
    'type here is shown to other visitors.',
  check: 'I understand — send my words to Anthropic and OpenAI'
};

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
        /* size: area-normalized on the shared ruler (--w still carries WIDTH;
           the CSS contract is unchanged) — see applySize above */
        applySize(el, item._box, item.id,
          (typeof item.sizeScale === 'number' && item.sizeScale > 0) ? item.sizeScale : 1);
        pile.appendChild(el);
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
      /* name on its own line(s) — the tag has a fixed width, so a long
         specimen name wraps to a second line instead of stretching the tag
         past the well's edge; model · date · size sit under it. SIZE is
         per-ITEM (the tier the owner picked), not per-response, so it belongs
         on this identifying line rather than in the grade column below. */
      '<div class="l1"><span class="name">' + esc((d.title || '').toUpperCase()) +
      '</span><span class="meta">' + esc((d.model || '').toUpperCase()) +
      '<span class="sep">·</span><span class="dim">' + esc(d.date || '') + '</span>' +
      (d.size
        ? '<span class="szwrap"><span class="sep">·</span>' +
          '<span class="dim">SIZE: <span class="sz">' + esc(d.size.toUpperCase()) +
          '</span></span></span>'
        : '') +
      '</span></div>' +
      '<div class="l2"><span class="gradecol">' +
      '<span class="gradelabel">GRADE: <span class="g">' +
      (ranked ? esc((d.grade || '').toUpperCase()) : 'UNGRADED') + '</span></span>' +
      meterSVG(ranked ? (+d.rank || 1) : null, +d.steps || 5) +
      '</span><span class="btns">' +
      '<a class="btn" href="' + esc(d.url || '') + '" download="' + esc(d.id || '') + '.svg" ' +
      'title="download the SVG as generated">DOWNLOAD<br>SVG ⤓</a>' +
      (d.card === 'none' ? '' :
        '<a class="btn jd-fullrecord" href="#' + esc(d.id || '') + '" title="open the report card">REPORT<br>CARD →</a>') +
      '</span></div>';
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
    /* the ring suppressor below is only good for as long as this focus lasts */
    el.addEventListener('blur', function () { el.classList.remove('is-tap'); });
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
       Its reach is deliberately small, and worth stating plainly: it covers
       the beat before the modal takes focus, and the case where no modal
       arrives at all (JD_turn absent or refusing) — there the ring would
       otherwise sit on the plate indefinitely after a mouse click. It does
       NOT survive the modal: opening blurs the object and clears the flag, so
       when close() hands focus back the ring shows. That is the retired
       corner button's behaviour too, and it is the right answer — focus
       returned to an opener should be visible. */
    if (viaKey) el.classList.remove('is-tap');
    else el.classList.add('is-tap');
    try { el.focus({ preventScroll: true }); } catch (e) {}
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
  /* the filed size, rendered the same way here as on the specimen tag */
  var sizeLabel = window.JD_sizeLabel;
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
     center vanishing point; far rows dissolve into the navy horizon.
     `pfx` namespaces the two gradient ids: the plate and the enlargement can
     be in the document at the same time, and while their gradients happen to
     be identical today, two copies fighting over one id is exactly the bug
     svgInst exists to prevent — so the floor prefixes its own defs too. */
  function floorSVG(pfx) {
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
        var cls = v ? 'rc-r' + Math.round(v.rank) : '';
        cell = '<span class="rc-verdict">' +
          (v ? barHTML(Math.round(v.rank), 3, cls) : '') +
          mark(v ? v.label : String(a.value), cls) + '</span>';
      }
      rows += '<tr><td><span class="rc-subj-name">' + esc(axis.label || axis.id) +
        '</span></td><td>' + cell + '</td></tr>';
    });
    var g = gradeOf(resp.grade);
    var gCls = g.rank ? 'rc-g' + Math.round(g.rank) : '';
    return '<table class="rc-subj"><thead><tr>' +
      /* 52/48 → 44/56 → 47/53 (owner, 2026-08-12): the verdict column
         carries the gauge AND the pencilled word, the axis column only a
         name — but 44% squeezed the axis names a touch too hard */
      '<th style="width:47%">Axis</th><th style="width:53%">Verdict</th>' +
      '</tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td><span class="rc-avg-l">Overall grade</span></td>' +
      '<td><span class="rc-verdict">' +
      (g.rank ? barHTML(Math.round(g.rank), 5, gCls) : '') +
      mark(g.label, gCls) +
      '</span></td></tr></tfoot></table>';
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
        /* the strip's little grades wear the same coloured pencils as the
           card's marks (rc-g1..5 share their colour rules) */
        '<span class="rc-alt-grade' +
        (g.rank ? ' rc-g' + Math.round(g.rank) : '') + '">' +
        esc(g.label) + '</span>' +
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
    /* the plate is the enlargement's handle: role/tabindex make it a real
       button for keyboard and screen readers without wrapping the artwork in
       a <button>, whose UA box model would fight the absolutely-positioned
       floor. The corner hint is there for touch, where there is no hover to
       discover the affordance with. */
    h += '<div class="rc-block rc-plate" role="button" tabindex="0" ' +
      'aria-label="Enlarge the artwork">' + floorSVG() +
      '<div class="rc-plate-art">' +
      svgInst(svgCache[entry.id + '/' + resp.file] || '', 'jr' + curIdx + '_') +
      '</div>' +
      '<span class="rc-plate-hint" aria-hidden="true">⤢ enlarge</span>' +
      '</div>';
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

  /* the enlargement's contents: the SAME response the card is showing, on the
     same black plate over the same vaporwave floor, so it reads as the plate
     grown rather than a different picture. Its inlined copy takes a `jz`
     prefix — the `jr` copy is still in the card underneath it. */
  function zoomHTML(entry, resp, curIdx) {
    var m = modelOf(resp.model);
    return '<div class="rc-zoom-fig" role="button" tabindex="0" ' +
      'aria-label="Shrink the artwork">' + floorSVG('z') +
      '<div class="rc-zoom-art">' +
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
      if (e.target.closest && e.target.closest('.rc-plate')) {
        openZoom(e.target.closest('.rc-plate'));
        return;
      }
      var b = e.target.closest ? e.target.closest('.rc-alt') : null;
      if (!b) return;
      var i = parseInt(b.getAttribute('data-resp'), 10);
      if (isNaN(i) || i === curResp) return;
      curResp = i;
      render(false);
    });
    /* the plate answers Enter/Space like the button it claims to be; Space is
       preventDefault'd or the card scrolls out from under the enlargement */
    scrollEl.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
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
  }

  function openZoom(from) {
    if (!isOpen || zoomOn || !curEntry) return;
    buildZoom();
    zoomOn = true;
    zoomFrom = from || null;
    syncZoom();
    zoomEl.classList.add('is-on');
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

  function render(animate) {
    markSeq = 0;
    var resp = curEntry.responses[curResp] || curEntry.responses[0];
    scrollEl.innerHTML = cardHTML(curEntry, resp, curResp);
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
  var scrim = null, card = null, bodyEl = null, confirmEl = null;
  var state = '', isOpen = false, confirmOn = false, restored = false;
  var turn = null;          /* the persisted in-flight record (C5.3) */
  var work = null;          /* the working copy: svgs, ratings, comparison */
  var token = 0;            /* per-turn token — a settling fetch from an
                               abandoned turn must not touch the live one */
  var lastFocus = null, instSeq = 0, slowTimer = 0;
  var stateTitle = '';      /* the current state's heading — also the dialog's
                               accessible name, so the name changes with the
                               step instead of naming the whole flow once */

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
    scrim.innerHTML =
      '<div class="jd-turn" role="dialog" aria-modal="true" ' +
      'aria-label="take a turn">' +
      '<button type="button" class="jd-turn-close" aria-label="close">✕</button>' +
      '<div class="jd-turn-scroll"></div></div>';
    document.body.appendChild(scrim);
    card = scrim.querySelector('.jd-turn');
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
    var pref = (confirmOn && confirmEl ? confirmEl : bodyEl)
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
    go(!turn ? (hasConsent() ? 'prompt' : 'consent') : state || 'prompt');
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

  /* ---------- the definition layer (single bench, 2026-08-11) -------------
     ONE system for every "what does this mean": a fixed singleton tooltip
     for pointer hover and keyboard focus (aria-hidden — screen readers get
     the same words natively via aria-describedby / the popovers), and the ⓘ
     in-flow popovers the click handler above drives. The tooltip is
     pointer-events:none so it can never take a press a control should have
     had, and a plain touch tap never opens it — on touch the ⓘ carries the
     definitions alone. */
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
  /* fold every open ⓘ popover; returns whether any was open (the Escape
     layering below peels it as its own layer) */
  function closeDefs() {
    var any = false;
    Array.prototype.forEach.call(
      bodyEl.querySelectorAll('.jd-def[aria-expanded="true"]'),
      function (btn) {
        any = true;
        btn.setAttribute('aria-expanded', 'false');
        var pop = bodyEl.querySelector('#' + btn.getAttribute('aria-controls'));
        if (pop) pop.hidden = true;
      });
    return any;
  }

  /* Escape peels ONE layer per press: an open definitions popover first,
     the abandon confirm second, the modal third, and never the page (the
     pile's own Escape handler stands down for as long as this dialog is
     up — see JD_layerOpen). */
  window.addEventListener('keydown', function (e) {
    if (!isOpen || e.key !== 'Escape') return;
    e.preventDefault();
    ttHide();
    if (!confirmOn && closeDefs()) return;
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
    state = next;
    if (turn) { turn.state = next; persist(); }
    render();
  }
  function render() {
    if (!isOpen) return;
    var h = '';
    if (state === 'consent') h = viewConsent();
    else if (state === 'prompt') h = viewPrompt();
    else if (state === 'generating') h = viewGenerating();
    else if (state === 'reveal') h = viewReveal();
    else if (state === 'rate') h = viewRate();
    else if (state === 'unveil') h = viewUnveil();
    else if (state === 'apology') h = viewApology();
    paint(h);
    bodyEl.scrollTop = 0;
    focusFirst();
  }
  /* every write to the body goes through here: the dialog's accessible name is
     the heading that was just built (see head) */
  function paint(h) {
    bodyEl.innerHTML = h;
    card.setAttribute('aria-label', stateTitle || 'take a turn');
  }

  /* ---------- 1. consent (C5.2) ------------------------------------------- */
  function viewConsent() {
    return head('Before the machines draw', true) +
      '<p class="jd-turn-copy">' + esc(JD_CONSENT.text) + '</p>' +
      '<label class="jd-turn-check">' +
      '<input type="checkbox" data-role="consent" data-autofocus' +
      (work && work.consented ? ' checked' : '') + '>' +
      '<span>' + esc(JD_CONSENT.check) + '</span></label>' +
      actions(
        '<button type="button" class="jd-turn-go" data-act="consent"' +
        (work && work.consented ? '' : ' disabled') + '>continue</button>');
  }

  /* ---------- 2. prompt ---------------------------------------------------- */
  function viewPrompt() {
    var draft = (work && work.prompt) || '';
    var msg = work && work.notice
      ? '<p class="jd-turn-notice" role="status">' + esc(work.notice) + '</p>' : '';
    var n = draft.length;
    return head('Describe an object for the drawer', true) +
      msg +
      '<p class="jd-turn-copy">Two machines get your words, verbatim, and each ' +
      'draws the thing. You grade what comes back and keep the one you like.</p>' +
      '<label class="jd-turn-label" for="jd-turn-prompt">the brief</label>' +
      '<textarea id="jd-turn-prompt" class="jd-turn-input" rows="3" ' +
      'data-role="prompt" data-autofocus spellcheck="true" ' +
      'placeholder="a brass fish that is also a whistle">' + esc(draft) + '</textarea>' +
      '<p class="jd-turn-count' + (n > MAX_PROMPT ? ' is-over' : '') +
      '" aria-live="polite">' + n + ' / ' + MAX_PROMPT + '</p>' +
      /* the honeypot: off-screen rather than display:none (which most bots
         skip), never in the tab order, never announced */
      '<div class="jd-turn-hp" aria-hidden="true">' +
      '<label for="jd-turn-website">leave this empty</label>' +
      '<input type="text" id="jd-turn-website" name="website" data-role="hp" ' +
      'tabindex="-1" autocomplete="off" value=""></div>' +
      actions(
        '<button type="button" class="jd-turn-go" data-act="generate"' +
        (draft.trim().length && n <= MAX_PROMPT ? '' : ' disabled') +
        '>send it</button>');
  }

  /* ---------- 3. generating ------------------------------------------------ */
  function slotLine(slot) {
    var s = work.slots[slot];
    var name = slot.toUpperCase();
    if (s.status === 'ok') return 'response ' + name + ' — arrived';
    if (s.status === 'pending') return 'response ' + name + ' — still drawing…';
    return 'response ' + name + ' — didn’t survive';
  }
  function viewGenerating() {
    return head('Two machines are drawing…') +
      '<p class="jd-turn-copy">The same words went to both. It can take a ' +
      'minute or two — leave this open.</p>' +
      '<ul class="jd-turn-slots" aria-live="polite">' +
      '<li data-slotline="a">' + esc(slotLine('a')) + '</li>' +
      '<li data-slotline="b">' + esc(slotLine('b')) + '</li>' +
      '</ul>' +
      '<p class="jd-turn-copy jd-turn-slow" data-slow' +
      (work.slow ? '' : ' hidden') + '>Still going. The drawing is long ' +
      'because it is being written line by line.</p>';
  }
  function paintSlots() {
    if (!isOpen || state !== 'generating') return;
    ['a', 'b'].forEach(function (slot) {
      var li = bodyEl.querySelector('[data-slotline="' + slot + '"]');
      if (li) li.textContent = slotLine(slot);
    });
    var slow = bodyEl.querySelector('[data-slow]');
    if (slow && work.slow) slow.removeAttribute('hidden');
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

  /* ---------- 4. reveal (blind: A and B, nothing else) --------------------- */
  function plate(slot, opts) {
    var s = work.slots[slot];
    if (!s || s.status !== 'ok') return '';
    opts = opts || {};
    return '<figure class="jd-turn-plate' + (opts.small ? ' is-small' : '') + '">' +
      '<div class="jd-turn-art" role="img" aria-label="response ' +
      slot.toUpperCase() + '">' +
      window.JD_svgInst(s.svg, 'ju' + slot + (instSeq++) + '_') + '</div>' +
      '<figcaption>' + slot.toUpperCase() + '</figcaption></figure>';
  }
  function okSlots() {
    return ['a', 'b'].filter(function (s) { return work.slots[s].status === 'ok'; });
  }
  function viewReveal() {
    var ok = okSlots();
    var lost = ok.length === 1
      ? '<p class="jd-turn-notice" role="status">the other machine’s ' +
        'drawing didn’t survive — you’ll grade this one alone.</p>' : '';
    return head(ok.length === 1 ? 'One drawing came back' : 'Two drawings came back') +
      lost +
      '<div class="jd-turn-plates">' + ok.map(function (s) { return plate(s); }).join('') +
      '</div>' +
      '<p class="jd-turn-copy">No names yet. Who drew which is withheld until ' +
      'your grades are filed.</p>' +
      actions('<button type="button" class="jd-turn-go" data-act="rate">grade them</button>');
  }

  /* ---------- 5. rate — the survey, rendered from the taxonomy ------------- */
  function pillRow(name, label, options, chosen, meta) {
    var h = '<div class="jd-pillrow" role="radiogroup" aria-label="' + esc(label) + '">';
    options.forEach(function (o) {
      var on = String(chosen == null ? '' : chosen) === String(o.value);
      h += '<label class="jd-pill' + (on ? ' is-on' : '') + '">' +
        '<input type="radio" name="' + esc(name) + '" value="' + esc(o.value) + '"' +
        meta + (on ? ' checked' : '') + '>' +
        '<span class="jd-pill-tick" aria-hidden="true">✓</span>' +
        '<span class="jd-pill-l">' + esc(o.label) + '</span>' +
        (o.description
          ? '<span class="jd-pill-d">' + esc(o.description) + '</span>' : '') +
        '</label>';
    });
    return h + '</div>';
  }
  /* THE SINGLE BENCH (owner pick, mockup round 10, 2026-08-11). One response
     on the bench at a time — a step rail (response A → response B → the
     call), the artwork pinned sticky while its response is graded, every
     scale a native <select> (titles only on the control and in the list;
     skip is the honest default), and ONE definition system: a hover/focus
     tooltip plus an ⓘ per question that unfolds the whole scale in-flow.
     The two-panel pill survey and the separate compare state are retired;
     the call is the 5-point likert finale (winner + margin) and closes the
     same state. pillRow above survives for the unveil's keep-chooser only. */

  /* the finale's five stops: winner + strength. strength is the C1.3
     contract addition (see jd-rate.php) — a tie has no margin. */
  var LIKERT = [
    { id: 'a2', big: 'A', word: 'decisively', title: 'A · decisively better',
      desc: 'No contest — A is clearly the stronger drawing.', winner: 'a', strength: 'decisive' },
    { id: 'a1', big: 'A', word: 'narrowly', title: 'A · narrowly better',
      desc: 'A close call, but A edges it.', winner: 'a', strength: 'slight' },
    { id: 'tie', big: '=', word: 'dead even', title: 'dead even',
      desc: 'No daylight between them — filed as a tie.', winner: 'tie', strength: null },
    { id: 'b1', big: 'B', word: 'narrowly', title: 'B · narrowly better',
      desc: 'A close call, but B edges it.', winner: 'b', strength: 'slight' },
    { id: 'b2', big: 'B', word: 'decisively', title: 'B · decisively better',
      desc: 'No contest — B is clearly the stronger drawing.', winner: 'b', strength: 'decisive' }
  ];
  function likertStop(id) {
    for (var i = 0; i < LIKERT.length; i++) if (LIKERT[i].id === id) return LIKERT[i];
    return null;
  }
  /* the id the visitor's stored pick maps back to, so a re-render (step
     navigation) restores the checked stop */
  function likertChosen() {
    if (!work.winner) return null;
    if (work.winner === 'tie') return 'tie';
    return work.winner + (work.strength === 'decisive' ? '2' : '1');
  }

  /* one question row: the ⓘ header (its button doubles as the hover/focus
     tooltip anchor for the scale's meaning), the in-flow definitions
     popover, the select, and — on axis rows — the folded note. Re-rendering
     is safe: every answer lives in `work` and is written back as selected/
     value/hidden state here. */
  function scaleRow(slot, kind, ax, chosen) {
    var axisId = ax ? ax.id : null;
    var label = ax ? (ax.label || ax.id) : 'overall grade';
    var desc = ax ? (ax.description || '') : 'The drawer’s own five-tier scale, best to worst.';
    var levels = byRankDesc(ax ? ax.values : tax().grades);
    var popId = 'jd-pop-' + slot + '-' + (axisId || 'grade');
    var noteVal = axisId ? (work.ratings[slot].notes[axisId] || '') : '';
    var h = '<div class="jd-row' + (ax ? '' : ' jd-row--grade') + '">' +
      '<div class="jd-rowhead">' +
      '<button type="button" class="jd-def" data-act="def" aria-expanded="false" ' +
      'aria-controls="' + popId + '" data-tt-t="' + esc(label) + '" data-tt-d="' +
      esc(desc) + '"><span>' + esc(label) + '</span>' +
      '<span class="jd-i" aria-hidden="true">i</span></button>' +
      (axisId
        ? '<button type="button" class="jd-notbtn' + (noteVal ? ' has-note' : '') +
          '" data-act="note-toggle" data-slot="' + slot + '" data-axis="' +
          esc(axisId) + '" aria-expanded="' + (noteVal ? 'true' : 'false') +
          '">&#9998; note</button>'
        : '') +
      '</div>' +
      '<div class="jd-pop" id="' + popId + '" hidden>' +
      '<p class="jd-pop-desc">' + esc(desc) + '</p><dl>';
    levels.forEach(function (l) {
      /* escape FIRST, then honor the _emphasis_ convention — the italics
         can never smuggle markup because the underscores wrap escaped text */
      h += '<dt>' + esc(l.label || l.id).replace(/_([^_]+)_/g, '<i>$1</i>') +
        '</dt><dd>' + esc(l.description || '') + '</dd>';
    });
    h += '<dt>skip</dt><dd>No answer filed for this question.</dd></dl></div>' +
      '<select class="jd-turn-select' + (chosen != null ? ' is-set' : '') + '" ' +
      'data-role="' + (ax ? 'axis' : 'grade') + '" data-slot="' + slot + '"' +
      (axisId ? ' data-axis="' + esc(axisId) + '"' : '') +
      ' aria-label="' + esc(label) + ' for response ' + slot.toUpperCase() + '">' +
      '<option value=""' + (chosen == null ? ' selected' : '') + '>skip</option>';
    levels.forEach(function (l) {
      var on = chosen != null && String(chosen) === String(l.rank);
      /* native option text cannot carry markup — the emphasis strips */
      h += '<option value="' + l.rank + '"' + (on ? ' selected' : '') + '>' +
        esc(window.JD_labelText(l.label || l.id)) + '</option>';
    });
    h += '</select>';
    if (axisId) {
      h += '<div class="jd-noterow" data-notewrap="' + slot + '-' + esc(axisId) +
        '"' + (noteVal ? '' : ' hidden') + '>' +
        '<input type="text" class="jd-turn-input jd-turn-note" maxlength="' +
        MAX_NOTE + '" placeholder="a note, if you have one" ' +
        'aria-label="note on ' + esc(label) + ' for response ' +
        slot.toUpperCase() + '" data-role="note" data-slot="' + slot +
        '" data-axis="' + esc(axisId) + '" value="' + esc(noteVal) + '"></div>';
    }
    return h + '</div>';
  }

  /* the step rail. First pass is linear (a step unlocks when the one before
     it is left), back is always one press; a degraded one-survivor turn has
     no rail at all — one panel, then file. */
  function railHTML(ok) {
    var steps = ok.map(function (s) {
      return { id: s, n: ok.indexOf(s) + 1, label: 'response ' + s.toUpperCase(), short: s.toUpperCase() };
    });
    steps.push({ id: 'call', n: ok.length + 1, label: 'the call', short: 'CALL' });
    var h = '<div class="jd-rail" role="list">';
    steps.forEach(function (st) {
      var current = work.step === st.id;
      var reached = !!work.reached[st.id];
      h += '<button type="button" role="listitem" class="jd-rail-step' +
        (current ? ' is-current' : '') + '" data-act="step" data-step="' + st.id +
        '"' + (reached ? '' : ' disabled') +
        (current ? ' aria-current="step"' : '') +
        ' aria-label="step ' + st.n + ' — ' + esc(st.label) + '">' +
        '<b>' + st.n + '</b><span class="jd-rail-long"> · ' + esc(st.label) +
        '</span><span class="jd-rail-short" aria-hidden="true"> · ' +
        esc(st.short) + '</span></button>';
    });
    return h + '</div>';
  }

  /* the pinned plate: the artwork stays in view for the whole panel */
  function benchPin(slot) {
    return '<div class="jd-bench-pin">' + plate(slot, { small: true }) +
      '<div class="jd-bench-col"><b>Response ' + slot.toUpperCase() + '</b>' +
      '<span>graded alone — no names until filed</span></div></div>';
  }

  function benchPanel(slot, ok) {
    var r = work.ratings[slot];
    var idx = ok.indexOf(slot);
    var two = ok.length > 1;
    var h = '<section class="jd-turn-panel">' + benchPin(slot) +
      scaleRow(slot, 'grade', null, r.grade);
    liveAxes().forEach(function (ax) {
      h += scaleRow(slot, 'axis', ax, r.axes[ax.id]);
    });
    /* the report path (APP §4.6), verbatim wording; note revealed in place */
    h += '<label class="jd-turn-check jd-turn-flag">' +
      '<input type="checkbox" data-role="flag" data-slot="' + slot + '"' +
      (r.flag ? ' checked' : '') + '>' +
      '<span>this response is broken or offensive</span></label>' +
      '<div data-flagnote="' + slot + '"' + (r.flag ? '' : ' hidden') + '>' +
      '<input type="text" class="jd-turn-input jd-turn-note" maxlength="' +
      MAX_NOTE + '" placeholder="what is wrong with it?" ' +
      'aria-label="note on the report for response ' + slot.toUpperCase() +
      '" data-role="flagnote" data-slot="' + slot + '" value="' +
      esc(r.flagNote || '') + '"></div></section>';
    var acts = '';
    if (idx > 0) {
      acts += '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>';
    }
    if (!two) {
      acts += '<button type="button" class="jd-turn-go" data-act="file">file the grades</button>';
    } else {
      var next = idx + 1 < ok.length ? 'response ' + ok[idx + 1].toUpperCase() : 'the call';
      acts += '<button type="button" class="jd-turn-go" data-act="next">next — ' +
        esc(next) + ' &rarr;</button>';
    }
    return h + actions(acts);
  }

  /* THE CALL — the preserved likert finale (mockup 10c salvage, kept by the
     owner through the round-10 review: the call as geometry, five title-only
     stops on a rail strung A-left to B-right, tooltips per stop, the ⓘ
     unfolding the whole scale, filed as winner + margin). */
  function callPanel(ok) {
    var chosen = likertChosen();
    var h = '<section class="jd-turn-panel">' +
      '<div class="jd-turn-plates">' +
      ok.map(function (s) { return plate(s); }).join('') + '</div>' +
      '<div class="jd-call">' +
      '<div class="jd-rowhead">' +
      '<button type="button" class="jd-def" data-act="def" aria-expanded="false" ' +
      'aria-controls="jd-pop-call" data-tt-t="the call" data-tt-d="Which ' +
      'response belongs in the drawer, and by how much.">' +
      '<span>the call — which belongs in the drawer?</span>' +
      '<span class="jd-i" aria-hidden="true">i</span></button></div>' +
      '<div class="jd-pop" id="jd-pop-call" hidden>' +
      '<p class="jd-pop-desc">The one required answer when both drawings ' +
      'survived. It is filed as a winner plus a margin (a tie has no margin).</p><dl>';
    LIKERT.forEach(function (o) {
      h += '<dt>' + esc(o.title) + '</dt><dd>' + esc(o.desc) + '</dd>';
    });
    h += '</dl></div>' +
      '<p class="jd-call-req">required — everything before it is optional</p>' +
      '<div class="jd-likert" role="radiogroup" ' +
      'aria-label="the call: which response belongs in the drawer"' +
      (work.winner && work.winner !== 'tie' ? ' data-pick="' + work.winner + '"' : '') + '>' +
      '<span class="jd-lk-end jd-lk-end--a" aria-hidden="true">A</span>' +
      '<div class="jd-lk-rail">';
    LIKERT.forEach(function (o) {
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
    h += '</div><span class="jd-lk-end jd-lk-end--b" aria-hidden="true">B</span></div>';
    LIKERT.forEach(function (o) {
      h += '<span class="jd-vh" id="jd-d-call-' + o.id + '">' +
        esc(o.title + ' — ' + o.desc) + '</span>';
    });
    h += '</div></section>';
    return h + actions(
      '<button type="button" class="jd-turn-alt" data-act="back">&larr; back</button>' +
      '<button type="button" class="jd-turn-go" data-act="file"' +
      (work.winner ? '' : ' disabled') + '>file the grades</button>');
  }

  function viewRate() {
    var ok = okSlots();
    /* a restored or degraded turn may hold a step that no longer exists */
    if (work.step !== 'call' && ok.indexOf(work.step) === -1) work.step = ok[0];
    if (work.step === 'call' && ok.length < 2) work.step = ok[0];
    work.reached[work.step] = true;
    var two = ok.length > 1;
    return head('Grade what came back') +
      '<p class="jd-turn-copy">' + (two
        ? 'One at a time: A alone, then B alone, then the call. Everything ' +
          'is optional except the call. Titles only — press an i for what ' +
          'a scale means. The scale is the drawer’s own.'
        : 'Only one drawing survived, so it is graded alone. Everything is ' +
          'optional. Titles only — press an i for what a scale means.') + '</p>' +
      (two ? railHTML(ok) : '') +
      (work.step === 'call' ? callPanel(ok) : benchPanel(work.step, ok));
  }

  /* ---------- 7. unveil ---------------------------------------------------- */
  function revealFor(slot) {
    var list = (work.reveal || []);
    for (var i = 0; i < list.length; i++) if (list[i].slot === slot) return list[i];
    return null;
  }
  function viewUnveil() {
    var lines = (work.reveal || []).map(function (r) {
      var who = esc(r.label || r.model_id || '');
      var vendor = r.vendor ? ' <span class="jd-turn-dim">(' + esc(r.vendor) + ')</span>' : '';
      var fate = r.status && r.status !== 'ok'
        ? ' <span class="jd-turn-dim">— didn’t survive</span>' : '';
      return '<li><b>' + esc((r.slot || '').toUpperCase()) + '</b> was ' +
        who + vendor + fate + '</li>';
    }).join('');
    var h = head('Who drew what') + '<ul class="jd-turn-reveal">' + lines + '</ul>';
    if (work.winner === 'tie' && !work.kept) {
      h += '<p class="jd-turn-copy">A tie is filed as a tie. Keep one for your ' +
        'own drawer anyway?</p>' +
        pillRow('jd-keep', 'which drawing to keep', [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: '', label: 'neither' }
        ], work.keep, ' data-role="keep"') +
        actions('<button type="button" class="jd-turn-go" data-act="keep">put it in the drawer</button>');
    } else {
      h += '<p class="jd-turn-copy">' + (work.placed
        ? 'It’s in the drawer — yours only, tagged as such. Dig it out ' +
          'and the specimen tag knows whose it is.'
        : 'Nothing kept. The grades are filed all the same.') + '</p>' +
        actions('<button type="button" class="jd-turn-go" data-act="done">done</button>');
    }
    return h;
  }

  /* ---------- the failure end ---------------------------------------------- */
  function viewApology() {
    return head('Nothing came back') +
      '<p class="jd-turn-copy">' + esc(work && work.notice
        ? work.notice
        : 'Both machines failed. This cost you nothing — the drawer will try ' +
          'again whenever you like.') + '</p>' +
      actions('<button type="button" class="jd-turn-go" data-act="again">try again</button>' +
        '<button type="button" class="jd-turn-alt" data-act="done">close</button>');
  }

  /* The heading is the landing place for every state that has no field of its
     own to fill in (C5.8): moving through the flow should read as the step you
     just reached, not as the dismiss control that happens to come first in the
     DOM. tabindex="-1" makes it focusable without adding a tab stop. States
     that DO have a field (consent, prompt) pass noFocus and keep it. */
  function head(t, noFocus) {
    stateTitle = t;
    return '<h2 class="jd-turn-title" tabindex="-1"' +
      (noFocus ? '' : ' data-autofocus') + '>' + esc(t) + '</h2>';
  }
  function actions(inner) { return '<div class="jd-turn-actions">' + inner + '</div>'; }

  /* ---------- input plumbing ---------------------------------------------- */
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
    if (role === 'consent') {
      work = work || blankWork();
      work.consented = t.checked;
      setDisabled('[data-act="consent"]', !t.checked);
    } else if (role === 'grade') {
      work.ratings[slot].grade = val == null ? null : Number(val);
      t.classList.toggle('is-set', val != null);
    } else if (role === 'axis') {
      work.ratings[slot].axes[t.getAttribute('data-axis')] =
        val == null ? null : Number(val);
      t.classList.toggle('is-set', val != null);
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
      setDisabled('[data-act="file"]', !work.winner);
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
    } else if (role === 'note') {
      work.ratings[t.getAttribute('data-slot')].notes[t.getAttribute('data-axis')] =
        t.value.slice(0, MAX_NOTE);
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
    if (act === 'consent') {
      JD_store.set(K_CONSENT, {
        version: JD_CONSENT.version, at: new Date().toISOString()
      });
      go('prompt');
    } else if (act === 'generate') {
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
    } else if (act === 'def') {
      /* one definitions popover at a time; press again, Esc, or any other
         def to fold it. In-flow, so it never covers a control. */
      var wasOpen = b.getAttribute('aria-expanded') === 'true';
      closeDefs();
      if (!wasOpen) {
        b.setAttribute('aria-expanded', 'true');
        var pop = bodyEl.querySelector('#' + b.getAttribute('aria-controls'));
        if (pop) pop.hidden = false;
      }
    } else if (act === 'note-toggle') {
      var key = b.getAttribute('data-slot') + '-' + b.getAttribute('data-axis');
      var wrap = bodyEl.querySelector('[data-notewrap="' + key + '"]');
      if (wrap) {
        var opening = wrap.hidden;
        wrap.hidden = !opening;
        b.setAttribute('aria-expanded', opening ? 'true' : 'false');
        if (opening) {
          var input = wrap.querySelector('input');
          if (input) { try { input.focus(); } catch (err) {} }
        }
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
      prompt: '', consented: hasConsent(), notice: '', slow: false,
      slots: { a: { status: 'pending' }, b: { status: 'pending' } },
      ratings: { a: blankRating(), b: blankRating() },
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

  /* ---------- generating: two parallel calls, one shared client_ref -------- */
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
      slots: { a: { status: 'pending' }, b: { status: 'pending' } }
    };
    persist();
    work.slow = false;
    work.notice = '';
    work.slots = { a: { status: 'pending' }, b: { status: 'pending' } };
    go('generating');
    startSlowTimer();
    JD_track('turn_submit', null);
    ['a', 'b'].forEach(function (slot) {
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

  /* each slot lands on its own — the UI never waits for the pair */
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
    if (work.slots.a.status === 'pending' || work.slots.b.status === 'pending') return;
    stopSlowTimer();
    if (okSlots().length) { go('reveal'); return; }
    /* nothing survived: a limit refusal goes back to the brief with honest
       copy (no submission was created), anything else is an apology */
    var codes = ['a', 'b'].map(function (s) { return work.slots[s].code; });
    var limited = codes.filter(function (c) {
      return c === 'rate_limited' || c === 'drawer_resting';
    })[0];
    if (limited) {
      var wait = work.slots.a.retry_after || work.slots.b.retry_after;
      var notice = limited === 'drawer_resting'
        ? 'the drawer is resting — it has drawn all it can today. come back ' +
          'tomorrow.'
        : 'you’ve had a few turns already. the drawer will take another ' +
          'in about ' + humanWait(wait) + '.';
      var draft = work.prompt;
      clearTurn();                 /* no submission was created — nothing to keep */
      work = blankWork();
      work.prompt = draft;
      work.notice = notice;
      go('prompt');
      return;
    }
    work.notice = codes.indexOf('sanitizer_rejected') !== -1
      ? 'both machines answered with something the drawer wouldn’t accept ' +
        '— it rejects rather than repairs. This cost you nothing.'
      : 'Both machines failed. This cost you nothing — the drawer will try ' +
        'again whenever you like.';
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
        var row = { gen_id: gen, kind: 'axis', axis_id: axisId, value: r.axes[axisId] };
        if (r.notes[axisId]) row.note = r.notes[axisId].slice(0, MAX_NOTE);
        ratings.push(row);
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
      paint(head('The grades didn’t file') +
        '<p class="jd-turn-copy">The drawer couldn’t record them ' +
        '(' + esc(code) + '). Nothing was written — the whole batch goes ' +
        'together or not at all.</p>' +
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
    else if (work.winner === 'a' || work.winner === 'b') placeWinner(work.winner);
    go('unveil');
  }

  /* ---------- the won item joins the pile (C5.3 / C5.4 step 7) ------------- */
  function placeWinner(slot) {
    var s = work.slots[slot];
    if (!s || s.status !== 'ok' || !s.svg) return;
    var rv = revealFor(slot) || {};
    var r = work.ratings[slot];
    var annotations = {};
    Object.keys(r.axes).forEach(function (axisId) {
      if (r.axes[axisId] == null) return;
      annotations[axisId] = r.notes[axisId]
        ? { value: r.axes[axisId], note: r.notes[axisId] }
        : r.axes[axisId];
    });
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
      annotations: annotations
    };
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
    payload.items.unshift({
      id: rec.gen_id, title: title, prompt: rec.prompt, created: day,
      visitor: true, sizeClass: VISITOR_TIER, primary: 'r1',
      responses: [{
        rid: 'r1', file: file, model: rec.model_id, date: day,
        generation: { mode: 'one-shot', prompt_count: 1 },
        grade: rec.grade, annotations: rec.annotations || {},
        /* a data: URL, and the ONLY thing the card may do with it is hang it
           off the download link — `visitor: true` above stops ensureSVGs from
           ever treating it as a path to join to JD_API (APP §4.1); the SVG
           text itself is primed into the cache below */
        url: svgDataUrl(rec.svg), transcript_url: null
      }]
    });
    var primed = {};
    primed[rec.gen_id + '/' + file] = rec.svg;
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
