<?php
/**
 * backfill-curated.php — file the Junk Drawer's curated collection into
 * jd_submissions / jd_generations so its responses can be rated through the
 * same jd_ratings store the turn flow already writes.
 *
 * Lives in api/ rather than scripts/ for one reason: scripts/** is excluded
 * from the deploy (deploy.yml, publish.sh), so a script there can never run
 * against the production database. Same reasoning, same ?key= gate, as
 * api/setup-jd-tables.php.
 *
 *   CLI:  JD_DEV_MOCK=1 php api/jd-backfill-curated.php --dry-run
 *         php api/jd-backfill-curated.php
 *   web:  https://municipalsky.com/api/jd-backfill-curated.php?key=<jd_setup_key>&dry-run=1
 *
 * Flags:
 *   --dry-run           report only, touch nothing
 *   --include-retired   also file items carrying "retired": true (default: skip,
 *                       they are excluded from the drawer at data.php:107)
 *
 * IDEMPOTENT: an item already carrying a curated submission is skipped, so a
 * re-run after adding new items only files the new ones. It never updates an
 * existing row — re-filing a changed entry.json is deliberately not automatic,
 * because ratings already hang off the generation rows.
 *
 * WHAT THIS IS NOT: these rows are not visitor turns. See the item_id block in
 * api/setup-jd-tables.php before writing any report over these tables.
 */

require_once __DIR__ . '/jd-config.php';

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    // Production requires the setup key: this writes 107 rows into the live
    // tables and must not be triggerable by a stray GET.
    if (JD_IS_PRODUCTION) {
        $secrets  = jd_secrets();
        $expected = $secrets['jd_setup_key'] ?? null;
        $supplied = $_GET['key'] ?? '';
        if (!is_string($expected) || $expected === '' || !hash_equals($expected, (string) $supplied)) {
            http_response_code(403);
            echo "Forbidden. Call with ?key=<jd_setup_key>.\n";
            exit;
        }
    }
}

$args           = $isCli ? array_slice($argv, 1) : [];
$dryRun         = $isCli ? in_array('--dry-run', $args, true)         : isset($_GET['dry-run']);
$includeRetired = $isCli ? in_array('--include-retired', $args, true) : isset($_GET['include-retired']);

$ITEMS = __DIR__ . '/../art/junk-drawer/items';

// entry.json vendor strings → the provider slugs jd_generations.provider uses.
const VENDOR_PROVIDER = [
    'Anthropic'   => 'anthropic',
    'OpenAI'      => 'openai',
    'Moonshot AI' => 'kimi',
    'Google'      => 'google',
];

/** UUIDv4, for the NOT NULL UNIQUE client_ref. Carries no meaning here. */
function bc_uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

/** model id → provider slug, via taxonomy.json's model registry. */
function bc_provider(string $modelId, array $taxonomy): string
{
    foreach ($taxonomy['models'] ?? [] as $m) {
        if (($m['id'] ?? null) === $modelId) {
            return VENDOR_PROVIDER[$m['vendor'] ?? ''] ?? 'unknown';
        }
    }
    return 'unknown';
}

/**
 * Which taxonomy version was live on $date, from taxonomy.json's changelog.
 * A grade filed in July was filed under a different rubric than one filed in
 * August; stamping them all v17 would be a lie the column is meant to prevent.
 */
function bc_taxonomy_version_at(?string $date, array $taxonomy): int
{
    $current = (int) ($taxonomy['version'] ?? 0);
    if ($date === null) {
        return $current;
    }
    $best = null;
    foreach ($taxonomy['changelog'] ?? [] as $entry) {
        $when = $entry['date'] ?? null;
        $ver  = $entry['version'] ?? null;
        if (!is_string($when) || !is_int($ver)) {
            continue;
        }
        if ($when <= $date && ($best === null || $when >= $best[0])) {
            $best = [$when, $ver];
        }
    }
    return $best !== null ? $best[1] : $current;
}

// --- gather ----------------------------------------------------------------

$taxonomy = jd_taxonomy();
if ($taxonomy === null) {
    fwrite(STDERR, "backfill: taxonomy.json could not be read\n");
    exit(1);
}

$entries = glob($ITEMS . '/*/entry.json');
sort($entries);
if (!$entries) {
    fwrite(STDERR, "backfill: no entry.json found under $ITEMS\n");
    exit(1);
}

$db = jd_db();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Curated submissions already on file — the idempotency guard.
$already = [];
foreach ($db->query('SELECT item_id FROM jd_submissions WHERE item_id IS NOT NULL') as $row) {
    $already[$row['item_id']] = true;
}

$curatorHash = jd_curator_hash();

$filedItems = 0; $filedGens = 0; $filedSeeds = 0;
$skipRetired = 0; $skipExisting = 0; $overflow = [];

