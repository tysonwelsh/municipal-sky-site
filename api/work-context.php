<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once 'database.php';

// Get action parameter
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'occupations':
        // Fetch all occupations from SOC hierarchy with proper grouping
        $query = "
            SELECT 
                shi.detailed_occupation_code AS soc_code,
                soc_detailed.title AS title,
                shi.major_group_code,
                soc_major.title AS major_group_title,
                shi.minor_group_code,
                soc_minor.title AS minor_group_title,
                shi.broad_group_code,
                soc_broad.title AS broad_group_title
            FROM soc_hierarchy_index AS shi
            INNER JOIN SOC_major_groups AS soc_major ON shi.major_group_code = soc_major.id
            INNER JOIN SOC_minor_groups AS soc_minor ON shi.minor_group_code = soc_minor.id
            INNER JOIN SOC_broad_occupations AS soc_broad ON shi.broad_group_code = soc_broad.id
            INNER JOIN SOC_detailed_occupations AS soc_detailed ON shi.detailed_occupation_code = soc_detailed.id
            -- Only include occupations that have corresponding O*NET data
            WHERE EXISTS (
                SELECT 1 
                FROM occupation_data od 
                WHERE LEFT(od.onetsoc_code, 7) = shi.detailed_occupation_code 
                AND RIGHT(od.onetsoc_code, 2) = '00'
            )
            ORDER BY soc_detailed.title
        ";

        $stmt = $pdo->query($query);
        $occupations = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($occupations);
        break;

    case 'work-context':
        // Get work context data for a specific occupation
        $soc_code = $_GET['code'] ?? '';

        if (empty($soc_code)) {
            http_response_code(400);
            echo json_encode(['error' => 'SOC code is required']);
            exit;
        }

        // Check if the percentiles table exists, if not create and populate it
        $tableCheckQuery = "SHOW TABLES LIKE 'work_context_percentiles'";
        $tableExists = $pdo->query($tableCheckQuery)->rowCount() > 0;

        if (!$tableExists) {
            // Create the table
            $createTableQuery = "
                CREATE TABLE IF NOT EXISTS work_context_percentiles (
                    onetsoc_code VARCHAR(10),
                    element_id VARCHAR(20),
                    data_value DECIMAL(10,2),
                    mean_value DECIMAL(10,2),
                    std_dev DECIMAL(10,2),
                    z_score DECIMAL(10,2),
                    rank_position INT,
                    total_occupations INT,
                    percentile DECIMAL(5,1),
                    PRIMARY KEY (onetsoc_code, element_id),
                    INDEX idx_zscore (element_id, z_score),
                    INDEX idx_soc_code (onetsoc_code)
                )
            ";
            $pdo->exec($createTableQuery);

            // Populate the table
            populatePercentileTable($pdo);
        }

        // Use the optimized query with pre-calculated percentiles
        $query = "
            WITH top_elements AS (
                SELECT 
                    wcp.element_id,
                    cmr.element_name,
                    wcp.onetsoc_code,
                    ROUND(wcp.data_value, 2) as occupation_value,
                    ROUND(wcp.mean_value, 2) as average_value,
                    ROUND(wcp.z_score, 2) as z_score,
                    ROUND(ABS(wcp.z_score), 2) as abs_z_score,
                    wcp.rank_position,
                    wcp.total_occupations,
                    ROUND(wcp.percentile, 1) as percentile,
                    CASE 
                        WHEN wcp.z_score >= 2.5 THEN 'Extremely High'
                        WHEN wcp.z_score >= 1.5 THEN 'Very High'
                        WHEN wcp.z_score >= 1.0 THEN 'Notably High'
                        WHEN wcp.z_score <= -2.5 THEN 'Extremely Low'
                        WHEN wcp.z_score <= -1.5 THEN 'Very Low'
                        WHEN wcp.z_score <= -1.0 THEN 'Notably Low'
                        ELSE 'Average'
                    END as distinctiveness
                FROM work_context_percentiles wcp
                JOIN content_model_reference cmr ON wcp.element_id = cmr.element_id
                WHERE LEFT(wcp.onetsoc_code, 7) = :soc_code
                    AND RIGHT(wcp.onetsoc_code, 2) = '00'
                ORDER BY abs_z_score DESC
                LIMIT 3
            )
            SELECT * FROM top_elements
        ";

        $stmt = $pdo->prepare($query);
        $stmt->execute(['soc_code' => $soc_code]);
        $workContexts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get the actual O*NET code used (for distribution queries)
        $actualOnetsocCode = !empty($workContexts) ? $workContexts[0]['onetsoc_code'] : null;

        if (!$actualOnetsocCode) {
            http_response_code(404);
            echo json_encode(['error' => 'No work context data found for this occupation']);
            exit;
        }

        // Get response distributions for these elements
        foreach ($workContexts as &$context) {
            // Get distribution for the specific occupation
            $distQuery = "
                SELECT 
                    wc.category,
                    wc.data_value as percentage,
                    wcc.category_description
                FROM work_context wc
                LEFT JOIN work_context_categories wcc 
                    ON wc.element_id = wcc.element_id 
                    AND wc.scale_id = wcc.scale_id 
                    AND wc.category = wcc.category
                WHERE wc.onetsoc_code = :onetsoc_code
                    AND wc.element_id = :element_id
                    AND wc.scale_id = 'CXP'
                ORDER BY wc.category
            ";

            $distStmt = $pdo->prepare($distQuery);
            $distStmt->execute([
                'onetsoc_code' => $actualOnetsocCode,
                'element_id' => $context['element_id']
            ]);
            $context['distribution'] = $distStmt->fetchAll(PDO::FETCH_ASSOC);

            // Get median (average across all occupations) distribution
            $medianQuery = "
                SELECT 
                    wc.category,
                    AVG(wc.data_value) as percentage,
                    MAX(wcc.category_description) as category_description
                FROM work_context wc
                LEFT JOIN work_context_categories wcc 
                    ON wc.element_id = wcc.element_id 
                    AND wc.scale_id = wcc.scale_id 
                    AND wc.category = wcc.category
                WHERE wc.element_id = :element_id
                    AND wc.scale_id = 'CXP'
                GROUP BY wc.category
                ORDER BY wc.category
            ";

            $medianStmt = $pdo->prepare($medianQuery);
            $medianStmt->execute(['element_id' => $context['element_id']]);
            $context['median_distribution'] = $medianStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        // Get occupation details from SOC hierarchy
        $detailQuery = "
            SELECT 
                shi.detailed_occupation_code AS soc_code,
                soc_detailed.title AS title,
                shi.major_group_code,
                soc_major.title AS major_group_title,
                shi.minor_group_code,
                soc_minor.title AS minor_group_title,
                shi.broad_group_code,
                soc_broad.title AS broad_group_title,
                od.onetsoc_code,
                od.title AS onet_title
            FROM soc_hierarchy_index AS shi
            INNER JOIN SOC_major_groups AS soc_major ON shi.major_group_code = soc_major.id
            INNER JOIN SOC_minor_groups AS soc_minor ON shi.minor_group_code = soc_minor.id
            INNER JOIN SOC_broad_occupations AS soc_broad ON shi.broad_group_code = soc_broad.id
            INNER JOIN SOC_detailed_occupations AS soc_detailed ON shi.detailed_occupation_code = soc_detailed.id
            LEFT JOIN occupation_data AS od 
                ON LEFT(od.onetsoc_code, 7) = shi.detailed_occupation_code 
                AND RIGHT(od.onetsoc_code, 2) = '00'
            WHERE shi.detailed_occupation_code = :soc_code
            LIMIT 1
        ";

        $stmt = $pdo->prepare($detailQuery);
        $stmt->execute(['soc_code' => $soc_code]);
        $occupationDetails = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$occupationDetails) {
            http_response_code(404);
            echo json_encode(['error' => 'Occupation not found']);
            exit;
        }

        echo json_encode([
            'occupation' => [
                'soc_code' => $occupationDetails['soc_code'],
                'title' => $occupationDetails['title'],
                'major_group_code' => $occupationDetails['major_group_code'],
                'major_group_name' => $occupationDetails['major_group_title'],
                'minor_group_code' => $occupationDetails['minor_group_code'],
                'minor_group_name' => $occupationDetails['minor_group_title'],
                'broad_group_code' => $occupationDetails['broad_group_code'],
                'broad_group_name' => $occupationDetails['broad_group_title'],
                'onetsoc_code' => $occupationDetails['onetsoc_code'],
                'onet_title' => $occupationDetails['onet_title']
            ],
            'work_contexts' => $workContexts
        ]);
        break;

    case 'raw-bulk':
        // Bulk unfiltered work-context category percentages for a list
        // of SOCs. Bypasses the "concerning-only" filter that
        // rabelais-annotations.php applies (valence = -1, z_score > 0,
        // top-10 by abs z-score) so callers can compute the actual
        // average across any underworld element — including positive-
        // valence ones (autonomy, freedom, public speaking) and
        // elements where most figures are *below* average.
        $soc_codes_param = $_GET['soc_codes'] ?? '';
        if (empty($soc_codes_param)) {
            http_response_code(400);
            echo json_encode([
                'error' =>
                    'soc_codes is required (comma-separated 7-char SOCs like "11-1011,45-2092")',
            ]);
            exit;
        }
        $soc_codes = array_values(array_unique(array_filter(
            array_map('trim', explode(',', $soc_codes_param)),
            function ($c) {
                return preg_match('/^\d{2}-\d{4}$/', $c);
            }
        )));
        if (empty($soc_codes)) {
            http_response_code(400);
            echo json_encode([
                'error' =>
                    'No valid 7-char SOC codes (expected NN-NNNN, comma-separated)',
            ]);
            exit;
        }

        // PDO can't bind an IN-list directly — build placeholders.
        $placeholders = implode(',', array_fill(0, count($soc_codes), '?'));
        $sql = "
            SELECT
                LEFT(wc.onetsoc_code, 7) AS soc_2018_code,
                wc.element_id,
                cmr.element_name,
                cmr.description AS element_description,
                wcv.valence_score,
                wc.category,
                wcc.category_description,
                wc.data_value AS percentage
            FROM work_context AS wc
            INNER JOIN content_model_reference AS cmr
                ON wc.element_id = cmr.element_id
            LEFT JOIN work_context_categories AS wcc
                ON wc.element_id = wcc.element_id
               AND wc.scale_id = wcc.scale_id
               AND wc.category = wcc.category
            LEFT JOIN work_context_valence AS wcv
                ON wc.element_id = wcv.element_id
            WHERE wc.scale_id = 'CXP'
              AND wc.recommend_suppress = 'N'
              AND RIGHT(wc.onetsoc_code, 3) = '.00'
              AND LEFT(wc.onetsoc_code, 7) IN ($placeholders)
            ORDER BY wc.element_id, soc_2018_code, wc.category
        ";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($soc_codes);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Element-level US stats across ALL occupations (CX = mean
        // value on the original 1–5 scale, not category percentages).
        // The deck uses these for the underworld's z-score per element.
        $usStatsStmt = $pdo->query("
            SELECT
                element_id,
                AVG(data_value) AS us_mean,
                STDDEV(data_value) AS us_stddev,
                COUNT(DISTINCT onetsoc_code) AS us_n
            FROM work_context
            WHERE scale_id = 'CX'
              AND data_value IS NOT NULL
              AND recommend_suppress = 'N'
              AND RIGHT(onetsoc_code, 3) = '.00'
            GROUP BY element_id
        ");
        $usStatsRows = $usStatsStmt->fetchAll(PDO::FETCH_ASSOC);
        $usStatsByElement = [];
        foreach ($usStatsRows as $r) {
            $usStatsByElement[$r['element_id']] = [
                'us_mean' => $r['us_mean'] !== null
                    ? (float) $r['us_mean'] : null,
                'us_stddev' => $r['us_stddev'] !== null
                    ? (float) $r['us_stddev'] : null,
                'us_n' => (int) $r['us_n'],
            ];
        }

        // Per-(SOC, element) CX mean for the requested SOCs. Faster
        // than asking the client to weight categories back into a
        // mean — and the CX value is what the underlying scale
        // intends.
        $meanStmt = $pdo->prepare("
            SELECT
                LEFT(onetsoc_code, 7) AS soc_2018_code,
                element_id,
                data_value AS occ_mean
            FROM work_context
            WHERE scale_id = 'CX'
              AND data_value IS NOT NULL
              AND recommend_suppress = 'N'
              AND RIGHT(onetsoc_code, 3) = '.00'
              AND LEFT(onetsoc_code, 7) IN ($placeholders)
        ");
        $meanStmt->execute($soc_codes);
        $meanRows = $meanStmt->fetchAll(PDO::FETCH_ASSOC);
        $meanBySocElement = [];
        foreach ($meanRows as $r) {
            $soc = $r['soc_2018_code'];
            if (!isset($meanBySocElement[$soc])) {
                $meanBySocElement[$soc] = [];
            }
            $meanBySocElement[$soc][$r['element_id']] =
                (float) $r['occ_mean'];
        }

        // Reshape category-percentage rows into:
        //   elements: { eid: { element_id, element_name,
        //               element_description, valence_score,
        //               category_descriptions: { cat: desc },
        //               us_mean, us_stddev, us_n } }
        //   data:     { soc: { eid: { categories: { cat: pct },
        //                             mean: occ_mean | null } } }
        $elements = [];
        $data = [];
        foreach ($rows as $r) {
            $eid = $r['element_id'];
            $soc = $r['soc_2018_code'];
            $cat = (int) $r['category'];

            if (!isset($elements[$eid])) {
                $elements[$eid] = [
                    'element_id' => $eid,
                    'element_name' => $r['element_name'],
                    'element_description' => $r['element_description'],
                    'valence_score' => $r['valence_score'] !== null
                        ? (int) $r['valence_score'] : null,
                    'category_descriptions' => [],
                    'us_mean' =>
                        $usStatsByElement[$eid]['us_mean'] ?? null,
                    'us_stddev' =>
                        $usStatsByElement[$eid]['us_stddev'] ?? null,
                    'us_n' =>
                        $usStatsByElement[$eid]['us_n'] ?? null,
                ];
            }
            if (
                $r['category_description'] !== null &&
                !isset($elements[$eid]['category_descriptions'][$cat])
            ) {
                $elements[$eid]['category_descriptions'][$cat] =
                    $r['category_description'];
            }

            if (!isset($data[$soc]))
                $data[$soc] = [];
            if (!isset($data[$soc][$eid])) {
                $data[$soc][$eid] = [
                    'categories' => [],
                    'mean' =>
                        $meanBySocElement[$soc][$eid] ?? null,
                ];
            }
            $data[$soc][$eid]['categories'][(string) $cat] =
                (float) $r['percentage'];
        }

        // Cast inner maps to objects so json_encode emits {} not [].
        foreach ($elements as &$el) {
            $el['category_descriptions'] =
                (object) $el['category_descriptions'];
        }
        unset($el);
        foreach ($data as &$socElements) {
            foreach ($socElements as &$rec) {
                $rec['categories'] = (object) $rec['categories'];
            }
            unset($rec);
        }
        unset($socElements);

        header('Cache-Control: public, max-age=3600');
        echo json_encode([
            'soc_codes' => $soc_codes,
            'elements' => (object) $elements,
            'data' => (object) $data,
            'row_count' => count($rows),
        ]);
        break;

    case 'raw-element':
        // Returns unfiltered category-level percentages for a single
        // (SOC, element) pair, bypassing the concerning-only filters
        // used by the dashboard endpoint. Lets the deck graph any
        // work-context question for any occupation — including
        // positive-valence elements that the dashboard never surfaces.
        $soc_code = $_GET['code'] ?? '';
        $element_id = $_GET['element_id'] ?? '';

        if (empty($soc_code) || empty($element_id)) {
            http_response_code(400);
            echo json_encode([
                'error' => 'code (7-char SOC) and element_id are required'
            ]);
            exit;
        }

        // Element header (name + description) from the content model.
        $metaStmt = $pdo->prepare("
            SELECT element_id, element_name, description AS element_description
            FROM content_model_reference
            WHERE element_id = :element_id
            LIMIT 1
        ");
        $metaStmt->execute(['element_id' => $element_id]);
        $meta = $metaStmt->fetch(PDO::FETCH_ASSOC);

        // Per-category percentages for the requested SOC. Mirrors the
        // 7-char-prefix / .00 base-variant pattern the rest of this
        // file uses to join onetsoc_code (10 chars) against soc_2018
        // (7 chars).
        $occStmt = $pdo->prepare("
            SELECT wc.category,
                   wc.data_value AS percentage,
                   MAX(wcc.category_description) AS category_description
            FROM work_context wc
            LEFT JOIN work_context_categories wcc
              ON wc.element_id = wcc.element_id
             AND wc.scale_id = wcc.scale_id
             AND wc.category = wcc.category
            WHERE LEFT(wc.onetsoc_code, 7) = :soc_code
              AND RIGHT(wc.onetsoc_code, 2) = '00'
              AND wc.element_id = :element_id
              AND wc.scale_id = 'CXP'
            GROUP BY wc.category, wc.data_value
            ORDER BY wc.category
        ");
        $occStmt->execute([
            'soc_code' => $soc_code,
            'element_id' => $element_id,
        ]);
        $occRows = $occStmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'soc_code' => $soc_code,
            'element_id' => $element_id,
            'element' => $meta ?: null,
            'categories' => array_map(function ($r) {
                return [
                    'category' => (int) $r['category'],
                    'percentage' => (float) $r['percentage'],
                    'category_description' => $r['category_description'],
                ];
            }, $occRows),
            'found' => !empty($occRows),
        ]);
        break;

    case 'refresh-percentiles':
        // This action can be called periodically to refresh the percentile cache
        // You might want to protect this endpoint with authentication
        try {
            populatePercentileTable($pdo);
            echo json_encode(['success' => true, 'message' => 'Percentiles refreshed successfully']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to refresh percentiles: ' . $e->getMessage()]);
        }
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}

/**
 * Function to populate or refresh the percentiles table
 */
function populatePercentileTable($pdo)
{
    $populateQuery = "
        INSERT INTO work_context_percentiles
        WITH element_statistics AS (
            SELECT
                element_id,
                AVG(data_value) as mean_value,
                STDDEV(data_value) as std_dev,
                COUNT(DISTINCT onetsoc_code) as total_occupations
            FROM work_context
            WHERE scale_id = 'CX'
                AND data_value IS NOT NULL
            GROUP BY element_id
        ),
        ranked_data AS (
            SELECT
                wc.onetsoc_code,
                wc.element_id,
                wc.data_value,
                es.mean_value,
                es.std_dev,
                (wc.data_value - es.mean_value) / es.std_dev as z_score,
                RANK() OVER (PARTITION BY wc.element_id ORDER BY wc.data_value DESC) as rank_position,
                es.total_occupations
            FROM work_context wc
            JOIN element_statistics es ON wc.element_id = es.element_id
            WHERE wc.scale_id = 'CX'
                AND wc.data_value IS NOT NULL
        )
        SELECT 
            onetsoc_code,
            element_id,
            data_value,
            mean_value,
            std_dev,
            z_score,
            rank_position,
            total_occupations,
            ((total_occupations - rank_position + 1) / total_occupations) * 100 as percentile
        FROM ranked_data
        ON DUPLICATE KEY UPDATE
            data_value = VALUES(data_value),
            mean_value = VALUES(mean_value),
            std_dev = VALUES(std_dev),
            z_score = VALUES(z_score),
            rank_position = VALUES(rank_position),
            total_occupations = VALUES(total_occupations),
            percentile = VALUES(percentile)
    ";

    $pdo->exec($populateQuery);
}
?>