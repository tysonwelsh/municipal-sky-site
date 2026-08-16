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
Stdlib only; renders via headless Chromium (same discovery order as
scripts/check-svg-ink.sh: $CHROME_BIN, PATH, Playwright browsers dir).
"""

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JD = os.path.join(REPO, "art", "junk-drawer")
SITE = "municipalsky.com"
W, H = 1080, 1350

# ---------------------------------------------------------------- chromium --

def find_chrome():
    """Prefer a Playwright headless_shell: its viewport is exactly
    --window-size. Full Chromium's --headless=new reserves ~85px of the
    window for browser UI, silently cropping the bottom of the card."""
    c = os.environ.get("CHROME_BIN")
    if c and os.access(c, os.X_OK):
        return c
    import glob as _glob
    root = os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
    shell = sorted(_glob.glob(
        os.path.join(root, "chromium_headless_shell-*/chrome-linux/headless_shell")))
    if shell:
        return shell[-1]
    for name in ("google-chrome", "google-chrome-stable", "chromium",
                 "chromium-browser", "chrome"):
        p = shutil.which(name)
        if p:
            return p
    pw = sorted(_glob.glob(os.path.join(root, "chromium-*/chrome-linux/chrome")))
    if pw:
        return pw[-1]
    sys.exit("no Chrome/Chromium found (set CHROME_BIN, or install chromium)")


def screenshot(chrome, html_path, png_path):
    subprocess.run(
        [chrome, "--headless=new", "--no-sandbox", "--disable-gpu",
         "--hide-scrollbars", "--force-device-scale-factor=1",
         f"--window-size={W},{H}", "--virtual-time-budget=3000",
         f"--screenshot={png_path}", "file://" + os.path.abspath(html_path)],
        check=True, capture_output=True)

# -------------------------------------------------------------------- data --

def load_item(item_id):
    d = os.path.join(JD, "items", item_id)
    with open(os.path.join(d, "entry.json"), encoding="utf-8") as f:
        entry = json.load(f)
    return d, entry


def load_taxonomy():
    with open(os.path.join(JD, "taxonomy.json"), encoding="utf-8") as f:
        return json.load(f)


def model_info(tax, mid):
    for m in tax.get("models", []):
        if m["id"] == mid:
            return m.get("label", mid), m.get("vendor", "")
    return mid, ""


def grade_label(tax, rank):
    if rank is None:
        return "UNGRADED"
    for g in tax.get("grades", []):
        if float(g.get("rank")) == float(rank):
            return f"{g.get('label', '').upper()} — {rank:g} / 5"
    return f"{rank:g} / 5"


def blind_order(item_id, responses):
    """Deterministic Fisher–Yates seeded by the item id."""
    seed = int.from_bytes(hashlib.sha256(item_id.encode()).digest()[:8], "big")
    idx = list(range(len(responses)))
    for i in range(len(idx) - 1, 0, -1):
        seed = (seed * 6364136223846793005 + 1442695040888963407) % (1 << 64)
        j = seed % (i + 1)
        idx[i], idx[j] = idx[j], idx[i]
    return [responses[i] for i in idx]

# --------------------------------------------------------------------- css --

BASE_CSS = """
:root {
  --paper: #f8f3e2; --plate: #fdfaf0;
  --ink: #37414f; --ink2: #6a7280; --typed: #3a3428;
  --rule: rgba(55, 65, 79, 0.42); --rule2: rgba(55, 65, 79, 0.20);
  --form: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua",
          "Liberation Serif", Georgia, serif;
  --mono: "Courier Prime", "Courier 10 Pitch", "Liberation Mono",
          "Courier New", Courier, monospace;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1080px; height: 1350px; overflow: hidden; position: relative;
  /* the drawer's graph paper (junk-drawer.css .rc-plate) at 2x module */
  background:
    repeating-linear-gradient(0deg,  rgba(74,98,138,0.17) 0 2px, transparent 2px 90px),
    repeating-linear-gradient(90deg, rgba(74,98,138,0.17) 0 2px, transparent 2px 90px),
    repeating-linear-gradient(0deg,  rgba(74,98,138,0.07) 0 2px, transparent 2px 18px),
    repeating-linear-gradient(90deg, rgba(74,98,138,0.07) 0 2px, transparent 2px 18px),
    var(--paper);
}
/* municipal double rule */
.frame { position: absolute; inset: 24px; border: 2.5px solid var(--rule);
         pointer-events: none; }
