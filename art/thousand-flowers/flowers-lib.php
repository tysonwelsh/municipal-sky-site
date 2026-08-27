<?php
/**
 * flowers-lib.php — A Thousand Flowers relay substrate.
 *
 * Pure PHP, no database. Reads a spool directory of RFC-1036-flavored `.msg`
 * article files, gates them by arrival time, threads them by References, and
 * renders header blocks and bodies as escaped HTML.
 *
 * See SPEC.md in this directory for the article format and the full API
 * contract. Every function is defensive: a malformed or unreadable file is
 * skipped, never fatal.
 *
 * Function prefix: flowers_
 */

// ─────────────────────────────────────────────────────────────────────────
// Relay configuration
// ─────────────────────────────────────────────────────────────────────────

/** Fallback used when relay.json is missing or unparseable. */
function flowers_relay_defaults()
{
    return array(
        'eraOffsetYears' => 1016,
        'group'          => 'colonies.music.flowers',
        'nodes'          => array(),
        'jitterFrac'     => 0.2,
    );
}

/**
 * Load relay.json. Returns the decoded config merged over the defaults.
 * $path defaults to relay.json beside this library.
 */
function flowers_load_relay($path = null)
{
    if ($path === null) {
        $path = __DIR__ . '/relay.json';
    }
    $relay = flowers_relay_defaults();
    if (!is_string($path) || !is_file($path) || !is_readable($path)) {
        return $relay;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return $relay;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return $relay;
    }
    foreach ($decoded as $k => $v) {
        $relay[$k] = $v;
    }
    if (!is_array($relay['nodes'])) {
        $relay['nodes'] = array();
    }
    $relay['eraOffsetYears'] = (int) $relay['eraOffsetYears'];
    return $relay;
}

/**
 * Node record for a colony key, or null if the relay does not know it.
 * Always returns 'title', 'transitDays', 'origin' keys when non-null.
 */
function flowers_node($relay, $colony)
{
    if (!is_array($relay) || !isset($relay['nodes'][$colony]) || !is_array($relay['nodes'][$colony])) {
        return null;
    }
    $n = $relay['nodes'][$colony];
    return array(
        'key'         => $colony,
        'title'       => isset($n['title']) ? (string) $n['title'] : $colony,
        'transitDays' => isset($n['transitDays']) ? (int) $n['transitDays'] : 0,
        'origin'      => isset($n['origin']) ? (string) $n['origin'] : '',
    );
}

/** Human title for a colony key ('bardo' → 'The Monastery-Ark'). */
function flowers_colony_title($relay, $colony)
{
    $n = flowers_node($relay, $colony);
    return $n ? $n['title'] : (string) $colony;
}

// ─────────────────────────────────────────────────────────────────────────
// Time
// ─────────────────────────────────────────────────────────────────────────

/**
 * Normalize a "now" override to a UTC DateTimeImmutable.
 * Accepts null (real UTC now), a DateTimeInterface, a unix int, or a
 * parseable date string. Unparseable input falls back to real now.
 */
function flowers_now($now = null)
{
    $utc = new DateTimeZone('UTC');
    if ($now instanceof DateTimeInterface) {
        return (new DateTimeImmutable('@' . $now->getTimestamp()))->setTimezone($utc);
    }
    if (is_int($now)) {
        return (new DateTimeImmutable('@' . $now))->setTimezone($utc);
    }
    if (is_string($now) && $now !== '') {
        try {
            return (new DateTimeImmutable($now, $utc))->setTimezone($utc);
        } catch (Exception $e) {
            // fall through
        }
    }
    return new DateTimeImmutable('now', $utc);
}

/** Parse an article timestamp to UTC DateTimeImmutable, or null. */
function flowers_parse_time($value)
{
    if (!is_string($value) || trim($value) === '') {
        return null;
    }
    try {
        $utc = new DateTimeZone('UTC');
        return (new DateTimeImmutable(trim($value), $utc))->setTimezone($utc);
    } catch (Exception $e) {
        return null;
    }
}

