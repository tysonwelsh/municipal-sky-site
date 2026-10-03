<?php
// Junk Drawer, dataset v2 — the ONE-SHOT PRE-CAMPAIGN RESET, RETIRED.
//
// WHAT IT WAS. The one deliberate exception to the Never list's "Never delete
// or overwrite a session, judgment, ranking or pair" (art/junk-drawer/CLAUDE.md):
// a setup-key-gated, dry-run-first, token-confirmed endpoint that deleted every
// row of the seven jd2_* tables, once, by the owner, before the rating
// campaign's first sitting (owner, 2026-10-03; PLAN-V2 §12).
//
// IT RAN on production on 2026-10-03 and deleted 310 rows of trial data — the
// trial prompts, runs, drawings and sittings, the owner's Titanic test sitting
// included — before the campaign's first sitting. The record is the line in
// the server's private_config/jd2-reset.log (stamp: jd2-reset.stamp beside
// it). From the campaign's first sitting on there is NO delete exception:
// nothing in dataset v2 is ever deleted.
//
// WHY A STUB AND NOT A DELETED FILE. Deleting the file from the repo would not
// delete it from the server: the FTP deploy is not counted on to remove
// anything. scripts/publish.sh only uploads, and the GitHub deploy
// (.github/workflows/deploy.yml, FTP-Deploy-Action) never deletes a server
// file it has no record of uploading itself — so the live copy would stay
// callable, gated only by the setup key and an hour's stamp cooldown long
// since expired. Overwriting it with this stub is what reaches the server:
// the next deploy replaces the live file.
//
// It answers 410 Gone to every request and does nothing else: no includes,
// no key check, no database, no reading of the request. On the CLI it prints
// the same line and exits 1. Do not restore the old code (it is in git
// history before this commit) and do not copy it into another endpoint.

if (PHP_SAPI === 'cli') {
    echo "jd2-reset: this endpoint has run (2026-10-03) and is retired. Nothing in dataset v2 is ever deleted.\n";
    exit(1);
}

http_response_code(410);
header('Content-Type: text/plain; charset=utf-8');
echo "jd2-reset: this endpoint has run (2026-10-03) and is retired. Nothing in dataset v2 is ever deleted.\n";
