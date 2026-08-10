<?php
declare(strict_types=1);

/**
 * jd-spend.php — exact provider spend for Junk Drawer generations.
 *
 * jd-generate.php stores each provider's own usage object verbatim in
 * jd_generations.usage_tokens (see jd-generate.php:171). That column is the
 * authoritative token record, so this script never estimates: it reads the
 * counts the providers themselves reported and multiplies by the rate table in
 * scripts/jd-prices.json.
 *
 * WHERE TO RUN IT
 * ---------------
 * On the server (the normal case — the database is localhost there):
 *     php ~/private_config/jd-spend.php --detail
 *
 * From your Mac against production, if Remote MySQL is open for your IP:
 *     JD_DB_HOST=municipalsky.com php scripts/jd-spend.php --detail
 *
 * Against the local dev SQLite database:
 *     php scripts/jd-spend.php --sqlite=local-dev/jd-dev.sqlite
 *
 * OPTIONS
 * -------
 *   --detail            one row per generation as well as the per-model totals
 *   --since=YYYY-MM-DD  only generations created at/after this UTC date
 *   --submission=ID     only this submission (26-char ULID)
 *   --unrated           only submissions that never got graded (status<>'rated')
 *   --json              machine-readable output instead of the table
 *   --prices=FILE       rate table (default: scripts/jd-prices.json)
 *   --sqlite=FILE       read a SQLite database instead of MySQL
 *
 * Credentials come from jd_secrets() — config/secrets.php locally, the
 * out-of-webroot private_config/secrets.php in production. No key or password
 * is ever written here, which is why this file is safe to commit.
 */

// This reads live credentials and prints spend. It is dev tooling, never a
// web endpoint — scripts/ is excluded from both publish.sh and deploy.yml, and
// this guard makes an accidental upload inert rather than exploitable.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../api/jd-config.php';
ini_set('display_errors', '1');   // jd-config silences these for JSON responses

// ---------------------------------------------------------------------------
// arguments

$opts = [];
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--([a-z-]+)(?:=(.*))?$/', $arg, $m)) {
        $opts[$m[1]] = $m[2] ?? true;
    } else {
        fwrite(STDERR, "Unrecognised argument: $arg\n");
        exit(2);
    }
}
if (isset($opts['help'])) {
    fwrite(STDOUT, file_get_contents(__FILE__, false, null, 0, 2100));
    exit(0);
}

$pricesFile = is_string($opts['prices'] ?? null) ? $opts['prices'] : __DIR__ . '/jd-prices.json';
$priceDoc = json_decode((string) @file_get_contents($pricesFile), true);
if (!is_array($priceDoc) || !isset($priceDoc['prices'])) {
    fwrite(STDERR, "Could not read a price table from $pricesFile\n");
    exit(1);
}
$PRICES = $priceDoc['prices'];

// ---------------------------------------------------------------------------
// connection

