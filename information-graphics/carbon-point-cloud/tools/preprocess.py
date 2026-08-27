#!/usr/bin/env python3
"""Parse POSCAR carbon structures -> per-structure JS payloads for the D3 point cloud.

For each structure:
  - Cartesian positions (atoms wrapped into the home cell)
  - CN at 1.8 A computed with full periodic minimum image
  - bond list: intra-box pairs only (wrapping bonds omitted, like the reference viz)
  - shortest-path (Franzblau) rings of size 3-10 on the full periodic bond graph;
    ring counts per size cover all rings, drawn polygons only the intra-box ones
"""
import json, os, re, sys
from collections import deque, defaultdict
import numpy as np

# Paths resolve relative to this script so the pipeline runs from a checkout
# anywhere. Layouts supported: data/ as a sibling of tools/ (the public repo),
# or two levels up (the viz_experiments working tree). Override with POSCAR_DATA.
HERE = os.path.dirname(os.path.abspath(__file__))

def _find_data():
    if os.environ.get("POSCAR_DATA"):
        return os.environ["POSCAR_DATA"]
    for rel in ("../data", "../../data"):
        p = os.path.normpath(os.path.join(HERE, rel))
        if os.path.isdir(p):
            return p
    sys.exit("No data/ directory found next to (or above) tools/; "
             "set POSCAR_DATA to the folder holding the POSCAR tree.")

ROOT = _find_data()
OUT = os.path.normpath(os.path.join(HERE, "..", "structures"))
CUTOFF = 1.8
MAX_RING = 10
RDF_DR = 0.05
RDF_RMAX = 10.0

GROUPS = {
    "amorphous_carbon": "Amorphous Carbon",
    "carbide_derived_carbon": "Carbide-Derived Carbon",
    "irradiated_graphite": "Irradiated Graphite",
    "phase_separated_phase": "Phase-Separated Phase",
    "variable_porosity_carbon": "Variable-Porosity Carbon",
}

def pretty_name(group, rel):
    parts = rel.split("/")
    leaf = parts[-1]
    m = re.match(r"density_(\d+)d(\d+)_(\d+)$", leaf)
    if m:
        dens = f"{m.group(1)}.{m.group(2)}"
        base = {"amorphous_carbon": "AC"}.get(group)
        if group == "variable_porosity_carbon":
            base = "VPC(D)"
        return f"{base or leaf} ρ≈{dens} g/cm³ · {m.group(3)} atoms"
    m = re.match(r"density_(\d+)d(\d+)_model_(\d+)$", leaf)
    if m:
        return f"VPC(D) {m.group(1)}.{m.group(2)} model {m.group(3)}"
    m = re.match(r"irg_t(\d+)_(\d+)$", leaf)
    if m:
        return f"IRG T{m.group(1)} · {m.group(2)} atoms"
    if leaf == "psp":
        return "PSP"
    if leaf == "vpc_t_1d5":
        return "VPC(T) 1.5"
    if leaf.startswith("ann-"):
        return "annealed " + leaf[4:].upper()
    return leaf.upper() if leaf.startswith("cdc") else leaf

def parse_poscar(path):
    with open(path) as f:
        lines = [l.strip() for l in f]
    scale = float(lines[1])
    lat = np.array([[float(x) for x in lines[i].split()] for i in (2, 3, 4)]) * scale
    n = sum(int(x) for x in lines[6].split())
    mode = lines[7].lower()
    coords = np.array([[float(x) for x in lines[8 + i].split()[:3]] for i in range(n)])
    frac = coords if mode.startswith("d") else coords @ np.linalg.inv(lat)
    frac %= 1.0
    return lat, frac

