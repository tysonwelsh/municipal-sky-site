#!/usr/bin/env python3
"""Export the Junk Drawer visitor-prompt tables as eval-grade JSONL.

One JSON object per line, one line per submission, in the shape eval and
preference-tuning harnesses actually ingest:

    {"submission": {...},
     "generations": [ {...slot a...}, {...slot b...} ],
     "ratings":     [ {...}, ... ],
     "comparison":  {...} | null,
     "ranking":     [ {...rank 1...}, {...rank 2...} ] | null}

`comparison` is the visitor's winner (with the likert `strength` margin where
one was filed); `ranking` is the full order of the survivors, best first, and
is null on every record filed before ranking shipped (2026-08-22) — the two
agree by construction, because the write path files the rank-1 generation as
the comparison's winner.

Everything the write path recorded is carried through verbatim — the prompt
byte-exact, the model/harness/params provenance per generation, the numeric
ranks with their taxonomy_version, and the failures. Nothing is inferred,
repaired, or dropped: a rejected generation is a row like any other, because
failure rates per model are a first-class result (PLAN-USER-PROMPTS §3).

Key order is fixed and rows are ordered deterministically (submission by
created+id, generations by slot, ratings by slot/kind/axis), so two exports of
the same data diff cleanly.

Repo-only, owner-run from a machine with database access. There is no public
export endpoint and there must never be one: the tables hold visitor prompt
text.

CONNECTING
----------
Dev / SQLite (the container's JD_DEV_MOCK database):

    python3 scripts/export-jd-evals.py --sqlite local-dev/jd-dev.sqlite

Production / MySQL — credentials come from the environment, never from
argv (they would land in the shell history and the process table). The names
mirror the keys in private_config/secrets.php:

    JD_DB_HOST   default 'localhost'
    JD_DB_PORT   default 3306
    JD_DB_NAME   required   (secrets.php: db_name)
    JD_DB_USER   required   (secrets.php: db_user)
    JD_DB_PASS   required   (secrets.php: db_pass)

    JD_DB_NAME=… JD_DB_USER=… JD_DB_PASS=… python3 scripts/export-jd-evals.py --mysql

The script's own code is Python 3 standard library only. MySQL needs one
DB-API driver present — PyMySQL, mysql.connector or MySQLdb, whichever the
owner's machine already has (`pip install PyMySQL` is the smallest). SQLite
needs nothing. On Bluehost the practical route is to dump the five jd_ tables
locally and export from the copy.

OPTIONS
-------
    --since 2026-08-01        only submissions created at/after this UTC date
                              (or 'YYYY-MM-DD HH:MM:SS')
    --status rated            only submissions with this status (repeatable)
    --include-svg             include the full sanitized SVG text
    --include-raw             include the full pre-extraction provider text
                              (this is where a failed slot's error body lives)
    --out FILE                write there instead of stdout
    --summary                 print counts, two position-bias estimates and
                              per-model win rates / first-place rates / mean
                              ranks to STDERR (never to the JSONL stream)

By default a generation carries only `svg_bytes` / `raw_response_bytes`,
so the file stays small enough to read; the flags above add the payloads.
"""

import argparse
import json
import os
import sys

TABLES = ("jd_submissions", "jd_generations", "jd_ratings", "jd_comparisons", "jd_ranks")


# --------------------------------------------------------------------------
# connections


def connect_sqlite(path):
    import sqlite3

    if not os.path.exists(path):
        die("no such SQLite database: %s" % path)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn, "?"


def connect_mysql():
    missing = [k for k in ("JD_DB_NAME", "JD_DB_USER", "JD_DB_PASS") if not os.environ.get(k)]
    if missing:
        die("missing environment variable(s): %s (see the docstring)" % ", ".join(missing))

    kwargs = dict(
        host=os.environ.get("JD_DB_HOST", "localhost"),
        port=int(os.environ.get("JD_DB_PORT", "3306")),
        user=os.environ["JD_DB_USER"],
        password=os.environ["JD_DB_PASS"],
        database=os.environ["JD_DB_NAME"],
        charset="utf8mb4",
    )

    for module, dict_cursor in (
        ("pymysql", lambda m: m.cursors.DictCursor),
        ("mysql.connector", None),
        ("MySQLdb", lambda m: m.cursors.DictCursor),
    ):
        try:
            driver = __import__(module, fromlist=["*"])
        except ImportError:
            continue
        if dict_cursor is not None:
            kwargs["cursorclass"] = dict_cursor(driver)
        else:
            kwargs.pop("charset", None)
            kwargs["use_pure"] = True
        return driver.connect(**kwargs), "%s"

    die("no MySQL driver found. Install one (pip install PyMySQL) or export "
        "the jd_ tables to SQLite and use --sqlite.")


