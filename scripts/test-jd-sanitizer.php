<?php
// Sanitizer fixture harness (PLAN-USER-PROMPTS-CONTRACTS C3.6).
//
//   php scripts/test-jd-sanitizer.php
//
// One line per fixture; exit 0 iff every fixture behaved as its filename
// promises. Fixture names encode the expectation:
//
//   ok-<name>.svg                 must pass the sanitizer byte-identical
//   reject-<reason>-<name>.svg    must be rejected with exactly <reason>
//
// The one reason the sanitizer does not produce is no_svg_found: that verdict
// belongs to the extraction step, so those fixtures are asserted against
// jd_extract_svg() instead. Every bypass attempt — successful or not — becomes
// a permanent fixture here.

require_once __DIR__ . '/../api/jd-config.php';
require_once __DIR__ . '/../api/jd-svg-sanitizer.php';

// C3.5 — frozen strings. The eval export depends on them.
$REASONS = [
    'too_large', 'doctype_forbidden', 'parse_error', 'bad_root', 'no_viewbox',
    'foreign_namespace', 'element_not_allowed', 'event_handler', 'external_ref',
    'external_url', 'dangerous_uri', 'style_external', 'animated_href', 'no_svg_found',
];

$dir = __DIR__ . '/jd-sanitizer-fixtures';
$files = glob($dir . '/*.svg');
sort($files);

if (!$files) {
    fwrite(STDERR, "No fixtures found in $dir\n");
    exit(1);
}

$passed = 0;
$failed = 0;
$covered = [];

foreach ($files as $file) {
    $name = basename($file);
    $contents = file_get_contents($file);

    if (str_starts_with($name, 'ok-')) {
        $expectation = 'pass';
        $expectedReason = null;
    } elseif (str_starts_with($name, 'reject-')) {
        $expectation = 'reject';
        $expectedReason = null;
        foreach ($REASONS as $reason) {
            if (str_starts_with($name, 'reject-' . $reason . '-')) {
                $expectedReason = $reason;
                break;
            }
        }
        if ($expectedReason === null) {
            printf("FAIL  %-46s unknown reason encoded in filename\n", $name);
            $failed++;
            continue;
        }
        $covered[$expectedReason] = true;
    } else {
        printf("FAIL  %-46s filename encodes no expectation\n", $name);
        $failed++;
        continue;
    }

    // no_svg_found is the extraction step's verdict, not the sanitizer's.
    if ($expectedReason === 'no_svg_found') {
        if (jd_extract_svg($contents) === null) {
            printf("ok    %-46s extraction found no <svg> (no_svg_found)\n", $name);
            $passed++;
        } else {
            printf("FAIL  %-46s expected no extractable <svg>, but one was found\n", $name);
            $failed++;
        }
        continue;
    }

    $result = jd_sanitize_svg($contents);

    if ($expectation === 'pass') {
        if (!empty($result['ok']) && $result['svg'] === $contents) {
            printf("ok    %-46s passed, byte-identical\n", $name);
            $passed++;
        } elseif (!empty($result['ok'])) {
            printf("FAIL  %-46s passed but the output was not byte-identical\n", $name);
            $failed++;
        } else {
            printf("FAIL  %-46s expected pass, rejected as %s\n", $name, $result['reason']);
            $failed++;
        }
        continue;
    }

    if (!empty($result['ok'])) {
        printf("FAIL  %-46s expected reject/%s, passed\n", $name, $expectedReason);
        $failed++;
    } elseif ($result['reason'] !== $expectedReason) {
        printf("FAIL  %-46s expected reject/%s, got reject/%s\n", $name, $expectedReason, $result['reason']);
        $failed++;
    } else {
        printf("ok    %-46s rejected: %s\n", $name, $result['reason']);
        $passed++;
    }
}

$uncovered = array_values(array_diff($REASONS, array_keys($covered)));
if ($uncovered) {
    printf("\nFAIL  rejection reasons with no fixture: %s\n", implode(', ', $uncovered));
    $failed++;
}

printf("\n%d passed, %d failed, %d fixtures\n", $passed, $failed, count($files));
exit($failed === 0 ? 0 : 1);
