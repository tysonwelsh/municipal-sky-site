#!/usr/bin/env python3
"""pool-shapes.py — what the reel pool can actually serve (PLAN-SIGNAL-SHAPES §5).

§2 gives the owner's spread of ON-AIR time: 8–12 s 15 %, 12–18 s 25 %,
18–25 s 25 %, 25–32 s 20 %, 32–40 s 15 %. The receiver degrades a budget it
cannot serve, so the harness's "achieved" column has a ceiling — this prints
that ceiling, per bucket, with the tiers, tones and countries behind it, so
"32–40 s: 41 reels" is a number in the log and not an impression.

The arithmetic is the receiver's own (zk-broadcast.js windowServes):

  常 the ordinary   one window carries  wl − entry − exit  seconds on air
  戻 the return     each PIECE has its own window, so two pieces of a 12 s
                    window carry about 20 s and three about 32
  走 the scan       two reels, so two windows
  断 the broken     one window, less its holes

So the plain body is the binding one, and it is the plain body this reports:
the spread the owner tuned is reachable for 常 only where a reel has a window
long enough. The shapes reach further on the same reels, which is why R2 works
at all before the re-cut — and why the re-cut is still what makes the owner's
table mean what it says.

    pool-shapes.py [manifest.json] [--by tier|tone|country] [--csv]
"""
import json
import os
import sys
from collections import Counter, defaultdict

ENTRY_S = 0.4       # 即 the snap: what an ordinary reception's arrival costs
EXIT_S = 2.2        # 切 the cut: the mean loss ramp (1.6–2.8)
BUCKETS = [(8, 12), (12, 18), (18, 25), (25, 32), (32, 41)]
ASKED = [0.15, 0.25, 0.25, 0.20, 0.15]   # §2's table
CAP = {"A": 40.0, "B": 30.0}


def longest(e):
    return max((w[1] - w[0]) for w in e["windows"]) if e.get("windows") else 0.0


def serves(e):
    """the longest ORDINARY reception this reel can put on air"""
    if e.get("whole") or e.get("wholeWindows"):
        # §14: a whole window is never sliced — it plays start to end, so what
        # it serves IS its length, capped by the receiver's WHOLE_MAX_HOLD_S
        return min(longest(e), 42.0)
    return max(0.0, longest(e) - ENTRY_S - EXIT_S)


def country_of(e):
    n = (e.get("notes") or "") + " " + (e.get("title") or "")
    return (e.get("country") or "—")


def main():
    args = [a for a in sys.argv[1:]]
    path = None
    by = "tier"
    csv = False
    i = 0
    while i < len(args):
        if args[i] == "--by":
            i += 1
            by = args[i]
        elif args[i] == "--csv":
            csv = True
        else:
            path = args[i]
        i += 1
    if not path:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "manifest.json")
    m = json.load(open(path))
    reels = m["reels"] if isinstance(m, dict) else m
    reels = [e for e in reels if not e.get("takedown") and e.get("windows")]

    rows = []
    for e in reels:
        rows.append((serves(e), e))

    if csv:
        print("id,tier,tone,serves_s,longest_window_s,windows")
        for s, e in sorted(rows, key=lambda r: -r[0]):
            print("%s,%s,%s,%.1f,%.1f,%d" % (e["id"], e.get("tier"), e.get("tone"), s, longest(e), len(e["windows"])))
        return

    total = len(rows)
    print("pool: %d reels · %d windows · the ORDINARY body (常), one window, entry %.1f s + exit %.1f s"
          % (total, sum(len(e["windows"]) for _, e in rows), ENTRY_S, EXIT_S))
    print()
    hdr = "  %-10s %6s %7s   %s" % ("on air", "reels", "share", "asked (§2)")
    print(hdr)
    print("  " + "-" * (len(hdr) - 2))
    for (lo, hi), ask in zip(BUCKETS, ASKED):
        n = sum(1 for s, _ in rows if s >= lo)          # CAN serve at least this bucket's floor
        inb = sum(1 for s, _ in rows if lo <= s < hi)   # tops out in this bucket
        print("  %-10s %6d %6.1f%%   %4.0f%%   %s"
              % ("%d–%d s" % (lo, min(hi, 40)), n, 100.0 * n / max(1, total), 100 * ask,
                 "" if n else "← NOTHING in the pool can serve this"))
    print()
    print("  (reels = how many can serve a reception of at least that length; the")
    print("   owner's share is what §2 asks for, so a bucket whose reels are far")
    print("   below its share is a bucket the receiver will keep degrading out of.)")
    print()

    key = {"tier": lambda e: e.get("tier") or "?",
           "tone": lambda e: e.get("tone") or "?",
           "country": country_of}.get(by, lambda e: e.get("tier") or "?")
    groups = defaultdict(list)
    for s, e in rows:
        groups[key(e)].append(s)
    print("  by %s — how far each group reaches:" % by)
    for g in sorted(groups, key=lambda g: -len(groups[g])):
        ss = sorted(groups[g])
        med = ss[len(ss) // 2]
        over = [sum(1 for x in ss if x >= lo) for lo, _ in BUCKETS]
        print("    %-12s %4d reels · median %5.1f s · max %5.1f s · can serve %s"
              % (g, len(ss), med, ss[-1], "/".join(str(x) for x in over)))
    print()
    caps = Counter()
    for s, e in rows:
        t = (e.get("tier") or "A").upper()
        room = CAP.get(t, 40.0) - longest(e)
        if room > 6:
            caps[t] += 1
    print("  room for a long window (its tier's cap minus its longest window > 6 s):")
    for t in sorted(caps):
        print("    tier %s: %d reels could take one, capped at %g s" % (t, caps[t], CAP[t]))
    print()
    print("  §5's order: a first batch of 60–80 across tiers, tones and countries, so no")
    print("  bucket is served by one kind of material; then the rest. Propose a reel's")
    print("  long windows with  make-reel.sh <src> --id <slug> --propose --window-len 30")
    print("  and append them with  make-reel.sh <src> --id <slug> --add-windows a-b")


if __name__ == "__main__":
    main()
