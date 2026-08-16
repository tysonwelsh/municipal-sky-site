# PLAN-SOCIAL.md — The Junk Drawer on social media

Strategy + implementation plan for promoting The Junk Drawer on Instagram,
X, and (per §6 — the actual discovery engine) Reddit/HN/Bluesky. Written
2026-08-16 from the owner interview of the same date. Phase 1 tooling is
built (see §10 status).

The one-line pitch: **One prompt. Four models. Vector output, on the
record.**

---

## §0 Owner decisions on record (2026-08-16 interview)

| # | Question | Decision |
|---|----------|----------|
| 1 | Persona | Hybrid: graph-paper/form visual identity, captions state facts plainly. No "bureau" roleplay. A `junk.drawer`-style standalone domain is a live possibility, undecided. |
| 2 | Handle | Undecided — brainstorm later; build meanwhile. |
| 3 | Anonymity | Tied to municipalsky.com for now. |
| 4 | Reveal | Blind 2×2 cover (A–D); the carousel flip is the reveal; closeups labeled; final card shows all four labeled. |
| 5 | Grades | Overall grade (Prime→Utility) may appear; per-axis ratings do NOT. May change. |
| 6 | Vendors | Owner will re-run all prompts across the four-model panel once the taxonomy settles; current Anthropic-heavy items are test data. Posted items should be cross-vendor. |
| 7 | Format | Carousels **and** programmatic video (stroke-draw animation). Video is phase 2. Stroke-animation variance by path structure is itself content. |
| 8 | Grid | 2×2 (four responses). |
| 9 | Prompt | Printed verbatim on the composite/cover. |
| 10 | Funnel | Link in bio → site. Licensing for downloads: **undecided — blocker for "free download" CTAs**, see §8. |
| 11 | Automation home | GitHub Actions in a repo. Stays in THIS repo for now (see §5.6). |
| 12 | Human-in-loop | Approve-by-merge to start. |
| 13 | Queue | Owner-ordered queue file; new items appended front or back at approval time. |
| 14 | Growth labor | Curated engagement digest (compliant; no auto-like/follow bots — ToS). |
| 15 | Seeding | Yes — Reddit/HN/Bluesky get a real plan (§6). |
| 16 | Budget | $0 for now. |
| 17 | Accounts | All new accounts needed. Owner has a personal IG only; fine with Business/Creator. |
| 18 | Captions/notes | Eval notes stay internal; captions are template-generated. |
| 19 | Success metric | Undecided; provisional targets in §9. |
| 20 | Sacred | Nothing flagged. |

Standing constraint accepted by owner: platforms can't display SVG — we
post raster/video renders and make the *vector-ness* the story (byte
counts, infinite crispness, editability, downloadability).

Standing constraint (non-negotiable): no automated engagement (bots that
like/follow/comment on third-party content). Violates IG and X terms and
risks the accounts. Automated **posting of our own content** via official
APIs is fine and is the plan.

---

## §1 Positioning & voice

**What the account is:** a running, visual, judgeable benchmark. Same
verbatim prompt, one shot each, clean context, four models, SVG output —
presented as specimen sheets on graph paper.

**Why it can work despite not being flashy 3D video:** almost every viral
"I made 4 AIs draw X" post is methodologically mush (unknown prompts,
cherry-picked retries). This project's *discipline* — verbatim prompts,
one-shot counts, isolation harness, a real grading taxonomy — is the
differentiator, and the graph-paper presentation makes the discipline
visible. The audience that cares (AI-curious designers, benchmark nerds,
prompt engineers) is exactly the audience that can reshare it into the
big AI discourse.

**Voice rules for captions:**
- Plain declarative facts. No bureau cosplay, no "as an AI" jokes, no
  vendor dunking. The images carry the aesthetic; the words carry the
  method.
- Always name the method in one breath: "one prompt, one shot each, SVG
  output."
