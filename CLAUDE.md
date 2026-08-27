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
