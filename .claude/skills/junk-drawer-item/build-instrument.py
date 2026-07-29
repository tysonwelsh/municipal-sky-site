#!/usr/bin/env python3
"""Populate rating-instrument.html for a set of responses.

The instrument is a fixed template (rating-instrument.html) with four
__INJECT_* markers. This script fills them from live data so the rubric on
the page is always taxonomy.json's, never a hand-copied snapshot, and so the
SVG id-prefixing is done the same way every session.

    python3 build-instrument.py --out /path/rate.html \
        --heading "Rate — mammoth in an ice cube" \
        claude-opus-5=items/<id>/claude-opus-5.svg \
        claude-sonnet-5=items/<id>/claude-sonnet-5.svg

Each MODEL=PATH pair becomes one tab, in the order given — which is also the
rid order (first pair = r1). Model labels come from taxonomy.json's registry;
an unregistered id falls back to the id itself and is reported, since it has
to be registered before the entry will validate anyway.

Every id in each SVG is prefixed (m1_, m2_, …) along with every url(#…),
href="#…" and xlink:href="#…" that references it, so gradients, clip paths
and filters from three documents can share one page without colliding.
Artwork is otherwise untouched: this reads the files, it never writes them.
"""

import argparse
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
DRAWER = HERE.parents[2] / "art" / "junk-drawer"
TEMPLATE = HERE / "rating-instrument.html"

MARKERS = {
    "grades": "/* __INJECT_GRADES__ */ []",
    "axes": "/* __INJECT_AXES__ */ []",
    "sizeTiers": "/* __INJECT_SIZES__ */ []",
}


def prefix_ids(svg, prefix):
    """Namespace every id in one SVG document and every reference to it."""
    ids = set(re.findall(r'\bid="([^"]+)"', svg))
    # longest first: cosmetic here (the quotes/parens already bound each
    # match) but it keeps the rewrite order stable and easy to reason about
    for name in sorted(ids, key=len, reverse=True):
        new = prefix + name
        svg = svg.replace('id="%s"' % name, 'id="%s"' % new)
        svg = svg.replace("url(#%s)" % name, "url(#%s)" % new)
        # also catches xlink:href="#name", which ends with this substring
        svg = svg.replace('href="#%s"' % name, 'href="#%s"' % new)
    refs = set()
    for url_ref, href_ref in re.findall(r'url\(#([^)]+)\)|href="#([^"]+)"', svg):
        refs.add(url_ref or href_ref)
    dangling = {r for r in refs if r and not r.startswith(prefix)}
    return svg, sorted(dangling)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True, help="path to write the populated HTML to")
    ap.add_argument("--heading", required=True, help="h1 text (the <title> stays fixed)")
    ap.add_argument("--taxonomy", default=str(DRAWER / "taxonomy.json"))
    ap.add_argument("responses", nargs="+", metavar="MODEL=SVG",
                    help="one per tab, in rid order")
    args = ap.parse_args()

    taxonomy = json.loads(pathlib.Path(args.taxonomy).read_text())
    labels = {m["id"]: m.get("label", m["id"]) for m in taxonomy.get("models", [])}

    responses, unregistered = [], []
    for i, spec in enumerate(args.responses, start=1):
        if "=" not in spec:
            ap.error("expected MODEL=SVG, got %r" % spec)
        model, _, path = spec.partition("=")
        svg_path = pathlib.Path(path)
        if not svg_path.is_file():
            ap.error("no such SVG: %s" % path)
        if model not in labels:
            unregistered.append(model)
        svg, dangling = prefix_ids(svg_path.read_text(), "m%d_" % i)
        if dangling:
            print("  ! %s references ids it does not define: %s"
                  % (model, ", ".join(dangling)), file=sys.stderr)
        responses.append({"key": model, "label": labels.get(model, model), "svg": svg})

    html = TEMPLATE.read_text()
    for key, marker in MARKERS.items():
        if marker not in html:
            sys.exit("template marker missing: %s" % marker)
        html = html.replace(marker, json.dumps(taxonomy[key]))
    html = html.replace("/* __INJECT_RESPONSES__ */ []", json.dumps(responses))
    html = html.replace('<h1 id="page-title">Rate</h1>',
                        '<h1 id="page-title">%s</h1>' % args.heading)

    out = pathlib.Path(args.out)
    out.write_text(html)
    print("wrote %s (%d bytes, %d response%s)"
          % (out, len(html), len(responses), "" if len(responses) == 1 else "s"))
    if unregistered:
        print("  ! not in taxonomy.json models: %s — register before filing"
              % ", ".join(unregistered), file=sys.stderr)


if __name__ == "__main__":
    main()
