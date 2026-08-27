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

# Push to the remote. A push that fails for NETWORK/credential reasons is
# non-fatal — the FTP upload still proceeds and Git can be synced manually.
# A push REJECTED AS BEHIND ORIGIN is fatal: uploading that checkout would
# clobber the live site with stale files, and the GitHub Actions deploy will
# never repair them (its hash sync-state still matches Git, so it sees
# nothing to re-upload). That exact sequence resurrected deleted jukebox UI
# on 2026-08-17 — merge origin/main first, then publish.
# Capture the real error rather than swallowing it, so failures are actionable.
if push_out="$(git push 2>&1)"; then
  echo "Git: pushed to remote."
else
  printf '%s\n' "$push_out" | sed 's/^/  git: /'
  if printf '%s' "$push_out" | grep -qiE "non-fast-forward|fetch first|\[rejected\]"; then
    echo "publish: ABORTING — the remote has commits this checkout lacks."
    echo "  Uploading now would overwrite the live site with stale files that the"
    echo "  Actions deploy cannot detect or repair. Run:  git pull --no-rebase"
    echo "  (resolve any conflicts), then re-run publish."
    exit 1
  fi
  echo "publish: git push failed — FTP upload still proceeds; sync Git manually."
  if printf '%s' "$push_out" | grep -qi "workflow.*scope"; then
    echo "  → Cause: this push touches .github/workflows/, but your Git credential"
    echo "    lacks GitHub's 'workflow' scope. Grant it once (opens a browser):"
    echo "      gh auth refresh -h github.com -s workflow && gh auth setup-git"
    echo "    then re-run publish (or just: git push). After that it syncs every time."
  fi
fi

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
    scripts/*) continue ;;       # dev tooling (publish.sh, bust-cache.py) — not web content
  esac
  FILES+=("$f")
done < <(git -c core.quotePath=false ls-files -z)
total=${#FILES[@]}
[ "$total" -gt 0 ] || { echo "publish: no files to upload"; exit 1; }

echo "Publishing $total files → ftp://$HOST$RPATH/ (verifying each upload)"
ok=0; fail=0; i=0; failed=()
for f in "${FILES[@]}"; do
  i=$((i+1))
  rel="${f// /%20}"   # URL-encode spaces for the FTP path (other specials aren't present)
  lmd5=$(md5 -q "$f")
  uploaded=0
  for try in 1 2 3; do
    curl -s --connect-timeout 20 --ftp-create-dirs --ftp-pasv \
      -u "$FUSER:$FPASS" -T "$f" "ftp://$HOST$RPATH/$rel" >/dev/null 2>&1 || continue
    # Verify: FTP reports "transfer complete" even when bytes are mangled, and
    # corruption can preserve the file size — so compare a content hash by
    # downloading the file back. Retry on mismatch.
    rmd5=$(curl -s --max-time 90 --ftp-pasv -u "$FUSER:$FPASS" "ftp://$HOST$RPATH/$rel" | md5)
    [ "$rmd5" = "$lmd5" ] && { uploaded=1; break; }
  done
  if [ "$uploaded" = 1 ]; then
    ok=$((ok+1))
  else
    fail=$((fail+1)); failed+=("$f"); echo "  ✗ FAILED (unverified after 3 tries): $f"
  fi
  if [ $((i % 25)) -eq 0 ]; then echo "  ...$i/$total"; fi
done

echo "----------------------------------------"
echo "Done: $ok uploaded, $fail failed, of $total total."
if [ "$fail" -gt 0 ]; then
  printf '  failed: %s\n' "${failed[@]}"
  exit 1
fi
