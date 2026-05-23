#!/usr/bin/env python3
"""
RIASEC Letter Screenshot → SVG Converter

Converts screenshot images of constructed Renaissance/Lombardic capital letters
into clean, layered SVG files. Separates the letter forms from the construction
grid (guidelines, circles, cross markers) into distinct SVG groups.

Requirements (all pre-installed):
  - Python 3, OpenCV, NumPy, Pillow
  - potrace (command-line, via Homebrew)

Usage:
  python3 convert_to_svg.py
  python3 convert_to_svg.py --input-dir ./riasec\ letters --threshold-letter 120 --adaptive-c 18
  python3 convert_to_svg.py --help
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# Image pre-processing helpers
# ---------------------------------------------------------------------------

def load_and_crop(img_path):
    """Load an image and auto-crop away uniform border padding."""
    img = cv2.imread(str(img_path))
    if img is None:
        raise ValueError(f"Could not load image: {img_path}")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Auto-crop: find bounding box of content that differs from the border
    # Sample border colour from corners
    border_val = int(np.median([gray[0, 0], gray[0, -1], gray[-1, 0], gray[-1, -1]]))
    mask = np.abs(gray.astype(int) - border_val) > 25
    coords = np.column_stack(np.where(mask))
    if coords.size == 0:
        return img, gray  # nothing to crop

    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0)
    pad = 10  # keep a small margin
    y0 = max(0, y0 - pad)
    x0 = max(0, x0 - pad)
    y1 = min(gray.shape[0], y1 + pad)
    x1 = min(gray.shape[1], x1 + pad)

    return img[y0:y1, x0:x1], gray[y0:y1, x0:x1]


def threshold_global(gray, thresh_value):
    """Global binary threshold (good for very dark features like letter strokes)."""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, mask = cv2.threshold(blurred, thresh_value, 255, cv2.THRESH_BINARY_INV)
    return mask


def threshold_adaptive(gray, block_size=51, C=18):
    """
    Adaptive Gaussian threshold — normalises for uneven background brightness.
    This is critical for the parchment images where one side may be darker.
    Returns mask with 255 = foreground (dark marks).
    """
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    mask = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        block_size,  # neighbourhood size (must be odd)
        C,           # constant subtracted from mean — higher = stricter
    )
    return mask


def remove_large_components(mask, max_area_fraction=0.02):
    """
    Remove connected components larger than max_area_fraction of total image area.
    Grid lines are thin → small area.  Background blobs are huge → removed.
    """
    total_area = mask.shape[0] * mask.shape[1]
    max_area = total_area * max_area_fraction

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    clean = np.zeros_like(mask)
    for i in range(1, num_labels):  # skip label 0 (background)
        area = stats[i, cv2.CC_STAT_AREA]
        if area <= max_area:
            clean[labels == i] = 255
    return clean


def extract_letter_mask(gray, thresh=110, open_ksize=5, open_iter=2):
    """
    Isolate the thick letter strokes.

    Strategy: aggressive global threshold (captures only the darkest ink) followed
    by morphological opening to strip away thin grid lines that sneak through.
    Global threshold works here because the letter ink is much darker than even
    the darkest parchment variation.
    """
    mask = threshold_global(gray, thresh)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_ksize, open_ksize))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=open_iter)
    # Close small internal holes
    k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k_close, iterations=1)
    return mask


def extract_grid_mask(gray, letter_mask, adaptive_C=15, dilate_iter=3):
    """
    Isolate grid lines, circles, and cross markers (everything except the letter).

    Strategy:
      1. Adaptive threshold to capture thin dark marks while ignoring the uneven
         parchment background (this was the root cause of the black blotches —
         global thresholding picked up background gradients as foreground).
      2. Subtract a dilated version of the letter mask.
      3. Remove any remaining large connected components — grid features are thin
         and never form blobs larger than ~2% of the image area.
    """
    full = threshold_adaptive(gray, block_size=51, C=adaptive_C)

    # Dilate the letter mask so subtraction cleanly removes letter + its fringe
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    letter_fat = cv2.dilate(letter_mask, kernel, iterations=dilate_iter)
    grid = cv2.bitwise_and(full, cv2.bitwise_not(letter_fat))

    # Light morphological cleanup
    k_clean = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    grid = cv2.morphologyEx(grid, cv2.MORPH_OPEN, k_clean, iterations=1)

    # Remove any large blobs that survived — these are background artifacts
    grid = remove_large_components(grid, max_area_fraction=0.02)

    return grid


def extract_full_mask(gray, letter_mask, adaptive_C=15):
    """
    Capture everything dark (letter + grid combined).
    Uses adaptive threshold for the grid portion, then unions with the letter mask.
    """
    grid_part = threshold_adaptive(gray, block_size=51, C=adaptive_C)
    # Clean the adaptive result of background noise
    k_clean = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    grid_part = cv2.morphologyEx(grid_part, cv2.MORPH_OPEN, k_clean, iterations=1)
    grid_part = remove_large_components(grid_part, max_area_fraction=0.02)
    # Union: letter (already clean) + cleaned grid features
    full = cv2.bitwise_or(letter_mask, grid_part)
    return full


# ---------------------------------------------------------------------------
# Potrace interface
# ---------------------------------------------------------------------------

def mask_to_bmp(mask, bmp_path):
    """
    Save a foreground mask (255=ink) as a BMP that potrace will trace.
    Potrace traces *black* pixels, so we invert: ink→black(0), bg→white(255).
    """
    cv2.imwrite(str(bmp_path), 255 - mask)


def run_potrace(bmp_path, svg_path, turdsize=5, alphamax=1.0, opttolerance=0.2):
    """Invoke potrace to convert a BMP to SVG."""
    cmd = [
        "potrace",
        "-s",                       # SVG output
        "-t", str(turdsize),        # speckle suppression size
        "-a", str(alphamax),        # corner smoothness (0=sharp, 1.334=round)
        "-O", str(opttolerance),    # curve optimisation tolerance
        "-o", str(svg_path),
        str(bmp_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  [!] potrace error: {result.stderr.strip()}", file=sys.stderr)
        return False
    return True


# ---------------------------------------------------------------------------
# SVG assembly
# ---------------------------------------------------------------------------

def extract_svg_body(svg_text):
    """Return the inner content of a potrace SVG (everything inside <svg>…</svg>)."""
    body = re.sub(r"<\?xml[^?]*\?>", "", svg_text)
    body = re.sub(r"<!DOCTYPE[^>]*>", "", body)
    body = re.sub(r"<metadata>.*?</metadata>", "", body, flags=re.DOTALL)
    # Grab content between <svg …> and </svg>
    m = re.search(r"<svg[^>]*>(.*)</svg>", body, re.DOTALL)
    return m.group(1).strip() if m else body.strip()


def parse_svg_dims(svg_text):
    """Pull width/height (in pt) from potrace SVG."""
    w = re.search(r'width="([^"]+)"', svg_text)
    h = re.search(r'height="([^"]+)"', svg_text)
    w_val = w.group(1) if w else "500pt"
    h_val = h.group(1) if h else "500pt"
    # Strip units for viewBox
    w_num = re.sub(r"[a-zA-Z]+", "", w_val)
    h_num = re.sub(r"[a-zA-Z]+", "", h_val)
    return w_val, h_val, w_num, h_num


def build_combined_svg(letter_svg_path, grid_svg_path, letter_name):
    """Merge letter + grid SVGs into a single file with two <g> layers."""
    with open(letter_svg_path) as f:
        letter_raw = f.read()
    with open(grid_svg_path) as f:
        grid_raw = f.read()

    w, h, wn, hn = parse_svg_dims(letter_raw)
    letter_body = extract_svg_body(letter_raw)
    grid_body = extract_svg_body(grid_raw)

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="{w}" height="{h}"
     viewBox="0 0 {wn} {hn}">
  <title>RIASEC Letter {letter_name} — Lombardic Construction</title>

  <!-- Construction grid: guidelines, circles, cross markers -->
  <g id="grid" fill="#7a6648" fill-opacity="0.55" fill-rule="evenodd">
{_indent(grid_body, 4)}
  </g>

  <!-- Letter form -->
  <g id="letter" fill="#2c1810" fill-rule="evenodd">
{_indent(letter_body, 4)}
  </g>
</svg>
"""


