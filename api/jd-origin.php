<?php
// Shared origin allowlist for the Junk Drawer visitor-prompt endpoints
// (PLAN-USER-PROMPTS-CONTRACTS C1.1, APP §4.2).
//
// This is the ONLY file in the feature that may emit an
// Access-Control-Allow-Origin header. It never emits '*' and never emits
// Access-Control-Allow-Credentials.

require_once __DIR__ . '/jd-config.php';

const JD_ALLOWED_ORIGINS = [
    'https://municipalsky.com',
    'https://www.municipalsky.com',
    // 'capacitor://localhost',   // app stage: uncomment, one-line edit
];

function jd_allowed_origins(): array
{
    $origins = JD_ALLOWED_ORIGINS;
    if (JD_DEV_MODE) {
        $origins[] = 'http://localhost:8000';
        $origins[] = 'http://127.0.0.1:8000';
    }
    return $origins;
}

// Called as the first statement after the includes in every endpoint. Exits
// on preflight (204) and on rejection (403).
function jd_require_allowed_origin(): void
{
    $allowed = jd_allowed_origins();
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $matched = ($origin !== '' && in_array($origin, $allowed, true));

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        if ($matched) {
            header('Access-Control-Allow-Origin: ' . $origin);
        }
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 86400');
        header('Vary: Origin');
        // C1 — Content-Type: application/json on every response, preflight
        // included, even though a 204 carries no body.
        header('Content-Type: application/json');
        http_response_code(204);
        exit;
    }

    if ($origin !== '') {
        if (!$matched) {
            header('Vary: Origin');
            jd_fail(403, 'origin_forbidden', 'This origin is not allowed to call this endpoint.');
        }
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        return;
    }

    // Origin absent — handled explicitly rather than by fall-through. Browsers
    // always send Origin on a POST, so this branch is curl and the dev
    // harness. A Referer under an allowed origin passes with no CORS header:
    // it was not a CORS request.
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    if ($referer !== '') {
        foreach ($allowed as $candidate) {
            if ($referer === $candidate || str_starts_with($referer, $candidate . '/')) {
                return;
            }
        }
    }

    jd_fail(403, 'origin_forbidden', 'This request did not present an allowed origin.');
}
