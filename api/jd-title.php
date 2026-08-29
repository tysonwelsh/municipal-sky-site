<?php
// POST /api/jd-title.php — a 2–5 word title for a turn's object (2026-08-29).
//
// The pile's specimen tags used to wear the first 52 characters of the
// visitor's prompt, which for any prompt longer than a phrase read as a
// run-on ("A crystal ball the kind a fortune teller might…" — owner). This
// endpoint asks a small fast model for a museum-tag title of the OBJECT and
// nothing else. The client fires it during the darkroom wait, in parallel
// with the four generations, so it costs no visible time; every failure path
// falls back to the old truncation client-side, so a missing title can never
// hold up a turn.
//
// ABUSE GUARD: this is a compute endpoint, so it answers only for a real
// turn — the client_ref must belong to a submission created in the last
// hour. Turns are themselves rate-limited, so titles inherit that ceiling.
// The response is advisory display text; nothing is stored server-side.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-provider.php';   // jd_provider_key

jd_require_allowed_origin();
jd_require_post();

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

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

// The turn must be real and current. (The submission row is minted by the
// first slot's jd-generate call; the client fires this right after those
// four leave, so one retry covers the race where none has landed yet.)
try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $stmt = $db->prepare(
        "SELECT id FROM jd_submissions
          WHERE client_ref = ? AND created >= ?
          LIMIT 1"
    );
    $stmt->execute([$clientRef, gmdate('Y-m-d H:i:s', time() - 3600)]);
    if ($stmt->fetchColumn() === false) {
        jd_fail(403, 'no_turn', 'No current turn matches that reference.');
    }
} catch (PDOException $e) {
    error_log('jd-title: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The turn could not be checked.');
}

// jd_title_clean: whatever comes back, ship at most five plain words.
function jd_title_clean(string $raw): string
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
    jd_json_out(200, ['ok' => true, 'title' => jd_title_clean(
        implode(' ', array_slice($words, 0, 3)))]);
}

$key = jd_provider_key('anthropic');
if ($key === null) {
    jd_fail(500, 'server_error', 'No provider key on file.');
}

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . $key,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_POSTFIELDS     => json_encode([
        'model'      => JD_TITLE_MODEL,
        'max_tokens' => 30,
        'system'     => JD_TITLE_SYSTEM,
        'messages'   => [['role' => 'user', 'content' => $prompt]],
    ]),
]);
$raw  = curl_exec($ch);
$http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$text = null;
if (is_string($raw) && $http === 200) {
    $j = json_decode($raw, true);
    $text = $j['content'][0]['text'] ?? null;
}
if (!is_string($text)) {
    error_log('jd-title: provider answered ' . $http);
    jd_fail(502, 'provider_failed', 'No title came back.');
}
$title = jd_title_clean($text);
if ($title === '') {
    jd_fail(502, 'provider_failed', 'The title came back empty.');
}

jd_json_out(200, ['ok' => true, 'title' => $title]);