def rows(conn, sql, params=()):
    """Fetch as a list of plain dicts, whichever driver is underneath."""
    cur = conn.cursor(dictionary=True) if _is_connector(conn) else conn.cursor()
    cur.execute(sql, tuple(params))
    columns = [d[0] for d in cur.description]
    out = [r if isinstance(r, dict) else dict(zip(columns, r)) for r in cur.fetchall()]
    cur.close()
    return out


def rows_optional(conn, sql, params=(), table=""):
    """Same as rows(), but tolerates the table not existing yet.

    jd_ranks arrives with a manual migration (api/setup-jd-tables.php), and an
    export run against a database that has not had it run — or against an old
    dump taken before it — must still produce every other field rather than
    die. Only the missing-table error is swallowed; anything else propagates,
    because a real failure that silently exported as "no data" would be
    indistinguishable from an honest empty table.
    """
    try:
        return rows(conn, sql, params)
    except Exception as error:                     # noqa: BLE001 — re-raised below
        message = str(error).lower()
        if "no such table" not in message and "doesn't exist" not in message \
                and "table or view not found" not in message:
            raise
        sys.stderr.write(
            "export-jd-evals: %s is not in this database — exporting without it "
            "(run api/setup-jd-tables.php)\n" % (table or "a table")
        )
        return []


def _is_connector(conn):
    return type(conn).__module__.startswith("mysql.connector")


# --------------------------------------------------------------------------
# shaping


def die(message):
    sys.stderr.write("export-jd-evals: %s\n" % message)
    raise SystemExit(2)


def as_int(value):
    return None if value is None else int(value)


def as_float(value):
    return None if value is None else float(value)


def as_text(value):
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", "replace")
    return str(value)


def byte_len(value):
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        return len(value)
    return len(str(value).encode("utf-8"))


def as_json(value):
    """params / usage_tokens are TEXT holding JSON (no JSON column type —
    MariaDB compat). Unparseable text is passed through as a string rather
    than dropped: what the provider actually sent is the record."""
    text = as_text(value)
    if text is None or text == "":
        return None
    try:
        return json.loads(text)
    except ValueError:
        return text


def as_stamp(value):
    """DATETIME arrives as a string on SQLite and a datetime on MySQL."""
    if value is None:
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    return str(value)


def build_submission(row):
    out = {
        "id": as_text(row["id"]),
        "created": as_stamp(row["created"]),
        "prompt": as_text(row["prompt"]),          # byte-exact, untrimmed
        "client": as_text(row["client"]),
        "status": as_text(row["status"]),
        "consent_version": as_text(row["ai_consent_version"]),
        "consent_at": as_stamp(row["ai_consent_at"]),
        "visitor_hash": as_text(row["visitor_hash"]),
        "client_ref": as_text(row["client_ref"]),
        "pair_order": as_int(row["pair_order"]),
    }
    # the submission's own facts (2026-09-05 migration): absent from a dump
    # taken before it, in which case the keys are simply omitted
    for key in ("item_id", "title", "size_class", "suppressed",
                "retire_requested_at", "rerun_requested_at"):
        if key in row.keys():
            value = row[key]
            if key == "suppressed":
                out[key] = None if value is None else bool(int(value))
            elif key.endswith("_at"):
                out[key] = as_stamp(value)
            else:
                out[key] = as_text(value)
    return out