/**
 * Era-shifted date string. Timestamps are stored as real UTC and rendered
 * with the relay's +eraOffsetYears shift (2026 → 3042).
 *
 * @param mixed  $when   DateTimeInterface or parseable string.
 * @param array  $relay  relay config (for eraOffsetYears).
 * @param string $format PHP date() format. Default "4 Aug 3042".
 * @return string        '' when $when is unusable.
 */
function flowers_era_date($when, $relay, $format = 'j M Y')
{
    $dt = ($when instanceof DateTimeInterface)
        ? flowers_now($when)
        : flowers_parse_time($when);
    if ($dt === null) {
        return '';
    }
    $offset = is_array($relay) && isset($relay['eraOffsetYears']) ? (int) $relay['eraOffsetYears'] : 0;
    if ($offset !== 0) {
        $shifted = $dt->modify(($offset >= 0 ? '+' : '-') . abs($offset) . ' years');
        if ($shifted instanceof DateTimeImmutable) {
            $dt = $shifted;
        }
    }
    return $dt->format($format);
}

/** Convenience: era-shifted date + time, e.g. "4 Aug 3042 09:40 UTC". */
function flowers_era_datetime($when, $relay)
{
    return flowers_era_date($when, $relay, 'j M Y H:i') . ' UTC';
}

// ─────────────────────────────────────────────────────────────────────────
// Article parsing
// ─────────────────────────────────────────────────────────────────────────

/**
 * Parse one article from raw text.
 *
 * @param string $text raw UTF-8 article (headers, blank line, body).
 * @param string $seq  sequence label (usually the filename stem, "000003").
 * @return array|null  article record, or null if malformed.
 *
 * Article record keys:
 *   seq, file, headers (lowercased assoc), header_order (display-cased list),
 *   message_id, references (array), parent_id, subject,
 *   from, from_name, from_email, colony, admin (bool), path,
 *   date (DateTimeImmutable|null), arrives (DateTimeImmutable|null),
 *   body (string), body_lines, sig_lines, origin (string|null)
 */
