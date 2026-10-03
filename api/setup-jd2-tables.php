<?php
// Junk Drawer, dataset v2 — tables and migrations. Idempotent: the deploy runs
// it after every upload (after api/setup-jd-tables.php, the v1 runner), and
// re-running it is always safe.
//
//   CLI:  JD_DEV_MOCK=1 php api/setup-jd2-tables.php        (the SQLite dev database)
//   web:  https://municipalsky.com/api/setup-jd2-tables.php?key=<jd_setup_key>
//
// Production requires ?key=<jd_setup_key> because this script creates every
// jd2_* table. It never touches a v1 jd_* table: v2 is greenfield (PLAN-V2 §0,
// §3) and the two datasets never pool. Both runners share one database (and,
// in dev, one SQLite file).
//
// The schema is documented in db/junk-drawer-v2-schema.md. The allowed words
// of every enumerated column are constants in api/jd2-config.php, defined once
// there; the SQLite CHECKs and the MySQL comments below are built from them.
// Any migration added later is guarded (jd_has_column / jd_has_table), so a
// run against a database that already carries it reports "already present".

require_once __DIR__ . '/jd2-config.php';

header('Content-Type: text/plain; charset=utf-8');

// --- C6.4 environment gating ----------------------------------------------
jd_require_setup_key("Forbidden. Add jd_setup_key to private_config/secrets.php and call this script with ?key=<that value>.\n");

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
$statements = $sqlite ? jd2_setup_sqlite_ddl() : jd2_setup_mysql_ddl();

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

// --- the prompt's two forward references (MySQL) -----------------------------
// jd2_prompts.shown_run_id and .pinned_generation_id point at tables created
// AFTER jd2_prompts (jd2_runs and jd2_generations point back at it), and
// MySQL refuses a FOREIGN KEY to a table that does not exist yet. So on MySQL
// the two constraints are added here, once the targets exist, guarded by a
// probe of information_schema. SQLite resolves a forward reference at write
// time, so its CREATE carries both inline.

/** Schema probe (MySQL): does $table carry a FOREIGN KEY named $name? */
function jd2_has_foreign_key(PDO $db, string $table, string $name): bool
{
    $q = $db->prepare(
        "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
          WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ?
            AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
    );
    $q->execute([$table, $name]);
    return $q->fetch() !== false;
}

$forwardKeys = [
    'fk_jd2p_shown_run' => 'FOREIGN KEY (shown_run_id) REFERENCES jd2_runs(id)',
    'fk_jd2p_pinned_gen' => 'FOREIGN KEY (pinned_generation_id) REFERENCES jd2_generations(id)',
];
foreach ($forwardKeys as $name => $def) {
    try {
        if ($sqlite) {
            jd_setup_line($name, 'n/a in this dialect (inline in the CREATE)');
            continue;
        }
        if (jd2_has_foreign_key($db, 'jd2_prompts', $name)) {
            jd_setup_line($name, 'already present');
            continue;
        }
        $db->exec('ALTER TABLE jd2_prompts ADD CONSTRAINT ' . $name . ' ' . $def);
        jd_setup_line($name, 'added');
    } catch (PDOException $e) {
        $failed++;
        jd_setup_line($name, 'FAILED: ' . $e->getMessage());
    }
}

// --- additive migrations (safe to re-run) ----------------------------------
// A column added after its table has reached a database goes here as a
// guarded ADD COLUMN, in v1's jd_ensure_column shape (api/setup-jd-tables.php);
// fresh installs get it from the CREATE above. An allowed word added to a
// jd2-config.php list needs no migration on MySQL (VARCHAR); a dev SQLite
// file is recreated (delete local-dev/jd-dev.sqlite, re-run).
function jd2_ensure_column(PDO $db, string $table, string $column, string $mysql, string $sqlite): void
{
    global $failed;
    $label = $table . '.' . $column;
    try {
        if (jd_has_column($db, $table, $column)) {
            jd_setup_line($label, 'already present');
            return;
        }
        $db->exec('ALTER TABLE ' . $table . ' ADD COLUMN ' . $column . ' '
            . (jd_db_driver($db) === 'sqlite' ? $sqlite : $mysql));
        jd_setup_line($label, 'added');
    } catch (PDOException $e) {
        $failed++;
        jd_setup_line($label, 'FAILED: ' . $e->getMessage());
    }
}

// The owner's prompt-set category and the sitting's rationale note (ROADMAP,
// owner's notes 2026-10-01): both additive, both nullable, added the same day
// the tables were first created, so only a dev database made that morning
// needs the ALTER.
jd2_ensure_column($db, 'jd2_prompts', 'category', 'VARCHAR(32) NULL AFTER v1_item_id', 'TEXT NULL');
jd2_ensure_column($db, 'jd2_sessions', 'note', 'TEXT NULL AFTER seat_order', 'TEXT NULL');

