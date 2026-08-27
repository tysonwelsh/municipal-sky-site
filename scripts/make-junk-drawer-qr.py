#!/usr/bin/env python3
"""Regenerate The Junk Drawer's shareable QR assets.

Produces three files in art/junk-drawer/:

  junk-drawer-qr.svg         the bare code, vector
  junk-drawer-qr.png         the bare code, 1080px raster
  junk-drawer-qr-drawer.png  the code as a card lying in the drawer itself

The third is a real screenshot of the live page, not a mockup: it loads
/art/junk-drawer/ in headless Chromium, drops an aged-paper QR card into the
pile, picks the emptiest patch of wood for it, nudges any item that crowds
the code out of the way, and shoots the drawer stage. The scatter is random
per session, so every run composes a different drawer — rerun until you like
one. Re-run this after adding items if you want the share image to show them.

Requires: segno, playwright (+ opencv-python-headless for the scan check),
and a local server for the site:

    php -S 127.0.0.1:8765 router.php &
    scripts/make-junk-drawer-qr.py [--url URL] [--tries N] [--keep-server-url U]

The QR is ECC level H (~30% damage tolerance) so it still scans off a phone
screen, a print, or a photo of either.
"""
import argparse, base64, os, subprocess, sys

URL = "https://municipalsky.com/art/junk-drawer/"
LOCAL = "http://127.0.0.1:8765/art/junk-drawer/"
INK, PAPER = "#1b140d", "#f4ead7"          # the drawer's ink-on-aged-paper pair
SHARE_WIDTH = 1600                         # final share image width, px

ROOT = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                      capture_output=True, text=True, check=True).stdout.strip()
OUT = os.path.join(ROOT, "art", "junk-drawer")

