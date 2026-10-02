<?php
// The spaced-ranking derivation (api/jd2-config.php, jd2_derive_pairs) and the
// canonical pair order (jd2_pair_key), PLAN-V2 §4 B.
//
//   php scripts/test-jd2-derive.php
//
// One PASS/FAIL line per case; exit 0 iff every case passed. Pure functions,
// no database: nothing here needs JD_DEV_MOCK.

require_once __DIR__ . '/../api/jd2-config.php';

$passed = 0;
$failed = 0;

function check(string $name, bool $ok, string $detail = ''): void
{
    global $passed, $failed;
    if ($ok) {
        $passed++;
        printf("PASS  %s\n", $name);
    } else {
        $failed++;
        printf("FAIL  %s%s\n", $name, $detail === '' ? '' : "\n      " . $detail);
    }
}

/** A ranking row; ids are the letters unless given. */
function place(string $gen, int $pos, ?int $gap, ?string $slot = null): array
{
    $row = ['generation_id' => $gen, 'rank_pos' => $pos, 'gap_after' => $gap];
    if ($slot !== null) {
        $row['slot'] = $slot;
    }
    return $row;
}

/** The derived rows as "gen_a|gen_b" => score, sorted, for comparison. */
function scores(array $pairs): array
{
    $out = [];
    foreach ($pairs as $p) {
        $out[$p['gen_a'] . '|' . $p['gen_b']] = $p['score'];
    }
    ksort($out);
    return $out;
}

function show(array $a): string
{
    return json_encode($a);
}

/** Run $fn; true iff it threw InvalidArgumentException whose message contains $needle. */
function throws(callable $fn, string $needle = ''): array
{
    try {
        $fn();
        return [false, 'no exception'];
    } catch (InvalidArgumentException $e) {
        $ok = $needle === '' || str_contains($e->getMessage(), $needle);
        return [$ok, $e->getMessage()];
    }
}

// 1. Four drawings, gaps 1, 0, 3. Places: A(1) B(2) C(3) D(4), ids in order,
//    so gen_a is always the better-placed one and every score is positive.
//    A-B 1, A-C 1+0 = 1, A-D 1+0+3 = 4 -> 3, B-C 0, B-D 0+3 = 3, C-D 3.
$r = jd2_derive_pairs([
    place('A', 1, 1), place('B', 2, 0), place('C', 3, 3), place('D', 4, null),
]);
$want = ['A|B' => 1, 'A|C' => 1, 'A|D' => 3, 'B|C' => 0, 'B|D' => 3, 'C|D' => 3];
check('four drawings, gaps 1,0,3', scores($r) === $want, 'got ' . show(scores($r)) . ' want ' . show($want));

// 2. A tie through a zero gap: 1st and 2nd separated by 0 score 0, and the
//    zero gap passes the next margin through unchanged (A-C = 0+2 = B-C).
$r = jd2_derive_pairs([place('A', 1, 0), place('B', 2, 2), place('C', 3, null)]);
$want = ['A|B' => 0, 'A|C' => 2, 'B|C' => 2];
check('a tie through a zero gap', scores($r) === $want, 'got ' . show(scores($r)) . ' want ' . show($want));

// 3. Clamping: gaps 3,3,3 sum to 6 and 9 for the far pairs; every score is 3.
$r = jd2_derive_pairs([
    place('A', 1, 3), place('B', 2, 3), place('C', 3, 3), place('D', 4, null),
]);
$allThree = count($r) === 6 && array_reduce($r, fn ($ok, $p) => $ok && $p['score'] === 3, true);
check('clamping 3,3,3 to ±3', $allThree && scores($r)['A|D'] === 3, 'got ' . show(scores($r)));

// 3b. The same clamp seen from the other sign: the best drawing has the
//     LATER id, so every pair it is in is filed as gen_b and scores −3.
$r = jd2_derive_pairs([
    place('Z', 1, 3), place('B', 2, 3), place('C', 3, 3), place('D', 4, null),
]);
$s = scores($r);
check('clamping on the negative side', $s['B|Z'] === -3 && $s['C|Z'] === -3 && $s['D|Z'] === -3,
      'got ' . show($s));

// 4. Two drawings: one pair, the one gap.
$r = jd2_derive_pairs([place('A', 1, 2), place('B', 2, null)]);
check('two drawings', count($r) === 1 && scores($r) === ['A|B' => 2], 'got ' . show($r));

