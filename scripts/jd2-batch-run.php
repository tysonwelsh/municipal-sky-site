<?php
/**
 * jd2-batch-run.php — the CSV batch runner for the v2 rating campaign
 * (PLAN-V2 §11, owner 2026-10-01). CLI only.
 *
 *   php scripts/jd2-batch-run.php prompts.csv --dry-run          # the plan, no drawing
 *   php scripts/jd2-batch-run.php prompts.csv                    # run it (bench-medium)
 *   php scripts/jd2-batch-run.php prompts.csv --profile bench-low   # the same rows, low effort
 *   php scripts/jd2-batch-run.php prompts.csv --resume           # carry on after a stop
 *   php scripts/jd2-batch-run.php --rate-url                     # where to rate what ran
 *
 * Options: --base URL (default https://municipalsky.com), --dry-run, --resume,
 * --profile bench-medium|bench-low|bench-max (default bench-medium, the
 * owner's default, JD2_OWNER_DEFAULT_PROFILE; `bench` means that default),
 * --rate-url (print the bench URLs at the end), --local (see below),
 * --state PATH (default local-dev/jd2-batch-state.json).
 *
 * WHAT IT DOES. The owner curates the campaign's prompts into a CSV. For each
 * row this files the prompt and draws it against the whole pool under the
 * chosen effort profile (api/jd-config.php JD_EFFORT: every model at its
 * vendor's low, medium or top rung) through the
 * ordinary owner path, POST api/jd2-generate.php with the bench key: ONE MODEL
 * PER REQUEST, the pool's slots a, b, c, d … IN SEQUENCE, never two drawings in
 * one call. Each request blocks until its model answers (a bench call may take
 * JD_BENCH_TIMEOUT seconds; curl waits that plus 30 s), so nothing is polled.
 * The profile is sent explicitly on every request, so the run's profile and
 * harness are the ones named here, whatever the server's default.
 * The owner runs it and walks away; the drawings land as `draft` prompts and
 * the bench's backlog (jd2-queue.php) offers each one as soon as its run has
 * settled. One line per drawing (row, slot, model, status, latency, cost) and
 * a running total.
 *
 * THE CSV. A header row, then one prompt per row (UTF-8; a leading BOM is
 * fine). Columns, by header name:
 *   prompt       required — verbatim, byte for byte, as the prompt of record
 *   title        optional — the tag title, filed through jd2-curate.php
 *   size         optional — a taxonomy.json sizeTiers id (xs s m l xl)
 *   category     optional — the owner's prompt-set category, a free word of
 *                at most 32 characters (jd2_prompts.category), filed with
 *                the title and size through jd2-curate.php
 *   v1_item_id   optional — lineage to the archived v1 item. When empty, a
 *                prompt whose text is EXACTLY a legacy item's entry.json prompt
 *                (art/junk-drawer/legacy/items/) gets that item's id
 *   rerun_of     optional — a v2 prompt id: draw a NEW run of that prompt
 *                instead of filing a new one (its stored text is what is
 *                sent; the row's prompt is only the state key and the label)
 *
 * RERUNS BY PROFILE (2026-10-02). One prompt drawn under three settings is
 * three RUNS of one prompt, not three prompts — that is what runs, the ledger
 * and shown_run_id are for. So a row with no rerun_of whose text is EXACTLY
 * an owner prompt already on file (any profile; the server's ledger is asked
 * once, before anything is drawn; a hidden prompt does not count; the oldest
 * wins) is filed as a rerun of that prompt (rerun_of: <its id>) instead of a
 * new prompt. The decision is made once, when the row first starts, and kept
 * in the state file, so a --resume never changes it. --dry-run prints, per
 * row, `new prompt` or `rerun <id>` (with `same text, on file` when matched).
 *
 * THE INTAKE. After a new row's first drawing lands (the prompt row exists
 * then), it asks api/jd2-intake.php for the clerk's heading, size tier and
 * classification (prompt_id with the key) and logs them; skipped when the
 * CSV gave both a title and a size, and for rerun_of rows. The CSV's title
 * and size, filed through jd2-curate.php after the drawings, stand over the
 * clerk's (the size as size_by 'owner').
 *
 * THE STATE FILE (local-dev/, gitignored) remembers, per base URL ('local' for
 * --local) and keyed by PROFILE AND prompt text (`[bench-medium] a tin robot`),
 * the client_ref minted for the row, the profile, the prompt and run ids,
 * rerun_of when the row is a rerun, and each slot's outcome. The same CSV can
 * therefore run once per profile, each run its own row of state. It is
 * written BEFORE the first request of a row and after every answer, so a stop
 * at any point resumes without filing anything twice: jd2-generate.php is
 * idempotent per (client_ref, slot), and a rerun is rejoined by its run id —
 * and if the first request of a rerun was lost before its run id came back,
 * --resume adopts the rerun that request made (the ledger's oldest unclaimed
 * rerun of that prompt under this profile, filed after the request was sent)
 * instead of making a second one. --resume skips the rows whose every slot
 * has settled and finishes the rest; without --resume a row already in the
 * state file for this profile is refused (pass --resume, or move the state
 * file aside to start over). Entries written before the profile split (keyed
 * by text alone, the retired `bench` profile) are never resumed; their
 * prompts are on file, so those rows become reruns.
 *
 * THE SPEND GUARD. Before anything is drawn it asks the server how many
 * drawings today's global breaker has left (jd2-queue.php?count=1;
 * JD_LIMIT_GLOBAL_DAILY counts every drawing since UTC midnight, the owner's
 * included) and refuses to start when the plan needs more, saying how many
 * rows fit. The breaker is the real limit — this only refuses early instead
 * of stopping half-way; if it trips mid-run anyway (visitors drew meanwhile)
 * the runner stops at the 503 and --resume continues after midnight UTC.
 *
 * THE KEY. JD_BENCH_KEY from the environment (jd_bench_key in the server's
 * private_config/secrets.php), sent as X-Bench-Key and never printed.
 *
 * --local starts its own `php -S` on a free 127.0.0.1 port with the worktree
 * as document root and JD_DEV_MOCK=1, so the mock provider answers and the
 * dev SQLite file (local-dev/jd-dev.sqlite) takes the rows: the whole runner
 * is testable without a network or a provider. It presents the dev checkout's
 * own bench key (config/secrets.php; keyless when there is none) and ignores
 * JD_BENCH_KEY. scripts/test-jd2-reads.php drives it that way.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "CLI only. This spends real money at every provider in the pool.\n";
    exit(1);
}

require_once __DIR__ . '/../api/jd2-config.php';

$root = realpath(__DIR__ . '/..');

// --- arguments ------------------------------------------------------------
$args = array_slice($argv, 1);
$opt = ['base' => 'https://municipalsky.com', 'dry-run' => false, 'resume' => false, 'rate-url' => false,
        'local' => false, 'state' => $root . '/local-dev/jd2-batch-state.json', 'profile' => JD2_OWNER_DEFAULT_PROFILE];
$csvPath = null;
for ($i = 0; $i < count($args); $i++) {
    $a = $args[$i];
    if ($a === '--base' || $a === '--state' || $a === '--profile') {
        $opt[substr($a, 2)] = $args[++$i] ?? bail("$a needs a value.");
    } elseif (in_array($a, ['--dry-run', '--resume', '--rate-url', '--local'], true)) {
        $opt[substr($a, 2)] = true;
    } elseif ($a !== '' && $a[0] === '-') {
        bail("Unknown option $a. See the header of scripts/jd2-batch-run.php.");
    } else {
        $csvPath = $a;
    }
}
if ($csvPath === null && !$opt['rate-url']) {
    bail('Usage: php scripts/jd2-batch-run.php prompts.csv [--profile bench-medium|bench-low|bench-max] [--base URL] [--dry-run] [--resume] [--rate-url] [--local]');
}
// the profile: one of the bench rungs (`bench` is the owner's default, named)
$benchProfiles = array_values(array_filter(JD2_OWNER_PROFILES, fn ($p) => $p !== 'web'));
$profile = jd2_owner_profile($opt['profile']);
if (!in_array($profile, $benchProfiles, true)) {
    bail("--profile must be one of: " . implode(', ', $benchProfiles) . ' (or bench, the default: ' . JD2_OWNER_DEFAULT_PROFILE . ').');
}

$taxonomy = jd_taxonomy();
if (!is_array($taxonomy)) {
    bail('taxonomy.json is missing or unreadable.');
}
$poolSize = count(jd2_pool($taxonomy));
$slots = str_split(substr(JD2_SLOT_LETTERS, 0, $poolSize));
$timeout = jd_profile_timeout($profile) + 30;

// --- where, and with which key --------------------------------------------
if ($opt['local']) {
    $opt['base'] = start_local_server($root);
    $key = jd_bench_key_expected() ?? 'keyless-dev-checkout';
    $timeout = 120;
} else {
    $key = (string) getenv('JD_BENCH_KEY');
    if ($key === '') {
        bail('JD_BENCH_KEY is not set — export the bench key (jd_bench_key in private_config/secrets.php) and rerun.');
    }
}
$base = rtrim($opt['base'], '/');
$host = parse_url($base, PHP_URL_HOST) ?: '';
$originHeader = in_array($host, ['127.0.0.1', 'localhost'], true)
    ? 'http://localhost:8000'          // the dev allowlist (jd-origin.php)
    : (parse_url($base, PHP_URL_SCHEME) . '://' . $host);

// --- the state file -------------------------------------------------------
$stateAll = is_file($opt['state']) ? json_decode((string) file_get_contents($opt['state']), true) : null;
if (!is_array($stateAll) || !isset($stateAll['bases']) || !is_array($stateAll['bases'])) {
    $stateAll = ['version' => 1, 'bases' => []];
}
// --local gets a new port every time, so its rows are kept under one stable name
$stateKey = $opt['local'] ? 'local' : $base;
$state = &$stateAll['bases'][$stateKey];
$state ??= [];

if ($csvPath === null) {
    print_rate_urls($base, $state, null);
    exit(0);
}

// --- the CSV, read and checked before anything is spent --------------------
$rows = read_csv($csvPath, $taxonomy, $root);

// rows that would start fresh without a rerun_of: is their text on file already?
$fresh = array_filter($rows, fn ($r) => !isset($state[state_key($profile, $r['prompt'])]) && $r['rerun_of'] === '');
$onFile = $fresh ? owner_prompts_by_text($base) : [];

$plan = [];
$refusedDone = [];
$requests = 0;
foreach ($rows as $n => $row) {
    $entry = $state[state_key($profile, $row['prompt'])] ?? null;
    $settled = $entry === null ? 0 : count(array_filter($entry['slots'] ?? [], fn ($s) => in_array($s, ['ok', 'failed', 'rejected', 'beyond'], true)));
    $want = $entry !== null && isset($entry['dealt']) ? (int) $entry['dealt'] : $poolSize;
    if ($entry !== null && !$opt['resume']) {
        $refusedDone[] = '#' . ($n + 1) . ' "' . clip($row['prompt']) . '"';
        continue;
    }
    if ($entry !== null && $settled >= $want) {
        continue;   // --resume: done, skipped
    }
    $plan[] = $n;
    $requests += $want - $settled;
    // new prompt or rerun: an entry's own decision stands; a fresh row takes
    // the CSV's rerun_of, else the oldest owner prompt on file with its text
    $rows[$n]['plan_rerun_of'] = $entry !== null ? (string) ($entry['rerun_of'] ?? '')
        : ($row['rerun_of'] !== '' ? $row['rerun_of'] : (string) ($onFile[$row['prompt']] ?? ''));
    $rows[$n]['plan_matched'] = $entry !== null ? !empty($entry['auto_rerun'])
        : ($row['rerun_of'] === '' && isset($onFile[$row['prompt']]));
}
if ($refusedDone) {
    bail(count($refusedDone) . " row(s) are already in the state file for $stateKey:\n  " . implode("\n  ", $refusedDone)
        . "\nPass --resume to skip the finished ones and finish the rest, or move " . $opt['state'] . ' aside to start over.');
}

echo "jd2-batch-run · $base · " . count($rows) . ' rows in ' . basename($csvPath) . ' · pool of ' . $poolSize
    . ' (' . implode(', ', $slots) . ") · profile $profile (harness " . jd_harness($profile) . ', budget '
    . jd_max_tokens($profile) . ' tokens, in this checkout) · one model per request' . "\n";
foreach ($plan as $n) {
    $row = $rows[$n];
    echo sprintf("  #%-3d %s  %s%s%s%s\n", $n + 1, $row['plan_rerun_of'] !== ''
            ? 'rerun ' . $row['plan_rerun_of'] . ($row['plan_matched'] ? ' (same text, on file)' : '') : 'new prompt',
        '"' . clip($row['prompt']) . '"',
        $row['title'] !== '' ? ' · title "' . $row['title'] . '"' : '',
        ($row['size'] !== '' ? ' · size ' . $row['size'] : '') . ($row['category'] !== '' ? ' · ' . $row['category'] : ''),
        $row['v1_item_id'] !== '' ? ' · v1 ' . $row['v1_item_id'] . ($row['v1_auto'] ? ' (matched by text)' : '') : '');
}
$skipped = count($rows) - count($plan);
echo 'plan: ' . count($plan) . ' row(s) to draw, ' . $skipped . " already done · $requests request(s)\n";

// --- the spend guard ------------------------------------------------------
[$st, $count] = http('GET', $base . '/api/jd2-queue.php?count=1', null, 30);
if ($st !== 200 || !isset($count['today']['remaining'])) {
    bail('Could not read today\'s spend counter (' . $st . ' ' . ($count['error']['message'] ?? '') . ') — nothing was drawn.');
}
$t = $count['today'];
echo 'breaker: ' . $t['generations'] . ' of ' . $t['limit'] . ' drawings used today (UTC), ' . $t['remaining'] . " left\n";
if ($requests > $t['remaining']) {
    $fit = intdiv((int) $t['remaining'], max(1, $poolSize));
    $msg = "This plan needs $requests drawings and today's breaker has {$t['remaining']} left (JD_LIMIT_GLOBAL_DAILY = {$t['limit']}, "
        . 'resets at 00:00 UTC, in ' . round($t['resets_in_s'] / 3600, 1) . " h).\n"
        . "  · run the first $fit row(s) now (split the CSV) and the rest after midnight UTC with --resume, or\n"
        . '  · raise JD_LIMIT_GLOBAL_DAILY in api/jd-config.php for the campaign and deploy it first.';
    if ($opt['dry-run']) {
        echo "WOULD REFUSE: $msg\n";
        exit(0);
    }
    bail("Refusing to start. $msg");
}

if ($opt['dry-run']) {
    $first = $plan ? $rows[$plan[0]] : null;
    if ($first !== null) {
        echo 'first request: POST ' . $base . '/api/jd2-generate.php  X-Bench-Key: <redacted>  '
            . json_encode(slot_body($first, ['client_ref' => '<minted per row>', 'rerun_of' => $first['plan_rerun_of']], $slots[0], $profile)) . "\n";
    }
    echo "dry run: nothing drawn.\n";
    exit(0);
}

// --- the run ----------------------------------------------------------------
$spent = 0.0;
$tally = ['ok' => 0, 'failed' => 0, 'rejected' => 0, 'other' => 0];
$ran = [];
foreach ($plan as $k => $n) {
    $row = $rows[$n];
    $entry = &$state[state_key($profile, $row['prompt'])];
    $entry ??= ['client_ref' => jd_uuid4(), 'profile' => $profile, 'prompt' => $row['prompt'],
                'rerun_of' => $row['plan_rerun_of'] !== '' ? $row['plan_rerun_of'] : null,
                'auto_rerun' => $row['plan_matched'],
                'prompt_id' => $row['plan_rerun_of'] !== '' ? $row['plan_rerun_of'] : null,
                'run_id' => null, 'slots' => [], 'started' => gmdate('Y-m-d H:i:s')];
    save_state($opt['state'], $stateAll);   // the client_ref is on disk before the first request
    $isRerun = !empty($entry['rerun_of']);

    foreach ($slots as $slot) {
        if (isset($entry['dealt']) && array_search($slot, $slots, true) >= (int) $entry['dealt']) {
            break;
        }
        if (in_array($entry['slots'][$slot] ?? null, ['ok', 'failed', 'rejected', 'beyond'], true)) {
            continue;
        }
        if ($isRerun && empty($entry['run_id'])) {
            // a rerun is rejoined by its run id; a first request whose answer
            // was lost made one we can find, so adopt it rather than make two
            if (!empty($entry['rerun_asked'])) {
                $entry['run_id'] = find_lost_rerun($base, $entry, $profile, $stateAll);
                if ($entry['run_id'] !== null) {
                    echo sprintf("  #%-3d rejoining rerun %s (its first answer was lost)\n", $n + 1, $entry['run_id']);
                }
            }
            $entry['rerun_asked'] = gmdate('Y-m-d H:i:s');
            save_state($opt['state'], $stateAll);
        }
        $started = microtime(true);
        $startedUtc = gmdate('Y-m-d H:i:s');
        [$st, $res] = http('POST', $base . '/api/jd2-generate.php', slot_body($row, $entry, $slot, $profile), $timeout);
        $wall = microtime(true) - $started;
        $code = $res['error']['code'] ?? null;

        if (isset($res['run_id'])) {
            $entry['run_id'] ??= $res['run_id'];
        }
        if (isset($res['prompt_id'])) {
            $entry['prompt_id'] ??= $res['prompt_id'];
        }
        if ($st === 200 && !empty($res['ok'])) {
            $outcome = 'ok';
        } elseif ($code === 'sanitizer_rejected') {
            $outcome = 'rejected';
        } elseif ($code === 'provider_failed') {
            $outcome = 'failed';
        } elseif ($st === 400 && preg_match('/slot must be one of: ([a-z, ]+)\./', (string) ($res['error']['message'] ?? ''), $m)) {
            // the server's pool is smaller than this checkout's taxonomy: the deal says where it ends
            $entry['dealt'] = count(explode(', ', trim($m[1])));
            $entry['slots'][$slot] = 'beyond';
            save_state($opt['state'], $stateAll);
            echo sprintf("  #%-3d %s  the run's deal ends at slot %s — the server's pool is %d\n", $n + 1, $slot,
                $slots[$entry['dealt'] - 1], $entry['dealt']);
            break;
        } else {
            $outcome = null;
        }
        if ($outcome !== null) {
            $entry['slots'][$slot] = $outcome;
        }
        save_state($opt['state'], $stateAll);

        if ($outcome === null) {
            $tally['other']++;
            $why = $st === 0 ? 'no answer within ' . $timeout . ' s (the drawing may still land: --resume asks again)'
                : $st . ' ' . ($code ?? '') . ' — ' . ($res['error']['message'] ?? 'no message');
            echo sprintf("  #%-3d %s  —  %s\n", $n + 1, $slot, $why);
            $badProfile = $code === 'bad_request' && str_starts_with((string) ($res['error']['message'] ?? ''), 'profile must be');
            if ($badProfile || in_array($code, ['drawer_resting', 'rate_limited', 'too_many_attempts', 'forbidden'], true)) {
                echo "Stopped: " . ($code === 'drawer_resting'
                    ? "today's breaker tripped. Run again with --resume after 00:00 UTC.\n"
                    : ($badProfile ? "the server does not know the $profile profile (deploy the profile split first). Nothing more was sent.\n"
                        : "the server refused the key or throttled it ($code). Nothing more was sent.\n"));
                print_summary($tally, $spent, $ran, $base, $state, $opt['rate-url']);
                exit(1);
            }
            continue;
        }
        $tally[$outcome]++;

        // the drawing's model, latency and cost, as the ledger has them
        $gen = null;
        if (!empty($entry['prompt_id']) && isset($res['gen_id'])) {
            [$lst, $led] = http('GET', $base . '/api/jd2-ledger.php?prompt=' . rawurlencode($entry['prompt_id']), null, 60);
            foreach ($led['items'][0]['runs'] ?? [] as $r) {
                foreach ($r['generations'] as $g) {
                    if ($g['generation_id'] === $res['gen_id']) {
                        $gen = $g;
                    }
                }
            }
        }
        $cost = $gen['cost_usd'] ?? null;
        // a slot drawn by an earlier invocation (a --resume re-asking a slot
        // whose answer was lost) re-answers its stored verdict for free: its
        // row predates this request, and its cost is not this run's spend
        $earlier = isset($gen['created']) && strcmp($gen['created'], $startedUtc) < 0;
        if (!$earlier) {
            $spent += (float) ($cost ?? 0);
        }
        echo sprintf("  #%-3d %s  %-18s %-8s %7.1fs  %s   total $%.4f%s\n", $n + 1, $slot, $gen['model_id'] ?? '?', $outcome,
            ($gen['latency_ms'] ?? null) !== null ? $gen['latency_ms'] / 1000 : $wall,
            $cost === null ? 'unpriced' : sprintf('$%.4f', $cost), $spent, $earlier ? '   (drawn earlier; not counted)' : '');

        // THE INTAKE, once the row's first drawing has filed the prompt: the
        // clerk's heading, size tier and classification (api/jd2-intake.php,
        // with the key). Skipped for a rerun (its prompt was filed before)
        // and when the CSV gave both a title and a size. The CSV's own title
        // and size are filed after the drawings (jd2-curate) and stand over
        // the clerk's: an owner's size is never overwritten by the model.
        if (!empty($entry['prompt_id']) && empty($entry['intake']) && !$isRerun
            && !($row['title'] !== '' && $row['size'] !== '')) {
            run_intake($base, $n, $entry);
            save_state($opt['state'], $stateAll);
        }
    }

    // the row's own facts, once its prompt exists: title, size, category
    if (!empty($entry['prompt_id']) && empty($entry['curated']) && !$isRerun
        && ($row['title'] !== '' || $row['size'] !== '' || $row['category'] !== '')) {
        $body = ['prompt_id' => $entry['prompt_id']];
        if ($row['title'] !== '') {
            $body['title'] = $row['title'];
        }
        if ($row['size'] !== '') {
            $body['size_class'] = $row['size'];
        }
        if ($row['category'] !== '') {
            $body['category'] = $row['category'];
        }
        [$cst, $cres] = http('POST', $base . '/api/jd2-curate.php', $body, 60);
        if ($cst === 200 && !empty($cres['ok'])) {
            $entry['curated'] = true;
        } else {
            echo sprintf("  #%-3d title/size/category not filed (%d %s) — --resume tries again\n", $n + 1, $cst, $cres['error']['code'] ?? '');
        }
    }
    $entry['finished'] = gmdate('Y-m-d H:i:s');
    save_state($opt['state'], $stateAll);
    if (!empty($entry['prompt_id'])) {
        $ran[] = $entry['prompt_id'];
    }
    unset($entry);
}

print_summary($tally, $spent, $ran, $base, $state, $opt['rate-url']);
exit($tally['other'] > 0 ? 1 : 0);

// ===========================================================================

function bail(string $msg): never
{
    fwrite(STDERR, $msg . "\n");
    exit(2);
}

function clip(string $s, int $n = 48): string
{
    $s = preg_replace('/\s+/u', ' ', trim($s));
    return mb_strlen($s) > $n ? mb_substr($s, 0, $n - 1) . '…' : $s;
}

/** @return list<array{prompt:string,title:string,size:string,v1_item_id:string,v1_auto:bool,rerun_of:string}> */
function read_csv(string $path, array $taxonomy, string $root): array
{
    $fh = @fopen($path, 'r');
    if ($fh === false) {
        bail("Cannot read $path.");
    }
    $head = fgetcsv($fh, null, ',', '"', '');
    if (!is_array($head)) {
        bail("$path is empty.");
    }
    $head = array_map(fn ($h) => strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $h))), $head);
    $known = ['prompt', 'title', 'size', 'category', 'v1_item_id', 'rerun_of'];
    if (!in_array('prompt', $head, true)) {
        bail("$path has no `prompt` column (the header row must name it).");
    }
    foreach ($head as $h) {
        if ($h !== '' && !in_array($h, $known, true)) {
            bail("$path has an unknown column `$h` (known: " . implode(', ', $known) . ').');
        }
    }
    $lineage = v1_prompt_index($root);
    $tiers = jd_size_tiers($taxonomy);
    $rows = [];
    $errors = [];
    $seen = [];
    $line = 1;
    while (($cells = fgetcsv($fh, null, ',', '"', '')) !== false) {
        $line++;
        if ($cells === [null] || $cells === []) {
            continue;
        }
        $r = [];
        foreach ($head as $i => $h) {
            $r[$h] = isset($cells[$i]) ? (string) $cells[$i] : '';
        }
        $prompt = $r['prompt'] ?? '';
        if (trim($prompt) === '') {
            continue;
        }
        $len = mb_strlen(trim($prompt));
        if ($len > JD_PROMPT_MAX_CHARS) {
            $errors[] = "line $line: the prompt is $len characters (at most " . JD_PROMPT_MAX_CHARS . ')';
        }
        if (isset($seen[$prompt])) {
            $errors[] = "line $line: the same prompt text as line {$seen[$prompt]} (the state file keys rows by profile and text; run the CSV again with another --profile for a second run)";
        }
        $seen[$prompt] = $line;
        $row = ['prompt' => $prompt, 'title' => trim($r['title'] ?? ''), 'size' => trim($r['size'] ?? ''),
                'category' => trim($r['category'] ?? ''),
                'v1_item_id' => trim($r['v1_item_id'] ?? ''), 'v1_auto' => false, 'rerun_of' => trim($r['rerun_of'] ?? '')];
        if ($row['size'] !== '' && !isset($tiers[$row['size']])) {
            $errors[] = "line $line: size `{$row['size']}` is not a taxonomy size tier (" . implode(' ', array_keys($tiers)) . ')';
        }
        if (mb_strlen($row['category']) > 32) {
            $errors[] = "line $line: category is " . mb_strlen($row['category']) . ' characters (at most 32)';
        }
        if ($row['rerun_of'] !== '' && !jd_is_ulid($row['rerun_of'])) {
            $errors[] = "line $line: rerun_of `{$row['rerun_of']}` is not a v2 prompt id";
        }
        if ($row['v1_item_id'] !== '' && !preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]{1,53}$/', $row['v1_item_id'])) {
            $errors[] = "line $line: v1_item_id `{$row['v1_item_id']}` is not a v1 item id (YYYY-MM-DD-slug)";
        }
        if ($row['v1_item_id'] === '' && $row['rerun_of'] === '' && isset($lineage[$prompt])) {
            $row['v1_item_id'] = $lineage[$prompt];
            $row['v1_auto'] = true;
        }
        if ($row['rerun_of'] !== '' && $row['v1_item_id'] !== '' && !$row['v1_auto']) {
            $errors[] = "line $line: v1_item_id is filed with a new prompt only; a rerun_of row keeps its prompt's lineage";
        }
        $rows[] = $row;
    }
    fclose($fh);
    if ($errors) {
        bail("The CSV has problems; nothing was drawn:\n  " . implode("\n  ", $errors));
    }
    if ($rows === []) {
        bail("$path has no prompts.");
    }
    return $rows;
}

