#!/usr/bin/env python3
"""Bond-network entropy (BNE) sidecars for the point-cloud viewer.

The topology is computed by the REFERENCE implementation: Kamil Iwanowski's
smooth-disorder package (github.com/MPA2suite/smooth-disorder, Academic
Software Licence), located via _find_smooth_disorder below (results here were
produced at its commit ab2d3ea). This file only orchestrates it and writes the
viewer sidecars; none of the algorithm lives here.

Definitions, per Iwanowski, Csanyi & Simoncelli, PRX 15, 041041 (2025) and the
package (which is the ground truth wherever prose is ambiguous):

  * LAE(b, n): the n atoms GEOMETRICALLY closest to b -- minimum-image
    Euclidean distance, b included. Bonds join atoms within 1.8 A. Shell
    layers are assigned by BFS from b *within* that selection; atoms of the
    ball not graph-reachable from b contribute no rings.
  * H1 barcode (paper App. B): annulus ranks F[(c,d)] = components - atoms
    + bonds of each (c,d)-shell annulus, Mobius-inverted into interval
    counts G[(c,d)]. The trailing-zero-reduced G matrix is the barcode.
  * P(H1, n) is taken over ALL atoms -- no subsampling.
    BNE(n) = -sum_H1 P ln P.
  * descriptor = mean over n in [14, 30] of BNE(n)/n (the growth rate).

Distance tables follow the package's own guidance: the exact ASE MIC path for
small/medium cells, the fast manual single-image MIC only for the 8000- and
14009-atom cells, whose ~8 A LAE radii are far below half the cell widths
(all 27 cells here are mildly triclinic).

Verification anchor: AC rho~2.9, 8000 atoms gives descriptor 0.2399
(paper Fig. 2c ~0.24; the previous in-house construction gave 0.2113).

Output: one sidecar per structure in ../structures_bne/<id>.js calling
window.__BNE_CB({...}) -- same payload contract as before, with
sampled == natoms everywhere (every atom is classified).
"""
import json, os, sys, time
from collections import defaultdict

import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)

def _find_smooth_disorder():
    """The reference package is not vendored (Academic Software Licence);
    clone github.com/MPA2suite/smooth-disorder next to tools/ (or two levels
    up), or point SMOOTH_DISORDER at the clone."""
    cands = [os.environ["SMOOTH_DISORDER"]] if os.environ.get("SMOOTH_DISORDER") else []
    cands += [os.path.normpath(os.path.join(TOOLS, rel, "smooth-disorder"))
              for rel in ("..", "../..")]
    for c in cands:
        if os.path.isdir(os.path.join(c, "src", "smooth_disorder")):
            return os.path.join(c, "src")
    sys.exit("smooth-disorder not found. Clone it next to tools/:\n"
             "  git clone https://github.com/MPA2suite/smooth-disorder.git\n"
             "or set SMOOTH_DISORDER to an existing clone.")

sys.path.insert(0, _find_smooth_disorder())

from preprocess import ROOT, GROUPS, CUTOFF, parse_poscar, pretty_name
from ase import Atoms
from smooth_disorder.structural import (
    obtain_distances_ase,
    obtain_distances_big_structures,
)
from smooth_disorder.barcode import (
    obtain_local_number_environment_big_structures,
    obtain_H1_barcode,
    reduce_barcode,
    mu,
)

OUT = os.path.join(TOOLS, "..", "structures_bne")

# n values kept as per-atom class arrays (the viewer's environment-size slider)
N_DISPLAY = [6, 10, 14, 18, 22, 26, 30]
# n range of the BNE(n) curve; [14, 30] of it is averaged for the descriptor
N_CURVE = list(range(2, 31))
DESC_RANGE = (14, 30)
# neighbours kept per atom in the distance table (package config default;
# must exceed max LAE size)
N_SMALLEST = 300
# above this the manual single-image MIC distance path is used instead of the
# exact-but-slower ASE path (safe: see module docstring)
BIG_STRUCTURE = 6000


def bars_from_G(G):
    """Reduced G matrix -> multiset of (min, max) shell intervals for display.

    The class identity used for counting is the raw reduced matrix (exactly
    what the reference workflow compares); this is only the human-readable
    rendering of it. Negative Mobius coefficients cannot be rendered as bars
    and are skipped here -- they still distinguish classes via the raw key.
    """
    Gi = np.rint(np.asarray(G)).astype(np.int64)
    bars, neg = [], 0
    for c in range(Gi.shape[0]):
        for d in range(c, Gi.shape[1]):
            if Gi[c, d] > 0:
                bars.extend([(c, d)] * int(Gi[c, d]))
            elif Gi[c, d] < 0:
                neg += 1
    return tuple(bars), neg


