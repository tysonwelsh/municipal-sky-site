# MOTHER LODE — crew briefing

Every agent that touches this build reads this first, then
`../arcade/HEART.md`, `BRIEF.md` and `PLAN.md` in full. The orchestrator
(the Claude session that owns this build) dispatches you and reviews your
work; the owner will see only the finished game.

## Why this build is different

The owner spent a long interview giving Claude a rich creative vision
(mood, tone, lore, the feel of the place) and then handed over the whole
build: *"let you cook."* In their words, the goal is **to show that if you
give Claude a rich creative vision and all kinds of details in terms of
mood and vibe, it can create something truly distinctive**, and to
showcase what Claude Opus 5.5 can do as an agent, technically and
creatively. **This game will be shared publicly as a showcase of Claude's
capabilities.**

So the bar is not "meets the spec." The bar is:
- **Fully realised.** A complete, playable, satisfying arcade game, not
  a prototype. Polish the edges nobody asked about.
- **Distinctive.** It should look and feel like nothing else, and like
  exactly this place (HEART.md). Specific over generic, always.
- **Surprising.** The owner wants to be delighted by things they didn't
  specify. Every builder adds **at least two unrequested touches** that
  fit HEART.md and lists them in the report. Small, specific and funny
  or tender beats big.
- **Fun.** It has to be satisfying to drop a marble, and you have to
  want another token.

Take your time. Iterate. Look at your own output (screenshots, contact
sheets, metrics), critique it honestly, and fix it before you report.
Aim for at least three look–critique–fix rounds on anything visual.

## Where things are

- **Worktree:** `/Users/tysonwelsh/Sites/municipal-sky-site-pachinko`,
  branch `pachinko-1`. Work **only** here. Never edit, commit in, or run
  git commands that change the main checkout
  (`/Users/tysonwelsh/Sites/municipal-sky-site`), which other sessions use.
- **Server:** `http://127.0.0.1:8077/art/pachinko/`, already running
  (`php -S` rooted at the worktree). HOLLER ROLLER is at
  `http://127.0.0.1:8077/art/skeeball/` for reference: read its code for
  house style (`art/skeeball/*.js`, `art/arcade/*.js`), but never edit it.
- **Lab:** `local-dev/pachinko-lab/` (gitignored). `cdp.js` is a headless
  Chrome driver (`node cdp.js shot <url> <out.png> [w] [h] [dpr] [settleMs]`,
  `eval`, `script`); extend it as needed. Put screenshots in
  `local-dev/pachinko-lab/shots/<your-phase>/`. Reports go in
  `local-dev/pachinko-lab/reports/`.

## Testing gotchas (learned the hard way)

- **Headless Chrome runs rAF at ~1 fps.** Never poll on frames. The game
  has `?harness=1` (once main.js exists), where `window.__pachinko.harness`
  owns the clock (`stepTo(t)`, `render()`); use it for deterministic shots.
- **Audio must be silent.** Always launch Chrome with `--mute-audio`
  (`cdp.js` does), or render with an `OfflineAudioContext`. Unmuted runs
  play through the owner's speakers.
- Never use c11 `select-workspace` or anything that steals the operator's
  view. Use headless Chrome, not the c11 browser, for screenshots.
- `Emulation.setDeviceMetricsOverride` goes *after* `Page.navigate`.
- View your PNGs with the Read tool. Crop and upscale regions
  (`sips` or a small canvas script) to judge pixel art at 1:1 detail.

## Rules

- Follow PLAN.md §0 (deterministic, pure sim and board modules, vanilla
  JS, no dependencies, procedural pixel art, no binary assets).
- **Own your files.** Your dispatch prompt says which files you own. Edit
  others only where the prompt allows, minimally, and say so in the report.
  Other agents may be working in the same worktree at the same time.
- **Commit narrowly and often** on `pachinko-1`:
  `git add <your files>`, never `git add -A` or `git add .`. If the git
  index is locked by a parallel agent, wait a few seconds and retry.
  Commit messages: `pachinko <area>: rc.N — <what the owner would notice>`,
  ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **VERSION:** once `art/pachinko/VERSION` exists, any commit that changes
  what a player sees or hears bumps it (`1.0.0-rc.N — summary`). Re-read
  the file right before bumping; parallel agents bump too. Lab, docs and
  harness-only commits don't bump.
- **Never push, publish, FTP, or touch `art/index.php`.**
- Write decisions and tuned constants into PLAN.md §12 (the decisions
  log), one dated bullet each.

## Reporting

When done, write `local-dev/pachinko-lab/reports/<phase>.md`: what you
built, the metrics, screenshots worth looking at (paths), your surprises,
known gaps, and what the next phase should know. Your final message to the
orchestrator is a short summary (under 300 words) that points to the report.
