<?php
// Junk Drawer visitor-prompt feature — shared constants and helpers.
// Contracts: PLAN-USER-PROMPTS-CONTRACTS.md C4 (harness), C6 (dev mode).
//
// Include-only: this file emits no output and starts no session. No cookies,
// no PHP sessions anywhere in this feature (APP §4.3) — msky_visitor_hash()
// is the only server-side identity.

// Warnings must never land inside a JSON body; they go to the error log.
ini_set('display_errors', '0');

// ---------------------------------------------------------------------------
// C6.1 — environment gate
//
// JD_DEV_MODE cannot become true on Bluehost: the production secrets file
// exists by definition there (database.php loads it on every request), so
// JD_IS_PRODUCTION short-circuits the && before the env var is consulted.
// The env var is a second, independent opt-in that shared hosting cannot set.
define('JD_IS_PRODUCTION', is_readable('/home1/tdrivemy/private_config/secrets.php'));
define('JD_DEV_MODE', !JD_IS_PRODUCTION && getenv('JD_DEV_MOCK') === '1');

// ---------------------------------------------------------------------------
// C4.1 — harness v3-web.1. This constant IS the harness: any edit to these
// bytes requires bumping JD_HARNESS ('v3-web.2', ...), because responses
// generated under different harnesses are not strictly comparable.
const JD_SYSTEM_PROMPT = <<<'JD_PROMPT'
You are an SVG generator. The user's message is a creative brief. Make
the artwork and reply with the SVG document alone.

Output a single complete SVG document and nothing else - no prose, no
code fences. Requirements: xmlns and a viewBox on the root; the artwork
must fill the viewBox edge to edge (at most ~2% margin - no empty space
around the subject); transparent background (no opaque backdrop
rectangle); fully self-contained (no external references, no <script>,
no event attributes, no <foreignObject>, no raster images).
JD_PROMPT;

const JD_HARNESS = 'v3-web.1';

// C4.2 — the slot→model assignment is chosen per submission by pair_order
// (0-5, an index into JD_TRIO_PERMS) and recorded; the model_id values are
// taxonomy.json `models` registry ids (join keys) and api_model is the exact
// wire string. Owner runbook: confirm wire strings against the providers'
// model lists at deploy.
const JD_MODEL_TRIO = [
    // Owner upgrade (2026-08-10): flagship tier — Claude Opus 5 vs GPT-5.1.
    // Opus 5 note: thinking is ON by default on this model; jd-generate
    // sends thinking:disabled (valid at default effort) so generation stays
    // single-pass inside JD_PROVIDER_TIMEOUT on shared hosting.
    ['model_id'  => 'claude-opus-5',
     'api_model' => 'claude-opus-5',
     'provider'  => 'anthropic'],
    ['model_id'  => 'gpt-5-1',
     'api_model' => 'gpt-5.1',
     'provider'  => 'openai'],
    // Third chair (2026-08-14): Kimi K3 joins every turn (slot c). Wire id
    // confirmed against /v1/models the same day. kimi-k3 reasons by default
    // (~25 tok/s observed; an SVG at default effort ran past 280s), so
    // jd-generate sends reasoning_effort:'low' — the same trade the Opus
    // entry makes with thinking:disabled, and recorded in params the same
    // way. Probed 2026-08-14: effort 'low' answered a paperclip SVG in 7s.
    ['model_id'  => 'kimi-k3',
     'api_model' => 'kimi-k3',
     'provider'  => 'kimi'],
];

