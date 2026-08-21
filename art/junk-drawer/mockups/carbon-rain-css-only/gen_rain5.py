# -*- coding: utf-8 -*-
"""Round G — the carbon rain, built the way the app actually builds things.

junk-drawer.js already generates every loader's markup at runtime, so the
"pure CSS" constraint that shaped rounds C-F does not apply. A stream fires
animationiteration exactly when it wraps — which is exactly when every one of
its squares is off the sheet — so that is where the characters get re-rolled.
Invisible, unbounded, and about a tenth of the DOM.
"""
import json, sys
sys.path.insert(0, '.')
from sieved import SIEVED

HAND = {
 "lat": (10.0, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
 "dig": (10.0, "0123456789"),
 "mrk": (10.0, "/-.:§¶№×÷±°†‡¤¢£¥"),
 "mth": (10.0, "∑∏∫√∞≠≤≥∂∆∇⊂⊃∈∀∃⊕⊗"),
 "pla": (10.0, "☉☽☿♀♁♂♃♄♅♆♇☊☋"),
}
WEIGHTS = {
 "lat":13,"dig":7,"mrk":5,
 "grk":6,"cyr":6,"heb":5,"arb":5,"dev":5,"geo":4,"arm":4,"cjk":4,"han":4,"tha":3,
 "che":6,"des":6,"tib":5,
 "brh":3,"sid":3,"shr":3,"gra":3,"khr":3,
 "ben":2,"gur":2,"guj":2,"ori":2,"tam":2,"tel":2,"kan":2,"mal":2,"sin":2,"mya":2,"khm":2,
 "run":4,"got":3,"ita":3,"phn":3,"lnb":3,"cop":3,"tfn":3,"osa":3,"shw":3,"vai":3,
 "adl":3,"nko":3,"yii":3,"gla":3,"eth":3,"syr":3,"thn":3,"lao":3,"bam":2,
 "ave":2,"olt":2,"arc":2,"nab":2,"pal":2,"man":2,"car":2,"lyc":2,"lyd":2,"ugr":2,
 "opr":2,"mer":2,"olc":2,"cham":2,"bali":2,"java":2,"bugi":2,"batk":2,"lisu":2,
 "bass":2,"mend":2,"wcho":2,"rohg":2,"tale":2,
 "mth":3,"pla":2,"alc":2,
}
NAMES = {
 "lat":"Latin","dig":"Digits","mrk":"Marks","mth":"Math","pla":"Planetary","alc":"Alchemy",
 "grk":"Greek","cyr":"Cyrillic","heb":"Hebrew","arb":"Arabic","geo":"Georgian",
 "arm":"Armenian","che":"Cherokee","des":"Deseret","tib":"Tibetan","han":"Hangul",
 "cjk":"Chinese","run":"Runic","got":"Gothic","ita":"Old Italic","phn":"Phoenician",
 "lnb":"Linear B","cop":"Coptic","tfn":"Tifinagh","osa":"Osage","shw":"Shavian",
 "vai":"Vai","adl":"Adlam","nko":"N'Ko","yii":"Yi","gla":"Glagolitic","eth":"Ethiopic",
 "syr":"Syriac","thn":"Thaana","lao":"Lao","bam":"Bamum","dev":"Devanagari",
 "brh":"Brahmi","sid":"Siddham","shr":"Sharada","gra":"Grantha","khr":"Kharoshthi",
 "ben":"Bengali","gur":"Gurmukhi","guj":"Gujarati","ori":"Odia","tam":"Tamil",
 "tel":"Telugu","kan":"Kannada","mal":"Malayalam","sin":"Sinhala","tha":"Thai",
 "mya":"Myanmar","khm":"Khmer","ave":"Avestan","olt":"Old Turkic","arc":"Aramaic",
 "nab":"Nabataean","pal":"Palmyrene","man":"Manichaean","car":"Carian","lyc":"Lycian",
 "lyd":"Lydian","ugr":"Ugaritic","opr":"Old Permic","mer":"Meroitic","olc":"Ol Chiki",
 "cham":"Cham","bali":"Balinese","java":"Javanese","bugi":"Buginese","batk":"Batak",
 "lisu":"Lisu","bass":"Bassa Vah","mend":"Mende","wcho":"Wancho","rohg":"Rohingya",
 "tale":"Tai Le",
}
POOL = {}
for k, wt in WEIGHTS.items():
    if k in HAND:      sz, ch = HAND[k]
    elif k in SIEVED:  sz, ch = SIEVED[k]["size"], SIEVED[k]["chars"]
    else:              continue
    POOL[k] = {"w": wt, "s": sz, "c": ch, "n": NAMES.get(k, k)}

MIRROR_OK = ["lat", "dig", "grk", "cyr", "mrk"]
SYMMETRIC = ("AHIMOTUVWXY08.:×÷±°‡†"
             "ΑΔΗΘΙΛΜΞΟΠΤΥΦΧΨΩ"
             "АДЖЛМНОПТФХШ")

RAIN_JS = r"""
/* ===========================================================================
   THE CARBON RAIN — the runtime. Everything here is what junk-drawer.js
   would own: build the columns once, then re-roll each one at the instant it
   wraps off the top of the sheet.
   ======================================================================== */
(function () {
  var POOL = window.__JD_POOL, MIRROR_OK = window.__JD_MIRROR_OK,
      SYM = window.__JD_SYM, CELL = 9;

  /* the weighted bag: a script's weight decides how often it turns up, the
     character inside it is then drawn flat, so pool size and frequency stay
     independent of each other */
  var BAG = [];
  for (var k in POOL) {
    /* Array.from splits by CODE POINT. Plain string indexing splits by UTF-16
       code unit, which tears every astral-plane script — Deseret, Linear B,
       Gothic, Osage, Shavian, Adlam, Brahmi, Siddham, Kharoshthi all live
       above U+FFFF — into lone surrogates that render as boxes. */
    POOL[k].a = Array.from(POOL[k].c);
    for (var i = 0; i < POOL[k].w; i++) BAG.push(k);
  }
  var MOK = {}; for (var i = 0; i < MIRROR_OK.length; i++) MOK[MIRROR_OK[i]] = 1;

  function rnd(n) { return Math.floor(Math.random() * n); }

  /* one struck character: script by weight, glyph flat within it, and a
     reversal only where a reader would notice one */
  function strike(el) {
    var key = BAG[rnd(BAG.length)], set = POOL[key].a;
    var ch = set[rnd(set.length)];
    var mir = MOK[key] && SYM.indexOf(ch) < 0 && Math.random() < 0.18;
    el.className = "k-" + key + (mir ? " m" : "") +
                   (el.dataset.spin ? " sp" + el.dataset.spin : "");
    el.textContent = ch;
    el.dataset.word = "";
  }

  function fillStream(dr, words) {
    var cells = dr.children, n = cells.length, i;
    for (i = 0; i < n; i++) strike(cells[i]);
    /* the word is re-rolled with everything else, so it never gets welded
       into one column for the length of a wait */
    if (Math.random() < dr.__wordP) {
      var pool = words.filter(function (w) { return w.length + 2 <= n; });
      if (pool.length) {
        var w = pool[rnd(pool.length)], at = rnd(n - w.length + 1);
        /* the office's own two words are struck harder than the job's */
        var heavy = (w === "LOADING" || w === "STAND BY");
        for (i = 0; i < w.length; i++) {
          var c = cells[at + i];
          c.className = "k-lat wd" + (heavy ? " hv" : "");
          c.textContent = w.charAt(i) === " " ? "" : w.charAt(i);
          c.dataset.word = "1";
        }
      }
    }
  }

  window.JD_rain = function (host, opt) {
    opt = opt || {};
    var W = host.clientWidth, H = host.clientHeight;
    /* the travel distance every stream animates against — the sheet, not
       itself. Without this the wrap happens in view. */
    host.style.setProperty("--H", H + "px");
    var words = opt.words || ["LOADING", "STAND BY"];
    /* Every column carries a stream. The gaps in the rain are made by giving
       each stream a run-up above the sheet, so a column is empty for part of
       its cycle and fills again — instead of a column being dealt "empty" at
       build time and staying blank for the whole wait, which reads as a fault
       rather than as rhythm. */
    var spdLo = opt.spdLo || 20, spdHi = opt.spdHi || 34;   /* px per second */
    var opaLo = opt.opaLo || 0.66, opaHi = opt.opaHi || 1.0;
    var spinP = opt.spinP == null ? 0.07 : opt.spinP;
    var wordP = opt.wordP == null ? 0.08 : opt.wordP;
    var rows = Math.floor(H / CELL), frag = document.createDocumentFragment();
    var streams = [];

    for (var c = 0; c < Math.floor(W / CELL); c++) {
      var col = document.createElement("span");
      col.className = "cl";
      col.style.left = (c * CELL) + "px";
      col.style.setProperty("--o", (opaLo + Math.random() * (opaHi - opaLo)).toFixed(2));
      var ndrop = Math.random() < 0.45 ? 2 : 1;
      var len = 7 + rnd(Math.max(2, rows - 7));
      var body = len * CELL;
      var gap  = Math.round(body * (0.08 + Math.random() * 1.05)); /* the run-up */
      var lead = body + gap;
      var travel = H + lead;
      var d = travel / (spdLo + Math.random() * (spdHi - spdLo));
      var base = Math.random() * d;
      for (var s = 0; s < ndrop; s++) {
        var dr = document.createElement("span");
        dr.className = "dr";
        dr.style.setProperty("--dh", lead + "px");     /* body + run-up */
        dr.style.setProperty("--d", d.toFixed(2) + "s");
        var ph = (base + s * d / 2) % d;
        dr.style.setProperty("--dl", (-ph).toFixed(2) + "s");
        dr.style.setProperty("--y0", Math.round(-lead + travel * ph / d) + "px");
        for (var i = 0; i < len; i++) {
          var cell = document.createElement("i");
          if (Math.random() < spinP) {
            cell.dataset.spin = Math.random() < 0.5 ? " ccw" : "";
            cell.style.setProperty("--sd", (3.5 + Math.random() * 5.5).toFixed(2) + "s");
          }
          dr.appendChild(cell);
        }
        dr.__wordP = wordP;
        fillStream(dr, words);
        /* THE WHOLE TRICK. animationiteration fires the instant the stream
           wraps from the bottom edge back above the top — the one moment
           every square in it is off the sheet. Re-roll there and the column
           arrives new every pass, seen by nobody, forever. */
        dr.addEventListener("animationiteration", function (e) {
          /* animationiteration BUBBLES. Every pinwheel square inside this
             stream runs its own `spin`, and those events arrive here too — so
             without this guard a column re-rolls every time one of its
             pinwheels completes a turn, mid-fall and in plain sight. */
          if (e.target !== this || e.animationName !== "fall") return;
          fillStream(this, words);
        });
        col.appendChild(dr);
        streams.push(dr);
      }
      frag.appendChild(col);
    }
    host.appendChild(frag);

    /* the slow in-view re-strike: a few squares a second, chosen at random,
       caught out of the corner of an eye rather than watched */
    var rate = opt.visibleRate == null ? 9 : opt.visibleRate;
    if (rate > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInterval(function () {
        for (var i = 0; i < rate; i++) {
          var dr = streams[rnd(streams.length)];
          if (!dr) continue;
          var cell = dr.children[rnd(dr.children.length)];
          if (cell && !cell.dataset.word) strike(cell);
        }
      }, 1000);
    }
    return streams.length;
  };
})();
"""

CSS = """
:root{
  --tpaper:#ece0bf; --tpaper-hi:#f4ead0; --plate:#f8f3e2;
  --tink:#33240f; --tink-2:rgba(51,36,15,.68); --tink-3:rgba(51,36,15,.44);
  --trule:rgba(74,53,18,.40); --trule-2:rgba(74,53,18,.19);
  --blue:#4a628a; --graphite:#4b4030; --tred:#b3402f;
  --tmono:"Courier Prime","Courier New",Courier,monospace;
  --tform:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
  --thand:"Bradley Hand","Segoe Print","Chalkboard SE",Chalkboard,cursive;
  --tgrain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='170' height='170'%3E%3Cfilter id='g' x='0%25' y='0%25' width='100%25' height='100%25' color-interpolation-filters='sRGB'%3E%3CfeTurbulence stitchTiles='stitch' type='fractalNoise' baseFrequency='0.86' numOctaves='3' seed='7'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.34 0 0 0 0 0.26 0 0 0 0 0.13 0 0 0 0.17 0'/%3E%3C/filter%3E%3Crect width='170' height='170' filter='url(%23g)'/%3E%3C/svg%3E");
}
*{box-sizing:border-box}
body{margin:0;padding:44px 20px 70px;background:var(--tpaper) var(--tgrain);
     color:var(--tink);font-family:var(--tmono)}
.sheet{max-width:1000px;margin:0 auto}
h1{font-family:var(--tform);font-size:1.5rem;font-weight:700;letter-spacing:.30em;
   text-transform:uppercase;margin:0 0 8px;text-align:center}
.plateno{text-align:center;font-size:.58rem;letter-spacing:.22em;color:var(--tink-3);
   text-transform:uppercase}
hr.rule{border:0;border-top:1px solid var(--trule);margin:24px 0 0}
.dek{max-width:600px;margin:26px auto 0;font-size:.68rem;line-height:1.95;color:var(--tink-2)}
.dek b{color:var(--tink);font-weight:400;border-bottom:1px solid var(--trule-2)}
h2.sechead{font-family:var(--tform);font-size:.76rem;font-weight:700;letter-spacing:.28em;
   text-transform:uppercase;display:flex;align-items:center;gap:14px;margin:54px 0 5px}
h2.sechead::before,h2.sechead::after{content:"";flex:1;border-top:1px solid var(--trule-2)}
.secsub{text-align:center;font-size:.56rem;letter-spacing:.14em;color:var(--tink-3);
   margin:0 0 26px;line-height:1.8}

.sw{position:relative;width:var(--w);height:var(--h);overflow:hidden;
  background:
    repeating-linear-gradient(0deg,  rgba(74,98,138,.17) 0 1px, transparent 1px 45px),
    repeating-linear-gradient(90deg, rgba(74,98,138,.17) 0 1px, transparent 1px 45px),
    repeating-linear-gradient(0deg,  rgba(74,98,138,.07) 0 1px, transparent 1px 9px),
    repeating-linear-gradient(90deg, rgba(74,98,138,.07) 0 1px, transparent 1px 9px),
    var(--plate);
  border:1px solid rgba(55,65,79,.30);
  box-shadow:0 4px 10px -3px rgba(46,34,12,.5), 0 1px 3px rgba(46,34,12,.35)}
.sw-letter{position:absolute;top:3px;left:7px;z-index:3;font-family:var(--thand);
  font-size:.9rem;color:var(--graphite);opacity:.85}
.rain{position:absolute;left:0;top:0;right:0;bottom:0;display:block;overflow:hidden;z-index:1}
.cl{position:absolute;top:0;display:block;opacity:var(--o)}
.dr{position:absolute;top:0;left:0;display:block;transform:translateY(var(--y0))}
.dr i{display:block;width:9px;height:9px;line-height:9px;text-align:center;
  font-family:var(--tmono);color:var(--blue);font-style:normal;overflow:hidden}
.dr i.m{transform:scaleX(-1)}
.dr i.wd{color:var(--tink-2)}
.dr i.hv{font-weight:700;color:var(--tink)}
.dr i.sp{overflow:visible}
""" + "\n".join(".k-%s{font-size:%spx}" % (k, v["s"]) for k, v in POOL.items()) + """

/* --H is the SHEET's height, set on the rain host in JS. A percentage in
   translateY resolves against the element's OWN height, so 100% here would
   move a stream by its own length and wrap it mid-sheet, in full view. */
@keyframes fall{from{transform:translateY(calc(-1 * var(--dh)))}
                to  {transform:translateY(var(--H))}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
@keyframes spinccw{from{transform:rotate(0)}to{transform:rotate(-360deg)}}
@media (prefers-reduced-motion: no-preference){
  .dr{animation:fall var(--d) linear var(--dl) infinite}
  .dr i.sp{animation:spin var(--sd) linear infinite}
  .dr i.sp.ccw{animation-name:spinccw}
}
@media (prefers-reduced-motion: reduce){ .dr,.dr i.sp{animation:none !important} }

.hero{display:flex;gap:34px;align-items:flex-start;flex-wrap:nowrap;overflow-x:auto;
  width:fit-content;max-width:100%;margin:0 auto;padding-bottom:10px}
.hero>figure{flex:0 0 auto;margin:0}
.magcap{font-size:.5rem;letter-spacing:.14em;text-transform:uppercase;color:var(--tink-3);
  text-align:center;margin:8px 0 0}
.card{width:460px;height:460px;margin:0 auto;position:relative;
  background:var(--tpaper-hi) var(--tgrain);border:1px solid rgba(74,53,18,.3);
  box-shadow:0 10px 26px -8px rgba(20,10,2,.5)}
.card .sw{position:absolute}
.p-a{left:5.5%;top:9%;transform:rotate(-1.8deg)}
.p-b{right:5.5%;top:9.5%;transform:rotate(1.5deg)}
.p-c{left:6.5%;bottom:9.5%;transform:rotate(1.4deg)}
.p-d{right:6.5%;bottom:9%;transform:rotate(-1.6deg)}
.alpha{column-count:3;column-gap:26px;max-width:980px;margin:0 auto}
@media (max-width:820px){.alpha{column-count:2}}
@media (max-width:560px){.alpha{column-count:1}}
.al{display:flex;align-items:baseline;gap:6px;break-inside:avoid;margin-bottom:5px}
.al .nm{font-size:.47rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--tink-3);min-width:76px;text-align:right;flex:0 0 auto}
.al .row{overflow:hidden;white-space:nowrap}
.al .row i{display:inline-block;width:9px;height:9px;line-height:9px;text-align:center;
  color:var(--blue);font-family:var(--tmono);font-style:normal;overflow:hidden;
  vertical-align:middle}
.constr{max-width:630px;margin:44px auto 0;font-size:.6rem;line-height:1.9;color:var(--tink-3)}
.constr b{color:var(--tink-2);font-weight:400}
.constr code{font-size:.95em;color:var(--tink-2)}
#perf{text-align:center;font-size:.55rem;letter-spacing:.12em;color:var(--tink-3);
  margin-top:14px;text-transform:uppercase}
footer{margin-top:54px;padding-top:12px;border-top:1px solid var(--trule);
  font-size:.54rem;letter-spacing:.14em;color:var(--tink-3);text-align:center;
  text-transform:uppercase;line-height:2}
"""

NCHARS = len(set().union(*[set(v["c"]) for v in POOL.values()]))
WORDS = ["LOADING", "STAND BY", "GREEK", "COLUMN", "IONIC", "STYLE"]

def build():
    p = ['<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">',
         '<meta name="viewport" content="width=device-width,initial-scale=1">',
         '<meta name="robots" content="noindex">',
         '<title>The Carbon Rain &mdash; round G</title>',
         '<style>%s</style></head><body><div class="sheet">' % CSS,
         '<h1>The Carbon Rain</h1>',
         '<div class="plateno">The Junk Drawer &middot; one wait indicator &middot; round G '
         '&middot; %d scripts, %d characters &middot; built the way the app builds</div>'
         % (len(POOL), NCHARS),
         '<hr class="rule">',
         '<p class="dek">Same rain, rebuilt on the mechanism the app already uses. '
         '<b>Nothing repeats.</b> A stream fires <code>animationiteration</code> at the '
         'instant it wraps &mdash; the one moment every square in it is off the sheet &mdash; '
         'so that is where its characters are drawn again, from all %d of them across %d '
         'writing systems. The change is never seen and the supply never runs out. The word a '
         'stream carries is re-drawn with it, so no word is welded into one column for the '
         'length of a wait. About one square in fourteen turns on its own centre as it falls, '
         'and a few squares a second re-strike in plain view.</p>' % (NCHARS, len(POOL))]

    p.append('<h2 class="sechead">As It Stands</h2>')
    p.append('<div class="secsub">true size, 230 &times; 185 &mdash; and the sheet as it '
             'appears on a phone</div>')
    p.append('<div class="hero">')
    p.append('<figure><div class="sw" style="--w:230px;--h:185px" data-rain>'
             '<span class="sw-letter">a</span></div>'
             '<p class="magcap">True size &middot; 230 &times; 185</p></figure>')
    p.append('<figure><div class="sw" style="--w:137px;--h:110px" data-rain>'
             '<span class="sw-letter">a</span></div>'
             '<p class="magcap">Phone &middot; 137 &times; 110</p></figure>')
    p.append('</div>')

    p.append('<h2 class="sechead">In Situ &middot; The Darkroom Card</h2>')
    p.append('<div class="secsub">four sheets at true card size &mdash; the real load</div>')
    p.append('<div class="card">')
    for letter, pos in (("a","p-a"),("b","p-b"),("c","p-c"),("d","p-d")):
        p.append('<div class="sw %s" style="--w:189px;--h:152px" data-rain>'
                 '<span class="sw-letter">%s</span></div>' % (pos, letter))
    p.append('</div><p id="perf">measuring&hellip;</p>')

    p.append('<h2 class="sechead">The Keys</h2>')
    p.append('<div class="secsub">every script in the pool, at the size that puts it on the '
             'same advance as the Latin &mdash; the number is its share of all glyphs struck</div>')
    tot = sum(v["w"] for v in POOL.values())
    p.append('<div class="alpha">')
    for k, v in POOL.items():
        cl = list(v["c"]); st = max(1, len(cl) // 16)
        row = "".join('<i class="k-%s">%s</i>' % (k, c) for c in cl[::st][:16])
        p.append('<div class="al"><span class="nm">%s %d%%</span>'
                 '<span class="row">%s</span></div>'
                 % (v["n"], round(v["w"] / tot * 100), row))
    p.append('</div>')

    p.append('<p class="constr"><b>Construction.</b> Every glyph occupies one 9&times;9 cell, so '
             'characters sit inside printed squares and columns fall down printed rules. Each '
             'script carries its own font-size &mdash; measured, not guessed &mdash; so Cherokee '
             'at 8.9px, Deseret at 9.2px, Devanagari at 8.9px and Chinese at 6px all land on the '
             'same advance as Latin at 10px. The inventory is generated, not typed: each script '
             'enumerated from its full Unicode block, then sieved by ink density, shape-tested '
             'for missing-glyph boxes, filtered against <code>unicodedata</code>, de-duplicated, '
             'and checked for bitmap-identical glyphs. Ink weight is set once per column and '
             'never varies down its length. Reversal applies only to scripts a reader recognises '
             'and only to asymmetric glyphs. Motion is one transform per stream; the only '
             'per-square animation is the pinwheel. Under '
             '<code>prefers-reduced-motion: reduce</code> the streams never animate, so '
             '<code>animationiteration</code> never fires and the sheet holds the page of type '
             'it was first dealt.</p>')
    p.append('<footer>Ink on engineering paper &middot; the carbon rain &middot; round G<br>'
             '%d scripts, %d characters &middot; re-drawn at every wrap, seen by nobody<br>'
             'Nobody ever knew the percentage</footer>' % (len(POOL), NCHARS))
    p.append('</div>')

    p.append('<script>window.__JD_POOL=%s;window.__JD_MIRROR_OK=%s;window.__JD_SYM=%s;</script>'
             % (json.dumps(POOL, ensure_ascii=False),
                json.dumps(MIRROR_OK), json.dumps(SYMMETRIC)))
    p.append('<script>%s</script>' % RAIN_JS)
    p.append('<script>%s</script>' % ("""
    var WORDS = %s;
    document.querySelectorAll('[data-rain]').forEach(function (el) {
      var host = document.createElement('span');
      host.className = 'rain';
      el.appendChild(host);
      window.JD_rain(host, { words: WORDS });
    });
    (function(){var n=0,t0=performance.now(),last=t0,worst=0,slow=0;
      function tick(t){var dt=t-last;last=t;if(dt>worst)worst=dt;if(dt>20)slow++;n++;
        if(t-t0<4000)requestAnimationFrame(tick);
        else document.getElementById('perf').textContent=
          'measured here: '+Math.round(n/((t-t0)/1000))+' fps \\u00b7 worst frame '+
          Math.round(worst)+'ms \\u00b7 slow frames '+slow+'/'+n+' \\u00b7 '+
          document.querySelectorAll('.dr,.dr i.sp').length+' animations \\u00b7 '+
          document.querySelectorAll('.sw *').length+' elements';}
      requestAnimationFrame(tick);})();
    """ % json.dumps(WORDS)))
    p.append('</body></html>')
    return "".join(p)

open("mockup-G-carbon-rain.html", "w", encoding="utf-8").write(build())
print("written:", len(POOL), "scripts,", NCHARS, "characters")
