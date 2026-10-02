#!/usr/bin/env python3
"""The Junk Drawer dataset v1: a DERIVED pairwise table (PLAN-V2 §4).

Reads the archive's JSONL export (scripts/export-jd-evals.py --mysql output)
and writes one CSV row per head-to-head outcome v1 can support. Reproducible
from the archive alone — no database.

    python3 scripts/jd-v1-pairwise.py \
        --jsonl ~/Media/junk-drawer-v1/2026-10-01/jd-evals-2026-10-01.jsonl \
        --out ~/Media/junk-drawer-v1/2026-10-01/v1-pairwise-derived.csv

Two sources, labelled in `derived_from`:

'rank-order' — every submission with jd_ranks rows. The standing rank of each
  generation is jd_rank_by_generation's (api/jd-config.php): the 'bench' row
  wins, else the first row read in filing (id) order. Every unordered pair of
  ranked generations is one row, gen_a / gen_b ordered by slot letter;
  outcome = +1 when gen_a ranked better (lower rank_pos), 0 on a tie (legal
  below first place), -1 when gen_b ranked better. A RANK ORDER CARRIES NO
  MARGIN: +1 / -1 here means "ahead of", never "slightly better than", and must
  not be pooled with the +-2 / +-1 scale below as if it were one. rank_client
  is the client whose ranks were used ('bench|seed' style when the pair's two
  ranks came from different clients).

'comparison-strength' — jd_comparisons rows that carry a likert margin
  (strength 'decisive' / 'slight'; filed 2026-08-14 -> 2026-08-22 in this
  dump, the pick-a-winner era before the podium). One row per (winner, other
  ok generation of that submission): outcome +2 decisive / +1 slight, signed
  toward gen_a (negative when the winner is gen_b). In that era most
  submissions had three or four survivors and the visitor picked ONE winner
  from the field with ONE margin, so the margin is winner-over-field, applied
  to each loser; n_field says how many ok generations the pick was made from
  (2 = a genuine two-way comparison). rank_a / rank_b are empty; rank_client
  holds the client that filed the comparison.

'comparison-tie' — jd_comparisons rows with winner NULL (an explicit tie,
  which by the write path's rule carries no strength): every unordered pair of
  that submission's ok generations, outcome 0.

Not emitted: comparison rows with a winner but no strength — the 2026-08-11/12
winner-only rows (no margin was asked) and every row since 2026-08-22, which
is the rank-1 generation double-written from jd_ranks and therefore already
represented by 'rank-order'. Some margin rows' submissions also carry
jd_ranks rows; both views are emitted, distinguished by derived_from.

The output starts with '#' comment lines; read it with e.g.
pandas.read_csv(path, comment='#') (no field in this file is free text).
"""

import argparse
import csv
import itertools
import json
import sys

COLUMNS = ["submission_id", "gen_a", "gen_b", "model_a", "model_b", "rank_a", "rank_b",
           "outcome", "rank_client", "derived_from", "slot_a", "slot_b", "n_field"]
MARGIN = {"decisive": 2, "slight": 1}

HEADER = """\
# The Junk Drawer dataset v1 — derived pairwise outcomes (scripts/jd-v1-pairwise.py).
# derived_from = 'rank-order': outcome +1 / 0 / -1 from the filed rank order only.
#   RANK ORDER CARRIES NO MARGIN — +1 means "ranked ahead", not "slightly better".
# derived_from = 'comparison-strength': winner vs each other ok generation, +2 decisive /
#   +1 slight, signed toward gen_a; n_field > 2 means the margin was winner-over-field.
# derived_from = 'comparison-tie': explicit tie (winner NULL), every ok pair, outcome 0.
# gen_a < gen_b by slot letter. Empty cell = NULL.
"""


def rank_by_generation(rank_rows):
    out = {}
    for r in sorted(rank_rows or [], key=lambda r: r["id"]):
        if r["client"] == "bench" or r["gen_id"] not in out:
            out[r["gen_id"]] = (r["rank"], r["client"])
    return out


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--jsonl", required=True)
    p.add_argument("--out", required=True)
    args = p.parse_args(argv)

    counts = {}
    with open(args.jsonl, encoding="utf-8") as src, \
            open(args.out, "w", encoding="utf-8", newline="") as dst:
        dst.write(HEADER)
        w = csv.writer(dst)
        w.writerow(COLUMNS)

        def emit(row):
            w.writerow(["" if v is None else v for v in row])
            counts[row[9]] = counts.get(row[9], 0) + 1

        for line in src:
            rec = json.loads(line)
            sid = rec["submission"]["id"]
            gens = {g["id"]: g for g in rec["generations"]}
            ok = sorted((g for g in rec["generations"] if g["status"] == "ok"),
                        key=lambda g: g["slot"])

            ranks = rank_by_generation(rec.get("ranking"))
            ranked = sorted((gens[gid] for gid in ranks if gid in gens), key=lambda g: g["slot"])
            for a, b in itertools.combinations(ranked, 2):
                (ra, ca), (rb, cb) = ranks[a["id"]], ranks[b["id"]]
                outcome = (ra < rb) - (ra > rb)
                emit([sid, a["id"], b["id"], a["model_id"], b["model_id"], ra, rb, outcome,
                      ca if ca == cb else "%s|%s" % (ca, cb), "rank-order",
                      a["slot"], b["slot"], len(ranked)])

            comp = rec.get("comparison")
            if not comp:
                continue
            if comp["tie"]:
                for a, b in itertools.combinations(ok, 2):
                    emit([sid, a["id"], b["id"], a["model_id"], b["model_id"], None, None, 0,
                          comp["client"], "comparison-tie", a["slot"], b["slot"], len(ok)])
            elif comp["strength"] in MARGIN:
                m = MARGIN[comp["strength"]]
                winner = gens[comp["winner_gen_id"]]
                for other in ok:
                    if other["id"] == winner["id"]:
                        continue
                    a, b = sorted((winner, other), key=lambda g: g["slot"])
                    emit([sid, a["id"], b["id"], a["model_id"], b["model_id"], None, None,
                          m if a is winner else -m, comp["client"], "comparison-strength",
                          a["slot"], b["slot"], len(ok)])
    sys.stderr.write("jd-v1-pairwise: %s -> %s\n" % (counts, args.out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
