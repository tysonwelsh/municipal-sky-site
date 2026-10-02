<?php
// api/jd2-intake-prompt.php — the intake clerk: its system prompt, its answer
// schema, the one Messages API call, the mock, and the checks on the answer
// (PLAN-INTAKE, PLAN-INTAKE-PROMPT; owner-settled 2026-10-02 as intake-v1).
//
// INCLUDE-ONLY (it defines and does nothing), except from the command line:
//
//   php api/jd2-intake-prompt.php --print
//
// prints the rendered system prompt and the JSON schema exactly as they are
// sent, so the owner can diff them against PLAN-INTAKE-PROMPT.md §2 and §4.
//
// Callers: api/jd2-intake.php (the endpoint: the turn card, the bench's NEW
// PROMPT, the batch runner) and scripts/jd2-intake-check.php (the agreement
// check against the owner's v1 sizes, no database write). Both call
// jd2_intake_answer(), so the check measures the very request that ships.
//
// THE PROMPT IS THE OWNER'S BYTES. JD2_INTAKE_SYSTEM is §2 verbatim (the
// owner's spelling and phrasing included) with two placeholders, both
// rendered from taxonomy.json so the file and the prompt cannot disagree:
//
//   {{TIERS}}   ENTRY 2's five tier lines, from sizeTiers[] (id, description,
//               examples, and m's examplesPhrase), wrapped to the doc's
//               measure: 72 columns, a trailing comma, colon, semicolon or
//               full stop allowed to hang in column 73, continuation lines
//               indented under the description. Rendered from the v28
//               taxonomy this is byte-identical to the doc's ENTRY 2.
//   {{FACETS}}  ENTRY 3's vocabulary, from facets[]: per facet a line
//               "  SUBJECT — <question>. At least one." (label upper-cased,
//               "Zero or more." when min is 0), then one line per heading,
//               "    <id>  <scope note>", ids padded to the facet's longest id
//               plus two and the scope wrapped under itself; a blank line
//               between facets.
//
// NO EXAMPLE ANSWER IS EVER PUT IN THE PROMPT (§1): the structured-output
// schema is the only statement of the answer's shape, and each of its fields
// carries a one-line description in the prompt's own words. An example would
// be a second copy of the schema that drifts, and its values would pull the
// model toward themselves.
//
// VERSIONING. taxonomy.json `intakeVersion` names these bytes. Any change to
// the rendered prompt — the prose below, a tier description or example, a
// facet, a heading or a scope note — bumps it, as harness ids are bumped:
// answers filed under different intake prompts are not pooled.
//
// THE WIRE (the Anthropic Messages API, raw HTTP through jd_http_post_json —
// the house pattern on this shared host, no SDK):
//   model           taxonomy.json utility.intake.api_model (claude-sonnet-5-5)
//   max_tokens      1024
//   system          the rendered prompt
//   messages        one user turn: a sentence saying the entry is for the
//                   prompt inside the block, then <prompt>…</prompt>
//   output_config   {effort: "low", format: {type: "json_schema", schema}}
// Thinking is left at the model's default: no `thinking` key (Sonnet 5.5
// answers {type: "disabled"} with a 400). No temperature (non-default
// sampling parameters are rejected). No cache_control.
//
// THE KEY is the clerk's own slot, `jd_intake_key`, falling back to the
// Anthropic chain (jd_provider_key_slot in jd-provider.php). Only the slot's
// NAME is ever recorded (intake_json.key); never any part of the key.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-provider.php';   // jd_provider_key_slot, jd_http_post_json
require_once __DIR__ . '/jd-usage.php';      // jd_generation_cost

/** The wire's ceiling on the answer (thinking included). */
const JD2_INTAKE_MAX_TOKENS = 1024;

/** How long one intake call may take on the wire, in seconds. */
const JD2_INTAKE_TIMEOUT = 45;

/** The thinking depth: a classification (PLAN-INTAKE §2). */
const JD2_INTAKE_EFFORT = 'low';