.frame::after { content: ""; position: absolute; inset: 5px;
                border: 1px solid var(--rule2); }
.sheet { position: absolute; inset: 24px; padding: 44px 56px;
         display: flex; flex-direction: column; }

.eyebrow { font-family: var(--form); font-size: 21px; font-weight: 700;
  letter-spacing: 0.30em; text-transform: uppercase; color: var(--ink2);
  text-align: center; }
.title { font-family: var(--form); font-weight: 700; letter-spacing: 0.10em;
  text-transform: uppercase; color: var(--ink); text-align: center; }
.fileline { font-family: var(--mono); font-size: 21px; letter-spacing: 0.10em;
  text-transform: uppercase; color: var(--typed); text-align: center; }
.rule { border-top: 1.5px solid var(--rule2); }

.head { display: flex; align-items: center; gap: 16px;
  font-family: var(--form); font-size: 19px; letter-spacing: 0.26em;
  text-transform: uppercase; color: var(--ink2); }
.head::after { content: ""; flex: 1 1 auto; border-top: 1.5px solid var(--rule2); }

.plate { position: relative; background: var(--plate);
  border: 1.5px solid rgba(55, 65, 79, 0.30);
  box-shadow: 0 7px 18px -6px rgba(46, 34, 12, 0.45),
              0 2px 5px rgba(46, 34, 12, 0.30); }