function flowers_parse_article_text($text, $seq = '')
{
    if (!is_string($text) || trim($text) === '') {
        return null;
    }
    // Strip a UTF-8 BOM, normalize line endings.
    if (substr($text, 0, 3) === "\xEF\xBB\xBF") {
        $text = substr($text, 3);
    }
    $text = str_replace(array("\r\n", "\r"), "\n", $text);

    $split = preg_split('/\n[ \t]*\n/', $text, 2);
    if ($split === false || count($split) === 0) {
        return null;
    }
    $headBlock = $split[0];
    $bodyBlock = isset($split[1]) ? $split[1] : '';

    // ── Headers (with RFC continuation-line folding) ─────────────────────
    $headers = array();
    $order   = array();
    $lastKey = null;
    foreach (explode("\n", $headBlock) as $line) {
        if ($line === '') {
            continue;
        }
        if (($line[0] === ' ' || $line[0] === "\t") && $lastKey !== null) {
            $headers[$lastKey] .= ' ' . trim($line);
            continue;
        }
        $pos = strpos($line, ':');
        if ($pos === false || $pos === 0) {
            continue; // junk line — skip, don't fatal
        }
        $name = trim(substr($line, 0, $pos));
        $val  = trim(substr($line, $pos + 1));
        if ($name === '') {
            continue;
        }
        $key = strtolower($name);
        $headers[$key] = $val;
        $order[$key]   = $name;
        $lastKey       = $key;
    }
    if (!isset($headers['message-id']) || $headers['message-id'] === '') {
        return null; // an article without an identity cannot be threaded
    }

    $h = function ($k, $default = '') use ($headers) {
        return isset($headers[$k]) ? $headers[$k] : $default;
    };

    // ── References chain ─────────────────────────────────────────────────
    $refs = array();
    if ($h('references') !== '') {
        if (preg_match_all('/<[^<>\s]+>/', $h('references'), $m)) {
            $refs = $m[0];
        }
    }

    // ── From: "Display Name <addr>" ──────────────────────────────────────
    $from      = $h('from');
    $fromName  = $from;
    $fromEmail = '';
    if (preg_match('/^(.*?)\s*<([^<>]+)>\s*$/', $from, $m)) {
        $fromName  = trim($m[1]);
        $fromEmail = trim($m[2]);
    } elseif (strpos($from, '@') !== false) {
        $fromEmail = $from;
    }

    $seq = (string) $seq;
    if ($seq === '' && preg_match('/^<(\d+)\./', $headers['message-id'], $m)) {
        $seq = $m[1];
    }

    $article = array(
        'seq'          => $seq,
        'file'         => '',
        'path'         => $h('path'),
        'headers'      => $headers,
        'header_order' => $order,
        'message_id'   => $headers['message-id'],
        'references'   => $refs,
        'parent_id'    => count($refs) ? $refs[count($refs) - 1] : null,
        'subject'      => $h('subject', '(no subject)'),
        'newsgroups'   => $h('newsgroups'),
        'from'         => $from,
        'from_name'    => $fromName !== '' ? $fromName : $fromEmail,
        'from_email'   => $fromEmail,
        'colony'       => strtolower($h('x-flowers-colony')),
        'admin'        => strtolower($h('x-flowers-admin')) === 'yes',
        'date'         => flowers_parse_time($h('date')),
        'arrives'      => flowers_parse_time($h('x-arrives')),
    );
    // No X-Arrives ⇒ treat as having arrived when written.
    if ($article['arrives'] === null) {
        $article['arrives'] = $article['date'];
    }

    // ── Body / sig / origin ──────────────────────────────────────────────
    $bodyBlock = rtrim($bodyBlock, "\n");
    $lines     = $bodyBlock === '' ? array() : explode("\n", $bodyBlock);

    $origin = null;
    for ($i = count($lines) - 1; $i >= 0; $i--) {
        if (trim($lines[$i]) === '') {
            continue;
        }
        if (preg_match('/^\s*\*\s*Origin:/i', $lines[$i])) {
            $origin = trim($lines[$i]);
            array_splice($lines, $i, 1);
        }
        break; // only the final non-blank line may be the Origin line
    }

    $sigLines = array();
    for ($i = 0; $i < count($lines); $i++) {
        if (rtrim($lines[$i]) === '--') {
            $sigLines = array_slice($lines, $i + 1);
            $lines    = array_slice($lines, 0, $i);
            break;
        }
    }
    while (count($lines) && trim($lines[count($lines) - 1]) === '') {
        array_pop($lines);
    }
    while (count($sigLines) && trim($sigLines[count($sigLines) - 1]) === '') {
        array_pop($sigLines);
    }

    $article['body_lines'] = $lines;
    $article['body']       = implode("\n", $lines);
    $article['sig_lines']  = $sigLines;
    $article['origin']     = $origin;

    return $article;
}

/** Parse one `.msg` file. Returns null (never fatal) on unreadable/malformed. */
function flowers_parse_article_file($path)
{
    if (!is_string($path) || !is_file($path) || !is_readable($path)) {
        return null;
    }
    $raw = @file_get_contents($path);
    if ($raw === false) {
        return null;
    }
    $seq = pathinfo($path, PATHINFO_FILENAME);
    $a   = flowers_parse_article_text($raw, $seq);
    if ($a === null) {
        return null;
    }
    $a['file'] = basename($path);
    return $a;
}

/**
 * Load every parseable `*.msg` in a spool directory.
 * Returns articles keyed by Message-ID, sorted by sequence ascending.
 * Duplicate Message-IDs: first (lowest sequence) wins.
 */
