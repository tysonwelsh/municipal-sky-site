#!/usr/bin/env python3
"""Export the Junk Drawer dataset v2 (the jd2_* tables) for analysis.

JSONL, one object per line, one line per PROMPT, everything filed about it:

    {"prompt": {...the jd2_prompts row...},
     "runs": [ {...run..., "deal": {slot: model_id},
                "generations": [ {...one per slot...} ],
                "sessions": [ {...sitting...,
                               "judgments": [ {generation_id, slot, kind, axis_id, value, note,
                                               mapped_axis_id, mapped_value} ],
                               "rankings":  [ {generation_id, slot, rank_pos, gap_after} ],
                               "pairs":     [ {gen_a, gen_b, slot_a, slot_b, score, source, method, shown_left} ]} ],
                "display_session_id": id | null} ]}

Every session is exported — owner and visitor, current or superseded, complete
or not — because sessions are append-only and the history is data. Rows are
ordered deterministically (prompts by created+id, runs by created+id,
generations by slot, sessions by filed_at+id, cells by slot/kind/axis) so two
exports of the same data diff cleanly. A generation carries `svg_bytes` and
`raw_response_bytes`; the text itself only with --include-svg / --include-raw.
It also carries `normalized`: what the sanitizer changed between
raw_response and svg (comma-joined words, e.g. `cdata_unwrapped`; null =
nothing, svg is the model's bytes as extracted) — in the JSONL and as a
standing-CSV column.

THE DISPLAY SESSION (the one rule this file applies, and the only one): per
run, the owner's CURRENT session if it is COMPLETE, else the visitor's current
session if it is complete, else none. "Current" = the role's latest `filed`
session by (filed_at, id). "Complete" = every non-hidden ok drawing of the run
has a grade and every axis the session's own rubric required — its
`required_cells` (a JSON list stamped at filing since taxonomy v35, and
backfilled onto older v2 sittings by api/setup-jd2-tables.php), else the live
axes of taxonomy.json (`--taxonomy`) — and, with more than one such drawing, a
ranking places them all in distinct places and every unordered pair of them
has a score. That is api/jd2-config.php's jd2_display_session /
jd2_is_complete / jd2_session_cells, stated here once; nothing else is
folded, merged or re-derived. Each session in the JSONL carries its
`required_cells`.

    --standing out.csv   one row per generation (every run, every status):
                         the run's display session's grade, one column per
                         axis, rank_pos and gap_after for that drawing (empty
                         when the run has no display session or the drawing
                         is not ok / hidden). The axis columns are the live
                         axes in taxonomy order, then every RETIRED axis a v2
                         rubric required, so a retired axis's column stays
                         instead of vanishing (structural-coherence, the
                         3-point axis every v2 sitting before taxonomy v35
                         carried; then any axis a session's required_cells
                         names); a cell is empty where the display session
                         did not rate that axis
    The prompt carries the intake facts too: `tags` ({facet: [heading id]}),
    `size_by` (model | owner | visitor), `intake_version`, `intake_model`,
    `intake_json` (the clerk's answer and usage, or the error of a failed
    intake), `intake_cost_usd`, `intake_at`; the standing CSV carries
    size_class, size_by and one `tags_<facet>` column per taxonomy facet
    (heading ids joined with ";").

    THE SUCCESSOR MAP (taxonomy v36). A judgment keeps its FILED axis_id and
    value. Where the taxonomy names a successor for the filed axis (a defunct
    axis's `"successor": {"id", "map"}`: v36's `layering` → `layering-2`,
    3 → 4, 2 → 3, 1 → 1) the judgment also carries `mapped_axis_id` and
    `mapped_value`, the same answer read on the live scale (null where no map
    applies, the grade included) — api/jd2-config.php's jd2_axis_successors /
    jd2_map_axes, stated here once. In the standing CSV each live axis that
    succeeds a retired one gets two more columns after the axis columns:
    `<axis>_onescale`, the drawing's value on the live scale (filed directly
    on it, else mapped from the retired axis), and `<axis>_mapped_from`, the
    retired axis id when the value was mapped (empty when filed directly). The
    filed columns are unchanged, so an analyst can use the one scale or the
    filed ones.

    --pairs out.csv      one row per pair of every run's display session,
                         with both sides' slot and model; score is signed for
                         gen_a (positive = gen_a preferred)

CONNECTING
----------
Dev / SQLite (JD_DEV_MOCK's database):

    python3 scripts/jd2-export.py --sqlite local-dev/jd-dev.sqlite --out v2.jsonl

Production / MySQL — credentials from the environment, never argv (they would
land in the shell history and the process table). The names mirror the keys
in private_config/secrets.php:

    JD_DB_HOST   default 'localhost'; from the owner's machine it is
                 municipalsky.com (the Bluehost MySQL, with the machine's IP
                 on the host's Remote MySQL allowlist)
    JD_DB_PORT   default 3306
    JD_DB_NAME   required   (secrets.php: db_name)
    JD_DB_USER   required   (secrets.php: db_user)
    JD_DB_PASS   required   (secrets.php: db_pass)

    JD_DB_HOST=municipalsky.com JD_DB_NAME=… JD_DB_USER=… JD_DB_PASS=… \\
        python3 scripts/jd2-export.py --mysql --out v2.jsonl --standing v2-standing.csv --pairs v2-pairs.csv

Python 3 standard library only; MySQL needs one DB-API driver (PyMySQL,
mysql.connector or MySQLdb). Owner-run; there is no export endpoint and there
must never be one: the tables hold visitor prompt text.

OPTIONS
-------
    --taxonomy PATH      the live axes: the CSV's first axis columns, and "complete" for a
                         session with no required_cells (default art/junk-drawer/taxonomy.json)
    --include-svg        include each drawing's sanitized SVG text
    --include-raw        include each drawing's raw provider response
    --out FILE           JSONL there instead of stdout
    --standing FILE      the per-generation standing CSV
    --pairs FILE         the per-pair CSV
"""