/** v1 lineage by exact prompt text: the legacy exhibit's entry files (the archive's items). */
function v1_prompt_index(string $root): array
{
    $out = [];
    foreach (glob($root . '/art/junk-drawer/legacy/items/*/entry.json') ?: [] as $f) {
        $e = json_decode((string) @file_get_contents($f), true);
        if (is_array($e) && isset($e['id'], $e['prompt']) && is_string($e['prompt'])) {
            $out[$e['prompt']] ??= (string) $e['id'];
        }
    }
    return $out;
}

/** The jd2-generate body for one slot of a row (a rerun when the row's entry says so). */
function slot_body(array $row, array $entry, string $slot, string $profile): array
{
    $b = ['client_ref' => $entry['client_ref'], 'slot' => $slot, 'client' => 'web', 'profile' => $profile, 'website' => ''];
    if (!empty($entry['rerun_of'])) {
        $b['rerun_of'] = $entry['rerun_of'];
        if (!empty($entry['run_id'])) {
            $b['run_id'] = $entry['run_id'];   // join the rerun the first slot made
        }
        return $b;
    }
    $b['prompt'] = $row['prompt'];
    if ($row['v1_item_id'] !== '') {
        $b['v1_item_id'] = $row['v1_item_id'];
    }
    return $b;
}

