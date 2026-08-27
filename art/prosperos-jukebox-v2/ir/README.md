# Real impulse responses — OpenAIR (University of York)

Retrieved 2026-08-02 for PJ2 room experiments (replacements for the
generated-noise IRs in `PJ2.Voice.reverb`).

## rooms/ — PRODUCTION assets (wired into the engines)

Processed with scripts in the session scratchpad (trim tail at −70 dB rel
peak + 0.3 s, 50 ms end fade, resample 48 kHz, normalize −1 dBFS, 16-bit):

- `library-wide-st-margarets.wav` — **Library wide room** ("the stacks";
  owner 2026-08-03, engine wet 0.34). St Margaret's Church, York (National
  Centre for Early Music), stereo mid-side decode (L=W+0.5Y, R=W−0.5Y)
  from B-format `r1_1st_configuration.wav`, source-receiver 11 m.
  License: **CC BY-SA 3.0** (docs/st-margarets-ncem-openairlib-2016.html).
- `ariel-sky-tvisongur.wav` — **Ariel wide room** ("the sky"; owner
  2026-08-04, chosen at wet ×1.2 → engine wet 0.41). Tvísöngur singing-dome
  sound sculpture, Seyðisfjörður, Iceland (model measurement), from
  binaural stereo `source1domefareceiver5domemibinaural.wav`.
  License: OpenAIR site-wide Creative Commons (docs/openair-project-page-
  york-2026.html + docs/openair-cc-statement-intarch-issue44.html; every
  individually-verified space is CC BY-SA 3.0). TODO before public
  deploy: confirm this space's own license page when OpenAIR's site
  returns.

Engines fall back to the generated pour if a file fails to load
(`irUrl` option in pj2-voice.js Voice.reverb). Candidate files for the
mockup pages live in `candidates/`; audition pages: `../room-mockup.html`
(Library), `../room-mockup-sycorax.html`, `../room-mockup-ariel.html`.

## Provenance

All three spaces are from OpenAIR, the Open Acoustic Impulse Response
Library (AudioLab, Department of Electronic Engineering, University of
York). At retrieval time both OpenAIR web front-ends
(openairlib.net and openair.hosted.york.ac.uk) showed "Account Suspended,"
but the underlying York file server remained live. Files were downloaded
directly from:

    https://webfiles.york.ac.uk/OPENAIR/IRs/<slug>/<slug>.zip

with slugs `gill-heads-mine`, `maes-howe`, `r1-nuclear-reactor-hall`.
(Other spaces confirmed live at the same pattern: `york-minster`,
`st-andrews-church`, `koli-national-park-winter`.) Only the mono/stereo
renderings were kept; the original zips also carry B-format (and for R1,
5.1) versions plus photos and auralization examples.

## License

**CC BY-SA 3.0 (Attribution-ShareAlike)** for all three spaces, per each
space's catalog page on the original openairlib.net site — archived
snapshots of those pages are saved in `docs/` as the license evidence,
since the live site is down. Implications:

- Attribution required. Suggested credit line for the site colophon:
  "Impulse responses: OpenAIR, AudioLab, University of York (CC BY-SA 3.0)."
- ShareAlike: any trimmed/normalized/transcoded derivatives we serve must
  also carry CC BY-SA. Fine for this project; keep the credit with them.

## The spaces

| folder | space | character | files |
|---|---|---|---|
| `gill-heads-mine/` | Gill Heads Mine, near Trollers Gill, Yorkshire Dales — disused lead/fluorite mine, closed 1980s; measured at two sites within ~30 m of the entrance | tight rock passage; the candidate Sycorax cavern (wide room) | 4 mono WAV, 96 kHz/24-bit, 5 s. `site1`/`site2` = positions; `1way` = single directional source, `2way` = opposed pair approximating omni |
| `maes-howe/` | Maes Howe, Orkney — Neolithic chambered cairn, c. 2700 BCE | small stone burial chamber, ~1 s; candidate Sycorax close room ("fireside stone") | 1 stereo ORTF WAV, 48 kHz |
| `r1-nuclear-reactor-hall/` | R1 experimental reactor hall, KTH Stockholm — vast void 25 m underground, reactor decommissioned 1970 | enormous underground decay (~20 s file); alternative wide room | mono omni + stereo ORTF WAV, 48 kHz |

## docs/

Archived catalog pages (Wayback Machine captures of openairlib.net, 2015,
plus the 2019 York WordPress page for the mine) documenting each space's
description and CC BY-SA 3.0 license marking. Keep these — they are the
proof of license if OpenAIR never comes back.