import argparse
import csv
import json
import os
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# --------------------------------------------------------------------------
# connections (export-jd-evals.py's, unchanged in shape)


def die(message):
    sys.stderr.write("jd2-export: %s\n" % message)
    raise SystemExit(2)


def connect_sqlite(path):
    import sqlite3

    if not os.path.exists(path):
        die("no such SQLite database: %s" % path)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


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
        return driver.connect(**kwargs)
    die("no MySQL driver found. Install one (pip install PyMySQL) or copy the "
        "jd2_ tables to SQLite and use --sqlite.")


def rows(conn, sql, params=()):
    """Plain dicts, whichever driver is underneath; '?' placeholders are rewritten for MySQL."""
    connector = type(conn).__module__.startswith("mysql.connector")
    if not type(conn).__module__.startswith("sqlite3"):
        sql = sql.replace("?", "%s")
    cur = conn.cursor(dictionary=True) if connector else conn.cursor()
    cur.execute(sql, tuple(params))
    columns = [d[0] for d in cur.description]
    out = [r if isinstance(r, dict) else dict(zip(columns, r)) for r in cur.fetchall()]
    cur.close()
    return out


# --------------------------------------------------------------------------
# shaping


def as_int(v):
    return None if v is None else int(v)


def as_float(v):
    return None if v is None else float(v)


def as_text(v):
    if v is None:
        return None
    if isinstance(v, (bytes, bytearray)):
        return v.decode("utf-8", "replace")
    return str(v)


def byte_len(v):
    if v is None:
        return None
    return len(v) if isinstance(v, (bytes, bytearray)) else len(str(v).encode("utf-8"))


def as_json(v):
    if v is None:
        return None
    try:
        return json.loads(as_text(v))
    except ValueError:
        return as_text(v)


def as_stamp(v):
    return None if v is None else as_text(v)[:19]


def live_axes(taxonomy):
    return [a["id"] for a in taxonomy.get("axes", []) if not a.get("defunct")]


def _rank_key(v):
    return str(int(round(float(v))))


def axis_successors(taxonomy):
    """jd2_axis_successors: retired axis id => (live successor id, {old rank key: new rank}).
    Chains are followed to a live axis and their maps composed; a broken entry (an unknown
    or still-retired end, a cycle, a rank off the successor's scale) is left out."""
    by_id = {a["id"]: a for a in taxonomy.get("axes", []) if isinstance(a, dict) and "id" in a}
    live = {a: [float(v["rank"]) for v in by_id[a].get("values", []) if "rank" in v] for a in live_axes(taxonomy)}

    def hop(axis):
        s = axis.get("successor")
        if not axis.get("defunct") or not isinstance(s, dict) or not isinstance(s.get("id"), str) \
                or not isinstance(s.get("map"), dict):
            return None
        return s

    def clean(m):
        out = {}
        for f, t in m.items():
            try:
                out[_rank_key(f)] = float(t)
            except (TypeError, ValueError):
                pass
        return out

    out = {}
    for aid, axis in by_id.items():
        s = hop(axis)
        if s is None:
            continue
        m, seen, to = clean(s["map"]), {aid}, s["id"]
        while to not in live and to in by_id and to not in seen and hop(by_id[to]) is not None:
            seen.add(to)
            nxt = hop(by_id[to])
            step = clean(nxt["map"])
            m = {f: step[_rank_key(t)] for f, t in m.items() if _rank_key(t) in step}
            to = nxt["id"]
        if to not in live:
            continue
        m = {f: t for f, t in m.items() if any(abs(t - r) < 0.05 for r in live[to])}
        if m:
            out[aid] = (to, m)
    return out