def build_generation(row, include_svg, include_raw):
    out = {
        "slot": as_text(row["slot"]),
        "model_id": as_text(row["model_id"]),
        "model_version": as_text(row["model_version"]),
        "provider": as_text(row["provider"]),
        "harness": as_text(row["harness"]),
        "params": as_json(row["params"]),
        "status": as_text(row["status"]),
        "reject_reason": as_text(row["reject_reason"]),
        "disobedience": as_int(row["disobedience"]),
        "latency_ms": as_int(row["latency_ms"]),
        "usage_tokens": as_json(row["usage_tokens"]),
        "svg_bytes": byte_len(row["svg"]),
        "raw_response_bytes": byte_len(row["raw_response"]),
        "id": as_text(row["id"]),
        "created": as_stamp(row["created"]),
    }
    if include_svg:
        out["svg"] = as_text(row["svg"])
    if include_raw:
        out["raw_response"] = as_text(row["raw_response"])
    return out


def build_rating(row, slot_of):
    return {
        "generation_id": as_text(row["generation_id"]),
        "slot": slot_of.get(as_text(row["generation_id"])),
        "kind": as_text(row["kind"]),
        "axis_id": as_text(row["axis_id"]),
        "value": as_float(row["value"]),           # numeric rank, never a label
        "note": as_text(row["note"]),
        "taxonomy_version": as_int(row["taxonomy_version"]),
        "visitor_hash": as_text(row["visitor_hash"]),
        "client": as_text(row["client"]),
        "rated_at": as_stamp(row["rated_at"]),
        "id": as_text(row["id"]),
    }


def build_comparison(row, slot_of):
    if row is None:
        return None
    winner_gen = as_text(row["winner_gen_id"])
    return {
        "winner_slot": slot_of.get(winner_gen) if winner_gen else None,
        "tie": winner_gen is None,                 # NULL winner = explicit tie
        "winner_gen_id": winner_gen,
        # The likert margin (added to the write path 2026-08-11): 'decisive' |
        # 'slight', NULL on a tie, on a pre-likert client, and on a row filed
        # from a full ranking — an order carries no margin.
        "strength": as_text(row["strength"]),
        "visitor_hash": as_text(row["visitor_hash"]),
        "client": as_text(row["client"]),
        "rated_at": as_stamp(row["rated_at"]),
        "id": as_text(row["id"]),
    }


def build_ranking(rank_rows, slot_of):
    """The full order of the survivors, best first.

    None (not []) on every submission filed before ranking shipped, so "no
    order was recorded" stays distinguishable from "an empty order". Ties below
    first are real data: two entries may share a rank, and the sort then falls
    back to slot so the line is still deterministic.
    """
    if not rank_rows:
        return None
    return [
        {
            "slot": slot_of.get(as_text(r["generation_id"])),
            "rank": as_int(r["rank_pos"]),         # 1 = best; dense; ties below 1
            "gen_id": as_text(r["generation_id"]),
            "visitor_hash": as_text(r["visitor_hash"]),
            "client": as_text(r["client"]),
            "rated_at": as_stamp(r["rated_at"]),
            "id": as_text(r["id"]),
        }
        for r in sorted(
            rank_rows,
            key=lambda r: (as_int(r["rank_pos"]) or 0,
                           slot_of.get(as_text(r["generation_id"])) or ""),
        )
    ]


RATING_ORDER = {"grade": 0, "axis": 1, "flag": 2}


