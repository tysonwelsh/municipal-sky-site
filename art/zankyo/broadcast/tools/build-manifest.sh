#!/usr/bin/env bash
# build-manifest.sh — concatenate manifest/<id>.json into manifest.json (sorted by
# id) after validating every entry and its reel. Exits non-zero on any bad entry.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; BC="$(cd "$HERE/.." && pwd)"
python3 - "$BC" <<'PY'
import glob, json, os, sys
bc = sys.argv[1]
TONES = {"voice", "music", "noise", "sung", "tone", "drone"}
MAX_BYTES = 2 * 1024 * 1024
entries, errors = [], []
def err(f, msg): errors.append(f"{os.path.relpath(f, bc)}: {msg}")
files = sorted(glob.glob(os.path.join(bc, "manifest", "*.json")))
if not files:
    print("build-manifest: no manifest/*.json entries found", file=sys.stderr); sys.exit(1)
for f in files:
    try:
        e = json.load(open(f))
    except Exception as ex:
        err(f, f"not valid JSON ({ex})"); continue
    stem = os.path.basename(f)[:-5]
    def need(k, types, ok=lambda v: True, what=""):
        if k not in e: err(f, f"missing field '{k}'"); return None
        v = e[k]
        if not isinstance(v, types) or isinstance(v, bool) and bool not in (types if isinstance(types, tuple) else (types,)):
            err(f, f"field '{k}' has wrong type ({type(v).__name__})"); return None
        if not ok(v): err(f, f"field '{k}' {what}: {v!r}"); return None
        return v
    need("id", str, lambda v: v == stem, "must equal the file name")
    need("title", str, lambda v: v.strip() != "", "must not be empty")
    if "year" not in e: err(f, "missing field 'year'")
    elif e["year"] is not None and not (isinstance(e["year"], int) and 1850 <= e["year"] <= 2100): err(f, f"bad year {e['year']!r}")
    need("src", str, lambda v: v.strip() != "", "must not be empty")
    need("license", str, lambda v: v.strip() != "", "must not be empty")
    tier = need("tier", str, lambda v: v in ("A", "B"), "must be A or B")
    need("tone", str, lambda v: v in TONES, "must be one of " + "/".join(sorted(TONES)))
    need("weight", int, lambda v: 1 <= v <= 5, "must be 1..5")
    need("gain", (int, float), lambda v: -24 <= v <= 24, "out of range")
    need("takedown", bool)
    w = need("windows", list, lambda v: len(v) >= 1, "must have at least one window")
    sw = need("srcWindows", list)
    if w is not None:
        last = -1.0
        for i, pair in enumerate(w):
            if not (isinstance(pair, list) and len(pair) == 2 and all(isinstance(x, (int, float)) for x in pair) and pair[1] > pair[0]):
                err(f, f"windows[{i}] is not [start, end] with end > start: {pair!r}"); break
            if pair[0] < last - 0.01: err(f, f"windows[{i}] overlaps the previous window"); break
            last = pair[1]
        if tier == "B" and len(w) > 6: err(f, f"Tier B reel carries {len(w)} windows (max 6)")
        if len(w) > 10: err(f, f"{len(w)} windows (max 10)")
        if sw is not None and len(sw) != len(w): err(f, "srcWindows and windows differ in length")
    reel = os.path.join(bc, "reels", stem + ".mp4")
    if not os.path.isfile(reel): err(f, f"reels/{stem}.mp4 is missing")
    else:
        sz = os.path.getsize(reel)
        if sz > MAX_BYTES: err(f, f"reels/{stem}.mp4 is {sz/1048576:.2f} MB (max 2 MB)")
        if sz < 20000: err(f, f"reels/{stem}.mp4 is suspiciously small ({sz} bytes)")
        e["bytes"] = sz
    entries.append(e)
if errors:
    print("build-manifest: %d problem(s):" % len(errors), file=sys.stderr)
    for m in errors: print("  ✗ " + m, file=sys.stderr)
    sys.exit(1)
entries.sort(key=lambda e: e["id"])
out = os.path.join(bc, "manifest.json")
with open(out, "w") as fh:
    fh.write("[\n" + ",\n".join(json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in entries) + "\n]\n")
total = sum(e["bytes"] for e in entries); nwin = sum(len(e["windows"]) for e in entries)
tiers = {t: sum(1 for e in entries if e["tier"] == t) for t in "AB"}
print(f"build-manifest: {len(entries)} reels ({tiers['A']} Tier A, {tiers['B']} Tier B), {nwin} windows, "
      f"{total/1048576:.1f} MB of reels, manifest.json {os.path.getsize(out)/1024:.1f} KB")
for e in entries:
    print(f"  {e['id']:<40} {e['tier']} {e['tone']:<5} w{e['weight']} {len(e['windows'])} win {e['bytes']/1024:6.0f} KB  {e.get('license','')}")
PY
