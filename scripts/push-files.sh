#!/usr/bin/env bash
# Push NAMED files straight to the live site over FTP — no Git, no full upload.
#
# The counterpart to publish.sh, which is deliberately all-or-nothing (cache-bust
# + `git add -A` + push + upload every tracked file). This one touches only the
# paths you hand it, so live work can land immediately and the Git history can be
# tidied up and merged later on its own schedule.
#
# Usage: scripts/push-files.sh <path> [path ...]        # paths relative to repo root
#        scripts/push-files.sh --dry-run <path> [...]   # list what would go, upload nothing
#
# Credentials come from .vscode/sftp.json, same single source as publish.sh.
#
# CAVEAT — this puts the live site AHEAD of Git. That is the point, but it means
# the GitHub Actions deploy no longer knows about these files. Actions re-uploads
# a file only when its content hash changes in Git, so an unrelated deploy will
# NOT clobber what you push here; the eventual commit of these same files will
# upload them again harmlessly. Do not use this to push a file you have also
# reverted locally, and do commit the change eventually — an un-committed live
# edit is invisible to every other checkout.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || { echo "push-files: cannot cd to repo root"; exit 1; }

DRY=0
if [ "${1:-}" = "--dry-run" ]; then DRY=1; shift; fi
[ "$#" -gt 0 ] || { echo "usage: scripts/push-files.sh [--dry-run] <path> [path ...]"; exit 1; }

CFG="$REPO/.vscode/sftp.json"
[ -f "$CFG" ] || { echo "push-files: missing FTP config $CFG"; exit 1; }

IFS=$'\t' read -r HOST FUSER FPASS RPATH < <(python3 - "$CFG" <<'PY'
import json, sys
c = json.load(open(sys.argv[1]))
print("\t".join([c["host"], c["username"], c["password"], c["remotePath"].rstrip("/")]))
PY
)
[ -n "${HOST:-}" ] && [ -n "${RPATH:-}" ] || { echo "push-files: could not parse FTP settings from $CFG"; exit 1; }

# Normalize every argument to a repo-relative path and check it exists first, so
# a typo fails before anything is uploaded rather than halfway through.
FILES=()
for arg in "$@"; do
  abs="$(cd "$(dirname "$arg")" 2>/dev/null && pwd)/$(basename "$arg")"
  case "$abs" in
    "$REPO"/*) rel="${abs#$REPO/}" ;;
    *) echo "push-files: refusing path outside the repo: $arg"; exit 1 ;;
  esac
  [ -f "$abs" ] || { echo "push-files: no such file: $arg"; exit 1; }
  FILES+=("$rel")
done

total=${#FILES[@]}
if [ "$DRY" = 1 ]; then
  echo "Would push $total file(s) → ftp://$HOST$RPATH/"
  printf '  %s\n' "${FILES[@]}"
  exit 0
fi

echo "Pushing $total file(s) → ftp://$HOST$RPATH/ (verifying each upload)"
ok=0; fail=0; failed=()
for f in "${FILES[@]}"; do
  rel="${f// /%20}"
  lmd5=$(md5 -q "$f")
  uploaded=0
  for try in 1 2 3; do
    curl -s --connect-timeout 20 --ftp-create-dirs --ftp-pasv \
      -u "$FUSER:$FPASS" -T "$f" "ftp://$HOST$RPATH/$rel" >/dev/null 2>&1 || continue
    # FTP reports success even on mangled bytes, and corruption can preserve the
    # file size — so read it back and compare hashes. Same check publish.sh makes.
    rmd5=$(curl -s --max-time 90 --ftp-pasv -u "$FUSER:$FPASS" "ftp://$HOST$RPATH/$rel" | md5)
    [ "$rmd5" = "$lmd5" ] && { uploaded=1; break; }
  done
  if [ "$uploaded" = 1 ]; then
    ok=$((ok+1)); echo "  ✓ $f"
  else
    fail=$((fail+1)); failed+=("$f"); echo "  ✗ FAILED (unverified after 3 tries): $f"
  fi
done

echo "----------------------------------------"
echo "Done: $ok pushed, $fail failed, of $total."
[ "$fail" -eq 0 ] || { printf '  failed: %s\n' "${failed[@]}"; exit 1; }
