<?php
// Junk Drawer — the shared runtime every jd-* endpoint includes.
// Contracts: PLAN-USER-PROMPTS-CONTRACTS.md C4 (harness), C6 (dev mode).
//
// Sections, in order:
//   1. environment, harness, model pool, limits            (constants)
//   2. secrets + the database handle                       (jd_secrets, jd_db, …)
//   3. ids, timestamps                                     (jd_ulid, jd_now, …)
//   4. responses and request parsing                       (jd_json_out, jd_fail, …)
//   5. the bench gate                                      (jd_bench_keyed, …)
//   6. database error classification + schema probes      (jd_missing_table, …)
//   7. taxonomy access                                     (jd_taxonomy, jd_live_axes, …)
//   8. the ratings fold                                    (jd_fold_ratings, jd_pick_rating)
//   9. SVG extraction                                      (jd_extract_svg)
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
// C4.1 — harness v4-web.2. This constant IS the harness: any edit to these
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

The subject stands alone. Each drawing is a standalone element that will
be placed into someone else's layout, so draw the figure and never the
ground it would sit on. A ship means the ship alone - no water, no sky, no
horizon, no birds. No ground plane, no cast shadow pooled beneath it, no
vignette, no frame. What is structurally part of the subject stays (sails
and rigging are the ship); the setting it would occupy does not. Where the
subject's edge is genuinely unclear, keep what a designer would need and
leave out the rest. If the brief explicitly asks for a setting, follow the
brief.

When the subject is itself a picture-bearing object - a photograph, a
tarot card, a poster, a stamp, a screen - everything inside its own edges
is the subject, the depicted scene and that scene's own background
included. The ground to leave out is only what lies outside the object:
the table it rests on, the wall behind it.
JD_PROMPT;

const JD_HARNESS = 'v4-web.3';

// ---------------------------------------------------------------------------
// EFFORT PROFILES — the reasoning condition, named and versioned.
//
// The visitor turn and a benchmark rerun want opposite things. A visitor is
// watching a loading animation inside JD_PROVIDER_TIMEOUT, so the web profile
// buys latency with thinking. A benchmark wants each model at its best and
// does not care if that takes minutes. Both are legitimate; what is NOT
// legitimate is pooling their results, so each profile carries its own
// harness id and every generation records which one produced it.
//
// APPLES TO APPLES, HONESTLY: these knobs are NOT calibrated against each
// other. Anthropic's effort, OpenAI's and Moonshot's reasoning_effort, and
// Google's thinkingLevel are vendor-defined ordinals over different
// mechanisms — "high" on one is not "high" on another, and no published
// mapping exists. The bench profile therefore does not claim equal compute.
// It claims a uniform CONDITION — every model at its vendor's top documented
// setting — and relies on jd-usage.php's reasoning-token normalisation to
// make the actual spend visible per generation, so the asymmetry lands in the
// data instead of hiding in this file.
//
// What IS genuinely equalised across the four: the system prompt (byte
// identical), the user prompt, JD_MAX_TOKENS, provider-default sampling
// (forced — Opus 5 rejects temperature outright), and pair_order slot
// randomisation.
//
// KNOWN FLAW IN THE WEB PROFILE, left deliberately: openai sends no reasoning
// parameter, so GPT-5.1 runs at its vendor default while the other three are
// explicitly throttled. Fixing it would change visitor behaviour and make
// v3-web.1 data non-comparable with itself, so it stays until the web harness
// is next bumped. The bench profile does not inherit the flaw.
const JD_EFFORT = [
    'web' => [
        // Opus 5 thinks by default; disabled is accepted at effort high or
        // below. NOTE: with thinking off, Opus 5 can leak <thinking> tags
        // into visible output — a plausible source of recorded disobedience
        // on this profile, and another reason the bench profile leaves
        // thinking on.
        'anthropic' => ['thinking' => ['type' => 'disabled']],
        'openai'    => [],
        'kimi'      => ['reasoning_effort' => 'low'],
        'google'    => ['thinking_level' => 'low'],
    ],
    'bench' => [
        // budget_tokens is REMOVED on Opus 5 (400). Effort is output_config,
        // and 'max' requires thinking left on — so no thinking key here.
        'anthropic' => ['output_config' => ['effort' => 'max']],
        'openai'    => ['reasoning_effort' => 'high'],
        'kimi'      => ['reasoning_effort' => 'high'],
        'google'    => ['thinking_level' => 'high'],
    ],
];