// 5. One drawing: nothing to compare.
$r = jd2_derive_pairs([place('A', 1, null)]);
check('one drawing yields no pairs', $r === [], 'got ' . show($r));

// 6. Invalid ranks, each refused with a sentence that says what is wrong.
[$ok, $msg] = throws(fn () => jd2_derive_pairs([place('A', 1, 1), place('B', 1, 0), place('C', 3, null)]), 'held twice');
check('invalid ranks: a tie for a place', $ok, $msg);
[$ok, $msg] = throws(fn () => jd2_derive_pairs([place('A', 1, 1), place('B', 2, 0), place('C', 4, null)]), '1..3');
check('invalid ranks: a gap in the places (1,2,4)', $ok, $msg);
[$ok, $msg] = throws(fn () => jd2_derive_pairs([place('A', 0, 1), place('B', 1, null)]), '1..2');
check('invalid ranks: place 0', $ok, $msg);
[$ok, $msg] = throws(fn () => jd2_derive_pairs([place('A', 1, 1), place('A', 2, null)]), 'ranked twice');
check('invalid ranks: one drawing placed twice', $ok, $msg);
[$ok, $msg] = throws(fn () => jd2_derive_pairs([place('A', 1, 4), place('B', 2, null)]), '0..3');
check('invalid gap: 4', $ok, $msg);
[$ok, $msg] = throws(fn () => jd2_derive_pairs([place('A', 1, null), place('B', 2, null)]), 'no gap_after');
check('invalid gap: missing between places', $ok, $msg);
[$ok, $msg] = throws(fn () => jd2_derive_pairs([place('A', 1, 1), place('B', 2, 1)]), 'last place');
check('invalid gap: set on the last place', $ok, $msg);

// 7. The canonical order flips the sign. Slots are known: d is ranked 1st,
//    a 2nd with a gap of 2. Canonical order is by SLOT (a before d), so the
//    row is gen_a = the slot-a drawing, and the better drawing (slot d) is
//    gen_b: score −2. Ids are chosen so id order would say the opposite.
$r = jd2_derive_pairs([place('01AAA', 1, 2, 'd'), place('01ZZZ', 2, null, 'a')]);
check('canonical order (by slot) flips the sign',
      count($r) === 1 && $r[0]['gen_a'] === '01ZZZ' && $r[0]['gen_b'] === '01AAA' && $r[0]['score'] === -2,
      'got ' . show($r));
//    Without slots the same two fall back to id order: 01AAA is gen_a and
//    is the better one, so +2.
$r = jd2_derive_pairs([place('01AAA', 1, 2), place('01ZZZ', 2, null)]);
check('canonical order (by id) when slots are unknown',
      count($r) === 1 && $r[0]['gen_a'] === '01AAA' && $r[0]['score'] === 2, 'got ' . show($r));
//    And jd2_pair_key itself: argument order never matters.
check('jd2_pair_key is symmetric',
      jd2_pair_key('X', 'Y', ['X' => 'c', 'Y' => 'b']) === ['Y', 'X']
      && jd2_pair_key('Y', 'X', ['X' => 'c', 'Y' => 'b']) === ['Y', 'X']
      && jd2_pair_key('Q', 'P') === ['P', 'Q']);

// 8. n = 4 yields exactly 6 rows, each unordered pair once, all stamped.
$r = jd2_derive_pairs([
    place('G4', 3, 1, 'b'), place('G1', 1, 2, 'd'), place('G3', 4, null, 'a'), place('G2', 2, 0, 'c'),
]);
$keys = array_map(fn ($p) => $p['gen_a'] . '|' . $p['gen_b'], $r);
$stamped = array_reduce($r, fn ($ok, $p) => $ok && $p['source'] === 'derived'
    && $p['method'] === JD2_DERIVE_METHOD && is_int($p['score']) && abs($p['score']) <= 3, true);
check('n = 4 yields exactly 6 rows', count($r) === 6 && count(array_unique($keys)) === 6 && $stamped,
      'got ' . show($r));

// 9. Digit strings, as PDO hands MySQL integers back.
$r = jd2_derive_pairs([
    ['generation_id' => 'A', 'rank_pos' => '1', 'gap_after' => '3'],
    ['generation_id' => 'B', 'rank_pos' => '2', 'gap_after' => null],
]);
check('digit strings from PDO', scores($r) === ['A|B' => 3], 'got ' . show($r));

printf("\n%d passed, %d failed\n", $passed, $failed);
exit($failed === 0 ? 0 : 1);
