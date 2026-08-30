# ROADMAP.md — The Junk Drawer, the app's own to-do

Feature ideas and deferred work for the drawer and its bench. (The social
campaign has its own file, MARKETING-ROADMAP.md; per-project build plans live
in the gitignored PLAN-*.md docs.) Newest first within each section.

## Wanted

### Let a model propose the size tier (owner, 2026-08-30)

The bench now closes every curation with the HOW BIG IS IT card — the
taxonomy's five tiers, chosen by eye against swatches drawn to their real
footprints. That is the owner's judgment and stays available, but at the
scale of the reassessment backlog (84 prompts and counting) it is also 84
more decisions.

**The idea:** a small fast model looks at the drawing and the prompt and
proposes a tier, the way `jd-title.php` proposes a title — the card opens
with that tier already selected and its reasoning available, and the owner
confirms or overrides in one press. The judgment stays the owner's; the model
supplies the first guess.

What makes it tractable: the tiers are about how big the object reads *in a
drawer of other objects* — a paperclip is small, an urn is large — which is
knowledge about the subject, not about the SVG. A titler-shaped endpoint
(prompt in, one token out, validated against the taxonomy's tier ids) would
do it. Worth checking the agreement rate against the tiers already on file
before trusting it: the corpus has ~40 owner-chosen sizes to test against,
which is a real eval set.

Related: `sizing-desk.html` already exists for tuning sizes in bulk against
the live pile math, and `sizeScale` is the continuous dial under the tiers.

### A read path for DB ratings (standing, since 2026-08-18)

The drawer still renders annotations from `entry.json`; bench ratings live in
`jd_ratings` and are copied into entries by hand at harvest time. A read path
would let the card render the database's judgments directly and retire the
copying. (See CLAUDE.md's note on the direction of travel.)

### Promotion of turns into the drawer

`scripts/promote-turn.py` — the counterpart to `harvest-rerun.py` for prompts
that were never curated items: write the surviving SVGs, ink-check, author the
entry from the owner's bench ratings, title via `jd-title.php`, size from the
bench's size flag. Blocked on nothing; wanted for the reassessment backlog.

## Done

- **The size card** (0.9.96, 2026-08-30) — the bench's closing step.
- **Bench mode** (0.9.73 →) — the backlog runs inside the real turn card.
- **`jd-inventory.php`** (2026-08-30) — the census of everything on file.