def neighbors(lat, frac, cutoff):
    """CN + intra-box bond list + periodic quotient-graph adjacency."""
    n = len(frac)
    cart = frac @ lat
    shifts = np.array([[i, j, k] for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1)])
    cn = np.zeros(n, dtype=int)
    bonds = []
    adj = [set() for _ in range(n)]
    c2 = cutoff * cutoff
    img_cart = (frac[None, :, :] + shifts[:, None, :]).reshape(-1, 3) @ lat
    cell = cutoff
    keys = np.floor(img_cart / cell).astype(np.int64)
    grid = defaultdict(list)
    for m, k in enumerate(map(tuple, keys)):
        grid[k].append(m)
    home_keys = np.floor(cart / cell).astype(np.int64)
    offs = [(a, b, c) for a in (-1, 0, 1) for b in (-1, 0, 1) for c in (-1, 0, 1)]
    home_offset = 13 * n
    for i in range(n):
        hk = home_keys[i]
        cand = []
        for o in offs:
            cand.extend(grid.get((hk[0] + o[0], hk[1] + o[1], hk[2] + o[2]), []))
        cand = np.array(cand, dtype=np.int64)
        d = img_cart[cand] - cart[i]
        dist2 = np.einsum("ij,ij->i", d, d)
        hit = cand[(dist2 < c2) & (dist2 > 1e-8)]
        cn[i] = len(hit)
        for m in hit:
            j = int(m % n)
            if j != i:
                adj[i].add(j)
            if home_offset <= m < home_offset + n and j > i:
                bonds.append((i, j))
    return cn, bonds, cart, [sorted(a) for a in adj]

def compute_rdf(lat, frac, dr=RDF_DR):
    """g(r) with periodic images, valid out to min(RDF_RMAX, half the thinnest cell width)."""
    n = len(frac)
    vol = abs(np.linalg.det(lat))
    # perpendicular widths of the (possibly triclinic) cell
    widths = [vol / np.linalg.norm(np.cross(lat[(k+1) % 3], lat[(k+2) % 3])) for k in range(3)]
    rmax = min(RDF_RMAX, 0.49 * min(widths))
    nbins = int(rmax / dr)
    rmax = nbins * dr
    cart = frac @ lat
    shifts = np.array([[i, j, k] for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1)])
    img_cart = (frac[None, :, :] + shifts[:, None, :]).reshape(-1, 3) @ lat
    cell = rmax
    keys = np.floor(img_cart / cell).astype(np.int64)
    grid = defaultdict(list)
    for m, k in enumerate(map(tuple, keys)):
        grid[k].append(m)
    home_keys = np.floor(cart / cell).astype(np.int64)
    offs = [(a, b, c) for a in (-1, 0, 1) for b in (-1, 0, 1) for c in (-1, 0, 1)]
    counts = np.zeros(nbins, dtype=np.int64)
    r2max = rmax * rmax
    for i in range(n):
        hk = home_keys[i]
        cand = []
        for o in offs:
            cand.extend(grid.get((hk[0] + o[0], hk[1] + o[1], hk[2] + o[2]), []))
        d = img_cart[np.array(cand, dtype=np.int64)] - cart[i]
        dist2 = np.einsum("ij,ij->i", d, d)
        dist2 = dist2[(dist2 > 1e-8) & (dist2 < r2max)]
        counts += np.histogram(np.sqrt(dist2), bins=nbins, range=(0.0, rmax))[0]
    rho = n / vol
    rc = (np.arange(nbins) + 0.5) * dr
    g = counts / (n * rho * 4 * np.pi * rc**2 * dr)
    return {"dr": dr, "rmax": round(rmax, 3), "g": [round(float(v), 3) for v in g]}

def find_rings(adj, n, maxsize=MAX_RING):
    """Shortest-path (Franzblau) rings on the quotient graph, size 3..maxsize.

    Candidates: for each bond, every shortest i->j path avoiding the bond itself.
    Filter: keep only rings with no shortcut (graph distance between any two ring
    atoms equals their distance along the ring).
    """
    maxlen = maxsize - 1
    candidates = {}  # frozenset(atoms) -> ordered tuple
    for i in range(n):
        for j in adj[i]:
            if j <= i:
                continue
            dist = {i: 0}
            parents = {i: []}
            dq = deque([i])
            dj = None
            while dq:
                u = dq.popleft()
                du = dist[u]
                if du >= (dj if dj is not None else maxlen):
                    continue
                for v in adj[u]:
                    if u == i and v == j:
                        continue
                    nd = du + 1
                    if v not in dist:
                        if dj is None or nd <= dj:
                            dist[v] = nd
                            parents[v] = [u]
                            dq.append(v)
                            if v == j:
                                dj = nd
                    elif dist[v] == nd and v != i:
                        parents[v].append(u)
            if dj is None:
                continue
            stack = [(j, (j,))]
            found = 0
            while stack and found < 64:
                u, p = stack.pop()
                if u == i:
                    if len(set(p)) == len(p):
                        candidates.setdefault(frozenset(p), p)
                        found += 1
                    continue
                for w in parents[u]:
                    stack.append((w, p + (w,)))
    # shortcut filter
    rings = []
    for atoms, ordered in candidates.items():
        k = len(ordered)
        if k < 3:
            continue
        idx = {a: t for t, a in enumerate(ordered)}
        ok = True
        # BFS from each ring atom, capped at k//2, compare to ring distance
        for a in ordered:
            seen = {a: 0}
            dq = deque([a])
            while dq and ok:
                u = dq.popleft()
                du = seen[u]
                if du >= k // 2:
                    continue
                for v in adj[u]:
                    if v not in seen:
                        seen[v] = du + 1
                        dq.append(v)
                        if v in idx:
                            t = abs(idx[v] - idx[a])
                            dring = min(t, k - t)
                            if seen[v] < dring:
                                ok = False
                                break
            if not ok:
                break
        if ok:
            rings.append(ordered)
    return rings

