#!/usr/bin/env python3
"""render-jd-social.py — render an item's social card set (PLAN-SOCIAL.md §3).

Usage:
    python3 scripts/render-jd-social.py <item-id> [<item-id> ...] [--keep-html]

Reads  art/junk-drawer/items/<id>/entry.json (+ taxonomy.json) and writes
       art/junk-drawer/social/renders/<id>/
           01-cover.png            blind 2x2 sheet, prompt verbatim
           02..0N-specimen-*.png   one labeled closeup per response
           0M-record.png           all responses labeled + grades + CTA
           caption-instagram.txt   caption draft (voice rules: PLAN-SOCIAL §1)
           caption-x.txt           caption draft
           meta.json               blind-order map + per-card alt text

Cards are 1080x1350 (4:5). Blind order is a deterministic shuffle seeded
by the item id — stable across re-renders, uncorrelated with filing order.
Stdlib only; renders via headless Chromium (see jd_social_lib.find_chrome).
The companion video renderer is render-jd-social-video.py.
"""

import argparse
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jd_social_lib import (JD, REPO, SITE, LETTERS, blind_order, esc,
                           find_chrome, grade_label, grid_cells, load_item,
                           load_taxonomy, model_info, page, prompt_pt,
                           screenshot, svg_inline)

# ------------------------------------------------------------------- cards --

def card_cover(entry, blind, item_dir):
    title = esc(entry["title"].upper())
    n = len(blind)
    fileline = (f'FILE Nº {esc(entry["id"].upper())} · '
                f'1 PROMPT · {n} MODELS · SVG')
    prompt = esc(entry["prompt"])
    tp = prompt_pt(entry["prompt"])
    title_pt = 54 if len(entry["title"]) <= 18 else 44
    body = f"""
<div class="eyebrow">The Junk Drawer · Specimen Comparison Sheet</div>
<div class="title" style="font-size:{title_pt}px;margin-top:8px">{title}</div>
<div class="fileline" style="margin-top:10px;font-size:19px;letter-spacing:0.07em;white-space:nowrap">{fileline}</div>
<div class="rule" style="margin:18px 0 22px"></div>
{grid_cells(blind, item_dir, cell=336)}
<div style="flex:1"></div>
<div class="head">Prompt — verbatim, one shot each</div>
<div class="mono" style="font-size:{tp}px;line-height:1.4;margin-top:12px">
&ldquo;{prompt}&rdquo;</div>
<div style="flex:1"></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;
     border-top:1.5px solid var(--rule2);padding-top:12px">
  <span class="mono" style="font-size:20px;letter-spacing:0.12em">
  WHICH IS WHICH? &nbsp;→&nbsp; SWIPE FOR THE RECORD</span>
  <span class="eyebrow" style="font-size:18px;letter-spacing:0.18em">{SITE}</span>
</div>"""
    return page(body)


def card_closeup(entry, resp, letter, tax, item_dir):
    label, vendor = model_info(tax, resp["model"])
    art = svg_inline(os.path.join(item_dir, resp["file"]))
    size = os.path.getsize(os.path.join(item_dir, resp["file"]))
    gen = resp.get("generation", {})
    mode = ("ONE-SHOT (1 PROMPT)" if gen.get("mode") == "one-shot"
            else f"REFINED ({gen.get('prompt_count', '?')} PROMPTS)")
    rows = [("Specimen", f"{letter}. — “{esc(entry['title'])}”"),
            ("Model", esc(label).upper()),
            ("Vendor", esc(vendor).upper()),
            ("Grade", grade_label(tax, resp.get("grade"))),
            ("Mode", mode),
            ("File", f"{size:,} BYTES — PURE SVG")]
    rowhtml = "".join(
        f'<div style="display:flex;align-items:baseline;gap:22px;margin-top:9px">'
        f'<span style="font-family:var(--form);font-size:18px;font-weight:700;'
        f'letter-spacing:0.20em;text-transform:uppercase;color:var(--ink2);'
        f'flex:0 0 140px">{k}</span>'
        f'<span class="mono" style="font-size:23px;letter-spacing:0.02em">{v}</span>'
        f'</div>' for k, v in rows)
    body = f"""
<div class="eyebrow">The Junk Drawer · Specimen Record</div>
<div class="fileline" style="margin-top:8px;font-size:20px">FILE Nº {esc(entry["id"].upper())}</div>
<div style="flex:1"></div>
<div style="display:flex;justify-content:center">
  <div style="position:relative;width:660px">
    <div class="letter" style="font-size:56px;position:absolute;left:-118px;top:-6px">{letter}.</div>
    <div class="plate" style="width:660px;height:660px">
      <div class="kc tl"></div><div class="kc tr"></div>
      <div class="kc bl"></div><div class="kc br"></div>
      <div class="plate-art">{art}</div>
    </div>
  </div>
</div>
<div style="flex:1"></div>
<div class="head">The typed record</div>
<div>{rowhtml}</div>"""
    return page(body)


