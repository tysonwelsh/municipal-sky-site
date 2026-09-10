#!/usr/bin/env bash
# build-manifest.sh — concatenate manifest/<id>.json into manifest.json (sorted by
# id) after validating every entry and its reel. Exits non-zero on any bad entry.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; BC="$(cd "$HERE/.." && pwd)"
# --check verifies the COMMITTED manifest.json against the reel files and writes
# nothing. Use it before committing (or from a hook): broadcast/.htaccess caches
# reels for a year as immutable, which is only safe while every rev matches its
# file, so a stale rev in a commit is a reel the owner cannot be served.
MODE="build"; [ "${1:-}" = "--check" ] && MODE="check"
python3 - "$BC" "$MODE" <<'PY'
import glob, hashlib, json, os, sys
bc = sys.argv[1]
mode = sys.argv[2] if len(sys.argv) > 2 else "build"
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
        # THE REEL'S OWN VERSION. Reels are cached hard (they are immutable
        # content at a fixed name), so a RE-CUT reel — same name, new bytes —
        # stayed stale in the owner's browser for hours. Every reel URL carries
        # ?v=<rev>, so a re-cut changes the URL and is fetched fresh, while an
        # unchanged reel keeps its long cache. First 8 hex of the file's sha256:
        # short enough to read in a network log, wide enough not to collide.
        h = hashlib.sha256()
        with open(reel, "rb") as rfh:
            for chunk in iter(lambda: rfh.read(1 << 20), b""): h.update(chunk)
        e["rev"] = h.hexdigest()[:8]
    entries.append(e)
if errors:
    print("build-manifest: %d problem(s):" % len(errors), file=sys.stderr)
    for m in errors: print("  ✗ " + m, file=sys.stderr)
    sys.exit(1)
entries.sort(key=lambda e: e["id"])
out = os.path.join(bc, "manifest.json")
if mode == "check":
    # Every reel's recorded rev must equal its file's sha256 prefix, and every
    # reel must HAVE one. `entries` already carries the freshly computed revs,
    # so the comparison is against what is committed in manifest.json.
    try:
        have = {e["id"]: e for e in json.load(open(out))}
    except Exception as ex:
        print("build-manifest --check: cannot read manifest.json (%s)" % ex, file=sys.stderr); sys.exit(1)
    bad = []
    for e in entries:
        rec = have.get(e["id"])
        if rec is None: bad.append(f"{e['id']}: in manifest/ but not in manifest.json")
        elif not rec.get("rev"): bad.append(f"{e['id']}: manifest.json carries no rev")
        elif rec["rev"] != e["rev"]: bad.append(f"{e['id']}: rev {rec['rev']} but the reel hashes to {e['rev']} — STALE")
    for i in set(have) - set(x["id"] for x in entries):
        bad.append(f"{i}: in manifest.json but has no manifest/ entry")
    if bad:
        print("build-manifest --check: %d stale or missing rev(s):" % len(bad), file=sys.stderr)
        for m in bad: print("  ✗ " + m, file=sys.stderr)
        print("  reels are cached for a YEAR as immutable and keyed on the rev, so a stale one", file=sys.stderr)
        print("  means the owner is served the old reel. Run tools/build-manifest.sh.", file=sys.stderr)
        sys.exit(1)
    print("build-manifest --check: %d reels, every rev matches its file ✓" % len(entries))
    sys.exit(0)
# a rebuild that CHANGES a rev is worth saying out loud — it is the moment the
# cache key moves and the reason the owner will finally hear the new cut
try:
    prev = {e["id"]: e.get("rev") for e in json.load(open(out))}
except Exception:
    prev = {}
moved = [e["id"] for e in entries if prev.get(e["id"]) and prev[e["id"]] != e["rev"]]
with open(out, "w") as fh:
    fh.write("[\n" + ",\n".join(json.dumps(e, ensure_ascii=False, separators=(",", ":")) for e in entries) + "\n]\n")
total = sum(e["bytes"] for e in entries); nwin = sum(len(e["windows"]) for e in entries)
tiers = {t: sum(1 for e in entries if e["tier"] == t) for t in "AB"}
if moved: print("build-manifest: rev CHANGED for %d reel(s) — they will be re-fetched: %s" % (len(moved), ", ".join(moved[:8])))
print(f"build-manifest: {len(entries)} reels ({tiers['A']} Tier A, {tiers['B']} Tier B), {nwin} windows, "
      f"{total/1048576:.1f} MB of reels, manifest.json {os.path.getsize(out)/1024:.1f} KB")
for e in entries:
    print(f"  {e['id']:<40} {e['tier']} {e['tone']:<5} w{e['weight']} {len(e['windows'])} win {e['bytes']/1024:6.0f} KB  {e.get('license','')}")
PY