def mapped_cell(axis_id, value, successors):
    """(mapped axis id, mapped value) for one filed axis judgment, or (None, None)."""
    s = successors.get(axis_id) if axis_id else None
    if s is None or value is None:
        return None, None
    to = s[1].get(_rank_key(value))
    return (s[0], to) if to is not None else (None, None)


# api/jd2-config.php's JD2_CELLS_BEFORE_V35: the cells the v2 rubric required
# from its baseline through taxonomy v34 (the setup runner backfills them onto
# those sittings). Read here only to keep their axes' columns in the CSV.
V2_CELLS_BEFORE_V35 = ["understanding-assignment", "structural-coherence", "layering", "jnsq", "grade"]


def session_cells(raw, axes):
    """jd2_session_cells: the session's own required_cells when readable, else the live axes and the grade."""
    cells = as_json(raw)
    if isinstance(cells, list) and "grade" in cells and all(isinstance(c, str) and c for c in cells):
        return list(dict.fromkeys(cells))
    return list(axes) + ["grade"]


def axis_columns(taxonomy, live, sessions):
    """The live axes in taxonomy order, then every retired axis a v2 rubric required, in taxonomy order."""
    wanted = set(c for c in V2_CELLS_BEFORE_V35 if c != "grade")
    for s in sessions:
        wanted.update(c for c in session_cells(s.get("required_cells"), live) if c != "grade")
    order = [a["id"] for a in taxonomy.get("axes", [])]
    retired = [a for a in order if a in wanted and a not in live]
    retired += sorted(a for a in wanted if a not in live and a not in order)
    return list(live) + retired


def is_complete(session, counting, axes):
    """jd2_is_complete: cells for every counting drawing, then a strict ranking and every pair.
    `axes` are the axis cells the session must carry (session_cells, less the grade)."""
    ids = list(counting)
    if not ids:
        return False
    cells = {}
    for j in session["judgments"]:
        cells.setdefault(j["generation_id"], set()).add("grade" if j["kind"] == "grade" else j["axis_id"])
    for gid in ids:
        have = cells.get(gid, set())
        if "grade" not in have or any(a not in have for a in axes):
            return False
    if len(ids) == 1:
        return True
    places = {}
    for r in session["rankings"]:
        if r["generation_id"] in counting:
            places[r["generation_id"]] = r["rank_pos"]
    if len(places) != len(ids) or len(set(places.values())) != len(ids):
        return False
    scored = {frozenset((p["gen_a"], p["gen_b"])) for p in session["pairs"]}
    for i, a in enumerate(ids):
        for b in ids[i + 1:]:
            if frozenset((a, b)) not in scored:
                return False
    return True


def judgment_out(j, slot_of, successors):
    """One filed judgment as exported: the filed cell, then its reading on the live scale (or nulls)."""
    value = as_float(j["value"])
    mid, mv = mapped_cell(j["axis_id"] if j["kind"] == "axis" else None, value, successors)
    return {
        "generation_id": j["generation_id"], "slot": slot_of.get(j["generation_id"]),
        "kind": j["kind"], "axis_id": j["axis_id"] or None, "value": value, "note": as_text(j["note"]),
        "mapped_axis_id": mid, "mapped_value": mv,
    }


def facet_ids(taxonomy):
    return [f["id"] for f in taxonomy.get("facets", []) if isinstance(f, dict) and f.get("id")]


