#!/usr/bin/env python3
"""Keep a LEGACY response as the drawer's display (CLAUDE.md procedure).

    python3 scripts/keep-legacy.py <item_id> <rid>

The owner's exception to replace-with-the-rerun (2026-08-29): for some
legacy items the ORIGINAL response — usually Claude Fable 5's — is the one
the owner wants in the drawer, even without comparison data from the current
four-model pool. The path: put the item back on the bench with
`?bench&item=<item_id>` (the queue backs only the original responses, so
those are what get seated), rate the favorite on the current rubric, then
run this. It reads the filed bench ratings from production, applies them to
the response in entry.json (grade regraded with grade_history if changed,
axis annotations written), PINS `primary` to the rid, and notes the owner's
call. Same gate as harvests: refuses without a grade and every live axis.
The caller validates, commits, uploads.
"""
import json, os, sys, urllib.request
from datetime import date

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUEUE = "https://municipalsky.com/api/jd-bench-queue.php"

def main(item_id, rid):
    req = urllib.request.Request(QUEUE, headers={
        "Origin": "https://municipalsky.com",
        "User-Agent": "Mozilla/5.0 (keep-legacy.py; municipal-sky curation)",
    })
    q = json.load(urllib.request.urlopen(req))
    tax = json.load(open(os.path.join(REPO, "art", "junk-drawer", "taxonomy.json")))
    live_axes = [a["id"] for a in tax["axes"] if not a.get("defunct")]

    item = next((i for i in q["items"] if i["item_id"] == item_id), None)
    if not item:
        sys.exit(f"{item_id}: not in the bench queue (has the backfill run?)")
    resp = next((r for r in item["responses"] if r["rid"] == rid), None)
    if not resp:
        sys.exit(f"{item_id}: no DB-backed response {rid} — only original "
                 "responses can be re-rated on the bench")

    missing = [a for a in live_axes if a not in (resp["axes"] or {})]
    grade = resp["grade"] if resp["grade"] is not None else None
    if missing or grade is None and resp["grade_seed"] is None:
        sys.exit(f"{item_id} {rid}: not fully rated on the current rubric yet "
                 f"(missing: {missing or ['bench grade']}). Rate it at "
                 f"?bench&item={item_id} first.")

    entry_path = os.path.join(REPO, "art", "junk-drawer", "items", item_id, "entry.json")
    entry = json.load(open(entry_path))
    er = next(r for r in entry["responses"] if r["rid"] == rid)
    today = date.today().isoformat()

    if grade is not None and float(grade) != float(er["grade"]):
        er.setdefault("grade_history", []).append({
            "grade": er["grade"], "date": er.get("graded") or er["date"],
            "taxonomy_version": None,
            "note": "superseded by the bench re-rating that kept this response in the drawer",
        })
        er["grade"] = float(grade)
        er["graded"] = today
    er["annotations"] = {a: resp["axes"][a] for a in live_axes}
    er["notes"] = ((er.get("notes") or "").rstrip() + " " if er.get("notes") else "") + (
        f"Kept as the drawer's display by owner call ({today}) — a legacy "
        "favorite re-rated on the current rubric via the bench; the rerun set "
        "stands alongside as the comparison.")
    entry["primary"] = rid
    open(entry_path, "w").write(json.dumps(entry, indent=2, ensure_ascii=False) + "\n")
    print(f"{item_id}: {rid} ({er['model']}) re-rated "
          f"(grade {er['grade']}, axes {er['annotations']}) and pinned as primary")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
