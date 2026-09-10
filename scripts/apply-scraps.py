#!/usr/bin/env python3
"""Apply the bench's scrap flags to the item files.

    python3 scripts/apply-scraps.py [--dry-run]

Pressing SCRAP at the bench (or HIDE FROM DRAWER on the admin card) sets
retire_requested_at on the item's submission. Since 2026-09-10 data.php
honours that LIVE — the item is already out of the drawer — so this step is
the PERMANENT RECORD, not the mechanism: every scrapped item gets
`"retired": true` in its entry.json. Mind that a file-level retirement can
no longer be undone from the admin card (SHOW IN DRAWER clears the column
only); run this for items you are sure about. Files and rows stay.

THE EXCEPTIONS ARE HONOURED: an entry carrying a `display_note` that says the
owner kept it on display despite the flag (the Saturn fadograph, the pencil
stub) is left alone. Run this after any bench session that scrapped anything
— or just run it; it is idempotent and prints what it did.
"""
import json, os, sys, urllib.request

def bench_headers(h):
    """The bench key, since the gate went on (2026-09-05): export
    JD_BENCH_KEY=<jd_bench_key from the server's secrets> before running."""
    k = os.environ.get("JD_BENCH_KEY", "")
    if not k:
        sys.exit("JD_BENCH_KEY is not set — export the bench key "
                 "(jd_bench_key in private_config/secrets.php) and rerun")
    h["X-Bench-Key"] = k
    return h


REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS = os.path.join(REPO, "art", "junk-drawer", "items")
QUEUE = "https://municipalsky.com/api/jd-bench-queue.php"
NOTE = ("Scrapped from the bench by the owner — the SCRAP control marked "
        "this item's submission retire-requested; it leaves the drawer and "
        "the manifest. Files and entry stay for the record.")

dry = "--dry-run" in sys.argv

req = urllib.request.Request(QUEUE + "?t=apply", headers=bench_headers({
    "Origin": "https://municipalsky.com",
    "User-Agent": "Mozilla/5.0 (apply-scraps.py; municipal-sky curation)"}))
q = json.load(urllib.request.urlopen(req))

did, kept, already = [], [], []
for it in q["items"]:
    if not it.get("retire_requested"):
        continue
    p = os.path.join(ITEMS, it["item_id"], "entry.json")
    if not os.path.exists(p):
        continue
    d = json.load(open(p))
    if d.get("retired"):
        already.append(it["item_id"]); continue
    if "KEPT IN THE DRAWER" in (d.get("display_note") or ""):
        kept.append(it["item_id"]); continue
    d["retired"] = True
    d.setdefault("retired_note", NOTE)
    if not dry:
        open(p, "w").write(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
    did.append((it["item_id"], d.get("title", "")))

for iid, title in did:
    print(f"{'would retire' if dry else 'retired'}: {iid}  {title}")
if kept:
    print(f"left on display by owner exception ({len(kept)}): {', '.join(kept)}")
if already:
    print(f"already retired ({len(already)})")
if not did:
    print("nothing new to retire")
sys.exit(0 if did else 1)