def card_record(entry, blind, tax, item_dir):
    labels, subs = [], []
    for r in blind:
        label, vendor = model_info(tax, r["model"])
        labels.append(esc(label))
        subs.append(f'{esc(vendor).upper()} &nbsp;·&nbsp; '
                    f'{grade_label(tax, r.get("grade"))}')
    while len(labels) < 4:
        labels.append("—"); subs.append("")
    body = f"""
<div class="eyebrow">The Junk Drawer · The Record</div>
<div class="title" style="font-size:42px;margin-top:8px">{esc(entry["title"].upper())}</div>
<div class="rule" style="margin:18px 0 24px"></div>
{grid_cells(blind, item_dir, labels=labels, sub=subs, cell=300)}
<div style="flex:1"></div>
<div class="head">For the working designer</div>
<div class="mono" style="font-size:22px;line-height:1.55;margin-top:12px">
Every specimen is a real SVG file — vector paths, a few kilobytes,
crisp at any zoom, editable in Illustrator / Figma / Inkscape.</div>
<div style="flex:1"></div>
<div style="display:flex;justify-content:space-between;align-items:baseline;
     border-top:1.5px solid var(--rule2);padding-top:12px">
  <span class="mono" style="font-size:20px;letter-spacing:0.12em">
  THE FULL DRAWER &nbsp;→&nbsp; LINK IN BIO</span>
  <span class="eyebrow" style="font-size:18px;letter-spacing:0.18em">{SITE}</span>
</div>"""
    return page(body)

# ---------------------------------------------------------------- captions --

def captions(entry, blind, tax):
    title = entry["title"]
    n = len(blind)
    vendors = sorted({model_info(tax, r["model"])[1] for r in blind})
    ig = f"""{title}. One prompt, {n} models, one shot each — no retries, no cherry-picking.

The prompt, verbatim, is typed on the sheet. Every panel is an SVG file — vector art measured in kilobytes, not pixels.

Guess which model drew which — A, B, C or D — then swipe. The record is on the last card.

The full drawer (and the files) — link in bio.

#svg #vectorart #vector #generativeart #aiart #aidesign #designtools #graphicdesign #promptengineering #machinelearning"""
    x = f"""{title} — one prompt, {n} models ({", ".join(v for v in vendors if v)}), one shot each, SVG output.

Guess which is which, then check the last image for the record.

The full drawer: https://{SITE}/art/junk-drawer/"""
    return ig, x

# -------------------------------------------------------------------- main --

def render_item(item_id, chrome, keep_html=False):
    item_dir, entry = load_item(item_id)
    tax = load_taxonomy()
    responses = entry.get("responses", [])[:4]
    if not responses:
        print(f"  !! {item_id}: no responses, skipping"); return
    blind = blind_order(item_id, responses)
    out = os.path.join(JD, "social", "renders", item_id)
    os.makedirs(out, exist_ok=True)

    cards = [("01-cover", card_cover(entry, blind, item_dir),
              f"Graph-paper comparison sheet titled {entry['title']}: "
              f"{len(blind)} AI-generated vector drawings in a 2-by-2 grid "
              f"labeled A through D, with the verbatim prompt typed below.")]
    for i, r in enumerate(blind):
        label, vendor = model_info(tax, r["model"])
        cards.append((f"{i+2:02d}-specimen-{LETTERS[i].lower()}-{r['model']}",
                      card_closeup(entry, r, LETTERS[i], tax, item_dir),
                      f"Specimen {LETTERS[i]} close-up: vector drawing of "
                      f"{entry['title']} generated by {label}, on a "
                      f"graph-paper record card with typed metadata."))
    cards.append((f"{len(cards)+1:02d}-record",
                  card_record(entry, blind, tax, item_dir),
                  f"The record: all {len(blind)} drawings of {entry['title']} "
                  f"shown small and labeled with model names and grades."))

    meta = {"item": item_id, "rendered": None, "cards": [],
            "blind_order": [{"letter": LETTERS[i], "rid": r["rid"],
                             "model": r["model"]} for i, r in enumerate(blind)]}
    with tempfile.TemporaryDirectory() as td:
        for name, markup, alt in cards:
            hp = os.path.join(td, name + ".html")
            with open(hp, "w", encoding="utf-8") as f:
                f.write(markup)
            png = os.path.join(out, name + ".png")
            screenshot(chrome, "file://" + os.path.abspath(hp), png)
            meta["cards"].append({"file": name + ".png", "alt": alt})
            if keep_html:
                shutil.copy(hp, os.path.join(out, name + ".html"))
            print(f"  {name}.png")

    ig, x = captions(entry, blind, tax)
    for fn, text in (("caption-instagram.txt", ig), ("caption-x.txt", x)):
        with open(os.path.join(out, fn), "w", encoding="utf-8") as f:
            f.write(text + "\n")
    # keep any keys other tools added (the video renderer writes "video")
    mp = os.path.join(out, "meta.json")
    if os.path.exists(mp):
        with open(mp, encoding="utf-8") as f:
            old = json.load(f)
        for k, v in old.items():
            meta.setdefault(k, v)
    with open(mp, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")
    print(f"  -> {os.path.relpath(out, REPO)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("items", nargs="+", help="item ids (items/ dir names)")
    ap.add_argument("--keep-html", action="store_true",
                    help="also keep the intermediate card HTML")
    args = ap.parse_args()
    chrome = find_chrome()
    for item_id in args.items:
        print(item_id)
        render_item(item_id, chrome, keep_html=args.keep_html)


if __name__ == "__main__":
    main()