// Intake (PLAN-INTAKE, 2026-10-02): the catalogue heading, the size tier and
// the faceted classification one Sonnet call files on the prompt the moment
// it is filed (api/jd2-intake.php). All additive, all nullable.
$sizeByIn = jd2_setup_in(JD2_SIZE_BY);
jd2_ensure_column($db, 'jd2_prompts', 'size_by', 'VARCHAR(16) NULL AFTER size_scale',
    "TEXT NULL CHECK (size_by IS NULL OR size_by IN ($sizeByIn))");
jd2_ensure_column($db, 'jd2_prompts', 'tags', 'TEXT NULL AFTER category', 'TEXT NULL');
jd2_ensure_column($db, 'jd2_prompts', 'intake_version', 'VARCHAR(32) NULL AFTER tags', 'TEXT NULL');
jd2_ensure_column($db, 'jd2_prompts', 'intake_model', 'VARCHAR(64) NULL AFTER intake_version', 'TEXT NULL');
jd2_ensure_column($db, 'jd2_prompts', 'intake_json', 'TEXT NULL AFTER intake_model', 'TEXT NULL');
jd2_ensure_column($db, 'jd2_prompts', 'intake_cost_usd', 'DECIMAL(10,6) NULL AFTER intake_json', 'DECIMAL(10,6) NULL');
jd2_ensure_column($db, 'jd2_prompts', 'intake_at', 'DATETIME NULL AFTER intake_cost_usd', 'TEXT NULL');

// The sanitizer's named normalization (2026-10-02: CDATA sections unwrapped,
// not refused): what it changed between raw_response and svg, a comma-joined
// list of JD2_GEN_NORMALIZED words, NULL when the drawing passed
// byte-identical. Additive, nullable.
jd2_ensure_column($db, 'jd2_generations', 'normalized', 'VARCHAR(64) NULL AFTER disobedience', 'TEXT NULL');

// The sitting's required cells (taxonomy v35, 2026-10-02: the fifth axis,
// Paintwork). jd2-rate stamps on every sitting the cells its rubric required
// — the live axis ids and 'grade', as JSON — and every reader judges a
// sitting against its own stamp (jd2_session_cells), so adding an axis asks
// the next sitting for it without turning the filed ones incomplete and
// emptying the drawer. Additive, nullable (NULL = judged on the live axes).
jd2_ensure_column($db, 'jd2_sessions', 'required_cells', 'TEXT NULL AFTER instrument_version', 'TEXT NULL');

