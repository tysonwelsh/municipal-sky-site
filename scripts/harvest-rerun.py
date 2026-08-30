#!/usr/bin/env python3
"""Harvest a bench rerun into its item directory (CLAUDE.md procedure).

    python3 scripts/harvest-rerun.py <item_id> [...]

For each item: fetches the rated rerun turns from production jd-harvest.php,
takes the NEWEST, writes each generation's SVG, appends responses in the
owner's rank order — grade, tokens and cost_usd included — and PINS `primary`
to the rank-1 response (owner rule, 2026-08-29: what appears in the drawer is
the re-rated set, whatever the old grades say; the old responses stay as the
permanent record). Idempotent: a submission already filed in entry.json is
skipped. The caller still validates, ink-checks, commits, uploads.
"""
import json, subprocess, sys, urllib.request, os, tempfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS = os.path.join(REPO, "art", "junk-drawer", "items")
HARVEST = "https://municipalsky.com/api/jd-harvest.php?item="

PRICE_PHP = """<?php
require_once %(cfg)s; require_once %(usage)s;
$g = json_decode(stream_get_contents(STDIN), true);
$u = !empty($g['usage_tokens']) ? json_decode((string)$g['usage_tokens'], true) : null;
$c = jd_generation_cost((string)$g['provider'], (string)$g['model_version'], is_array($u) ? $u : null);
$t = $c['tokens'];
echo json_encode([
  'tokens' => $t === null ? null : ['input'=>$t['input'],'output'=>$t['output'],
    'total'=>$t['input']+$t['cache_write']+$t['cache_read']+$t['output']],
  'cost_usd' => $c['cost_usd'] === null ? null : round($c['cost_usd'], 6),
]);
"""

def price(gen):
    php = PRICE_PHP % {
        "cfg": json.dumps(os.path.join(REPO, "api", "jd-config.php")),
        "usage": json.dumps(os.path.join(REPO, "api", "jd-usage.php")),
    }
    with tempfile.NamedTemporaryFile("w", suffix=".php", delete=False) as f:
        f.write(php); path = f.name
    try:
        out = subprocess.run(["php", path], input=json.dumps(gen),
                             capture_output=True, text=True, check=True).stdout
        return json.loads(out)
    finally:
        os.unlink(path)

def harvest(item_id):
    req = urllib.request.Request(HARVEST + item_id, headers={
        "Origin": "https://municipalsky.com",
        # the host's WAF answers python-urllib's default agent with a 406
        "User-Agent": "Mozilla/5.0 (harvest-rerun.py; municipal-sky curation)",
    })
    d = json.load(urllib.request.urlopen(req))
    if not d.get("ok") or not d.get("reruns"):
        print(f"{item_id}: no rated rerun on file — nothing to harvest")
        return False
    rr = d["reruns"][0]                     # newest first
    entry_path = os.path.join(ITEMS, item_id, "entry.json")
    entry = json.load(open(entry_path))
    if any(rr["submission_id"] in (r.get("notes") or "") for r in entry["responses"]):
        print(f"{item_id}: submission {rr['submission_id']} already filed — skipping")
        return False
    ranks = {r["generation_id"]: r["rank_pos"] for r in rr["ranks"]}
    rates = {}
    for r in rr["ratings"]:
        rates.setdefault(r["generation_id"], {})[r["axis_id"] or r["kind"]] = float(r["value"])
    gens = [g for g in rr["generations"] if g["status"] == "ok" and g.get("svg")]
    # THE GATE (owner rule, 2026-08-29): a rerun takes the drawer spot only
    # when rated under the current taxonomy ENTIRELY — every surviving
    # response graded and answered on every live axis. (Axis ids are the
    # permanent part; a label-era version stamp doesn't disqualify.)
    tax = json.load(open(os.path.join(REPO, "art", "junk-drawer", "taxonomy.json")))
    live_axes = [a["id"] for a in tax["axes"] if not a.get("defunct")]
    for g in gens:
        got = rates.get(g["id"], {})
        missing = [a for a in live_axes if a not in got] + ([] if "grade" in got else ["grade"])
        if missing:
            print(f"{item_id}: {g['model_id']} is missing {missing} — the rerun "
                  "is not fully rated under the current taxonomy; NOT harvesting. "
                  "Finish rating it (rerun again from the bench) and retry.")
            return False
    if ranks:
        gens.sort(key=lambda g: ranks.get(g["id"], 99))
    else:
        # a pre-podium turn (winner + margin era, before 2026-08-22) filed no
        # rank order: the comparison winner leads, the rest by grade
        winner = (rr.get("comparison") or {}).get("winner_gen_id")
        gens.sort(key=lambda g: (0 if g["id"] == winner else 1,
                                 -(rates.get(g["id"], {}).get("grade") or 0)))
    day = rr["created"][:10]
    nxt = len(entry["responses"]) + 1
    filed = []
    for i, g in enumerate(gens):
        fn = g["model_id"] + ".svg"
        fpath = os.path.join(ITEMS, item_id, fn)
        if os.path.exists(fpath):
            print(f"{item_id}: {fn} already exists — refusing to overwrite; handle manually")
            return False
        open(fpath, "w").write(g["svg"])
        p = price(g)
        resp = {
            "rid": f"r{nxt + i}",
            "file": fn,
            "model": g["model_id"],
            "model_version": g["model_version"],
            "date": day,
            "generation": {"mode": "one-shot", "prompt_count": 1},
            "grade": rates.get(g["id"], {}).get("grade"),
            "graded": day,
            "grade_history": [],
            "transcript": None,
            "notes": ("Rerun of the original prompt through the live turn flow "
                      f"(bench rerun, submission {rr['submission_id']}), rated blind "
                      "by the owner; "
                      + (f"filed rank {ranks[g['id']]} of {len(gens)}. " if g["id"] in ranks
                         else ("the owner's pick of the turn (pre-podium winner+margin call). "
                               if (rr.get("comparison") or {}).get("winner_gen_id") == g["id"]
                               else "unplaced (pre-podium turn filed no rank order). "))
                      + "Axis ratings live in jd_ratings, per the DB-era rule."),
        }
        # the card renders annotations from entry.json (the DB read path is
        # still unbuilt), and the owner's gate above guarantees a full set —
        # so the harvested response carries its axis ratings visibly
        resp["annotations"] = {a: rates[g["id"]][a] for a in live_axes}
        if p["tokens"]:
            resp["tokens"] = p["tokens"]
        if p["cost_usd"] is not None:
            resp["cost_usd"] = p["cost_usd"]
        entry["responses"].append(resp)
        filed.append((resp["rid"], g["model_id"], resp["grade"], ranks.get(g["id"])))
    # the drawer shows the re-rated set: pin the owner's 1st place
    entry["primary"] = filed[0][0]
    open(entry_path, "w").write(json.dumps(entry, indent=2, ensure_ascii=False) + "\n")
    for rid, m, gr, rk in filed:
        print(f"{item_id}: {rid} {m:18s} grade {gr} rank {rk}")
    print(f"{item_id}: primary pinned to {filed[0][0]} ({filed[0][1]})")
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    any_change = False
    for item in sys.argv[1:]:
        any_change = harvest(item) or any_change
    sys.exit(0 if any_change else 1)