// Prompt generation v4 (2026-08-21): the figure-not-ground clause. Revision .2
// dropped the words "CLIP ART" — naming a genre imported its whole visual
// style (flat, simplified, mid-90s) into drawings whose style is supposed to
// come from the brief alone. Same requirement, stated as purpose and
// prohibition instead of as a category (owner catch, 2026-08-21).
// The system prompt is shared by both profiles, so a prompt edit moves BOTH.
// Everything generated before this stays under v3-web.1 and is permanently
// distinguishable — those 77 responses were drawn to a different brief.
// v4-*.3 (owner catch, 2026-08-30): "draw the figure, never the ground" was
// reading too far on picture-bearing subjects — a tarot card came back with
// the card's own face left blank, its printed scene mistaken for background.
// The prompt now says where the object's edge is: everything inside it is
// the subject, and the ground is only what lies outside.
const JD_HARNESS_BY_PROFILE = [
    'web'   => 'v4-web.3',
    'bench' => 'v4-bench.3',
];

// A benchmark run is not on a visitor's clock. CLI has no max_execution_time,
// so this is the only ceiling — generous enough for a thinking model at max
// effort (kimi at DEFAULT effort was observed past 280s).
const JD_BENCH_TIMEOUT = 900;

function jd_effort(string $provider, string $profile): array
{
    return JD_EFFORT[$profile][$provider] ?? [];
}

function jd_harness(string $profile): string
{
    return JD_HARNESS_BY_PROFILE[$profile] ?? JD_HARNESS;
}

// C4.2 — all four pool entries draw every turn: the slot→model assignment
// is chosen per submission by pair_order (0-23, an index into JD_DRAW_PERMS)
// and recorded; the model_id values are taxonomy.json `models` registry ids
// (join keys) and api_model is the exact wire string. Owner runbook: confirm
// wire strings against the providers' model lists at deploy.
const JD_MODEL_POOL = [
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
    // Fourth chair (2026-08-14): Gemini joins the pool. First wired as
    // 3.7-flash because the owner's key was free tier (pro answered 429
    // limit:0); the owner moved the key to a paid plan the same day and the
    // chair became 3.1-pro (probed: a keyhole SVG in 15.5s at thinkingLevel
    // 'low'). api_model is the pinned preview id — 'gemini-pro-latest'
    // would shift under the eval. thinkingLevel 'low' is the same trade the
    // Opus and Kimi entries make. Gemini wraps the SVG in code fences
    // despite the system prompt; jd_extract_svg strips them and the
    // disobedience flag records it.
    ['model_id'  => 'gemini-3-1-pro',
     'api_model' => 'gemini-3.1-pro-preview',
     'provider'  => 'google'],
];

// The 24 slot permutations of the 4-entry pool, indexed by pair_order:
// which POOL entry serves slot a, then b, then c, then d. Same anti-bias
// discipline as the pair shuffle — model identity must never correlate
// with slot position. (pair_order was 0-5 for the trio earlier the same
// day, then 0-23 as ordered draws of 3 from 4 for a few hours — owner
// call, 2026-08-14: every chair draws every turn, no sit-outs.)
const JD_DRAW_PERMS = [
    [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1],
    [0, 3, 1, 2], [0, 3, 2, 1], [1, 0, 2, 3], [1, 0, 3, 2],
    [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0],
    [2, 0, 1, 3], [2, 0, 3, 1], [2, 1, 0, 3], [2, 1, 3, 0],
    [2, 3, 0, 1], [2, 3, 1, 0], [3, 0, 1, 2], [3, 0, 2, 1],
    [3, 1, 0, 2], [3, 1, 2, 0], [3, 2, 0, 1], [3, 2, 1, 0],
];

const JD_MAX_TOKENS = 12000;
// 150 since 2026-08-30 (owner call, raised from 90): Kimi K3 has repeatedly
// missed the old budget — the subway-rat rerun timed out at 90.0s with zero
// bytes received, and the owner has seen the same before — and a failed slot
// costs a lopsided turn plus a full re-run. The whole pool gets the same
// number, deliberately: an uneven budget would fail correlated with the model
// under study (jd-bench-run.php's own argument). The visible trade: the
// darkroom waits for the slowest slot, so a genuinely slow run can now hold
// the reveal up to ~2.5 minutes. curl wall-time doesn't count toward PHP's
// CPU-time execution limit, which is how 90 already lived on this host.
const JD_PROVIDER_TIMEOUT = 150;
const JD_PROVIDER_CONNECT_TIMEOUT = 10;

