"""jd_social_lib — shared primitives for the Junk Drawer social renderers.

Used by render-jd-social.py (still cards) and render-jd-social-video.py
(draw-on reveal video). See art/junk-drawer/PLAN-SOCIAL.md §3–§4.
"""

import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JD = os.path.join(REPO, "art", "junk-drawer")
SITE = "municipalsky.com"
W, H = 1080, 1350
LETTERS = "ABCD"

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


def screenshot(chrome, url, png_path):
    """url may be a file:// URL with a query string (?t=… for video seeks)."""
    subprocess.run(
        [chrome, "--headless=new", "--no-sandbox", "--disable-gpu",
         "--hide-scrollbars", "--force-device-scale-factor=1",
         f"--window-size={W},{H}", "--virtual-time-budget=3000",
         f"--screenshot={png_path}", url],
        check=True, capture_output=True)


def find_ffmpeg():
    """H.264-capable ffmpeg: $FFMPEG_BIN, PATH, then imageio-ffmpeg's
    static build (pip install imageio-ffmpeg). Playwright's bundled
    ffmpeg is VP8-only — no good for Instagram/X (MP4 H.264)."""
    c = os.environ.get("FFMPEG_BIN")
    if c and os.access(c, os.X_OK):
        return c
    p = shutil.which("ffmpeg")
    if p:
        return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("no H.264 ffmpeg found: set FFMPEG_BIN, install ffmpeg, "
                 "or `pip install imageio-ffmpeg`")

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


def svg_inline(path):
    with open(path, encoding="utf-8") as f:
        s = f.read()
    s = re.sub(r"<\?xml[^>]*\?>", "", s)
    s = re.sub(r"<!DOCTYPE[^>]*>", "", s)
    return s

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
</head><body><div class="frame"></div><div class="sheet">{body}</div>{tail}</body></html>"""


def page(body, extra_css="", tail=""):
    return PAGE.format(css=BASE_CSS + extra_css, body=body, tail=tail)


def prompt_pt(prompt):
    n = len(prompt)
    if n > 420: return 19
    if n > 300: return 21
    if n > 180: return 23
    return 27


def grid_cells(blind, item_dir, labels=None, sub=None, cell=380, letter_pt=34,
               cap_class=""):
    """2x2 grid; labels[i]/sub[i] optional caption lines under each plate.
    cap_class lets the video page target captions for animation."""
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
            cap = (f'<div class="{cap_class}" style="margin-top:14px;'
                   f'text-align:center;font-family:var(--form);font-size:22px;'
                   f'font-weight:700;letter-spacing:0.08em;color:var(--ink)">'
                   f'{labels[i]}')
            if sub and sub[i]:
                cap += (f'<div style="margin-top:4px;font-family:var(--mono);'
                        f'color:var(--typed);font-weight:400;font-size:16px;'
                        f'letter-spacing:0.06em">{sub[i]}</div>')
            cap += "</div>"
        cells.append(
            f'<div style="position:relative">'
            f'<div class="letter jd-letter" style="font-size:{letter_pt}px;'
            f'position:absolute;top:-8px;left:-32px">{letter}.</div>'
            f'{plate}{cap}</div>')
    return ('<div style="display:grid;grid-template-columns:repeat(2,max-content);'
            'justify-content:center;column-gap:56px;row-gap:28px">'
            + "".join(cells) + "</div>")


def esc(s):
    return html.escape(s)