// The 6 slot permutations, indexed by pair_order: which TRIO entry serves
// slot a, then b, then c. Same anti-bias discipline as the pair shuffle —
// model identity must never correlate with slot position.
const JD_TRIO_PERMS = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2],
    [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

const JD_MAX_TOKENS = 12000;
const JD_PROVIDER_TIMEOUT = 90;
const JD_PROVIDER_CONNECT_TIMEOUT = 10;

// C5.2 / APP §4.5 — the consent of record. Must match JD_CONSENT.version in
// junk-drawer.js and the copy quoted in privacy.php. jd-consent-2 (2026-08-14):
// the disclosure gains a third provider, Moonshot AI (Kimi).
const JD_CONSENT_VERSION = 'jd-consent-2';

// C1.2 step 7 — cost controls, tunable in one place post-launch.
const JD_LIMIT_HOURLY = 3;
const JD_LIMIT_DAILY = 10;
const JD_LIMIT_GLOBAL_DAILY = 100;

const JD_PROMPT_MAX_CHARS = 500;
const JD_NOTE_MAX_CHARS = 500;
const JD_RATINGS_MAX = 64;

// APP §4.4 — declared by the client, never sniffed from User-Agent.
const JD_CLIENTS = ['web', 'ios', 'android'];

const JD_TAXONOMY_PATH = __DIR__ . '/../art/junk-drawer/taxonomy.json';
const JD_DEV_DB_PATH = __DIR__ . '/../local-dev/jd-dev.sqlite';

// ---------------------------------------------------------------------------
// Secrets — the api/database.php pattern (local config first, then the
// out-of-webroot production file). Returns [] when neither exists, which is
// the container's state; jd_db() and the provider calls handle that.
function jd_secrets(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $local = __DIR__ . '/../config/secrets.php';
    $loaded = null;
    if (is_readable($local)) {
        $loaded = include $local;
    } elseif (JD_IS_PRODUCTION) {
        $loaded = include '/home1/tdrivemy/private_config/secrets.php';
    }
    $cache = is_array($loaded) ? $loaded : [];
    return $cache;
}

// ---------------------------------------------------------------------------
// C6.1 — one PDO for the request. Production/local-with-MySQL reuse
// database.php verbatim; dev mode gets a SQLite file created on demand.
function jd_db(bool $fresh = false): PDO
{
    static $shared = null;
    if (!$fresh && $shared instanceof PDO) {
        return $shared;
    }
    if ($fresh) {
        // Drop the dead handle before rebuilding, so a failed reconnect cannot
        // hand the old one back out. See jd_db_retry() below.
        $shared = null;
    }

    if (JD_DEV_MODE) {
        $dir = dirname(JD_DEV_DB_PATH);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $shared = new PDO('sqlite:' . JD_DEV_DB_PATH, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $shared->exec('PRAGMA foreign_keys = ON');
        return $shared;
    }

    // database.php dies on failure, so the two things this feature cares
    // about have to be arranged before it is reached:
    //   - missing credentials become an exception the endpoints can turn into
    //     the C1 error envelope;
    //   - a live-but-unreachable database at least answers 500 + JSON rather
    //     than database.php's default 200 + HTML page, which is the only
    //     branch that file offers and is keyed on this header.
    //
    // That second one is why HTTP_ACCEPT is overwritten below: database.php
    // reads $_SERVER['HTTP_ACCEPT'] to choose its die() format and is not
    // ours to edit (C7). The write is deliberate and must stay next to the
    // require — anyone reading database.php's failure branch and wondering
    // who set that header is looking at these three lines.
    $secrets = jd_secrets();
    foreach (['db_name', 'db_user', 'db_pass'] as $key) {
        if (!isset($secrets[$key])) {
            throw new PDOException('database credentials are not configured');
        }
    }
    $_SERVER['HTTP_ACCEPT'] = 'application/json';

    require __DIR__ . '/database.php';
    /** @var PDO $pdo — defined by database.php */
    $shared = $pdo;
    return $shared;
}

// ---------------------------------------------------------------------------
// C6.2 — surviving a connection that died while the provider was working.
//
// A generation holds this connection open and completely idle for the 60-120s
// of the provider call, and shared hosting will sometimes close it in that
// window. The symptom is a 2006/2013 on the FIRST write after the call returns:
// jd_finish_generation() throws, jd-generate.php's catch answers 500, and the
// row it was about to settle is stranded at 'pending' forever — no
// reject_reason, no latency_ms, no usage_tokens, because the statement that
// records all three is the one that failed. That is indistinguishable in the
// database from a request that died mid-flight, which is what made it hard to
// read. Observed 2026-08-14 01:42:16Z on generation 01KZYYVZMWM4R4TRC1P43CNSMW,
// 76s into an Opus 5 call, with the cause visible only in the PHP error log.
//
// Note this is NOT plain wait_timeout: the session value is 3600, and an idle
// connection measurably survives 180s on this host. Whatever governor is
// closing it, the write path must not assume the connection outlived the
// provider call.
function jd_db_connection_lost(PDOException $e): bool
{
    $driverCode = $e->errorInfo[1] ?? null;
    if ($driverCode === 2006 || $driverCode === 2013) {
        return true;
    }
    $message = $e->getMessage();
    return stripos($message, 'server has gone away') !== false
        || stripos($message, 'Lost connection') !== false;
}

/**
 * Run one database write, reconnecting and replaying it EXACTLY once if the
 * connection died. Any other PDOException propagates untouched to the C1 error
 * envelope — this recovers a dead socket, not a bad statement.
 *
 * Only safe for idempotent writes. Every call site guards on the row state it
 * is leaving (`WHERE ... AND status = 'pending'`), so a replay that lands after
 * a partially-applied first attempt is a no-op rather than a double write.
 *
 * @param callable(PDO):mixed $work
 * @return mixed
 */
function jd_db_retry(callable $work, ?PDO $db = null)
{
    try {
        return $work($db ?? jd_db());
    } catch (PDOException $e) {
        if (!jd_db_connection_lost($e)) {
            throw $e;
        }
        error_log('jd: database connection lost across the provider call; '
            . 'reconnecting and replaying — ' . $e->getMessage());
        return $work(jd_db(true));
    }
}

function jd_db_driver(PDO $db): string
{
    return (string) $db->getAttribute(PDO::ATTR_DRIVER_NAME);
}

// The two dialects' spellings of the same race-losing-write-is-a-no-op INSERT.
function jd_insert_ignore(PDO $db): string
{
    return jd_db_driver($db) === 'sqlite' ? 'INSERT OR IGNORE INTO' : 'INSERT IGNORE INTO';
}

// ---------------------------------------------------------------------------
// C1 — 26-char Crockford base32 ULID: 48-bit ms timestamp + 80 bits of
// random_bytes entropy. Possession of a submission_id is the capability to
// rate it, so the random half must be unguessable, not merely unique.
function jd_ulid(): string
{
    $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

    $ms = (int) floor(microtime(true) * 1000);
    $time = '';
    for ($i = 0; $i < 10; $i++) {
        $time = $alphabet[$ms % 32] . $time;
        $ms = intdiv($ms, 32);
    }

    // 256 is an exact multiple of 32, so the modulo is unbiased.
    $random = '';
    foreach (str_split(random_bytes(16)) as $byte) {
        $random .= $alphabet[ord($byte) % 32];
    }

    return $time . $random;
}

// All timestamps written by this feature are UTC 'Y-m-d H:i:s' strings, which
// sort lexicographically on both MySQL DATETIME and SQLite TEXT — so every
// cutoff is computed here in PHP and bound as a parameter, never NOW().
function jd_now(): string
{
    return gmdate('Y-m-d H:i:s');
}

function jd_utc_midnight(): string
{
    return gmdate('Y-m-d 00:00:00');
}

function jd_seconds_to_utc_midnight(): int
{
    return 86400 - (time() % 86400);
}

// ---------------------------------------------------------------------------
// Responses. Content-Type: application/json on every response, including
// errors. CORS headers come from jd-origin.php only.
function jd_json_out(int $status, array $payload): void
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json');
    }
    echo json_encode($payload);
    exit;
}