/** A row's state key: the profile and the prompt text (`[bench-medium] a tin robot`). */
function state_key(string $profile, string $text): string
{
    return '[' . $profile . '] ' . $text;
}

/**
 * The owner prompts on file, by exact text → the OLDEST one's id (ULIDs sort
 * by filing time), hidden ones left out: what a fresh row is rerun against.
 * One read of the ledger (jd2-ledger.php, with the key); bails when it cannot
 * be read, because guessing "new" would file a duplicate prompt.
 *
 * @return array<string,string>
 */
function owner_prompts_by_text(string $base): array
{
    [$st, $led] = http('GET', $base . '/api/jd2-ledger.php', null, 120);
    if ($st !== 200 || !isset($led['items']) || !is_array($led['items'])) {
        bail('Could not read the ledger to find prompts already on file (' . $st . ' ' . ($led['error']['code'] ?? '') . ') — nothing was drawn.');
    }
    $out = [];
    foreach ($led['items'] as $it) {
        if (($it['origin'] ?? '') !== 'owner' || ($it['visibility'] ?? '') === 'hidden' || !isset($it['prompt'], $it['prompt_id'])) {
            continue;
        }
        $text = (string) $it['prompt'];
        $id = (string) $it['prompt_id'];
        if (!isset($out[$text]) || strcmp($id, $out[$text]) < 0) {
            $out[$text] = $id;
        }
    }
    return $out;
}