function flowers_load_spool($dir)
{
    $out = array();
    if (!is_string($dir) || !is_dir($dir)) {
        return $out;
    }
    $files = glob(rtrim($dir, '/') . '/*.msg');
    if (!is_array($files)) {
        return $out;
    }
    sort($files, SORT_STRING);
    foreach ($files as $f) {
        $a = flowers_parse_article_file($f);
        if ($a === null) {
            continue;
        }
        if (isset($out[$a['message_id']])) {
            continue;
        }
        $out[$a['message_id']] = $a;
    }
    return $out;
}

// ─────────────────────────────────────────────────────────────────────────
// Arrival gating
// ─────────────────────────────────────────────────────────────────────────

/** True when the article's X-Arrives is at or before $now. */
function flowers_has_arrived($article, $now = null)
{
    if (!is_array($article)) {
        return false;
    }
    $arr = isset($article['arrives']) ? $article['arrives'] : null;
    if (!($arr instanceof DateTimeInterface)) {
        return true; // no usable arrival stamp ⇒ nothing to wait for
    }
    return $arr->getTimestamp() <= flowers_now($now)->getTimestamp();
}

/** Articles that have arrived, keyed by Message-ID. */
function flowers_arrived($articles, $now = null)
{
    $n   = flowers_now($now);
    $out = array();
    foreach ((array) $articles as $id => $a) {
        if (flowers_has_arrived($a, $n)) {
            $out[$id] = $a;
        }
    }
    return $out;
}

/**
 * Articles still in transit, reduced to the ONLY facts the relay may
 * disclose before arrival: the sending colony and the arrival time.
 * Subject, author, body and headers are never exposed here.
 *
 * @return array list of ['colony','colony_title','arrives','arrives_display']
 *               sorted by arrival ascending.
 */
function flowers_in_transit($articles, $now = null, $relay = null)
{
    if ($relay === null) {
        $relay = flowers_load_relay();
    }
    $n   = flowers_now($now);
    $out = array();
    foreach ((array) $articles as $a) {
        if (flowers_has_arrived($a, $n)) {
            continue;
        }
        $colony = isset($a['colony']) ? $a['colony'] : '';
        $out[]  = array(
            'colony'          => $colony,
            'colony_title'    => flowers_colony_title($relay, $colony),
            'arrives'         => $a['arrives'],
            'arrives_display' => flowers_era_date($a['arrives'], $relay),
        );
    }
    usort($out, function ($x, $y) {
        $xa = $x['arrives'] instanceof DateTimeInterface ? $x['arrives']->getTimestamp() : PHP_INT_MAX;
        $ya = $y['arrives'] instanceof DateTimeInterface ? $y['arrives']->getTimestamp() : PHP_INT_MAX;
        return $xa <=> $ya;
    });
    return $out;
}

// ─────────────────────────────────────────────────────────────────────────
// Threading
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build thread trees from a set of articles (normally the arrived ones).
 *
 * Each node is the article record plus:
 *   'children' => list of nodes (arrival ascending)
 *   'depth'    => 0 for thread roots
 *
 * Parent = the last entry in References that is present in $articles;
 * walking the chain right-to-left so a missing intermediate reply still
 * attaches to its nearest available ancestor. An article whose chain has no
 * present ancestor becomes a root of its own.
 *
 * @return array list of root nodes, most recently active thread first.
 */
