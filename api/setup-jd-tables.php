<?php
// One-time setup script — delete after running.
// The four Junk Drawer visitor-prompt tables (PLAN-USER-PROMPTS-CONTRACTS C2,
// with the C6.2 SQLite deltas and the C6.4 environment gating).
//
// Production requires ?key=<jd_setup_key> because this one creates four
// tables, unlike the older single-table setup scripts.

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

$statements = JD_DEV_MODE ? jd_setup_sqlite_ddl() : jd_setup_mysql_ddl();

echo JD_DEV_MODE
    ? "Dev mode (SQLite): " . realpath(dirname(JD_DEV_DB_PATH)) . "/" . basename(JD_DEV_DB_PATH) . "\n\n"
    : "MySQL\n\n";

$failed = 0;
foreach ($statements as $table => $sql) {
    try {
        $db->exec($sql);
        echo str_pad($table, 20) . " ok\n";
    } catch (PDOException $e) {
        $failed++;
        echo str_pad($table, 20) . " FAILED: " . $e->getMessage() . "\n";
    }
}

// --- additive migrations (safe to re-run) ----------------------------------
// jd_comparisons.strength (C1.3 addition, 2026-08-11): the likert margin on
// a comparison. Fresh installs get it from the CREATE above; a live table
// gets it here. Checked before altering so a re-run stays quiet.
try {
    $has = false;
    if (JD_DEV_MODE) {
        foreach ($db->query('PRAGMA table_info(jd_comparisons)') as $col) {
            if (($col['name'] ?? '') === 'strength') { $has = true; break; }
        }
        if (!$has) {
            $db->exec('ALTER TABLE jd_comparisons ADD COLUMN strength TEXT NULL');
        }
    } else {
        $q = $db->query("SHOW COLUMNS FROM jd_comparisons LIKE 'strength'");
        $has = $q !== false && $q->fetch() !== false;
        if (!$has) {
            $db->exec("ALTER TABLE jd_comparisons ADD COLUMN strength VARCHAR(8) NULL AFTER winner_gen_id");
        }
    }
    echo str_pad('strength column', 20) . ($has ? " already present\n" : " added\n");
} catch (PDOException $e) {
    $failed++;
    echo str_pad('strength column', 20) . " FAILED: " . $e->getMessage() . "\n";
}

// jd_generations.slot gains 'c' (third model per turn, 2026-08-14): fresh
// installs get ENUM('a','b','c') from the CREATE above; a live MySQL table
// gets widened here. SQLite tables created before this change carry the old
// CHECK constraint — SQLite can't alter one, but the dev database is
// disposable: delete local-dev/jd-dev.sqlite and re-run. (Checked first so
// a re-run stays quiet.)
try {
    $widened = false;
    if (JD_DEV_MODE) {
        $widened = true;  // CHECK lives in the CREATE; nothing to alter
    } else {
        $q = $db->query("SHOW COLUMNS FROM jd_generations LIKE 'slot'");
        $col = $q !== false ? $q->fetch() : false;
        $widened = is_array($col) && strpos((string) ($col['Type'] ?? ''), "'c'") !== false;
        if (!$widened) {
            $db->exec("ALTER TABLE jd_generations MODIFY COLUMN slot ENUM('a','b','c') NOT NULL");
        }
    }
    echo str_pad('slot c', 20) . ($widened ? " already present\n" : " added\n");
} catch (PDOException $e) {
    $failed++;
    echo str_pad('slot c', 20) . " FAILED: " . $e->getMessage() . "\n";
}

echo "\n" . ($failed === 0 ? "All tables present. Delete this script when you are done.\n" : "$failed statement(s) failed.\n");

// ---------------------------------------------------------------------------

// C2, verbatim. MySQL 5.7+/MariaDB compatible: no JSON column type, no
// AUTO_INCREMENT — every id is an app-generated ULID.
function jd_setup_mysql_ddl(): array
{
    return [
        'jd_submissions' => "
CREATE TABLE IF NOT EXISTS jd_submissions (
    id                 CHAR(26)     NOT NULL PRIMARY KEY,
    client_ref         CHAR(36)     NOT NULL,
    created            DATETIME     NOT NULL,
    prompt             TEXT         NOT NULL,
    visitor_hash       CHAR(64)     NOT NULL,
    client             VARCHAR(16)  NOT NULL DEFAULT 'web',
    pair_order         TINYINT      NOT NULL,
    ai_consent_at      DATETIME     NULL,
    ai_consent_version VARCHAR(16)  NULL,
    status             ENUM('pending','generated','rated','failed') NOT NULL DEFAULT 'pending',
    UNIQUE KEY uq_client_ref (client_ref),
    KEY idx_visitor_created (visitor_hash, created),
    KEY idx_created (created)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        'jd_generations' => "
CREATE TABLE IF NOT EXISTS jd_generations (
    id             CHAR(26)     NOT NULL PRIMARY KEY,
    submission_id  CHAR(26)     NOT NULL,
    slot           ENUM('a','b','c') NOT NULL,
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
    id                 TEXT     NOT NULL PRIMARY KEY,
    client_ref         TEXT     NOT NULL,
    created            TEXT     NOT NULL,
    prompt             TEXT     NOT NULL,
    visitor_hash       TEXT     NOT NULL,
    client             TEXT     NOT NULL DEFAULT 'web',
    pair_order         INTEGER  NOT NULL,
    ai_consent_at      TEXT     NULL,
    ai_consent_version TEXT     NULL,
    status             TEXT     NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','generated','rated','failed')),
    UNIQUE (client_ref)
)",
        'jd_submissions idx' => "
CREATE INDEX IF NOT EXISTS idx_jds_visitor_created ON jd_submissions (visitor_hash, created);
CREATE INDEX IF NOT EXISTS idx_jds_created ON jd_submissions (created)",

        'jd_generations' => "
CREATE TABLE IF NOT EXISTS jd_generations (
    id             TEXT     NOT NULL PRIMARY KEY,
    submission_id  TEXT     NOT NULL,
    slot           TEXT     NOT NULL CHECK (slot IN ('a','b','c')),
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
    ];
}
