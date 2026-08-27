<?php
// Shared visitor-hash helper.
//
// Produces a salted, daily-rotating SHA-256 of the client IP. This lets the
// trackers count UNIQUE visits (COUNT(DISTINCT visitor_hash)) WITHOUT ever
// storing a raw, reversible IP address:
//
//   * The secret salt means the hash can't be reversed by brute-forcing the
//     ~4 billion IPv4 addresses against a known date — without the salt the
//     hash would be trivially reversible from a DB leak.
//   * The UTC date in the hash makes it rotate every 24h, so the same visitor
//     produces a different hash tomorrow. Good for "uniques today" while
//     preventing long-term cross-day correlation.
//
// Set 'ip_hash_salt' in private_config/secrets.php for production hardening.
// The fallback below still works, but anyone who reads this source could
// reconstruct it — so a real secret is strongly preferred.

function msky_client_ip()
{
    // Behind Bluehost / a CDN (we've seen Fastly edges) the real client IP
    // can arrive in a forwarded header. Take the first hop when present.
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            $first = explode(',', $_SERVER[$key])[0];
            return trim($first);
        }
    }
    return '0.0.0.0';
}

function msky_visitor_hash(array $secrets = [])
{
    $salt = $secrets['ip_hash_salt'] ?? 'msky-rotating-default-salt-v1';
    return hash('sha256', $salt . '|' . gmdate('Y-m-d') . '|' . msky_client_ip());
}
?>
