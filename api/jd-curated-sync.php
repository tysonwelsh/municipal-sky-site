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
//
// SEEDS CARRY THE ENTRY'S LIVE-AXIS ANNOTATIONS AND ITS FILED RANKS TOO
// (owner report, 2026-09-10: "the bench keeps opening items I have already
// annotated"). A harvested rerun set arrives in entry.json WITH the owner's
// axis answers on the live axes and a "filed rank N of M" note per response
// (harvest-rerun.py), because the owner rated it at the rerun's own turn —
// but the rows filed for those responses carried only a seed GRADE, so the
// queue (which reads the database alone) counted every one of them as
// unrated and unranked and dealt the item back. The sync now files a 'seed'
// axis row for each live-axis annotation and a 'seed' rank when every served
// response carries the harvest's rank note, and it LEVELS rows already on
// file the same way (jd_curated_level_seeds), so a re-run of the backfill
// repairs the 21. Defunct-axis annotations are still never seeded: they
// answer questions the rubric no longer asks. The bench's own answers
// outrank a seed everywhere (jd_pick_rating ['bench', '*']).

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
 * The live-axis annotations an entry response carries, as axis id => rank
 * value, validated against the taxonomy (a value the axis does not define is
 * dropped, never rounded). {value, note} objects and bare numbers both read.
 *
 * @return array<string,float>
 */
function jd_curated_seed_axes(array $response, array $liveAxes): array
{
    $out = [];
    foreach ($response['annotations'] ?? [] as $axis => $a) {
        if (!isset($liveAxes[(string) $axis])) {
            continue;
        }
        $v = is_array($a) ? ($a['value'] ?? null) : $a;
        if (!is_numeric($v)) {
            continue;
        }
        $ranks = [];
        foreach ($liveAxes[(string) $axis]['values'] ?? [] as $val) {
            if (isset($val['rank'])) {
                $ranks[] = (float) $val['rank'];
            }
        }
        if (in_array((float) $v, $ranks, true)) {
            $out[(string) $axis] = (float) $v;
        }
    }
    return $out;
}

/** the "filed rank N of M" the harvest writes into a response's notes, or null */
function jd_curated_seed_rank(array $response): ?array
{
    $notes = $response['notes'] ?? null;
    if (!is_string($notes) || !preg_match('/filed rank (\d+) of (\d+)/', $notes, $m)) {
        return null;
    }
    return ['pos' => (int) $m[1], 'of' => (int) $m[2]];
}

/**
 * The ranks an entry states for its SERVED responses, index => position —
 * only when every served (non-retired) response carries the harvest's rank
 * note and they agree on the set's size, so a partial or mixed set (a legacy
 * keep beside a rerun set, an original trio that was never ranked) seeds
 * nothing and stays the bench's to rank.
 *
 * @return array<int,int>
 */
function jd_curated_seed_ranks(array $responses): array
{
    $out = [];
    $of = null;
    foreach (array_values($responses) as $i => $r) {
        if (!empty($r['retired'])) {
            continue;
        }
        $rk = jd_curated_seed_rank($r);
        if ($rk === null || ($of !== null && $rk['of'] !== $of)) {
            return [];
        }
        $of = $rk['of'];
        $out[$i] = $rk['pos'];
    }
    return count($out) >= 2 && count($out) === $of ? $out : [];
}