/**
 * The run a lost first rerun request made: the oldest rerun of the entry's
 * prompt under this profile, filed by the owner no earlier than the request
 * went out (less five minutes of clock skew), and claimed by no other state
 * entry. Null when there is none (the request never reached the server).
 */
function find_lost_rerun(string $base, array $entry, string $profile, array $stateAll): ?string
{
    [$st, $led] = http('GET', $base . '/api/jd2-ledger.php?prompt=' . rawurlencode((string) $entry['rerun_of']), null, 60);
    if ($st !== 200) {
        return null;
    }
    $claimed = [];
    foreach ($stateAll['bases'] ?? [] as $rows) {
        foreach ((array) $rows as $e) {
            if (!empty($e['run_id'])) {
                $claimed[(string) $e['run_id']] = true;
            }
        }
    }
    $since = gmdate('Y-m-d H:i:s', strtotime($entry['rerun_asked'] . ' UTC') - 300);
    $found = null;
    foreach ($led['items'][0]['runs'] ?? [] as $r) {
        if (($r['kind'] ?? '') === 'rerun' && ($r['profile'] ?? '') === $profile && ($r['requested_by'] ?? '') === 'owner'
            && strcmp((string) $r['created'], $since) >= 0 && !isset($claimed[(string) $r['run_id']])
            && ($found === null || strcmp((string) $r['run_id'], $found) < 0)) {
            $found = (string) $r['run_id'];
        }
    }
    return $found;
}

