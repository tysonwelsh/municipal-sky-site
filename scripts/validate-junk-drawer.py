#!/usr/bin/env python3
"""Validate The Junk Drawer data layer (art/junk-drawer/).

Checks taxonomy.json, every items/*/entry.json, and every referenced SVG
for schema conformance, referential integrity against the taxonomy, and
SVG hygiene. Stdlib only, so it runs anywhere (including Claude Code web
sandboxes) with no installs.

Usage:
    python3 scripts/validate-junk-drawer.py [--strict]

Exit 0 = clean (warnings allowed unless --strict). Nonzero = problems,
listed per file.
"""

import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "art" / "junk-drawer"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ITEM_ID_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$")
RID_RE = re.compile(r"^r\d+$")
SLUG_RE = re.compile(r"^[a-z0-9-]+$")

ENTRY_FIELDS = {
    "schema", "id", "title", "prompt", "created", "tags", "primary",
    "placement", "retired", "sizeClass", "sizeScale", "responses",
}
RESPONSE_FIELDS = {
    "rid", "file", "model", "model_version", "date", "generation",
    "grade", "graded", "grade_history", "annotations", "transcript", "notes",
}
PLACEMENT_FIELDS = {"x", "y", "rotation", "scale", "z", "pinned"}
SVG_MAX_BYTES = 200 * 1024

errors = []
warnings = []


def err(path, msg):
    errors.append((str(path), msg))


def warn(path, msg):
    warnings.append((str(path), msg))


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        err(path, f"cannot parse: {e}")
        return None


def check_unique(path, label, ids):
    seen = set()
    for i in ids:
        if i in seen:
            err(path, f"duplicate {label} id: {i!r}")
        seen.add(i)


def validate_taxonomy(path):
    tax = load_json(path)
    if tax is None:
        return None
    for key in ("schema", "version", "grades", "axes", "models"):
        if key not in tax:
            err(path, f"missing required key: {key}")
    grades = tax.get("grades", [])
    check_unique(path, "grade", [g.get("id") for g in grades])
    check_unique(path, "grade rank", [g.get("rank") for g in grades])
    for g in grades:
        for key in ("id", "rank", "label", "description"):
            if not g.get(key) and g.get(key) != 0:
                err(path, f"grade {g.get('id')!r} missing {key}")
    axes = tax.get("axes", [])
    check_unique(path, "axis", [a.get("id") for a in axes])
    for a in axes:
        for key in ("id", "label", "description"):
            if not a.get(key):
                err(path, f"axis {a.get('id')!r} missing {key}")
        values = a.get("values", [])
        if not values:
            err(path, f"axis {a.get('id')!r} has no values")
        check_unique(path, f"axis {a.get('id')!r} value", [v.get("id") for v in values])
        for v in values:
            for key in ("id", "label", "description"):
                if not v.get(key):
                    err(path, f"axis {a.get('id')!r} value {v.get('id')!r} missing {key}")
    models = tax.get("models", [])
    check_unique(path, "model", [m.get("id") for m in models])
    for m in models:
        for key in ("id", "label", "vendor"):
            if not m.get(key):
                err(path, f"model {m.get('id')!r} missing {key}")
        if m.get("id") and not SLUG_RE.match(m["id"]):
            err(path, f"model id {m['id']!r} is not kebab-case")
    return tax


def check_date(path, value, label):
    if not isinstance(value, str) or not DATE_RE.match(value):
        err(path, f"{label} must be YYYY-MM-DD, got {value!r}")


def validate_annotations(path, rid, annotations, axis_values):
    if not isinstance(annotations, dict):
        err(path, f"{rid}: annotations must be an object")
        return
    for axis_id, val in annotations.items():
        if axis_id not in axis_values:
            err(path, f"{rid}: unknown annotation axis {axis_id!r}")
            continue
        if isinstance(val, dict):
            value_id = val.get("value")
            unknown = set(val) - {"value", "note"}
            if unknown:
                warn(path, f"{rid}: annotation {axis_id!r} has unknown keys {sorted(unknown)}")
        else:
            value_id = val
        if value_id not in axis_values[axis_id]:
            err(path, f"{rid}: annotation {axis_id!r} has unknown value {value_id!r}")


