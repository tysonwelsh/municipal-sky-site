<?php
// Sanitizer fixture harness (PLAN-USER-PROMPTS-CONTRACTS C3.6).
//
//   php scripts/test-jd-sanitizer.php
//
// One line per fixture; exit 0 iff every fixture behaved as its filename
// promises. Fixture names encode the expectation:
//
//   ok-<name>.svg                 must pass the sanitizer byte-identical,
//                                 with no 'normalized' in the verdict
//   reject-<reason>-<name>.svg    must be rejected with exactly <reason>
//   normalize-<word>-<n>-[<word>-<n>-…]<name>.svg
//                                 must pass with 'normalized' => [<word> => n,
//                                 …] and nothing else. The words:
//                                 cdata_unwrapped (2026-10-02) and
//                                 title_desc_stripped (2026-10-03; n counts
//                                 every <title> and <desc>, nested included).
//                                 The output must hold no CDATA marker and no
//                                 <title>/<desc>, keep the document's text
//                                 (less what sat inside a stripped title or
//                                 desc), never self-close a <style>/<title>
//                                 nor carry a '<' inside one, and be a fixed
//                                 point: the sanitizer passes it again
//                                 byte-identical with nothing normalized.
//
// The CDATA twin: every fixture holding a <![CDATA[ … ]]> is also run with
// each section replaced by the same characters written as escaped text, and
// must get the SAME verdict (pass, or the same reason). That is the
// normalization's promise — a wrapper changes nothing the rules decide. (The
// twin may still be normalized title_desc_stripped, never cdata_unwrapped.)
//
// The one reason the sanitizer does not produce is no_svg_found: that verdict
// belongs to the extraction step, so those fixtures are asserted against
// jd_extract_svg() instead. Every bypass attempt — successful or not — becomes
// a permanent fixture here.

require_once __DIR__ . '/../api/jd-config.php';
require_once __DIR__ . '/../api/jd-svg-sanitizer.php';

// C3.5 — frozen strings. The eval export depends on them. Never rename or
// remove one; a normalization is not a reason and is not listed here.
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

// The normalization words the sanitizer may report (jd2_generations.normalized).
$NORMALIZATIONS = ['cdata_unwrapped', 'title_desc_stripped'];

$passed = 0;
$failed = 0;
$covered = [];

/** The fixture with every CDATA section written as escaped text instead. */
function cdata_twin(string $svg): string
{
    return preg_replace_callback('/<!\[CDATA\[(.*?)\]\]>/s',
        static fn (array $m): string => htmlspecialchars($m[1], ENT_XML1 | ENT_NOQUOTES, 'UTF-8'), $svg);
}

/** The parsed document, or null. */
function doc_of(string $svg): ?DOMDocument
{
    $doc = new DOMDocument();
    $prev = libxml_use_internal_errors(true);
    $ok = $doc->loadXML($svg, LIBXML_NONET);
    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    return $ok ? $doc : null;
}

/** How many SVG <title> and <desc> elements the document holds. */
function title_desc_count(DOMDocument $doc): int
{
    return $doc->getElementsByTagNameNS(JD_SVG_NS, 'title')->length
        + $doc->getElementsByTagNameNS(JD_SVG_NS, 'desc')->length;
}

/**
 * The document's character data (every text and CDATA node, in order); with
 * $withoutTitleDesc, as it reads once every <title>/<desc> is gone.
 */
function text_of(string $svg, bool $withoutTitleDesc = false): ?string
{
    $doc = doc_of($svg);
    if ($doc === null) {
        return null;
    }
    if ($withoutTitleDesc) {
        $found = [];
        foreach (['title', 'desc'] as $name) {
            foreach ($doc->getElementsByTagNameNS(JD_SVG_NS, $name) as $el) {
                $found[] = $el;
            }
        }
        foreach ($found as $el) {
            $el->parentNode?->removeChild($el);
        }
    }
    return $doc->documentElement->textContent;
}

/** What is wrong with a normalized output, or null. */
function normalized_output_problem(string $in, string $out, array $expected): ?string
{
    if ($out === $in) {
        return 'output is byte-identical to the input (nothing was re-serialized)';
    }
    if (str_contains($out, '<![CDATA[') || str_contains($out, ']]>')) {
        return 'output still carries a CDATA marker';
    }
    $outDoc = doc_of($out);
    if ($outDoc === null || title_desc_count($outDoc) !== 0) {
        return 'output still carries a <title> or <desc> (or does not parse)';
    }
    if (preg_match('#<(title|desc)\b#', $out)) {
        return 'output text still holds a <title or <desc tag';
    }
    if (text_of($out) !== text_of($in, isset($expected['title_desc_stripped']))) {
        return 'the document text changed';
    }
    if (preg_match('#<(style|title)\b[^>]*/>#', $out)) {
        return 'a raw-text element was written self-closing';
    }
    if (preg_match_all('#<(style|title)\b[^>]*>(.*?)</\1>#s', $out, $m)) {
        foreach ($m[2] as $inner) {
            if (str_contains($inner, '<')) {
                return "a raw-text element's content holds a literal '<'";
            }
        }
    }
    $again = jd_sanitize_svg($out);
    if (empty($again['ok']) || $again['svg'] !== $out || isset($again['normalized'])) {
        return 'not a fixed point: re-sanitizing the output gave ' . json_encode($again);
    }
    return null;
}

