#!/usr/bin/env python3
"""Propose reel windows from an ffmpeg analysis log.

Used by make-reel.sh. Reads the stderr of one ffmpeg analysis pass that ran
   [video] scale, select='gt(scene,0.35)' + showinfo, blackdetect
   [audio] ebur128 (momentary loudness every 100 ms)
and picks N non-overlapping windows of L seconds spread across the source,
avoiding silence (< -40 LUFS mean) and black picture, never inside the
first/last 3 s. Prints JSON: {"windows": [[s,e],...], "candidates": K, ...}

  reel-propose.py <analysis.log> <duration> <window-len> <max-windows> [--audio-only]
"""
import json, re, sys

def main():
    log, dur, L, N = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4])
    audio_only = "--audio-only" in sys.argv[5:]
    text = open(log, errors="replace").read()

    # scdet (threshold 14 ≈ select scene>0.35) passes every frame, so the analysis stream never
    # comes up empty on a source with no hard cuts; older cached logs used select+showinfo.
    scenes = [float(m) for m in re.findall(r"lavfi\.scd\.time:\s*([\d.]+)", text)]
    if not scenes:
        scenes = [float(m) for m in re.findall(r"showinfo.*?pts_time:\s*([\d.]+)", text)]
    blacks = [(float(a), float(b)) for a, b in
              re.findall(r"black_start:\s*([\d.]+)\s+black_end:\s*([\d.]+)", text)]
    loud = []
    for t, m in re.findall(r"ebur128.*?\bt:\s*([\d.]+).*?\bM:\s*(-?[\d.]+)", text):
        t, m = float(t), float(m)
        loud.append((t, max(m, -70.0)))   # -120.7 is ebur128's "digital silence"
    has_loud = len(loud) > 5

    # ---- helpers over the 100 ms loudness series ------------------------
    def loud_stats(s, e):
        vals = [m for t, m in loud if s <= t < e]
        if not vals:
            return -70.0, 1.0
        mean = sum(vals) / len(vals)
        silent = sum(1 for v in vals if v < -50) / len(vals)
        return mean, silent

    def black_frac(s, e):
        tot = 0.0
        for a, b in blacks:
            lo, hi = max(a, s), min(b, e)
            if hi > lo:
                tot += hi - lo
        return tot / max(e - s, 1e-6)

    edge = 3.0
    lo_t, hi_t = edge, dur - edge
    if hi_t - lo_t < 1.0:
        print(json.dumps({"windows": [[0.0, dur]], "candidates": 0, "note": "source too short"}))
        return
    if hi_t - lo_t <= L:
        print(json.dumps({"windows": [[lo_t, hi_t]], "candidates": 1, "note": "one window only"}))
        return

    # ---- candidates: scene cuts + a grid ---------------------------------
    starts = set()
    if not audio_only:
        for s in scenes:
            starts.add(round(s, 2))
    grid = 1.0 if audio_only else 2.0
    t = lo_t
    while t + L <= hi_t:
        starts.add(round(t, 2))
        t += grid
    starts = sorted(s for s in starts if s >= lo_t and s + L <= hi_t)

    cands = []
    rejected = {"quiet": 0, "black": 0}
    for s in starts:
        e = s + L
        mean, silent = loud_stats(s, e) if has_loud else (-20.0, 0.0)
        if has_loud and mean < -40.0:
            rejected["quiet"] += 1
            continue
        bf = black_frac(s, e)
        if bf > 0.25:
            rejected["black"] += 1
            continue
        cuts = sum(1 for c in scenes if s < c < e)
        score = mean - 10.0 * silent - 20.0 * bf + 1.5 * min(cuts, 3)
        if s in {round(x, 2) for x in scenes}:
            score += 1.0      # starting on a cut reads as "tuning in" mid-shot
        cands.append((score, s, e))

    if not cands:
        # Nothing passed the gates; fall back to an even spread and say so.
        n = max(1, min(N, int((hi_t - lo_t) // L)))
        step = (hi_t - lo_t - L) / max(n - 1, 1)
        wins = [[round(lo_t + i * step, 2), round(lo_t + i * step + L, 2)] for i in range(n)]
        print(json.dumps({"windows": wins, "candidates": 0, "rejected": rejected,
                          "note": "no candidate passed the loudness/black gates; even spread used"}))
        return

    # ---- pick: best per segment, then fill -------------------------------
    gap = 2.0
    chosen = []

    def overlaps(s, e):
        return any(not (e + gap <= cs or s >= ce + gap) for cs, ce in chosen)

    n_target = max(1, min(N, int((hi_t - lo_t) // (L + gap))))
    seg = (hi_t - lo_t) / n_target
    for i in range(n_target):
        a, b = lo_t + i * seg, lo_t + (i + 1) * seg
        best = None
        for sc, s, e in cands:
            if a <= s < b and not overlaps(s, e):
                if best is None or sc > best[0]:
                    best = (sc, s, e)
        if best:
            chosen.append((best[1], best[2]))
    for sc, s, e in sorted(cands, reverse=True):
        if len(chosen) >= n_target:
            break
        if not overlaps(s, e):
            chosen.append((s, e))
    chosen.sort()
    out = {"windows": [[round(s, 2), round(e, 2)] for s, e in chosen],
           "candidates": len(cands), "scenes": len(scenes), "rejected": rejected,
           "loudness": has_loud}
    print(json.dumps(out))

if __name__ == "__main__":
    main()