def validate_response(path, item_dir, resp, tax_ids):
    rid = resp.get("rid", "<no rid>")
    unknown = set(resp) - RESPONSE_FIELDS
    if unknown:
        warn(path, f"{rid}: unknown response fields {sorted(unknown)}")
    for req in ("rid", "file", "model", "date", "generation", "grade"):
        if req not in resp:
            err(path, f"{rid}: missing required field {req!r}")
    if "rid" in resp and not RID_RE.match(str(resp["rid"])):
        err(path, f"rid {resp['rid']!r} must match r1, r2, ...")
    if "date" in resp:
        check_date(path, resp["date"], f"{rid}: date")
    if "graded" in resp:
        check_date(path, resp["graded"], f"{rid}: graded")
    if resp.get("model") not in tax_ids["models"]:
        err(path, f"{rid}: model {resp.get('model')!r} not in taxonomy models registry")
    if resp.get("grade") not in tax_ids["grades"]:
        err(path, f"{rid}: grade {resp.get('grade')!r} not in taxonomy grade scale")
    gen = resp.get("generation")
    if isinstance(gen, dict):
        mode = gen.get("mode")
        count = gen.get("prompt_count")
        if mode not in ("one-shot", "refined"):
            err(path, f"{rid}: generation.mode must be 'one-shot' or 'refined', got {mode!r}")
        elif mode == "refined" and (not isinstance(count, int) or count < 2):
            err(path, f"{rid}: refined responses need prompt_count >= 2, got {count!r}")
        elif mode == "one-shot" and count not in (None, 1):
            err(path, f"{rid}: one-shot responses must omit prompt_count or set it to 1, got {count!r}")
    elif gen is not None:
        err(path, f"{rid}: generation must be an object")
    for h in resp.get("grade_history") or []:
        for req in ("grade", "date"):
            if req not in h:
                err(path, f"{rid}: grade_history entry missing {req!r}")
        if h.get("grade") is not None and h["grade"] not in tax_ids["grades"]:
            err(path, f"{rid}: grade_history grade {h['grade']!r} not in taxonomy")
        if "date" in h:
            check_date(path, h["date"], f"{rid}: grade_history date")
    if "annotations" in resp:
        validate_annotations(path, rid, resp["annotations"], tax_ids["axis_values"])
    if resp.get("file"):
        f = item_dir / resp["file"]
        if not f.is_file():
            err(path, f"{rid}: file {resp['file']!r} does not exist")
    transcript = resp.get("transcript")
    if transcript:
        t = item_dir / transcript
        if not t.is_file():
            err(path, f"{rid}: transcript {transcript!r} does not exist")
        if not transcript.endswith(".json"):
            err(path, f"{rid}: transcript must be .json (the deploy excludes .md), got {transcript!r}")


def validate_entry(item_dir, tax_ids):
    path = item_dir / "entry.json"
    if not path.is_file():
        err(item_dir, "missing entry.json")
        return []
    entry = load_json(path)
    if entry is None:
        return []
    unknown = set(entry) - ENTRY_FIELDS
    if unknown:
        warn(path, f"unknown entry fields {sorted(unknown)}")
    for req in ("schema", "id", "title", "prompt", "created", "responses"):
        if req not in entry:
            err(path, f"missing required field {req!r}")
    if entry.get("id") != item_dir.name:
        err(path, f"id {entry.get('id')!r} does not match directory name {item_dir.name!r}")
    if entry.get("id") and not ITEM_ID_RE.match(entry["id"]):
        err(path, f"id {entry['id']!r} must be YYYY-MM-DD-<kebab-slug>")
    if "created" in entry:
        check_date(path, entry["created"], "created")
    if "sizeClass" in entry and entry["sizeClass"] not in ("xs", "s", "m", "l", "xl"):
        err(path, f"sizeClass must be one of xs/s/m/l/xl, got {entry['sizeClass']!r}")
    if "sizeScale" in entry:
        ss = entry["sizeScale"]
        if not isinstance(ss, (int, float)) or isinstance(ss, bool) or ss <= 0:
            err(path, f"sizeScale must be a positive number, got {entry['sizeScale']!r}")
    if "retired" in entry and not isinstance(entry["retired"], bool):
        err(path, f"retired must be a boolean, got {entry['retired']!r}")
    if "tags" in entry:
        if not isinstance(entry["tags"], list) or not all(isinstance(t, str) for t in entry["tags"]):
            err(path, "tags must be a list of strings")
    placement = entry.get("placement")
    if placement is not None:
        if not isinstance(placement, dict):
            err(path, "placement must be an object")
        else:
            unknown = set(placement) - PLACEMENT_FIELDS
            if unknown:
                warn(path, f"unknown placement fields {sorted(unknown)}")
            for coord in ("x", "y"):
                v = placement.get(coord)
                if v is not None and not (isinstance(v, (int, float)) and 0 <= v <= 1):
                    err(path, f"placement.{coord} must be in [0, 1], got {v!r}")
    responses = entry.get("responses")
    referenced = set()
    if not isinstance(responses, list) or not responses:
        err(path, "responses must be a non-empty array")
    else:
        check_unique(path, "rid", [r.get("rid") for r in responses])
        for resp in responses:
            if not isinstance(resp, dict):
                err(path, "each response must be an object")
                continue
            validate_response(path, item_dir, resp, tax_ids)
            if resp.get("file"):
                referenced.add(resp["file"])
            if resp.get("transcript"):
                referenced.add(resp["transcript"])
        rids = [r.get("rid") for r in responses if isinstance(r, dict)]
        if entry.get("primary") is not None and entry["primary"] not in rids:
            err(path, f"primary {entry['primary']!r} does not match any response rid")
    for f in item_dir.iterdir():
        if f.suffix == ".svg" and f.name not in referenced:
            warn(path, f"orphan SVG not referenced by any response: {f.name}")
        if f.suffix == ".md":
            err(path, f"markdown file in item directory (the deploy excludes .md): {f.name}")
    return [item_dir / f for f in referenced if f.endswith(".svg")]