foreach ($files as $file) {
    $name = basename($file);
    $contents = file_get_contents($file);

    $expectedNormalized = null;
    if (str_starts_with($name, 'ok-')) {
        $expectation = 'pass';
        $expectedReason = null;
    } elseif (str_starts_with($name, 'normalize-')) {
        $expectation = 'normalize';
        $expectedReason = null;
        // One or more <word>-<n>- pairs after 'normalize-', in any order.
        $rest = substr($name, strlen('normalize-'));
        $expectedNormalized = [];
        do {
            $matched = false;
            foreach ($NORMALIZATIONS as $word) {
                if (preg_match('/^' . preg_quote($word, '/') . '-(\d+)-/', $rest, $m)) {
                    $expectedNormalized[$word] = (int) $m[1];
                    $rest = substr($rest, strlen($m[0]));
                    $matched = true;
                    break;
                }
            }
        } while ($matched);
        // The sanitizer reports its words in $NORMALIZATIONS order.
        $ordered = [];
        foreach ($NORMALIZATIONS as $word) {
            if (isset($expectedNormalized[$word])) {
                $ordered[$word] = $expectedNormalized[$word];
            }
        }
        $expectedNormalized = $ordered ?: null;
        if ($expectedNormalized === null) {
            printf("FAIL  %-46s unknown normalization or count encoded in filename\n", $name);
            $failed++;
            continue;
        }
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

    // The CDATA twin must get the same verdict as the fixture itself.
    if (str_contains($contents, '<![CDATA[')) {
        $twin = jd_sanitize_svg(cdata_twin($contents));
        $same = !empty($twin['ok']) === !empty($result['ok'])
            && ($twin['reason'] ?? null) === ($result['reason'] ?? null);
        $twinVerdict = !empty($twin['ok']) ? 'pass' : 'reject/' . $twin['reason'];
        if (!$same) {
            printf("FAIL  %-46s CDATA twin got %s, the fixture %s\n", $name, $twinVerdict,
                !empty($result['ok']) ? 'pass' : 'reject/' . $result['reason']);
            $failed++;
            continue;
        }
        if (!empty($twin['ok']) && isset($twin['normalized']['cdata_unwrapped'])) {
            printf("FAIL  %-46s CDATA twin was normalized cdata_unwrapped (it holds no CDATA)\n", $name);
            $failed++;
            continue;
        }
        if (!empty($twin['ok']) && ($twin['normalized']['title_desc_stripped'] ?? null) !== ($result['normalized']['title_desc_stripped'] ?? null)) {
            printf("FAIL  %-46s CDATA twin stripped %s title/desc, the fixture %s\n", $name,
                json_encode($twin['normalized']['title_desc_stripped'] ?? 0), json_encode($result['normalized']['title_desc_stripped'] ?? 0));
            $failed++;
            continue;
        }
        printf("ok    %-46s CDATA twin (escaped text): same verdict, %s\n", $name, $twinVerdict);
        $passed++;
    }

    if ($expectation === 'normalize') {
        if (empty($result['ok'])) {
            printf("FAIL  %-46s expected pass with %s, rejected as %s\n", $name, json_encode($expectedNormalized), $result['reason']);
            $failed++;
        } elseif (($result['normalized'] ?? null) !== $expectedNormalized) {
            printf("FAIL  %-46s expected normalized %s, got %s\n", $name, json_encode($expectedNormalized),
                json_encode($result['normalized'] ?? null));
            $failed++;
        } elseif (($problem = normalized_output_problem($contents, $result['svg'], $expectedNormalized)) !== null) {
            printf("FAIL  %-46s %s\n", $name, $problem);
            $failed++;
        } else {
            printf("ok    %-46s passed, normalized %s, re-serialized, fixed point\n", $name, json_encode($result['normalized']));
            $passed++;
        }
        continue;
    }

    if ($expectation === 'pass') {
        if (!empty($result['ok']) && isset($result['normalized'])) {
            printf("FAIL  %-46s passed but was normalized %s (name it normalize-…)\n", $name, json_encode($result['normalized']));
            $failed++;
        } elseif (!empty($result['ok']) && $result['svg'] === $contents) {
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
