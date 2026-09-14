#!/usr/bin/env python3
"""propose-long.py — propose ONE long window per reel (PLAN-SIGNAL-SHAPES §5).

§2 asks for receptions of 8 to 40 seconds on air; a 12 s window serves about
nine. The answer is long windows, and this is the pass that finds them: for
each reel with a cached analysis log, it scores every candidate stretch of the
source against the loudness and black gates reel-propose.py already uses, plus
the two that only matter at this length —

  IT MUST NOT OVERLAP what the reel already plays. A long window beside the
    existing ones is a new moment of the source; a long window ON TOP of one is
    the same broadcast twice with a different edit.
  IT MUST NOT GO QUIET IN THE MIDDLE. A 34 s stretch whose loudest ten seconds
    carry it and whose last twenty are room tone is exactly the reception the
    owner said was too short, stretched. The score is the WORST five-second
    slice, not the mean.

The lengths are drawn across the §5 bands — a third at 18–25 s, a third at
25–32 s, a third at 32–40 s (Tier B capped at 30) — assigned by the reel's id
so the pool ends up able to serve the whole of §2's table rather than one
bucket of it, and so re-running this proposes the same thing.

It PROPOSES. Cutting is `make-reel.sh --add-windows`, and the owner's ear is
what decides — §5's order and §6's R4 gate both say so.

    propose-long.py <manifest/<id>.json> [--src-dir DIR]
    propose-long.py --all [--src-dir DIR] [--json]
"""
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BC = os.path.dirname(HERE)
DEFAULT_SRC = os.path.expanduser("~/Media/zankyo-broadcast-src")
BANDS = [(18.0, 25.0), (25.0, 32.0), (32.0, 40.0)]
CAP = {"A": 40.0, "B": 30.0}
EDGE_S = 3.0
CLEAR_S = 2.0          # a long window keeps this clear of the reel's own windows
MIN_WORST_LUFS = -38.0  # the worst 5 s slice must still be a broadcast
MAX_SILENT_FRAC = 0.22  # …and under this much of it may be near-silence


def analysis_for(reel_id, src_dir):
    p = os.path.join(src_dir, reel_id + ".analysis.log")
    return p if os.path.exists(p) and os.path.getsize(p) > 0 else None


def parse(log):
    text = open(log, errors="replace").read()
    scenes = [float(m) for m in re.findall(r"lavfi\.scd\.time:\s*([\d.]+)", text)]
    if not scenes:
        scenes = [float(m) for m in re.findall(r"showinfo.*?pts_time:\s*([\d.]+)", text)]
    blacks = [(float(a), float(b)) for a, b in
              re.findall(r"black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)", text)]
    loud = []
    for t, m in re.findall(r"ebur128.*?\bt:\s*([\d.]+).*?\bM:\s*(-?[\d.]+)", text):
        loud.append((float(t), max(float(m), -70.0)))
    loud.sort()
    return scenes, blacks, loud


def band_for(reel_id, tier):
    """a stable band per reel, so the pool spreads across §2's table"""
    h = int(hashlib.sha1(reel_id.encode()).hexdigest()[:8], 16)
    lo, hi = BANDS[h % len(BANDS)]
    cap = CAP.get((tier or "A").upper(), 40.0)
    if lo >= cap:                       # tier B cannot reach the top band
        lo, hi = BANDS[h % 2]
    hi = min(hi, cap)
    frac = ((h >> 8) % 1000) / 1000.0
    return round(lo + frac * (hi - lo), 1)


