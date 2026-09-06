# ZANKYŌ rooms — real impulse responses

Two measured spaces, decoded by `PJ2.Voice.reverb` (`irUrl`) and crossfaded
per scene by `PJ2.Fx.roomBlend` (ZANKYŌ 2, Phase 1). If a file fails to
load or decode the engine falls back to a generated pour, so the station
never loses its room to a network hiccup.

| file | role | space | source |
|---|---|---|---|
| `hull-r1-reactor-hall.wav` | **the hull** — wide room (jo, release, the bell) | R1 experimental reactor hall, KTH Stockholm: a vast void 25 m underground, reactor decommissioned 1970 | `../prosperos-jukebox-v2/ir/r1-nuclear-reactor-hall/r1_ortf-48k.wav` (stereo ORTF, 48 kHz / 24-bit) |
| `corridor-railway-tunnel.wav` | **the corridor** — close room (ha, kyū) | Innocent Railway tunnel, Edinburgh: a long flutter-echo bore | `../prosperos-jukebox-v2/ir/candidates/syc-railway-tunnel.wav` (mono, 96 kHz / 24-bit) |

Processing (node, in the session scratchpad — no external tools): tail
trimmed at −82 dB (hull) / −88 dB (corridor) relative to the direct-sound peak + 0.3 s (the R1 file
is 20 s long but its measured decay is ~12 dB/s, RT60 ≈ 5 s; everything past
~7 s is the recording's noise floor), 50 ms end fade, 96 kHz → 48 kHz by
2:1 decimation with a 4-tap average pre-filter (tunnel), normalized to
−1 dBFS, written as 16-bit PCM. The stereo ORTF hull was chosen over the
mono omni because the hull must read as a *space*; trimmed to 16-bit it is
well under the 3 MB budget.

## Provenance and license

Both spaces are from **OpenAIR**, the Open Acoustic Impulse Response
Library (AudioLab, Department of Electronic Engineering, University of
York) — see `../../prosperos-jukebox-v2/ir/README.md` for the retrieval
notes and the archived catalog pages in its `docs/`. License
**CC BY-SA 3.0 (Attribution-ShareAlike)**: attribution required, and these
trimmed/transcoded derivatives carry the same license.

Suggested credit line: "Impulse responses: OpenAIR, AudioLab, University of
York (CC BY-SA 3.0)."
