# Carbon Point Cloud

An interactive dashboard for exploring atomistic models of disordered carbon:
27 structures in five classes, rendered as rotatable point clouds with linked
analysis panels — coordination numbers, ring statistics, bond lengths, the
radial distribution function, and the bond-network entropy of

> K. Iwanowski, G. Csányi, M. Simoncelli, *Bond-network entropy governs heat
> transport in coordination-disordered solids*,
> [Phys. Rev. X 15, 041041 (2025)](https://journals.aps.org/prx/abstract/10.1103/w4p6-b9mp)

Live at [municipalsky.com/information-graphics/carbon-structures](https://municipalsky.com/information-graphics/carbon-structures).

## Run it

No build step, no server, no dependencies. Clone (or download) this folder and
open `index.html` in a browser. `python3 -m http.server` works too if you
prefer a local server.

## What's in the folder

```
index.html          the entire viewer — rendering, panels, interactions (~2,000 lines)
d3.min.js           vendored D3 (ISC licence)
themes/             visual themes (palette + canvas render parameters per theme)
data/               the original structures: 27 POSCAR files from Materials Cloud
structures/         derived per-structure payloads: positions, bonds, CN, rings, g(r)
structures_bne/     derived bond-network-entropy sidecars: barcode classes + curves
tools/preprocess.py POSCAR → structures/*.js
tools/bne.py        POSCAR → structures_bne/*.js (drives the smooth-disorder package)
ADAPTING.md         how to adapt this dashboard to a different dataset
```

The `.js` files under `structures/` and `structures_bne/` are **data, not
code**: each holds one JSON payload wrapped in a `window.__STRUCT_CB(...)` /
`window.__BNE_CB(...)` call, so the viewer can load them with `<script>` tags
and keep working from `file://` where `fetch()` is blocked. Everything in them
is generated deterministically by the two tools from the POSCARs in `data/`.

## The pipeline

```
data/**/POSCAR ──▶ tools/preprocess.py ──▶ structures/*.js  + structures/manifest.js
       │
       └────────▶ tools/bne.py ─────────▶ structures_bne/*.js + structures_bne/index.js
                     │
                     └── calls github.com/MPA2suite/smooth-disorder
                         (the paper authors' reference implementation)
```

`preprocess.py` computes geometry: coordination at a 1.8 Å cutoff under the
periodic minimum image, intra-box bond lists, shortest-path (Franzblau) rings
of size 3–10, and g(r). `bne.py` computes the paper's disorder descriptor by
calling the authors' own package function-for-function: every atom's local
environment is classified by its H₁ barcode, BNE(n) is the Shannon entropy of
that classification, and the reported descriptor is the mean of BNE(n)/n over
n = 14–30. No sampling — every atom of every structure is catalogued.

### Regenerating

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install numpy scipy ase tqdm
git clone https://github.com/MPA2suite/smooth-disorder.git   # next to tools/

python3 tools/preprocess.py              # all structures, ~15 min
python3 tools/bne.py                     # all structures, ~1 h (results at commit ab2d3ea)
python3 tools/bne.py irg_t9_216          # one structure (substring match, merges into the index)
```

Both tools accept substring filters and merge single-structure runs into the
existing manifest/index. `data/` is found relative to `tools/` (override with
`POSCAR_DATA`); the smooth-disorder clone likewise (override with
`SMOOTH_DISORDER`).

**Verification anchor:** amorphous carbon at ρ≈2.9 g/cm³, 8,000 atoms must
give a growth-rate descriptor of **0.2399**, matching the paper's Fig. 2(c)
value of ≈0.24. If it doesn't, something drifted.

## Data provenance and required citations

The structures in `data/` are the atomistic models of
[Materials Cloud record 10.24435/materialscloud:72-g4](https://archive.materialscloud.org/records/sa1j2-mpf49)
(CC-BY-NC 4.0), relaxed with the GAP potential. If they help your research,
cite the paper above; additionally, per the dataset's `data/README.txt`:

- carbide-derived carbon structures — Palmer *et al.*, Carbon **48**, 1116 (2010)
- irradiated graphite structures — Farbos *et al.*, Carbon **120**, 111 (2017)

## Adapting this to another dataset

That's what `ADAPTING.md` is for — a self-contained brief on the architecture,
data contracts, design system, and interaction grammar, written so it can be
handed (together with this folder) to a collaborator or an AI assistant to
build a sibling dashboard for a different dataset.

## Licences

- Viewer (`index.html`, `themes/`) and tools (`tools/`): MIT, © 2026 Tyson Welsh.
- `d3.min.js`: ISC, © Mike Bostock.
- `data/` and the derived `structures*/` payloads: CC-BY-NC 4.0
  (Iwanowski, Csányi & Simoncelli via Materials Cloud) — attribution required,
  non-commercial use only.
- smooth-disorder is **not** included (Academic Software Licence); clone it
  from [MPA2suite/smooth-disorder](https://github.com/MPA2suite/smooth-disorder)
  for regeneration only.