/** The heading's bounds (PLAN-INTAKE-PROMPT §4): words, the parenthesis included, and characters. */
const JD2_INTAKE_TITLE_MIN_WORDS = 1;   // a bare noun is a legal heading for an ambiguous prompt (ENTRY 1, last rule)
const JD2_INTAKE_TITLE_MAX_WORDS = 5;
const JD2_INTAKE_TITLE_MAX_CHARS = 40;

/** The prompt's measure: the doc's ENTRY 2 is wrapped at 72 columns with hanging punctuation. */
const JD2_INTAKE_WRAP = 72;

/**
 * PLAN-INTAKE-PROMPT.md §2, verbatim, with ENTRY 2's tier lines as {{TIERS}}
 * and the vocabulary as {{FACETS}} (jd2_intake_render fills both).
 */
const JD2_INTAKE_SYSTEM = <<<'PROMPT'
The agent is an honorable intake clerk and cataloguer for The SVG Junk
Drawer, a public exhibit of vector drawings made by AI models.

A visitor types a short prompt describing an object they would like to
have rendered as a vector drawing in SVG format. The same prompt is sent
to several AI models, each of which draws the object as an SVG. The
drawings are shown in a trompe-l'oeil wooden drawer among dozens of other
items, where they are graded, compared, and enjoyed.

The clerk sees only the prompt, before any drawings exist. Based on the
most sensible reading of the prompt, the clerk enters it in the catalogue
for the purpose of labeling and classifying the drawings rendered by the
other AI models. This is done by outputing the following entries in a structured JSON:

ENTRY 1. HEADING. The object's museum-style catalogue title, in inverted
form, as a register or card catalogue would file it. The pattern is

    Noun (kind), descriptor, descriptor

  - The NOUN is the thing itself, the word a visitor would look it up
    under: "Can", "Key", "Crayon", "Spider".
  - The KIND, in parentheses right after the noun, names which sort of
    that thing the prompt asked for, whenever the noun is a general word
    that covers several sorts: a can could hold beans or trash, so "Can
    (trash)"; a key could open a car or a door, so "Key (skeleton)"; a
    spider has many sorts, so "Spider (black widow)". A noun that already
    names one specific thing takes no parenthesis: "Crayon", "Poppy",
    "Telescope". The test: would "Can, galvanized" tell a visitor what it
    is? If not, the kind goes in.
  - The DESCRIPTORS follow, separated by commas, in descending importance:
    material or colour, then state, then situation. "Key (skeleton),
    brass." "Can (trash), galvanized." "Crayon, broken, sea green."
    "Telescope, brass, extended." "Mouse (computer), cord frayed."
  - Two to five words, the parenthesis included (a bare noun stands alone
    only in the ambiguous case below). No articles. No praise
    words ("beautiful", "amazing"). A descriptor implied by another is
    dropped: "galvanized" already says steel, so "Can (trash),
    galvanized", not "Can (trash), galvanized steel". Singular unless the
    prompt asks for several. The first word is capitalised and the rest
    are not, except proper nouns.
  - The heading names the object, never the style notes or instructions:
    "black widow spider, as though drawn in pastel chalk" is filed
    "Spider (black widow)"; "a galvanized steel trash can in a pop-art
    style" is filed "Can (trash), galvanized".
  - A prompt that asks for a scene or a compound subject is filed under
    its principal object, with the rest as its situation: "a single
    orange poppy flower in a mason jar vase" is filed "Poppy, in mason
    jar"; "hermit crab with a tin can for a shell" is filed "Crab
    (hermit), in tin can".
  - The kind records what the prompt said; it never supplies what the
    prompt left open. A prompt that gives only a general noun — "button",
    "stamp", "can" — is filed under the bare noun and classed ambiguous
    (ENTRY 3), with the readings named in the reason.