// C1.2 error envelope. $context carries submission_id / gen_id / slot when
// they exist by this point, and retry_after for the two throttled codes.
function jd_fail(int $status, string $code, string $message, array $context = []): void
{
    $payload = ['ok' => false];
    foreach (['submission_id', 'gen_id', 'slot'] as $key) {
        if (isset($context[$key]) && $context[$key] !== null) {
            $payload[$key] = $context[$key];
        }
    }
    $payload['error'] = ['code' => $code, 'message' => $message];
    if (isset($context['retry_after'])) {
        $payload['retry_after'] = (int) $context['retry_after'];
        if (!headers_sent()) {
            header('Retry-After: ' . (int) $context['retry_after']);
        }
    }
    jd_json_out($status, $payload);
}

function jd_require_post(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        jd_fail(405, 'method_not_allowed', 'This endpoint accepts POST only.');
    }
}

// Any client-held identifier travels in the JSON body — never a cookie.
function jd_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        jd_fail(400, 'bad_request', 'A JSON request body is required.');
    }
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        jd_fail(400, 'bad_request', 'The request body could not be read as JSON.');
    }
    return $body;
}

// APP §4.4 — anything unrecognised silently becomes 'web'.
function jd_normalize_client(mixed $value): string
{
    return (is_string($value) && in_array($value, JD_CLIENTS, true)) ? $value : 'web';
}

// C1.3 step 4/5 — the server's own copy of taxonomy.json is authoritative for
// rating validation and for the taxonomy_version stamp.
function jd_taxonomy(): ?array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache ?: null;
    }
    $raw = @file_get_contents(JD_TAXONOMY_PATH);
    if ($raw === false) {
        $cache = false;
        return null;
    }
    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        $cache = false;
        return null;
    }
    $cache = $parsed;
    return $cache;
}

// ---------------------------------------------------------------------------
// C4.4 — extraction. First '<svg' (case-insensitive) through the last
// '</svg>'; the span is the artifact. Never repaired, reformatted or
// re-serialized: what is stored is byte-exact model output.
function jd_extract_svg(string $text): ?string
{
    $start = stripos($text, '<svg');
    if ($start === false) {
        return null;
    }
    $end = strripos($text, '</svg>');
    if ($end === false || $end < $start) {
        return null;
    }
    return substr($text, $start, $end + 6 - $start);
}
