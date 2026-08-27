#!/usr/bin/env python3
"""render-jd-social-video.py — draw-on reveal video (PLAN-SOCIAL.md §4).

Usage:
    python3 scripts/render-jd-social-video.py <item-id> [...] [--fps N]
        [--workers N] [--crf N] [--keep-html]

Produces art/junk-drawer/social/renders/<id>/07-draw-reveal.mp4 — a
1080x1350 H.264 video: the four specimens draw themselves stroke by
stroke SIMULTANEOUSLY on their graph-paper plates (each in its own SVG
document order — real provenance, the order the model actually emitted
the shapes), then the model names + grades stamp in under the plates.

How it stays deterministic with no browser automation dependency: the
page's every animation is CSS, *paused*, with a negative delay taken
from ?t=<ms> in the URL — so loading the page at ?t=5000 IS the frame at
five seconds. One headless-Chromium screenshot per frame (parallelized),
then ffmpeg (H.264 via $FFMPEG_BIN / PATH / imageio-ffmpeg; Playwright's
bundled ffmpeg is VP8-only). Stroked paths animate stroke-dashoffset
over their measured length; filled shapes fade in; elements that can't
draw (no stroke, e.g. built from filled solids) simply fade — which is
itself a fact about how that model draws, worth a caption line.
"""

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jd_social_lib import (JD, REPO, SITE, blind_order, esc, find_chrome,
                           find_ffmpeg, grade_label, grid_cells, load_item,
                           load_taxonomy, model_info, page, prompt_pt,
                           screenshot)

# timeline (seconds)
INTRO = 0.9          # sheet on screen before the draw starts
DRAW = 6.0           # shared draw window — all specimens draw at once
REVEAL_GAP = 0.3     # pause after the draw finishes
CAP_STAGGER = 0.3    # caption stamps, one after another
CAP_DUR = 0.7
TAIL = 3.2           # hold on the fully revealed sheet

VIDEO_CSS = """
@keyframes jdDraw  { to { stroke-dashoffset: 0; } }
@keyframes jdFill  { from { fill-opacity: 0; } to { fill-opacity: var(--jdfo, 1); } }
@keyframes jdOp    { from { opacity: 0; } to { opacity: var(--jdo, 1); } }
@keyframes jdCap   { from { opacity: 0; transform: translateY(8px); }
                     to   { opacity: 1; transform: none; } }
@keyframes jdStamp { from { opacity: 0; transform: scale(1.7) rotate(-6deg); }
                     to   { opacity: 1; transform: none; } }
.jd-cap, .jd-letter { opacity: 0; }
"""

VIDEO_JS = """
<script>
(function () {
  var CFG = %(cfg)s;
  var t = parseFloat(new URLSearchParams(location.search).get('t') || '0') / 1000;
  if (CFG.live) t = -CFG.liveDelay;  // mockup mode: run in real time

  function anim(el, name, dur, delay, ease, extra) {
    var a = name + ' ' + dur + 's ' + (ease || 'linear') + ' ' +
            (delay - t) + 's 1 both' + (CFG.live ? '' : ' paused');
    var prev = el.style.animation;
    el.style.animation = prev ? prev + ', ' + a : a;
    if (extra) for (var k in extra) el.style.setProperty(k, extra[k]);
  }

  var SKIP = 'defs,clipPath,mask,pattern,linearGradient,radialGradient,symbol,marker';
  function schedule(svg, w0, w1) {
    var els = [].slice.call(svg.querySelectorAll(
      'path,line,polyline,polygon,circle,ellipse,rect,text,use'));
    var items = [];
    els.forEach(function (el) {
      if (el.closest(SKIP)) return;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      var L = 0;
      try { L = el.getTotalLength(); } catch (e) {}
      var stroked = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 &&
                    parseFloat(cs.strokeOpacity) > 0 &&
                    cs.strokeDasharray === 'none' && L > 0;
      var filled = cs.fill !== 'none' && parseFloat(cs.fillOpacity) > 0;
      if (!stroked && !filled) return;
      items.push({ el: el, L: Math.max(L, 4), stroked: stroked,
                   filled: filled, cs: cs });
    });
    var totalW = items.reduce(function (s, i) { return s + Math.sqrt(i.L); }, 0) || 1;
    var span = w1 - w0, acc = 0;
    items.forEach(function (it) {
      var frac = Math.sqrt(it.L) / totalW;
      var start = w0 + (acc / totalW) * span * 0.9;   // slight overlap
      acc += Math.sqrt(it.L);
      var dur = Math.max(Math.min(span * frac * 1.7, w1 - start), 0.12);
      if (it.stroked) {
        it.el.style.strokeDasharray = it.L;
        it.el.style.strokeDashoffset = it.L;
        anim(it.el, 'jdDraw', dur, start, 'ease-out');
        if (it.filled)
          anim(it.el, 'jdFill', Math.max(dur * 0.6, 0.15), start + dur * 0.45,
               'ease-in', { '--jdfo': it.cs.fillOpacity });
      } else {
        anim(it.el, 'jdOp', Math.max(dur * 0.8, 0.15), start, 'ease-in',
             { '--jdo': it.cs.opacity });
      }
    });
  }

  var svgs = [].slice.call(document.querySelectorAll('.plate-art svg'));
  svgs.forEach(function (svg) {
    schedule(svg, CFG.intro, CFG.intro + CFG.draw);   // all at once
  });
  [].slice.call(document.querySelectorAll('.jd-letter')).forEach(function (el) {
    anim(el, 'jdStamp', 0.4, CFG.intro, 'ease-out');
  });
  [].slice.call(document.querySelectorAll('.jd-cap')).forEach(function (el, i) {
    anim(el, 'jdCap', CFG.capDur, CFG.reveal + i * CFG.capStagger, 'ease-out');
  });
})();
</script>
"""