foreach ($entries as $path) {
    $e = json_decode((string) file_get_contents($path), true);
    if (!is_array($e) || !isset($e['id'])) {
        fwrite(STDERR, "backfill: unreadable entry at $path\n");
        continue;
    }
    $itemId    = (string) $e['id'];
    $responses = $e['responses'] ?? [];

    if (!empty($e['retired']) && !$includeRetired) { $skipRetired++;  continue; }
    if (isset($already[$itemId]))                  { $skipExisting++; continue; }
    if (!$responses)                               { continue; }

    // slot is ENUM('a','b','c','d') UNIQUE per submission — a hard ceiling of 4.
    // One submission per generation EVENT keeps that true forever; if a curated
    // item ever exceeds 4 responses it needs splitting, so refuse rather than
    // silently drop the tail.
    if (count($responses) > 4) {
        $overflow[] = $itemId . ' (' . count($responses) . ' responses)';
        continue;
    }

    $subId = jd_ulid();
    $rows  = [];
    foreach ($responses as $i => $r) {
        $model = (string) ($r['model'] ?? 'unknown');
        $rows[] = [
            'id'            => jd_ulid(),
            'slot'          => ['a', 'b', 'c', 'd'][$i],
            'model_id'      => $model,
            'model_version' => (string) ($r['model_version'] ?? $model),
            'provider'      => bc_provider($model, $taxonomy),
            'created'       => (string) ($r['date'] ?? $e['created'] ?? date('Y-m-d')),
            'grade'         => $r['grade'] ?? null,
            'graded'        => $r['graded'] ?? null,
        ];
    }

    if ($dryRun) {
        echo sprintf("would file  %-36s %d response(s)\n", $itemId, count($rows));
        $filedItems++; $filedGens += count($rows);
        $filedSeeds += count(array_filter($rows, fn($r) => $r['grade'] !== null));
        continue;
    }

    // One item = one transaction. A half-filed item would leave generations
    // with no submission, or ratings with no generation.
    $db->beginTransaction();
    try {
        $db->prepare(
            'INSERT INTO jd_submissions
                (id, client_ref, item_id, created, prompt, visitor_hash, client,
                 pair_order, ai_consent_at, ai_consent_version, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)'
        )->execute([
            $subId,
            bc_uuid4(),
            $itemId,
            (string) ($e['created'] ?? date('Y-m-d')) . ' 00:00:00',
            (string) ($e['prompt'] ?? ''),
            $curatorHash,
            'curated',
            -1,            // no shuffle happened; a real 0-23 would assert one
            'generated',   // no 'curated' ENUM member — see setup-jd-tables.php
        ]);

        $insGen = $db->prepare(
            'INSERT INTO jd_generations
                (id, submission_id, slot, model_id, model_version, provider,
                 harness, params, raw_response, svg, status, reject_reason,
                 disobedience, latency_ms, usage_tokens, created)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, 0, NULL, NULL, ?)'
        );
        // svg stays NULL on purpose: the .svg on disk is canonical and is what
        // data.php renders. Two copies could diverge.
        $insSeed = $db->prepare(
            'INSERT INTO jd_ratings
                (id, generation_id, kind, axis_id, value, note, taxonomy_version,
                 visitor_hash, client, rated_at)
             VALUES (?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?)'
        );

        foreach ($rows as $g) {
            $insGen->execute([
                $g['id'], $subId, $g['slot'], $g['model_id'], $g['model_version'],
                $g['provider'], 'curated', '{}', 'ok', $g['created'] . ' 00:00:00',
            ]);
            $filedGens++;

            // Carry the existing overall grade across as a seed row so the move
            // to DB-as-source-of-truth loses nothing. Axis scores are NOT seeded
            // — they belong to retired rubrics and stay frozen in entry.json.
            if ($g['grade'] !== null) {
                $when = (string) ($g['graded'] ?? $g['created']);
                $insSeed->execute([
                    jd_ulid(), $g['id'], 'grade', (float) $g['grade'],
                    bc_taxonomy_version_at($when, $taxonomy),
                    $curatorHash, 'seed', $when . ' 00:00:00',
                ]);
                $filedSeeds++;
            }
        }

        $db->commit();
        $filedItems++;
        echo sprintf("filed  %-36s %d response(s)\n", $itemId, count($rows));
    } catch (PDOException $ex) {
        $db->rollBack();
        fwrite(STDERR, "backfill: FAILED on $itemId — " . $ex->getMessage() . "\n");
        exit(1);
    }
}

echo "\n" . ($dryRun ? "DRY RUN — nothing written\n" : "done\n");
echo "  items filed      : $filedItems\n";
echo "  generations      : $filedGens\n";
echo "  seed grade rows  : $filedSeeds\n";
echo "  skipped retired  : $skipRetired" . ($includeRetired ? " (--include-retired was set)" : "") . "\n";
echo "  skipped existing : $skipExisting\n";
if ($overflow) {
    echo "\n  !! REFUSED — more than 4 responses, needs splitting across submissions:\n";
    foreach ($overflow as $o) { echo "     $o\n"; }
    exit(1);
}
