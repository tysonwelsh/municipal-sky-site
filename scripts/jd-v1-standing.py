#!/usr/bin/env python3
"""The Junk Drawer dataset v1: the CURRENT STANDING of every ok generation.

Reads the archive's JSONL export (scripts/export-jd-evals.py --mysql output)
and writes one CSV row per generation with status 'ok' — what the site's own
readers (data.php, the ledger, the census) would say that drawing stands at,
computed once so an analysis never has to re-implement the PHP fold.
Reproducible from the archive alone: no database, only the JSONL and the
taxonomy file that shipped with it.

    python3 scripts/jd-v1-standing.py \
        --jsonl ~/Media/junk-drawer-v1/2026-10-01/jd-evals-2026-10-01.jsonl \
        --taxonomy ~/Media/junk-drawer-v1/2026-10-01/taxonomy-v25.json \
        --out ~/Media/junk-drawer-v1/2026-10-01/v1-current-standing.csv

THE PRECEDENCE RULE (a faithful port of api/jd-config.php §§7-8 as of
commit 9e391398 — jd_fold_ratings, jd_pick_rating(['bench', '*']),
jd_rank_by_generation):

1. Fold. Take every jd_ratings row of a generation in (rated_at, id) order —
   the readers' `ORDER BY rated_at, id`. Split them by `client`. Within one
   client a later row overwrites an earlier one cell by cell (the grade is one
   cell, each axis another), so the LATEST row per client wins each cell.
   Only LIVE axes count: an axis row whose axis_id is not in the taxonomy's
   axes, or is marked "defunct": true there, is dropped (it stays in the dump
   as history). kind = 'flag' rows are ignored.
2. Pick. Walk the clients in precedence order: 'bench' first, then every other
   client in FILING ORDER — the order in which each client's first row for
   that generation appears in step 1's ordering ('*' in the PHP). For each
   cell the first client in the walk that holds a value wins it. So the
   bench's word beats everyone; between 'web' and 'seed' (or 'curated') the
   client that filed first for that generation wins each cell it answered,
   and a later client only fills cells the earlier one left empty.
3. Rank. From the generation's jd_ranks rows read in filing order (id), the
   'bench' row wins; otherwise the first row read stands. (jd_ranks is
   UNIQUE (submission_id, generation_id), so in practice there is one row.)

Columns: grade and the four live axes are the picked values (numeric ranks,
empty = no value). grade_client is the client whose grade won;
taxonomy_version_of_grade is that client's latest grade row's stamp.
rank_pos / rank_client from step 3. complete = 1 when the picked grade and
every live axis are present (no taxonomy_version floor is applied here; the
bench queue additionally requires version >= 17 for a turn's non-bench
answers — filter on taxonomy_version_of_grade if that matters). hidden = 1
when jd_submissions.retire_requested_at is set; suppressed = the visitor's
"keep this out of the drawer" tick. is_turn = 1 when item_id is NULL.
Empty cells are NULL.
"""

import argparse
import csv
import json
import sys

FIXED = ["submission_id", "generation_id", "item_id", "is_turn", "prompt", "created",
         "slot", "model_id", "model_version", "provider", "harness", "grade"]
TAIL = ["rank_pos", "rank_client", "grade_client", "taxonomy_version_of_grade",
        "complete", "hidden", "suppressed"]


def live_axes(taxonomy):
    return [a["id"] for a in taxonomy.get("axes", []) if "id" in a and not a.get("defunct")]


def fold_ratings(rows, live):
    """jd_fold_ratings: generation_id -> {client: standing}, clients in first-seen order."""
    fold = {}
    for r in sorted(rows, key=lambda r: (r["rated_at"] or "", r["id"])):
        by_client = fold.setdefault(r["generation_id"], {})
        s = by_client.setdefault(r["client"] or "web",
                                 {"axes": {}, "grade": None, "grade_version": None})
        version = int(r["taxonomy_version"] or 0)
        if r["kind"] == "axis":
            if r["axis_id"] in live:
                s["axes"][r["axis_id"]] = float(r["value"])
        elif r["kind"] == "grade":
            s["grade"] = float(r["value"])
            s["grade_version"] = version
    return fold


def pick_rating(by_client, order=("bench", "*")):
    """jd_pick_rating: first client in the walk wins each cell."""
    walk, seen = [], set()
    for client in order:
        if client == "*":
            walk += [c for c in by_client if c not in seen and c not in order]
        elif client in by_client:
            walk.append(client)
        seen.add(client)
    out = {"axes": {}, "grade": None, "grade_client": None, "grade_version": None}
    for client in walk:
        s = by_client[client]
        for axis, value in s["axes"].items():
            out["axes"].setdefault(axis, value)
        if out["grade"] is None and s["grade"] is not None:
            out["grade"], out["grade_client"], out["grade_version"] = \
                s["grade"], client, s["grade_version"]
    return out


def rank_by_generation(rank_rows):
    """jd_rank_by_generation: the bench's row wins, else the first row read."""
    out = {}
    for r in sorted(rank_rows or [], key=lambda r: r["id"]):
        if r["client"] == "bench" or r["gen_id"] not in out:
            out[r["gen_id"]] = (r["rank"], r["client"])
    return out


def cell(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return 1 if value else 0
    return value


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--jsonl", required=True)
    p.add_argument("--taxonomy", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args(argv)

    with open(args.taxonomy, encoding="utf-8") as f:
        axes = live_axes(json.load(f))
    live = set(axes)

    n = 0
    with open(args.jsonl, encoding="utf-8") as src, \
            open(args.out, "w", encoding="utf-8", newline="") as dst:
        w = csv.writer(dst)
        w.writerow(FIXED + axes + TAIL)
        for line in src:
            rec = json.loads(line)
            sub = rec["submission"]
            fold = fold_ratings(rec["ratings"], live)
            ranks = rank_by_generation(rec.get("ranking"))
            for g in rec["generations"]:
                if g["status"] != "ok":
                    continue
                pick = pick_rating(fold.get(g["id"], {}))
                rank = ranks.get(g["id"], (None, None))
                complete = pick["grade"] is not None and all(a in pick["axes"] for a in axes)
                w.writerow([cell(v) for v in [
                    sub["id"], g["id"], sub.get("item_id"), sub.get("item_id") is None,
                    sub["prompt"], sub["created"], g["slot"], g["model_id"],
                    g["model_version"], g["provider"], g["harness"], pick["grade"],
                ] + [pick["axes"].get(a) for a in axes] + [
                    rank[0], rank[1], pick["grade_client"], pick["grade_version"],
                    complete, sub.get("retire_requested_at") is not None,
                    bool(sub.get("suppressed")),
                ]])
                n += 1
    sys.stderr.write("jd-v1-standing: %d ok generations -> %s\n" % (n, args.out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