def export(conn, ph, args):
    where, params = [], []
    if args.since:
        where.append("created >= " + ph)
        params.append(args.since)
    if args.status:
        where.append("status IN (%s)" % ", ".join([ph] * len(args.status)))
        params.extend(args.status)
    clause = (" WHERE " + " AND ".join(where)) if where else ""

    # SELECT * rather than a column list: the 2026-09-05 columns (title,
    # size_class, suppressed, the two intent stamps) are exported when the
    # database has them and silently absent from a dump taken before.
    submissions = rows(
        conn,
        "SELECT * FROM jd_submissions" + clause + " ORDER BY created, id",
        params,
    )
    if not submissions:
        return []

    ids = [as_text(s["id"]) for s in submissions]
    marks = ", ".join([ph] * len(ids))

    generations = rows(
        conn,
        "SELECT id, submission_id, slot, model_id, model_version, provider, harness,"
        " params, raw_response, svg, status, reject_reason, disobedience, latency_ms,"
        " usage_tokens, created FROM jd_generations"
        " WHERE submission_id IN (%s) ORDER BY submission_id, slot" % marks,
        ids,
    )
    comparisons = rows(
        conn,
        "SELECT id, submission_id, winner_gen_id, strength, visitor_hash, client, rated_at"
        " FROM jd_comparisons WHERE submission_id IN (%s)" % marks,
        ids,
    )
    # rank_pos, never `rank` — RANK is a reserved word in MySQL 8.0.
    rank_rows = rows_optional(
        conn,
        "SELECT id, submission_id, generation_id, rank_pos, visitor_hash, client, rated_at"
        " FROM jd_ranks WHERE submission_id IN (%s)" % marks,
        ids,
        table="jd_ranks",
    )

    gen_ids = [as_text(g["id"]) for g in generations]
    ratings = []
    if gen_ids:
        ratings = rows(
            conn,
            "SELECT id, generation_id, kind, axis_id, value, note, taxonomy_version,"
            " visitor_hash, client, rated_at FROM jd_ratings"
            " WHERE generation_id IN (%s)" % ", ".join([ph] * len(gen_ids)),
            gen_ids,
        )

    slot_of = {as_text(g["id"]): as_text(g["slot"]) for g in generations}
    submission_of_gen = {as_text(g["id"]): as_text(g["submission_id"]) for g in generations}

    gens_by_sub, ratings_by_sub, comp_by_sub, ranks_by_sub = {}, {}, {}, {}
    for g in generations:
        gens_by_sub.setdefault(as_text(g["submission_id"]), []).append(g)
    for r in ratings:
        sub = submission_of_gen.get(as_text(r["generation_id"]))
        ratings_by_sub.setdefault(sub, []).append(r)
    for c in comparisons:
        comp_by_sub[as_text(c["submission_id"])] = c
    for r in rank_rows:
        ranks_by_sub.setdefault(as_text(r["submission_id"]), []).append(r)

    records = []
    for submission in submissions:
        sid = as_text(submission["id"])
        sub_ratings = sorted(
            ratings_by_sub.get(sid, []),
            key=lambda r: (
                slot_of.get(as_text(r["generation_id"])) or "",
                RATING_ORDER.get(as_text(r["kind"]), 9),
                as_text(r["axis_id"]) or "",
                as_text(r["id"]),
            ),
        )
        records.append({
            "submission": build_submission(submission),
            "generations": [
                build_generation(g, args.include_svg, args.include_raw)
                for g in sorted(gens_by_sub.get(sid, []), key=lambda g: as_text(g["slot"]))
            ],
            "ratings": [build_rating(r, slot_of) for r in sub_ratings],
            "comparison": build_comparison(comp_by_sub.get(sid), slot_of),
            "ranking": build_ranking(ranks_by_sub.get(sid), slot_of),
        })
    return records


# --------------------------------------------------------------------------
# optional summary — the two numbers the dataset exists to make computable


