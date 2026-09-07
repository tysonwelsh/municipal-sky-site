#!/usr/bin/env python3
"""Measure a STABLE dominant pitch per window of a reel (plan §11).

Reads audio only — never writes or re-encodes a reel. Prints JSON:
  {"pitchHz": [f|null, ...], "tuned": bool, "detail": [...]}

A window gets a pitch only if it is actually PITCHED and STEADY: enough frames
must agree on one fundamental, and they must agree closely. A closedown march,
a test tone and a sung anthem pass; speech, applause and static do not, which
is the point — the receiver may only bend a reel that has something to bend.

Method: per frame, a normalised difference function (the YIN core) over the
plausible period range, absolute-threshold pick with parabolic interpolation.
Frames whose aperiodicity is above THRESH are discarded outright. What is left
must cover COVER of the window and lie within SPREAD cents of its own median,
after folding octave errors — YIN halves and doubles more than it mistunes, and
a window that is one note an octave apart from itself is still that note.
"""
import json, subprocess, sys
import numpy as np

SR       = 22050
FRAME    = 2048          # 93 ms — long enough for a 60 Hz period, short enough to see drift
HOP      = 512           # 23 ms
FMIN, FMAX = 55.0, 1400.0
THRESH   = 0.15          # YIN aperiodicity: below this a frame is voiced
COVER    = 0.45          # at least this share of frames must be voiced
SPREAD   = 45.0          # and the middle 80 % of them within this many cents
AGREE    = 0.30          # cover x strength — the share of the window that is ONE pitch. Set from the pool, not guessed: over 342 windows the voice bucket reads p90 0.183 and the tone bucket p75 0.669, so 0.30 sits near voice p96 and well under tone p75 — it keeps a third of the tone windows and admits 4 % of the voice ones, and those are voice windows that really do hold one pitch for a third of their length.


