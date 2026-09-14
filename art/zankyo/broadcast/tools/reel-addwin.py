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
MAX_WINDOWS = 10           # build-manifest.sh's cap for every tier
# build-manifest.sh refuses a reel over 2 MB. A long window is 18-40 s of new
# video on a reel that already carries 45-142 s, so this binds, and it binds
# EXACTLY where the tooling used to find out about it far too late: make-reel
# writes the reel and the entry and only then runs build-manifest, which fails —
# and because build-manifest validates the WHOLE POOL, one over-cap reel then
# fails every reel cut after it. Ten reels reported FAILED in the first batch
# run; six had actually busted a rule and four were collateral from the reel
# before them. So the caps are enforced HERE, before a frame is encoded.
MAX_BYTES = 2 * 1024 * 1024
BYTE_TARGET = 0.94         # aim under the cap: the estimate below is per-reel
                           # average bitrate, and a long window can encode dearer
BYTE_MARGIN = 1.10         # …so pad the estimate by a tenth


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

    # ---- THE WINDOW CAP -----------------------------------------------------
    # Ten windows per reel, six for Tier B, and a long window counts. When the
    # reel is full, ordinary windows give way from the END — the latest source
    # moments — so the reel's opening material, which is usually what makes it
    # recognisable, survives.
    wcap = min(MAX_WINDOWS, TIER_B_MAX_WINDOWS if tier == "B" else MAX_WINDOWS)
    if len(keep) + len(add) > wcap:
        room = wcap - len(add)
        if room < 1:
            die("%d windows is the cap for tier %s; %d long ones leave no room for the "
                "reel's own" % (wcap, tier, len(add)))
        notes.append("dropping %d of the reel's %d ordinary windows to stay inside the "
                     "%d-window cap" % (len(keep) - room, len(keep), wcap))
        keep = keep[:room]

    # ---- THE BYTE CAP -------------------------------------------------------
    # Estimated from the reel's OWN average bitrate, padded, because that is the
    # only figure available before the encode. The long window SHRINKS to fit
    # first — a 24 s reception is worth more than a refused one — and only if it
    # cannot reach MIN_LONG_S do ordinary windows give way as well.
    have = e.get("bytes")
    dur = e.get("durS")
    if have and dur and dur > 0:
        bps = (have / dur) * BYTE_MARGIN
        budget = MAX_BYTES * BYTE_TARGET

        def projected(kept, adds):
            secs = sum(b - a for a, b in kept) + sum(b - a for a, b in adds)
            return secs * bps

        while projected(keep, add) > budget:
            # shrink the longest added window first, down to the floor
            j = max(range(len(add)), key=lambda i: add[i][1] - add[i][0])
            cur = add[j][1] - add[j][0]
            over = (projected(keep, add) - budget) / bps
            if cur - over >= MIN_LONG_S:
                add[j] = [add[j][0], round(add[j][0] + cur - over, 2)]
                notes.append("shortened the long window to %.1f s to stay under the 2 MB cap"
                             % (add[j][1] - add[j][0]))
                break
            if cur > MIN_LONG_S:
                add[j] = [add[j][0], round(add[j][0] + MIN_LONG_S, 2)]
                notes.append("shortened the long window to the %g s floor" % MIN_LONG_S)
                continue
            if len(keep) > 1:
                keep = keep[:-1]
                notes.append("dropped one more ordinary window for the 2 MB cap "
                             "(%d left)" % len(keep))
                continue
            die("this reel cannot carry a %g s window under the 2 MB cap even with one "
                "ordinary window left (%.2f MB at %.0f kB/s)"
                % (MIN_LONG_S, have / 1048576.0, bps / 1000.0))

    # ---- A RE-CUT MUST NOT MAKE A REEL POORER -------------------------------
    # The two ladders above can, between them, trade three twelve-second windows
    # for one thirteen-second one. On a densely encoded reel — kctv-tvdx is
    # 36 kB/s where the pool's median is 9 — that is the whole point of the
    # exercise inverted: the reel ends up with LESS material than it started
    # with, and a reel that stays exactly as it is costs nothing. So the trade
    # has to come out ahead in total playable seconds, or it is refused.
    before = sum(b - a for a, b in sw)
    after = sum(b - a for a, b in keep) + sum(b - a for a, b in add)
    if after <= before + 1.0:
        die("a long window would cost this reel more than it gains — %.0f s of "
            "material before, %.0f s after (it encodes at %.0f kB/s, against the "
            "pool's median 9, so the 2 MB cap bites). Left as it is."
            % (before, after, (have / dur) / 1000.0 if have and dur else 0))

    # ---- SOURCE ORDER -------------------------------------------------------
    # THE WINDOWS ARE CUT IN SOURCE ORDER, and 戻 depends on it: when a return
    # has no room left inside its window it takes the reel's NEXT window and
    # says how much later that is, read off srcWindows. Appending a long window
    # at the end of an unsorted list made that claim a lie — kctv-tvdx gained a
    # window at 203 s sitting after one at 1001 s, so a return could have
    # announced itself as arriving 798 seconds EARLIER. Sorting reorders the
    # reel's existing windows, which a re-cut is already free to do (its bytes
    # and its rev both change), and it is the cheaper of the two prices.
    allw = sorted(keep + add)
    for x, y in zip(allw, allw[1:]):
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
