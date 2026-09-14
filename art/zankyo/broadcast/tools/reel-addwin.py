#!/usr/bin/env python3
"""reel-addwin.py — §5 of PLAN-SIGNAL-SHAPES: add long windows to an existing reel.

Reads a reel's manifest entry, appends the given SOURCE ranges to its existing
srcWindows, checks the tier's cap and the overlaps, and prints shell
assignments for make-reel.sh to eval.

The existing windows are passed through VERBATIM. A re-cut that re-proposed
them would change what every night that has already drawn this reel sounds
like, and the new rev would make every browser fetch that difference.

    reel-addwin.py <manifest/<id>.json> "83-110,201-236"
"""
import json
import shlex
import sys

MIN_LONG_S = 13.0          # under this it is just another ordinary window
CAP = {"A": 40.0, "B": 30.0}   # the owner's ruling, 2026-09-14 (§7 q4)
TIER_B_MAX_WINDOWS = 6     # plan §5.5, unchanged: a long window COUNTS toward it


def die(msg):
    sys.stderr.write("make-reel: " + msg + "\n")
    sys.exit(1)


def secs(s):
    t = 0.0
    for x in s.split(":"):
        t = t * 60 + float(x)
    return t


def main():
    if len(sys.argv) != 3:
        die("usage: reel-addwin.py <manifest.json> <a-b,c-d>")
    try:
        e = json.load(open(sys.argv[1]))
    except Exception as exc:
        die("could not read %s: %s" % (sys.argv[1], exc))

    sw = e.get("srcWindows")
    if not sw:
        die("%s carries no srcWindows — this reel predates them and cannot be "
            "re-cut from its manifest alone; re-cut it with --windows instead" % sys.argv[1])
    if e.get("whole") or e.get("wholeWindows"):
        die("--add-windows on a WHOLE reel (§14): a whole reel's windows ARE its "
            "thoughts, and a long window added beside them would be sliced. "
            "Re-cut it with --whole and --windows instead.")

    tier = (e.get("tier") or "A").upper()
    cap = CAP.get(tier, 40.0)

    add = []
    for it in sys.argv[2].split(","):
        it = it.strip()
        if not it:
            continue
        if "-" not in it:
            die("--add-windows takes explicit ranges like 83-110, not %r" % it)
        a, b = it.split("-", 1)
        add.append([secs(a), secs(b)])
    if not add:
        die("--add-windows parsed to nothing")

    for a, b in add:
        if b <= a:
            die("--add-windows range %g-%g ends before it starts" % (a, b))
        if b - a > cap + 0.01:
            die("--add-windows %g-%g is %.1f s; tier %s is capped at %g s "
                "(PLAN-SIGNAL-SHAPES §5, the owner's ruling)" % (a, b, b - a, tier, cap))
        if b - a < MIN_LONG_S:
            die("--add-windows %g-%g is %.1f s — a LONG window is the point; "
                "under %g s it is just another ordinary one" % (a, b, b - a, MIN_LONG_S))

    keep = [list(w) for w in sw]
    notes = []
    if tier == "B" and len(keep) + len(add) > TIER_B_MAX_WINDOWS:
        room = TIER_B_MAX_WINDOWS - len(add)
        if room < 1:
            die("tier B allows %d windows; %d long ones leave no room for the reel's own"
                % (TIER_B_MAX_WINDOWS, len(add)))
        notes.append("tier B: dropping %d of the reel's %d ordinary windows to stay "
                     "inside the %d-window cap" % (len(keep) - room, len(keep), TIER_B_MAX_WINDOWS))
        keep = keep[:room]

    allw = keep + add
    ordered = sorted(allw)
    for x, y in zip(ordered, ordered[1:]):
        if y[0] < x[1] - 0.01:
            die("--add-windows overlaps an existing window (%g-%g against %g-%g)"
                % (y[0], y[1], x[0], x[1]))

    out = []
    for n in notes:
        out.append("echo %s >&2" % shlex.quote("▸ " + n))
    out.append("ADD_WIN_SPEC=" + shlex.quote(",".join("%g-%g" % (a, b) for a, b in allw)))
    out.append("ADD_WIN_N=%d" % len(allw))
    for var, key, dflt in [("EX_TITLE", "title", ""), ("EX_YEAR", "year", ""),
                           ("EX_LICENSE", "license", "unknown"), ("EX_TIER", "tier", "A"),
                           ("EX_TONE", "tone", "voice"), ("EX_BAND", "band", "normal"),
                           ("EX_WEIGHT", "weight", 3), ("EX_NOTES", "notes", ""),
                           ("EX_PICTURE", "picture", "line")]:
        v = e.get(key)
        if v is None:
            v = dflt
        out.append("%s=%s" % (var, shlex.quote(str(v))))
    out.append("EX_AUDIO_ONLY=" + ("1" if e.get("audioOnly") else "0"))
    # THE PROVENANCE LINK IS NOT DERIVED FROM THE INPUT. A re-cut is run against
    # the CACHED source file, so the manifest's `src` would become
    # "<slug>.mp4" and the VFD's link to where the broadcast came from would
    # quietly become a filename on somebody's laptop. It is the one field a
    # re-cut must carry rather than recompute.
    out.append("EX_SRC=" + shlex.quote(str(e.get("src") or "")))
    sys.stdout.write("\n".join(out) + "\n")


if __name__ == "__main__":
    main()