- The SVG story, rotated across posts: file sizes in bytes ("1,654 bytes
  — no tool calls, single pass"), zoom-forever, editable in Illustrator/
  Figma/Inkscape, free to download.
- Never claim a model "won" — the grade is "the record," the audience is
  invited to disagree in comments.

**Identity:** visual system = the drawer's report-card language (cream
paper `#f8f3e2`, blue graph rules `rgba(74,98,138,…)` at 45/9px module,
form ink `#37414f`, typed Courier, kraft photo corners). Bio links to
municipalsky.com. Handle TBD (short-list exercise pending; consistent
name across IG/X/Reddit/Bluesky + the possible `junk.drawer` domain).

---

## §2 Channel roles

- **Reddit (+ HN, Bluesky)** — *discovery engine.* Where cold-start reach
  actually comes from for niche-technical content. Manual-but-assisted
  posting (the pipeline emits a ready-to-post kit). §6.
- **X** — *the AI-discourse surface.* Same card sets as native images +
  (phase 2) video. The high-leverage play is reactivity: when a new model
  ships, it joins the drawer that week and the comparison posts while
  the discourse is hot. §7.4.
- **Instagram** — *the compounding gallery.* Carousels (cover → closeups
  → record) 2×/week + (phase 2) Reels of the stroke-draw animations.
  Slowest to grow at $0 but the archive becomes a portfolio object in
  itself.
- **The site** — *destination.* Downloads + the full record (all
  responses, axes, notes — things social never shows). Everything links
  here. Needs (later): per-item permalink for deep links, license line,
  maybe a `?ref=` param so link clicks are attributable.

---

## §3 The post unit (phase 1 — BUILT)

One queued item ⇒ one card set, rendered by
`scripts/render-jd-social.py` (see §5.1) at 1080×1350 (4:5 — optimal IG,
fine on X):

1. **Cover** — blind 2×2. Sheet header (THE JUNK DRAWER · SPECIMEN
   COMPARISON SHEET), item title, file №, the four SVGs on photo-corner
   plates labeled A–D in typed letters, and the **prompt verbatim** in a
   ruled block. Footer: "which is which → swipe". Blind order is a
   deterministic shuffle seeded by item id (stable across re-renders,
   different across items, uncorrelated with rid/filing order).
2. **Closeup × N** — one per response, labeled: model + vendor
   (the flip IS the reveal), overall grade (label + n/5 — never axes),
   generation mode (one-shot / refined·k), and file size in bytes.
3. **The Record** — all four labeled small, grades under each, CTA block
   (vector/editable/free-download + site).

Also emitted per item: `caption-instagram.txt`, `caption-x.txt`
(template drafts — see voice rules §1), and `meta.json` (blind-order
mapping + per-card alt text for accessibility and IG alt fields).

Items with fewer than 4 responses render with "NO RESPONSE FILED" plates
— postable in a pinch, but the standing bar for the queue is 4 responses
/ ≥2 vendors (owner is re-running the backlog to that panel, §0.6).

**Font note:** the card CSS wants Courier Prime / Iowan Old Style with
metric-compatible fallbacks (Courier 10 Pitch, Liberation). For
pixel-identical renders in CI, bundle Courier Prime (OFL-licensed —
committable) under `art/junk-drawer/social/fonts/` — phase 2 chore.

## §4 Video / animation (BUILT 2026-08-16)

