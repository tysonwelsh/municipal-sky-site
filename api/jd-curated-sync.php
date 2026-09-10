<?php
// jd-curated-sync.php — file a curated item's entry.json into jd_submissions /
// jd_generations, or bring an already-filed item up to date with responses
// added since (a harvested rerun set, a legacy keep). A LIBRARY, not an
// endpoint: required by
//   · api/jd-backfill-curated.php — the bulk run over every entry
//   · api/jd-item-rate.php       — on demand, when admin mode saves a rating
//                                  on a response the database has no row for
//
// THE POSITION JOIN is the contract everything else reads (jd-bench-queue,
// data.php's overlay, jd_curated_positions): generation i ⇔ entry response i,
// retired responses INCLUDED, slots filed in entry order. So bringing an item
// up to date is exactly "file the responses past the ones already on file",
// which is what keeps the rows already carrying ratings untouched — a changed
// entry.json is never re-filed, only appended to.
//
// Sixteen slots (2026-09-10; it was four, which refused every item that had
// ever been rerun — 21 of 67). A rerun appends four, so sixteen is three
// reruns on top of the originals; past that the item is refused, never
// truncated.

require_once __DIR__ . '/jd-config.php';

const JD_SLOT_LETTERS = 'abcdefghijklmnop';

// entry.json vendor strings → the provider slugs jd_generations.provider uses.
const JD_VENDOR_PROVIDER = [
    'Anthropic'   => 'anthropic',
    'OpenAI'      => 'openai',
    'Moonshot AI' => 'kimi',
    'Google'      => 'google',
];

/** UUIDv4, for the NOT NULL UNIQUE client_ref. Carries no meaning here. */
function jd_curated_uuid4(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

/** model id → provider slug, via taxonomy.json's model registry. */
function jd_curated_provider(string $modelId, array $taxonomy): string
{
    $m = jd_model_registry($taxonomy)[$modelId] ?? null;
    return $m ? (JD_VENDOR_PROVIDER[$m['vendor'] ?? ''] ?? 'unknown') : 'unknown';
}

/**
 * Which taxonomy version was live on $date, from taxonomy.json's changelog.
 * A grade filed in July was filed under a different rubric than one filed in
 * August; stamping them all with today's would be a lie the column exists
 * to prevent.
 */
function jd_curated_taxonomy_version_at(?string $date, array $taxonomy): int
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

/** the entry an item id names, or null — the id is checked against the
 *  directory-name shape before it touches a path */
function jd_curated_entry(string $itemId): ?array
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,64}$/', $itemId)) {
        return null;
    }
    $path = __DIR__ . '/../art/junk-drawer/items/' . $itemId . '/entry.json';
    if (!is_readable($path)) {
        return null;
    }
    $e = json_decode((string) file_get_contents($path), true);
    return is_array($e) && ($e['id'] ?? null) === $itemId ? $e : null;
}

/**
 * Bring one item's database rows level with its entry.json.
 *
 * @return array{status:string, submission_id:?string, filed_gens:int, filed_seeds:int, total:int}
 *   status: 'filed' (new submission), 'appended' (responses added to an
 *   existing one), 'current' (nothing to do), 'empty' (no responses),
 *   'overflow' (more responses than slots — nothing written)
 */
function jd_curated_sync(PDO $db, array $entry, array $taxonomy, bool $dryRun = false): array
{
    $itemId    = (string) $entry['id'];
    $responses = array_values($entry['responses'] ?? []);
    $out = ['status' => 'current', 'submission_id' => null, 'filed_gens' => 0,
            'filed_seeds' => 0, 'total' => count($responses)];
    if (!$responses) {
        $out['status'] = 'empty';
        return $out;
    }
    if (count($responses) > strlen(JD_SLOT_LETTERS)) {
        $out['status'] = 'overflow';
        return $out;
    }

    $q = $db->prepare('SELECT id FROM jd_submissions WHERE item_id = ?');
    $q->execute([$itemId]);
    $subId = $q->fetchColumn();
    $subId = $subId === false ? null : (string) $subId;
    $out['submission_id'] = $subId;

    $existing = 0;
    if ($subId !== null) {
        $q = $db->prepare('SELECT COUNT(*) FROM jd_generations WHERE submission_id = ?');
        $q->execute([$subId]);
        $existing = (int) $q->fetchColumn();
    }
    if ($existing >= count($responses)) {
        return $out;                       // 'current'
    }

    $rows = [];
    for ($i = $existing; $i < count($responses); $i++) {
        $r = $responses[$i];
        $model = (string) ($r['model'] ?? 'unknown');
        $rows[] = [
            'id'            => jd_ulid(),
            'slot'          => JD_SLOT_LETTERS[$i],
            'model_id'      => $model,
            'model_version' => (string) ($r['model_version'] ?? $model),
            'provider'      => jd_curated_provider($model, $taxonomy),
            'created'       => (string) ($r['date'] ?? $entry['created'] ?? date('Y-m-d')),
            'grade'         => $r['grade'] ?? null,
            'graded'        => $r['graded'] ?? null,
        ];
    }
    $out['status'] = $subId === null ? 'filed' : 'appended';
    $out['filed_gens'] = count($rows);
    $out['filed_seeds'] = count(array_filter($rows, fn($r) => $r['grade'] !== null));
    if ($dryRun) {
        return $out;
    }

    $curator = jd_curator_hash();
    // One item = one transaction. A half-filed item would leave generations
    // with no submission, or ratings with no generation.
    $db->beginTransaction();
    try {
        if ($subId === null) {
            $subId = jd_ulid();
            $db->prepare(
                'INSERT INTO jd_submissions
                    (id, client_ref, item_id, created, prompt, visitor_hash, client,
                     pair_order, ai_consent_at, ai_consent_version, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)'
            )->execute([
                $subId,
                jd_curated_uuid4(),
                $itemId,
                (string) ($entry['created'] ?? date('Y-m-d')) . ' 00:00:00',
                (string) ($entry['prompt'] ?? ''),
                $curator,
                'curated',
                -1,            // no shuffle happened; a real 0-23 would assert one
                'generated',   // no 'curated' ENUM member — see setup-jd-tables.php
            ]);
        }
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
            // Carry the entry's overall grade across as a seed row so the move
            // to DB-as-source-of-truth loses nothing. Axis scores are NOT
            // seeded — they may belong to retired rubrics and stay in the entry.
            if ($g['grade'] !== null) {
                $when = (string) ($g['graded'] ?? $g['created']);
                $insSeed->execute([
                    jd_ulid(), $g['id'], 'grade', (float) $g['grade'],
                    jd_curated_taxonomy_version_at($when, $taxonomy),
                    $curator, 'seed', $when . ' 00:00:00',
                ]);
            }
        }
        $db->commit();
    } catch (PDOException $ex) {
        $db->rollBack();
        throw $ex;
    }
    $out['submission_id'] = $subId;
    return $out;
}