# The card, and the composition rules for dropping it into the pile. Runs in
# the page, after the drawer's own scatter has settled.
COMPOSE_JS = r"""
async (cfg) => {
  const well = document.querySelector('.jd-well');
  const pile = document.querySelector('.jd-pile');
  document.querySelectorAll('.jd-qrcard').forEach(n => n.remove());
  const W = well.getBoundingClientRect();

  const d = document.createElement('div');
  d.className = 'jd-qrcard';
  d.style.cssText = `position:absolute; left:50%; top:50%; width:${cfg.width}cqmin;
    transform: translate(-50%,-50%) rotate(${cfg.rot}deg);
    z-index:0; pointer-events:none;
    filter: drop-shadow(5px 7px 5px rgba(22,11,4,0.58));`;
  d.innerHTML = `
    <div style="position:relative; padding:6% 6% 4.6%;
      background: radial-gradient(120% 100% at 20% 10%, rgba(255,252,240,0.97),
                  rgba(240,229,205,0.97) 55%, rgba(224,208,175,0.98)), #efe4cc;
      border-radius:3px;
      box-shadow: inset 0 0 0 1px rgba(120,96,58,0.35), inset 0 1px 0 rgba(255,255,255,0.6);
      font-family: Georgia, 'Times New Roman', serif;">
      <img id="jd-qr-img" src="${cfg.qr}"
           style="display:block;width:100%;height:auto;aspect-ratio:1/1;mix-blend-mode:multiply;" />
      <div style="margin-top:4%; text-align:center; color:#4a361c;
        font-size:0.95cqmin; letter-spacing:0.2em; text-transform:uppercase; line-height:1.5;">
        The Junk Drawer
        <div style="font-size:0.8cqmin; letter-spacing:0.05em; text-transform:none;
                    color:rgba(107,84,50,0.8); margin-top:0.3em;">${cfg.caption}</div>
      </div>
    </div>`;
  pile.appendChild(d);
  /* the card is only as tall as its content once the code has decoded —
     measure after that, or every placement decision below is made against a
     card 70px tall instead of 280 */
  const img = d.querySelector('#jd-qr-img');
  try { await img.decode(); } catch (e) {}
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const C0 = d.getBoundingClientRect();
  const cw = C0.width, ch = C0.height;
  const items = [...document.querySelectorAll('.jd-item')];
  const inflate = Math.min(cw, ch) * 0.14;      // clear air the code insists on

  // 1. emptiest patch of wood, biased toward the lower middle of the drawer
  const pad = 0.05;
  const minX = W.left + W.width*pad + cw/2,  maxX = W.right  - W.width*pad  - cw/2;
  const minY = W.top  + W.height*pad + ch/2, maxY = W.bottom - W.height*pad - ch/2;
  const rects = items.map(i => i.getBoundingClientRect());
  const overlap = (cx, cy) => {
    const a = {l:cx-cw/2-inflate, r:cx+cw/2+inflate, t:cy-ch/2-inflate, b:cy+ch/2+inflate};
    let s = 0;
    for (const r of rects) {
      const ox = Math.max(0, Math.min(a.r, r.right) - Math.max(a.l, r.left));
      const oy = Math.max(0, Math.min(a.b, r.bottom) - Math.max(a.t, r.top));
      s += ox * oy;
    }
    return s;
  };
  let best = null;
  for (let gx = 0; gx <= 28; gx++) for (let gy = 0; gy <= 28; gy++) {
    const cx = minX + (maxX-minX)*gx/28, cy = minY + (maxY-minY)*gy/28;
    const relx = (cx-W.left)/W.width, rely = (cy-W.top)/W.height;
    const pull = (Math.abs(relx-0.5)*1.0 + Math.abs(rely-0.66)*1.3) * cw*ch*0.5;
    const c = overlap(cx, cy) + pull;
    if (!best || c < best.c) best = {c, cx, cy};
  }
  d.style.left = ((best.cx - W.left) / W.width * 100) + '%';
  d.style.top  = ((best.cy - W.top) / W.height * 100) + '%';

  // 2. shove whatever still crowds the card out to its edge. Items ride on
  //    --dx/--dy, the same transform-only channel the drag code uses.
  const moved = [];
  for (let pass = 0; pass < 4; pass++) {
    const card = d.getBoundingClientRect();
    const ccx = card.left + card.width/2, ccy = card.top + card.height/2;
    items.forEach(it => {
      const r = it.getBoundingClientRect();
      const ox = Math.min(card.right, r.right) - Math.max(card.left, r.left) + inflate;
      const oy = Math.min(card.bottom, r.bottom) - Math.max(card.top, r.top) + inflate;
      if (ox <= 0 || oy <= 0) return;
      const icx = r.left + r.width/2, icy = r.top + r.height/2;
      let vx = icx - ccx, vy = icy - ccy;
      if (!vx && !vy) { vx = 1; vy = 1; }
      const len = Math.hypot(vx, vy); vx /= len; vy /= len;
      const need = Math.min(
        Math.abs(vx) > 0.02 ? (card.width/2  + r.width/2  + inflate - Math.abs(icx-ccx)) / Math.abs(vx) : Infinity,
        Math.abs(vy) > 0.02 ? (card.height/2 + r.height/2 + inflate - Math.abs(icy-ccy)) / Math.abs(vy) : Infinity
      );
      const push = Math.max(0, Math.min(need, Math.min(W.width, W.height) * 0.6));
      let nx = icx + vx*push, ny = icy + vy*push;
      nx = Math.min(Math.max(nx, W.left + r.width*0.3),  W.right  - r.width*0.3);
      ny = Math.min(Math.max(ny, W.top  + r.height*0.3), W.bottom - r.height*0.3);
      const pdx = parseFloat(it.style.getPropertyValue('--dx')) || 0;
      const pdy = parseFloat(it.style.getPropertyValue('--dy')) || 0;
      it.style.setProperty('--dx', (pdx + nx - icx) + 'px');
      it.style.setProperty('--dy', (pdy + ny - icy) + 'px');
      if (!moved.includes(it.dataset.id)) moved.push(it.dataset.id);
    });
  }

  // 3. what, if anything, is still touching the card
  const card = d.getBoundingClientRect();
  const guard = Math.min(card.width, card.height) * 0.06;
  let residual = 0;
  items.forEach(it => {
    const r = it.getBoundingClientRect();
    const ox = Math.min(card.right + guard, r.right) - Math.max(card.left - guard, r.left);
    const oy = Math.min(card.bottom + guard, r.bottom) - Math.max(card.top - guard, r.top);
    if (ox > 0 && oy > 0) residual += ox * oy;
  });
  return {moved: moved.length, residual: +(residual / (card.width*card.height)).toFixed(3)};
}
"""


