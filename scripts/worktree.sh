#!/usr/bin/env bash
# worktree.sh — the one way to create, list and retire worktrees for this site.
#   scripts/worktree.sh new  <branch> [base]   create ~/Sites/municipal-sky-site-worktrees/<branch>
#   scripts/worktree.sh done <branch>          remove that worktree (+ delete the branch if merged)
#   scripts/worktree.sh list                   show worktrees with branch, ahead-of-main, dirty state
# Worktrees are never siblings of the repo in ~/Sites. See CLAUDE.md "Worktrees".
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
HOME_DIR="$(dirname "$REPO")/$(basename "$REPO")-worktrees"
cmd="${1:-list}"; br="${2:-}"; base="${3:-main}"
case "$cmd" in
  new)
    [ -n "$br" ] || { echo "usage: worktree.sh new <branch> [base]"; exit 1; }
    mkdir -p "$HOME_DIR"
    dest="$HOME_DIR/$br"
    [ -e "$dest" ] && { echo "exists: $dest"; exit 1; }
    if git -C "$REPO" show-ref --verify -q "refs/heads/$br"; then
      git -C "$REPO" worktree add "$dest" "$br"
    else
      git -C "$REPO" worktree add -b "$br" "$dest" "$base"
    fi
    # gitignored per-project harnesses that crews expect to find
    for f in art/kolob/_harness.js art/bardo/_harness.js; do
      [ -f "$REPO/$f" ] && cp "$REPO/$f" "$dest/$f"
    done
    echo "worktree: $dest  (branch $br from $base)"
    echo "serve:    php -S 127.0.0.1:<port> -t $dest"
    ;;
  done)
    [ -n "$br" ] || { echo "usage: worktree.sh done <branch>"; exit 1; }
    dest="$HOME_DIR/$br"
    if [ -n "$(git -C "$dest" status --porcelain 2>/dev/null)" ]; then
      echo "refusing: $dest has uncommitted or untracked files:"; git -C "$dest" status --short | head; exit 1
    fi
    if [ -d "$dest/local-dev" ] && [ -n "$(ls -A "$dest/local-dev" 2>/dev/null)" ]; then
      echo "refusing: $dest/local-dev is not empty — move it to $REPO/local-dev/ first"; exit 1
    fi
    git -C "$REPO" worktree remove "$dest"
    if git -C "$REPO" branch -d "$br" 2>/dev/null; then echo "branch $br deleted (merged)"; else echo "branch $br kept (not merged into main)"; fi
    git -C "$REPO" worktree prune
    ;;
  list)
    git -C "$REPO" worktree list --porcelain | awk '/^worktree /{print $2}' | while read -r wt; do
      b=$(git -C "$wt" branch --show-current 2>/dev/null || echo "?")
      a=$(git -C "$REPO" rev-list --count "main..$b" 2>/dev/null || echo "?")
      d=$(git -C "$wt" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
      printf "%-60s %-24s ahead-of-main:%-4s changes:%s\n" "$wt" "$b" "$a" "$d"
    done
    ;;
  *) echo "usage: worktree.sh new <branch> [base] | done <branch> | list"; exit 1;;
esac
