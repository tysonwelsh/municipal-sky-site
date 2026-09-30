# municipal-sky-site

## Prospero's Jukebox v2 — version bumping (owner rule, 2026-08-04)

Every time you land a user-facing change to `art/prosperos-jukebox-v2/`
(engine sound, rooms/IRs, UI, viz — anything the owner could hear or
see), **bump `art/prosperos-jukebox-v2/VERSION` in the same commit**.

- Format: one line, `2.0.0-rc.N — short human summary of what changed`
  (increment N; drop the `-rc.N` for the eventual 2.0.0 release, then
  move to 2.0.1, 2.1.0, … semver-style).
- The summary should say what the owner would *notice* ("real rooms: …",
  "louder master", "new skin"), not internal refactor details.
- Why: the index.php footer renders this string (plus an automatic asset
  fingerprint + mtime). The owner uses the readable version number to
  verify they're hearing/seeing the updated build — the fingerprint alone
  is not human-checkable. Dev-only changes (harness, docs, mockup pages)
  do NOT require a bump.

## ZANKYŌ — version bumping (adopted from the Jukebox rule, 2026-09-05)

The same rule applies to `art/zankyo/`: every commit that changes what the
owner hears or sees bumps `art/zankyo/VERSION` in the same commit —
one line, `2.0.0-rc.N — short human summary of what changed` (semver
after the 2.0.0 release). `art/zankyo/index.php` renders the version
number with an asset fingerprint and the newest asset's mtime under the
serial plate, so the owner can verify the build they are hearing.
Dev-only changes (`_harness.js`, `_probe.js`, `bodies-lab.php`, docs) do
not bump. The Jukebox v2 substrate (`art/prosperos-jukebox-v2/pj2-*.js`)
is shared by relative path and is never modified from ZANKYŌ; ZANKYŌ's
own extensions live in `art/zankyo/`.

## Page titles and basic spacing — use the house style (owner rule, 2026-09-29)

A page title followed by a horizontal rule uses the site's own pattern from
`css/style.css`: the `h1` (as `.section-title`, or the page's own title class
with the site's `margin: 0 0 var(--s-2)`), then `<div class="section-divider"></div>`
(1px ink rule, `var(--s-4)` of space under it) — as on `/art/` and
`/information-graphics/`. Don't hand-roll a border-bottom and padding on a
header for this, and don't invent per-page spacing for titles, rules and the
first paragraph: use the `--s-*` scale and the shared classes, so pages stay
consistent and the owner doesn't have to fix one-off spacing page by page.

## Worktrees — where parallel work lives (owner rule, 2026-09-30)

`~/Sites/municipal-sky-site` (this checkout, branch `main`) is for **merging and
publishing only**. Any session or crew that will edit files for more than a
quick fix works in a git worktree, never in this checkout, because
`scripts/publish.sh` runs `git add -A` and auto-deploys whatever is here.

- **One home:** every worktree lives under `~/Sites/municipal-sky-site-worktrees/<branch>`
  and the folder is named exactly after its branch. Never create a sibling folder
  in `~/Sites` (the old `municipal-sky-site-<name>` pattern is retired; it left
  44 stray checkouts and 18 GB behind).
- **Use the helper:** `scripts/worktree.sh new <branch> [base]` creates one (and
  copies the gitignored `_harness.js` files); `scripts/worktree.sh done <branch>`
  removes it once the branch is merged, and `scripts/worktree.sh list` shows what
  exists. Plain `git worktree add ../municipal-sky-site-<x>` is not allowed.
- **Retire on merge.** The session that merges a branch into `main` removes its
  worktree in the same step and deletes the branch. A worktree is disposable; the
  history is in `.git`.
- **Back up by pushing.** Push long-running branches to `origin` (`git push -u
  origin <branch>`) — only pushes to `main` deploy, so branch pushes are free
  backups. Pushing `main` is a publish decision for the owner.
- **Gitignored work is not in the worktree's branch.** `local-dev/`, `_harness.js`
  and `*/tools/out/` vanish with the folder. Keep durable lab material in
  `~/Sites/municipal-sky-site/local-dev/<project>-lab/` (skeeball-lab, reels5 and
  pachinko-lab live there or will), and raw media in `~/Media/`.
- **Memories and agent files name worktrees by branch**, e.g. "worktree
  `municipal-sky-site-worktrees/pachinko-1`", so the path is derivable.
- In this checkout: stage specific paths, never `git add -A` outside
  `publish.sh`; never `--amend`, rebase or reset without `git log -3` first
  (another session may have committed in between).