// C5.2 / APP §4.5 — the consent of record. Must match JD_CONSENT.version in
// junk-drawer.js and the copy quoted in privacy.php. jd-consent-4 (2026-08-14,
// a few hours after -3): the rotation wording ("three of which") gave way to
// the fact — all four providers draw every turn.
const JD_CONSENT_VERSION = 'jd-consent-4';

// C1.2 step 7 — cost controls, tunable in one place post-launch.
//
// RAISED 2026-08-18 (owner call): the owner is the only user for now and the
// re-rating backfill reruns prompts in bulk — 30 items x 4 models is 120
// generations, which the old global 100 would have stopped mid-run. The
// per-visitor caps are effectively off. THE GLOBAL CAP IS DELIBERATELY STILL
// FINITE: jd-generate.php is publicly reachable with no feature flag, and this
// number is the only thing bounding spend at four paid providers if a bot
// finds it. Lower these again when the drawer opens to the public.
const JD_LIMIT_HOURLY = 100000;
const JD_LIMIT_DAILY = 100000;
const JD_LIMIT_GLOBAL_DAILY = 2000;

// The rating bench's auth, in one switch.
//
// FALSE (2026-08-18, owner call): the owner is effectively the only visitor and
// wanted to just open the link and rate. The bench endpoints are therefore
// unauthenticated. What that exposes: anyone who finds two unlinked, noindex
// URLs could file junk ratings, or re-run an idempotent backfill that writes
// nothing new. No spend, no personal data, and fully recoverable — bench rows
// are deletable with `DELETE FROM jd_ratings WHERE client = 'bench'`.
//
// Set this back to true to require jd_bench_key (falling back to jd_setup_key),
// which is the whole of the reversal.
const JD_BENCH_REQUIRE_KEY = false;

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
/**
 * The curator's stable visitor_hash — the owner, rating from the bench, and the
 * filer of the curated backfill's seed rows.
 *
 * msky_visitor_hash() puts the UTC date INSIDE the hash so a visitor cannot be
 * followed across days. That is right for visitors and useless for the curator:
 * a 385-cell pass across three sittings would file the owner as three different
 * raters. This is a fixed value instead, so curated work always groups.
 *
 * It is deliberately NOT secret-derived: nothing is protected by it. A client
 * can never set visitor_hash — the server always assigns it — so a guessable
 * constant forges nothing, and keeping it constant means production needs no
 * extra key and no rotation can orphan already-filed rows. The real rater-class
 * discriminator is the `client` column ('curated' | 'bench' | 'seed' | 'web').
 */
function jd_curator_hash(): string
{
    return hash('sha256', 'municipal-sky-curator-v1');
}

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

function jd_require_get(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        jd_fail(405, 'method_not_allowed', 'GET only.');
    }
}

// The host fronts the site with an edge cache that will cache a header-less
// GET — observed serving a previous deploy's bench queue to a fresh session
// (2026-08-28). Every read the bench or the drawer depends on for live truth
// sends this, so no cache anywhere may store the answer.
function jd_no_store(): void
{
    if (!headers_sent()) {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
    }
}

// A 26-char Crockford ULID as minted by jd_ulid() — the shape of every
// submission and generation id, and the only shape an endpoint accepts.
const JD_ULID_RE = '/^[0-9A-HJKMNP-TV-Z]{26}$/';

function jd_is_ulid(mixed $value): bool
{
    return is_string($value) && preg_match(JD_ULID_RE, $value) === 1;
}

// ---------------------------------------------------------------------------
// The bench gate. JD_BENCH_REQUIRE_KEY (above) is the one switch; while it is
// off — the standing state — every curator endpoint answers keyless. When it
// is on, production callers present jd_bench_key (falling back to the
// jd_setup_key already on file) in X-Bench-Key or ?key=.

/** Does this request hold the bench key, or is no key required? */
function jd_bench_keyed(): bool
{
    if (!JD_IS_PRODUCTION || !JD_BENCH_REQUIRE_KEY) {
        return true;
    }
    $secrets  = jd_secrets();
    $expected = $secrets['jd_bench_key'] ?? ($secrets['jd_setup_key'] ?? null);
    $supplied = $_SERVER['HTTP_X_BENCH_KEY'] ?? ($_GET['key'] ?? '');
    return is_string($expected) && $expected !== ''
        && hash_equals($expected, (string) $supplied);
}

/** 403 unless the caller is keyed (see jd_bench_keyed). */
function jd_require_bench_key(): void
{
    if (!jd_bench_keyed()) {
        jd_fail(403, 'forbidden', 'The bench key is missing or wrong.');
    }
}