def build_standalone_svg(raw_svg_path, letter_name, layer_label, fill="#2c1810"):
    """Wrap a single potrace SVG in a cleaner shell."""
    with open(raw_svg_path) as f:
        raw = f.read()

    w, h, wn, hn = parse_svg_dims(raw)
    body = extract_svg_body(raw)

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="{w}" height="{h}"
     viewBox="0 0 {wn} {hn}">
  <title>RIASEC Letter {letter_name} — {layer_label}</title>
  <g id="{layer_label.lower().replace(' ', '-')}" fill="{fill}" fill-rule="evenodd">
{_indent(body, 4)}
  </g>
</svg>
"""


def _indent(text, spaces):
    pad = " " * spaces
    return "\n".join(pad + line for line in text.splitlines())


# ---------------------------------------------------------------------------
# Per-letter pipeline
# ---------------------------------------------------------------------------

def process_letter(img_path, output_dir, letter_name, args):
    """Full pipeline for one letter image."""
    print(f"\n{'─'*50}")
    print(f"  Letter: {letter_name}   ({img_path.name})")
    print(f"{'─'*50}")

    img, gray = load_and_crop(img_path)
    h, w = gray.shape
    print(f"  Image size (after crop): {w} × {h}")

    # --- masks ---
    print("  Extracting letter mask …")
    letter_mask = extract_letter_mask(gray, thresh=args.threshold_letter)

    print("  Extracting grid mask (adaptive threshold) …")
    grid_mask = extract_grid_mask(gray, letter_mask, adaptive_C=args.adaptive_c)

    print("  Extracting full mask …")
    full_mask = extract_full_mask(gray, letter_mask, adaptive_C=args.adaptive_c)

    with tempfile.TemporaryDirectory() as tmp:
        # --- save BMPs ---
        letter_bmp = os.path.join(tmp, "letter.bmp")
        grid_bmp   = os.path.join(tmp, "grid.bmp")
        full_bmp   = os.path.join(tmp, "full.bmp")
        mask_to_bmp(letter_mask, letter_bmp)
        mask_to_bmp(grid_mask, grid_bmp)
        mask_to_bmp(full_mask, full_bmp)

        # --- potrace ---
        letter_svg_tmp = os.path.join(tmp, "letter.svg")
        grid_svg_tmp   = os.path.join(tmp, "grid.svg")
        full_svg_tmp   = os.path.join(tmp, "full.svg")

        print("  Tracing letter form …")
        run_potrace(letter_bmp, letter_svg_tmp, turdsize=15, alphamax=1.1, opttolerance=0.2)

        print("  Tracing grid lines …")
        run_potrace(grid_bmp, grid_svg_tmp, turdsize=3, alphamax=0.6, opttolerance=0.3)

        print("  Tracing full image …")
        run_potrace(full_bmp, full_svg_tmp, turdsize=5, alphamax=1.0, opttolerance=0.2)

        # --- assemble output ---
        # 1. Combined layered SVG
        combined_path = output_dir / f"{letter_name}_combined.svg"
        combined_svg = build_combined_svg(letter_svg_tmp, grid_svg_tmp, letter_name)
        with open(combined_path, "w") as f:
            f.write(combined_svg)
        print(f"  ✓ {combined_path.name}")

        # 2. Letter-only SVG
        letter_path = output_dir / f"{letter_name}_letter.svg"
        letter_svg = build_standalone_svg(letter_svg_tmp, letter_name, "Letter", fill="#2c1810")
        with open(letter_path, "w") as f:
            f.write(letter_svg)
        print(f"  ✓ {letter_path.name}")

        # 3. Grid-only SVG
        grid_path = output_dir / f"{letter_name}_grid.svg"
        grid_svg = build_standalone_svg(grid_svg_tmp, letter_name, "Grid", fill="#7a6648")
        with open(grid_path, "w") as f:
            f.write(grid_svg)
        print(f"  ✓ {grid_path.name}")

        # 4. Full SVG (everything combined in a single path)
        full_path = output_dir / f"{letter_name}_full.svg"
        full_svg = build_standalone_svg(full_svg_tmp, letter_name, "Full", fill="#2c1810")
        with open(full_path, "w") as f:
            f.write(full_svg)
        print(f"  ✓ {full_path.name}")

        # 5. Debug masks
        if args.debug:
            debug_dir = output_dir / "debug"
            debug_dir.mkdir(exist_ok=True)
            cv2.imwrite(str(debug_dir / f"{letter_name}_letter_mask.png"), letter_mask)
            cv2.imwrite(str(debug_dir / f"{letter_name}_grid_mask.png"), grid_mask)
            cv2.imwrite(str(debug_dir / f"{letter_name}_full_mask.png"), full_mask)
            print(f"  ✓ debug masks saved")

    return combined_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Convert RIASEC letter screenshots to layered SVG files."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=Path(__file__).parent,
        help="Directory containing the screenshot PNGs (default: script directory)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory (default: <input-dir>/svg_output)",
    )
    parser.add_argument(
        "--threshold-letter",
        type=int,
        default=110,
        help="Grayscale threshold for letter extraction (0-255, lower = stricter). Default 110.",
    )
    parser.add_argument(
        "--adaptive-c",
        type=int,
        default=15,
        help="Adaptive threshold sensitivity (higher = stricter, less noise). Default 15.",
    )
    parser.add_argument(
        "--letters",
        type=str,
        default="R,I,A,S,E,C",
        help='Comma-separated letter names in screenshot timestamp order. Default "R,I,A,S,E,C".',
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Save intermediate mask PNGs for inspection.",
    )
    args = parser.parse_args()

    input_dir = args.input_dir.resolve()
    output_dir = (args.output_dir or input_dir / "svg_output").resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    screenshots = sorted(input_dir.glob("Screenshot*.png"))
    letter_names = [l.strip() for l in args.letters.split(",")]

    if not screenshots:
        print(f"No screenshots found in {input_dir}", file=sys.stderr)
        sys.exit(1)

    if len(screenshots) != len(letter_names):
        print(
            f"Found {len(screenshots)} screenshots but {len(letter_names)} letter names.\n"
            f"Adjust --letters to match. Screenshots (sorted by name):",
            file=sys.stderr,
        )
        for s in screenshots:
            print(f"  {s.name}", file=sys.stderr)
        sys.exit(1)

    print("=" * 56)
    print("  RIASEC Letter Screenshot → SVG Converter")
    print("=" * 56)
    print(f"  Input:  {input_dir}")
    print(f"  Output: {output_dir}")
    print(f"  Letters: {', '.join(letter_names)}")
    print(f"  Thresholds: letter={args.threshold_letter}, adaptive_C={args.adaptive_c}")

    results = []
    for img_path, letter in zip(screenshots, letter_names):
        r = process_letter(img_path, output_dir, letter, args)
        results.append(r)

    print(f"\n{'='*56}")
    print("  DONE — files written to:")
    print(f"  {output_dir}")
    print(f"{'='*56}")
    print()
    print("  Per letter:")
    print("    {X}_combined.svg — layered (letter + grid as <g> groups)")
    print("    {X}_letter.svg   — letter form only")
    print("    {X}_grid.svg     — grid/construction lines only")
    print("    {X}_full.svg     — everything as a single trace")
    if args.debug:
        print("    debug/{X}_*.png  — intermediate binary masks")
    print()
    print("  Tip: open the _combined.svg in a browser or Illustrator.")
    print("  The #grid and #letter groups can be styled independently")
    print("  via CSS (fill, stroke, opacity, etc.).")


if __name__ == "__main__":
    main()
