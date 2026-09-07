#!/usr/bin/env python3
"""The librarian's back-fill (plan §11.1): give every existing reel a pitchHz
array and a tuned flag, and change NOTHING else.

It never opens a reel for writing and never re-serialises a manifest entry: the
per-reel JSON is hand-formatted (one field per line, windows on one line) and
re-emitting it through json.dumps would rewrite every line and bury two added
fields in a whole-file diff. So the two lines are INSERTED AS TEXT after
"srcWindows", and every other byte of every file is untouched by construction.
Re-running replaces the two lines it wrote before, so it is idempotent.

  backfill-pitch.py            all reels
  backfill-pitch.py id ...     only these
  backfill-pitch.py --check    measure and report, write nothing
"""
import glob, hashlib, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BC = os.path.dirname(HERE)
MANI, REELS = os.path.join(BC, "manifest"), os.path.join(BC, "reels")
PITCH = os.path.join(HERE, "reel-pitch.py")


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 16), b""):
            h.update(b)
    return h.hexdigest()


def measure(reel, windows):
    out = subprocess.run([sys.executable, PITCH, reel, json.dumps(windows)],
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if out.returncode != 0:
        return None, out.stderr.decode()[-200:]
    return json.loads(out.stdout.decode()), None


def splice(text, pitches, tuned):
    """Insert (or replace) the two lines after the srcWindows VALUE ends.

    The per-reel entries are not uniformly formatted — most are one field per
    line with the window arrays inline, but at least one
    (etv-cairo-clock-1980s) is fully pretty-printed with each number on its own
    line. Anchoring to the LINE that starts "srcWindows" therefore put the two
    new fields inside an open array and produced a file that did not parse.
    So the anchor is the point where the value's brackets balance, whatever
    shape it is written in.
    """
    body = ", ".join("null" if p is None else repr(round(float(p), 2)) for p in pitches)
    new = ['  "pitchHz": [%s],' % body, '  "tuned": %s,' % ("true" if tuned else "false")]

    lines = [ln for ln in text.split("\n")
             if not (ln.lstrip().startswith('"pitchHz"') or ln.lstrip().startswith('"tuned"'))]
    anchor = None
    for key in ('"srcWindows"', '"windows"'):
        for i, ln in enumerate(lines):
            if ln.lstrip().startswith(key):
                depth = 0
                for j in range(i, len(lines)):
                    depth += lines[j].count("[") - lines[j].count("]")
                    if depth <= 0:
                        anchor = j; break
                break
        if anchor is not None:
            break
    if anchor is None:
        return None
    if not lines[anchor].rstrip().endswith(","):
        lines[anchor] = lines[anchor].rstrip() + ","
    out = lines[:anchor + 1] + new + lines[anchor + 1:]
    # whatever now precedes the closing brace must not carry a trailing comma
    for i in range(len(out) - 1, -1, -1):
        if out[i].strip() == "}":
            j = i - 1
            while j >= 0 and not out[j].strip():
                j -= 1
            out[j] = out[j].rstrip().rstrip(",")
            break
    return "\n".join(out)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv
    files = sorted(glob.glob(os.path.join(MANI, "*.json")))
    if args:
        files = [f for f in files if os.path.splitext(os.path.basename(f))[0] in args]
    n_t = n_w = n_p = 0
    for f in files:
        e = json.load(open(f))
        rid, wins = e["id"], e.get("windows") or []
        reel = os.path.join(REELS, rid + ".mp4")
        if not os.path.exists(reel):
            print("  %-38s NO REEL FILE — skipped" % rid); continue
        before = sha(reel)
        res, err = measure(reel, wins)
        if res is None:
            print("  %-38s analyser failed: %s" % (rid, err)); continue
        assert sha(reel) == before, "the analyser modified %s — abort" % reel
        got = sum(1 for p in res["pitchHz"] if p)
        n_w += len(wins); n_p += got; n_t += 1 if res["tuned"] else 0
        mark = "tuned" if res["tuned"] else "     "
        print("  %-38s %s  %d/%d windows  %s" % (rid, mark, got, len(wins),
              ", ".join("%.1f" % p if p else "·" for p in res["pitchHz"])))
        if check:
            continue
        text = open(f).read()
        new = splice(text, res["pitchHz"], res["tuned"])
        if new is None:
            print("    ! no srcWindows line — left alone"); continue
        json.loads(new)                                # it must still parse
        if new != text:
            open(f, "w").write(new)
    print("\n%d reels, %d tuned, %d/%d windows carry a pitch%s"
          % (len(files), n_t, n_p, n_w, "  (--check: nothing written)" if check else ""))


if __name__ == "__main__":
    main()