def decode(path, t0, t1):
    out = subprocess.run(
        ["ffmpeg", "-v", "error", "-nostdin", "-ss", f"{t0:.3f}", "-t", f"{max(0.05, t1 - t0):.3f}",
         "-i", path, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    return np.frombuffer(out.stdout, dtype="<f4").astype(np.float64)


def yin_frame(x):
    """→ (f0, aperiodicity) for one frame, or (None, 1.0)."""
    n = len(x)
    tau_max = min(n // 2, int(SR / FMIN))
    tau_min = max(2, int(SR / FMAX))
    if tau_max <= tau_min + 2:
        return None, 1.0
    # difference function via autocorrelation (Wiener–Khinchin)
    p2 = 1 << (2 * n - 1).bit_length()
    f = np.fft.rfft(x, p2)
    ac = np.fft.irfft(f * np.conj(f), p2)[:tau_max + 1]
    pw = np.concatenate(([0.0], np.cumsum(x * x)))
    d = np.empty(tau_max + 1)
    for tau in range(tau_max + 1):
        d[tau] = (pw[n] - pw[tau]) + (pw[n - tau]) - 2 * ac[tau]
    # cumulative mean normalised difference
    d[0] = 1.0
    csum = np.cumsum(d[1:])
    idx = np.arange(1, tau_max + 1)
    dn = np.empty_like(d)
    dn[0] = 1.0
    dn[1:] = d[1:] * idx / np.maximum(csum, 1e-12)
    # absolute threshold: the FIRST dip under THRESH, else the global minimum
    cand = np.where(dn[tau_min:tau_max] < THRESH)[0]
    if len(cand):
        tau = tau_min + int(cand[0])
        while tau + 1 < tau_max and dn[tau + 1] < dn[tau]:
            tau += 1
    else:
        tau = tau_min + int(np.argmin(dn[tau_min:tau_max]))
    if not (tau_min < tau < tau_max - 1):
        return None, 1.0
    a, b, c = dn[tau - 1], dn[tau], dn[tau + 1]
    denom = a - 2 * b + c
    shift = 0.5 * (a - c) / denom if abs(denom) > 1e-12 else 0.0
    return SR / (tau + shift), float(b)


def fold_octaves(f, ref):
    """Pull f to within a tritone of ref by octaves — YIN's error is octaves."""
    while f < ref / 1.4142:
        f *= 2
    while f > ref * 1.4142:
        f /= 2
    return f


def window_pitch(path, t0, t1):
    x = decode(path, t0, t1)
    if len(x) < FRAME * 4:
        return None, {"why": "too short", "n": len(x)}
    rms = float(np.sqrt(np.mean(x * x)))
    if rms < 1e-4:
        return None, {"why": "silent", "rms": rms}
    f0s, nframes = [], 0
    for i in range(0, len(x) - FRAME, HOP):
        fr = x[i:i + FRAME]
        if np.sqrt(np.mean(fr * fr)) < rms * 0.25:      # skip the gaps between phrases
            continue
        nframes += 1
        f, ap = yin_frame(fr - fr.mean())
        if f is not None and ap < THRESH and FMIN <= f <= FMAX:
            f0s.append(f)
    if nframes == 0 or len(f0s) < 4:
        return None, {"why": "unvoiced", "voiced": len(f0s), "frames": nframes}
    cover = len(f0s) / nframes
    med = float(np.median(f0s))
    folded = np.array([fold_octaves(f, med) for f in f0s])
    med = float(np.median(folded))
    folded = np.array([fold_octaves(f, med) for f in folded])   # once more, around the better centre
    cents = 1200 * np.log2(folded / med)
    lo, hi = np.percentile(cents, [10, 90])
    spread = float(hi - lo)
    det = {"cover": round(cover, 3), "spread": round(spread, 1), "voiced": len(f0s), "frames": nframes,
           "hz": round(float(np.median(folded)), 2)}

    # NOT STEADY IS NOT UNTUNED. A closedown march and a music box are pitched
    # to the cent and still spread half an octave, because they play a TUNE:
    # measured on conet-swedish-rhapsody, three consecutive windows read a
    # spread of 512 cents and a median within 1 Hz of each other. The steady
    # test alone would throw all three away and leave the receiver with almost
    # nothing to tune to.
    #
    # So the second reading is the DOMINANT PITCH CLASS: every voiced frame
    # folded into one octave, a smoothed circular histogram over it, and the
    # peak taken as the window's pitch. A held tone gives a spike; a tune in a
    # key gives a peak at its centre; speech and applause give a flat circle
    # and are refused, which is the whole point of the test. `strength` is the
    # share of frames within a quartertone of the peak — a real number about
    # how much of the window agrees, not a yes.
    cq = np.mod(1200 * np.log2(np.array(folded) / med) + 600, 1200.0)
    hist = np.zeros(120)                                   # 10-cent bins
    np.add.at(hist, (cq / 10).astype(int) % 120, 1.0)
    k = np.arange(-4, 5)                                   # ±40 c triangular smoothing
    hist = sum(np.roll(hist, int(j)) * (1 - abs(j) / 5.0) for j in k)
    peak = int(np.argmax(hist))
    dist = np.abs(((cq - (peak * 10 + 5)) + 600) % 1200 - 600)
    strength = float(np.mean(dist <= 50))
    # AGREE — THE ONE NUMBER THE DECISION IS MADE ON. cover alone cannot
    # separate a pitch from speech: measured over the whole pool, the voice
    # bucket's cover runs p50 0.13 / p90 0.50 and the tone bucket's p50 0.37 /
    # p90 0.88, which overlap badly enough that any cover bar low enough to
    # admit a quiet held tone also admits a tenth of all speech — and bending
    # speech is the thing this flag exists to prevent. strength alone is no
    # better, because a window with four periodic frames can have all four
    # agree. Their PRODUCT is the share of the whole window that is one pitch,
    # which is the physical question, and it separates cleanly.
    agree = cover * strength
    det["strength"] = round(strength, 3); det["agree"] = round(agree, 3)
    det["kind"] = "steady" if spread <= SPREAD else "tonal"
    if agree < AGREE:
        det["why"] = "not one pitch"; return None, det
    if det["kind"] == "steady":
        return round(float(np.median(folded)), 2), det
    hz = med * 2 ** (((peak * 10 + 5) - 600) / 1200.0)
    det["hz"] = round(hz, 2)
    return round(hz, 2), det


def main():
    path, windows = sys.argv[1], json.loads(sys.argv[2])
    pitches, details = [], []
    for (a, b) in windows:
        f, det = window_pitch(path, float(a), float(b))
        pitches.append(f); details.append(det)
    n = sum(1 for p in pitches if p)
    # `tuned` MEANS "there is somewhere on this reel the receiver can land",
    # not "most of this reel is a tone". The per-window array already carries
    # the detail and the receiver reads it window by window, so a reel-level
    # flag that demanded half the windows would have hidden wwv (7 of 8) behind
    # the same wall as tvri (1 of 6) and left three usable reels in the whole
    # pool. One window is enough to tune to; the receiver simply has to pick it.
    print(json.dumps({"pitchHz": pitches, "tuned": n >= 1,
                      "detail": details}, ensure_ascii=False))


if __name__ == "__main__":
    main()
