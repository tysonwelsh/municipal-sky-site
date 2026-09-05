<?php
// Junk Drawer — tables and migrations. Idempotent: run it after every deploy
// that touches the schema, and re-running it is always safe.
//
//   CLI:  JD_DEV_MOCK=1 php api/setup-jd-tables.php        (the SQLite dev database)
//   web:  https://municipalsky.com/api/setup-jd-tables.php?key=<jd_setup_key>
//
// Production requires ?key=<jd_setup_key> because this script creates every
// table the feature has and alters live ones.
//
// The schema is documented in db/junk-drawer-schema.md. Every migration below
// is guarded (jd_has_column / jd_has_table / a row count), so a run against a
// database that already carries it reports "already present" and moves on.

require_once __DIR__ . '/jd-config.php';

header('Content-Type: text/plain; charset=utf-8');

// --- C6.4 environment gating ----------------------------------------------
if (JD_IS_PRODUCTION) {
    $secrets = jd_secrets();
    $expected = $secrets['jd_setup_key'] ?? null;
    $supplied = $_GET['key'] ?? '';
    if (!is_string($expected) || $expected === '' || !hash_equals($expected, (string) $supplied)) {
        http_response_code(403);
        echo "Forbidden. Add jd_setup_key to private_config/secrets.php and call this script with ?key=<that value>.\n";
        exit;
    }
}

if (!JD_DEV_MODE && !JD_IS_PRODUCTION && !is_readable(__DIR__ . '/../config/secrets.php')) {
    http_response_code(500);
    echo "No database available. Either add config/secrets.php for a local MySQL, or run with JD_DEV_MOCK=1 for the SQLite dev database.\n";
    exit;
}

try {
    $db = jd_db();
} catch (Throwable $e) {
    http_response_code(500);
    echo "Could not open the database: " . $e->getMessage() . "\n";
    exit;
}

$sqlite = jd_db_driver($db) === 'sqlite';
$statements = $sqlite ? jd_setup_sqlite_ddl() : jd_setup_mysql_ddl();

echo $sqlite
    ? "Dev mode (SQLite): " . realpath(dirname(JD_DEV_DB_PATH)) . "/" . basename(JD_DEV_DB_PATH) . "\n\n"
    : "MySQL\n\n";

$failed = 0;
function jd_setup_line(string $label, string $result): void
{
    echo str_pad($label, 24) . ' ' . $result . "\n";
}

foreach ($statements as $table => $sql) {
    try {
        $db->exec($sql);
        jd_setup_line($table, 'ok');
    } catch (PDOException $e) {
        $failed++;
        jd_setup_line($table, 'FAILED: ' . $e->getMessage());
    }
}

// --- additive migrations (safe to re-run) ----------------------------------
// Fresh installs get every column from the CREATE above; a live table gets
// it here. SQLite cannot widen a CHECK constraint or an ENUM-shaped column,
// but the dev database is disposable: delete local-dev/jd-dev.sqlite and
// re-run.

/**
 * ADD COLUMN unless it is already there. $mysql / $sqlite are the column
 * definitions in each dialect (the SQLite one may be null when SQLite
 * already carries it from the CREATE, e.g. an ENUM widening).
 */
function jd_ensure_column(PDO $db, string $table, string $column, string $mysql, ?string $sqlite): void
{
    global $failed;
    $label = $table . '.' . $column;
    try {
        if (jd_has_column($db, $table, $column)) {
            jd_setup_line($label, 'already present');
            return;
        }
        $def = jd_db_driver($db) === 'sqlite' ? $sqlite : $mysql;
        if ($def === null) {
            jd_setup_line($label, 'n/a in this dialect');
            return;
        }
        $db->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $column . ' ' . $def);
        jd_setup_line($label, 'added');
    } catch (PDOException $e) {
        $failed++;
        jd_setup_line($label, 'FAILED: ' . $e->getMessage());
    }
}