ENTRY 2. SIZE. The tier decides how much room the drawing takes in the
drawer beside the other items. It is not a realistic scale, and is
primarily meant to manage the visual interface of the drawing by
ensuring a variety of sizes that loosely correspond to the items
depicted in the drawing. The two smallest tiers are things that would
actually fit in a kitchen junk drawer, and between those two the scale
is roughly linear. From medium upward the scale is not linear at all:
medium is the most common tier by far, and it spans everything from
desktop keepsakes to objects too large for any realistic "junk drawer".
Large and extra large are reserved for things that read as big even
next to the rest of the pile. The line between the two smallest tiers:
a thing one would pick up and hold as its own object is at least small;
extra small is kept for specks and trinkets that would be lost among the
rest. A picture-bearing object (a photograph, a card, a poster) is sized
as the object itself, never as the scene it shows.
{{TIERS}}
Torn between two tiers, the clerk files the more ordinary one: small
over extra small, medium over large.

ENTRY 3. CLASSIFICATION. The prompt is classed under three facets. Each
facet answers a different question and has its own headings. Every
heading that clearly fits is applied; no heading is ever invented; and
the prompt is classed as written, not as the drawing one might imagine.
Every heading carries a scope note, read before it is applied.

{{FACETS}}

ENTRY 4. REASONS. One short sentence for the size and one for the
classification. Only what the prompt says is judged. An ambiguous prompt
keeps a bare heading, is classed ambiguous, carries every subject heading
its readings would take (a bare "mouse" is both creature and object), is
sized by its most sensible reading, and has the readings named in the
reason.
PROMPT;

/** The user turn's one sentence before the block. */
const JD2_INTAKE_USER_LEAD = 'The catalogue entry is for the visitor\'s prompt inside the <prompt> block below.';

// ---------------------------------------------------------------------------
// The prompt

/**
 * The system prompt as sent: JD2_INTAKE_SYSTEM with {{TIERS}} and {{FACETS}}
 * rendered from the taxonomy.
 */
function jd2_intake_render(array $taxonomy): string
{
    return strtr(JD2_INTAKE_SYSTEM, [
        '{{TIERS}}' => jd2_intake_render_tiers($taxonomy),
        '{{FACETS}}' => jd2_intake_render_facets($taxonomy),
    ]);
}

/** ENTRY 2's tier lines: "  xs — <description>: <examples>", wrapped. */
function jd2_intake_render_tiers(array $taxonomy): string
{
    $tiers = array_values(array_filter($taxonomy['sizeTiers'] ?? [], 'is_array'));
    $w = 0;
    foreach ($tiers as $t) {
        $w = max($w, mb_strlen((string) ($t['id'] ?? '')));
    }
    $out = [];
    foreach ($tiers as $t) {
        $id = (string) ($t['id'] ?? '');
        $lead = '  ' . $id . str_repeat(' ', $w - mb_strlen($id)) . ' — ';
        $examples = array_map('strval', array_values($t['examples'] ?? []));
        $phrase = isset($t['examplesPhrase']) && is_string($t['examplesPhrase'])
            ? preg_replace_callback('/\{(\d+)\}/', static fn ($m) => $examples[(int) $m[1]] ?? '', $t['examplesPhrase'])
            : implode(', ', $examples);
        $text = (string) ($t['description'] ?? '') . ($phrase !== '' ? ': ' . $phrase : '');
        $out[] = jd2_intake_wrap($lead, str_repeat(' ', mb_strlen($lead)), $text);
    }
    return implode("\n", $out);
}

/** ENTRY 3's vocabulary: each facet's line, then its headings with their scope notes. */
function jd2_intake_render_facets(array $taxonomy): string
{
    $blocks = [];
    foreach (jd2_facets($taxonomy) as $f) {
        $lines = [jd2_intake_wrap('  ', '    ', mb_strtoupper($f['label']) . ' — ' . $f['question'] . '. '
            . jd2_intake_cardinality($f['min']))];
        $w = 0;
        foreach ($f['headings'] as $h) {
            $w = max($w, mb_strlen($h['id']));
        }
        foreach ($f['headings'] as $h) {
            $lead = '    ' . $h['id'] . str_repeat(' ', $w + 2 - mb_strlen($h['id']));
            $lines[] = jd2_intake_wrap($lead, str_repeat(' ', mb_strlen($lead)), $h['scope']);
        }
        $blocks[] = implode("\n", $lines);
    }
    return implode("\n\n", $blocks);
}