/** One intake call for a row's prompt (prompt_id, the bench key); logs what the clerk filed. */
function run_intake(string $base, int $n, array &$entry): void
{
    [$st, $res] = http('POST', $base . '/api/jd2-intake.php', ['prompt_id' => $entry['prompt_id']], 120);
    if ($st !== 200 || empty($res['ok'])) {
        echo sprintf("  #%-3d intake not filed (%d %s) — --resume asks again\n", $n + 1, $st, $res['error']['code'] ?? '');
        return;
    }
    $entry['intake'] = !empty($res['fallback']) ? 'fallback' : 'ok';
    if (!empty($res['fallback'])) {
        echo sprintf("  #%-3d intake fell back — no size or headings filed (the bench's catalogue entry asks; the ledger shows the error)\n", $n + 1);
        return;
    }
    $tags = [];
    foreach ((array) ($res['tags'] ?? []) as $facet => $ids) {
        $tags[] = $facet . ': ' . ($ids ? implode(', ', $ids) : '—');
    }
    echo sprintf("  #%-3d intake: \"%s\" · size %s (%s) · %s%s\n", $n + 1, (string) ($res['title'] ?? ''),
        $res['size_class'] ?? '—', $res['size_by'] ?? '—', implode(' · ', $tags), !empty($res['stored']) ? ' (on file)' : '');
}