def analyse(cart, lat, log):
    n_at = len(cart)
    n_smallest = min(N_SMALLEST, n_at)
    t0 = time.time()
    if n_at > BIG_STRUCTURE:
        distances, idx_distances = obtain_distances_big_structures(cart, lat, n_smallest)
    else:
        atoms = Atoms(f"C{n_at}", positions=cart, cell=lat, pbc=True)
        distances, idx_distances = obtain_distances_ase(atoms, n_smallest)
    adjacency_matrix = ((distances < CUTOFF) & (distances > 0.1)).astype(int)
    log(f"    distance table done ({time.time()-t0:.0f}s)")

    curve, per_atom, negatives = {}, {}, 0
    for n in sorted(set(N_CURVE) | set(N_DISPLAY)):
        keys = [None] * n_at            # per atom: raw reduced-G class key
        bars_of = {}                    # class key -> display bars
        for b in range(n_at):
            local_adjacency_matrix, layers, local_atom_index, global_index = \
                obtain_local_number_environment_big_structures(
                    adjacency_matrix=adjacency_matrix,
                    atom_index=b,
                    distances=distances,
                    idx_distances=idx_distances,
                    n_environment_atoms=n,
                )
            G, F = obtain_H1_barcode(
                adjacency_matrix=local_adjacency_matrix,
                layers=layers,
                mu=mu,
            )
            G = reduce_barcode(G)
            key = (G.shape[0], np.rint(G).astype(np.int64).tobytes())
            keys[b] = key
            if key not in bars_of:
                bars, neg = bars_from_G(G)
                bars_of[key] = bars
                negatives += neg
        cnt = defaultdict(int)
        for k in keys:
            cnt[k] += 1
        if n in N_CURVE:
            curve[n] = -sum((c / n_at) * np.log(c / n_at) for c in cnt.values())
        if n in N_DISPLAY:
            per_atom[n] = (keys, cnt, bars_of)
        log(f"    n={n:>2}  BNE={curve.get(n, float('nan')):.3f}"
            f"  classes={len(cnt)}  ({time.time()-t0:.0f}s)")

    if negatives:
        log(f"    WARNING: {negatives} negative Mobius coefficient(s) "
            f"hidden from bar display (class identity unaffected)")
    lo, hi = DESC_RANGE
    desc = float(np.mean([curve[n] / n for n in range(lo, hi + 1) if n in curve]))
    return curve, per_atom, desc


def encode(per_atom, n_at):
    """class ids per atom + class table, per display n. Every atom is classed."""
    out = {}
    for n, (keys, cnt, bars_of) in per_atom.items():
        # commonest class first, so id 0 is the "ordinary" environment
        table = sorted(cnt, key=lambda k: (-cnt[k], len(bars_of[k]), bars_of[k]))
        cid = {k: i for i, k in enumerate(table)}
        out[str(n)] = {
            "cls": [cid[k] for k in keys],
            "counts": [cnt[k] for k in table],
            "bars": [[list(iv) for iv in bars_of[k]] for k in table],
            "sampled": n_at,
        }
    return out


def main(only=None):
    os.makedirs(OUT, exist_ok=True)
    index = []
    for group in sorted(GROUPS):
        gdir = os.path.join(ROOT, group)
        for dirpath, _, files in sorted(os.walk(gdir)):
            if "POSCAR" not in files:
                continue
            rel = os.path.relpath(dirpath, gdir)
            sid = (group + "__" + rel.replace("/", "_")).replace("-", "_")
            if only and not any(o in sid for o in only):
                continue
            t0 = time.time()
            print(f"{sid}", flush=True)
            log = lambda m: print(m, flush=True)
            lat, frac = parse_poscar(os.path.join(dirpath, "POSCAR"))
            cart = frac @ lat
            curve, per_atom, desc = analyse(cart, lat, log)
            payload = {
                "id": sid,
                "natoms": len(cart),
                "nDisplay": N_DISPLAY,
                "curve": {"ns": sorted(curve), "bne": [round(curve[n], 4) for n in sorted(curve)],
                          "sampled": len(cart)},
                "descriptor": round(desc, 5),
                "descRange": list(DESC_RANGE),
                "byN": encode(per_atom, len(cart)),
            }
            with open(os.path.join(OUT, sid + ".js"), "w") as f:
                f.write("window.__BNE_CB(" + json.dumps(payload, separators=(",", ":")) + ");")
            index.append({"id": sid, "descriptor": payload["descriptor"],
                          "natoms": len(cart), "name": pretty_name(group, rel),
                          "group": GROUPS[group]})
            print(f"  -> BNE/n = {desc:.4f}   ({time.time()-t0:.0f}s)\n", flush=True)
    if index:
        path = os.path.join(OUT, "index.js")
        prev = []
        if os.path.exists(path):
            txt = open(path).read()
            prev = json.loads(txt[txt.index("=") + 1:].rstrip().rstrip(";"))
        by = {d["id"]: d for d in prev}
        for d in index:
            by[d["id"]] = d
        merged = sorted(by.values(), key=lambda d: d["id"])
        with open(path, "w") as f:
            f.write("window.__BNE_INDEX = " + json.dumps(merged, separators=(",", ":")) + ";")
        print(f"{len(index)} sidecars written; index has {len(merged)}")


if __name__ == "__main__":
    main(sys.argv[1:] or None)