// …and the ONE-OFF BACKFILL for the sittings filed before the stamp existed.
// The rule: from the v2 baseline through taxonomy v34 the v2 rubric's
// required cells were exactly understanding-assignment, structural-coherence,
// layering, jnsq and the grade (JD2_CELLS_BEFORE_V35), so every session
// stamped taxonomy_version < 35 whose required_cells is NULL gets that list.
// Idempotent: a re-run finds no NULL row below v35 and updates nothing. It
// never touches a session stamped v35 or later (jd2-rate stamps those), and
// it changes no judgment, ranking or pair.
try {
    if (jd_has_column($db, 'jd2_sessions', 'required_cells')) {
        $q = $db->prepare('UPDATE jd2_sessions SET required_cells = ?
                            WHERE required_cells IS NULL AND taxonomy_version < ?');
        $q->execute([json_encode(JD2_CELLS_BEFORE_V35), JD2_CELLS_STAMPED_SINCE]);
        $n = $q->rowCount();
        jd_setup_line('required_cells < v35', $n === 0 ? 'nothing to backfill'
            : 'backfilled ' . $n . ' session(s) with ' . implode(', ', JD2_CELLS_BEFORE_V35));
    }
} catch (PDOException $e) {
    $failed++;
    jd_setup_line('required_cells < v35', 'FAILED: ' . $e->getMessage());
}

// The effort profiles split on 2026-10-02 (bench → bench-max, bench-medium,
// bench-low). MySQL needs nothing (VARCHAR, no CHECK); a dev SQLite file made
// before then carries the old profile CHECK and would refuse every new owner
// run, so it is named here instead of failing later in a test.
if ($sqlite) {
    try {
        $ddl = (string) $db->query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'jd2_runs'")->fetchColumn();
        $missingWords = array_values(array_filter(JD2_PROFILE, fn ($w) => !str_contains($ddl, "'" . $w . "'")));
        if ($missingWords) {
            $failed++;
            jd_setup_line('jd2_runs.profile', 'STALE CHECK (no ' . implode(', ', $missingWords)
                . '): delete local-dev/jd-dev.sqlite and re-run both runners');
        } else {
            jd_setup_line('jd2_runs.profile', 'CHECK has every JD2_PROFILE word');
        }
    } catch (PDOException $e) {
        $failed++;
        jd_setup_line('jd2_runs.profile', 'FAILED: ' . $e->getMessage());
    }
}

// --- the ground truth: are all seven there? ---------------------------------
$jd2Tables = ['jd2_prompts', 'jd2_runs', 'jd2_generations', 'jd2_sessions',
              'jd2_judgments', 'jd2_rankings', 'jd2_pairs'];
try {
    $missing = array_values(array_filter($jd2Tables, fn ($t) => !jd_has_table($db, $t)));
    if ($missing) {
        $failed++;
        jd_setup_line('jd2_* tables', 'MISSING: ' . implode(', ', $missing) . ' — see the failure above');
    } else {
        jd_setup_line('jd2_* tables', count($jd2Tables) . ' of ' . count($jd2Tables) . ' present');
    }
} catch (PDOException $e) {
    $failed++;
    jd_setup_line('jd2_* tables', 'FAILED: ' . $e->getMessage());
}

echo "\n" . ($failed === 0 ? "All tables present and migrated.\n" : "$failed statement(s) failed.\n");

// ---------------------------------------------------------------------------

/** "'a','b','c'" — a word list from jd2-config.php as an SQL IN list. */
function jd2_setup_in(array $words): string
{
    return implode(',', array_map(fn ($w) => "'" . str_replace("'", "''", (string) $w) . "'", $words));
}

/** "a|b|c" — a word list from jd2-config.php for a column comment. */
function jd2_setup_words(array $words): string
{
    return implode('|', $words);
}

// PLAN-V2 §3. MySQL 5.7+/MariaDB compatible: no JSON column type (JSON is
// TEXT holding JSON), no AUTO_INCREMENT (every id is an app-generated ULID,
// so ORDER BY id is filing order), no ENUM (enumerated words are VARCHAR(16);
// the allowed words are the jd2-config.php constant named in each comment),
// no CHECK (MySQL before 8.0.16 parses and ignores it; the writers validate).
// Times are UTC 'Y-m-d H:i:s' (jd_now()). Table order matters: a FOREIGN KEY
// may only name a table created above it (see the forward keys in the body).
function jd2_setup_mysql_ddl(): array
{
    $w = [
        'origin'     => jd2_setup_words(JD2_PROMPT_ORIGIN),
        'visibility' => jd2_setup_words(JD2_VISIBILITY),
        'hidden_by'  => jd2_setup_words(JD2_HIDDEN_BY),
        'kind'       => jd2_setup_words(JD2_RUN_KIND),
        'requested'  => jd2_setup_words(JD2_REQUESTED_BY),
        'profile'    => jd2_setup_words(JD2_PROFILE),
        'run_status' => jd2_setup_words(JD2_RUN_STATUS),
        'gen_status' => jd2_setup_words(JD2_GEN_STATUS),
        'gen_normalized' => jd2_setup_words(JD2_GEN_NORMALIZED),
        'role'       => jd2_setup_words(JD2_RATER_ROLE),
        'ses_status' => jd2_setup_words(JD2_SESSION_STATUS),
        'jkind'      => jd2_setup_words(JD2_JUDGMENT_KIND),
        'source'     => jd2_setup_words(JD2_PAIR_SOURCE),
        'size_by'    => jd2_setup_words(JD2_SIZE_BY),
    ];
    return [
        'jd2_prompts' => "
CREATE TABLE IF NOT EXISTS jd2_prompts (
    id                   CHAR(26)     NOT NULL PRIMARY KEY, -- ULID
    text                 TEXT         NOT NULL,             -- the prompt, verbatim
    title                VARCHAR(80)  NULL,                 -- the object's tag title (jd-title draft, accepted)
    origin               VARCHAR(16)  NOT NULL,             -- who wrote it: {$w['origin']} (JD2_PROMPT_ORIGIN)
    created              DATETIME     NOT NULL,             -- filing time, UTC
    size_class           VARCHAR(2)   NULL,                 -- taxonomy.json sizeTiers id
    size_scale           DECIMAL(6,3) NULL,                 -- fine dial on the tier; NULL = 1
    size_by              VARCHAR(16)  NULL,                 -- who set size_class last: {$w['size_by']} (JD2_SIZE_BY); owner is never overwritten by the model
    visibility           VARCHAR(16)  NOT NULL DEFAULT 'draft', -- THE display switch: {$w['visibility']} (JD2_VISIBILITY)
    hidden_by            VARCHAR(16)  NULL,                 -- who hid it: {$w['hidden_by']} (JD2_HIDDEN_BY); NULL unless hidden
    hidden_at            DATETIME     NULL,                 -- when it was hidden; NULL unless hidden
    approved_at          DATETIME     NULL,                 -- reserved: owner approval of a visitor prompt for the public drawer (roadmap)
    approved_by          VARCHAR(16)  NULL,                 -- reserved: who approved it (roadmap; no word list yet)
    shown_run_id         CHAR(26)     NULL,                 -- the run the drawer shows; NULL = the latest complete run
    pinned_generation_id CHAR(26)     NULL,                 -- explicit display pin; NULL = the current session's 1st place
    v1_item_id           VARCHAR(64)  NULL,                 -- lineage: the archived v1 item this prompt descends from
    category             VARCHAR(32)  NULL,                 -- the owner's prompt-set category (free word; ROADMAP 2026-10-01)
    tags                 TEXT         NULL,                 -- JSON {facet id: [heading id…]} (taxonomy.json facets), from intake or the owner
    intake_version       VARCHAR(32)  NULL,                 -- the intake prompt's version (taxonomy.json intakeVersion) at write
    intake_model         VARCHAR(64)  NULL,                 -- the wire model that answered intake ('mock' in dev)
    intake_json          TEXT         NULL,                 -- JSON: the model's answer verbatim + usage + key slot, or the error of a failed intake
    intake_cost_usd      DECIMAL(10,6) NULL,                -- the intake call's cost, priced at write time; NULL when unpriced
    intake_at            DATETIME     NULL,                 -- when intake answered; NULL until it did (a failed intake leaves it NULL)
    visitor_hash         CHAR(64)     NULL,                 -- salted daily visitor hash; NULL for owner prompts
    device_ref           CHAR(36)     NULL,                 -- the browser's kept device UUID; NULL for owner prompts
    consent_version      VARCHAR(16)  NULL,                 -- JD_CONSENT_VERSION the visitor accepted; NULL for owner prompts
    consent_at           DATETIME     NULL,                 -- when they accepted it; NULL for owner prompts
    client_ref           CHAR(36)     NULL,                 -- the browser's UUID for the turn (retry-safe); NULL for owner prompts
    UNIQUE KEY uq_jd2p_client_ref (client_ref),
    KEY idx_jd2p_visibility_created (visibility, created),
    KEY idx_jd2p_visitor_created (visitor_hash, created),
    KEY idx_jd2p_device (device_ref),
    KEY idx_jd2p_v1_item (v1_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        'jd2_runs' => "
CREATE TABLE IF NOT EXISTS jd2_runs (
    id            CHAR(26)    NOT NULL PRIMARY KEY, -- ULID
    prompt_id     CHAR(26)    NOT NULL,             -- the prompt this run drew
    kind          VARCHAR(16) NOT NULL,             -- {$w['kind']} (JD2_RUN_KIND); a rerun is a new run
    requested_by  VARCHAR(16) NOT NULL,             -- {$w['requested']} (JD2_REQUESTED_BY)
    profile       VARCHAR(16) NOT NULL,             -- effort profile: {$w['profile']} (JD2_PROFILE)
    harness       VARCHAR(16) NOT NULL,             -- the harness id stamped at the time (JD_HARNESS_BY_PROFILE)
    pool_version  VARCHAR(32) NOT NULL,             -- the model pool snapshot drawn from (taxonomy.json poolVersion)
    deal          TEXT        NOT NULL,             -- JSON: slot letter => model id, as dealt
    status        VARCHAR(16) NOT NULL DEFAULT 'pending', -- {$w['run_status']} (JD2_RUN_STATUS)
    created       DATETIME    NOT NULL,             -- when the run was filed, UTC
    KEY idx_jd2r_prompt_created (prompt_id, created),
    CONSTRAINT fk_jd2r_prompt FOREIGN KEY (prompt_id) REFERENCES jd2_prompts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // uq_jd2g_run_slot leads with run_id, so it is also the run_id index.
        'jd2_generations' => "
CREATE TABLE IF NOT EXISTS jd2_generations (
    id             CHAR(26)      NOT NULL PRIMARY KEY, -- ULID
    run_id         CHAR(26)      NOT NULL,             -- the run (bracket) this drawing belongs to
    slot           CHAR(1)       NOT NULL,             -- a..z, the seat it was dealt; one per run
    model_id       VARCHAR(64)   NOT NULL,             -- taxonomy.json models id (the join key)
    api_model      VARCHAR(64)   NOT NULL,             -- the exact wire model string sent
    provider       VARCHAR(32)   NOT NULL,             -- anthropic|openai|kimi|google … (taxonomy.json models provider)
    params         TEXT          NOT NULL,             -- JSON: the request parameters as sent
    raw_response   MEDIUMTEXT    NULL,                 -- the provider's body, kept for the record
    svg            MEDIUMTEXT    NULL,                 -- the sanitized artwork; NULL unless status ok
    status         VARCHAR(16)   NOT NULL DEFAULT 'pending', -- {$w['gen_status']} (JD2_GEN_STATUS)
    reject_reason  VARCHAR(64)   NULL,                 -- the sanitizer's frozen reason when rejected
    disobedience   TINYINT       NOT NULL DEFAULT 0,   -- 1 = the SVG had to be dug out of the reply
    normalized     VARCHAR(64)   NULL,                 -- what the sanitizer changed between raw_response and svg: {$w['gen_normalized']}, comma-joined; NULL = nothing
    latency_ms     INT           NULL,                 -- wall time of the provider call
    usage_json     TEXT          NULL,                 -- JSON: the provider's usage object, its own key names (re-priceable)
    cost_usd       DECIMAL(10,6) NULL,                 -- cost snapshotted at write time; NULL when unpriced
    priced         TINYINT       NOT NULL DEFAULT 0,   -- 1 = cost_usd came from a known price row
    hidden         TINYINT       NOT NULL DEFAULT 0,   -- 1 = the owner dropped this drawing from the card
    created        DATETIME      NOT NULL,             -- when the row was filed, UTC
    UNIQUE KEY uq_jd2g_run_slot (run_id, slot),
    KEY idx_jd2g_model (model_id),
    KEY idx_jd2g_created (created),
    CONSTRAINT fk_jd2g_run FOREIGN KEY (run_id) REFERENCES jd2_runs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // The sitting. APPEND-ONLY: a re-rating is a new session. Current =
        // the latest filed session per (run_id, rater_role) — the index below.
        'jd2_sessions' => "
CREATE TABLE IF NOT EXISTS jd2_sessions (
    id                  CHAR(26)    NOT NULL PRIMARY KEY, -- ULID
    run_id              CHAR(26)    NOT NULL,             -- the run being rated
    rater_role          VARCHAR(16) NOT NULL,             -- {$w['role']} (JD2_RATER_ROLE); never pooled
    rater_hash          CHAR(64)    NOT NULL,             -- who: visitor hash, or jd_curator_hash() for the owner
    device_ref          CHAR(36)    NULL,                 -- the browser's kept device UUID, when sent
    client              VARCHAR(16) NOT NULL DEFAULT 'web', -- web|ios|android (JD_CLIENTS)
    taxonomy_version    INT         NOT NULL,             -- taxonomy.json version, stamped server-side
    instrument_version  VARCHAR(16) NOT NULL,             -- JD2_INSTRUMENT_VERSION, stamped server-side
    required_cells      TEXT        NULL,                 -- JSON list: the axis ids + 'grade' this sitting had to carry (jd2_required_cells at filing, taxonomy v35+); readers judge completeness against it
    blind               TINYINT     NOT NULL DEFAULT 1,   -- 1 unless the rater could see model names
    seat_order          TEXT        NULL,                 -- JSON: the slot letters in the order dealt to this rater
    note                TEXT        NULL,                 -- the rater's free-text rationale for the sitting (owner's taxonomy notes; not necessarily shown)
    started_at          DATETIME    NOT NULL,             -- when the sitting opened, UTC
    filed_at            DATETIME    NULL,                 -- when it was filed; NULL while open or abandoned
    status              VARCHAR(16) NOT NULL DEFAULT 'open', -- {$w['ses_status']} (JD2_SESSION_STATUS)
    KEY idx_jd2s_run_role_status (run_id, rater_role, status, filed_at),
    CONSTRAINT fk_jd2s_run FOREIGN KEY (run_id) REFERENCES jd2_runs(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // One cell per (session, drawing, kind, axis). axis_id is '' — not
        // NULL — on a grade cell, so the UNIQUE key also holds for grades
        // (NULLs never collide in a UNIQUE index). It leads with session_id,
        // so it is also the session_id index.
        'jd2_judgments' => "
CREATE TABLE IF NOT EXISTS jd2_judgments (
    id             CHAR(26)     NOT NULL PRIMARY KEY, -- ULID
    session_id     CHAR(26)     NOT NULL,             -- the sitting that filed it
    generation_id  CHAR(26)     NOT NULL,             -- the drawing judged
    kind           VARCHAR(16)  NOT NULL,             -- {$w['jkind']} (JD2_JUDGMENT_KIND)
    axis_id        VARCHAR(64)  NOT NULL DEFAULT '',  -- live taxonomy axis id; '' on a grade
    value          DECIMAL(3,1) NOT NULL,             -- the rank on that scale (grades 1.0-5.0, axes 1-3 or 1-4)
    note           VARCHAR(500) NULL,                 -- the rater's remark on this cell
    UNIQUE KEY uq_jd2j_cell (session_id, generation_id, kind, axis_id),
    KEY idx_jd2j_generation (generation_id),
    CONSTRAINT fk_jd2j_session FOREIGN KEY (session_id) REFERENCES jd2_sessions(id),
    CONSTRAINT fk_jd2j_generation FOREIGN KEY (generation_id) REFERENCES jd2_generations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // The column is rank_pos, never `rank` (reserved in MySQL 8.0), as
        // in v1's jd_ranks. Strict 1..n: uq_jd2rk_place forbids a tie, which
        // is a zero gap instead.
        'jd2_rankings' => "
CREATE TABLE IF NOT EXISTS jd2_rankings (
    id             CHAR(26)    NOT NULL PRIMARY KEY, -- ULID
    session_id     CHAR(26)    NOT NULL,             -- the sitting that filed it
    generation_id  CHAR(26)    NOT NULL,             -- the drawing placed
    rank_pos       TINYINT     NOT NULL,             -- place, 1 = best; strict 1..n, no ties
    gap_after      TINYINT     NULL,                 -- 0..3 margin over the next place (taxonomy gaps); NULL on the last
    UNIQUE KEY uq_jd2rk_generation (session_id, generation_id),
    UNIQUE KEY uq_jd2rk_place (session_id, rank_pos),
    KEY idx_jd2rk_generation (generation_id),
    CONSTRAINT fk_jd2rk_session FOREIGN KEY (session_id) REFERENCES jd2_sessions(id),
    CONSTRAINT fk_jd2rk_generation FOREIGN KEY (generation_id) REFERENCES jd2_generations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

        // One row per unordered pair per session, in canonical order
        // (jd2_pair_key: by slot letter, else by id). uq_jd2pr_pair leads
        // with session_id, so it is also the session_id index.
        'jd2_pairs' => "
CREATE TABLE IF NOT EXISTS jd2_pairs (
    id          CHAR(26)    NOT NULL PRIMARY KEY, -- ULID
    session_id  CHAR(26)    NOT NULL,             -- the sitting that filed or derived it
    gen_a       CHAR(26)    NOT NULL,             -- the canonically first drawing
    gen_b       CHAR(26)    NOT NULL,             -- the canonically second drawing
    score       TINYINT     NOT NULL,             -- -3..+3; positive = gen_a preferred (taxonomy comparison)
    source      VARCHAR(16) NOT NULL,             -- {$w['source']} (JD2_PAIR_SOURCE)
    method      VARCHAR(32) NULL,                 -- derivation id (JD2_DERIVE_METHOD) when derived; NULL when direct
    shown_left  CHAR(26)    NULL,                 -- direct asks: the drawing shown first/left; NULL when derived
    UNIQUE KEY uq_jd2pr_pair (session_id, gen_a, gen_b),
    KEY idx_jd2pr_gen_a (gen_a),
    KEY idx_jd2pr_gen_b (gen_b),
    CONSTRAINT fk_jd2pr_session FOREIGN KEY (session_id) REFERENCES jd2_sessions(id),
    CONSTRAINT fk_jd2pr_gen_a FOREIGN KEY (gen_a) REFERENCES jd2_generations(id),
    CONSTRAINT fk_jd2pr_gen_b FOREIGN KEY (gen_b) REFERENCES jd2_generations(id),
    CONSTRAINT fk_jd2pr_shown_left FOREIGN KEY (shown_left) REFERENCES jd2_generations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
    ];
}

// The same tables, columns, keys and indexes with the mechanical deltas:
// VARCHAR/CHAR/DATETIME/MEDIUMTEXT -> TEXT, TINYINT/INT -> INTEGER, no
// ENGINE/CHARSET/COLLATE, indexes as separate statements (SQLite has no inline
// KEY clause; index names are global in SQLite, hence the table prefixes).
// Plus what only the dev database checks: the allowed words and the numeric
// ranges as CHECK constraints, so a writer bug fails loudly in development.
// The two prompt back-references are inline here (SQLite resolves a forward
// FOREIGN KEY at write time; MySQL adds them in the body, after the CREATEs).
function jd2_setup_sqlite_ddl(): array
{
    $in = [
        'origin'     => jd2_setup_in(JD2_PROMPT_ORIGIN),
        'visibility' => jd2_setup_in(JD2_VISIBILITY),
        'hidden_by'  => jd2_setup_in(JD2_HIDDEN_BY),
        'kind'       => jd2_setup_in(JD2_RUN_KIND),
        'requested'  => jd2_setup_in(JD2_REQUESTED_BY),
        'profile'    => jd2_setup_in(JD2_PROFILE),
        'run_status' => jd2_setup_in(JD2_RUN_STATUS),
        'gen_status' => jd2_setup_in(JD2_GEN_STATUS),
        'role'       => jd2_setup_in(JD2_RATER_ROLE),
        'ses_status' => jd2_setup_in(JD2_SESSION_STATUS),
        'jkind'      => jd2_setup_in(JD2_JUDGMENT_KIND),
        'source'     => jd2_setup_in(JD2_PAIR_SOURCE),
        'size_by'    => jd2_setup_in(JD2_SIZE_BY),
    ];
    $gapMax = JD2_GAP_MAX;
    $scoreMax = JD2_SCORE_MAX;
    return [
        'jd2_prompts' => "
CREATE TABLE IF NOT EXISTS jd2_prompts (
    id                   TEXT     NOT NULL PRIMARY KEY,
    text                 TEXT     NOT NULL,
    title                TEXT     NULL,
    origin               TEXT     NOT NULL CHECK (origin IN ({$in['origin']})),
    created              TEXT     NOT NULL,
    size_class           TEXT     NULL,
    size_scale           DECIMAL(6,3) NULL,
    size_by              TEXT     NULL CHECK (size_by IS NULL OR size_by IN ({$in['size_by']})),
    visibility           TEXT     NOT NULL DEFAULT 'draft' CHECK (visibility IN ({$in['visibility']})),
    hidden_by            TEXT     NULL CHECK (hidden_by IS NULL OR hidden_by IN ({$in['hidden_by']})),
    hidden_at            TEXT     NULL,
    approved_at          TEXT     NULL,
    approved_by          TEXT     NULL,
    shown_run_id         TEXT     NULL,
    pinned_generation_id TEXT     NULL,
    v1_item_id           TEXT     NULL,
    category             TEXT     NULL,
    tags                 TEXT     NULL,
    intake_version       TEXT     NULL,
    intake_model         TEXT     NULL,
    intake_json          TEXT     NULL,
    intake_cost_usd      DECIMAL(10,6) NULL,
    intake_at            TEXT     NULL,
    visitor_hash         TEXT     NULL,
    device_ref           TEXT     NULL,
    consent_version      TEXT     NULL,
    consent_at           TEXT     NULL,
    client_ref           TEXT     NULL,
    UNIQUE (client_ref),
    CONSTRAINT fk_jd2p_shown_run FOREIGN KEY (shown_run_id) REFERENCES jd2_runs(id),
    CONSTRAINT fk_jd2p_pinned_gen FOREIGN KEY (pinned_generation_id) REFERENCES jd2_generations(id)
)",
        'jd2_prompts idx' => "
CREATE INDEX IF NOT EXISTS idx_jd2p_visibility_created ON jd2_prompts (visibility, created);
CREATE INDEX IF NOT EXISTS idx_jd2p_visitor_created ON jd2_prompts (visitor_hash, created);
CREATE INDEX IF NOT EXISTS idx_jd2p_device ON jd2_prompts (device_ref);
CREATE INDEX IF NOT EXISTS idx_jd2p_v1_item ON jd2_prompts (v1_item_id)",

        'jd2_runs' => "
CREATE TABLE IF NOT EXISTS jd2_runs (
    id            TEXT NOT NULL PRIMARY KEY,
    prompt_id     TEXT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ({$in['kind']})),
    requested_by  TEXT NOT NULL CHECK (requested_by IN ({$in['requested']})),
    profile       TEXT NOT NULL CHECK (profile IN ({$in['profile']})),
    harness       TEXT NOT NULL,
    pool_version  TEXT NOT NULL,
    deal          TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ({$in['run_status']})),
    created       TEXT NOT NULL,
    CONSTRAINT fk_jd2r_prompt FOREIGN KEY (prompt_id) REFERENCES jd2_prompts(id)
)",
        'jd2_runs idx' => "
CREATE INDEX IF NOT EXISTS idx_jd2r_prompt_created ON jd2_runs (prompt_id, created)",

        'jd2_generations' => "
CREATE TABLE IF NOT EXISTS jd2_generations (
    id             TEXT     NOT NULL PRIMARY KEY,
    run_id         TEXT     NOT NULL,
    slot           TEXT     NOT NULL CHECK (slot GLOB '[a-z]'),
    model_id       TEXT     NOT NULL,
    api_model      TEXT     NOT NULL,
    provider       TEXT     NOT NULL,
    params         TEXT     NOT NULL,
    raw_response   TEXT     NULL,
    svg            TEXT     NULL,
    status         TEXT     NOT NULL DEFAULT 'pending' CHECK (status IN ({$in['gen_status']})),
    reject_reason  TEXT     NULL,
    disobedience   INTEGER  NOT NULL DEFAULT 0 CHECK (disobedience IN (0, 1)),
    normalized     TEXT     NULL,
    latency_ms     INTEGER  NULL,
    usage_json     TEXT     NULL,
    cost_usd       DECIMAL(10,6) NULL,
    priced         INTEGER  NOT NULL DEFAULT 0 CHECK (priced IN (0, 1)),
    hidden         INTEGER  NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
    created        TEXT     NOT NULL,
    UNIQUE (run_id, slot),
    CONSTRAINT fk_jd2g_run FOREIGN KEY (run_id) REFERENCES jd2_runs(id)
)",
        'jd2_generations idx' => "
CREATE INDEX IF NOT EXISTS idx_jd2g_model ON jd2_generations (model_id);
CREATE INDEX IF NOT EXISTS idx_jd2g_created ON jd2_generations (created)",

        'jd2_sessions' => "
CREATE TABLE IF NOT EXISTS jd2_sessions (
    id                  TEXT     NOT NULL PRIMARY KEY,
    run_id              TEXT     NOT NULL,
    rater_role          TEXT     NOT NULL CHECK (rater_role IN ({$in['role']})),
    rater_hash          TEXT     NOT NULL,
    device_ref          TEXT     NULL,
    client              TEXT     NOT NULL DEFAULT 'web',
    taxonomy_version    INTEGER  NOT NULL,
    instrument_version  TEXT     NOT NULL,
    required_cells      TEXT     NULL,
    blind               INTEGER  NOT NULL DEFAULT 1 CHECK (blind IN (0, 1)),
    seat_order          TEXT     NULL,
    note                TEXT     NULL,
    started_at          TEXT     NOT NULL,
    filed_at            TEXT     NULL,
    status              TEXT     NOT NULL DEFAULT 'open' CHECK (status IN ({$in['ses_status']})),
    CHECK (status <> 'filed' OR filed_at IS NOT NULL),
    CONSTRAINT fk_jd2s_run FOREIGN KEY (run_id) REFERENCES jd2_runs(id)
)",
        'jd2_sessions idx' => "
CREATE INDEX IF NOT EXISTS idx_jd2s_run_role_status ON jd2_sessions (run_id, rater_role, status, filed_at)",

        'jd2_judgments' => "
CREATE TABLE IF NOT EXISTS jd2_judgments (
    id             TEXT     NOT NULL PRIMARY KEY,
    session_id     TEXT     NOT NULL,
    generation_id  TEXT     NOT NULL,
    kind           TEXT     NOT NULL CHECK (kind IN ({$in['jkind']})),
    axis_id        TEXT     NOT NULL DEFAULT '',
    value          DECIMAL(3,1) NOT NULL,
    note           TEXT     NULL,
    CHECK ((kind = 'grade' AND axis_id = '') OR (kind <> 'grade' AND axis_id <> '')),
    UNIQUE (session_id, generation_id, kind, axis_id),
    CONSTRAINT fk_jd2j_session FOREIGN KEY (session_id) REFERENCES jd2_sessions(id),
    CONSTRAINT fk_jd2j_generation FOREIGN KEY (generation_id) REFERENCES jd2_generations(id)
)",
        'jd2_judgments idx' => "
CREATE INDEX IF NOT EXISTS idx_jd2j_generation ON jd2_judgments (generation_id)",

        'jd2_rankings' => "
CREATE TABLE IF NOT EXISTS jd2_rankings (
    id             TEXT     NOT NULL PRIMARY KEY,
    session_id     TEXT     NOT NULL,
    generation_id  TEXT     NOT NULL,
    rank_pos       INTEGER  NOT NULL CHECK (rank_pos >= 1),
    gap_after      INTEGER  NULL CHECK (gap_after IS NULL OR gap_after BETWEEN 0 AND $gapMax),
    UNIQUE (session_id, generation_id),
    UNIQUE (session_id, rank_pos),
    CONSTRAINT fk_jd2rk_session FOREIGN KEY (session_id) REFERENCES jd2_sessions(id),
    CONSTRAINT fk_jd2rk_generation FOREIGN KEY (generation_id) REFERENCES jd2_generations(id)
)",
        'jd2_rankings idx' => "
CREATE INDEX IF NOT EXISTS idx_jd2rk_generation ON jd2_rankings (generation_id)",

        'jd2_pairs' => "
CREATE TABLE IF NOT EXISTS jd2_pairs (
    id          TEXT     NOT NULL PRIMARY KEY,
    session_id  TEXT     NOT NULL,
    gen_a       TEXT     NOT NULL,
    gen_b       TEXT     NOT NULL,
    score       INTEGER  NOT NULL CHECK (score BETWEEN -$scoreMax AND $scoreMax),
    source      TEXT     NOT NULL CHECK (source IN ({$in['source']})),
    method      TEXT     NULL,
    shown_left  TEXT     NULL,
    CHECK (gen_a <> gen_b),
    CHECK ((source = 'derived' AND method IS NOT NULL AND shown_left IS NULL)
        OR (source <> 'derived' AND method IS NULL)),
    CHECK (shown_left IS NULL OR shown_left IN (gen_a, gen_b)),
    UNIQUE (session_id, gen_a, gen_b),
    CONSTRAINT fk_jd2pr_session FOREIGN KEY (session_id) REFERENCES jd2_sessions(id),
    CONSTRAINT fk_jd2pr_gen_a FOREIGN KEY (gen_a) REFERENCES jd2_generations(id),
    CONSTRAINT fk_jd2pr_gen_b FOREIGN KEY (gen_b) REFERENCES jd2_generations(id),
    CONSTRAINT fk_jd2pr_shown_left FOREIGN KEY (shown_left) REFERENCES jd2_generations(id)
)",
        'jd2_pairs idx' => "
CREATE INDEX IF NOT EXISTS idx_jd2pr_gen_a ON jd2_pairs (gen_a);
CREATE INDEX IF NOT EXISTS idx_jd2pr_gen_b ON jd2_pairs (gen_b)",
    ];
}