/**
 * Bring one item's database rows level with its entry.json.
 *
 * @return array{status:string, submission_id:?string, filed_gens:int, filed_seeds:int, filed_axes?:int, leveled?:int, total:int}
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
        // 'current' — but the rows already on file may still be missing the
        // seeds a newer entry carries (the 2026-09-10 repair)
        $out['leveled'] = $subId !== null
            ? jd_curated_level_seeds($db, $subId, $entry, $taxonomy, $dryRun) : 0;
        return $out;
    }

    $liveAxes = jd_live_axes($taxonomy);
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
            'axes'          => jd_curated_seed_axes($r, $liveAxes),
        ];
    }
    $out['status'] = $subId === null ? 'filed' : 'appended';
    $out['filed_gens'] = count($rows);
    $out['filed_seeds'] = count(array_filter($rows, fn($r) => $r['grade'] !== null));
    $out['filed_axes'] = array_sum(array_map(fn($r) => count($r['axes']), $rows));
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
        $insAxis = $db->prepare(
            'INSERT INTO jd_ratings
                (id, generation_id, kind, axis_id, value, note, taxonomy_version,
                 visitor_hash, client, rated_at)
             VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)'
        );
        foreach ($rows as $g) {
            $insGen->execute([
                $g['id'], $subId, $g['slot'], $g['model_id'], $g['model_version'],
                $g['provider'], 'curated', '{}', 'ok', $g['created'] . ' 00:00:00',
            ]);
            // Carry the entry's overall grade across as a seed row so the move
            // to DB-as-source-of-truth loses nothing. Axis scores are NOT
            // seeded — they may belong to retired rubrics and stay in the entry.
            $when = (string) ($g['graded'] ?? $g['created']);
            $version = jd_curated_taxonomy_version_at($when, $taxonomy);
            if ($g['grade'] !== null) {
                $insSeed->execute([
                    jd_ulid(), $g['id'], 'grade', (float) $g['grade'],
                    $version, $curator, 'seed', $when . ' 00:00:00',
                ]);
            }
            // the entry's live-axis annotations ride along as seed axis rows
            // (2026-09-10) — see the banner
            foreach ($g['axes'] as $axis => $value) {
                $insAxis->execute([
                    jd_ulid(), $g['id'], 'axis', $axis, $value,
                    $version, $curator, 'seed', $when . ' 00:00:00',
                ]);
            }
        }
        $db->commit();
    } catch (PDOException $ex) {
        $db->rollBack();
        throw $ex;
    }
    $out['submission_id'] = $subId;
    // the ranks the harvest noted, once every served row exists
    $out['leveled'] = jd_curated_level_seeds($db, $subId, $entry, $taxonomy, false);
    return $out;
}

/**
 * Level the seeds on rows ALREADY filed for an item: a seed axis row for
 * every live-axis annotation the entry carries that the generation has no
 * 'seed' row for yet, and the harvest's rank set as 'seed' rank rows when
 * the submission has no ranks at all. Idempotent; returns the number of
 * rows it wrote (or would write, dry). The bench's own rows are never
 * touched — a seed only fills a cell nobody has answered.
 */
function jd_curated_level_seeds(PDO $db, string $subId, array $entry, array $taxonomy, bool $dryRun): int
{
    $liveAxes = jd_live_axes($taxonomy);
    $responses = array_values($entry['responses'] ?? []);
    $q = $db->prepare('SELECT id, slot, created FROM jd_generations WHERE submission_id = ? ORDER BY slot');
    $q->execute([$subId]);
    $gens = $q->fetchAll(PDO::FETCH_ASSOC);
    if (!$gens) {
        return 0;
    }
    $ids = array_map(fn($g) => (string) $g['id'], $gens);
    $in = implode(',', array_fill(0, count($ids), '?'));
    $q = $db->prepare(
        "SELECT generation_id, axis_id FROM jd_ratings
          WHERE kind = 'axis' AND client = 'seed' AND generation_id IN ($in)"
    );
    $q->execute($ids);
    $seeded = [];
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $seeded[(string) $r['generation_id']][(string) $r['axis_id']] = true;
    }
    $q = $db->prepare('SELECT COUNT(*) FROM jd_ranks WHERE submission_id = ?');
    $q->execute([$subId]);
    $hasRanks = (int) $q->fetchColumn() > 0;

    $axisRows = [];
    foreach (jd_curated_positions($responses, $gens) as $i => $p) {
        if ($p['src'] === null) {
            continue;
        }
        $gid = (string) $p['gen']['id'];
        $when = (string) ($p['src']['graded'] ?? $p['src']['date'] ?? substr((string) $p['gen']['created'], 0, 10));
        foreach (jd_curated_seed_axes($p['src'], $liveAxes) as $axis => $value) {
            if (empty($seeded[$gid][$axis])) {
                $axisRows[] = [$gid, $axis, $value, $when];
            }
        }
    }
    $rankRows = [];
    if (!$hasRanks) {
        foreach (jd_curated_seed_ranks($responses) as $i => $pos) {
            if (isset($gens[$i])) {
                $rankRows[] = [(string) $gens[$i]['id'], $pos];
            }
        }
    }
    $n = count($axisRows) + count($rankRows);
    if ($dryRun || $n === 0) {
        return $n;
    }
    $curator = jd_curator_hash();
    $db->beginTransaction();
    try {
        $insAxis = $db->prepare(
            'INSERT INTO jd_ratings
                (id, generation_id, kind, axis_id, value, note, taxonomy_version,
                 visitor_hash, client, rated_at)
             VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)'
        );
        foreach ($axisRows as [$gid, $axis, $value, $when]) {
            $insAxis->execute([
                jd_ulid(), $gid, 'axis', $axis, $value,
                jd_curated_taxonomy_version_at($when, $taxonomy),
                $curator, 'seed', $when . ' 00:00:00',
            ]);
        }
        $insRank = $db->prepare(
            'INSERT INTO jd_ranks (id, submission_id, generation_id, rank_pos, visitor_hash, client, rated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($rankRows as [$gid, $pos]) {
            $insRank->execute([jd_ulid(), $subId, $gid, $pos, $curator, 'seed', jd_now()]);
        }
        $db->commit();
    } catch (PDOException $ex) {
        $db->rollBack();
        throw $ex;
    }
    return $n;
}