function flowers_build_threads($articles)
{
    $articles = (array) $articles;
    $nodes    = array();
    foreach ($articles as $id => $a) {
        $a['children'] = array();
        $a['depth']    = 0;
        $nodes[$id]    = $a;
    }

    $childrenOf = array();
    $roots      = array();
    foreach ($nodes as $id => $a) {
        $parent = null;
        $refs   = isset($a['references']) ? $a['references'] : array();
        for ($i = count($refs) - 1; $i >= 0; $i--) {
            if ($refs[$i] !== $id && isset($nodes[$refs[$i]])) {
                $parent = $refs[$i];
                break;
            }
        }
        if ($parent === null) {
            $roots[] = $id;
        } else {
            $childrenOf[$parent][] = $id;
        }
    }

    $sortIds = function (&$ids) use ($nodes) {
        usort($ids, function ($x, $y) use ($nodes) {
            $xa = $nodes[$x]['arrives'] instanceof DateTimeInterface ? $nodes[$x]['arrives']->getTimestamp() : 0;
            $ya = $nodes[$y]['arrives'] instanceof DateTimeInterface ? $nodes[$y]['arrives']->getTimestamp() : 0;
            if ($xa === $ya) {
                return strcmp((string) $nodes[$x]['seq'], (string) $nodes[$y]['seq']);
            }
            return $xa <=> $ya;
        });
    };

    // Recursive assembly, cycle-safe via a seen set.
    $build = function ($id, $depth, $seen) use (&$build, &$nodes, &$childrenOf, $sortIds) {
        $node          = $nodes[$id];
        $node['depth'] = $depth;
        $seen[$id]     = true;
        $kids          = isset($childrenOf[$id]) ? $childrenOf[$id] : array();
        $sortIds($kids);
        foreach ($kids as $kid) {
            if (isset($seen[$kid])) {
                continue;
            }
            $node['children'][] = $build($kid, $depth + 1, $seen);
        }
        return $node;
    };

    $sortIds($roots);
    $threads = array();
    foreach ($roots as $rid) {
        $threads[] = $build($rid, 0, array());
    }

    // Most recently active thread first.
    usort($threads, function ($x, $y) {
        return flowers_thread_latest($y) <=> flowers_thread_latest($x);
    });
    return $threads;
}

/** Latest arrival timestamp anywhere in a thread node (unix int). */
function flowers_thread_latest($node)
{
    $t = isset($node['arrives']) && $node['arrives'] instanceof DateTimeInterface
        ? $node['arrives']->getTimestamp() : 0;
    foreach ((array) $node['children'] as $c) {
        $ct = flowers_thread_latest($c);
        if ($ct > $t) {
            $t = $ct;
        }
    }
    return $t;
}

/** Flatten a thread node to a depth-first list (root first). */
function flowers_flatten_thread($node, &$out = null)
{
    if ($out === null) {
        $out = array();
    }
    $self             = $node;
    $self['children'] = array();
    $out[]            = $self;
    foreach ((array) $node['children'] as $c) {
        flowers_flatten_thread($c, $out);
    }
    return $out;
}

/** Number of articles in a thread. */
function flowers_thread_count($node)
{
    $n = 1;
    foreach ((array) $node['children'] as $c) {
        $n += flowers_thread_count($c);
    }
    return $n;
}

