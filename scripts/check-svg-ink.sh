#!/bin/bash
# check-svg-ink.sh — measure how much of an SVG's viewBox its visible ink
# actually occupies. The junk drawer's drag clamping and size math trust
# the viewBox rectangle, so dead transparent margin makes items bump
# invisible walls (see PLAN-FRONTEND §2, "tight viewBox").
#
# Usage:  scripts/check-svg-ink.sh art/junk-drawer/items/<id>/<file>.svg
#
# Renders the SVG in headless Chrome/Chromium, alpha-scans a canvas (so
# stroke widths count, unlike getBBox), and prints the ink bounds, per-side
# margins, and a suggested tightened viewBox (with a 2-unit margin).
#
# Cross-platform: finds a browser via $CHROME_BIN, then the macOS Chrome
# app, then PATH (google-chrome / chromium / …), then a Playwright-managed
# Chromium under /opt/pw-browsers. Runs anywhere one of those exists —
# desktop, CI, or a sandboxed session — so the ink check is a normal
# ingest step, not a desktop-only afterthought. scripts/ is deploy-excluded.

set -euo pipefail
SVG="${1:?usage: check-svg-ink.sh <path-to.svg>}"
[ -f "$SVG" ] || { echo "no such file: $SVG" >&2; exit 1; }

# ---- locate a Chrome/Chromium binary -------------------------------------
find_chrome() {
  if [ -n "${CHROME_BIN:-}" ] && [ -x "$CHROME_BIN" ]; then echo "$CHROME_BIN"; return; fi
  local mac="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  [ -x "$mac" ] && { echo "$mac"; return; }
  local c
  for c in google-chrome google-chrome-stable chromium chromium-browser chrome; do
    if command -v "$c" >/dev/null 2>&1; then command -v "$c"; return; fi
  done
  # Playwright-managed Chromium (newest chromium-* wins)
  local pw
  pw=$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | sort -V | tail -1 || true)
  [ -n "$pw" ] && [ -x "$pw" ] && { echo "$pw"; return; }
  return 1
}
CHROME=$(find_chrome) || {
  echo "no Chrome/Chromium found (set CHROME_BIN, or install chromium)" >&2; exit 2;
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp "$SVG" "$TMP/target.svg"

cat > "$TMP/harness.html" <<'EOF'
<!DOCTYPE html><html><head><title>PENDING</title></head><body><script>
function done(o){document.title=btoa(unescape(encodeURIComponent(JSON.stringify(o))));}
fetch('target.svg').then(function(r){return r.text();}).then(function(s){
  var m=s.match(/viewBox="([^"]+)"/); if(!m){done({err:'no viewBox'});return;}
  var vb=m[1].split(/[\s,]+/).map(Number);
  var SCALE=Math.min(4,4000/Math.max(vb[2],vb[3]));
  var img=new Image();
  img.onload=function(){
    try{
      var w=Math.round(vb[2]*SCALE),h=Math.round(vb[3]*SCALE);
      var c=document.createElement('canvas');c.width=w;c.height=h;
      var ctx=c.getContext('2d');ctx.drawImage(img,0,0,w,h);
      var d=ctx.getImageData(0,0,w,h).data;
      var minX=w,minY=h,maxX=-1,maxY=-1,x,y;
      for(y=0;y<h;y++)for(x=0;x<w;x++){if(d[(y*w+x)*4+3]>8){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}
      if(maxX<0){done({err:'no visible ink'});return;}
      var ix=vb[0]+minX/SCALE,iy=vb[1]+minY/SCALE,iw=(maxX-minX)/SCALE,ih=(maxY-minY)/SCALE;
      var mL=ix-vb[0],mT=iy-vb[1],mR=(vb[0]+vb[2])-(ix+iw),mB=(vb[1]+vb[3])-(iy+ih);
      var worst=Math.max(mL/vb[2],mR/vb[2],mT/vb[3],mB/vb[3]),pad=2;
      done({vb:vb,ink:[ix,iy,iw,ih],m:[mL,mR,mT,mB],worst:worst,
        suggested:[ix-pad,iy-pad,iw+2*pad,ih+2*pad]});
    }catch(e){done({err:'canvas read failed: '+e.name});}
  };
  img.onerror=function(){done({err:'image load failed'});};
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);
});
</script></body></html>
EOF

DOM=$("$CHROME" --headless=new --no-sandbox --disable-gpu \
  --allow-file-access-from-files --virtual-time-budget=12000 \
  --dump-dom "file://$TMP/harness.html" 2>/dev/null || true)
B64=$(printf '%s' "$DOM" | sed -n 's/.*<title>\(.*\)<\/title>.*/\1/p')
[ -n "$B64" ] && [ "$B64" != "PENDING" ] || { echo "[INK] ERROR: no result from browser" >&2; exit 3; }

cat > "$TMP/fmt.py" <<'PY'
import json, sys
o = json.load(sys.stdin)
if 'err' in o:
    print('[INK] ERROR: ' + o['err']); sys.exit(4)
vb = o['vb']; ix, iy, iw, ih = o['ink']; mL, mR, mT, mB = o['m']; worst = o['worst']
sx, sy, sw, sh = o['suggested']
pct = lambda v, tot: f'{100*v/tot:.1f}%'
print('[INK] viewBox: ' + ' '.join(str(int(v)) if v == int(v) else str(v) for v in vb))
print(f'[INK] ink bounds: {ix:.1f} {iy:.1f}  size {iw:.1f} x {ih:.1f}')
print(f'[INK] margins  L {mL:.1f} ({pct(mL,vb[2])})  R {mR:.1f} ({pct(mR,vb[2])})'
      f'  T {mT:.1f} ({pct(mT,vb[3])})  B {mB:.1f} ({pct(mB,vb[3])})')
print(f'[INK] suggested viewBox: "{sx:.1f} {sy:.1f} {sw:.1f} {sh:.1f}"')
print('[INK] verdict: ' + ('PADDED (worst side %.1f%% dead) — tighten it' % (100*worst)
      if worst > 0.06 else 'tight enough'))
PY
printf '%s' "$B64" | base64 -d 2>/dev/null | python3 "$TMP/fmt.py"