.plate-art { position: absolute; inset: 7%; }
.plate-art svg { display: block; width: 100%; height: 100%; }
/* kraft photo corners (junk-drawer.css .rc-corner) */
.kc { position: absolute; width: 44px; height: 44px; z-index: 2;
  background: linear-gradient(135deg, #dfcd9a, #c3aa6e);
  filter: drop-shadow(0 2px 2.5px rgba(46, 34, 12, 0.40)); }
.kc.tl { top: -8px; left: -8px;  clip-path: polygon(0 0, 100% 0, 0 100%); }
.kc.tr { top: -8px; right: -8px; clip-path: polygon(0 0, 100% 0, 100% 100%); }
.kc.bl { bottom: -8px; left: -8px;  clip-path: polygon(0 0, 0 100%, 100% 100%); }
.kc.br { bottom: -8px; right: -8px; clip-path: polygon(100% 0, 100% 100%, 0 100%); }

.letter { font-family: var(--mono); font-weight: 700; color: var(--typed); }
.mono { font-family: var(--mono); color: var(--typed); }
.empty-plate { display: flex; align-items: center; justify-content: center; }
.empty-plate span { font-family: var(--mono); font-size: 22px;
  letter-spacing: 0.22em; color: var(--ink2); transform: rotate(-8deg);
  border: 2px solid var(--ink2); padding: 10px 16px; opacity: 0.65;
  text-transform: uppercase; }
"""

PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>{css}</style>
</head><body><div class="frame"></div><div class="sheet">{body}</div></body></html>"""


def svg_inline(path):
    with open(path, encoding="utf-8") as f:
        s = f.read()
    s = re.sub(r"<\?xml[^>]*\?>", "", s)
    s = re.sub(r"<!DOCTYPE[^>]*>", "", s)
    return s


def prompt_pt(prompt):
    n = len(prompt)
    if n > 420: return 19
    if n > 300: return 21
    if n > 180: return 23
    return 27

# ------------------------------------------------------------------- cards --

LETTERS = "ABCD"


def grid_cells(blind, item_dir, labels=None, sub=None, cell=380, letter_pt=34):
    """2x2 grid; labels[i]/sub[i] optional caption lines under each plate."""
    cells = []
    for i in range(4):
        letter = LETTERS[i]
        if i < len(blind):
            art = svg_inline(os.path.join(item_dir, blind[i]["file"]))
            plate = (f'<div class="plate" style="width:{cell}px;height:{cell}px">'
                     f'<div class="kc tl"></div><div class="kc tr"></div>'
                     f'<div class="kc bl"></div><div class="kc br"></div>'
                     f'<div class="plate-art">{art}</div></div>')
        else:
            plate = (f'<div class="plate empty-plate" '
                     f'style="width:{cell}px;height:{cell}px">'
                     f'<span>No response filed</span></div>')
        cap = ""
        if labels:
            cap = (f'<div style="margin-top:14px;text-align:center;'
                   f'font-family:var(--form);font-size:23px;font-weight:700;'
                   f'letter-spacing:0.08em;color:var(--ink)">{labels[i]}</div>')
            if sub and sub[i]:
                cap += (f'<div style="margin-top:4px;text-align:center" '
                        f'class="mono"><span style="font-size:17px;'
                        f'letter-spacing:0.06em">{sub[i]}</span></div>')
        cells.append(
            f'<div style="position:relative">'
            f'<div class="letter" style="font-size:{letter_pt}px;'
            f'position:absolute;top:-8px;left:-32px">{letter}.</div>'
            f'{plate}{cap}</div>')
    return ('<div style="display:grid;grid-template-columns:repeat(2,max-content);'
            'justify-content:center;column-gap:56px;row-gap:28px">'
            + "".join(cells) + "</div>")


def card_cover(entry, blind, item_dir):
    title = html.escape(entry["title"].upper())
    n = len(blind)
    fileline = (f'FILE Nº {html.escape(entry["id"].upper())} · '
                f'1 PROMPT · {n} MODELS · SVG')
    prompt = html.escape(entry["prompt"])
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
    return PAGE.format(css=BASE_CSS, body=body)


def card_closeup(entry, resp, letter, tax, item_dir):
    label, vendor = model_info(tax, resp["model"])
    art = svg_inline(os.path.join(item_dir, resp["file"]))
    size = os.path.getsize(os.path.join(item_dir, resp["file"]))
    gen = resp.get("generation", {})
    mode = ("ONE-SHOT (1 PROMPT)" if gen.get("mode") == "one-shot"
            else f"REFINED ({gen.get('prompt_count', '?')} PROMPTS)")
    rows = [("Specimen", f"{letter}. — “{html.escape(entry['title'])}”"),
            ("Model", html.escape(label).upper()),
            ("Vendor", html.escape(vendor).upper()),
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
<div class="fileline" style="margin-top:8px;font-size:20px">FILE Nº {html.escape(entry["id"].upper())}</div>
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
    return PAGE.format(css=BASE_CSS, body=body)


def card_record(entry, blind, tax, item_dir):
    labels, subs = [], []
    for r in blind:
        label, vendor = model_info(tax, r["model"])
        labels.append(html.escape(label))
        subs.append(f'{html.escape(vendor).upper()} &nbsp;·&nbsp; '
                    f'{grade_label(tax, r.get("grade"))}')
    while len(labels) < 4:
        labels.append("—"); subs.append("")
    body = f"""
<div class="eyebrow">The Junk Drawer · The Record</div>
<div class="title" style="font-size:42px;margin-top:8px">{html.escape(entry["title"].upper())}</div>
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
    return PAGE.format(css=BASE_CSS, body=body)

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
            screenshot(chrome, hp, png)
            meta["cards"].append({"file": name + ".png", "alt": alt})
            if keep_html:
                shutil.copy(hp, os.path.join(out, name + ".html"))
            print(f"  {name}.png")

    ig, x = captions(entry, blind, tax)
    for fn, text in (("caption-instagram.txt", ig), ("caption-x.txt", x)):
        with open(os.path.join(out, fn), "w", encoding="utf-8") as f:
            f.write(text + "\n")
    with open(os.path.join(out, "meta.json"), "w", encoding="utf-8") as f:
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