try {
    if (is_string($opts['sqlite'] ?? null)) {
        $db = new PDO('sqlite:' . $opts['sqlite'], null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } else {
        $s = jd_secrets();
        foreach (['db_name', 'db_user', 'db_pass'] as $k) {
            if (!isset($s[$k])) {
                fwrite(STDERR, "secrets.php is missing '$k' — is this the right machine?\n");
                exit(1);
            }
        }
        $host = getenv('JD_DB_HOST') ?: 'localhost';
        $db = new PDO(
            "mysql:host=$host;dbname={$s['db_name']};charset=utf8mb4",
            $s['db_user'],
            $s['db_pass'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 15,
            ]
        );
    }
} catch (Throwable $e) {
    fwrite(STDERR, "Database connection failed: " . $e->getMessage() . "\n");
    fwrite(STDERR, "Hint: MySQL defaults to localhost. Off-server, set JD_DB_HOST\n"
                 . "      and open cPanel -> Remote MySQL for your IP first.\n");
    exit(1);
}

// ---------------------------------------------------------------------------
// query

$where = [];
$args = [];
if (is_string($opts['since'] ?? null)) {
    $where[] = 'g.created >= ?';
    $args[] = $opts['since'] . ' 00:00:00';
}
if (is_string($opts['submission'] ?? null)) {
    $where[] = 'g.submission_id = ?';
    $args[] = $opts['submission'];
}
if (isset($opts['unrated'])) {
    $where[] = "s.status <> 'rated'";
}
$sql = 'SELECT g.id, g.submission_id, g.slot, g.model_id, g.model_version, g.provider,
               g.status, g.latency_ms, g.usage_tokens, g.created,
               s.status AS submission_status
          FROM jd_generations g
          LEFT JOIN jd_submissions s ON s.id = g.submission_id'
     . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
     . ' ORDER BY g.created, g.slot';

$stmt = $db->prepare($sql);
$stmt->execute($args);
$rows = $stmt->fetchAll();

// ---------------------------------------------------------------------------
// normalisation
//
// The two providers report usage in different shapes and with different
// inclusion rules. Both are folded to the same four billable buckets here, and
// getting the inclusion rules right is the whole correctness of this script:
//
//   Anthropic /v1/messages — input_tokens EXCLUDES both cache figures, so the
//     three input buckets simply add up.
//   OpenAI /v1/chat/completions — prompt_tokens INCLUDES cached_tokens, so the
//     cached part must be subtracted out to avoid billing it twice at the full
//     rate; and completion_tokens ALREADY INCLUDES reasoning_tokens, so
//     reasoning is reported for visibility but never added on top.
function jd_normalize_usage(string $provider, array $u): array
{
    if ($provider === 'anthropic') {
        return [
            'input'      => (int) ($u['input_tokens'] ?? 0),
            'cache_write'=> (int) ($u['cache_creation_input_tokens'] ?? 0),
            'cache_read' => (int) ($u['cache_read_input_tokens'] ?? 0),
            'output'     => (int) ($u['output_tokens'] ?? 0),
            'reasoning'  => 0,
        ];
    }
    $prompt = (int) ($u['prompt_tokens'] ?? 0);
    $cached = (int) ($u['prompt_tokens_details']['cached_tokens'] ?? 0);
    return [
        'input'      => max(0, $prompt - $cached),
        'cache_write'=> 0,
        'cache_read' => $cached,
        'output'     => (int) ($u['completion_tokens'] ?? 0),
        'reasoning'  => (int) ($u['completion_tokens_details']['reasoning_tokens'] ?? 0),
    ];
}

function jd_cost(array $t, array $p): float
{
    return $t['input']       / 1e6 * (float) ($p['input'] ?? 0)
         + $t['cache_write'] / 1e6 * (float) ($p['cache_write'] ?? 0)
         + $t['cache_read']  / 1e6 * (float) ($p['cache_read'] ?? 0)
         + $t['output']      / 1e6 * (float) ($p['output'] ?? 0);
}

$byModel = [];
$detail = [];
$noUsage = 0;
$unpriced = [];
$grand = 0.0;

foreach ($rows as $r) {
    $usage = $r['usage_tokens'] ? json_decode((string) $r['usage_tokens'], true) : null;
    if (!is_array($usage) || $usage === []) {
        // A slot that never reached the provider (missing key, transport error)
        // or a JD_DEV_MODE mock call. Nothing was billed for it.
        $noUsage++;
        continue;
    }

    $wire = (string) $r['model_version'];
    $t = jd_normalize_usage((string) $r['provider'], $usage);
    $priced = isset($PRICES[$wire]);
    if (!$priced) {
        $unpriced[$wire] = true;
    }
    $cost = $priced ? jd_cost($t, $PRICES[$wire]) : 0.0;
    $grand += $cost;

    if (!isset($byModel[$wire])) {
        $byModel[$wire] = [
            'provider' => $r['provider'], 'calls' => 0, 'priced' => $priced,
            'input' => 0, 'cache_write' => 0, 'cache_read' => 0,
            'output' => 0, 'reasoning' => 0, 'cost' => 0.0,
        ];
    }
    $byModel[$wire]['calls']++;
    foreach (['input', 'cache_write', 'cache_read', 'output', 'reasoning'] as $k) {
        $byModel[$wire][$k] += $t[$k];
    }
    $byModel[$wire]['cost'] += $cost;

    $detail[] = [
        'id' => $r['id'], 'submission_id' => $r['submission_id'], 'slot' => $r['slot'],
        'model' => $wire, 'provider' => $r['provider'], 'status' => $r['status'],
        'submission_status' => $r['submission_status'], 'created' => $r['created'],
        'latency_ms' => $r['latency_ms'], 'tokens' => $t,
        'cost_usd' => $cost, 'priced' => $priced,
    ];
}

// ---------------------------------------------------------------------------
// output

if (isset($opts['json'])) {
    echo json_encode([
        'generations' => count($rows),
        'billed' => count($detail),
        'no_usage_recorded' => $noUsage,
        'unpriced_models' => array_keys($unpriced),
        'prices_fetched' => $priceDoc['_fetched'] ?? null,
        'by_model' => $byModel,
        'total_usd' => $grand,
        'detail' => isset($opts['detail']) ? $detail : null,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
    exit(0);
}

$money = static fn(float $v): string => '$' . number_format($v, 6);
$n = static fn(int $v): string => number_format($v);

echo "\nJunk Drawer spend — ", count($rows), " generation(s) matched, ",
     count($detail), " with recorded usage\n";
echo "Rates from ", basename($pricesFile), " (fetched ", $priceDoc['_fetched'] ?? '?', ")\n\n";

if (isset($opts['detail']) && $detail) {
    printf("%-26s %-4s %-14s %-9s %9s %9s %9s %9s %12s\n",
        'GENERATION', 'SLOT', 'MODEL', 'STATUS', 'IN', 'CACHE', 'OUT', 'REASON', 'COST');
    echo str_repeat('-', 110), "\n";
    foreach ($detail as $d) {
        $cache = $d['tokens']['cache_write'] + $d['tokens']['cache_read'];
        printf("%-26s %-4s %-14s %-9s %9s %9s %9s %9s %12s%s\n",
            $d['id'], $d['slot'], $d['model'], $d['status'],
            $n($d['tokens']['input']), $cache ? $n($cache) : '-',
            $n($d['tokens']['output']),
            $d['tokens']['reasoning'] ? $n($d['tokens']['reasoning']) : '-',
            $money($d['cost_usd']), $d['priced'] ? '' : '  (UNPRICED)');
    }
    echo "\n";
}

printf("%-16s %-10s %6s %10s %10s %10s %10s %14s\n",
    'MODEL', 'PROVIDER', 'CALLS', 'INPUT', 'CACHE', 'OUTPUT', 'REASONING', 'COST');
echo str_repeat('-', 93), "\n";
foreach ($byModel as $wire => $m) {
    $cache = $m['cache_write'] + $m['cache_read'];
    printf("%-16s %-10s %6d %10s %10s %10s %10s %14s%s\n",
        $wire, $m['provider'], $m['calls'], $n($m['input']),
        $cache ? $n($cache) : '-', $n($m['output']),
        $m['reasoning'] ? $n($m['reasoning']) : '-', $money($m['cost']),
        $m['priced'] ? '' : '  (UNPRICED)');
}
echo str_repeat('-', 93), "\n";
printf("%-73s %14s\n", 'TOTAL', $money($grand));

if ($noUsage > 0) {
    echo "\nNote: $noUsage generation(s) had no usage recorded — a slot that never\n",
         "      reached the provider, or a JD_DEV_MOCK run. Nothing was billed.\n";
}
if ($unpriced) {
    echo "\nWARNING: no rate for ", implode(', ', array_keys($unpriced)), " in ",
         basename($pricesFile), ".\n",
         "         Those calls are counted as \$0 — add the model and re-run.\n";
}
echo "\nReasoning tokens are already inside OUTPUT (OpenAI bills them there);\n",
     "the column is shown separately only so you can see what you paid for.\n\n";