// jd_comparisons.strength (C1.3 addition, 2026-08-11): the likert margin.
jd_ensure_column($db, 'jd_comparisons', 'strength',
    'VARCHAR(8) NULL AFTER winner_gen_id', 'TEXT NULL');

// jd_generations.slot gains 'd' (fourth model per turn, 2026-08-14). MySQL
// only — SQLite's CHECK lives in the CREATE.
try {
    if ($sqlite) {
        jd_setup_line('jd_generations.slot d', 'n/a in this dialect');
    } else {
        $q = $db->query("SHOW COLUMNS FROM jd_generations LIKE 'slot'");
        $col = $q !== false ? $q->fetch() : false;
        $widened = is_array($col) && strpos((string) ($col['Type'] ?? ''), "'d'") !== false;
        if (!$widened) {
            $db->exec("ALTER TABLE jd_generations MODIFY COLUMN slot ENUM('a','b','c','d') NOT NULL");
        }
        jd_setup_line('jd_generations.slot d', $widened ? 'already present' : 'added');
    }
} catch (PDOException $e) {
    $failed++;
    jd_setup_line('jd_generations.slot d', 'FAILED: ' . $e->getMessage());
}

// jd_submissions.item_id — the curated backfill (2026-08-18). item_id is the
// join key back to the filesystem AND the discriminator that keeps curated
// rows out of turn-flow analytics: curated rows are NOT visitor turns (see
// db/junk-drawer-schema.md), so every turn report filters item_id IS NULL.
$hadItemId = jd_has_column($db, 'jd_submissions', 'item_id');
jd_ensure_column($db, 'jd_submissions', 'item_id',
    'VARCHAR(64) NULL AFTER client_ref', 'TEXT NULL');
if (!$hadItemId) {
    try {
        $db->exec($sqlite
            ? 'CREATE INDEX IF NOT EXISTS idx_jds_item ON jd_submissions (item_id)'
            : 'CREATE INDEX idx_jds_item ON jd_submissions (item_id)');
        jd_setup_line('idx_jds_item', 'added');
    } catch (PDOException $e) {
        $failed++;
        jd_setup_line('idx_jds_item', 'FAILED: ' . $e->getMessage());
    }
}

// THE SUBMISSION'S OWN FACTS (2026-09-05). Until this migration, five things
// about a SUBMISSION were stored as `kind='flag'` rows in jd_ratings, hung
// off whichever generation came first, with the value encoded in the note
// ("SIZE m", "TITLE …", "RETIRE <id>"): the object's title and size, the
// visitor's keep-it-out wish, and the curator's scrap / rerun intents. They
// are columns on jd_submissions now — one row, one fact, no parsing — and
// the block after this one folds every legacy flag row into them.
jd_ensure_column($db, 'jd_submissions', 'title',
    'VARCHAR(80) NULL AFTER status', 'TEXT NULL');
jd_ensure_column($db, 'jd_submissions', 'size_class',
    'VARCHAR(2) NULL AFTER title', 'TEXT NULL');
jd_ensure_column($db, 'jd_submissions', 'suppressed',
    'TINYINT NOT NULL DEFAULT 0 AFTER size_class', 'INTEGER NOT NULL DEFAULT 0');
jd_ensure_column($db, 'jd_submissions', 'retire_requested_at',
    'DATETIME NULL AFTER suppressed', 'TEXT NULL');
jd_ensure_column($db, 'jd_submissions', 'rerun_requested_at',
    'DATETIME NULL AFTER retire_requested_at', 'TEXT NULL');