def export(conn, args, taxonomy):
    live = live_axes(taxonomy)
    successors = axis_successors(taxonomy)
    # the live axes a retired one maps onto, in taxonomy order: each gets the
    # standing CSV's _onescale and _mapped_from columns
    onescale = [a for a in live if any(s[0] == a for s in successors.values())]
    facets = facet_ids(taxonomy)
    prompts = rows(conn, "SELECT * FROM jd2_prompts ORDER BY created, id")
    runs = rows(conn, "SELECT * FROM jd2_runs ORDER BY created, id")
    # byte lengths: LENGTH() counts bytes on MySQL, characters on SQLite unless cast to a BLOB
    blen = "LENGTH(%s)" if not type(conn).__module__.startswith("sqlite3") else "LENGTH(CAST(%s AS BLOB))"
    gen_cols = ("id, run_id, slot, model_id, api_model, provider, params, status, reject_reason, "
                "disobedience, normalized, latency_ms, usage_json, cost_usd, priced, hidden, created, "
                + (blen % "svg") + " AS svg_len, " + (blen % "raw_response") + " AS raw_len")
    if args.include_svg:
        gen_cols += ", svg"
    if args.include_raw:
        gen_cols += ", raw_response"
    gens = rows(conn, "SELECT %s FROM jd2_generations ORDER BY run_id, slot" % gen_cols)
    sessions = rows(conn, "SELECT * FROM jd2_sessions ORDER BY filed_at, id")
    axes = axis_columns(taxonomy, live, sessions)
    judgments = rows(conn, "SELECT session_id, generation_id, kind, axis_id, value, note FROM jd2_judgments ORDER BY id")
    rankings = rows(conn, "SELECT session_id, generation_id, rank_pos, gap_after FROM jd2_rankings ORDER BY rank_pos")
    pairs = rows(conn, "SELECT session_id, gen_a, gen_b, score, source, method, shown_left FROM jd2_pairs ORDER BY id")

    gens_by_run, slot_of, model_of = {}, {}, {}
    for g in gens:
        gens_by_run.setdefault(g["run_id"], []).append(g)
        slot_of[g["id"]] = g["slot"]
        model_of[g["id"]] = g["model_id"]
    by_session = {}
    for kind, table in (("judgments", judgments), ("rankings", rankings), ("pairs", pairs)):
        for r in table:
            by_session.setdefault(r["session_id"], {"judgments": [], "rankings": [], "pairs": []})[kind].append(r)
    sessions_by_run = {}
    for s in sessions:
        sessions_by_run.setdefault(s["run_id"], []).append(s)
    runs_by_prompt = {}
    for r in runs:
        runs_by_prompt.setdefault(r["prompt_id"], []).append(r)

    records, standing_rows, pair_rows = [], [], []
    for p in prompts:
        out_runs = []
        for run in runs_by_prompt.get(p["id"], []):
            rgens = gens_by_run.get(run["id"], [])
            counting = [g["id"] for g in rgens if g["status"] == "ok" and not int(g["hidden"])]
            out_sessions, current = [], {}
            for s in sessions_by_run.get(run["id"], []):
                f = by_session.get(s["id"], {"judgments": [], "rankings": [], "pairs": []})
                sess = {
                    "id": s["id"], "rater_role": s["rater_role"], "rater_hash": s["rater_hash"],
                    "device_ref": s["device_ref"], "client": s["client"],
                    "taxonomy_version": as_int(s["taxonomy_version"]), "instrument_version": s["instrument_version"],
                    "required_cells": session_cells(s.get("required_cells"), live),
                    "blind": as_int(s["blind"]), "seat_order": as_json(s["seat_order"]),
                    "note": as_text(s.get("note")),
                    "started_at": as_stamp(s["started_at"]), "filed_at": as_stamp(s["filed_at"]), "status": s["status"],
                    "judgments": sorted((judgment_out(j, slot_of, successors) for j in f["judgments"]),
                        key=lambda j: (j["slot"] or "", j["kind"] != "grade", j["axis_id"] or "")),
                    "rankings": [{"generation_id": r["generation_id"], "slot": slot_of.get(r["generation_id"]),
                                  "rank_pos": as_int(r["rank_pos"]), "gap_after": as_int(r["gap_after"])}
                                 for r in f["rankings"]],
                    "pairs": [{"gen_a": x["gen_a"], "gen_b": x["gen_b"], "slot_a": slot_of.get(x["gen_a"]),
                               "slot_b": slot_of.get(x["gen_b"]), "score": as_int(x["score"]), "source": x["source"],
                               "method": x["method"], "shown_left": x["shown_left"]} for x in f["pairs"]],
                }
                out_sessions.append(sess)
                if s["status"] == "filed":
                    prev = current.get(s["rater_role"])
                    if prev is None or (as_stamp(s["filed_at"]), s["id"]) > (prev["filed_at"], prev["id"]):
                        current[s["rater_role"]] = sess
            display = None
            def own(sess):
                return [c for c in sess["required_cells"] if c != "grade"]
            for role in ("owner", "visitor"):
                cand = current.get(role)
                if cand is not None and is_complete(cand, set(counting), own(cand)):
                    display = cand
                    break
            for sess in out_sessions:
                sess["current"] = current.get(sess["rater_role"]) is sess
                sess["complete"] = is_complete(sess, set(counting), own(sess))

            out_gens = []
            for g in rgens:
                og = {
                    "id": g["id"], "slot": g["slot"], "model_id": g["model_id"], "api_model": g["api_model"],
                    "provider": g["provider"], "params": as_json(g["params"]), "status": g["status"],
                    "reject_reason": g["reject_reason"], "disobedience": as_int(g["disobedience"]),
                    "normalized": g["normalized"],
                    "latency_ms": as_int(g["latency_ms"]), "usage": as_json(g["usage_json"]),
                    "cost_usd": as_float(g["cost_usd"]), "priced": as_int(g["priced"]), "hidden": as_int(g["hidden"]),
                    "created": as_stamp(g["created"]), "svg_bytes": as_int(g["svg_len"]),
                    "raw_response_bytes": as_int(g["raw_len"]),
                }
                if args.include_svg:
                    og["svg"] = as_text(g["svg"])
                if args.include_raw:
                    og["raw_response"] = as_text(g["raw_response"])
                out_gens.append(og)

            out_runs.append({
                "id": run["id"], "kind": run["kind"], "requested_by": run["requested_by"], "profile": run["profile"],
                "harness": run["harness"], "pool_version": run["pool_version"], "deal": as_json(run["deal"]),
                "status": run["status"], "created": as_stamp(run["created"]),
                "generations": out_gens, "sessions": out_sessions,
                "display_session_id": display["id"] if display else None,
            })

            # the standing CSV: every generation; the display session's cells for the counting ones
            cells, ranks = {}, {}
            if display is not None:
                for j in display["judgments"]:
                    cells.setdefault(j["generation_id"], {})["grade" if j["kind"] == "grade" else j["axis_id"]] = j["value"]
                for r in display["rankings"]:
                    ranks[r["generation_id"]] = r
            ptags = as_json(p.get("tags")) or {}
            for g in rgens:
                counted = g["id"] in counting
                c = cells.get(g["id"], {}) if counted else {}
                rk = ranks.get(g["id"], {}) if counted else {}
                row = {
                    "prompt_id": p["id"], "prompt": as_text(p["text"]), "origin": p["origin"],
                    "visibility": p["visibility"], "v1_item_id": p["v1_item_id"],
                    "category": p.get("category"), "size_class": p.get("size_class"), "size_by": p.get("size_by"),
                    "run_id": run["id"], "run_kind": run["kind"], "profile": run["profile"], "harness": run["harness"],
                    "pool_version": run["pool_version"], "generation_id": g["id"], "slot": g["slot"],
                    "model_id": g["model_id"], "api_model": g["api_model"], "provider": g["provider"],
                    "status": g["status"], "hidden": as_int(g["hidden"]), "normalized": g["normalized"],
                    "cost_usd": as_float(g["cost_usd"]),
                    "priced": as_int(g["priced"]), "latency_ms": as_int(g["latency_ms"]),
                    "display_session_id": display["id"] if (display and counted) else None,
                    "rater_role": display["rater_role"] if (display and counted) else None,
                    "blind": display["blind"] if (display and counted) else None,
                    "taxonomy_version": display["taxonomy_version"] if (display and counted) else None,
                    "grade": c.get("grade"),
                }
                for a in axes:
                    row[a] = c.get(a)
                for a in onescale:
                    # filed directly on the live axis, else read from a retired one
                    # through the taxonomy's map (the first that applies, in taxonomy order)
                    row[a + "_onescale"], row[a + "_mapped_from"] = c.get(a), None
                    if c.get(a) is None:
                        for old, (to, _m) in successors.items():
                            mid, mv = mapped_cell(old, c.get(old), successors)
                            if to == a and mid is not None:
                                row[a + "_onescale"], row[a + "_mapped_from"] = mv, old
                                break
                for fid in facets:
                    row["tags_" + fid] = ";".join(ptags.get(fid) or []) if isinstance(ptags, dict) else ""
                row["rank_pos"] = rk.get("rank_pos")
                row["gap_after"] = rk.get("gap_after")
                standing_rows.append(row)
            if display is not None:
                for x in display["pairs"]:
                    pair_rows.append({
                        "prompt_id": p["id"], "origin": p["origin"], "visibility": p["visibility"],
                        "run_id": run["id"], "session_id": display["id"], "rater_role": display["rater_role"],
                        "blind": display["blind"], "gen_a": x["gen_a"], "gen_b": x["gen_b"],
                        "slot_a": x["slot_a"], "slot_b": x["slot_b"],
                        "model_a": model_of.get(x["gen_a"]), "model_b": model_of.get(x["gen_b"]),
                        "score": x["score"], "source": x["source"], "method": x["method"],
                        "shown_left": x["shown_left"],
                    })

        records.append({
            "prompt": {
                "id": p["id"], "text": as_text(p["text"]), "title": as_text(p["title"]), "origin": p["origin"],
                "created": as_stamp(p["created"]), "size_class": p["size_class"],
                "size_scale": as_float(p["size_scale"]), "visibility": p["visibility"], "hidden_by": p["hidden_by"],
                "hidden_at": as_stamp(p["hidden_at"]), "approved_at": as_stamp(p["approved_at"]),
                "approved_by": p["approved_by"], "shown_run_id": p["shown_run_id"],
                "pinned_generation_id": p["pinned_generation_id"], "v1_item_id": p["v1_item_id"],
                "category": p.get("category"),
                "size_by": p.get("size_by"),
                "tags": as_json(p.get("tags")),
                "intake_version": p.get("intake_version"), "intake_model": p.get("intake_model"),
                "intake_json": as_json(p.get("intake_json")),
                "intake_cost_usd": as_float(p.get("intake_cost_usd")),
                "intake_at": as_stamp(p.get("intake_at")),
                "visitor_hash": p["visitor_hash"], "device_ref": p["device_ref"],
                "consent_version": p["consent_version"], "consent_at": as_stamp(p["consent_at"]),
            },
            "runs": out_runs,
        })
    return records, standing_rows, pair_rows, axes + [x for a in onescale for x in (a + "_onescale", a + "_mapped_from")], facets