// ---------------------------------------------------------------------------
// Database error classification — for the one recoverable failure class, a
// migration that has not been run yet. Deploys are instant and
// setup-jd-tables.php is a manual run, so a reader must be able to tell
// "table not there yet" from "bad statement". Anything these do not match
// re-throws at the call site.

// MySQL says SQLSTATE 42S02 / "Table ... doesn't exist" (8.0: "Base table or
// view not found"); SQLite says "no such table".
function jd_missing_table(PDOException $e): bool
{
    if (($e->getCode() ?: '') === '42S02') {
        return true;
    }
    $msg = $e->getMessage();
    return str_contains($msg, 'no such table')
        || str_contains($msg, "doesn't exist")
        || str_contains($msg, 'Base table or view not found');
}

// MySQL says SQLSTATE 42S22 / "Unknown column"; SQLite says "has no column
// named" (insert) or "no such column" (elsewhere).
function jd_missing_column(PDOException $e): bool
{
    if (($e->getCode() ?: '') === '42S22') {
        return true;
    }
    $msg = $e->getMessage();
    return str_contains($msg, 'no such column')
        || str_contains($msg, 'has no column named')
        || str_contains($msg, 'Unknown column');
}

/** Schema probe, both dialects: does $table exist? */
function jd_has_table(PDO $db, string $table): bool
{
    if (jd_db_driver($db) === 'sqlite') {
        $q = $db->prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?");
        $q->execute([$table]);
    } else {
        $q = $db->prepare('SHOW TABLES LIKE ?');
        $q->execute([$table]);
    }
    return $q->fetch() !== false;
}