def propose(entry, src_dir):
    rid = entry["id"]
    log = analysis_for(rid, src_dir)
    if not log:
        return {"id": rid, "why": "no cached analysis (the source is gone or was never analysed)"}
    if entry.get("whole") or entry.get("wholeWindows"):
        return {"id": rid, "why": "§14 whole reel — its windows ARE its thoughts"}
    sw = entry.get("srcWindows")
    if not sw:
        return {"id": rid, "why": "no srcWindows — predates them, re-cut with --windows"}

    scenes, blacks, loud = parse(log)
    if len(loud) < 20:
        return {"id": rid, "why": "the cached analysis carries no loudness series"}
    dur = loud[-1][0]
    L = band_for(rid, entry.get("tier"))
    if dur < L + 2 * EDGE_S:
        return {"id": rid, "why": "source is only %.0f s — no room for a %.0f s window" % (dur, L)}

    ts = [t for t, _ in loud]
    ms = [m for _, m in loud]

    def slice_idx(s, e):
        import bisect
        return bisect.bisect_left(ts, s), bisect.bisect_left(ts, e)

    def black_frac(s, e):
        tot = 0.0
        for a, b in blacks:
            lo, hi = max(a, s), min(b, e)
            if hi > lo:
                tot += hi - lo
        return tot / max(e - s, 1e-6)

    def clear_of_existing(s, e):
        for a, b in sw:
            if not (e + CLEAR_S <= a or s >= b + CLEAR_S):
                return False
        return True

    best = None
    step = 2.0
    s = EDGE_S
    while s + L <= dur - EDGE_S:
        e = s + L
        if not clear_of_existing(s, e):
            s += step
            continue
        i0, i1 = slice_idx(s, e)
        vals = ms[i0:i1]
        if len(vals) < 10:
            s += step
            continue
        # THE WORST FIVE SECONDS, not the mean: a long window that dies in the
        # middle is the complaint this whole plan is answering, stretched.
        win = max(2, int(5.0 / max(0.01, (e - s) / len(vals))))
        worst = min(sum(vals[i:i + win]) / win for i in range(0, max(1, len(vals) - win)))
        silent = sum(1 for v in vals if v < -50) / len(vals)
        bf = black_frac(s, e)
        if worst < MIN_WORST_LUFS or silent > MAX_SILENT_FRAC or bf > 0.08:
            s += step
            continue
        cuts = sum(1 for c in scenes if s < c < e)
        mean = sum(vals) / len(vals)
        score = worst + 0.4 * mean - 14.0 * silent - 30.0 * bf + 0.6 * min(cuts, 6)
        if best is None or score > best["score"]:
            best = {"score": round(score, 2), "s": round(s, 1), "e": round(e, 1),
                    "worst": round(worst, 1), "mean": round(mean, 1),
                    "silent": round(silent, 3), "black": round(bf, 3), "cuts": cuts}
        s += step
    if not best:
        return {"id": rid, "why": "nothing clear of the reel's own windows stayed above %.0f LUFS for %.0f s" % (MIN_WORST_LUFS, L)}
    best["id"] = rid
    best["len"] = round(L, 1)
    best["tier"] = entry.get("tier")
    best["tone"] = entry.get("tone")
    best["title"] = entry.get("title")
    return best


def main():
    args = sys.argv[1:]
    src_dir = DEFAULT_SRC
    as_json = False
    targets = []
    i = 0
    while i < len(args):
        if args[i] == "--src-dir":
            i += 1
            src_dir = os.path.expanduser(args[i])
        elif args[i] == "--json":
            as_json = True
        elif args[i] == "--all":
            targets = None
        else:
            targets.append(args[i])
        i += 1

    m = json.load(open(os.path.join(BC, "manifest.json")))
    reels = m["reels"] if isinstance(m, dict) else m
    if targets:
        want = set(os.path.basename(t).replace(".json", "") for t in targets)
        reels = [e for e in reels if e["id"] in want]

    out = [propose(e, src_dir) for e in reels]
    ok = [r for r in out if "s" in r]
    no = [r for r in out if "s" not in r]
    if as_json:
        print(json.dumps({"proposed": ok, "skipped": no}, indent=1))
        return
    for r in sorted(ok, key=lambda r: -r["score"]):
        print("%-46s %s %-6s %5.1f s  %7.1f-%-7.1f  worst %6.1f LUFS  silent %4.1f%%  cuts %2d"
              % (r["id"], r["tier"], r["tone"], r["len"], r["s"], r["e"], r["worst"], 100 * r["silent"], r["cuts"]))
    print()
    print("%d proposed · %d skipped" % (len(ok), len(no)))
    why = {}
    for r in no:
        k = r["why"].split("—")[0].split("(")[0].strip()
        why[k] = why.get(k, 0) + 1
    for k in sorted(why, key=lambda k: -why[k]):
        print("   %3d  %s" % (why[k], k))


if __name__ == "__main__":
    main()
