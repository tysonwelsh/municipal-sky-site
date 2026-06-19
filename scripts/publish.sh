#!/usr/bin/env bash
# Publish the Municipal Sky website live. Three steps:
#   1) Cache-bust: sync ?v= on CSS/JS refs to content hashes (scripts/bust-cache.py)
#   2) Commit changes to Git and push to the remote
#   3) Upload every tracked file (minus deploy.yml's excludes + local-dev/) over FTP
# FTP credentials are read from .vscode/sftp.json, so no secrets live here.
#
# Usage: scripts/publish.sh ["optional commit message"]
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO" || { echo "publish: cannot cd to repo root"; exit 1; }

CFG="$REPO/.vscode/sftp.json"
[ -f "$CFG" ] || { echo "publish: missing FTP config $CFG"; exit 1; }

# Pull FTP settings from the VSCode SFTP config (single source of credentials).
IFS=$'\t' read -r HOST FUSER FPASS RPATH < <(python3 - "$CFG" <<'PY'
import json, sys
c = json.load(open(sys.argv[1]))
print("\t".join([c["host"], c["username"], c["password"], c["remotePath"].rstrip("/")]))
PY
)
[ -n "${HOST:-}" ] && [ -n "${RPATH:-}" ] || { echo "publish: could not parse FTP settings from $CFG"; exit 1; }

# ── Cache-bust → commit → push ─────────────────────────────────
# Sync ?v= cache-busters to content hashes so changed CSS/JS isn't served stale.
python3 "$REPO/scripts/bust-cache.py" || echo "publish: cache-bust step skipped (python3 error)"

# Commit any changes so Git matches what we publish — and so new/untracked files
# get tracked and therefore included in the upload below. Respects .gitignore.
git add -A
if git diff --cached --quiet; then
  echo "Git: nothing to commit."
else
  msg="${1:-Publish site ($(date '+%Y-%m-%d %H:%M'))}"
  git commit -q -m "$msg" && echo "Git: committed \"$msg\""
fi

# Push to the remote (non-fatal — the FTP upload still proceeds if push fails).
if git push -q 2>/dev/null; then echo "Git: pushed to remote."; else echo "publish: git push failed — push manually when ready."; fi

# Build the publish list: tracked files, minus deploy.yml's excludes
# (.git*, *.md, *.backup-*) and local-dev/ (dev-only assets that shouldn't be
# public). .vscode / node_modules / secrets are already gitignored, so they
# never appear here.
# NUL-delimited + quotePath=false so paths with spaces/non-ASCII are handled
# correctly (and excluded reliably) rather than slipping through quoted.
FILES=()
while IFS= read -r -d '' f; do
  case "$f" in
    .git*|*/.git*) continue ;;   # .gitignore, .github/, etc.
    *.md|*.backup-*) continue ;; # docs and backups (deploy.yml excludes)
    local-dev/*) continue ;;     # dev-only assets, not for production
  esac
  FILES+=("$f")
done < <(git -c core.quotePath=false ls-files -z)
total=${#FILES[@]}
[ "$total" -gt 0 ] || { echo "publish: no files to upload"; exit 1; }

echo "Publishing $total files → ftp://$HOST$RPATH/"
ok=0; fail=0; i=0; failed=()
for f in "${FILES[@]}"; do
  i=$((i+1))
  rel="${f// /%20}"   # URL-encode spaces for the FTP path (other specials aren't present)
  if curl -s --connect-timeout 20 --ftp-create-dirs --ftp-pasv \
       -u "$FUSER:$FPASS" -T "$f" "ftp://$HOST$RPATH/$rel" >/dev/null 2>&1; then
    ok=$((ok+1))
  else
    fail=$((fail+1)); failed+=("$f"); echo "  ✗ FAILED: $f"
  fi
  if [ $((i % 25)) -eq 0 ]; then echo "  ...$i/$total uploaded"; fi
done

echo "----------------------------------------"
echo "Done: $ok uploaded, $fail failed, of $total total."
if [ "$fail" -gt 0 ]; then
  printf '  failed: %s\n' "${failed[@]}"
  exit 1
fi
