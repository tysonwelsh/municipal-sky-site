#!/usr/bin/env python3
"""Promote a rated turn into a drawer item (PLAN-REASSESSMENT phase D).

    python3 scripts/promote-turn.py [--all] [--dry-run] [turn:<submission> ...]

The counterpart to harvest-rerun.py for prompts that were never curated
items: the blue-button turns the owner has now rated at the bench. For each,
this writes `items/<date>-<slug>/` — every surviving drawing as
`<model-slug>.svg`, and an entry.json carrying the owner's grades, axis
ratings, ranks, tokens and cost, with the rank-1 response pinned.

THE GATE, the same one the harvest keeps: every surviving drawing graded and
answered on every live axis, ranked when there is more than one, and a SIZE
on file — an item cannot enter the drawer without the owner's own size, and
this script never invents one. Scrapped turns are skipped outright.

The TITLE is drafted from the prompt (the same 2-5 word shape jd-title.php
asks a model for) and printed for the owner to correct; slugs come from it.
Run the ink check afterwards — the caller validates, commits and uploads.
"""
import json, os, re, subprocess, sys, tempfile, urllib.request
from datetime import date

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS = os.path.join(REPO, "art", "junk-drawer", "items")
QUEUE = "https://municipalsky.com/api/jd-bench-queue.php"
GENSVG = "https://municipalsky.com/api/jd-gen-svg.php?gen="
HDRS = {"Origin": "https://municipalsky.com",
        "User-Agent": "Mozilla/5.0 (promote-turn.py; municipal-sky curation)"}

STOP = {"a", "an", "the", "of", "in", "on", "with", "and", "for", "at", "its",
        "that", "this", "like", "just", "some", "kind", "sort"}


def get(url, raw=False):
    r = urllib.request.urlopen(urllib.request.Request(url, headers=HDRS))
    return r.read().decode("utf-8") if raw else json.load(r)


def draft_title(prompt):
    """2-5 plain words naming the object — the shape jd-title.php asks for."""
    first = re.split(r"[.;\n]", prompt.strip())[0]
    words = re.findall(r"[A-Za-z0-9'’À-ɏ-]+", first)
    keep, out = [], []
    for w in words:
        if len(out) >= 5:
            break
        if not out and w.lower() in STOP:
            continue
        out.append(w)
    title = " ".join(out) or prompt[:32]
    return title[0].upper() + title[1:]


def slugify(title):
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return re.sub(r"-{2,}", "-", s)[:40] or "item"


def price_generation(resp):
    """tokens + cost_usd for one response, from the census and the site's
    own pricing — the queue carries no usage, so the census answers."""
    global _CENSUS
    try:
        if _CENSUS is None:
            _CENSUS = json.load(urllib.request.urlopen(
                urllib.request.Request(
                    "https://municipalsky.com/api/jd-inventory.php?t=promote",
                    headers=HDRS)))
        row = None
        for s in _CENSUS["submissions"]:
            for g in s["generations"]:
                if g["gen_id"] == resp["generation_id"]:
                    row = g
                    break
            if row:
                break
        if not row or not row.get("usage_tokens"):
            return {}
        out = subprocess.run(
            ["python3", os.path.join(REPO, "scripts", "backfill-costs.py"), "--price-one"],
            input=json.dumps(row), capture_output=True, text=True)
        return json.loads(out.stdout) if out.stdout.strip() else {}
    except Exception:
        return {}


_CENSUS = None


def flagged(it, which):
    return any(f["axis_id"] == which and not str(f.get("note") or "").startswith("UN")
               for r in it["responses"] for f in r["flags"])


def promote(it, dry=False):
    tag = it["item_id"]
    if flagged(it, "retire-request"):
        return None, f"{tag}: scrapped — skipped"
    resp = it["responses"]
    if not resp:
        return None, f"{tag}: no drawings"
    if not it.get("size_filed"):
        return None, f"{tag}: no size on file — size it at the bench first"
    for r in resp:
        if not r["complete"]:
            return None, f"{tag}: {r['model_id']} is not fully rated"
    if len(resp) > 1 and not all(r["rank"] for r in resp):
        return None, f"{tag}: not ranked"

    ordered = sorted(resp, key=lambda r: r["rank"] or 99)
    title = draft_title(it["prompt"])
    day = str(it["created"])[:10]
    iid = f"{day}-{slugify(title)}"
    path = os.path.join(ITEMS, iid)
    if os.path.exists(path):
        return None, f"{tag}: {iid} already exists — rename or handle by hand"
    if dry:
        return iid, (f"{tag}\n    would write {iid}  size={it['size_filed']}  "
                     f"title={title!r}\n    " +
                     ", ".join(f"{r['model_id']}#{r['rank']}" for r in ordered))

    os.makedirs(path)
    responses = []
    for i, r in enumerate(ordered):
        svg = get(GENSVG + r["generation_id"], raw=True)
        fn = r["model_id"] + ".svg"
        open(os.path.join(path, fn), "w").write(svg)
        # WHAT IT COST (fix, 2026-08-30): the harvest carried tokens and
        # cost_usd across from the first; this script never did, so 26 items
        # reached the drawer with no Cost line on their cards. The numbers
        # come from the generation's own usage, priced by the site's own
        # function — see scripts/backfill-costs.py, which repaired the ones
        # already promoted.
        cost = price_generation(r)
        responses.append({
            "rid": f"r{i + 1}",
            "file": fn,
            "model": r["model_id"],
            "model_version": r.get("model_version") or r["model_id"],
            "date": day,
            "generation": {"mode": "one-shot", "prompt_count": 1},
            "grade": r["grade"] if r["grade"] is not None else r["grade_seed"],
            "graded": date.today().isoformat(),
            "grade_history": [],
            "annotations": dict(r["axes"]),
            "transcript": None,
            "notes": ("Promoted from the turn that drew it (submission "
                      f"{tag.split(':', 1)[1]}), rated blind at the bench on the "
                      f"current rubric; filed rank {r['rank']} of {len(ordered)}."),
        })
        if cost.get("tokens"):
            responses[-1]["tokens"] = cost["tokens"]
        if cost.get("cost_usd") is not None:
            responses[-1]["cost_usd"] = cost["cost_usd"]
    entry = {
        "schema": 2,
        "id": iid,
        "title": title,
        "prompt": it["prompt"],
        "created": day,
        "sizeClass": it["size_filed"],
        "primary": "r1",
        "responses": responses,
    }
    open(os.path.join(path, "entry.json"), "w").write(
        json.dumps(entry, indent=2, ensure_ascii=False) + "\n")
    return iid, (f"{tag}\n    wrote {iid}  size={it['size_filed']}  title={title!r}\n"
                 "    " + ", ".join(f"r{i+1}={r['model_id']}" for i, r in enumerate(ordered)))


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    do_all = "--all" in sys.argv
    q = get(QUEUE + "?t=promote")
    turns = {i["item_id"]: i for i in q["items"] if i.get("source") == "turn"}
    if do_all:
        args = list(turns)
    if not args:
        sys.exit(__doc__)
    made = 0
    for tag in args:
        it = turns.get(tag)
        if not it:
            print(f"{tag}: not in the turn queue"); continue
        iid, msg = promote(it, dry)
        print(msg)
        if iid and not dry:
            made += 1
    print(f"\n{'would promote' if dry else 'promoted'}: {made if not dry else '—'}")
    print("next: python3 scripts/validate-junk-drawer.py, then ink-check the new SVGs")


if __name__ == "__main__":
    main()
