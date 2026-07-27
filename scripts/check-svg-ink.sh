#!/bin/bash
# check-svg-ink.sh — measure how much of an SVG's viewBox its visible ink
# actually occupies. The junk drawer's drag clamping and size math trust
# the viewBox rectangle, so dead transparent margin makes items bump
# invisible walls (see PLAN-FRONTEND §2, "tight viewBox").
#
# Usage:  scripts/check-svg-ink.sh art/junk-drawer/items/<id>/<file>.svg
#
# Renders the SVG in headless Chrome, alpha-scans a canvas (so stroke
# widths count, unlike getBBox), and prints the ink bounds, per-side
# margins, and a suggested tightened viewBox (with a 2-unit margin).
# Mac + Chrome only; never deployed (scripts/ is deploy-excluded).

set -euo pipefail
SVG="${1:?usage: check-svg-ink.sh <path-to.svg>}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -f "$SVG" ] || { echo "no such file: $SVG" >&2; exit 1; }
[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME" >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp "$SVG" "$TMP/target.svg"

cat > "$TMP/harness.html" <<'EOF'
<!DOCTYPE html>
<html><body><script>
fetch('target.svg').then(r => r.text()).then(function (svgText) {
  var m = svgText.match(/viewBox="([^"]+)"/);
  if (!m) { console.log('[INK] ERROR: no viewBox'); return; }
  var vb = m[1].split(/\s+/).map(Number);
  var SCALE = Math.min(4, 4000 / Math.max(vb[2], vb[3]));
  var img = new Image();
  img.onload = function () {
    var w = Math.round(vb[2] * SCALE), h = Math.round(vb[3] * SCALE);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    var d = ctx.getImageData(0, 0, w, h).data;
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) { console.log('[INK] ERROR: no visible ink'); return; }
    var ix = vb[0] + minX / SCALE, iy = vb[1] + minY / SCALE;
    var iw = (maxX - minX) / SCALE, ih = (maxY - minY) / SCALE;
    var mL = ix - vb[0], mT = iy - vb[1];
    var mR = (vb[0] + vb[2]) - (ix + iw), mB = (vb[1] + vb[3]) - (iy + ih);
    var pct = function (v, tot) { return (100 * v / tot).toFixed(1) + '%'; };
    console.log('[INK] viewBox: ' + vb.join(' '));
    console.log('[INK] ink bounds: ' + ix.toFixed(1) + ' ' + iy.toFixed(1) +
      '  size ' + iw.toFixed(1) + ' x ' + ih.toFixed(1));
    console.log('[INK] margins  L ' + mL.toFixed(1) + ' (' + pct(mL, vb[2]) +
      ')  R ' + mR.toFixed(1) + ' (' + pct(mR, vb[2]) +
      ')  T ' + mT.toFixed(1) + ' (' + pct(mT, vb[3]) +
      ')  B ' + mB.toFixed(1) + ' (' + pct(mB, vb[3]) + ')');
    var pad = 2;
    console.log('[INK] suggested viewBox: "' + (ix - pad).toFixed(1) + ' ' +
      (iy - pad).toFixed(1) + ' ' + (iw + 2 * pad).toFixed(1) + ' ' +
      (ih + 2 * pad).toFixed(1) + '"');
    var worst = Math.max(mL / vb[2], mR / vb[2], mT / vb[3], mB / vb[3]);
    console.log('[INK] verdict: ' + (worst > 0.06
      ? 'PADDED (worst side ' + (100 * worst).toFixed(1) + '% dead) — tighten it'
      : 'tight enough'));
  };
  img.src = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
});
</script></body></html>
EOF

"$CHROME" --headless --disable-gpu --allow-file-access-from-files \
  --virtual-time-budget=8000 --enable-logging=stderr --dump-dom \
  "file://$TMP/harness.html" >/dev/null 2>"$TMP/err.log" || true
grep -a '\[INK\]' "$TMP/err.log" | sed 's/.*\[INK\] //;s/", source.*//'