def write_csv(path, fieldnames, data):
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        for r in data:
            w.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in fieldnames})


def main(argv=None):
    parser = argparse.ArgumentParser(description="Export the Junk Drawer dataset v2 (jd2_* tables).")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--sqlite", metavar="PATH", help="path to a SQLite database file")
    source.add_argument("--mysql", action="store_true", help="connect via the JD_DB_* environment")
    parser.add_argument("--taxonomy", metavar="PATH", default=os.path.join(REPO, "art", "junk-drawer", "taxonomy.json"))
    parser.add_argument("--include-svg", action="store_true")
    parser.add_argument("--include-raw", action="store_true")
    parser.add_argument("--out", metavar="FILE")
    parser.add_argument("--standing", metavar="FILE")
    parser.add_argument("--pairs", metavar="FILE")
    args = parser.parse_args(argv)

    try:
        with open(args.taxonomy, encoding="utf-8") as fh:
            taxonomy = json.load(fh)
    except (OSError, ValueError) as error:
        die("cannot read the taxonomy %s (%s)" % (args.taxonomy, error))

    conn = connect_sqlite(args.sqlite) if args.sqlite else connect_mysql()
    try:
        records, standing, pairs, axes, facets = export(conn, args, taxonomy)
    finally:
        conn.close()

    stream = open(args.out, "w", encoding="utf-8") if args.out else sys.stdout
    try:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
    finally:
        if args.out:
            stream.close()
    if args.standing:
        write_csv(args.standing, [
            "prompt_id", "prompt", "origin", "visibility", "v1_item_id", "category", "size_class", "size_by",
            "run_id", "run_kind", "profile", "harness",
            "pool_version", "generation_id", "slot", "model_id", "api_model", "provider", "status", "hidden",
            "normalized", "cost_usd", "priced", "latency_ms", "display_session_id", "rater_role", "blind", "taxonomy_version",
            "grade"] + axes + ["tags_" + f for f in facets] + ["rank_pos", "gap_after"], standing)
    if args.pairs:
        write_csv(args.pairs, [
            "prompt_id", "origin", "visibility", "run_id", "session_id", "rater_role", "blind", "gen_a", "gen_b",
            "slot_a", "slot_b", "model_a", "model_b", "score", "source", "method", "shown_left"], pairs)
    sys.stderr.write("jd2-export: %d prompts, %d generations, %d display pairs\n"
                     % (len(records), len(standing), len(pairs)))


if __name__ == "__main__":
    main()