/** "At least one." / "Zero or more." — the facet's minimum in the doc's words. */
function jd2_intake_cardinality(int $min): string
{
    $words = [1 => 'one', 2 => 'two', 3 => 'three', 4 => 'four', 5 => 'five', 6 => 'six'];
    return $min <= 0 ? 'Zero or more.' : 'At least ' . ($words[$min] ?? (string) $min) . '.';
}

/**
 * Greedy wrap at JD2_INTAKE_WRAP columns: $first opens the first line,
 * $indent every other one. A word's trailing , : ; or . may hang one column
 * past the measure (the doc's own setting: "playing card," ends in column 73
 * while "up to a" does not fit in 72).
 */
function jd2_intake_wrap(string $first, string $indent, string $text, int $width = JD2_INTAKE_WRAP): string
{
    $lines = [];
    $line = $first;
    $empty = true;
    foreach (preg_split('/ +/u', trim($text)) ?: [] as $word) {
        $visible = mb_strlen($line) + ($empty ? 0 : 1) + mb_strlen(rtrim($word, ',:;.'));
        if (!$empty && $visible > $width) {
            $lines[] = $line;
            $line = $indent . $word;
        } else {
            $line .= ($empty ? '' : ' ') . $word;
        }
        $empty = false;
    }
    $lines[] = $line;
    return implode("\n", $lines);
}

/** The one user turn: the lead sentence, then the visitor's prompt verbatim in its labelled block. */
function jd2_intake_user_message(string $prompt): string
{
    return JD2_INTAKE_USER_LEAD . "\n\n<prompt>\n" . $prompt . "\n</prompt>";
}

// ---------------------------------------------------------------------------
// The answer's shape

/**
 * The structured-output schema (PLAN-INTAKE-PROMPT §4): title, size, one
 * array per facet (in taxonomy order), reasons {size, classification}.
 * Enums come from the taxonomy; every object is additionalProperties:false
 * with every field required. The API takes minItems 0 or 1 only and no
 * maxItems, so a facet's maximum (and any minimum above one) is stated in
 * its description and enforced by jd2_intake_validate().
 */
function jd2_intake_schema(array $taxonomy): array
{
    $tierIds = array_map('strval', array_keys(jd_size_tiers($taxonomy)));
    $props = [
        'title' => [
            'type' => 'string',
            'description' => 'ENTRY 1. HEADING. The object\'s museum-style catalogue title, in inverted form: '
                . 'Noun (kind), descriptor, descriptor. Two to five words, the parenthesis included; a bare noun alone only for an ambiguous prompt.',
        ],
        'size' => [
            'type' => 'string',
            'enum' => $tierIds,
            'description' => 'ENTRY 2. SIZE. The tier that decides how much room the drawing takes in the drawer '
                . 'beside the other items.',
        ],
    ];
    foreach (jd2_facets($taxonomy) as $f) {
        $p = [
            'type' => 'array',
            'items' => ['type' => 'string', 'enum' => array_column($f['headings'], 'id')],
            'description' => 'ENTRY 3. CLASSIFICATION, ' . mb_strtoupper($f['label']) . ' — ' . $f['question'] . '. '
                . jd2_intake_cardinality($f['min']) . ' At most ' . jd2_intake_count_word($f['max'])
                . ', each heading once.',
        ];
        if ($f['min'] >= 1) {
            $p['minItems'] = 1;
        }
        $props[$f['id']] = $p;
    }
    $props['reasons'] = [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => ['size', 'classification'],
        'properties' => [
            'size' => ['type' => 'string', 'description' => 'ENTRY 4. REASONS. One short sentence for the size.'],
            'classification' => ['type' => 'string',
                'description' => 'ENTRY 4. REASONS. One short sentence for the classification.'],
        ],
        'description' => 'ENTRY 4. REASONS. One short sentence for the size and one for the classification.',
    ];
    return [
        'type' => 'object',
        'additionalProperties' => false,
        'required' => array_keys($props),
        'properties' => $props,
    ];
}

function jd2_intake_count_word(int $n): string
{
    return [1 => 'one', 2 => 'two', 3 => 'three', 4 => 'four', 5 => 'five', 6 => 'six'][$n] ?? (string) $n;
}

