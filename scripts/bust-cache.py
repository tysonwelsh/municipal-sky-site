#!/usr/bin/env python3
"""Sync ?v= cache-busters on CSS/JS references to each asset's content hash.

For every `something.css?v=...` / `something.js?v=...` reference in tracked
.php/.html files, set the version to a short hash of that asset's current
bytes. Idempotent: a reference only changes when the asset's content changes,
so unchanged assets never churn (no spurious commits). Assets are matched by
filename; ambiguous duplicate basenames are skipped (and reported).

Usage: bust-cache.py [--dry-run]
"""
import hashlib, os, re, subprocess, sys

DRY = "--dry-run" in sys.argv

def sh(*args):
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout

root = sh("git", "rev-parse", "--show-toplevel").strip()
os.chdir(root)
tracked = [t for t in sh("git", "ls-files", "-z").split("\0") if t]

# basename -> short content hash, skipping ambiguous duplicate basenames.
assets, dupes = {}, set()
for f in tracked:
    if f.endswith((".css", ".js")):
        b = os.path.basename(f)
        if b in assets or b in dupes:
            dupes.add(b); assets.pop(b, None); continue
        with open(f, "rb") as fh:
            assets[b] = hashlib.md5(fh.read()).hexdigest()[:8]

ref_re = re.compile(r'([A-Za-z0-9._/\-]+?\.(?:css|js))\?v=[A-Za-z0-9._\-]+')
changed_files = changed_refs = 0

for f in tracked:
    if not f.endswith((".php", ".html", ".htm")):
        continue
    with open(f, "r", encoding="utf-8", errors="surrogateescape") as fh:
        text = fh.read()

    def repl(m):
        global changed_refs
        path = m.group(1)
        h = assets.get(os.path.basename(path))
        if not h:
            return m.group(0)            # unknown / ambiguous asset — leave as-is
        new = f"{path}?v={h}"
        if new != m.group(0):
            changed_refs += 1
        return new

    new_text = ref_re.sub(repl, text)
    if new_text != text:
        changed_files += 1
        print(f"  {f}")
        if not DRY:
            with open(f, "w", encoding="utf-8", errors="surrogateescape") as fh:
                fh.write(new_text)

verb = "would update" if DRY else "updated"
msg = f"cache-bust: {verb} {changed_refs} reference(s) across {changed_files} file(s)"
if dupes:
    msg += f"; skipped ambiguous basenames: {', '.join(sorted(dupes))}"
print(msg)
