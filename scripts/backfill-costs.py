#!/usr/bin/env python3
"""Give promoted items the cost their drawings really had.

    python3 scripts/backfill-costs.py [--dry-run]

promote-turn.py wrote everything about a promoted turn except what it cost:
harvest-rerun.py had always carried `tokens` and `cost_usd` across, and the
promotion script simply never learned to (owner report, 2026-08-30 — the
rainbow trout and the UFO showing no Cost line). The numbers were never
lost; they sit in jd_generations.usage_tokens and only had to be priced.

Matches a promoted response to its generation by the submission id its notes
record and by model, prices it with the site's own jd_generation_cost (the
same function the reveal and the report card use), and writes the two fields
in jd-rate.php's shape. Idempotent; leaves alone anything already priced or
anything whose provider has no rate on file.
"""
import json, os, subprocess, sys, tempfile, urllib.request, re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS = os.path.join(REPO, "art", "junk-drawer", "items")
INVENTORY = "https://municipalsky.com/api/jd-inventory.php?t=costs"
HDRS = {"Origin": "https://municipalsky.com",
        "User-Agent": "Mozilla/5.0 (backfill-costs.py; municipal-sky curation)"}

PRICER = """<?php
require_once %(cfg)s; require_once %(usage)s;
$rows = json_decode(stream_get_contents(STDIN), true);
$out = [];
foreach ($rows as $k => $g) {
    $u = !empty($g['usage_tokens']) ? json_decode((string) $g['usage_tokens'], true) : null;
    $c = jd_generation_cost((string) $g['provider'], (string) $g['model_version'],
                            is_array($u) ? $u : null);
    $t = $c['tokens'];
    $out[$k] = [
        'tokens' => $t === null ? null : [
            'input' => $t['input'], 'output' => $t['output'],
            'total' => $t['input'] + $t['cache_write'] + $t['cache_read'] + $t['output']],
        'cost_usd' => $c['cost_usd'] === null ? null : round($c['cost_usd'], 6),
    ];
}
echo json_encode($out);
"""


def price(batch):
    php = PRICER % {"cfg": json.dumps(os.path.join(REPO, "api", "jd-config.php")),
                    "usage": json.dumps(os.path.join(REPO, "api", "jd-usage.php"))}
    with tempfile.NamedTemporaryFile("w", suffix=".php", delete=False) as f:
        f.write(php); path = f.name
    try:
        out = subprocess.run(["php", path], input=json.dumps(batch),
                             capture_output=True, text=True, check=True).stdout
        return json.loads(out)
    finally:
        os.unlink(path)


def price_one():
    """--price-one: one generation row on stdin, its {tokens, cost_usd} out.
    promote-turn.py calls this so a fresh promotion is priced the same way
    the repairs were, by the site's own function rather than a second copy
    of the arithmetic."""
    row = json.load(sys.stdin)
    print(json.dumps(price({"x": row})["x"]))


def main():
    if "--price-one" in sys.argv:
        price_one(); return
    dry = "--dry-run" in sys.argv
    inv = json.load(urllib.request.urlopen(
        urllib.request.Request(INVENTORY, headers=HDRS)))
    # (submission, model) -> generation row
    gens = {}
    for s in inv["submissions"]:
        for g in s["generations"]:
            gens[(s["submission_id"], g["model_id"])] = g

    todo, keys = {}, []
    for iid in sorted(os.listdir(ITEMS)):
        p = os.path.join(ITEMS, iid, "entry.json")
        if not os.path.exists(p):
            continue
        entry = json.load(open(p))
        for r in entry["responses"]:
            if "cost_usd" in r or "tokens" in r:
                continue
            m = re.search(r"submission ([0-9A-HJKMNP-TV-Z]{26})", r.get("notes") or "")
            if not m:
                continue
            g = gens.get((m.group(1), r["model"]))
            if not g or not g.get("usage_tokens"):
                continue
            k = f"{iid}|{r['rid']}"
            todo[k] = g
            keys.append((k, iid, r["rid"], r["model"]))
    if not todo:
        print("nothing to price — every promoted response already states its cost")
        return
    priced = price(todo)

    by_item, n = {}, 0
    for k, iid, rid, model in keys:
        v = priced.get(k) or {}
        if v.get("tokens") is None and v.get("cost_usd") is None:
            continue
        by_item.setdefault(iid, []).append((rid, model, v))
    for iid, rows in sorted(by_item.items()):
        p = os.path.join(ITEMS, iid, "entry.json")
        entry = json.load(open(p))
        for rid, model, v in rows:
            for r in entry["responses"]:
                if r["rid"] != rid:
                    continue
                if v["tokens"]:
                    r["tokens"] = v["tokens"]
                if v["cost_usd"] is not None:
                    r["cost_usd"] = v["cost_usd"]
                n += 1
        if not dry:
            open(p, "w").write(json.dumps(entry, indent=2, ensure_ascii=False) + "\n")
        total = sum(x[2]["cost_usd"] or 0 for x in rows)
        print(f"  {iid:44s} {len(rows)} responses  ${total:.4f}")
    print(f"\n{'would price' if dry else 'priced'}: {n} responses across {len(by_item)} items")


if __name__ == "__main__":
    main()
