<?php
// POST /api/jd2-title.php — a 2–5 word title for a turn's object (dataset v2).
//
// v1's jd-title.php (2026-08-29) unchanged in what it does, re-pointed at the
// jd2 tables: the client fires it during the darkroom wait, in parallel with
// the slot requests to jd2-generate.php, so it costs no visible time; a small
// fast model names the OBJECT in a museum-tag title; every failure path falls
// back to the prompt's own words client-side, so a missing title can never
// hold up a turn. The card files the title it shows with its ratings
// (jd2-rate.php writes jd2_prompts.title); nothing is stored here.
//
// ABUSE GUARD: this is a compute endpoint, so it answers only for a real
// turn — the client_ref must belong to a jd2 prompt filed in the last hour
// (jd2-generate.php files the prompt under the turn's client_ref, the
// owner's new prompts included). Turns are themselves rate-limited, so
// titles inherit that ceiling.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-provider.php';   // jd_provider_key, jd_http_post_json

jd_require_allowed_origin();
jd_require_post();
jd_no_store();

const JD_TITLE_MODEL = 'claude-haiku-4-5-20251001';
const JD_TITLE_SYSTEM =
    'You write museum specimen-tag titles. Reply with ONLY a title for the ' .
    'object described: two to four plain words (five only if a small word ' .
    'like "of" or "in" demands it). Name the object itself, not the style ' .
    'notes. No quotes, no trailing period, no commentary.';

$body = jd_read_json_body();

$clientRef = $body['client_ref'] ?? null;
if (!is_string($clientRef) || !preg_match('/^[0-9a-fA-F-]{8,64}$/', $clientRef)) {
    jd_fail(400, 'bad_request', 'A client_ref is required.');
}
$prompt = $body['prompt'] ?? null;
if (!is_string($prompt) || trim($prompt) === '' || mb_strlen($prompt) > JD_PROMPT_MAX_CHARS) {
    jd_fail(400, 'bad_request', 'A prompt of 1 to ' . JD_PROMPT_MAX_CHARS . ' characters is required.');
}
$prompt = trim($prompt);

// The turn must be real and current. (The prompt row is filed by the first
// slot's jd2-generate call; the client fires this right after the slots
// leave, so one retry covers the race where none has landed yet.)
try {
    $db = jd_db();
    $stmt = $db->prepare(
        "SELECT id FROM jd2_prompts
          WHERE client_ref = ? AND created >= ?
          LIMIT 1"
    );
    $stmt->execute([$clientRef, gmdate('Y-m-d H:i:s', time() - 3600)]);
    if ($stmt->fetchColumn() === false) {
        jd_fail(403, 'no_turn', 'No current turn matches that reference.');
    }
} catch (PDOException $e) {
    error_log('jd2-title: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The turn could not be checked.');
}

// jd2_title_clean: whatever comes back, ship at most five plain words.
function jd2_title_clean(string $raw): string
{
    $t = trim($raw);
    $t = preg_replace('/[\r\n].*$/s', '', $t);           // first line only
    $t = trim($t, " \t\"'\u{201C}\u{201D}\u{2018}\u{2019}.,:;");
    $words = preg_split('/\s+/', $t, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if (count($words) > 5) {
        $words = array_slice($words, 0, 5);
    }
    $t = implode(' ', $words);
    if (mb_strlen($t) > 40) {
        $t = mb_substr($t, 0, 40);
    }
    return $t;
}

if (JD_DEV_MODE) {
    // The mock titler: the prompt's own first words, clamped — free, instant,
    // and visibly distinct from the 52-char truncation it replaces.
    $words = preg_split('/\s+/', $prompt, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    jd_json_out(200, ['ok' => true, 'title' => jd2_title_clean(
        implode(' ', array_slice($words, 0, 3)))]);
}

$key = jd_provider_key('anthropic');
if ($key === null) {
    jd_fail(500, 'server_error', 'No provider key on file.');
}

$wire = jd_http_post_json('https://api.anthropic.com/v1/messages', [
    'Content-Type: application/json',
    'x-api-key: ' . $key,
    'anthropic-version: 2023-06-01',
], [
    'model'      => JD_TITLE_MODEL,
    'max_tokens' => 30,
    'system'     => JD_TITLE_SYSTEM,
    'messages'   => [['role' => 'user', 'content' => $prompt]],
], 20);
$http = $wire['http_code'];

$text = null;
if ($wire['error'] === null && $http === 200) {
    $j = json_decode($wire['body'], true);
    $text = $j['content'][0]['text'] ?? null;
}
if (!is_string($text)) {
    error_log('jd2-title: provider answered ' . $http);
    jd_fail(502, 'provider_failed', 'No title came back.');
}
$title = jd2_title_clean($text);
if ($title === '') {
    jd_fail(502, 'provider_failed', 'The title came back empty.');
}

jd_json_out(200, ['ok' => true, 'title' => $title]);