def summarize(records, stream):
    subs = len(records)
    gens = [g for r in records for g in r["generations"]]
    by_status = {}
    for g in gens:
        by_status[g["status"]] = by_status.get(g["status"], 0) + 1

    # Only genuine two-slot contests are head-to-head: a degraded submission
    # may still carry a comparison, and counting it would credit a model for
    # winning against nobody.
    def paired(record):
        return sum(1 for g in record["generations"] if g["status"] == "ok") == 2

    decided = [r for r in records
               if paired(r) and r["comparison"] and not r["comparison"]["tie"]
               and r["comparison"]["winner_slot"]]
    ties = sum(1 for r in records if paired(r) and r["comparison"] and r["comparison"]["tie"])

    slot_a_wins = sum(1 for r in decided if r["comparison"]["winner_slot"] == "a")
    position_bias = (float(slot_a_wins) / len(decided)) if decided else None

    wins, appearances = {}, {}
    for record in decided:
        winner_slot = record["comparison"]["winner_slot"]
        for generation in record["generations"]:
            if generation["status"] != "ok":
                continue
            model = generation["model_id"]
            appearances[model] = appearances.get(model, 0) + 1
            if generation["slot"] == winner_slot:
                wins[model] = wins.get(model, 0) + 1

    write = stream.write
    write("submissions            %d\n" % subs)
    write("generations            %d  %s\n" % (len(gens), by_status))
    write("ratings                %d\n" % sum(len(r["ratings"]) for r in records))
    write("comparisons            %d decided, %d tie\n" % (len(decided), ties))
    write("position bias (P slot A wins | decided)   %s\n"
          % ("n/a" if position_bias is None else "%.3f  (%d/%d)"
             % (position_bias, slot_a_wins, len(decided))))
    for model in sorted(appearances):
        seen = appearances[model]
        write("win rate %-18s %.3f  (%d/%d)\n"
              % (model, float(wins.get(model, 0)) / seen, wins.get(model, 0), seen))

    # --- the full order (2026-08-22) ---------------------------------------
    # Deliberately a separate block from the comparison numbers above, which
    # keep counting exactly what they always counted. A record filed before
    # ranking shipped has no jd_ranks rows and simply does not appear here, so
    # nothing above is restated or double-counted.
    ranked = [r for r in records if r.get("ranking")]
    if not ranked:
        return

    # A one-entry order is a degraded submission ranking its only survivor:
    # real data, but nobody beat anybody, so it is excluded the same way
    # paired() excludes a one-slot comparison.
    contested = [r for r in ranked if len(r["ranking"]) > 1]
    with_ties = sum(1 for r in contested
                    if len({e["rank"] for e in r["ranking"]}) < len(r["ranking"]))
    write("rankings               %d filed, %d contested, %d carrying a tie below first\n"
          % (len(ranked), len(contested), with_ties))
    if not contested:
        return

    first_a = sum(1 for r in contested
                  if any(e["rank"] == 1 and e["slot"] == "a" for e in r["ranking"]))
    write("position bias (P slot A ranks first)     %.3f  (%d/%d)\n"
          % (float(first_a) / len(contested), first_a, len(contested)))

    # mean rank is NOT comparable across differently sized fields — rank 2 of
    # 2 and rank 2 of 4 are different achievements — so the field size is
    # printed alongside it rather than averaged away.
    firsts, rank_sum, placed, field = {}, {}, {}, {}
    for record in contested:
        model_of = {g["slot"]: g["model_id"] for g in record["generations"]}
        size = len(record["ranking"])
        for entry in record["ranking"]:
            model = model_of.get(entry["slot"])
            if model is None or entry["rank"] is None:
                continue
            placed[model] = placed.get(model, 0) + 1
            rank_sum[model] = rank_sum.get(model, 0) + entry["rank"]
            field[model] = field.get(model, 0) + size
            if entry["rank"] == 1:
                firsts[model] = firsts.get(model, 0) + 1
    for model in sorted(placed):
        n = placed[model]
        write("ranked %-20s first %.3f (%d/%d)  mean rank %.2f of %.1f\n"
              % (model, float(firsts.get(model, 0)) / n, firsts.get(model, 0), n,
                 float(rank_sum[model]) / n, float(field[model]) / n))


# --------------------------------------------------------------------------


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Dump the Junk Drawer visitor-prompt tables as eval JSONL.",
        epilog="Database credentials come from the environment; see the module docstring.",
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--sqlite", metavar="PATH", help="path to a SQLite database file")
    source.add_argument("--mysql", action="store_true", help="connect via the JD_DB_* environment")
    parser.add_argument("--since", metavar="DATE",
                        help="only submissions created at/after this UTC date")
    parser.add_argument("--status", action="append", metavar="STATUS",
                        help="only submissions with this status (repeatable)")
    parser.add_argument("--include-svg", action="store_true",
                        help="include the full sanitized SVG text")
    parser.add_argument("--include-raw", action="store_true",
                        help="include the full pre-extraction provider text")
    parser.add_argument("--out", metavar="FILE", help="write JSONL there instead of stdout")
    parser.add_argument("--summary", action="store_true",
                        help="print counts and win rates to stderr")
    args = parser.parse_args(argv)

    conn, ph = connect_sqlite(args.sqlite) if args.sqlite else connect_mysql()
    try:
        records = export(conn, ph, args)
    finally:
        conn.close()

    stream = open(args.out, "w", encoding="utf-8") if args.out else sys.stdout
    try:
        for record in records:
            # sort_keys stays off on purpose: the key order above is the
            # documented one, and it is stable across runs.
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    finally:
        if args.out:
            stream.close()

    if args.summary:
        summarize(records, sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