def video_page(entry, blind, tax, item_dir, live=False):
    n = len(blind)
    labels, subs = [], []
    for r in blind:
        label, vendor = model_info(tax, r["model"])
        labels.append(esc(label))
        subs.append(f'{esc(vendor).upper()} &nbsp;·&nbsp; '
                    f'{grade_label(tax, r.get("grade"))}')
    while len(labels) < 4:
        labels.append("—"); subs.append("")
    reveal = INTRO + DRAW + REVEAL_GAP
    total = reveal + (n - 1) * CAP_STAGGER + CAP_DUR + TAIL
    prompt = esc(entry["prompt"])
    tp = min(prompt_pt(entry["prompt"]), 23)
    title_pt = 44 if len(entry["title"]) <= 18 else 38
    body = f"""
<div class="eyebrow">The Junk Drawer · Specimen Comparison Sheet</div>
<div class="title" style="font-size:{title_pt}px;margin-top:8px">{esc(entry["title"].upper())}</div>
<div class="fileline" style="margin-top:8px;font-size:19px;letter-spacing:0.07em;white-space:nowrap">
FILE Nº {esc(entry["id"].upper())} · 1 PROMPT · {n} MODELS · SVG</div>
<div class="rule" style="margin:14px 0 20px"></div>
{grid_cells(blind, item_dir, labels=labels, sub=subs, cell=300, cap_class="jd-cap")}
<div style="flex:1"></div>
<div class="head">Prompt — verbatim, one shot each</div>
<div class="mono" style="font-size:{tp}px;line-height:1.4;margin-top:10px">
&ldquo;{prompt}&rdquo;</div>
<div style="flex:1"></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;
     border-top:1.5px solid var(--rule2);padding-top:10px">
  <span class="mono" style="font-size:18px;letter-spacing:0.10em;white-space:nowrap">
  DRAWN IN DOCUMENT ORDER &nbsp;·&nbsp; FULL DRAWER → LINK IN BIO</span>
  <span class="eyebrow" style="font-size:18px;letter-spacing:0.18em">{SITE}</span>
</div>"""
    cfg = json.dumps({"intro": INTRO, "draw": DRAW, "reveal": reveal,
                      "capStagger": CAP_STAGGER, "capDur": CAP_DUR,
                      "live": live, "liveDelay": 0.4})
    return page(body, extra_css=VIDEO_CSS, tail=VIDEO_JS % {"cfg": cfg}), total


def render_video(item_id, chrome, ffmpeg, fps, workers, crf, keep_html):
    item_dir, entry = load_item(item_id)
    tax = load_taxonomy()
    responses = entry.get("responses", [])[:4]
    if not responses:
        print(f"  !! {item_id}: no responses, skipping"); return
    blind = blind_order(item_id, responses)
    out = os.path.join(JD, "social", "renders", item_id)
    os.makedirs(out, exist_ok=True)
    markup, total = video_page(entry, blind, tax, item_dir)
    nframes = math.ceil(total * fps)
    print(f"  {total:.1f}s · {nframes} frames @ {fps}fps · {workers} workers")

    with tempfile.TemporaryDirectory() as td:
        hp = os.path.join(td, "sheet.html")
        with open(hp, "w", encoding="utf-8") as f:
            f.write(markup)
        if keep_html:
            import shutil as _sh
            _sh.copy(hp, os.path.join(out, "07-draw-reveal.html"))
        url = "file://" + os.path.abspath(hp)

        def one(k):
            ms = round(k * 1000 / fps)
            screenshot(chrome, f"{url}?t={ms}",
                       os.path.join(td, f"f{k:05d}.png"))
        with ThreadPoolExecutor(max_workers=workers) as ex:
            for i, _ in enumerate(ex.map(one, range(nframes))):
                if (i + 1) % 100 == 0:
                    print(f"  frames {i + 1}/{nframes}")

        mp4 = os.path.join(out, "07-draw-reveal.mp4")
        subprocess.run(
            [ffmpeg, "-y", "-framerate", str(fps),
             "-i", os.path.join(td, "f%05d.png"),
             "-c:v", "libx264", "-preset", "medium", "-crf", str(crf),
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4],
            check=True, capture_output=True)

    mp = os.path.join(out, "meta.json")
    meta = {}
    if os.path.exists(mp):
        with open(mp, encoding="utf-8") as f:
            meta = json.load(f)
    meta["video"] = {
        "file": "07-draw-reveal.mp4", "duration_s": round(total, 2),
        "fps": fps,
        "alt": (f"Animated specimen sheet: {len(blind)} AI-generated vector "
                f"drawings of {entry['title']} draw themselves stroke by "
                f"stroke at the same time, labeled A to D, then the model "
                f"names and grades are revealed under each drawing.")}
    with open(mp, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")
    print(f"  -> {os.path.relpath(os.path.join(out, '07-draw-reveal.mp4'), REPO)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("items", nargs="+", help="item ids (items/ dir names)")
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--keep-html", action="store_true",
                    help="also keep the seekable sheet HTML next to the mp4")
    args = ap.parse_args()
    chrome = find_chrome()
    ffmpeg = find_ffmpeg()
    for item_id in args.items:
        print(item_id)
        render_video(item_id, chrome, ffmpeg, args.fps, args.workers,
                     args.crf, args.keep_html)


if __name__ == "__main__":
    main()