/** Schema probe, both dialects: does $table carry $column? */
function jd_has_column(PDO $db, string $table, string $column): bool
{
    if (jd_db_driver($db) === 'sqlite') {
        foreach ($db->query('PRAGMA table_info(' . $table . ')') as $col) {
            if (($col['name'] ?? '') === $column) {
                return true;
            }
        }
        return false;
    }
    $q = $db->prepare('SHOW COLUMNS FROM ' . $table . ' LIKE ?');
    $q->execute([$column]);
    return $q->fetch() !== false;
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

/**
 * The taxonomy, or a 500 — for endpoints that cannot do their job without
 * it. A taxonomy that cannot state its version must not produce rows: a
 * silent 0 in taxonomy_version would be indistinguishable from a real one.
 */
function jd_taxonomy_required(string $who): array
{
    $taxonomy = jd_taxonomy();
    if ($taxonomy === null) {
        error_log($who . ': taxonomy.json could not be read at ' . JD_TAXONOMY_PATH);
        jd_fail(500, 'server_error', 'The rubric could not be read.');
    }
    if (jd_taxonomy_version($taxonomy) < 1) {
        error_log($who . ': taxonomy.json has no usable version field');
        jd_fail(500, 'server_error', 'The rubric could not be read.');
    }
    return $taxonomy;
}

function jd_taxonomy_version(array $taxonomy): int
{
    return (int) ($taxonomy['version'] ?? 0);
}

/** @return array<string,array> live (non-defunct) axes, id => axis, in taxonomy order */
function jd_live_axes(array $taxonomy): array
{
    $axes = [];
    foreach ($taxonomy['axes'] ?? [] as $axis) {
        if (isset($axis['id']) && empty($axis['defunct'])) {
            $axes[(string) $axis['id']] = $axis;
        }
    }
    return $axes;
}

/** @return float[] every grade rank on the scale */
function jd_grade_ranks(array $taxonomy): array
{
    $ranks = [];
    foreach ($taxonomy['grades'] ?? [] as $grade) {
        if (isset($grade['rank'])) {
            $ranks[] = (float) $grade['rank'];
        }
    }
    return $ranks;
}

/** @return array<string,float[]> live axis id => the ranks its values allow */
function jd_axis_ranks(array $taxonomy): array
{
    $out = [];
    foreach (jd_live_axes($taxonomy) as $id => $axis) {
        $ranks = [];
        foreach ($axis['values'] ?? [] as $value) {
            if (isset($value['rank'])) {
                $ranks[] = (float) $value['rank'];
            }
        }
        $out[$id] = $ranks;
    }
    return $out;
}

/** @return array<string,array> the model registry, id => {id,label,vendor} */
function jd_model_registry(array $taxonomy): array
{
    $models = [];
    foreach ($taxonomy['models'] ?? [] as $model) {
        if (isset($model['id'])) {
            $models[(string) $model['id']] = $model;
        }
    }
    return $models;
}

/** @return array<string,array> size tiers, id => tier, in taxonomy order */
function jd_size_tiers(array $taxonomy): array
{
    $tiers = [];
    foreach ($taxonomy['sizeTiers'] ?? [] as $tier) {
        if (isset($tier['id'])) {
            $tiers[(string) $tier['id']] = $tier;
        }
    }
    return $tiers;
}

// Ranks are filed as decimals; match on the DECIMAL(3,1) grid the column
// stores rather than on exact float equality, and return the TAXONOMY's rank
// rather than the client's near-miss — what is stored has to sit exactly on
// the published scale, or a GROUP BY value in the export splits a rank in two.
function jd_rank_on_scale(mixed $value, array $ranks): ?float
{
    if (is_string($value) && is_numeric($value)) {
        $value = (float) $value;
    }
    if (!is_int($value) && !is_float($value)) {
        return null;
    }
    foreach ($ranks as $rank) {
        if (abs($rank - (float) $value) < 0.05) {
            return $rank;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// The ratings fold. jd_ratings is one row per judgment, and three readers
// (data.php, the bench queue, the census) each need "what does this
// generation stand at" with the same precedence rule — the bench's answer
// outranks the turn's own, and a seed grade is a fallback only. One fold,
// one picker, so the rule cannot drift between them.

/**
 * Fold rating rows onto their generations, split by the client that filed
 * them. Rows must carry generation_id, kind, axis_id, value, client and
 * taxonomy_version (note is optional). Only LIVE axes are kept — a rating
 * filed under a retired axis stays in the table as history but never counts
 * toward "complete", a prefill or a chart. Within one client a later row
 * overwrites an earlier one, so order the query by rated_at when it matters.
 *
 * @param array<string,mixed> $liveAxes  id => axis (jd_live_axes)
 * @return array<string,array<string,array{axes:array,axes_version:array,grade:?float,grade_version:?int,note:?string}>>
 *   generation_id => client => the client's standing
 */
function jd_fold_ratings(array $rows, array $liveAxes): array
{
    $fold = [];
    foreach ($rows as $r) {
        $gid = (string) $r['generation_id'];
        $client = (string) ($r['client'] ?? 'web');
        if (!isset($fold[$gid][$client])) {
            $fold[$gid][$client] = [
                'axes' => [], 'axes_version' => [],
                'grade' => null, 'grade_version' => null, 'note' => null,
            ];
        }
        $slot = &$fold[$gid][$client];
        $version = (int) ($r['taxonomy_version'] ?? 0);
        if ($r['kind'] === 'axis') {
            $axis = (string) $r['axis_id'];
            if (isset($liveAxes[$axis])) {
                $slot['axes'][$axis] = (float) $r['value'];
                $slot['axes_version'][$axis] = $version;
            }
        } elseif ($r['kind'] === 'grade') {
            $slot['grade'] = (float) $r['value'];
            $slot['grade_version'] = $version;
        }
        if ($slot['note'] === null && isset($r['note']) && $r['note'] !== null) {
            $slot['note'] = (string) $r['note'];
        }
        unset($slot);
    }
    return $fold;
}

/**
 * One generation's standing, merged across clients in precedence order:
 * the first client in $order that answered an axis (or the grade) wins it.
 * '*' stands for "any client not named earlier", in filing order.
 *
 * @param array<string,array> $byClient  one generation's entry from jd_fold_ratings
 * @param string[] $order  e.g. ['bench', '*'] — the bench outranks everyone
 * @return array{axes:array<string,float>,grade:?float,note:?string}
 */
function jd_pick_rating(array $byClient, array $order): array
{
    $out = ['axes' => [], 'grade' => null, 'note' => null];
    $seen = [];
    $walk = [];
    foreach ($order as $client) {
        if ($client === '*') {
            foreach ($byClient as $c => $_) {
                if (!isset($seen[$c]) && !in_array($c, $order, true)) {
                    $walk[] = $c;
                }
            }
        } elseif (isset($byClient[$client])) {
            $walk[] = $client;
        }
        $seen[$client] = true;
    }
    foreach ($walk as $client) {
        $s = $byClient[$client];
        foreach ($s['axes'] as $axis => $value) {
            if (!array_key_exists($axis, $out['axes'])) {
                $out['axes'][$axis] = $value;
            }
        }
        if ($out['grade'] === null && $s['grade'] !== null) {
            $out['grade'] = $s['grade'];
        }
        if ($out['note'] === null && $s['note'] !== null) {
            $out['note'] = $s['note'];
        }
    }
    return $out;
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