// Fold the legacy flag rows into those columns, then delete them. Idempotent:
// a second run finds no such rows. Rows are applied in filing order, so the
// last word wins exactly as it did when readers scanned the flags; a note
// beginning "UN" (UNRETIRE / UNRERUN / UNSUPPRESS) was the convention for a
// withdrawn intent and clears the column.
try {
    $rows = $db->query(
        "SELECT r.id, r.axis_id, r.note, r.rated_at, g.submission_id
           FROM jd_ratings r
           JOIN jd_generations g ON g.id = r.generation_id
          WHERE r.kind = 'flag'
            AND r.axis_id IN ('title', 'size', 'suppress', 'retire-request', 'rerun-request')
          ORDER BY r.rated_at, r.id"
    )->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) {
        jd_setup_line('flag rows → columns', 'nothing to migrate');
    } else {
        $facts = [];   // submission_id => [column => value]
        $ids = [];
        foreach ($rows as $r) {
            $sid = (string) $r['submission_id'];
            $note = (string) ($r['note'] ?? '');
            $withdrawn = strpos($note, 'UN') === 0;
            $ids[] = $r['id'];
            switch ($r['axis_id']) {
                case 'title':
                    if (preg_match('/^TITLE (.+)$/s', $note, $m)) {
                        $facts[$sid]['title'] = mb_substr(trim($m[1]), 0, 80);
                    }
                    break;
                case 'size':
                    if (preg_match('/^SIZE ([a-z]{1,2})$/', $note, $m)) {
                        $facts[$sid]['size_class'] = $m[1];
                    }
                    break;
                case 'suppress':
                    $facts[$sid]['suppressed'] = $withdrawn ? 0 : 1;
                    break;
                case 'retire-request':
                    $facts[$sid]['retire_requested_at'] = $withdrawn ? null : (string) $r['rated_at'];
                    break;
                case 'rerun-request':
                    $facts[$sid]['rerun_requested_at'] = $withdrawn ? null : (string) $r['rated_at'];
                    break;
            }
        }
        $db->beginTransaction();
        try {
            foreach ($facts as $sid => $cols) {
                $sets = [];
                $vals = [];
                foreach ($cols as $col => $val) {
                    $sets[] = $col . ' = ?';
                    $vals[] = $val;
                }
                $vals[] = $sid;
                $db->prepare('UPDATE jd_submissions SET ' . implode(', ', $sets) . ' WHERE id = ?')
                   ->execute($vals);
            }
            $del = $db->prepare('DELETE FROM jd_ratings WHERE id = ?');
            foreach ($ids as $id) {
                $del->execute([$id]);
            }
            $db->commit();
            jd_setup_line('flag rows → columns',
                count($ids) . ' flag row(s) folded into ' . count($facts) . ' submission(s) and deleted');
        } catch (PDOException $e) {
            $db->rollBack();
            throw $e;
        }
    }
} catch (PDOException $e) {
    $failed++;
    jd_setup_line('flag rows → columns', 'FAILED: ' . $e->getMessage());
}

// jd_ranks (C1.3 addition, 2026-08-22) is a whole table, so the CREATE above
// is its own migration; this line only SAYS whether it landed, because
// jd-rate.php deliberately keeps filing ratings (minus the rank rows) while
// it is absent.
try {
    $present = jd_has_table($db, 'jd_ranks');
    jd_setup_line('jd_ranks table', $present ? 'present' : 'MISSING — see the failure above');
    if (!$present) {
        $failed++;
    }
} catch (PDOException $e) {
    $failed++;
    jd_setup_line('jd_ranks table', 'FAILED: ' . $e->getMessage());
}

echo "\n" . ($failed === 0 ? "All tables present and migrated.\n" : "$failed statement(s) failed.\n");

// ---------------------------------------------------------------------------