def make_code(url):
    """The bare code, vector + raster. ECC H: survives print, glare, a photo."""
    import segno
    q = segno.make(url, error='h')
    svg = os.path.join(OUT, "junk-drawer-qr.svg")
    png = os.path.join(OUT, "junk-drawer-qr.png")
    q.save(svg, scale=10, border=4, dark=INK, light=PAPER)
    q.save(png, scale=24, border=4, dark=INK, light=PAPER)
    print(f"wrote {svg} + {png}  (version {q.version}, ecc {q.error})")
    return svg


def make_drawer_shot(qr_svg, page_url, caption, tries, width, rot):
    """Screenshot the live drawer with the QR card resting in it."""
    from playwright.sync_api import sync_playwright
    qr_uri = "data:image/svg+xml;base64," + base64.b64encode(
        open(qr_svg, "rb").read()).decode()
    raw = os.path.join(OUT, ".qr-drawer-raw.png")
    browsers = os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "")
    exe = next((p for p in [
        os.path.join(browsers, "chromium-1194", "chrome-linux", "chrome"),
        os.path.join(browsers, "chromium", "chrome-linux", "chrome"),
    ] if p and os.path.exists(p)), None)

    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe,
                              args=["--no-sandbox", "--force-color-profile=srgb"])
        pg = b.new_page(viewport={"width": 1500, "height": 1200}, device_scale_factor=3)
        best = None
        for attempt in range(tries):
            pg.goto(page_url, wait_until="networkidle")
            pg.wait_for_timeout(2500)
            res = pg.evaluate(COMPOSE_JS, {"width": width, "rot": rot,
                                           "qr": qr_uri, "caption": caption})
            pg.wait_for_timeout(300)
            pg.query_selector(".jd-stage").screenshot(path=raw)
            print(f"  try {attempt}: nudged {res['moved']} items, "
                  f"residual overlap {res['residual']}")
            if best is None or res["residual"] < best:
                best = res["residual"]
                keep = open(raw, "rb").read()
            if res["residual"] == 0:
                break
        b.close()
    open(raw, "wb").write(keep)
    return raw


def finish(raw):
    """Downscale to share size and confirm the code still decodes."""
    import cv2
    im = cv2.imread(raw)
    h, w = im.shape[:2]
    out = os.path.join(OUT, "junk-drawer-qr-drawer.png")
    small = cv2.resize(im, (SHARE_WIDTH, round(h * SHARE_WIDTH / w)),
                       interpolation=cv2.INTER_AREA)
    cv2.imwrite(out, small, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    os.remove(raw)
    decoded = cv2.QRCodeDetector().detectAndDecode(cv2.imread(out))[0]
    print(f"wrote {out}  ({SHARE_WIDTH}px wide)")
    print(f"scan check: {decoded or 'FAILED — the code is obstructed, rerun'}")
    return bool(decoded)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=URL, help="URL the code points at")
    ap.add_argument("--page", default=LOCAL, help="local URL of the drawer page")
    ap.add_argument("--tries", type=int, default=8,
                    help="reload/recompose until the code sits fully clear")
    ap.add_argument("--card-width", type=float, default=31, help="card width, cqmin")
    ap.add_argument("--rot", type=float, default=-4, help="card rotation, degrees")
    a = ap.parse_args()

    svg = make_code(a.url)
    caption = a.url.split("://", 1)[-1].rstrip("/")
    raw = make_drawer_shot(svg, a.page, caption, a.tries, a.card_width, a.rot)
    sys.exit(0 if finish(raw) else 1)