`scripts/render-jd-social-video.py` — produces
`social/renders/<id>/07-draw-reveal.mp4`, 1080×1350 H.264, ~12s: all
specimens draw themselves stroke by stroke **simultaneously** (owner
rev 2026-08-16; each in its own SVG document order — the order the
model actually emitted the shapes, real provenance), then model names +
grades reveal under the plates; verbatim prompt on-sheet throughout.
Style note (same owner rev): the graph paper lives on the item plates
(matching the drawer's report-card `.rc-plate`); the surrounding sheet
is plain cream — applies to the still cards too via the shared CSS.

- **The mechanic:** stroked paths animate `stroke-dashoffset` over their
  measured `getTotalLength()`; filled shapes fade in after their outline
  (or alone); pre-dashed strokes and unstrokeable elements fall back to
  a fade. A model that draws in filled solids has little to trace — the
  caption can say so; that variance is content.
- **Determinism with zero browser-automation deps:** every animation on
  the page is CSS, *paused*, offset by a negative delay read from
  `?t=<ms>` — loading the page at `?t=5000` IS the frame at 5s. One
  headless-shell screenshot per frame (8 workers ≈ 1 min per video),
  then ffmpeg. H.264 ffmpeg comes from `$FFMPEG_BIN` / PATH /
  `pip install imageio-ffmpeg` — Playwright's bundled ffmpeg is
  VP8-only and can't feed Instagram.
- Remaining (phase 2): 9:16 crop for Reels; audio (start silent,
  revisit); optional per-response stroke-vs-fill census in `meta.json`.

**In-app draw-on reveal (owner idea, 2026-08-16 — decision pending):**
the same technique runs live on the real SVG DOM with no video file —
prototyped in `mockups/mockup-18-draw-on-reveal.html` (buttons per
specimen, replay, draw-time knob). Recommended integration points if
adopted: the report-card photograph enlarge, and the alternative-flip
(incoming response draws on). Not the initial pile load — dozens of
simultaneous animations are expensive and noisy, and the pile's premise
is walking in on the mess already there. Guardrails: honor
`prefers-reduced-motion`, cache measured lengths, strip inline
animation styles after the run. Touching `junk-drawer.js` is a
user-facing change (VERSION bump + owner sign-off) — not done yet.

## §5 Automation pipeline

### 5.1 Renderer (BUILT)

`python3 scripts/render-jd-social.py <item-id> [<item-id>…]`
— stdlib-only; reads `items/<id>/entry.json` + `taxonomy.json`, renders
via headless Chromium (found like `check-svg-ink.sh` finds it: $CHROME_BIN
→ PATH → Playwright dir), writes card PNGs + captions + meta to
`art/junk-drawer/social/renders/<item-id>/`. Renders are committed (they
must be reviewable from a phone in a PR, and being servable on the
deployed site is harmless-to-useful). Re-render is deterministic.

### 5.2 Queue (BUILT)

`art/junk-drawer/social/queue.json` — owner-ordered array:

```json
{ "schema": 1,
  "queue": [ { "item": "<id>", "status": "approved", "added": "YYYY-MM-DD",
               "platforms": ["instagram", "x"], "posted": {} } ] }
```

`status`: `queued` (rendered, awaiting owner approval) → `approved`
(postable; owner sets this by merging the render PR / editing the file)
→ `posted` (posting workflow fills `posted.instagram/x` with date+id) —
or `skipped`. Owner controls order by array position (front/back per
§0.13). The file lives in the repo ⇒ approving from a phone is a commit,
consistent with the project's commit-is-publishing ethos.

### 5.3 GitHub Actions — render + approve (phase 3)

- **Render workflow:** on push to `main` touching `queue.json` (new
  `queued` entry) or an approved item's files → run renderer → open a PR
  containing renders + captions with the entry flipped to `approved`.
  **Merging the PR is the approval** (30 seconds on a phone: look at the
  PNGs inline, merge).
- **Posting workflow:** cron (start Tue/Thu 16:00 UTC + Sat 15:00 UTC;
  tune to analytics later) → picks the first `approved` entry not yet
  posted for that platform → posts → commits `posted` status back.
  Failures: retry with backoff; on final failure open an issue (visible
  from phone) rather than silently skipping.

### 5.4 Platform APIs (phase 3, owner prerequisites in §8)

- **Instagram:** Content Publishing API. Requires IG **Business or
  Creator** account linked to a Facebook Page + a Meta developer app.
  Key fact: posting to **your own** account works with the app in dev
  mode (owner added as tester) — no App Review gauntlet. Carousels ≤10
  children (we use ≤6); Reels supported. Long-lived tokens last ~60 days
  ⇒ the workflow includes a monthly token-refresh job and an expiry
  alarm.
- **X:** API v2 `POST /2/tweets` + media upload. Free tier is
  write-limited but historically ~500 posts/mo — far above our ~15.
  **Verify current tier limits/pricing at build time** — they change
  often.
- Secrets: GitHub repo secrets only. Nothing in the tree.

### 5.5 Engagement digest (phase 4 — the compliant growth agent)

Weekly scheduled job (Claude Code Routine or Action): searches the
hashtag/keyword space (§7.2) and target subreddits' new/top posts,
compiles ~20 candidates (link, one-line context, a *suggested* reply
angle) into a digest delivered as email or a repo issue. Owner spends
~10 min engaging as a human. Nothing is posted, liked, or followed
automatically. Also flags: posts quoting/resharing drawer content
(reply-worthy) and new-model-launch chatter (§7.4 trigger).

### 5.6 This repo vs. a new repo

**Stay here for now.** The data (items/, taxonomy, validator) is the
source of truth and lives here; the pipeline reads it directly; secrets
are repo-scoped; one less thing to sync. Revisit only if `junk.drawer`
becomes a standalone site/product (then the social pipeline moves with
the data, not before). A separate GitHub *account* is not needed for any
API reason.

## §6 Reddit / HN / Bluesky (the discovery plan)

**The warning that shapes everything:** design and art subreddits
(r/graphic_design, r/Design, r/vectorart, r/AdobeIllustrator, most
art subs) prohibit or are actively hostile to AI-generated work. Do not
seed there — it would be rule-breaking spam to them, and the backlash is
the story that sticks. The audience that *celebrates* this work is the
AI/benchmark crowd; designers arrive later via the AI-curious overlap.

**Targets (rotate, ≤1–2 seeded posts/week total):**

| Venue | Angle | Notes |
|---|---|---|
| r/ChatGPT | "Four models, one prompt, one shot — SVG output" galleries | Huge; this format is native there. Blind cover as image 1, reveal in gallery. |
| r/singularity, r/artificial | Capability-comparison angle | Model-launch weeks only. |
| r/ClaudeAI, r/OpenAI, r/Bard | Vendor-home crowds | Post the comparisons where "their" model does interestingly (well OR badly — honesty travels). |
| r/LocalLLaMA | Benchmark-rigor angle: harness, one-shot, taxonomy | Skeptical, high-value. Kimi K3 & other open models in the panel is the entry ticket; write the methodology comment first. |
| r/generative, r/proceduralgeneration | Craft angle | Check each sub's AI policy first; skip if ambiguous. |
| Hacker News | ONE "Show HN: a graded junk drawer of LLM-generated SVGs" | Wait until site has item permalinks + license + the drawer demos well on desktop. The isolation-harness/eval-taxonomy writeup is the HN hook. Weekday ~9am ET. |
| Bluesky | Cross-post everything | Small but AI+design-dense; API is trivially automatable (and bot-tolerant for own-content posting). Cheap to add to the phase-3 posting workflow. |

**Method (manual, kit-assisted):** the pipeline emits a `reddit-kit.txt`
per item (2–3 title options, which images in what order, a first-comment
with method + link — link in comment, not post). Native uploads, not
link posts. Owner posts in 60 seconds, then answers replies for the
first hour (that hour decides reddit performance — schedule seeding for
when the owner is actually reachable). Respect each sub's self-promo
ratio by also being a normal commenter there (the §5.5 digest surfaces
where).

## §7 Growth ops

1. **Cadence:** IG 2 carousels/wk (+1 Reel/wk in phase 2); X 3 posts/wk
   (same items, staggered a day after IG so each platform gets a
   "fresh" post); 1–2 seeded community posts/wk; Bluesky mirrors X.
2. **Hashtags/keywords.** IG (~12, rotate): #svg #vectorart #vector
   #generativeart #aiart #aidesign #designtools #graphicdesign
   #promptengineering #machinelearning + 2 model-specific tags per post
   (#gpt5, #claudeai, …). X: hashtags ≈ dead; write the model names in
   the sentence ("GPT-5 vs Claude Opus 5 vs Gemini") — that's what
   search and quote-tweets key on.
3. **CTAs (rotate, one per post):** vote ("Which takes the grade — A, B,
   C, D?"), save-bait ("save the sheet; the record's on the last card"),
   download ("all four SVGs free — link in bio" — BLOCKED on license,
   §8), prompt-credit ("prompt in full on the cover — steal it").
4. **The launch-day play (highest-leverage habit):** new model ships →
   owner runs 3–5 backlog prompts through it (existing add-an-alternative
   flow) → same-week "«model» joins the drawer" posts + reddit seed while
   the discourse window is open. The backlog makes this cheap; almost
   nobody else posts *disciplined* day-one comparisons.
5. **What we don't do:** follow/unfollow churn, auto-likes, engagement
   pods, buying followers, posting in anti-AI communities.

## §8 Launch checklist (owner actions, roughly in order)

1. Decide handle (blocker for everything account-side). Brainstorm
   session pending; check availability on IG+X+Reddit+Bluesky + domain.
2. Create IG account → switch to Creator/Business; create the linked
   Facebook Page (API requirement, can be bare).
3. Meta developer account + app; add own IG account as tester; generate
   long-lived token → GitHub secrets.
4. X account + developer (free) tier; keys → GitHub secrets.
5. (With me) bios + pinned-post explaining the method; first 6 queue
   items approved; phase-3 workflows enabled.
6. **License decision** for the SVGs (blocks download CTAs, HN post):
   simplest honest options — CC BY 4.0 (credit link travels with files)
   or personal-use-only (keeps options open). Note: pure model output's
   copyright status is murky — a license statement is still worth
   stating as terms-of-offer. Decide, put one line on the site.
7. Bluesky account (5 minutes, do whenever).

## §9 Metrics (phase 4)

Weekly snapshot job → `social/stats/` (followers, reach, saves, profile
clicks per platform; per-post table). Success definition is owner-TBD
(§0.19); **provisional 90-day bar:** 500 IG followers, 300 X followers,
one reddit post >100 upvotes, measurable bio-link clicks, and — the real
one — at least one "the SVG benchmark drawer account" citation in the
wild. Review at week 6: kill/keep format mix, CTA rotation, posting
times.

## §10 Roadmap & status

- **Phase 1 — DONE (2026-08-16):** this plan; `render-jd-social.py`
  (cover/closeups/record + captions + meta/alt-text); `social/queue.json`
  schema; demo render of `2026-07-29-fish-skeleton` committed under
  `social/renders/`.
- **Phase 2 — video DONE (2026-08-16):** `render-jd-social-video.py`
  (§4, shared primitives refactored into `scripts/jd_social_lib.py`) +
  `mockups/mockup-18-draw-on-reveal.html` (in-app candidate, §4).
  Remaining: bundle Courier Prime; reddit-kit emitter; 9:16 Reels crop;
  render the re-run four-model backlog as it lands.
- **Phase 3:** accounts + secrets (§8); render→PR workflow; posting cron
  (IG carousel, X, Bluesky) + token refresh + failure issues.
- **Phase 4:** engagement digest routine (§5.5); stats snapshots (§9).
- **Parking lot:** handle/domain (`junk.drawer`), license line, item
  permalinks + `?ref=`, Reels audio, Show HN timing, paid boosts (budget
  is $0 today).

Dev-only note: nothing in this plan touches the drawer UI; no VERSION
bump required for social/ tooling commits.
