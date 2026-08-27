<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
// Include the existing database connection
require_once 'database.php';
/**
 * IMPORTANT NOTE FOR FUTURE LLMs:
 * 
 * Employment counts (TOT_EMP) are derived from the `employment_projections` table,
 * NOT from `occupational_data.TOT_EMP`.
 * 
 * Reason: OEWS (occupational_data) systematically undercounts occupations where:
 * - Workers are in the farm sector (NAICS 111/112 excluded from OEWS)
 * - Workers are self-employed (OEWS only surveys establishments)
 * - Workers are in the gig economy (no establishment to survey)
 * 
 * The employment_projections table uses BLS Employment Projections data (Table 1.10)
 * which synthesizes OEWS with CPS household survey data to capture the full workforce.
 * 
 * Example: SOC 45-2092 (Crop Farmworkers)
 *   - OEWS: 258,730 (only captures farm labor contractors)
 *   - Employment Projections: 504,800 (includes direct farm hires)
 * 
 * Wage data still comes from occupational_data (OEWS) as it remains the best source for wages.
 */
try {
    // Query 1: Get all character data
    // Only narrative fields + hierarchy titles needed by frontend (tooltip, ghost animation)
    // Wage/employment data removed — available via hierarchical_data if ever needed
    $stmt = $pdo->prepare("
        SELECT DISTINCT
            o.name,
            o.labor,
            d.d1 as description,
            d.lot_in_life,
            d.snippet,
            od.OCC_TITLE as occ_title,
            onet_od.description as occ_description,
            o.occ_code,
            smg.title as major_group_title,
            smi.title as minor_group_title,
            sb.title as broad_group_title
        FROM rabelais_occupations o
        LEFT JOIN rabelais_descriptions d ON o.no = d.no
        LEFT JOIN occupational_data od ON o.occ_code = od.OCC_CODE
        LEFT JOIN occupation_data onet_od
            ON LEFT(onet_od.onetsoc_code, 7) = o.occ_code
            AND RIGHT(onet_od.onetsoc_code, 2) = '00'
        LEFT JOIN soc_hierarchy_index sh ON o.occ_code = sh.detailed_occupation_code
        LEFT JOIN SOC_major_groups smg ON sh.major_group_code = smg.id
        LEFT JOIN SOC_minor_groups smi ON sh.minor_group_code = smi.id
        LEFT JOIN SOC_broad_occupations sb ON sh.broad_group_code = sb.id
        WHERE o.name IS NOT NULL AND o.name != ''
        ORDER BY o.name
    ");
    $stmt->execute();
    $characters = $stmt->fetchAll(PDO::FETCH_ASSOC);
    // Query 2: DISABLED — wage_distribution is not consumed by the frontend.
    // Data overlaps with hierarchical_data. Kept for potential future use.
    /*
    $stmtWages = $pdo->prepare("
        SELECT
            od.A_MEAN,
            ep.EMP_2024 AS TOT_EMP,
            ep.EMP_2024 AS PROJ_TOT_EMP,
            ep.EMP_2034,
            ep.EMP_CHANGE_NUM,
            ep.EMP_CHANGE_PCT,
            od.OCC_TITLE,
            od.OCC_CODE
        FROM occupational_data od
        LEFT JOIN employment_projections ep ON od.OCC_CODE = ep.OCC_CODE
        WHERE od.O_GROUP = 'detailed'
        AND ep.EMP_2024 IS NOT NULL
        ORDER BY od.A_MEAN
    ");
    $stmtWages->execute();
    $wageDistribution = $stmtWages->fetchAll(PDO::FETCH_ASSOC);
    */
    // Query 3: Get national statistics (all US occupations)
    // Note: TOT_EMP from employment_projections for total workforce count
    $stmtNational = $pdo->prepare("
        SELECT 
            ep.EMP_2024 AS TOT_EMP,
            ep.EMP_2024 AS PROJ_TOT_EMP,
            ep.EMP_2034,
            ep.EMP_CHANGE_NUM,
            ep.EMP_CHANGE_PCT,
            od.A_MEDIAN,
            od.A_MEAN,
            od.A_PCT10,
            od.A_PCT25,
            od.A_PCT75,
            od.A_PCT90,
            od.H_MEDIAN,
            od.H_MEAN,
            od.H_PCT10,
            od.H_PCT25,
            od.H_PCT75,
            od.H_PCT90
        FROM occupational_data od
        LEFT JOIN employment_projections ep ON od.OCC_CODE = ep.OCC_CODE
        WHERE od.OCC_CODE = '00-0000'
    ");
    $stmtNational->execute();
    $nationalStats = $stmtNational->fetch(PDO::FETCH_ASSOC);
    // $totalEmployment removed — not consumed by frontend (national_stats.TOT_EMP is used instead)
    // Query 4: DISABLED — major_group_employment is not consumed by the frontend.
    // Group-level employment is already available via hierarchical_data.
    /*
    $stmtMajorGroups = $pdo->prepare("
        SELECT
            ep.EMP_2024 AS TOT_EMP,
            ep.EMP_2024 AS PROJ_TOT_EMP,
            ep.EMP_2034,
            ep.EMP_CHANGE_NUM,
            ep.EMP_CHANGE_PCT,
            smg.title as major_group_title
        FROM occupational_data od
        JOIN SOC_major_groups smg ON od.OCC_CODE = smg.id
        LEFT JOIN employment_projections ep ON od.OCC_CODE = ep.OCC_CODE
        WHERE od.O_GROUP = 'major' AND ep.EMP_2024 IS NOT NULL
    ");
    $stmtMajorGroups->execute();
    $majorGroupEmployment = $stmtMajorGroups->fetchAll(PDO::FETCH_ASSOC);
    */
    // Query 5: DISABLED — wages_by_major_group is not consumed by the frontend.
    // Duplicated by hierarchical_data which includes the same wage fields.
    /*
    $stmtWagesByMajor = $pdo->prepare("
        SELECT
            od.A_MEDIAN,
            od.A_MEAN,
            ep.EMP_2024 AS TOT_EMP,
            ep.EMP_2024 AS PROJ_TOT_EMP,
            ep.EMP_2034,
            ep.EMP_CHANGE_NUM,
            ep.EMP_CHANGE_PCT,
            od.OCC_TITLE,
            od.OCC_CODE,
            od.A_PCT10,
            od.A_PCT25,
            od.A_PCT75,
            od.A_PCT90,
            sh.major_group_code,
            smg.title as major_group_title
        FROM occupational_data od
        JOIN soc_hierarchy_index sh ON od.OCC_CODE = sh.detailed_occupation_code
        JOIN SOC_major_groups smg ON sh.major_group_code = smg.id
        LEFT JOIN employment_projections ep ON od.OCC_CODE = ep.OCC_CODE
        WHERE od.O_GROUP = 'detailed'
        AND ep.EMP_2024 IS NOT NULL
        ORDER BY smg.title, od.A_MEDIAN
    ");
    $stmtWagesByMajor->execute();
    $wagesByMajorGroup = $stmtWagesByMajor->fetchAll(PDO::FETCH_ASSOC);
    */
    // Query 6: Hierarchical data - uses soc_hierarchy_index
    // Note: All TOT_EMP fields from employment_projections at each hierarchy level
    // PROJ_TOT_EMP included for client-side source detection
    $stmtHierarchy = $pdo->prepare("
        SELECT 
            detailed.A_MEDIAN,
            detailed.A_MEAN,
            ep_detailed.EMP_2024 AS TOT_EMP,
            ep_detailed.EMP_2024 AS PROJ_TOT_EMP,
            ep_detailed.EMP_2034,
            ep_detailed.EMP_CHANGE_NUM,
            ep_detailed.EMP_CHANGE_PCT,
            detailed.OCC_TITLE,
            detailed.OCC_CODE,
            detailed.A_PCT10,
            detailed.A_PCT25,
            detailed.A_PCT75,
            detailed.A_PCT90,
            detailed.H_MEAN,
            detailed.H_MEDIAN,
            detailed.H_PCT10,
            detailed.H_PCT25,
            detailed.H_PCT75,
            detailed.H_PCT90,
            
            shi.major_group_code,
            smg.title as major_group_title,
            od_major.A_MEDIAN as major_a_median,
            od_major.A_PCT25 as major_a_pct25,
            od_major.A_PCT75 as major_a_pct75,
            od_major.A_PCT10 as major_a_pct10,
            od_major.A_PCT90 as major_a_pct90,
            od_major.H_MEAN as major_h_mean,
            od_major.H_MEDIAN as major_h_median,
            od_major.H_PCT10 as major_h_pct10,
            od_major.H_PCT25 as major_h_pct25,
            od_major.H_PCT75 as major_h_pct75,
            od_major.H_PCT90 as major_h_pct90,
            ep_major.EMP_2024 as major_tot_emp,
            
            shi.minor_group_code,
            smi.title as minor_group_title,
            od_minor.A_MEDIAN as minor_a_median,
            od_minor.A_PCT25 as minor_a_pct25,
            od_minor.A_PCT75 as minor_a_pct75,
            od_minor.A_PCT10 as minor_a_pct10,
            od_minor.A_PCT90 as minor_a_pct90,
            od_minor.H_MEAN as minor_h_mean,
            od_minor.H_MEDIAN as minor_h_median,
            od_minor.H_PCT10 as minor_h_pct10,
            od_minor.H_PCT25 as minor_h_pct25,
            od_minor.H_PCT75 as minor_h_pct75,
            od_minor.H_PCT90 as minor_h_pct90,
            ep_minor.EMP_2024 as minor_tot_emp,
            
            shi.broad_group_code,
            sb.title as broad_group_title,
            od_broad.A_MEDIAN as broad_a_median,
            od_broad.A_PCT25 as broad_a_pct25,
            od_broad.A_PCT75 as broad_a_pct75,
            od_broad.A_PCT10 as broad_a_pct10,
            od_broad.A_PCT90 as broad_a_pct90,
            od_broad.H_MEAN as broad_h_mean,
            od_broad.H_MEDIAN as broad_h_median,
            od_broad.H_PCT10 as broad_h_pct10,
            od_broad.H_PCT25 as broad_h_pct25,
            od_broad.H_PCT75 as broad_h_pct75,
            od_broad.H_PCT90 as broad_h_pct90,
            ep_broad.EMP_2024 as broad_tot_emp
            
        FROM occupational_data detailed
        INNER JOIN soc_hierarchy_index shi ON detailed.OCC_CODE = shi.detailed_occupation_code
        LEFT JOIN SOC_major_groups smg ON shi.major_group_code = smg.id
        LEFT JOIN SOC_minor_groups smi ON shi.minor_group_code = smi.id
        LEFT JOIN SOC_broad_occupations sb ON shi.broad_group_code = sb.id
        LEFT JOIN occupational_data od_major ON shi.major_group_code = od_major.OCC_CODE
        LEFT JOIN occupational_data od_minor ON shi.minor_group_code = od_minor.OCC_CODE
        LEFT JOIN occupational_data od_broad ON shi.broad_group_code = od_broad.OCC_CODE
        LEFT JOIN employment_projections ep_detailed ON detailed.OCC_CODE = ep_detailed.OCC_CODE
        LEFT JOIN employment_projections ep_major ON shi.major_group_code = ep_major.OCC_CODE
        LEFT JOIN employment_projections ep_minor ON shi.minor_group_code = ep_minor.OCC_CODE
        LEFT JOIN employment_projections ep_broad ON shi.broad_group_code = ep_broad.OCC_CODE
        WHERE detailed.O_GROUP = 'detailed'
            AND ep_detailed.EMP_2024 IS NOT NULL
        ORDER BY shi.major_group_code, shi.minor_group_code, shi.broad_group_code, detailed.OCC_TITLE
    ");
    $stmtHierarchy->execute();
    $hierarchicalData = $stmtHierarchy->fetchAll(PDO::FETCH_ASSOC);
    // Query 7: DISABLED — weighted_data is not consumed by the frontend.
    // Nearly identical to hierarchical_data (Query 6) minus the group-level wage columns.
    /*
    $stmtWeighted = $pdo->prepare("
        SELECT
            detailed.A_MEDIAN,
            detailed.A_MEAN,
            ep.EMP_2024 AS TOT_EMP,
            ep.EMP_2024 AS PROJ_TOT_EMP,
            ep.EMP_2034,
            ep.EMP_CHANGE_NUM,
            ep.EMP_CHANGE_PCT,
            detailed.OCC_TITLE,
            detailed.OCC_CODE,
            detailed.A_PCT10,
            detailed.A_PCT25,
            detailed.A_PCT75,
            detailed.A_PCT90,
            detailed.H_MEAN,
            detailed.H_MEDIAN,
            detailed.H_PCT10,
            detailed.H_PCT25,
            detailed.H_PCT75,
            detailed.H_PCT90,

            shi.major_group_code,
            smg.title as major_group_title,
            shi.minor_group_code,
            smi.title as minor_group_title,
            shi.broad_group_code,
            sb.title as broad_group_title

        FROM occupational_data detailed
        INNER JOIN soc_hierarchy_index shi ON detailed.OCC_CODE = shi.detailed_occupation_code
        LEFT JOIN SOC_major_groups smg ON shi.major_group_code = smg.id
        LEFT JOIN SOC_minor_groups smi ON shi.minor_group_code = smi.id
        LEFT JOIN SOC_broad_occupations sb ON shi.broad_group_code = sb.id
        LEFT JOIN employment_projections ep ON detailed.OCC_CODE = ep.OCC_CODE
        WHERE detailed.O_GROUP = 'detailed'
            AND ep.EMP_2024 IS NOT NULL
        ORDER BY shi.major_group_code, shi.minor_group_code, shi.broad_group_code, detailed.OCC_TITLE
    ");
    $stmtWeighted->execute();
    $weightedData = $stmtWeighted->fetchAll(PDO::FETCH_ASSOC);
    */
    // Query 8: RIASEC Interests Data with hierarchy info
    // Note: TOT_EMP from employment_projections; projection columns removed (unused by frontend)
    $stmtInterests = $pdo->prepare("
        SELECT
            cw.soc_2018_code,
            cw.onet_soc_2019_title AS occupation_title,
            ep.EMP_2024 AS TOT_EMP,
            shi.major_group_code,
            shi.minor_group_code,
            shi.broad_group_code,
            smg.title AS major_group_title,
            smi.title AS minor_group_title,
            sb.title AS broad_group_title,
            MAX(CASE WHEN i.element_id = '1.B.1.a' THEN i.data_value END) AS realistic,
            MAX(CASE WHEN i.element_id = '1.B.1.b' THEN i.data_value END) AS investigative,
            MAX(CASE WHEN i.element_id = '1.B.1.c' THEN i.data_value END) AS artistic,
            MAX(CASE WHEN i.element_id = '1.B.1.d' THEN i.data_value END) AS social,
            MAX(CASE WHEN i.element_id = '1.B.1.e' THEN i.data_value END) AS enterprising,
            MAX(CASE WHEN i.element_id = '1.B.1.f' THEN i.data_value END) AS conventional
        FROM interests i
        INNER JOIN onet_soc_crosswalk cw ON i.onetsoc_code = cw.onet_soc_2019_code
        LEFT JOIN employment_projections ep ON cw.soc_2018_code = ep.OCC_CODE
        LEFT JOIN soc_hierarchy_index shi ON cw.soc_2018_code = shi.detailed_occupation_code
        LEFT JOIN SOC_major_groups smg ON shi.major_group_code = smg.id
        LEFT JOIN SOC_minor_groups smi ON shi.minor_group_code = smi.id
        LEFT JOIN SOC_broad_occupations sb ON shi.broad_group_code = sb.id
        WHERE i.scale_id = 'OI'
            AND RIGHT(i.onetsoc_code, 3) = '.00'
        GROUP BY
            cw.soc_2018_code,
            cw.onet_soc_2019_title,
            ep.EMP_2024,
            shi.major_group_code,
            shi.minor_group_code,
            shi.broad_group_code,
            smg.title,
            smi.title,
            sb.title
        ORDER BY cw.soc_2018_code
    ");
    $stmtInterests->execute();
    $interestsData = $stmtInterests->fetchAll(PDO::FETCH_ASSOC);

    // Query 8b: BLS-aggregate backfill.
    //
    // O*NET surveys at the detailed sub-occupation level (e.g. 31-1121.00
    // Home Health Aides, 31-1122.00 Personal Care Aides). BLS, however,
    // sometimes publishes employment at a coarser SOC code (31-1120 Home
    // Health and Personal Care Aides). Because the crosswalk maps each
    // O*NET sub to its finer SOC2018 code, those finer codes drop out
    // of Query 8 with TOT_EMP = NULL (no row in employment_projections),
    // and the client filters them out — leaving the BLS-aggregate
    // employment (3.99 M workers, in the case of 31-1120) entirely
    // unrepresented in the interest-profile averages.
    //
    // This supplemental pass adds one synthetic interests row per
    // BLS-aggregate code by matching O*NET children that share the
    // same 6-char SOC prefix (e.g. "31-112") and averaging their RIASEC
    // scores. The TOT_EMP is the BLS-aggregate's published employment.
    // Only codes NOT already represented in Query 8's output are added,
    // so this never double-counts.
    if (count($interestsData) > 0) {
        $existingCodes = array_values(array_unique(
            array_column($interestsData, 'soc_2018_code')
        ));
        $placeholders = implode(',', array_fill(0, count($existingCodes), '?'));
        $stmtInterestsAggregates = $pdo->prepare("
            SELECT
                ep.OCC_CODE AS soc_2018_code,
                ep.OCC_TITLE AS occupation_title,
                ep.EMP_2024 AS TOT_EMP,
                shi.major_group_code,
                shi.minor_group_code,
                shi.broad_group_code,
                smg.title AS major_group_title,
                smi.title AS minor_group_title,
                sb.title AS broad_group_title,
                AVG(CASE WHEN i.element_id = '1.B.1.a' THEN i.data_value END) AS realistic,
                AVG(CASE WHEN i.element_id = '1.B.1.b' THEN i.data_value END) AS investigative,
                AVG(CASE WHEN i.element_id = '1.B.1.c' THEN i.data_value END) AS artistic,
                AVG(CASE WHEN i.element_id = '1.B.1.d' THEN i.data_value END) AS social,
                AVG(CASE WHEN i.element_id = '1.B.1.e' THEN i.data_value END) AS enterprising,
                AVG(CASE WHEN i.element_id = '1.B.1.f' THEN i.data_value END) AS conventional
            FROM employment_projections ep
            JOIN interests i
                ON LEFT(i.onetsoc_code, 6) = LEFT(ep.OCC_CODE, 6)
               AND SUBSTRING(i.onetsoc_code, 7, 1) <> '0'
               AND RIGHT(i.onetsoc_code, 3) = '.00'
               AND i.scale_id = 'OI'
            LEFT JOIN soc_hierarchy_index shi
                ON ep.OCC_CODE = shi.detailed_occupation_code
            LEFT JOIN SOC_major_groups smg ON shi.major_group_code = smg.id
            LEFT JOIN SOC_minor_groups smi ON shi.minor_group_code = smi.id
            LEFT JOIN SOC_broad_occupations sb ON shi.broad_group_code = sb.id
            WHERE ep.OCC_CODE NOT IN ($placeholders)
              AND ep.EMP_2024 > 0
            GROUP BY
                ep.OCC_CODE, ep.OCC_TITLE, ep.EMP_2024,
                shi.major_group_code, shi.minor_group_code, shi.broad_group_code,
                smg.title, smi.title, sb.title
        ");
        $stmtInterestsAggregates->execute($existingCodes);
        $aggregateRows = $stmtInterestsAggregates->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($aggregateRows)) {
            $interestsData = array_merge($interestsData, $aggregateRows);
        }
    }

    // Query 9: Top 3 Concerning Work Context Elements per Occupation (original structure)
    // Note: Uses employment_projections.EMP_2024 for weighting instead of occupational_data.TOT_EMP
    $stmtWorkContext = $pdo->prepare("
        WITH element_statistics AS (
            SELECT
                element_id,
                AVG(data_value) AS mean_value,
                STDDEV(data_value) AS std_dev,
                COUNT(DISTINCT onetsoc_code) AS total_occupations
            FROM work_context
            WHERE scale_id = 'CX'
                AND data_value IS NOT NULL
                AND recommend_suppress = 'N'
            GROUP BY element_id
        ),
        all_elements AS (
            SELECT
                wc.onetsoc_code,
                cw.soc_2018_code,
                cw.onet_soc_2019_title AS occupation_title,
                wc.element_id,
                cmr.element_name,
                cmr.description AS element_description,
                wc.data_value AS occupation_value,
                es.mean_value,
                es.std_dev,
                (wc.data_value - es.mean_value) / NULLIF(es.std_dev, 0) AS z_score,
                es.total_occupations,
                RANK() OVER (PARTITION BY wc.element_id ORDER BY wc.data_value DESC) AS rank_among_all,
                wcv.valence_score,
                wcv.valence_label
            FROM work_context AS wc
            INNER JOIN onet_soc_crosswalk AS cw
                ON wc.onetsoc_code = cw.onet_soc_2019_code
            INNER JOIN content_model_reference AS cmr 
                ON wc.element_id = cmr.element_id
            INNER JOIN element_statistics es 
                ON wc.element_id = es.element_id
            INNER JOIN work_context_valence AS wcv
                ON wc.element_id = wcv.element_id
            WHERE wc.scale_id = 'CX'
                AND wc.data_value IS NOT NULL
                AND wc.recommend_suppress = 'N'
                AND RIGHT(wc.onetsoc_code, 3) = '.00'
                AND wcv.valence_score != 0
        ),
        concerning_elements AS (
            SELECT *,
                ROW_NUMBER() OVER (
                    PARTITION BY soc_2018_code 
                    ORDER BY ABS(z_score) DESC
                ) AS concern_rank
            FROM all_elements
            WHERE (valence_score = -1 AND z_score > 0)
               OR (valence_score = 1 AND z_score < 0)
        ),
        top_concerns AS (
            SELECT * FROM concerning_elements WHERE concern_rank <= 10
        )
        SELECT 
            tc.soc_2018_code,
            tc.occupation_title,
            tc.concern_rank,
            tc.element_id,
            tc.element_name,
            tc.element_description,
            ROUND(tc.occupation_value, 2) AS occupation_value,
            ROUND(tc.mean_value, 2) AS all_occupations_avg,
            ROUND(tc.z_score, 2) AS z_score,
            tc.rank_among_all,
            tc.total_occupations,
            ROUND((tc.total_occupations - tc.rank_among_all + 1) / tc.total_occupations * 100, 1) AS percentile,
            CASE 
                WHEN tc.z_score >= 2.5 THEN 'Extremely High'
                WHEN tc.z_score >= 1.5 THEN 'Very High'
                WHEN tc.z_score >= 1.0 THEN 'High'
                WHEN tc.z_score <= -2.5 THEN 'Extremely Low'
                WHEN tc.z_score <= -1.5 THEN 'Very Low'
                WHEN tc.z_score <= -1.0 THEN 'Low'
                ELSE 'Average'
            END AS distinctiveness,
            tc.valence_score,
            tc.valence_label,
            dist.category,
            ROUND(dist.data_value, 1) AS category_percentage,
            wcc.category_description
        FROM top_concerns tc
        LEFT JOIN work_context AS dist
            ON tc.onetsoc_code = dist.onetsoc_code
            AND tc.element_id = dist.element_id
            AND dist.scale_id = 'CXP'
        LEFT JOIN work_context_categories AS wcc
            ON dist.element_id = wcc.element_id
            AND dist.scale_id = wcc.scale_id
            AND dist.category = wcc.category
        ORDER BY tc.soc_2018_code, tc.concern_rank, dist.category
    ");
    $stmtWorkContext->execute();
    $workContextData = $stmtWorkContext->fetchAll(PDO::FETCH_ASSOC);
    // Query 10: DISABLED — work_context_major_data is not consumed by the frontend.
    // Heavy query (5 CTEs) with employment-weighted z-score calculations by major group.
    /*
    $stmtWorkContextMajor = $pdo->prepare("
        WITH major_group_means AS (
            SELECT
                shi.major_group_code,
                smg.title AS major_group_title,
                wc.element_id,
                cmr.element_name,
                cmr.description AS element_description,
                wcv.valence_score,
                wcv.valence_label,
                SUM(wc.data_value * COALESCE(ep.EMP_2024, 1)) / SUM(COALESCE(ep.EMP_2024, 1)) AS weighted_mean
            FROM work_context AS wc
            INNER JOIN onet_soc_crosswalk AS cw
                ON wc.onetsoc_code = cw.onet_soc_2019_code
            INNER JOIN soc_hierarchy_index AS shi
                ON cw.soc_2018_code = shi.detailed_occupation_code
            INNER JOIN SOC_major_groups AS smg
                ON shi.major_group_code = smg.id
            INNER JOIN content_model_reference AS cmr
                ON wc.element_id = cmr.element_id
            INNER JOIN work_context_valence AS wcv
                ON wc.element_id = wcv.element_id
            LEFT JOIN employment_projections AS ep
                ON cw.soc_2018_code = ep.OCC_CODE
            WHERE wc.scale_id = 'CX'
                AND wc.data_value IS NOT NULL
                AND wc.recommend_suppress = 'N'
                AND RIGHT(wc.onetsoc_code, 3) = '.00'
                AND wcv.valence_score != 0
            GROUP BY
                shi.major_group_code, smg.title, wc.element_id,
                cmr.element_name, cmr.description, wcv.valence_score, wcv.valence_label
        ),
        element_stats AS (
            SELECT element_id, AVG(weighted_mean) AS overall_mean, STDDEV(weighted_mean) AS overall_std
            FROM major_group_means GROUP BY element_id
        ),
        major_group_with_zscore AS (
            SELECT mgm.*, es.overall_mean, es.overall_std,
                (mgm.weighted_mean - es.overall_mean) / NULLIF(es.overall_std, 0) AS z_score
            FROM major_group_means mgm
            INNER JOIN element_stats es ON mgm.element_id = es.element_id
        ),
        major_group_categories AS (
            SELECT shi.major_group_code, wc.element_id, wc.category, wcc.category_description,
                SUM(wc.data_value * COALESCE(ep.EMP_2024, 1)) / SUM(COALESCE(ep.EMP_2024, 1)) AS weighted_avg_percentage
            FROM work_context AS wc
            INNER JOIN onet_soc_crosswalk AS cw ON wc.onetsoc_code = cw.onet_soc_2019_code
            INNER JOIN soc_hierarchy_index AS shi ON cw.soc_2018_code = shi.detailed_occupation_code
            INNER JOIN work_context_valence AS wcv ON wc.element_id = wcv.element_id
            LEFT JOIN work_context_categories AS wcc
                ON wc.element_id = wcc.element_id AND wc.scale_id = wcc.scale_id AND wc.category = wcc.category
            LEFT JOIN employment_projections AS ep ON cw.soc_2018_code = ep.OCC_CODE
            WHERE wc.scale_id = 'CXP' AND wc.data_value IS NOT NULL AND wc.recommend_suppress = 'N'
                AND RIGHT(wc.onetsoc_code, 3) = '.00' AND wcv.valence_score != 0
            GROUP BY shi.major_group_code, wc.element_id, wc.category, wcc.category_description
        )
        SELECT mgz.major_group_code, mgz.major_group_title, mgz.element_id, mgz.element_name,
            mgz.element_description, ROUND(mgz.weighted_mean, 2) AS weighted_mean,
            ROUND(mgz.z_score, 2) AS z_score,
            CASE
                WHEN mgz.z_score >= 2.5 THEN 'Extremely High' WHEN mgz.z_score >= 1.5 THEN 'Very High'
                WHEN mgz.z_score >= 1.0 THEN 'High' WHEN mgz.z_score <= -2.5 THEN 'Extremely Low'
                WHEN mgz.z_score <= -1.5 THEN 'Very Low' WHEN mgz.z_score <= -1.0 THEN 'Low'
                ELSE 'Average'
            END AS distinctiveness,
            mgz.valence_score, mgz.valence_label, mgc.category, mgc.category_description,
            ROUND(mgc.weighted_avg_percentage, 1) AS weighted_avg_percentage
        FROM major_group_with_zscore mgz
        LEFT JOIN major_group_categories mgc
            ON mgz.major_group_code = mgc.major_group_code AND mgz.element_id = mgc.element_id
        ORDER BY mgz.major_group_code, ABS(mgz.z_score) DESC, mgc.category
    ");
    $stmtWorkContextMajor->execute();
    $workContextMajorData = $stmtWorkContextMajor->fetchAll(PDO::FETCH_ASSOC);
    */
    // Query 11: DISABLED — underworld_context_data is not consumed by the frontend.
    // Heaviest unused query (7 CTEs) with employment-weighted z-scores for 5 underworld major groups.
    /*
    $stmtUnderworldContext = $pdo->prepare("
        WITH underworld_groups AS (
            SELECT id AS major_group_code FROM SOC_major_groups
            WHERE title IN (
                'Production Occupations', 'Sales and Related Occupations',
                'Food Preparation and Serving Related Occupations',
                'Farming, Fishing, and Forestry Occupations',
                'Personal Care and Service Occupations'
            )
        ),
        overall_stats AS (
            SELECT wc.element_id, cmr.element_name, cmr.description AS element_description,
                wcv.valence_score, wcv.valence_label,
                SUM(wc.data_value * COALESCE(ep.EMP_2024, 1)) / SUM(COALESCE(ep.EMP_2024, 1)) AS overall_mean
            FROM work_context AS wc
            INNER JOIN onet_soc_crosswalk AS cw ON wc.onetsoc_code = cw.onet_soc_2019_code
            INNER JOIN content_model_reference AS cmr ON wc.element_id = cmr.element_id
            INNER JOIN work_context_valence AS wcv ON wc.element_id = wcv.element_id
            LEFT JOIN employment_projections AS ep ON cw.soc_2018_code = ep.OCC_CODE
            WHERE wc.scale_id = 'CX' AND wc.data_value IS NOT NULL AND wc.recommend_suppress = 'N'
                AND RIGHT(wc.onetsoc_code, 3) = '.00' AND wcv.valence_score != 0
            GROUP BY wc.element_id, cmr.element_name, cmr.description, wcv.valence_score, wcv.valence_label
        ),
        underworld_stats AS (
            SELECT wc.element_id,
                SUM(wc.data_value * COALESCE(ep.EMP_2024, 1)) / SUM(COALESCE(ep.EMP_2024, 1)) AS underworld_mean
            FROM work_context AS wc
            INNER JOIN onet_soc_crosswalk AS cw ON wc.onetsoc_code = cw.onet_soc_2019_code
            INNER JOIN soc_hierarchy_index AS shi ON cw.soc_2018_code = shi.detailed_occupation_code
            INNER JOIN underworld_groups ug ON shi.major_group_code = ug.major_group_code
            INNER JOIN work_context_valence AS wcv ON wc.element_id = wcv.element_id
            LEFT JOIN employment_projections AS ep ON cw.soc_2018_code = ep.OCC_CODE
            WHERE wc.scale_id = 'CX' AND wc.data_value IS NOT NULL AND wc.recommend_suppress = 'N'
                AND RIGHT(wc.onetsoc_code, 3) = '.00' AND wcv.valence_score != 0
            GROUP BY wc.element_id
        ),
        underworld_categories AS (
            SELECT wc.element_id, wc.category, wcc.category_description,
                SUM(wc.data_value * COALESCE(ep.EMP_2024, 1)) / SUM(COALESCE(ep.EMP_2024, 1)) AS weighted_avg_percentage
            FROM work_context AS wc
            INNER JOIN onet_soc_crosswalk AS cw ON wc.onetsoc_code = cw.onet_soc_2019_code
            INNER JOIN soc_hierarchy_index AS shi ON cw.soc_2018_code = shi.detailed_occupation_code
            INNER JOIN underworld_groups ug ON shi.major_group_code = ug.major_group_code
            INNER JOIN work_context_valence AS wcv ON wc.element_id = wcv.element_id
            LEFT JOIN work_context_categories AS wcc
                ON wc.element_id = wcc.element_id AND wc.scale_id = wcc.scale_id AND wc.category = wcc.category
            LEFT JOIN employment_projections AS ep ON cw.soc_2018_code = ep.OCC_CODE
            WHERE wc.scale_id = 'CXP' AND wc.data_value IS NOT NULL AND wc.recommend_suppress = 'N'
                AND RIGHT(wc.onetsoc_code, 3) = '.00' AND wcv.valence_score != 0
            GROUP BY wc.element_id, wc.category, wcc.category_description
        ),
        major_group_means AS (
            SELECT shi.major_group_code, wc.element_id,
                SUM(wc.data_value * COALESCE(ep.EMP_2024, 1)) / SUM(COALESCE(ep.EMP_2024, 1)) AS group_mean
            FROM work_context AS wc
            INNER JOIN onet_soc_crosswalk AS cw ON wc.onetsoc_code = cw.onet_soc_2019_code
            INNER JOIN soc_hierarchy_index AS shi ON cw.soc_2018_code = shi.detailed_occupation_code
            INNER JOIN work_context_valence AS wcv ON wc.element_id = wcv.element_id
            LEFT JOIN employment_projections AS ep ON cw.soc_2018_code = ep.OCC_CODE
            WHERE wc.scale_id = 'CX' AND wc.data_value IS NOT NULL AND wc.recommend_suppress = 'N'
                AND RIGHT(wc.onetsoc_code, 3) = '.00' AND wcv.valence_score != 0
            GROUP BY shi.major_group_code, wc.element_id
        ),
        element_std AS (
            SELECT element_id, STDDEV(group_mean) AS std_dev
            FROM major_group_means GROUP BY element_id
        )
        SELECT os.element_id, os.element_name, os.element_description,
            ROUND(us.underworld_mean, 2) AS underworld_mean, ROUND(os.overall_mean, 2) AS overall_mean,
            ROUND((us.underworld_mean - os.overall_mean) / NULLIF(es.std_dev, 0), 2) AS z_score,
            CASE
                WHEN (us.underworld_mean - os.overall_mean) / NULLIF(es.std_dev, 0) >= 2.5 THEN 'Extremely High'
                WHEN (us.underworld_mean - os.overall_mean) / NULLIF(es.std_dev, 0) >= 1.5 THEN 'Very High'
                WHEN (us.underworld_mean - os.overall_mean) / NULLIF(es.std_dev, 0) >= 1.0 THEN 'High'
                WHEN (us.underworld_mean - os.overall_mean) / NULLIF(es.std_dev, 0) <= -2.5 THEN 'Extremely Low'
                WHEN (us.underworld_mean - os.overall_mean) / NULLIF(es.std_dev, 0) <= -1.5 THEN 'Very Low'
                WHEN (us.underworld_mean - os.overall_mean) / NULLIF(es.std_dev, 0) <= -1.0 THEN 'Low'
                ELSE 'Average'
            END AS distinctiveness,
            os.valence_score, os.valence_label, uc.category, uc.category_description,
            ROUND(uc.weighted_avg_percentage, 1) AS weighted_avg_percentage
        FROM overall_stats os
        INNER JOIN underworld_stats us ON os.element_id = us.element_id
        INNER JOIN element_std es ON os.element_id = es.element_id
        LEFT JOIN underworld_categories uc ON os.element_id = uc.element_id
        ORDER BY
            CASE WHEN os.valence_score = -1 THEN -(us.underworld_mean - os.overall_mean) / NULLIF(es.std_dev, 0)
                 ELSE (us.underworld_mean - os.overall_mean) / NULLIF(es.std_dev, 0)
            END ASC, uc.category
    ");
    $stmtUnderworldContext->execute();
    $underworldContextData = $stmtUnderworldContext->fetchAll(PDO::FETCH_ASSOC);
    */
    // Query 12: RIASEC Interest Type Descriptions
    $stmtRiasecDescriptions = $pdo->prepare("
        SELECT 
            element_id,
            element_name,
            description
        FROM content_model_reference
        WHERE element_id IN ('1.B.1.a', '1.B.1.b', '1.B.1.c', '1.B.1.d', '1.B.1.e', '1.B.1.f')
        ORDER BY element_id
    ");
    $stmtRiasecDescriptions->execute();
    $riasecDescriptions = $stmtRiasecDescriptions->fetchAll(PDO::FETCH_ASSOC);
    // Query 13: Workplace Injuries by Event (DART cases only)
    // Only total_rate + hierarchy info used by frontend; subcategory breakdowns removed
    $stmtInjuriesByEvent = $pdo->prepare("
        SELECT
            wie.occupation,
            wie.occupation_code,
            wie.total_rate,
            shi.major_group_code,
            shi.minor_group_code,
            shi.broad_group_code,
            smg.title AS major_group_title,
            smi.title AS minor_group_title,
            sb.title AS broad_group_title
        FROM workplace_injuries_by_event wie
        LEFT JOIN soc_hierarchy_index shi ON wie.occupation_code = shi.detailed_occupation_code
        LEFT JOIN SOC_major_groups smg ON shi.major_group_code = smg.id
        LEFT JOIN SOC_minor_groups smi ON shi.minor_group_code = smi.id
        LEFT JOIN SOC_broad_occupations sb ON shi.broad_group_code = sb.id
        WHERE wie.case_type = 'DART'
        ORDER BY shi.major_group_code, shi.minor_group_code, shi.broad_group_code, wie.occupation
    ");
    $stmtInjuriesByEvent->execute();
    $injuriesByEventData = $stmtInjuriesByEvent->fetchAll(PDO::FETCH_ASSOC);
    // Query 14: Industry Distribution by Major Sectors + Self-Employed (All Occupations)
    $stmtIndustryByMajorSectors = $pdo->prepare("
    SELECT 
        occupation_code,
        occupation_title,
        occupation_type,
        industry_code,
        industry_title,
        2024_employment,
        2024_percent_of_occupation
    FROM industry_occupation_matrix
    WHERE (industry_code IN (
        '110000', '210000', '220000', '230000', '31-330',
        '420000', '44-450', '48-490', '510000', '520000',
        '530000', '540000', '550000', '560000', '610000',
        '620000', '710000', '720000', '810000', '900000',
        'TE1000', 'TE1100'
    ))
    ORDER BY 
        occupation_code,
        2024_employment DESC
");
    $stmtIndustryByMajorSectors->execute();
    $industryByMajorSectors = $stmtIndustryByMajorSectors->fetchAll(PDO::FETCH_ASSOC);
    // Query 15: Employment Type Distribution - Wage/Salary vs Self-Employed (All Occupations)
    $stmtEmploymentType = $pdo->prepare("
        SELECT 
            occupation_code,
            occupation_title,
            occupation_type,
            industry_code,
            industry_title,
            2024_employment,
            2024_percent_of_occupation
        FROM industry_occupation_matrix
        WHERE industry_code IN ('TE1100', 'TE1200')
        ORDER BY 
            occupation_code,
            industry_code DESC
    ");
    $stmtEmploymentType->execute();
    $employmentTypeData = $stmtEmploymentType->fetchAll(PDO::FETCH_ASSOC);
    // Return all data as JSON
    echo json_encode([
        'success' => true,
        'characters' => $characters,
        'national_stats' => $nationalStats,
        'hierarchical_data' => $hierarchicalData,
        'interests_data' => $interestsData,
        'work_context_data' => $workContextData,
        'riasec_descriptions' => $riasecDescriptions,
        'injuries_by_event_data' => $injuriesByEventData,
        'industry_by_major_sectors' => $industryByMajorSectors,
        'employment_type_data' => $employmentTypeData
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>