def local_name(tag):
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def validate_svg(path):
    if not path.is_file():
        return  # already reported as a missing file reference
    size = path.stat().st_size
    if size > SVG_MAX_BYTES:
        warn(path, f"file is {size // 1024} KB (> {SVG_MAX_BYTES // 1024} KB) — heavy for a drawer item")
    try:
        tree = ET.parse(path)
    except ET.ParseError as e:
        err(path, f"not well-formed XML: {e}")
        return
    root = tree.getroot()
    if local_name(root.tag) != "svg":
        err(path, f"root element is <{local_name(root.tag)}>, not <svg>")
        return
    if "}" not in root.tag:
        err(path, "missing SVG xmlns declaration")
    if "viewBox" not in root.attrib:
        err(path, "missing viewBox (required: the drawer scales items by viewBox)")
    for el in tree.iter():
        name = local_name(el.tag)
        if name == "script":
            err(path, "contains a <script> element")
        if name == "foreignObject":
            err(path, "contains a <foreignObject> element")
        for attr, value in el.attrib.items():
            attr_name = local_name(attr).lower()
            if attr_name.startswith("on"):
                err(path, f"event-handler attribute {attr_name!r} on <{name}>")
            if isinstance(value, str):
                v = value.strip().lower()
                if v.startswith("javascript:"):
                    err(path, f"javascript: URL in {attr_name!r} on <{name}>")
                if attr_name in ("href", "xlink:href") and v.startswith(("http://", "https://")):
                    warn(path, f"external reference in {attr_name!r} on <{name}> (breaks offline, leaks requests)")
                if v.startswith("data:image/") and "svg+xml" not in v[:30]:
                    warn(path, "embedded raster data: URI — a bitmap in an 'SVG' defeats the premise")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="treat warnings as failures")
    args = parser.parse_args()

    if not ROOT.is_dir():
        print(f"error: {ROOT} not found", file=sys.stderr)
        return 2

    tax = validate_taxonomy(ROOT / "taxonomy.json")
    tax_ids = {
        "grades": {g.get("id") for g in (tax or {}).get("grades", [])},
        "models": {m.get("id") for m in (tax or {}).get("models", [])},
        "axis_values": {
            a.get("id"): {v.get("id") for v in a.get("values", [])}
            for a in (tax or {}).get("axes", [])
        },
    }

    items_dir = ROOT / "items"
    svgs = []
    if items_dir.is_dir():
        for item_dir in sorted(p for p in items_dir.iterdir() if p.is_dir()):
            svgs.extend(validate_entry(item_dir, tax_ids))
    else:
        warn(items_dir, "no items/ directory yet")

    for svg in svgs:
        validate_svg(svg)

    for path, msg in errors:
        print(f"ERROR   {Path(path).relative_to(ROOT.parent.parent) if str(path).startswith(str(ROOT.parent.parent)) else path}: {msg}")
    for path, msg in warnings:
        print(f"warning {Path(path).relative_to(ROOT.parent.parent) if str(path).startswith(str(ROOT.parent.parent)) else path}: {msg}")

    n_items = len(list(items_dir.iterdir())) if items_dir.is_dir() else 0
    print(f"\n{n_items} item(s) checked · {len(errors)} error(s) · {len(warnings)} warning(s)")
    if errors or (args.strict and warnings):
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
