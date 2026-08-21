# -*- coding: utf-8 -*-
"""Round F — the carbon rain, multilingual, with mutating glyphs.
Owner settings: density as-is, pace as-is, ink HEAVY, carbon as-is, keys far out."""
import random

CELL = 9
SW_W, SW_H = 230, 185
PH_W, PH_H = 137, 110

# The characters and their sizes both come from sieved.py now — enumerated
# from each script's full Unicode block, sized by measurement, and filtered
# four ways. Only the WEIGHT is a judgement call, and weight is the only
# thing that decides how often a script appears: the character inside it is
# drawn uniformly, so inventory size and frequency are independent.
from sieved import SIEVED

HAND = {
 "lat": (10.0, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
 "dig": (10.0, "0123456789"),
 "mrk": (10.0, "/-.:\u00a7\u00b6\u2116\u00d7\u00f7\u00b1\u00b0\u2020\u2021\u00a4\u00a2\u00a3\u00a5"),
 # these three stay deliberately small — they are seasoning, not alphabets
 "mth": (10.0, "\u2211\u220f\u222b\u221a\u221e\u2260\u2264\u2265\u2202\u2206\u2207\u2282\u2283\u2208\u2200\u2203\u2295\u2297"),
 "pla": (10.0, "\u2609\u263d\u263f\u2640\u2641\u2642\u2643\u2644\u2645\u2646\u2647\u260a\u260b"),
}

WEIGHTS = {
 # the anchors
 "lat":13, "dig":7, "mrk":5,
 # widely read
 "grk":6, "cyr":6, "heb":5, "arb":5, "dev":5, "geo":4, "arm":4,
 "cjk":4, "han":4, "tha":3,
 # the owner's picks
 "che":6, "des":6, "tib":5,
 # Sanskrit's other hands
 "brh":3, "sid":3, "shr":3, "gra":3, "khr":3,
 # the Indic and south-east Asian family
 "ben":2, "gur":2, "guj":2, "ori":2, "tam":2, "tel":2, "kan":2,
 "mal":2, "sin":2, "mya":2, "khm":2,
 # alphabets with a long memory
 "run":4, "got":3, "ita":3, "phn":3, "lnb":3, "cop":3, "tfn":3,
 "osa":3, "shw":3, "vai":3, "adl":3, "nko":3, "yii":3, "gla":3,
 "eth":3, "syr":3, "thn":3, "lao":3, "bam":2,
 # further afield still
 "ave":2, "olt":2, "arc":2, "nab":2, "pal":2, "man":2, "car":2,
 "lyc":2, "lyd":2, "ugr":2, "opr":2, "mer":2, "olc":2, "cham":2,
 "bali":2, "java":2, "bugi":2, "batk":2, "lisu":2, "bass":2,
 "mend":2, "wcho":2, "rohg":2, "tale":2,
 # deliberately kept small
 "mth":3, "pla":2, "alc":2,
}

SCRIPTS = []
for k, wt in WEIGHTS.items():
    if k in HAND:
        sz, ch = HAND[k]
    elif k in SIEVED:
        sz, ch = SIEVED[k]["size"], SIEVED[k]["chars"]
    else:
        continue                      # a script the sieve threw out entirely
    SCRIPTS.append((k, sz, wt, ch))

# mirroring only reads as a gag on scripts a viewer RECOGNISES — a reversed
# Cherokee syllable is just another Cherokee syllable. And a symmetric glyph
# reversed is no glyph at all, so those come out too.
MIRROR_OK  = {"lat", "dig", "grk", "cyr", "mrk"}
SYMMETRIC  = set("AHIMOTUVWXY08.:×÷±°‡†"
                 "ΑΔΗΘΙΛΜΞΟΠΤΥΦΧΨΩ"
                 "АДЖЛМНОПТФХШ")

WEIGHTED = []
for key, size, wt, chars in SCRIPTS:
    WEIGHTED += [(key, chars)] * wt
SIZES = {k: s for k, s, w, c in SCRIPTS}

def pick(rnd):
    key, chars = WEIGHTED[rnd.randrange(len(WEIGHTED))]
    ch = chars[rnd.randrange(len(chars))]
    mir = key in MIRROR_OK and ch not in SYMMETRIC
    return key, ch, mir

def glyph(rnd, mirror_p, tag="b"):
    key, ch, ok = pick(rnd)
    cls = "k-" + key + (" m" if (ok and rnd.random() < mirror_p) else "")
    return '<%s class="%s">%s</%s>' % (tag, cls, ch, tag)

KEEP, DUR, OPA, MIRROR, TWO = 0.86, (6.0, 13.5), (0.66, 1.0), 0.18, 0.38

# the office's own two words, and the words of the job in hand. In production
# PROMPT is built from the visitor's actual prompt: upper-cased, stripped to
# A-Z, stop-words and anything under four letters dropped.
STATUS = ["LOADING", "STAND BY"]
PROMPT = ["GREEK", "COLUMN", "IONIC", "STYLE"]      # "a greek column in the ionic style"
WORD_P = 0.08       # chance a stream carries a word at all
WORD_SLOW = 1.7     # a stream carrying a word falls slower, so it recurs less
SPIN_P = 0.07       # share of cells that turn on their own centre as they fall

# How many characters a square carries in its stack. A column's pattern only
# comes back when EVERY square in it has come back, so the column repeats
# after lcm(all n) passes: with these four values that is 210 passes, or well
# over half an hour of falling. Nothing repeats inside a wait.
STACK_N = [2, 2, 2, 3, 3, 5, 7]
STACK_SHARE = 0.60  # squares that carry a stack at all; the rest are struck once
                    # and hold. At 0.6 more than half the column is new on every
                    # pass, which is enough to read as unending, at ~60% of the cost.
VISIBLE_P = 0.12    # squares that also re-strike WHERE YOU CAN SEE IT
SPIN_P    = 0.07

def stack(rnd, n, mirror_p):
    return "".join(glyph(rnd, mirror_p) for _ in range(n))

def cell(rnd, per, off):
    """One 9px square. Every square is a stack of n characters walked by a
    steps(n) animation. Two clocks are possible:

      · at the wrap (the default) - period n*d and the SAME negative delay as
        the stream, so the step lands exactly when the stream jumps from the
        bottom edge back above the top. At that instant every square in the
        stream is off the sheet, so the character changes unseen and the
        column arrives new on the next pass.

      · in view (VISIBLE_P of squares) - the slow 4-10s re-strike the owner
        asked for, which is meant to be caught out of the corner of an eye.
    """
    spin_r = rnd.random()
    if rnd.random() >= STACK_SHARE:
        # struck once and held — no stack, no animation, no cost
        key, ch, ok = pick(rnd)
        cls = "k-" + key + (" m" if (ok and rnd.random() < MIRROR) else "")
        if spin_r < SPIN_P:
            return ('<i class="k-%s sp%s" style="--sd:%ss">%s</i>'
                    % (key, " ccw" if rnd.random() < 0.5 else "",
                       round(rnd.uniform(3.5, 9.0), 2), ch))
        return '<i class="%s">%s</i>' % (cls, ch)
    n = rnd.choice(STACK_N)
    body = stack(rnd, n, MIRROR)
    if rnd.random() < VISIBLE_P:
        md, mdl = round(rnd.uniform(4.0, 10.0) * n, 2), round(rnd.uniform(0, 4.0 * n), 2)
    else:
        md, mdl = round(n * per, 2), off              # same phase as the stream
    spin = ""
    if spin_r < SPIN_P:
        spin = ' sp%s" style="--sd:%ss' % (
            " ccw" if rnd.random() < 0.5 else "", round(rnd.uniform(3.5, 9.0), 2))
    return ('<i class="n%d%s"><span class="st" style="--md:%ss;--mdl:-%ss">%s</span></i>'
            % (n, spin, md, mdl, body))

def word_cell(ch):
    """a letter of a word: Latin, upright, never reversed, never re-struck"""
    if ch == " ":
        return '<i></i>'
    return '<i class="k-lat">%s</i>' % ch

def plan_word(rnd, ln):
    """decide the word FIRST — the stream's period depends on whether it
    carries one, and every square's clock is derived from that period"""
    slots = [None] * ln
    if rnd.random() >= WORD_P:
        return slots, False
    pool = ([w for w in STATUS if len(w) + 2 <= ln]
            if rnd.random() < 0.4 else
            [w for w in PROMPT if len(w) + 2 <= ln])
    if not pool:
        return slots, False
    word = rnd.choice(pool)
    at = rnd.randrange(0, ln - len(word) + 1)
    for i, ch in enumerate(word):
        slots[at + i] = word_cell(ch)
    return slots, True

def field(w, h, seed):
    rnd = random.Random(seed)
    nrow = h // CELL
    cols = []
    for c in range(w // CELL):
        if rnd.random() > KEEP:
            continue
        ink   = round(rnd.uniform(*OPA), 2)
        ndrop = 2 if rnd.random() < TWO else 1
        ln    = rnd.randrange(7, max(9, nrow))
        d     = round(rnd.uniform(*DUR), 2)
        base  = rnd.uniform(0, d)
        drops = []
        for k in range(ndrop):
            slots, has_word = plan_word(rnd, ln)
            per = round(d * WORD_SLOW, 2) if has_word else d
            off = round((base + k * per / 2.0) % per, 2)
            body = "".join(x if x is not None else cell(rnd, per, off)
                           for x in slots)
            drops.append(
                '<span class="dr" style="--dh:%dpx;--d:%ss;--dl:-%ss;--y0:%dpx">%s</span>'
                % (ln * CELL, per, off,
                   -ln * CELL + int((h + ln * CELL) * off / per), body))
        cols.append('<span class="cl" style="left:%dpx;--o:%s">%s</span>'
                    % (c * CELL, ink, "".join(drops)))
    return ('<span class="rain" style="--H:%dpx;width:%dpx;height:%dpx">%s</span>'
            % (h, w, h, "".join(cols)))

def sw(seed, w=SW_W, h=SW_H, letter="a"):
    return ('<div class="sw" style="--w:%dpx;--h:%dpx"><span class="sw-letter">%s</span>%s</div>'
            % (w, h, letter, field(w, h, seed)))

SIZECSS = "\n".join(".k-%s{font-size:%spx}" % (k, s) for k, s, w, c in SCRIPTS)

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

.rain{position:absolute;left:0;top:0;display:block;overflow:hidden;z-index:1}
.cl{position:absolute;top:0;display:block;opacity:var(--o)}
.dr{position:absolute;top:0;left:0;display:block;transform:translateY(var(--y0))}
.dr i{display:block;width:9px;height:9px;line-height:9px;text-align:center;
  font-family:var(--tmono);color:var(--blue);overflow:hidden;font-style:normal}
.dr b{display:block;width:9px;height:9px;line-height:9px;text-align:center;
  font-family:var(--tmono);font-weight:400}
.dr i.m,.dr b.m{transform:scaleX(-1)}
.st{display:block}
""" + SIZECSS + """

@keyframes fall{
  from{transform:translateY(calc(-1 * var(--dh)))}
  to  {transform:translateY(var(--H))}
}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes spinccw{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
@keyframes mut2{to{transform:translateY(-18px)}}
@keyframes mut3{to{transform:translateY(-27px)}}
@keyframes mut5{to{transform:translateY(-45px)}}
@keyframes mut7{to{transform:translateY(-63px)}}
@media (prefers-reduced-motion: no-preference){
  .dr{animation:fall var(--d) linear var(--dl) infinite}
  .n2 .st{animation:mut2 var(--md) steps(2) var(--mdl) infinite}
  .n3 .st{animation:mut3 var(--md) steps(3) var(--mdl) infinite}
  .n5 .st{animation:mut5 var(--md) steps(5) var(--mdl) infinite}
  .n7 .st{animation:mut7 var(--md) steps(7) var(--mdl) infinite}
  .dr i.sp{animation:spin var(--sd) linear infinite}
  .dr i.sp.ccw{animation-name:spinccw}
}
@media (prefers-reduced-motion: reduce){
  .dr,.st,.dr i.sp{animation:none !important}
}

.hero{display:flex;gap:34px;align-items:flex-start;flex-wrap:nowrap;overflow-x:auto;
  width:fit-content;max-width:100%;margin:0 auto;padding-bottom:10px}
.hero>figure{flex:0 0 auto;margin:0}
.mag{width:230px;height:185px;overflow:hidden;position:relative;border:1px dashed var(--trule)}
.mag .sw{position:absolute;top:0;left:0;transform:scale(2.6);transform-origin:0 0}
.magcap{font-size:.5rem;letter-spacing:.14em;text-transform:uppercase;color:var(--tink-3);
  text-align:center;margin:8px 0 0}
.phone{display:flex;justify-content:center;gap:22px;flex-wrap:wrap}
.alpha{column-count:3;column-gap:26px;max-width:980px;margin:0 auto}
@media (max-width:820px){.alpha{column-count:2}}
@media (max-width:560px){.alpha{column-count:1}}
.al{display:flex;align-items:baseline;gap:6px;break-inside:avoid;margin-bottom:5px}
.al span.nm{font-size:.47rem;letter-spacing:.08em;text-transform:uppercase;
  color:var(--tink-3);min-width:76px;text-align:right;flex:0 0 auto}
.al .row{overflow:hidden;white-space:nowrap}
.al .row i{display:inline-block;width:9px;height:9px;line-height:9px;text-align:center;
  color:var(--blue);font-family:var(--tmono);overflow:hidden;font-style:normal;
  vertical-align:middle}
.constr{max-width:630px;margin:44px auto 0;font-size:.6rem;line-height:1.9;color:var(--tink-3)}
.constr b{color:var(--tink-2);font-weight:400}
footer{margin-top:54px;padding-top:12px;border-top:1px solid var(--trule);
  font-size:.54rem;letter-spacing:.14em;color:var(--tink-3);text-align:center;
  text-transform:uppercase;line-height:2}
"""

NAMES = {
 "lat":"Latin","dig":"Digits","mrk":"Marks","mth":"Math","pla":"Planetary","alc":"Alchemy",
 "grk":"Greek","cyr":"Cyrillic","heb":"Hebrew","arb":"Arabic","geo":"Georgian",
 "arm":"Armenian","che":"Cherokee","des":"Deseret","tib":"Tibetan","han":"Hangul",
 "cjk":"Chinese","run":"Runic","got":"Gothic","ita":"Old Italic","phn":"Phoenician",
 "lnb":"Linear B","cop":"Coptic","tfn":"Tifinagh","osa":"Osage","shw":"Shavian",
 "vai":"Vai","adl":"Adlam","nko":"N'Ko","yii":"Yi","gla":"Glagolitic","eth":"Ethiopic",
 "syr":"Syriac","thn":"Thaana","lao":"Lao","bam":"Bamum",
 "dev":"Devanagari","brh":"Brahmi","sid":"Siddham","shr":"Sharada","gra":"Grantha",
 "khr":"Kharoshthi","ben":"Bengali","gur":"Gurmukhi","guj":"Gujarati","ori":"Odia",
 "tam":"Tamil","tel":"Telugu","kan":"Kannada","mal":"Malayalam","sin":"Sinhala",
 "tha":"Thai","mya":"Myanmar","khm":"Khmer",
 "ave":"Avestan","olt":"Old Turkic","arc":"Aramaic","nab":"Nabataean","pal":"Palmyrene",
 "man":"Manichaean","car":"Carian","lyc":"Lycian","lyd":"Lydian","ugr":"Ugaritic",
 "opr":"Old Permic","mer":"Meroitic","olc":"Ol Chiki","cham":"Cham","bali":"Balinese",
 "java":"Javanese","bugi":"Buginese","batk":"Batak","lisu":"Lisu","bass":"Bassa Vah",
 "mend":"Mende","wcho":"Wancho","rohg":"Rohingya","tale":"Tai Le",
}

NCHARS = len(set().union(*[set(c) for k, s_, w, c in SCRIPTS]))

def build():
    tot = sum(w for k, s, w, c in SCRIPTS)
    p = ['<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">',
         '<meta name="viewport" content="width=device-width,initial-scale=1">',
         '<meta name="robots" content="noindex">',
         '<title>The Carbon Rain &mdash; round F</title>',
         '<style>%s</style></head><body><div class="sheet">' % CSS,
         '<h1>The Carbon Rain</h1>',
         '<div class="plateno">The Junk Drawer &middot; one wait indicator &middot; round F '
         '&middot; %d scripts, %d characters &middot; slow re-strike &middot; the odd word &middot; the odd pinwheel</div>' % (len(SCRIPTS), NCHARS),
         '<hr class="rule">',
         '<p class="dek">Ink is up to <b>heavy</b> &mdash; first sheet, not fifth carbon. '
         'Density, pace and the reversal rate hold where they were. The keys have gone a long '
         'way out: <b>%d scripts and %d distinct characters</b>, each script generated from its '
         'whole Unicode block and sieved by ink density, so a blob and a speck are both thrown '
         'out and what is left all reads at 9px. Letters carry about seven glyphs in eight; '
         'marks, mathematics and the planets carry the rest. Characters turn over rarely and '
         'slowly &mdash; <b>about one square in seven, re-striking every four to ten seconds</b> '
         '&mdash; and about one square in fourteen <b>turns on its own centre</b> as it falls, '
         'half one way and half the other. Roughly one stream in ten carries a <b>word</b>: '
         'LOADING, STAND BY, or a word out of the prompt being drawn, spelled straight down the '
         'column in upright Latin, never reversed, never re-struck. A stream carrying a word '
         'also falls slower, so it comes round again far less often than the noise does. '
         'Two on a sheet. '
         'The rest stays noise.</p>' % (len(SCRIPTS), NCHARS)]

    p.append('<h2 class="sechead">As It Stands</h2>')
    p.append('<div class="secsub">true size, 230 &times; 185 &mdash; and the same sheet at '
             '&times;2.6, where the reversed strikes are visible</div>')
    p.append('<div class="hero">')
    p.append('<figure>%s<p class="magcap">True size &middot; 230 &times; 185</p></figure>'
             % sw(901))
    p.append('<figure><div class="mag">%s</div>'
             '<p class="magcap">Detail &times;2.6</p></figure>' % sw(901))
    p.append('</div>')

    p.append('<h2 class="sechead">The Keys</h2>')
    p.append('<div class="secsub">every script in the mix, at the size that puts it on the '
             'same advance as the Latin &mdash; the number is its share of all glyphs struck</div>')
    p.append('<div class="alpha">')
    for key, size, wt, chars in SCRIPTS:
        # sample ACROSS the inventory, not off the front of it — the head of a
        # Unicode block is usually its archaic corner and reads as unrepresentative
        cl = list(chars)
        stepn = max(1, len(cl) // 16)
        row = "".join('<i class="k-%s">%s</i>' % (key, c) for c in cl[::stepn][:16])
        p.append('<div class="al"><span class="nm">%s %d%%</span>'
                 '<span class="row">%s</span></div>'
                 % (NAMES[key], round(wt / tot * 100), row))
    p.append('</div>')

    p.append('<h2 class="sechead">Phone Check</h2>')
    p.append('<div class="secsub">137 &times; 110 &middot; the ruling holds at true 9 / 45</div>')
    p.append('<div class="phone"><figure>%s'
             '<p class="magcap">As it stands</p></figure></div>' % sw(902, PH_W, PH_H))

    p.append('<p class="constr"><b>Construction.</b> Every glyph occupies one 9&times;9 cell. '
             'Each script carries its own font-size &mdash; measured, not guessed &mdash; so '
             'Cherokee at 8.9px, Deseret at 9.2px, Tibetan at 11px and Chinese at 7px all land '
             'on the same advance as Latin at 10px and share one rhythm. A re-striking '
             'square holds two to four candidates in a stack clipped to 9px, walked by a '
             'single <b>steps()</b> animation whose period is the read interval times the '
             'number of candidates &mdash; so the eye sees one change every four to ten '
             'seconds regardless of how many characters that square carries. Reversal is '
             'applied only to scripts a reader '
             'recognises and only to asymmetric glyphs, so the 18% is now 18% you can see. '
             'Ink weight is set once per column and never varies down its length. No filters, '
             'no shadows on ink, no blend modes, no images. A word is laid into a stream as plain cells before the rain fills the gaps around it, so it is exempt from both reversal and re-striking and cannot be corrupted mid-fall. Base rules park every stream and '
             'every stack at rest; all <em>animation</em> bindings live inside '
             'prefers-reduced-motion: no-preference.</p>')
    p.append('<footer>Ink on engineering paper &middot; the carbon rain &middot; round F<br>'
             '%d scripts, %d characters &middot; one glyph per printed square<br>'
             'A slow re-strike &middot; the odd word &middot; the odd pinwheel'
             '<br>Nobody ever knew the percentage</footer>' % (len(SCRIPTS), NCHARS))
    p.append('</div></body></html>')
    return "".join(p)

open("mockup-F-carbon-rain.html", "w", encoding="utf-8").write(build())
print("written", len(SCRIPTS), "scripts")