def main(only=None):
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    c2 = CUTOFF * CUTOFF
    for group in sorted(GROUPS):
        gdir = os.path.join(ROOT, group)
        for dirpath, _, files in sorted(os.walk(gdir)):
            if "POSCAR" not in files:
                continue
            rel = os.path.relpath(dirpath, gdir)
            sid = (group + "__" + rel.replace("/", "_")).replace("-", "_")
            if only and not any(o in sid for o in only):
                continue
            lat, frac = parse_poscar(os.path.join(dirpath, "POSCAR"))
            cn, bonds, cart, adj = neighbors(lat, frac, CUTOFF)
            rings = find_rings(adj, len(cart))
            ring_counts = defaultdict(int)
            drawable = []
            atom_rings = [[] for _ in range(len(cart))]
            for r in rings:
                ring_counts[len(r)] += 1
                for a in r:
                    atom_rings[a].append(len(r))
                pts = cart[list(r)]
                d = pts - np.roll(pts, -1, axis=0)
                if (np.einsum("ij,ij->i", d, d) < c2).all():
                    drawable.append(list(map(int, r)))
            payload = {
                "id": sid,
                "name": pretty_name(group, rel),
                "group": GROUPS[group],
                "natoms": len(cart),
                "nbonds": len(bonds),
                "lattice": [[round(v, 4) for v in row] for row in lat],
                "pos": [round(v, 3) for v in cart.ravel()],
                "cn": cn.tolist(),
                "bonds": [v for b in bonds for v in b],
                "rings": drawable,
                "ringCounts": {str(k): ring_counts[k] for k in sorted(ring_counts)},
                "rdf": compute_rdf(lat, frac),
                "atomRings": [sorted(a) for a in atom_rings],
            }
            js = "window.__STRUCT_CB(" + json.dumps(payload, separators=(",", ":")) + ");"
            with open(os.path.join(OUT, sid + ".js"), "w") as f:
                f.write(js)
            manifest.append({
                "id": sid, "name": payload["name"], "group": payload["group"],
                "natoms": payload["natoms"], "nbonds": payload["nbonds"],
            })
            rc = ", ".join(f"{k}:{v}" for k, v in sorted(ring_counts.items()))
            print(f"{sid}: {len(cart)} atoms, {len(bonds)} bonds, rings {{{rc}}} ({len(drawable)} drawable)", flush=True)
    # merge into any existing manifest so single-structure runs don't clobber it
    path = os.path.join(OUT, "manifest.js")
    prev = []
    if os.path.exists(path):
        txt = open(path).read()
        prev = json.loads(txt[txt.index("=") + 1:].rstrip().rstrip(";"))
    by = {d["id"]: d for d in prev}
    for d in manifest:
        by[d["id"]] = d
    merged = sorted(by.values(), key=lambda d: d["id"])
    with open(path, "w") as f:
        f.write("window.__MANIFEST = " + json.dumps(merged, separators=(",", ":")) + ";")
    print(f"{len(manifest)} structures written to {OUT}; manifest has {len(merged)}")

if __name__ == "__main__":
    main(sys.argv[1:] or None)