// C2, plus the columns added since. MySQL 5.7+/MariaDB compatible: no JSON
// column type, no AUTO_INCREMENT — every id is an app-generated ULID.
function jd_setup_mysql_ddl(): array
{
    return [
        'jd_submissions' => "
CREATE TABLE IF NOT EXISTS jd_submissions (
    id                  CHAR(26)     NOT NULL PRIMARY KEY,
    client_ref          CHAR(36)     NOT NULL,
    item_id             VARCHAR(64)  NULL,           -- curated item this row backs; NULL = a visitor turn
    created             DATETIME     NOT NULL,
    prompt              TEXT         NOT NULL,
    visitor_hash        CHAR(64)     NOT NULL,
    client              VARCHAR(16)  NOT NULL DEFAULT 'web',
    pair_order          TINYINT      NOT NULL,
    ai_consent_at       DATETIME     NULL,
    ai_consent_version  VARCHAR(16)  NULL,
    status              ENUM('pending','generated','rated','failed') NOT NULL DEFAULT 'pending',
    title               VARCHAR(80)  NULL,           -- the object's tag title (jd-title.php)
    size_class          VARCHAR(2)   NULL,           -- taxonomy sizeTiers id, as filed
    suppressed          TINYINT      NOT NULL DEFAULT 0, -- visitor: keep it out of the drawer
    retire_requested_at DATETIME     NULL,           -- curator: scrap (NULL = not requested)
    rerun_requested_at  DATETIME     NULL,           -- curator: rerun (NULL = not requested)
    UNIQUE KEY uq_client_ref (client_ref),
    KEY idx_visitor_created (visitor_hash, created),
    KEY idx_created (created),
    KEY idx_jds_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        'jd_generations' => "
CREATE TABLE IF NOT EXISTS jd_generations (
    id             CHAR(26)     NOT NULL PRIMARY KEY,
    submission_id  CHAR(26)     NOT NULL,
    slot           ENUM('a','b','c','d') NOT NULL,
    model_id       VARCHAR(64)  NOT NULL,
    model_version  VARCHAR(64)  NOT NULL,
    provider       VARCHAR(32)  NOT NULL,
    harness        VARCHAR(16)  NOT NULL,
    params         TEXT         NOT NULL,
    raw_response   MEDIUMTEXT   NULL,
    svg            MEDIUMTEXT   NULL,
    status         ENUM('pending','ok','failed','rejected') NOT NULL DEFAULT 'pending',
    reject_reason  VARCHAR(64)  NULL,
    disobedience   TINYINT      NOT NULL DEFAULT 0,
    latency_ms     INT          NULL,
    usage_tokens   TEXT         NULL,
    created        DATETIME     NOT NULL,
    UNIQUE KEY uq_submission_slot (submission_id, slot),
    KEY idx_created (created),
    CONSTRAINT fk_jdg_submission FOREIGN KEY (submission_id) REFERENCES jd_submissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        'jd_ratings' => "
CREATE TABLE IF NOT EXISTS jd_ratings (
    id               CHAR(26)      NOT NULL PRIMARY KEY,
    generation_id    CHAR(26)      NOT NULL,
    kind             ENUM('grade','axis','flag') NOT NULL,
    axis_id          VARCHAR(64)   NULL,
    value            DECIMAL(3,1)  NULL,
    note             VARCHAR(500)  NULL,
    taxonomy_version INT           NOT NULL,
    visitor_hash     CHAR(64)      NOT NULL,
    client           VARCHAR(16)   NOT NULL DEFAULT 'web',
    rated_at         DATETIME      NOT NULL,
    KEY idx_generation (generation_id),
    CONSTRAINT fk_jdr_generation FOREIGN KEY (generation_id) REFERENCES jd_generations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        'jd_comparisons' => "
CREATE TABLE IF NOT EXISTS jd_comparisons (
    id             CHAR(26)    NOT NULL PRIMARY KEY,
    submission_id  CHAR(26)    NOT NULL,
    winner_gen_id  CHAR(26)    NULL,          -- NULL = explicit tie
    strength       VARCHAR(8)  NULL,          -- 'decisive'|'slight'; NULL on a
                                              -- tie or a pre-likert client
    visitor_hash   CHAR(64)    NOT NULL,
    client         VARCHAR(16) NOT NULL DEFAULT 'web',
    rated_at       DATETIME    NOT NULL,
    UNIQUE KEY uq_submission (submission_id),
    KEY idx_winner (winner_gen_id),
    CONSTRAINT fk_jdc_submission FOREIGN KEY (submission_id) REFERENCES jd_submissions(id),
    CONSTRAINT fk_jdc_winner FOREIGN KEY (winner_gen_id) REFERENCES jd_generations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // The full rank order of the surviving drawings (C1.3 addition,
        // 2026-08-22): one row per ok slot. jd_comparisons keeps being written
        // alongside it (winner = the rank-1 generation) so the historical win
        // series stays one continuous table.
        //
        // THE COLUMN IS rank_pos, NOT rank: RANK is a reserved word in MySQL
        // 8.0 (the window function), and an unquoted `rank` column is a
        // syntax error there. Do not "tidy" this name, quoted or otherwise.
        'jd_ranks' => "
CREATE TABLE IF NOT EXISTS jd_ranks (
    id             CHAR(26)    NOT NULL PRIMARY KEY,
    submission_id  CHAR(26)    NOT NULL,
    generation_id  CHAR(26)    NOT NULL,
    rank_pos       TINYINT     NOT NULL,       -- 1 = best; dense (the distinct
                                               -- ranks used are exactly 1..k);
                                               -- ties legal below 1 only
    visitor_hash   CHAR(64)    NOT NULL,
    client         VARCHAR(16) NOT NULL DEFAULT 'web',
    rated_at       DATETIME    NOT NULL,
    UNIQUE KEY uq_submission_generation (submission_id, generation_id),
    KEY idx_submission (submission_id),
    CONSTRAINT fk_jdrk_submission FOREIGN KEY (submission_id) REFERENCES jd_submissions(id),
    CONSTRAINT fk_jdrk_generation FOREIGN KEY (generation_id) REFERENCES jd_generations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ];
}

// C6.2 — the same tables, columns and indexes with exactly the mechanical
// deltas: ENUM -> TEXT CHECK, no ENGINE/CHARSET/COLLATE, MEDIUMTEXT -> TEXT,
// DATETIME -> TEXT (the ISO strings PHP already writes), TINYINT -> INTEGER.
// Indexes are separate statements because SQLite has no inline KEY clause.
function jd_setup_sqlite_ddl(): array
{
    return [
        'jd_submissions' => "
CREATE TABLE IF NOT EXISTS jd_submissions (
    id                  TEXT     NOT NULL PRIMARY KEY,
    client_ref          TEXT     NOT NULL,
    item_id             TEXT     NULL,
    created             TEXT     NOT NULL,
    prompt              TEXT     NOT NULL,
    visitor_hash        TEXT     NOT NULL,
    client              TEXT     NOT NULL DEFAULT 'web',
    pair_order          INTEGER  NOT NULL,
    ai_consent_at       TEXT     NULL,
    ai_consent_version  TEXT     NULL,
    status              TEXT     NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','generated','rated','failed')),
    title               TEXT     NULL,
    size_class          TEXT     NULL,
    suppressed          INTEGER  NOT NULL DEFAULT 0,
    retire_requested_at TEXT     NULL,
    rerun_requested_at  TEXT     NULL,
    UNIQUE (client_ref)
)",
        'jd_submissions idx' => "
CREATE INDEX IF NOT EXISTS idx_jds_visitor_created ON jd_submissions (visitor_hash, created);
CREATE INDEX IF NOT EXISTS idx_jds_created ON jd_submissions (created);
CREATE INDEX IF NOT EXISTS idx_jds_item ON jd_submissions (item_id)",

        'jd_generations' => "
CREATE TABLE IF NOT EXISTS jd_generations (
    id             TEXT     NOT NULL PRIMARY KEY,
    submission_id  TEXT     NOT NULL,
    slot           TEXT     NOT NULL CHECK (slot IN ('a','b','c','d')),
    model_id       TEXT     NOT NULL,
    model_version  TEXT     NOT NULL,
    provider       TEXT     NOT NULL,
    harness        TEXT     NOT NULL,
    params         TEXT     NOT NULL,
    raw_response   TEXT     NULL,
    svg            TEXT     NULL,
    status         TEXT     NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','ok','failed','rejected')),
    reject_reason  TEXT     NULL,
    disobedience   INTEGER  NOT NULL DEFAULT 0,
    latency_ms     INTEGER  NULL,
    usage_tokens   TEXT     NULL,
    created        TEXT     NOT NULL,
    UNIQUE (submission_id, slot),
    CONSTRAINT fk_jdg_submission FOREIGN KEY (submission_id) REFERENCES jd_submissions(id)
)",
        'jd_generations idx' => "
CREATE INDEX IF NOT EXISTS idx_jdg_created ON jd_generations (created)",

        'jd_ratings' => "
CREATE TABLE IF NOT EXISTS jd_ratings (
    id               TEXT     NOT NULL PRIMARY KEY,
    generation_id    TEXT     NOT NULL,
    kind             TEXT     NOT NULL CHECK (kind IN ('grade','axis','flag')),
    axis_id          TEXT     NULL,
    value            DECIMAL(3,1) NULL,
    note             TEXT     NULL,
    taxonomy_version INTEGER  NOT NULL,
    visitor_hash     TEXT     NOT NULL,
    client           TEXT     NOT NULL DEFAULT 'web',
    rated_at         TEXT     NOT NULL,
    CONSTRAINT fk_jdr_generation FOREIGN KEY (generation_id) REFERENCES jd_generations(id)
)",
        'jd_ratings idx' => "
CREATE INDEX IF NOT EXISTS idx_jdr_generation ON jd_ratings (generation_id)",

        'jd_comparisons' => "
CREATE TABLE IF NOT EXISTS jd_comparisons (
    id             TEXT NOT NULL PRIMARY KEY,
    submission_id  TEXT NOT NULL,
    winner_gen_id  TEXT NULL,
    strength       TEXT NULL,
    visitor_hash   TEXT NOT NULL,
    client         TEXT NOT NULL DEFAULT 'web',
    rated_at       TEXT NOT NULL,
    UNIQUE (submission_id),
    CONSTRAINT fk_jdc_submission FOREIGN KEY (submission_id) REFERENCES jd_submissions(id),
    CONSTRAINT fk_jdc_winner FOREIGN KEY (winner_gen_id) REFERENCES jd_generations(id)
)",
        'jd_comparisons idx' => "
CREATE INDEX IF NOT EXISTS idx_jdc_winner ON jd_comparisons (winner_gen_id)",

        // See the MySQL DDL above for why the column is rank_pos and never
        // `rank`. TINYINT -> INTEGER, DATETIME -> TEXT, as everywhere else.
        'jd_ranks' => "
CREATE TABLE IF NOT EXISTS jd_ranks (
    id             TEXT     NOT NULL PRIMARY KEY,
    submission_id  TEXT     NOT NULL,
    generation_id  TEXT     NOT NULL,
    rank_pos       INTEGER  NOT NULL,
    visitor_hash   TEXT     NOT NULL,
    client         TEXT     NOT NULL DEFAULT 'web',
    rated_at       TEXT     NOT NULL,
    UNIQUE (submission_id, generation_id),
    CONSTRAINT fk_jdrk_submission FOREIGN KEY (submission_id) REFERENCES jd_submissions(id),
    CONSTRAINT fk_jdrk_generation FOREIGN KEY (generation_id) REFERENCES jd_generations(id)
)",
        'jd_ranks idx' => "
CREATE INDEX IF NOT EXISTS idx_jdrk_submission ON jd_ranks (submission_id)",
    ];
}