/** @return array{0:int,1:mixed} status (0 = no answer) and the decoded body */
function http(string $method, string $url, ?array $body, int $timeout): array
{
    global $key, $originHeader;
    $ch = curl_init($url);
    $headers = ['Origin: ' . $originHeader, 'X-Bench-Key: ' . $key, 'Accept: application/json',
                'User-Agent: jd2-batch-run.php (municipal-sky curation)'];
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 20,
        CURLOPT_TIMEOUT => $timeout,
    ]);
    $raw = curl_exec($ch);
    $status = $raw === false ? 0 : (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, is_string($raw) ? json_decode($raw, true) : null];
}

function save_state(string $path, array $all): void
{
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $tmp = $path . '.tmp';
    file_put_contents($tmp, json_encode($all, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
    rename($tmp, $path);
}

function print_rate_urls(string $base, array $state, ?array $only): void
{
    echo "rate on the bench: $base/art/junk-drawer/index.php?bench\n";
    $done = [];
    foreach ($state as $key => $e) {
        if (empty($e['prompt_id']) || isset($done[$e['prompt_id']]) || ($only !== null && !in_array($e['prompt_id'], $only, true))) {
            continue;
        }
        $done[$e['prompt_id']] = true;
        // a pre-split entry is keyed by its text alone
        $text = (string) ($e['prompt'] ?? $key);
        echo '  ' . $base . '/art/junk-drawer/index.php?bench&prompt=' . $e['prompt_id'] . '  "' . clip($text) . "\"\n";
    }
}

function print_summary(array $tally, float $spent, array $ran, string $base, array $state, bool $rateUrl): void
{
    echo sprintf("done: %d ok, %d failed, %d rejected, %d unanswered · spent $%.4f this run\n",
        $tally['ok'], $tally['failed'], $tally['rejected'], $tally['other'], $spent);
    if ($rateUrl) {
        print_rate_urls($base, $state, $ran);
    }
}

/** A php -S on a free 127.0.0.1 port, the worktree as root, the mock provider on. @return string its base URL */
function start_local_server(string $root): string
{
    $probe = stream_socket_server('tcp://127.0.0.1:0');
    $port = (int) substr(strrchr(stream_socket_get_name($probe, false), ':'), 1);
    fclose($probe);
    $env = array_merge(getenv(), ['JD_DEV_MOCK' => '1']);
    $env['JD_DEV_LATENCY_MS'] = getenv('JD_DEV_LATENCY_MS') ?: '1';
    $proc = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $root],
        [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'a'], 2 => ['file', '/dev/null', 'a']],
        $pipes, $root, $env);
    register_shutdown_function(static function () use ($proc): void {
        proc_terminate($proc);
    });
    for ($i = 0; $i < 100; $i++) {
        $s = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.1);
        if ($s) {
            fclose($s);
            return "http://127.0.0.1:$port";
        }
        usleep(50000);
    }
    bail('The local php -S did not start.');
}
