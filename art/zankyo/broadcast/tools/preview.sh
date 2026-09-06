#!/usr/bin/env bash
# preview.sh <id> [--ffplay] — print a reel's windows and open it for audition.
# Default opens the reel in QuickTime (non-blocking). --ffplay plays it in a
# 4× ffplay window instead (blocks until closed; q quits).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; BC="$(cd "$HERE/.." && pwd)"
ID="${1:-}"; [ -n "$ID" ] || { echo "usage: preview.sh <id> [--ffplay]" >&2; exit 1; }
REEL="$BC/reels/$ID.mp4"; JSON="$BC/manifest/$ID.json"
[ -f "$REEL" ] || { echo "preview: no reel at $REEL" >&2; exit 1; }
if [ -f "$JSON" ]; then
python3 - "$JSON" <<'PY'
import json, sys
e = json.load(open(sys.argv[1]))
def f(t): return f"{int(t//60)}:{t%60:05.2f}"
print(f"{e['id']}  —  {e.get('title','')} ({e.get('year') or '?'})  tier {e.get('tier')}  {e.get('tone')}  w{e.get('weight')}  gain {e.get('gain')} dB")
print(f"src: {e.get('src')}   license: {e.get('license')}")
if e.get('notes'): print("notes:", e['notes'])
print(f"{'#':>3}  {'reel':<17} {'source':<19}")
for i, (w, s) in enumerate(zip(e['windows'], e.get('srcWindows', e['windows'])), 1):
    print(f"{i:>3}  {f(w[0])} – {f(w[1])}   {f(s[0])} – {f(s[1])}")
PY
else
  echo "preview: no manifest entry at $JSON (reel only)" >&2
fi
echo "reel: ${REEL}  ($(du -h "$REEL" | cut -f1))"
if [ "${2:-}" = "--ffplay" ] && command -v ffplay >/dev/null; then
  ffplay -hide_banner -loglevel error -autoexit -x 768 -y 576 -window_title "$ID" "$REEL"
else
  open "$REEL"
fi
