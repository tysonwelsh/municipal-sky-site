# MARKETING-ROADMAP.md — The Junk Drawer social campaign, status index

A hand-off document for future Claude sessions. The owner paused the
marketing work on 2026-08-16 to focus elsewhere; this file says what the
campaign is FOR, what's built, what's next, and which decisions only the
owner can make. **Read `PLAN-SOCIAL.md` first** — it is the detailed
strategy (positioning, channel plans, pipeline architecture, the owner
interview of 2026-08-16 recorded in its §0). This file is the shorter
"where were we" layer on top, and should be updated whenever the work
advances or a decision lands.

## The aim

Grow an audience for The Junk Drawer (municipalsky.com/art/junk-drawer/)
as **a running, judgeable benchmark**: one verbatim prompt, four models,
one shot each, SVG output, on the record. The pitch line: *"One prompt.
Four models. Vector output, on the record."*

- **Audience:** people who know why an SVG is cool — AI-curious graphic
  designers, benchmark nerds, prompt engineers. The vector-ness is told
  as a story (byte counts, infinite zoom, editable, downloadable), since
  platforms can't display SVG directly.
- **Differentiator:** methodological discipline (verbatim prompts, honest
  one-shot counts, isolation harness, a real grading taxonomy) versus the
  usual sloppy "I made 4 AIs draw X" posts — plus the graph-paper visual
  identity the drawer already owns.
- **Channel roles:** Reddit/HN/Bluesky = discovery engine; X = AI
  discourse + model-launch reactivity; Instagram = compounding gallery;
  the site = destination (downloads, full records, link in bio).
- **Automation ethos:** posting is automated end to end (approve-by-merge
  keeps a human eye); engagement is never botted — no auto-likes/follows,
  ever (platform ToS; the compliant substitute is a curated engagement
  digest the owner acts on by hand, ~10 min/week).
- **Success metric:** owner hasn't defined one yet. Provisional 90-day
  bar in PLAN-SOCIAL §9 (500 IG / 300 X followers, one reddit post >100
  upvotes, a citation in the wild). Budget is **$0** until the owner
  says otherwise.

## Done (as of 2026-08-16)

- **Strategy:** PLAN-SOCIAL.md — full plan + all 20 owner interview
  answers on record (§0). Includes the Reddit sub-by-sub table (§6) and
  the warning that design/art subreddits ban AI work — seed the AI subs,
  not the art subs.
- **Still-card renderer:** `scripts/render-jd-social.py <item-id>` →
  `art/junk-drawer/social/renders/<id>/`: blind 2×2 cover (deterministic
  letter shuffle seeded by item id, prompt verbatim on the sheet),
  labeled closeups (model, vendor, overall grade, byte count), record
  card with CTA, caption drafts (IG + X), `meta.json` (alt text +
  blind-order map). 1080×1350. Graph paper lives ON the item plates,
  plain cream sheet behind (owner rev).
- **Video renderer:** `scripts/render-jd-social-video.py <item-id>` →
  `07-draw-reveal.mp4` (~12s, H.264): all specimens draw themselves
  SIMULTANEOUSLY in SVG document order, then labels/grades reveal.
  Deterministic seek-page technique (`?t=` + paused CSS animations),
  frame screenshots via headless shell, ffmpeg via `imageio-ffmpeg`
  (Playwright's bundled ffmpeg is VP8-only — can't feed Instagram).
- **Shared primitives:** `scripts/jd_social_lib.py` (chrome/ffmpeg
  discovery, entry/taxonomy loaders, blind order, card CSS, grid).
- **Queue:** `art/junk-drawer/social/queue.json` — owner-ordered,
  `queued → approved → posted`, seeded with the fish-skeleton demo.
  Demo renders committed under `social/renders/2026-07-29-fish-skeleton/`.
- **Spun off into the product itself:** the draw-on reveal shipped to the
  live drawer (v0.9.6–0.9.9): report card draws on open/flip, REPLAY
  button beside DOWNLOAD, and a fresh turn's plates draw simultaneously
  at the reveal. Engine: `window.JD_drawOn` in junk-drawer.js. Marketing
  relevance: the site now demos the way the videos look — the funnel
  destination carries the same magic.

## To do (build work, roughly in order)

1. **Phase 2 leftovers** (no owner input needed):
   - Bundle Courier Prime (OFL) under `social/fonts/` for pixel-stable CI
     renders (current renders fall back to Liberation fonts).
   - 9:16 crop/variant of the video for Reels.
   - `reddit-kit.txt` emitter (title options + image order + first-comment
     with method + link) per queued item.
   - Re-render card sets as the owner re-runs the backlog through the
     four-model panel (current items are Anthropic-heavy test data; posted
     items should be cross-vendor).
2. **Phase 3 — accounts + automation** (needs owner, see checklist in
   PLAN-SOCIAL §8): IG Business/Creator + FB Page + Meta dev app (dev
   mode + owner-as-tester avoids App Review for own-account posting; 60-day
   token → refresh job), X dev tier (verify current free-tier write
   limits), Bluesky. Then GitHub Actions: render→PR workflow
   (merge = approval), posting cron (Tue/Thu/Sat starting point), posted
   status written back to queue.json, failures → repo issue.
3. **Phase 4 — growth ops:** weekly engagement-digest job (curates ~20
   posts/accounts + suggested replies into an issue/email; human does the
   engaging), weekly stats snapshot to `social/stats/`, launch-day play
   (new model ships → run 3–5 backlog prompts through it → post that week).

## To decide (owner-only; blocking what's noted)

| Decision | Blocks |
|---|---|
| Handle/name (+ whether `junk.drawer` domain happens) | account creation, bios, everything phase 3 |
| License line for SVG downloads (CC BY? personal-use?) | every "free download" CTA; the Show HN |
| Anonymity: stay tied to municipalsky, or standalone brand | bios, voice details |
| Success definition (reach vs. credibility vs. leads) | format mix, tone, §9 metrics |
| Budget ceiling (currently $0) | scheduler tools, ManyChat comment-DM, any boosts |
| Overall grades in posts — provisional YES (overall only, never axes) | caption/record-card templates if reversed |
| When to do the one Show HN (needs permalinks + license + desktop polish) | timing only |

## How to resume

1. Read PLAN-SOCIAL.md (strategy + owner decisions), then this file.
2. Renderers run with zero setup in a Claude Code web session:
   `python3 scripts/render-jd-social.py <item-id>` and
   `render-jd-social-video.py <item-id>` (`pip install imageio-ffmpeg`
   once for video). Items live in `art/junk-drawer/items/`.
3. If the owner is starting accounts: walk PLAN-SOCIAL §8 top to bottom —
   the handle decision comes first; brainstorm candidates and check
   availability across IG/X/Reddit/Bluesky + domain before creating
   anything.
4. Keep this file honest: move items between the sections above as they
   land, and record new owner decisions in PLAN-SOCIAL §0 with dates.

Dev-only note: this file and the social tooling never require a VERSION
bump; the drawer UI does (see the in-app reveal's commits for the
convention).
