#!/usr/bin/env bash
# cut-long-batch.sh — cut the long windows propose-long.py proposed, in a batch.
#
# PLAN-SIGNAL-SHAPES §5. The agent proposes and THE OWNER'S EAR DECIDES, so this
# does not run itself: it takes a list of reel ids (a file, one per line, or
# arguments) and calls make-reel.sh --add-windows for each with the range
# propose-long.py picked. Every reel it touches is auditionable afterwards with
#   tools/preview.sh <id>            and the reel lab's body/on-air controls.
#
#   propose-long.py --all                       # read the proposals
#   propose-long.py --all --json > batch.json   # …or keep them
#   cut-long-batch.sh --plan 24                 # print the next 24 as commands
#   cut-long-batch.sh --plan 24 --run           # …and run them
#   cut-long-batch.sh nasa-mercury-redstone-1-1960 rte-news-angelus-1983
#
# --plan N takes the N best-scoring proposals SPREAD across tiers, tones and
# §2's length bands, which is §5's order ("so no bucket is served by one kind of
# material") rather than simply the top N of one list.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
BC="$(cd "$HERE/.." && pwd)"
RUN=0; PLAN=0; IDS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --run) RUN=1; shift ;;
    --plan) PLAN="${2:?}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    -*) echo "cut-long-batch: unknown option $1" >&2; exit 1 ;;
    *) IDS+=("$1"); shift ;;
  esac
done

PROPOSALS="$(python3 "$HERE/propose-long.py" --all --json)"

if [ "$PLAN" -gt 0 ]; then
  # NOT mapfile: macOS ships bash 3.2, where it does not exist. Every other
  # tool here runs under /usr/bin/env bash and so runs under 3.2 too.
  IDS=()
  while IFS= read -r __id; do [ -n "$__id" ] && IDS+=("$__id"); done < <(python3 - "$PROPOSALS" "$PLAN" <<'PY'
import json, sys
from collections import defaultdict
d = json.loads(sys.argv[1]); n = int(sys.argv[2])
p = sorted(d["proposed"], key=lambda r: -r["score"])
def band(L): return 0 if L < 25 else 1 if L < 32 else 2
# round-robin over (tier, tone, band) so a batch is a cross-section of the pool
buckets = defaultdict(list)
for r in p: buckets[(r["tier"], r["tone"], band(r["len"]))].append(r)
keys = sorted(buckets, key=lambda k: -len(buckets[k]))
out = []
while len(out) < n and any(buckets[k] for k in keys):
    for k in keys:
        if buckets[k]:
            out.append(buckets[k].pop(0))
            if len(out) >= n: break
for r in out: print(r["id"])
PY
)
fi

[ "${#IDS[@]}" -gt 0 ] || { echo "cut-long-batch: nothing to cut (give ids or --plan N)" >&2; exit 1; }

SRC_DIR="$(cd "$BC/../../.." && pwd)/local-dev/broadcast-src"
for id in "${IDS[@]}"; do
  line="$(python3 - "$PROPOSALS" "$id" <<'PY'
import json, sys, glob, os
d = json.loads(sys.argv[1]); rid = sys.argv[2]
for r in d["proposed"]:
    if r["id"] == rid:
        print("%s %g-%g" % (rid, r["s"], r["e"])); break
else:
    sys.exit("cut-long-batch: no proposal for " + rid)
PY
)"
  rng="${line#* }"
  src="$(ls "$SRC_DIR/$id".* 2>/dev/null | grep -vE '\.analysis\.|\.part$|\.ytdl$' | head -1 || true)"
  [ -n "$src" ] || { echo "  SKIP $id — no cached source" >&2; continue; }
  cmd=("$HERE/make-reel.sh" "$src" --id "$id" --add-windows "$rng")
  if [ "$RUN" = 1 ]; then
    echo "▸ $id  $rng"
    # KEEP THE REASON. The first batch run reported ten FAILED reels with no
    # reason attached, and six of the ten had busted a cap while four were
    # collateral — build-manifest.sh validates the WHOLE POOL, so one over-cap
    # reel fails every reel cut after it. A failure has to carry its own words.
    if ! out="$("${cmd[@]}" 2>&1)"; then
      echo "  FAILED $id" >&2
      printf '%s\n' "$out" | grep -E "make-reel:|build-manifest:|\u2717" | tail -3 | sed 's/^/    /' >&2
    fi
  else
    printf '%q ' "${cmd[@]}"; echo
  fi
done
if [ "$RUN" = 1 ]; then
  echo "▸ rebuilding the manifest"
  "$HERE/build-manifest.sh" >/dev/null
  echo "▸ what the pool serves now:"
  python3 "$HERE/pool-shapes.py" | sed -n '1,12p'
  echo "▸ AUDITION BEFORE THIS LANDS: tools/preview.sh <id>, or the reel lab."
fi