/**
 * The checks the endpoint makes even though structured output guarantees the
 * shape (§4): the heading 1–5 words with the parenthesis (1 only for the ambiguous bare noun), at most 40
 * characters, its first letter a capital; the size a tier id; each facet a
 * list of that facet's heading ids, no duplicates, within its min and max;
 * two reason strings.
 *
 * @return array{ok:bool, errors:list<string>, title:?string, size:?string, tags:?array<string,list<string>>, reasons:?array{size:string,classification:string}}
 */
function jd2_intake_validate(mixed $answer, array $taxonomy): array
{
    $errors = [];
    if (!is_array($answer) || array_is_list($answer)) {
        return ['ok' => false, 'errors' => ['the answer is not a JSON object'], 'title' => null, 'size' => null,
                'tags' => null, 'reasons' => null];
    }
    $title = $answer['title'] ?? null;
    if (!is_string($title) || trim($title) === '') {
        $errors[] = 'title is missing';
        $title = null;
    } else {
        $title = trim($title);
        $words = preg_split('/\s+/u', $title, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if (count($words) < JD2_INTAKE_TITLE_MIN_WORDS || count($words) > JD2_INTAKE_TITLE_MAX_WORDS) {
            $errors[] = 'title has ' . count($words) . ' words (' . JD2_INTAKE_TITLE_MIN_WORDS . '–'
                . JD2_INTAKE_TITLE_MAX_WORDS . ')';
        }
        if (mb_strlen($title) > JD2_INTAKE_TITLE_MAX_CHARS) {
            $errors[] = 'title is ' . mb_strlen($title) . ' characters (at most ' . JD2_INTAKE_TITLE_MAX_CHARS . ')';
        }
        $first = mb_substr($title, 0, 1);
        if (!preg_match('/^\p{Lu}$/u', $first)) {
            $errors[] = 'title does not open with a capital letter';
        }
        if (preg_match('/[\r\n]/', $title)) {
            $errors[] = 'title runs over one line';
        }
    }
    $size = $answer['size'] ?? null;
    if (!is_string($size) || !isset(jd_size_tiers($taxonomy)[$size])) {
        $errors[] = 'size is not a taxonomy size tier';
        $size = null;
    }
    $tags = [];
    foreach (jd2_facets($taxonomy) as $f) {
        $v = $answer[$f['id']] ?? null;
        $problem = jd2_facet_problem($f, $v);
        if ($problem !== null) {
            $errors[] = $problem;
            continue;
        }
        $tags[$f['id']] = array_values($v);
    }
    $r = $answer['reasons'] ?? null;
    $reasons = null;
    if (!is_array($r) || !is_string($r['size'] ?? null) || !is_string($r['classification'] ?? null)) {
        $errors[] = 'reasons {size, classification} are missing';
    } else {
        $reasons = ['size' => trim($r['size']), 'classification' => trim($r['classification'])];
    }
    $ok = $errors === [];
    return ['ok' => $ok, 'errors' => $errors, 'title' => $ok ? $title : null, 'size' => $ok ? $size : null,
            'tags' => $ok ? $tags : null, 'reasons' => $ok ? $reasons : null];
}

// ---------------------------------------------------------------------------
// The call

/** The Messages API request body (the shape documented in the header). */
function jd2_intake_request(array $taxonomy, string $prompt, array $moreMessages = []): array
{
    $m = jd2_utility_model($taxonomy, 'intake');
    return [
        'model' => $m['api_model'],
        'max_tokens' => JD2_INTAKE_MAX_TOKENS,
        'system' => jd2_intake_render($taxonomy),
        'messages' => array_merge([['role' => 'user', 'content' => jd2_intake_user_message($prompt)]], $moreMessages),
        'output_config' => [
            'effort' => JD2_INTAKE_EFFORT,
            'format' => ['type' => 'json_schema', 'schema' => jd2_intake_schema($taxonomy)],
        ],
    ];
}

/**
 * Ask the clerk about one prompt: the real API, or — in dev ($mock) — the
 * deterministic mock. Never throws, never writes.
 *
 * @return array{
 *   ok: bool,                 the answer came back, parsed and passed every check
 *   title: ?string, size: ?string, tags: ?array, reasons: ?array,   when ok
 *   model: string,            the wire model asked ('mock' for the mock)
 *   record: array,            what jd2_prompts.intake_json files: the answer
 *                             verbatim (text) and parsed, usage, stop_reason,
 *                             the key slot's name, the version — or the error
 *   cost_usd: ?float,         the call priced at jd-prices.json (null: unpriced/mock/no usage)
 *   error: ?string            a short code when not ok
 * }
 */
function jd2_intake_answer(array $taxonomy, string $prompt, bool $mock): array
{
    $version = jd2_intake_version($taxonomy);
    if ($mock) {
        return jd2_intake_mock($taxonomy, $prompt, $version);
    }
    $m = jd2_utility_model($taxonomy, 'intake');
    $base = ['ok' => false, 'title' => null, 'size' => null, 'tags' => null, 'reasons' => null,
             'model' => $m['api_model'], 'cost_usd' => null, 'error' => null];
    $record = ['version' => $version, 'model' => $m['api_model']];
    if ($m['provider'] !== 'anthropic') {
        return ['error' => 'not_anthropic'] + $base + ['record' => $record + ['error' => [
            'code' => 'not_anthropic', 'message' => 'utility.intake must be an Anthropic model; this file speaks only that API.']]];
    }
    $k = jd_provider_key_slot('anthropic', 'intake');
    $record['key'] = $k['slot'];
    if ($k['key'] === null) {
        return ['error' => 'no_key'] + $base + ['record' => $record + ['error' => [
            'code' => 'no_key', 'message' => 'No Anthropic key on file (jd_intake_key, jd_claude_key, claude_key).']]];
    }
    // ONE RETRY on an answer that parsed but failed the checks (the first live
    // run lost 13 of 67 to six-word or 41-character headings): the second
    // request carries the first answer and one sentence naming what failed,
    // and its usage is added to the record. Anything else fails at once.
    $moreMessages = [];
    $attempt = 0;
    $retryAfter = null;   // the first failing answer's text, kept for the record
    retry:
    $attempt++;
    $started = microtime(true);
    $wire = jd_http_post_json('https://api.anthropic.com/v1/messages', [
        'Content-Type: application/json',
        'x-api-key: ' . $k['key'],
        'anthropic-version: 2023-06-01',
    ], jd2_intake_request($taxonomy, $prompt, $moreMessages), JD2_INTAKE_TIMEOUT);
    $record['latency_ms'] = ($record['latency_ms'] ?? 0) + (int) round((microtime(true) - $started) * 1000);
    $record['http'] = $wire['http_code'];
    $record['attempts'] = $attempt;

    $j = $wire['error'] === null ? json_decode($wire['body'], true) : null;
    $usage = is_array($j['usage'] ?? null) ? $j['usage'] : null;
    if ($usage !== null) {
        // the retry's usage is ADDED to the first call's, so the cost on file is the whole sitting's
        $prev = $record['usage'] ?? null;
        $record['usage'] = is_array($prev) ? jd2_intake_usage_sum($prev, $usage) : $usage;
    }
    $cost = !isset($record['usage']) ? null : jd_generation_cost('anthropic', $m['api_model'], $record['usage'])['cost_usd'];
    $fail = static function (string $code, string $message, array $extra = []) use ($base, $record, $cost): array {
        $rec = $record + $extra + ['error' => ['code' => $code, 'message' => $message]];
        if ($cost !== null) {
            $rec['cost_usd'] = round($cost, 6);   // a failed call can still be billed: on the record, not the column
        }
        return ['error' => $code] + $base + ['record' => $rec];
    };
    if ($wire['error'] !== null) {
        return $fail('transport', 'No answer from the provider (' . ($wire['http_code'] === 0 ? 'timeout or network' : 'HTTP ' . $wire['http_code']) . ').');
    }
    if ($wire['http_code'] !== 200 || !is_array($j)) {
        $msg = is_array($j) ? (string) ($j['error']['message'] ?? '') : '';
        return $fail('provider_failed', 'The provider answered HTTP ' . $wire['http_code']
            . ($msg !== '' ? ': ' . mb_substr($msg, 0, 300) : '') . '.');
    }
    $stop = (string) ($j['stop_reason'] ?? '');
    $record['stop_reason'] = $stop;
    $record['response_model'] = $j['model'] ?? null;
    $text = null;
    foreach ($j['content'] ?? [] as $block) {
        if (is_array($block) && ($block['type'] ?? '') === 'text' && is_string($block['text'] ?? null)) {
            $text = $block['text'];
            break;
        }
    }
    if ($text !== null) {
        $record['text'] = $text;
    }
    if ($stop !== 'end_turn') {
        return $fail($stop === 'refusal' ? 'refusal' : 'stop_' . ($stop === '' ? 'unknown' : $stop),
            'The answer stopped with stop_reason ' . ($stop === '' ? '(none)' : $stop) . '.');
    }
    $answer = $text === null ? null : json_decode($text, true);
    if (!is_array($answer)) {
        return $fail('schema_miss', 'The answer was not a JSON object.');
    }
    $record['answer'] = $answer;
    $v = jd2_intake_validate($answer, $taxonomy);
    if (!$v['ok']) {
        if ($attempt === 1) {
            $record['first_answer'] = $answer;
            $record['first_answer_errors'] = $v['errors'];
            $moreMessages = [
                ['role' => 'assistant', 'content' => $text],
                ['role' => 'user', 'content' => 'That entry failed the catalogue\'s checks: ' . implode('; ', $v['errors'])
                    . '. The heading is at most five words and forty characters, the parenthesis included; '
                    . 'the rules in ENTRY 1 apply. The corrected entry follows, in the same JSON shape.'],
            ];
            goto retry;
        }
        return $fail('schema_miss', 'The answer failed the checks: ' . implode('; ', $v['errors']) . '.');
    }
    return ['ok' => true, 'title' => $v['title'], 'size' => $v['size'], 'tags' => $v['tags'],
            'reasons' => $v['reasons'], 'model' => $m['api_model'], 'record' => $record,
            'cost_usd' => $cost, 'error' => null];
}

/** Two Anthropic usage objects added field by field (ints only; nested cache fields summed where both have them). */
function jd2_intake_usage_sum(array $a, array $b): array
{
    $out = $a;
    foreach ($b as $k => $v) {
        if (is_int($v) || is_float($v)) {
            $out[$k] = (is_numeric($out[$k] ?? null) ? $out[$k] : 0) + $v;
        } elseif (is_array($v) && is_array($out[$k] ?? null)) {
            $out[$k] = jd2_intake_usage_sum($out[$k], $v);
        } elseif (!isset($out[$k])) {
            $out[$k] = $v;
        }
    }
    return $out;
}

/**
 * The dev mock (JD_DEV_MODE): no network, deterministic in the prompt text.
 * The heading inverts the prompt's first phrase (its last word first, the
 * rest after a comma: "a brass key with a paper tag" → "Key, brass"; a lone
 * word gets "(mock)"); the size cycles through the tiers by the prompt's
 * length; the classification is subject ["object"] and nothing else.
 * JD_INTAKE_MOCK_FAIL (provider | refusal | schema; any other non-empty
 * value = provider) makes it fail the way the real call can, so the
 * fallback path is testable.
 */
function jd2_intake_mock(array $taxonomy, string $prompt, string $version): array
{
    $base = ['ok' => false, 'title' => null, 'size' => null, 'tags' => null, 'reasons' => null,
             'model' => 'mock', 'cost_usd' => null, 'error' => null];
    $record = ['version' => $version, 'model' => 'mock', 'key' => null];
    $failure = (string) getenv('JD_INTAKE_MOCK_FAIL');
    if ($failure !== '' && $failure !== '0') {
        $code = ['refusal' => 'refusal', 'schema' => 'schema_miss'][$failure] ?? 'provider_failed';
        return ['error' => $code] + $base + ['record' => $record + ['error' => [
            'code' => $code, 'message' => 'The mock was told to fail (JD_INTAKE_MOCK_FAIL=' . $failure . ').']]];
    }
    $head = preg_split('/\s*(?:,|;|:|\.|\bwith\b|\bin\b|\bon\b|\bof\b|\bfor\b|\bas\b|\blike\b|\bunder\b|\binside\b)\s*/iu',
        trim($prompt), 2)[0] ?? '';
    $words = array_values(array_filter(preg_split('/[^\p{L}\p{N}\'-]+/u', mb_strtolower($head)) ?: [],
        static fn ($w) => $w !== '' && !in_array($w, ['a', 'an', 'the', 'some', 'one', 'single'], true)));
    if ($words === []) {
        $words = ['thing'];
    }
    $noun = array_pop($words);
    $words = array_slice($words, -3);
    $title = mb_strtoupper(mb_substr($noun, 0, 1)) . mb_substr($noun, 1)
        . ($words === [] ? ' (mock)' : ', ' . implode(' ', $words));
    if (mb_strlen($title) > JD2_INTAKE_TITLE_MAX_CHARS) {
        $title = mb_strtoupper(mb_substr($noun, 0, 1)) . mb_substr(mb_substr($noun, 1), 0, 20) . ' (mock)';
    }
    $tiers = array_map('strval', array_keys(jd_size_tiers($taxonomy)));
    $answer = ['title' => $title, 'size' => $tiers[mb_strlen($prompt) % max(1, count($tiers))] ?? null];
    foreach (jd2_facets($taxonomy) as $f) {
        $answer[$f['id']] = $f['min'] >= 1 ? [$f['headings'][0]['id']] : [];
    }
    $answer['reasons'] = ['size' => 'The mock sizes by the prompt\'s length.',
                          'classification' => 'The mock files every prompt under its first subject heading.'];
    $record['text'] = json_encode($answer, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $record['answer'] = $answer;
    $record['stop_reason'] = 'end_turn';
    $v = jd2_intake_validate($answer, $taxonomy);
    if (!$v['ok']) {
        return ['error' => 'schema_miss'] + $base + ['record' => $record + ['error' => [
            'code' => 'schema_miss', 'message' => 'The mock answer failed the checks: ' . implode('; ', $v['errors']) . '.']]];
    }
    return ['ok' => true, 'title' => $v['title'], 'size' => $v['size'], 'tags' => $v['tags'], 'reasons' => $v['reasons'],
            'model' => 'mock', 'record' => $record, 'cost_usd' => null, 'error' => null];
}

// ---------------------------------------------------------------------------
// The command line: print what is sent

if (PHP_SAPI === 'cli' && isset($argv[0]) && realpath($argv[0]) === __FILE__) {
    if (!in_array('--print', array_slice($argv, 1), true)) {
        fwrite(STDERR, "Usage: php api/jd2-intake-prompt.php --print\n");
        exit(2);
    }
    $taxonomy = jd_taxonomy();
    if (!is_array($taxonomy)) {
        fwrite(STDERR, "taxonomy.json is missing or unreadable.\n");
        exit(2);
    }
    $req = jd2_intake_request($taxonomy, '…the visitor\'s prompt…');
    echo '=== SYSTEM PROMPT (' . jd2_intake_version($taxonomy) . ', taxonomy v' . jd_taxonomy_version($taxonomy) . ") ===\n";
    echo $req['system'] . "\n";
    echo "=== END SYSTEM PROMPT ===\n\n";
    echo "=== USER MESSAGE ===\n" . $req['messages'][0]['content'] . "\n=== END USER MESSAGE ===\n\n";
    echo "=== JSON SCHEMA (output_config.format.schema) ===\n";
    echo json_encode($req['output_config']['format']['schema'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    echo "=== END JSON SCHEMA ===\n\n";
    $shape = $req;
    $shape['system'] = '<the system prompt above, ' . mb_strlen($req['system']) . ' characters>';
    $shape['messages'][0]['content'] = '<the user message above>';
    $shape['output_config']['format']['schema'] = '<the schema above>';
    echo "=== REQUEST BODY ===\n" . json_encode($shape, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    exit(0);
}