/** Find one article by Message-ID or by sequence ("000003"). */
function flowers_find_article($articles, $key)
{
    $key = (string) $key;
    if (isset($articles[$key])) {
        return $articles[$key];
    }
    foreach ((array) $articles as $a) {
        if ((string) $a['seq'] === $key || $a['message_id'] === $key) {
            return $a;
        }
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Rendering (escaped HTML fragments; the skin supplies the CSS)
// ─────────────────────────────────────────────────────────────────────────

/** Shorthand escaper. */
function flowers_e($s)
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

/** Headers shown, in display order, by an article view. */
function flowers_display_header_names()
{
    return array(
        'From', 'Newsgroups', 'Subject', 'Message-ID', 'References',
        'Date', 'X-Flowers-Colony', 'X-Arrives', 'X-Flowers-Admin', 'Path',
    );
}

/**
 * Render an article's header block as escaped HTML.
 *
 * Markup: <div class="tf-headers"> with one
 *   <div class="tf-hdr tf-hdr-<slug>"><span class="tf-hdr-name">…</span>
 *   <span class="tf-hdr-value">…</span></div>
 * per header. Date/X-Arrives values are era-shifted for display; pass
 * $show_raw = true to append the stored UTC value in a
 * <span class="tf-hdr-raw"> for protocol inspection.
 */
function flowers_render_headers_html($article, $relay = null, $show_raw = false)
{
    if (!is_array($article) || !isset($article['headers'])) {
        return '';
    }
    if ($relay === null) {
        $relay = flowers_load_relay();
    }
    $h    = $article['headers'];
    $out  = '<div class="tf-headers">';
    foreach (flowers_display_header_names() as $name) {
        $key = strtolower($name);
        if (!isset($h[$key]) || $h[$key] === '') {
            continue;
        }
        $label = isset($article['header_order'][$key]) ? $article['header_order'][$key] : $name;
        $value = $h[$key];
        $extra = '';
        if ($key === 'date' || $key === 'x-arrives') {
            $era = flowers_era_datetime($value, $relay);
            if ($era !== ' UTC') {
                if ($show_raw) {
                    $extra = ' <span class="tf-hdr-raw">(' . flowers_e($value) . ')</span>';
                }
                $value = $era;
            }
        }
        $slug = preg_replace('/[^a-z0-9]+/', '-', $key);
        $out .= '<div class="tf-hdr tf-hdr-' . $slug . '">'
              . '<span class="tf-hdr-name">' . flowers_e($label) . ':</span> '
              . '<span class="tf-hdr-value">' . flowers_e($value) . '</span>'
              . $extra . '</div>';
    }
    $out .= '</div>';
    return $out;
}

/**
 * Render an article's body as escaped HTML.
 *
 * Markup: <pre class="tf-body"> containing one
 *   <span class="tf-line">…</span> per body line; lines beginning with ">"
 *   carry tf-quote (and tf-quote-N for nesting depth, capped at 3).
 * The sig block follows in <span class="tf-sig"> (its "-- " separator kept
 * as <span class="tf-sig-sep">), and the Origin line in
 * <span class="tf-origin">.
 */
function flowers_render_body_html($article)
{
    if (!is_array($article)) {
        return '';
    }
    $out = '<pre class="tf-body">';
    foreach ((array) $article['body_lines'] as $line) {
        $out .= flowers_render_line_html($line);
    }
    if (!empty($article['sig_lines'])) {
        $out .= '<span class="tf-sig">';
        $out .= '<span class="tf-sig-sep">-- </span>' . "\n";
        foreach ($article['sig_lines'] as $line) {
            $out .= flowers_e($line) . "\n";
        }
        $out .= '</span>';
    }
    if (!empty($article['origin'])) {
        $out .= '<span class="tf-origin">' . flowers_e(' ' . ltrim($article['origin'])) . "</span>\n";
    }
    $out .= '</pre>';
    return $out;
}

/** Render one body line (used by flowers_render_body_html). */
function flowers_render_line_html($line)
{
    $trimmed = ltrim($line);
    if ($trimmed !== '' && $trimmed[0] === '>') {
        $depth = 0;
        $probe = $trimmed;
        while ($probe !== '' && $probe[0] === '>' && $depth < 3) {
            $depth++;
            $probe = ltrim(substr($probe, 1));
        }
        return '<span class="tf-line tf-quote tf-quote-' . $depth . '">'
             . flowers_e($line) . "</span>\n";
    }
    return '<span class="tf-line">' . flowers_e($line) . "</span>\n";
}

/**
 * One-line index summary for an article: subject, author, colony, arrival.
 * Returns an array of already-escaped display strings (no markup), so a skin
 * can lay it out however it likes.
 */
function flowers_article_summary($article, $relay = null)
{
    if ($relay === null) {
        $relay = flowers_load_relay();
    }
    return array(
        'seq'        => flowers_e($article['seq']),
        'id'         => flowers_e($article['message_id']),
        'subject'    => flowers_e($article['subject']),
        'author'     => flowers_e($article['from_name']),
        'colony'     => flowers_e($article['colony']),
        'colony_title' => flowers_e(flowers_colony_title($relay, $article['colony'])),
        'arrived'    => flowers_e(flowers_era_date($article['arrives'], $relay)),
        'written'    => flowers_e(flowers_era_date($article['date'], $relay)),
        'admin'      => !empty($article['admin']),
    );
}
