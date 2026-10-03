<?php
// Municipal Sky — the morning digest: a lo-fi ASCII dashboard, emailed daily
// by a cPanel cron job (`php .../api/onobot-cron.php`; the filename is the
// cron's, so it stays even though the digest long ago outgrew the bot).
//
// Runs on the Bluehost server where the database is local, so it reuses
// database.php (localhost connection, production secrets) — no remote access
// or credentials needed here. CLI-only: refuses web requests so the public
// /api/ URL can't be used to trigger emails.
//
// TWO EDITIONS (owner, 2026-10-01: a daily overview should carry only what
// moves day to day; the slow-moving breakdowns are for asking):
//   the daily  — skyline, pulse, pages, today's onobot and drawer activity
//                with every prompt, new signups, and anything broken
//   the full   — everything below. Sent on $WEEKLY_DAY (Monday) in place of
//                the daily, or any time with --full; --lean forces the daily.
//
// WHAT IT COVERS (all of it aggregate counts the site already keeps, or
// data the privacy policy says is stored — nothing new is collected here):
//   · the skyline — 14 days of page views drawn as a city, with the moon
//   · the pulse — views, visitors, plays, drawer turns, onobot uses, signups:
//     last 24h vs the 24h before, 7 days, all-time
//   · every PUBLIC page, ranked by the day's views, with 7d and all-time.
//     Public means listed right now on /art/ or /information-graphics/ (the
//     indexes are read at run time; a commented-out entry is hidden), plus
//     the nav's own pages. Hidden pages are left out of every count and
//     return the day they are listed again. The Blog is out altogether.
//   · the rhythm — views by hour of day (7d) and by weekday (8 weeks)
//   · onobot — uses vs ratings, provider failures, the Claude/GPT tug-of-war,
//     and every prompt of the day (the prompt only: no responses, no rating —
//     owner's call, 2026-10-01)
//   · the junk drawer — the turn funnel, errors, devices, first-place share
//     per model, exact spend per model (the cost_usd each drawing filed with),
//     drawing health, median latency, items opened, and every prompt of the
//     day (again the prompt and its title only, never the drawings or grades).
//     Dataset v2 only (the jd2_* tables, db/junk-drawer-v2-schema.md): the
//     v1 jd_* tables are frozen as of 2026-10-01 and would only ever print 0.
//   · signups — the list, where people sign up from, signups per view
//   · the plant — live VERSION strings, a self-ping, records, table sizes
//
// EMAIL FORMAT: multipart/alternative. The text/plain part is the dashboard
// itself; the text/html part is the SAME text inside a monospace <pre>,
// because Gmail renders plain text in a proportional font and the charts
// would fall apart. Lines are at most $W (64) columns wide.
//
// FLAGS (for working on it from a shell; the cron passes none):
//   --no-mail      print the digest, send nothing
//   --demo         render from synthetic data: no database needed, so the
//                  layout can be previewed anywhere (`php api/onobot-cron.php
//                  --demo --no-mail`)
//   --html=FILE    also write the HTML part to FILE (open it in a browser —
//                  that is what the mail client shows)
//   --ascii        7-bit characters only (if a mail client ever mangles the
//                  block glyphs, flip $ASCII below to make this permanent)
//   --hours=N      look-back window for the "24h" columns (default 24)
//   --to=ADDR      send to a different address (a test run)
//   --full         the long version (every section); --lean the daily

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("This script runs from cron (CLI) only.\n");
}

$T0 = microtime(true);

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────
$opts  = getopt('', ['no-mail', 'demo', 'html::', 'ascii', 'hours::', 'to::', 'full', 'lean']);
$H     = max(1, (int) ($opts['hours'] ?? 24));     // look-back window, hours
$TO    = $opts['to'] ?? 'tysonwelsh@gmail.com';
$FROM  = 'onobot@municipalsky.com';                 // a domain address improves deliverability
$W     = 64;                                        // column budget for every line
$DAYS  = 14;                                        // the skyline's span
$ASCII = isset($opts['ascii']);                     // true = never emit a non-7-bit glyph
$DEMO  = isset($opts['demo']);
$SEND  = !isset($opts['no-mail']);
$SITE  = 'https://municipalsky.com';
$PING  = ['/', '/art/junk-drawer/', '/api/health.php'];  // self-check targets
$WEEKLY_DAY = 1;   // ISO weekday that gets the full edition unasked (1 = Monday; 0 = never)
$FULL  = isset($opts['full']) || (!isset($opts['lean']) && $WEEKLY_DAY > 0 && (int) date('N') === $WEEKLY_DAY);

// No visitor geolocation (2026-10-01): the digest used to send each bot
// visitor's IP to ip-api.com (plain HTTP, a third party the privacy policy
// never named) to print a city. Visitor IPs stay on this server.

// Where the VERSION strings live, for the "live builds" line.
$BUILDS = [
    'jukebox' => 'art/prosperos-jukebox-v2/VERSION',
    'zankyo'  => 'art/zankyo/VERSION',
    'kolob'   => 'art/kolob/VERSION',
    'drawer'  => 'art/junk-drawer/VERSION',
    'holler'  => 'art/skeeball/VERSION',
    'babel'   => 'art/rain-of-babel/VERSION',
    'kimi'    => 'art/kimis-take/VERSION',
];

// Pretty names for page_events.page (plus the two derived keys). Unknown
// slugs render as themselves, so a page wired up later still appears.
$PAGE_NAMES = [
    'homepage'               => 'Homepage',
    'junk-drawer'            => 'Junk Drawer',
    'junk-drawer/about'      => 'Junk Drawer / about',
    'junk-drawer-legacy'     => 'Junk Drawer / legacy',
    'prosperos-jukebox-v2'   => "Prospero's Jukebox",
    'prosperos-jukebox'      => 'Jukebox v1 (old)',
    'zankyo'                 => 'ZANKYO',
    'bardo'                  => 'BARDO',
    'kolob'                  => 'KOLOB',
    'underworld-occupations' => 'Underworld Annotated',
    'carbon-structures'      => 'Carbon structures',
    'pronoun'                => 'Pronoun distribution',
    'rain-of-babel'          => 'Rain of Babel',
    'skeeball'               => 'HOLLER ROLLER',
    'kimis-take'             => "Kimi's Take",
    'antariksh'              => 'Antariksh',
    'coinpusher'             => 'SCRIP CREEK',
    'thousand-flowers'       => 'A Thousand Flowers',
    'onomatopoeia-machine'   => 'Onomatopoeia Machine',
    'about'                  => 'About',
    'art'                    => 'Art index',
    'information-graphics'   => 'Info Graphics index',
];

// ─────────────────────────────────────────────────────────────
// Glyphs — one table, two alphabets
// ─────────────────────────────────────────────────────────────
$G = $ASCII ? [
    'full' => '#', 'empty' => '.', 'half' => '=', 'win' => '#', 'today' => ':',
    'ground' => '=', 'rule' => '-', 'dot' => '.', 'bullet' => '*', 'arrow' => '>',
    'up' => '^', 'down' => 'v', 'flat' => '=', 'lt' => '<', 'gt' => '>', 'pin' => '|',
    'spark' => [' ', '.', ':', '-', '=', '+', '*', '#'], 'ok' => 'ok', 'bad' => 'XX',
    'star' => ['*', '.', '+'], 'moon' => ['o', ')', 'O', '('], 'tl' => '+', 'tr' => '+',
    'bl' => '+', 'br' => '+', 'v' => '|', 'h' => '-', 'times' => 'x', 'ellipsis' => '..',
] : [
    'full' => '█', 'empty' => '░', 'half' => '▄', 'win' => '▒', 'today' => '░',
    'ground' => '▀', 'rule' => '─', 'dot' => '·', 'bullet' => '•', 'arrow' => '▸',
    'up' => '▲', 'down' => '▼', 'flat' => '=', 'lt' => '◀', 'gt' => '▶', 'pin' => '┃',
    'spark' => ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'], 'ok' => '✓', 'bad' => '✗',
    'star' => ['*', '·', '+'], 'moon' => ['●', '☽', '○', '☾'], 'tl' => '╭', 'tr' => '╮',
    'bl' => '╰', 'br' => '╯', 'v' => '│', 'h' => '─', 'times' => '×', 'ellipsis' => '…',
];

// ─────────────────────────────────────────────────────────────
// Small helpers (multibyte-safe; every glyph above is one cell wide)
// ─────────────────────────────────────────────────────────────
function mbw($s) { return mb_strlen((string) $s, 'UTF-8'); }
function padr($s, $n) { $s = (string) $s; $k = $n - mbw($s); return $k > 0 ? $s . str_repeat(' ', $k) : $s; }
function padl($s, $n) { $s = (string) $s; $k = $n - mbw($s); return $k > 0 ? str_repeat(' ', $k) . $s : $s; }
function center($s, $n) { $s = (string) $s; $k = max(0, $n - mbw($s)); $l = intdiv($k, 2); return str_repeat(' ', $l) . $s . str_repeat(' ', $k - $l); }
function num($n) { return number_format((float) $n); }
function money($x) { return $x === null ? '—' : '$' . number_format((float) $x, 2); }
function pct($a, $b) { return $b > 0 ? round(100 * $a / $b) . '%' : '—'; }
function trunc($s, $n) { global $G; $e = $G['ellipsis']; $s = trim(preg_replace('/\s+/', ' ', (string) $s)); return mbw($s) > $n ? mb_substr($s, 0, $n - mbw($e), 'UTF-8') . $e : $s; }
function clip($s, $n) { // hard cap on a rendered line, so nothing ever wraps
    return mbw($s) > $n ? mb_substr($s, 0, $n, 'UTF-8') : $s;
}
function hbar($v, $max, $w) { // a horizontal bar, $w cells, filled to v/max
    global $G;
    $n = $max > 0 ? (int) round($w * min($v, $max) / $max) : 0;
    if ($v > 0 && $n === 0) $n = 1;
    return str_repeat($G['full'], $n) . str_repeat($G['empty'], $w - $n);
}
function spark(array $vals, $cell = 1) { // one line of ▁▂▃▄▅▆▇█
    global $G;
    $max = max(1, max($vals ?: [0]));
    $out = '';
    foreach ($vals as $v) {
        $i = $v <= 0 ? 0 : max(1, (int) ceil(7 * $v / $max));
        $out .= str_repeat($G['spark'][$i], $cell);
    }
    return $out;
}
function delta($cur, $prev) { // "▲ +12" / "▼ -3" / "= 0"
    global $G;
    $d = $cur - $prev;
    if ($d > 0) return $G['up'] . ' +' . num($d);
    if ($d < 0) return $G['down'] . ' -' . num(-$d);
    return $G['flat'] . ' 0';
}
function rule($title = '') {
    global $G, $W;
    if ($title === '') return str_repeat($G['rule'], $W);
    $t = ' ' . $title . ' ';
    return str_repeat($G['rule'], 2) . $t . str_repeat($G['rule'], max(0, $W - 2 - mbw($t)));
}
function moon_phase_index($ts) { // 0 new · 1 waxing · 2 full · 3 waning
    $synodic = 29.530588853;
    $age = fmod((($ts - 947182440) / 86400), $synodic); // 2000-01-06 18:14 UTC was new
    if ($age < 0) $age += $synodic;
    $f = $age / $synodic;
    if ($f < 0.0625 || $f >= 0.9375) return 0;
    if ($f < 0.4375) return 1;
    if ($f < 0.5625) return 2;
    return 3;
}
function moon_name($i) { return ['new moon', 'waxing moon', 'full moon', 'waning moon'][$i]; }
function model_label($id) {
    static $labels = null;
    if ($labels === null) {
        $labels = [];
        $tax = json_decode((string) @file_get_contents(__DIR__ . '/../art/junk-drawer/taxonomy.json'), true);
        foreach ($tax['models'] ?? [] as $m) {
            if (isset($m['id'])) $labels[$m['id']] = (string) ($m['label'] ?? $m['id']);
        }
        // onobot's wire strings
        $labels['claude-haiku-4-5-20251001'] = 'Claude Haiku 4.5';
        $labels['gpt-4o-mini'] = 'GPT-4o mini';
    }
    return $labels[$id] ?? $id;
}
function item_title($id) { // a Junk Drawer item id → its entry.json title
    static $cache = [];
    if (!array_key_exists($id, $cache)) {
        $f = __DIR__ . '/../art/junk-drawer/items/' . basename((string) $id) . '/entry.json';
        $e = is_file($f) ? json_decode((string) @file_get_contents($f), true) : null;
        $cache[$id] = is_array($e) && !empty($e['title']) ? (string) $e['title'] : (string) $id;
    }
    return $cache[$id];
}
// Print $items joined by $sep after $label, wrapping onto hanging-indent lines.
function wrap_out(callable $out, $label, array $items, $sep, $width) {
    $indent = str_repeat(' ', mbw($label));
    $line = $label;
    $first = true;
    foreach ($items as $x) {
        $piece = ($first ? '' : $sep) . $x;
        if (!$first && mbw($line) + mbw($piece) > $width) {
            $out(rtrim($line));
            $line = $indent . $x;
        } else {
            $line .= $piece;
        }
        $first = false;
    }
    $out(rtrim($line));
}
// Word-wrap $text after $prefix; continuation lines hang at the prefix width.
function wrap_text(callable $out, $prefix, $text, $width) {
    global $G;
    $indent = str_repeat(' ', mbw($prefix));
    $avail = max(10, $width - mbw($prefix));
    $words = preg_split('/\s+/', trim((string) $text)) ?: [];
    $line = '';
    foreach ($words as $w) {
        if (mbw($w) > $avail) $w = mb_substr($w, 0, $avail - mbw($G['ellipsis']), 'UTF-8') . $G['ellipsis'];
        if ($line !== '' && mbw($line) + 1 + mbw($w) > $avail) {
            $out($prefix . $line);
            $prefix = $indent;
            $line = $w;
        } else {
            $line = $line === '' ? $w : $line . ' ' . $w;
        }
    }
    $out($prefix . $line);
}
// "Claude Opus 5" → "Claude", "GPT-5.1" → "GPT": one word per model, unless
// two models in the set would collide, in which case the full labels stay.
function model_shorts(array $ids) {
    $short = [];
    foreach ($ids as $id) {
        $w = explode(' ', model_label($id))[0];
        $short[$id] = preg_replace('/[-.\d]+$/', '', $w) ?: $w;
    }
    if (count(array_unique($short)) < count($short)) {
        foreach ($ids as $id) $short[$id] = model_label($id);
    }
    return $short;
}
function median(array $xs) {
    if (!$xs) return null;
    sort($xs);
    $n = count($xs);
    return $n % 2 ? $xs[intdiv($n, 2)] : ($xs[$n / 2 - 1] + $xs[$n / 2]) / 2;
}

// ─────────────────────────────────────────────────────────────
// Which pages count: the ones the section indexes show right now
// ─────────────────────────────────────────────────────────────
// Owner's rule (2026-10-01): a page that is not publicly listed on /art/ or
// /information-graphics/ stays out of the digest. The indexes are read here
// each run, HTML comments stripped first (that is how an entry is hidden), so
// un-commenting an entry is all it takes to bring a page back — history and
// all, if it was being counted. The nav's own pages are always in; the Blog
// (hidden from the nav) never is.
function public_pages(callable $note) {
    $keys  = ['homepage', 'about', 'art', 'information-graphics'];
    // A nested link counts only when it is aliased here to its page_events key
    // (the legacy drawer, /art/junk-drawer/legacy/, logs as 'junk-drawer-legacy').
    $alias = ['gendered-pronouns' => 'pronoun', 'onomatopoeia-machine.php' => 'onomatopoeia-machine',
              'junk-drawer/legacy' => 'junk-drawer-legacy'];
    foreach (['art/index.php', 'information-graphics/index.php'] as $rel) {
        $html = @file_get_contents(__DIR__ . '/../' . $rel);
        if ($html === false) { $note($rel, 'could not be read, so its pages are not in the digest'); continue; }
        $html = preg_replace('/<!--.*?-->/s', '', $html);
        if (preg_match_all('#href="/(?:art|information-graphics|chatbots)/([a-z0-9.-]+(?:/[a-z0-9.-]+)*)/?"#', $html, $m)) {
            foreach ($m[1] as $slug) {
                if (isset($alias[$slug])) $keys[] = $alias[$slug];
                elseif (strpos($slug, '/') === false) $keys[] = $slug;
            }
        }
    }
    return array_values(array_unique($keys));
}
// A page_events key counts when its base slug is public ('junk-drawer/about'
// rides on 'junk-drawer').
function is_public($key, array $public) {
    return in_array(explode('/', (string) $key)[0], $public, true);
}

// ─────────────────────────────────────────────────────────────
// Data — one array, two ways to fill it
// ─────────────────────────────────────────────────────────────
$D = [
    'now'      => date('Y-m-d H:i'),
    'now_short'=> date('H:i T'),
    'tz'       => date('T'),
    'hours'    => $H,
    'daily'    => [],   // [['d'=>'Y-m-d','v'=>int,'u'=>int], ...] oldest → today
    'hourly'   => array_fill(0, 24, 0),
    'weekday'  => array_fill(0, 7, 0),
    'pulse'    => [],   // metric => ['w24','prev','w7','all']
    'pages'    => [],   // key => ['v24','u24','p24','d24','v7','vall','uall','pall','p7']
    'tracks'   => [],   // page => [label => ['p24','p7','pall']]
    'charts'   => [],   // pronoun downloads: [chart => ['d24','dall']]
    'records'  => ['best_v' => 0, 'best_d' => null, 'streak' => 0],
    'onobot'   => ['c24' => 0, 'cprev' => 0, 'c7' => 0, 'call' => 0, 'cf24' => 0, 'of24' => 0, 'cfall' => 0, 'ofall' => 0,
                   'f24' => 0, 'fall' => 0, 'p24' => ['a' => 0, 'b' => 0, 'n' => 0], 'pall' => ['a' => 0, 'b' => 0, 'n' => 0],
                   'prompts' => [], 'models' => ['a' => '', 'b' => '']],
    'jd'       => ['v24' => 0, 'u24' => 0, 'av24' => 0, 'io24' => 0, 'vall' => 0, 'uall' => 0, 'ioall' => 0,
                   'funnel' => ['open' => 0, 'submit' => 0, 'done' => 0, 'err' => 0], 'funnel_all' => ['open' => 0, 'submit' => 0, 'done' => 0, 'err' => 0],
                   'errors24' => [], 'errors7' => [], 'turns' => ['t24' => 0, 'tprev' => 0, 't7' => 0, 'tall' => 0, 'rated' => 0, 'rated24' => 0, 'failed' => 0],
                   'lv24' => 0, 'lu24' => 0, 'lio24' => 0, 'lvall' => 0,
                   'devices' => null, 'returning' => null, 'firsts' => [], 'firsts_n' => 0, 'firsts_n24' => 0,
                   'spend' => [], 'spend_total' => ['w24' => 0.0, 'w7' => 0.0, 'all' => 0.0], 'unpriced' => 0, 'priced' => 0,
                   'health24' => ['ok' => 0, 'failed' => 0, 'rejected' => 0, 'disobeyed' => 0, 'n' => 0],
                   'health7' => ['ok' => 0, 'failed' => 0, 'rejected' => 0, 'disobeyed' => 0, 'n' => 0],
                   'latency7' => [], 'items24' => [], 'prompts' => []],
    'subs'     => ['n24' => 0, 'n7' => 0, 'total' => 0, 'active' => 0, 'rows' => [], 'sources' => []],
    'builds'   => [],
    'ping'     => [],
    'tables'   => [],
    'hidden'   => [],   // tracked pages left out because their index does not list them
    'notes'    => [],   // anything that failed, so a silent zero never hides a broken query
    'queries'  => 0,
];

$note = function ($what, $e) use (&$D) {
    $msg = $e instanceof Throwable ? $e->getMessage() : (string) $e;
    $D['notes'][] = $what . ': ' . trunc($msg, 120);
};
$PUBLIC = public_pages($note);

if ($DEMO) {
    // Synthetic numbers with the right shape — enough to see the layout.
    mt_srand(7);
    for ($i = $DAYS - 1; $i >= 0; $i--) {
        $v = (int) round(28 + 18 * sin($i / 2.1) + mt_rand(0, 14) + ($i === 5 ? 70 : 0));
        if ($i === 0) $v = (int) ($v * 0.3);
        $D['daily'][] = ['d' => date('Y-m-d', strtotime("-$i day")), 'v' => $v, 'u' => (int) round($v * 0.7)];
    }
    foreach (range(0, 23) as $h) $D['hourly'][$h] = (int) round(6 + 30 * max(0, sin(($h - 6) / 24 * M_PI)) + mt_rand(0, 6));
    $D['weekday'] = [142, 131, 155, 149, 120, 88, 95];
    $D['pulse'] = [
        'views'        => ['w24' => 42, 'prev' => 30, 'w7' => 231, 'all' => 4812],
        'visitors'     => ['w24' => 31, 'prev' => 26, 'w7' => 160, 'all' => 3106],
        'plays'        => ['w24' => 7, 'prev' => 9, 'w7' => 38, 'all' => 612],
        'drawer turns' => ['w24' => 3, 'prev' => 3, 'w7' => 11, 'all' => 148],
        'onobot uses'  => ['w24' => 3, 'prev' => 1, 'w7' => 9, 'all' => 420],
        'signups'      => ['w24' => 1, 'prev' => 0, 'w7' => 1, 'all' => 23],
    ];
    $demoPages = ['junk-drawer' => [18, 12, 0, 0, 61, 1204, 900, 0], 'homepage' => [12, 9, 0, 0, 40, 2010, 1500, 0],
        'skeeball' => [5, 4, 3, 0, 22, 278, 190, 118], 'kolob' => [4, 3, 1, 0, 19, 271, 191, 98],
        'prosperos-jukebox-v2' => [4, 4, 3, 0, 15, 188, 138, 88], 'pronoun' => [3, 3, 0, 1, 12, 117, 117, 0],
        'rain-of-babel' => [2, 2, 0, 0, 9, 80, 70, 0], 'art' => [2, 2, 0, 0, 11, 161, 120, 0],
        'zankyo' => [1, 1, 0, 0, 8, 145, 108, 59], 'junk-drawer/about' => [1, 1, 0, 0, 4, 85, 70, 0],
        'onomatopoeia-machine' => [1, 1, 0, 0, 6, 60, 55, 0], 'junk-drawer-legacy' => [3, 3, 0, 0, 14, 22, 19, 0], 'underworld-occupations' => [0, 0, 0, 0, 3, 100, 72, 0],
        'carbon-structures' => [0, 0, 0, 0, 2, 65, 52, 0], 'about' => [0, 0, 0, 0, 3, 44, 40, 0], 'bardo' => [0, 0, 0, 0, 1, 26, 19, 10]];
    foreach ($demoPages as $k => $r) {
        if (!is_public($k, $PUBLIC)) { $D['hidden'][] = $k; continue; }
        $D['pages'][$k] = array_combine(['v24', 'u24', 'p24', 'd24', 'v7', 'vall', 'uall', 'pall'], $r) + ['p7' => (int) ($r[7] / 8)];
    }
    if (is_public('prosperos-jukebox-v2', $PUBLIC)) $D['tracks']['prosperos-jukebox-v2'] = ['library' => ['p24' => 2, 'p7' => 8, 'pall' => 51], 'sycorax' => ['p24' => 1, 'p7' => 4, 'pall' => 22], 'ariel' => ['p24' => 0, 'p7' => 3, 'pall' => 15]];
    $D['charts'] = ['masc-fem-overview' => ['d24' => 1, 'dall' => 14], 'joyce-ulysses' => ['d24' => 0, 'dall' => 8], 'austen-emma' => ['d24' => 0, 'dall' => 7]];
    $D['records'] = ['best_v' => 142, 'best_d' => '2026-08-20', 'streak' => 37];
    $D['onobot'] = array_merge($D['onobot'], ['c24' => 3, 'cprev' => 1, 'c7' => 9, 'call' => 420, 'cf24' => 0, 'of24' => 1, 'cfall' => 6, 'ofall' => 11,
        'f24' => 1, 'fall' => 233, 'p24' => ['a' => 1, 'b' => 0, 'n' => 0], 'pall' => ['a' => 121, 'b' => 88, 'n' => 24],
        'models' => ['a' => 'claude-haiku-4-5-20251001', 'b' => 'gpt-4o-mini'],
        'prompts' => [['timestamp' => date('Y-m-d') . ' 08:12:00', 'user_message' => 'a cat sneezing'],
                      ['timestamp' => date('Y-m-d') . ' 07:40:00', 'user_message' => 'a modem connecting'],
                      ['timestamp' => date('Y-m-d') . ' 01:02:00', 'user_message' => 'the printing press in the basement of the Freeman\'s Journal, as Bloom hears it']]]);
    $D['jd'] = array_merge($D['jd'], ['v24' => 18, 'u24' => 12, 'av24' => 1, 'io24' => 41, 'vall' => 1204, 'uall' => 900, 'ioall' => 3310,
        'lv24' => 3, 'lu24' => 3, 'lio24' => 5, 'lvall' => 22,
        'funnel' => ['open' => 9, 'submit' => 4, 'done' => 3, 'err' => 1], 'funnel_all' => ['open' => 402, 'submit' => 171, 'done' => 148, 'err' => 23],
        'errors24' => ['provider_timeout' => 1], 'errors7' => ['provider_timeout' => 2, 'daily_limit' => 1],
        'turns' => ['t24' => 3, 'tprev' => 3, 't7' => 11, 'tall' => 148, 'rated' => 112, 'rated24' => 2, 'failed' => 4],
        'devices' => 61, 'returning' => 14,
        'firsts' => ['claude-opus-5' => ['f24' => 2, 'fall' => 37], 'gpt-5-1' => ['f24' => 1, 'fall' => 21], 'gemini-3-1-pro' => ['f24' => 0, 'fall' => 20], 'kimi-k3' => ['f24' => 0, 'fall' => 19]],
        'firsts_n' => 97, 'firsts_n24' => 3,
        'spend' => ['claude-opus-5' => ['w24' => 0.21, 'w7' => 1.02, 'all' => 18.40, 'n' => 150], 'gpt-5-1' => ['w24' => 0.09, 'w7' => 0.51, 'all' => 9.10, 'n' => 150],
                    'gemini-3-1-pro' => ['w24' => 0.07, 'w7' => 0.38, 'all' => 6.90, 'n' => 150], 'kimi-k3' => ['w24' => 0.04, 'w7' => 0.22, 'all' => 3.80, 'n' => 150]],
        'spend_total' => ['w24' => 0.41, 'w7' => 2.13, 'all' => 38.20], 'unpriced' => 3, 'priced' => 597,
        'health24' => ['ok' => 11, 'failed' => 1, 'rejected' => 0, 'disobeyed' => 1, 'n' => 12],
        'health7' => ['ok' => 42, 'failed' => 1, 'rejected' => 1, 'disobeyed' => 2, 'n' => 44],
        'latency7' => ['claude-opus-5' => 14200, 'gpt-5-1' => 22000, 'kimi-k3' => 9800, 'gemini-3-1-pro' => 17100],
        'items24' => [['title' => 'Shirt button', 'n' => 3], ['title' => 'Paperclip', 'n' => 2], ['title' => 'Pencil stub', 'n' => 1]],
        'prompts' => [['created' => gmdate('Y-m-d') . ' 21:04:00', 'title' => 'Teapot', 'text' => 'a blue ceramic teapot with a chipped spout, steam curling from it, seen slightly from above on a bare wooden table'],
                      ['created' => gmdate('Y-m-d') . ' 09:31:00', 'title' => null, 'text' => 'a lighthouse at dusk']]]);
    $D['subs'] = ['n24' => 1, 'n7' => 1, 'total' => 23, 'active' => 21, 'rows' => [['created_at' => date('Y-m-d') . ' 19:40:12', 'email' => 'fresh.signup@example.com', 'source' => '/art/junk-drawer/']],
        'sources' => ['/art/junk-drawer/' => 9, '/' => 6, '/art/skeeball/' => 4]];
    $D['builds'] = ['jukebox' => '2.0.0-rc.41', 'zankyo' => '2.0.0-rc.17', 'kolob' => 'v0.36.1', 'drawer' => '1.9.2', 'holler' => '0.5.0', 'babel' => '1.2.0', 'kimi' => '0.3.0'];
    $D['ping'] = ['/' => ['code' => 200, 'ms' => 143], '/art/junk-drawer/' => ['code' => 200, 'ms' => 221], '/api/health.php' => ['code' => 200, 'ms' => 88, 'keys' => ['claude' => true, 'gemini' => true, 'openai' => true]]];
    $D['tables'] = ['page_events' => 4965, 'conversations' => 140, 'jd2_prompts' => 150, 'jd2_generations' => 601, 'jd2_sessions' => 131, 'subscribers' => 24];
} else {
    require __DIR__ . '/database.php';   // provides $pdo
    // The jd2 readers' rules (jd2_current_sessions_for_runs, jd2_standings_for_sessions,
    // jd2_select_in). jd-config.php turns display_errors off for its JSON
    // endpoints; a cron log wants its warnings, so the setting is put back.
    $displayErrors = ini_get('display_errors');
    require_once __DIR__ . '/jd2-config.php';
    ini_set('display_errors', (string) $displayErrors);

    $q  = function ($sql) use ($pdo, &$D) { $D['queries']++; return $pdo->query($sql)->fetchAll(); };
    $q1 = function ($sql) use ($pdo, &$D) { $D['queries']++; return $pdo->query($sql)->fetch() ?: []; };
    $i  = function ($row, $k) { return (int) ($row[$k] ?? 0); };
    $has = function ($table) use ($pdo) { return (bool) $pdo->query("SHOW TABLES LIKE " . $pdo->quote($table))->fetchColumn(); };

    // Rolling windows. page_events / pronoun / subscribers / onobot stamp rows
    // in server time (NOW()); the jd2_* tables stamp UTC (UTC_TIMESTAMP()).
    $win = function ($col, $now = 'NOW()') use ($H) {
        return [
            'w24'  => "($col >= $now - INTERVAL $H HOUR)",
            'prev' => "($col >= $now - INTERVAL " . (2 * $H) . " HOUR AND $col < $now - INTERVAL $H HOUR)",
            'w7'   => "($col >= $now - INTERVAL 7 DAY)",
        ];
    };
    $wv = $win('created_at');
    $wj = $win('p.created', 'UTC_TIMESTAMP()');   // on jd2_prompts p

    $hasPronoun = false;
    try { $hasPronoun = $has('pronoun_viz_events') && is_public('pronoun', $PUBLIC); } catch (PDOException $e) { $note('pronoun table check', $e); }
    // The public filter, applied to every page_events read below.
    $pub = 'page IN (' . implode(', ', array_map([$pdo, 'quote'], $PUBLIC)) . ')';
    // Every page view the site counts, as one stream (the two tables share
    // msky_visitor_hash(), so COUNT(DISTINCT) across them is honest).
    $views = "(SELECT created_at, visitor_hash FROM page_events WHERE event_type = 'page_view' AND $pub"
           . ($hasPronoun ? " UNION ALL SELECT created_at, visitor_hash FROM pronoun_viz_events WHERE event_type = 'page_view'" : '')
           . ") v";
    try {
        foreach ($q("SELECT DISTINCT page FROM page_events WHERE NOT $pub ORDER BY page") as $r) $D['hidden'][] = $r['page'];
    } catch (PDOException $e) { $note('hidden pages', $e); }

    // ── skyline · rhythm · records ───────────────────────────
    try {
        $byDay = [];
        foreach ($q("SELECT DATE(created_at) d, COUNT(*) v, COUNT(DISTINCT visitor_hash) u FROM $views
                     WHERE created_at >= CURDATE() - INTERVAL " . ($DAYS - 1) . " DAY GROUP BY d") as $r) {
            $byDay[$r['d']] = $r;
        }
        for ($k = $DAYS - 1; $k >= 0; $k--) {
            $d = date('Y-m-d', strtotime("-$k day"));
            $D['daily'][] = ['d' => $d, 'v' => $i($byDay[$d] ?? [], 'v'), 'u' => $i($byDay[$d] ?? [], 'u')];
        }
        foreach ($q("SELECT HOUR(created_at) h, COUNT(*) v FROM $views WHERE {$wv['w7']} GROUP BY h") as $r) $D['hourly'][(int) $r['h']] = (int) $r['v'];
        foreach ($q("SELECT WEEKDAY(created_at) wd, COUNT(*) v FROM $views WHERE created_at >= CURDATE() - INTERVAL 56 DAY GROUP BY wd") as $r) $D['weekday'][(int) $r['wd']] = (int) $r['v'];
        $best = $q1("SELECT DATE(created_at) d, COUNT(*) v FROM $views GROUP BY d ORDER BY v DESC, d DESC LIMIT 1");
        $D['records']['best_v'] = $i($best, 'v');
        $D['records']['best_d'] = $best['d'] ?? null;
        $days = array_column($q("SELECT DISTINCT DATE(created_at) d FROM $views WHERE created_at >= CURDATE() - INTERVAL 400 DAY ORDER BY d DESC"), 'd');
        $set = array_flip($days);
        $cursor = isset($set[date('Y-m-d')]) ? date('Y-m-d') : date('Y-m-d', strtotime('-1 day'));
        $streak = 0;
        while (isset($set[$cursor])) { $streak++; $cursor = date('Y-m-d', strtotime("$cursor -1 day")); }
        $D['records']['streak'] = $streak;
    } catch (PDOException $e) { $note('daily/hourly views', $e); }

    // ── pulse ────────────────────────────────────────────────
    try {
        $r = $q1("SELECT SUM({$wv['w24']}) w24, SUM({$wv['prev']}) prev, SUM({$wv['w7']}) w7, COUNT(*) `all`,
                         COUNT(DISTINCT CASE WHEN {$wv['w24']} THEN visitor_hash END) u24,
                         COUNT(DISTINCT CASE WHEN {$wv['prev']} THEN visitor_hash END) uprev,
                         COUNT(DISTINCT CASE WHEN {$wv['w7']} THEN visitor_hash END) u7,
                         COUNT(DISTINCT visitor_hash) uall
                  FROM $views");
        $D['pulse']['views']    = ['w24' => $i($r, 'w24'), 'prev' => $i($r, 'prev'), 'w7' => $i($r, 'w7'), 'all' => $i($r, 'all')];
        $D['pulse']['visitors'] = ['w24' => $i($r, 'u24'), 'prev' => $i($r, 'uprev'), 'w7' => $i($r, 'u7'), 'all' => $i($r, 'uall')];
        $r = $q1("SELECT SUM({$wv['w24']}) w24, SUM({$wv['prev']}) prev, SUM({$wv['w7']}) w7, COUNT(*) `all` FROM page_events WHERE event_type = 'play' AND $pub");
        $D['pulse']['plays'] = ['w24' => $i($r, 'w24'), 'prev' => $i($r, 'prev'), 'w7' => $i($r, 'w7'), 'all' => $i($r, 'all')];
    } catch (PDOException $e) { $note('pulse', $e); }

    // ── pages ────────────────────────────────────────────────
    try {
        $sql = "SELECT CASE WHEN page = 'junk-drawer' AND event_type = 'page_view' AND label = 'about' THEN 'junk-drawer/about'
                            ELSE page END pg,
                       SUM(event_type = 'page_view' AND {$wv['w24']}) v24,
                       COUNT(DISTINCT CASE WHEN event_type = 'page_view' AND {$wv['w24']} THEN visitor_hash END) u24,
                       SUM(event_type = 'play' AND {$wv['w24']}) p24,
                       SUM(event_type = 'png_download' AND {$wv['w24']}) d24,
                       SUM(event_type = 'page_view' AND {$wv['w7']}) v7,
                       SUM(event_type = 'play' AND {$wv['w7']}) p7,
                       SUM(event_type = 'page_view') vall,
                       COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) uall,
                       SUM(event_type = 'play') pall
                FROM page_events WHERE $pub GROUP BY pg";
        foreach ($q($sql) as $r) {
            $D['pages'][$r['pg']] = ['v24' => $i($r, 'v24'), 'u24' => $i($r, 'u24'), 'p24' => $i($r, 'p24'), 'd24' => $i($r, 'd24'),
                                     'v7' => $i($r, 'v7'), 'p7' => $i($r, 'p7'), 'vall' => $i($r, 'vall'), 'uall' => $i($r, 'uall'), 'pall' => $i($r, 'pall')];
        }
        foreach ($q("SELECT page, label, SUM({$wv['w24']}) p24, SUM({$wv['w7']}) p7, COUNT(*) pall
                     FROM page_events WHERE event_type = 'play' AND label IS NOT NULL AND $pub GROUP BY page, label ORDER BY pall DESC") as $r) {
            $D['tracks'][$r['page']][$r['label']] = ['p24' => $i($r, 'p24'), 'p7' => $i($r, 'p7'), 'pall' => $i($r, 'pall')];
        }
    } catch (PDOException $e) { $note('pages', $e); }
    if ($hasPronoun) {
        try {
            $r = $q1("SELECT SUM(event_type = 'page_view' AND {$wv['w24']}) v24,
                             COUNT(DISTINCT CASE WHEN event_type = 'page_view' AND {$wv['w24']} THEN visitor_hash END) u24,
                             SUM(event_type = 'png_download' AND {$wv['w24']}) d24,
                             SUM(event_type = 'page_view' AND {$wv['w7']}) v7,
                             SUM(event_type = 'page_view') vall,
                             COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) uall,
                             SUM(event_type = 'png_download') dall
                      FROM pronoun_viz_events");
            $D['pages']['pronoun'] = ['v24' => $i($r, 'v24'), 'u24' => $i($r, 'u24'), 'p24' => 0, 'd24' => $i($r, 'd24'), 'v7' => $i($r, 'v7'), 'p7' => 0,
                                      'vall' => $i($r, 'vall'), 'uall' => $i($r, 'uall'), 'pall' => 0, 'dall' => $i($r, 'dall')];
            foreach ($q("SELECT chart_name, SUM({$wv['w24']}) d24, COUNT(*) dall FROM pronoun_viz_events
                         WHERE event_type = 'png_download' GROUP BY chart_name ORDER BY dall DESC LIMIT 6") as $r) {
                $D['charts'][(string) ($r['chart_name'] ?? '(unnamed)')] = ['d24' => $i($r, 'd24'), 'dall' => $i($r, 'dall')];
            }
        } catch (PDOException $e) { $note('pronoun page', $e); }
    }

    // ── onobot ───────────────────────────────────────────────
    $wo = $win('timestamp');
    try {
        $r = $q1("SELECT SUM({$wo['w24']}) c24, SUM({$wo['prev']}) cprev, SUM({$wo['w7']}) c7, COUNT(*) `call`,
                         SUM({$wo['w24']} AND claude_response IS NULL) cf24, SUM({$wo['w24']} AND openai_response IS NULL) of24,
                         SUM(claude_response IS NULL) cfall, SUM(openai_response IS NULL) ofall
                  FROM conversations");
        foreach (['c24', 'cprev', 'c7', 'call', 'cf24', 'of24', 'cfall', 'ofall'] as $k) $D['onobot'][$k] = $i($r, $k);
        $D['pulse']['onobot uses'] = ['w24' => $i($r, 'c24'), 'prev' => $i($r, 'cprev'), 'w7' => $i($r, 'c7'), 'all' => $i($r, 'call')];
        // Every prompt of the day, from the conversations table (so unrated
        // uses are included). The prompt only — no responses, no rating.
        $D['onobot']['prompts'] = $q("SELECT timestamp, user_message FROM conversations WHERE {$wo['w24']} ORDER BY timestamp DESC");
    } catch (PDOException $e) { $note('onobot conversations', $e); }
    try {
        $r = $q1("SELECT SUM({$wo['w24']}) f24, COUNT(*) fall,
                         SUM({$wo['w24']} AND preference_rating <= 3) a24, SUM({$wo['w24']} AND preference_rating >= 5) b24, SUM({$wo['w24']} AND preference_rating = 4) n24,
                         SUM(preference_rating <= 3) aall, SUM(preference_rating >= 5) ball, SUM(preference_rating = 4) nall
                  FROM onomatopoeia_feedback");
        $D['onobot']['f24'] = $i($r, 'f24'); $D['onobot']['fall'] = $i($r, 'fall');
        $D['onobot']['p24'] = ['a' => $i($r, 'a24'), 'b' => $i($r, 'b24'), 'n' => $i($r, 'n24')];
        $D['onobot']['pall'] = ['a' => $i($r, 'aall'), 'b' => $i($r, 'ball'), 'n' => $i($r, 'nall')];
        $m = $q1("SELECT model_a, model_b FROM onomatopoeia_feedback ORDER BY timestamp DESC LIMIT 1");
        $D['onobot']['models'] = ['a' => (string) ($m['model_a'] ?? ''), 'b' => (string) ($m['model_b'] ?? '')];
    } catch (PDOException $e) { $note('onobot feedback', $e); }

    // ── junk drawer ──────────────────────────────────────────
    // The drawer logs to page_events under page='junk-drawer' (jd-core.js JD_track):
    // page_view with label NULL for the drawer itself and 'about' for /about/,
    // item_open (label = the item id: a jd2_prompts id, or a legacy item's
    // folder), and turn_open / turn_submit / turn_complete (label = the winner) /
    // turn_error (label = the error code). The legacy exhibit
    // (/art/junk-drawer/legacy/) logs page_view and item_open under its own key,
    // 'junk-drawer-legacy', so it never counts as the v2 drawer.
    //
    // Everything else reads dataset v2 (db/junk-drawer-v2-schema.md) and never
    // a jd_* table: the v1 tables are frozen (JD_V1_FROZEN, 2026-10-01). A
    // visitor prompt is a jd2_prompts row with origin = 'visitor'; it is RATED
    // when a filed visitor session sits on one of its runs. All jd2 stamps are UTC.
    try {
        $r = $q1("SELECT SUM(event_type = 'page_view' AND (label IS NULL OR label <> 'about') AND {$wv['w24']}) v24,
                         COUNT(DISTINCT CASE WHEN event_type = 'page_view' AND (label IS NULL OR label <> 'about') AND {$wv['w24']} THEN visitor_hash END) u24,
                         SUM(event_type = 'page_view' AND label = 'about' AND {$wv['w24']}) av24,
                         SUM(event_type = 'item_open' AND {$wv['w24']}) io24,
                         SUM(event_type = 'page_view' AND (label IS NULL OR label <> 'about')) vall,
                         COUNT(DISTINCT CASE WHEN event_type = 'page_view' AND (label IS NULL OR label <> 'about') THEN visitor_hash END) uall,
                         SUM(event_type = 'item_open') ioall,
                         SUM(event_type = 'turn_open' AND {$wv['w24']}) o24, SUM(event_type = 'turn_submit' AND {$wv['w24']}) s24,
                         SUM(event_type = 'turn_complete' AND {$wv['w24']}) d24, SUM(event_type = 'turn_error' AND {$wv['w24']}) e24,
                         SUM(event_type = 'turn_open') oall, SUM(event_type = 'turn_submit') sall,
                         SUM(event_type = 'turn_complete') dall, SUM(event_type = 'turn_error') eall
                  FROM page_events WHERE page = 'junk-drawer'");
        foreach (['v24', 'u24', 'av24', 'io24', 'vall', 'uall', 'ioall'] as $k) $D['jd'][$k] = $i($r, $k);
        $D['jd']['funnel']     = ['open' => $i($r, 'o24'), 'submit' => $i($r, 's24'), 'done' => $i($r, 'd24'), 'err' => $i($r, 'e24')];
        $D['jd']['funnel_all'] = ['open' => $i($r, 'oall'), 'submit' => $i($r, 'sall'), 'done' => $i($r, 'dall'), 'err' => $i($r, 'eall')];
        foreach (['errors24' => $wv['w24'], 'errors7' => $wv['w7']] as $key => $window) {
            foreach ($q("SELECT COALESCE(label, '(unlabelled)') l, COUNT(*) n FROM page_events
                         WHERE page = 'junk-drawer' AND event_type = 'turn_error' AND $window GROUP BY l ORDER BY n DESC") as $e) {
                $D['jd'][$key][$e['l']] = (int) $e['n'];
            }
        }
        $opened = $q("SELECT label, COUNT(*) n FROM page_events WHERE page = 'junk-drawer' AND event_type = 'item_open'
                      AND label IS NOT NULL AND {$wv['w24']} GROUP BY label ORDER BY n DESC LIMIT 5");
        // A v2 item id is its jd2_prompts id: its title is the prompt's.
        $titles = [];
        $ulids = array_values(array_filter(array_column($opened, 'label'), function ($l) { return (bool) preg_match(JD_ULID_RE, (string) $l); }));
        if ($ulids) {
            try {
                foreach (jd2_select_in($pdo, "SELECT id, title FROM jd2_prompts WHERE id IN ({ids})", $ulids) as $t) {
                    if ((string) ($t['title'] ?? '') !== '') $titles[(string) $t['id']] = (string) $t['title'];
                }
            } catch (PDOException $e) { $note('drawer item titles', $e); }
        }
        foreach ($opened as $e) {
            $D['jd']['items24'][] = ['title' => $titles[(string) $e['label']] ?? item_title($e['label']), 'n' => (int) $e['n']];
        }
        $r = $q1("SELECT SUM(event_type = 'page_view' AND {$wv['w24']}) lv24,
                         COUNT(DISTINCT CASE WHEN event_type = 'page_view' AND {$wv['w24']} THEN visitor_hash END) lu24,
                         SUM(event_type = 'item_open' AND {$wv['w24']}) lio24,
                         SUM(event_type = 'page_view') lvall
                  FROM page_events WHERE page = 'junk-drawer-legacy'");
        foreach (['lv24', 'lu24', 'lio24', 'lvall'] as $k) $D['jd'][$k] = $i($r, $k);
    } catch (PDOException $e) { $note('drawer events', $e); }
    try {
        // RATED: the visitor finished — a filed visitor session on one of the
        // prompt's runs. FAILED: its initial run settled with no drawing.
        $ratedSql = "EXISTS (SELECT 1 FROM jd2_runs r JOIN jd2_sessions s ON s.run_id = r.id
                             WHERE r.prompt_id = p.id AND s.rater_role = 'visitor' AND s.status = 'filed')";
        $r = $q1("SELECT SUM({$wj['w24']}) t24, SUM({$wj['prev']}) tprev, SUM({$wj['w7']}) t7, COUNT(*) tall,
                         SUM($ratedSql) rated, SUM($ratedSql AND {$wj['w24']}) rated24,
                         SUM(EXISTS (SELECT 1 FROM jd2_runs r WHERE r.prompt_id = p.id AND r.kind = 'initial' AND r.status = 'failed')) failed
                  FROM jd2_prompts p WHERE p.origin = 'visitor'");
        foreach (['t24', 'tprev', 't7', 'tall', 'rated', 'rated24', 'failed'] as $k) $D['jd']['turns'][$k] = $i($r, $k);
        $D['pulse']['drawer turns'] = ['w24' => $i($r, 't24'), 'prev' => $i($r, 'tprev'), 'w7' => $i($r, 't7'), 'all' => $i($r, 'tall')];
        // Every prompt of the day — the words and the accepted title only.
        $D['jd']['prompts'] = $q("SELECT p.created, p.title, p.text FROM jd2_prompts p
                                  WHERE p.origin = 'visitor' AND {$wj['w24']} ORDER BY p.created DESC");
    } catch (PDOException $e) { $note('drawer turns', $e); }
    try {
        $devs = $q("SELECT device_ref, COUNT(DISTINCT DATE(created)) days FROM jd2_prompts
                    WHERE origin = 'visitor' AND device_ref IS NOT NULL GROUP BY device_ref");
        $D['jd']['devices'] = count($devs);
        $D['jd']['returning'] = count(array_filter($devs, function ($d) { return (int) $d['days'] >= 2; }));
    } catch (PDOException $e) { $note('drawer devices', $e); }
    try {
        // First place, VISITOR sittings only (never pooled with the owner's):
        // per run the visitor's current filed session (jd2_current_sessions_for_runs
        // — sessions are append-only, current = latest filed), its rank-1
        // drawing, that drawing's model. The window is the session's filed_at.
        $runIds = array_column($q("SELECT r.id FROM jd2_runs r JOIN jd2_prompts p ON p.id = r.prompt_id WHERE p.origin = 'visitor'"), 'id');
        $sessions = [];
        foreach (jd2_current_sessions_for_runs($pdo, $runIds) as $byRole) {
            if (isset($byRole[JD2_ROLE_VISITOR])) $sessions[(string) $byRole[JD2_ROLE_VISITOR]['id']] = $byRole[JD2_ROLE_VISITOR];
        }
        $firstGen = [];
        foreach (jd2_standings_for_sessions($pdo, array_keys($sessions)) as $sid => $st) {
            foreach ($st['rankings'] as $gid => $rk) {
                if ($rk['rank_pos'] === 1) { $firstGen[$sid] = (string) $gid; break; }
            }
        }
        $modelOf = [];
        foreach (jd2_select_in($pdo, "SELECT id, model_id FROM jd2_generations WHERE id IN ({ids})", array_values($firstGen)) as $g) {
            $modelOf[(string) $g['id']] = (string) $g['model_id'];
        }
        $cut24 = gmdate('Y-m-d H:i:s', time() - $H * 3600);
        $n = 0; $n24 = 0;
        foreach ($firstGen as $sid => $gid) {
            $m = $modelOf[$gid] ?? null;
            if ($m === null) continue;
            $in24 = (string) $sessions[$sid]['filed_at'] >= $cut24;
            if (!isset($D['jd']['firsts'][$m])) $D['jd']['firsts'][$m] = ['f24' => 0, 'fall' => 0];
            $D['jd']['firsts'][$m]['fall']++; $n++;
            if ($in24) { $D['jd']['firsts'][$m]['f24']++; $n24++; }
        }
        uasort($D['jd']['firsts'], function ($a, $b) { return $b['fall'] <=> $a['fall']; });
        $D['jd']['firsts_n'] = $n; $D['jd']['firsts_n24'] = $n24;
    } catch (PDOException $e) { $note('drawer firsts', $e); }
    try {
        // Spend is the cost_usd snapshot each drawing filed with (priced at
        // write time from the provider's own token counts and api/jd-prices.json);
        // no re-pricing here. An unpriced row (priced = 0 or cost_usd NULL) is
        // EXCLUDED from money, never a $0. Every drawing counts, any origin.
        $cut24 = gmdate('Y-m-d H:i:s', time() - $H * 3600);
        $cut7  = gmdate('Y-m-d H:i:s', time() - 7 * 86400);
        $lat = [];
        foreach ($q("SELECT model_id, status, disobedience, latency_ms, cost_usd, priced, created FROM jd2_generations") as $g) {
            $m = (string) $g['model_id'];
            $is24 = $g['created'] >= $cut24; $is7 = $g['created'] >= $cut7;
            if ((int) $g['priced'] !== 1 || $g['cost_usd'] === null) {
                $D['jd']['unpriced']++;
            } else {
                $D['jd']['priced']++;
                if (!isset($D['jd']['spend'][$m])) $D['jd']['spend'][$m] = ['w24' => 0.0, 'w7' => 0.0, 'all' => 0.0, 'n' => 0];
                $usd = (float) $g['cost_usd'];
                $D['jd']['spend'][$m]['all'] += $usd; $D['jd']['spend'][$m]['n']++;
                $D['jd']['spend_total']['all'] += $usd;
                if ($is7)  { $D['jd']['spend'][$m]['w7']  += $usd; $D['jd']['spend_total']['w7']  += $usd; }
                if ($is24) { $D['jd']['spend'][$m]['w24'] += $usd; $D['jd']['spend_total']['w24'] += $usd; }
            }
            $st = (string) $g['status'];
            foreach (['health7' => $is7, 'health24' => $is24] as $hk => $in) {
                if (!$in) continue;
                $D['jd'][$hk]['n']++;
                if (isset($D['jd'][$hk][$st])) $D['jd'][$hk][$st]++;
                if ((int) $g['disobedience'] === 1) $D['jd'][$hk]['disobeyed']++;
            }
            if ($is7 && $st === 'ok' && $g['latency_ms'] !== null) $lat[$m][] = (int) $g['latency_ms'];
        }
        uasort($D['jd']['spend'], function ($a, $b) { return $b['all'] <=> $a['all']; });
        foreach ($lat as $m => $xs) $D['jd']['latency7'][$m] = median($xs);
    } catch (PDOException $e) { $note('drawer spend', $e); }

    // ── signups ──────────────────────────────────────────────
    try {
        $r = $q1("SELECT COUNT(*) total, SUM(status = 'subscribed') active, SUM({$wv['w24']}) n24, SUM({$wv['w7']}) n7 FROM subscribers");
        $D['subs'] = ['total' => $i($r, 'total'), 'active' => $i($r, 'active'), 'n24' => $i($r, 'n24'), 'n7' => $i($r, 'n7'), 'rows' => [], 'sources' => []];
        $D['subs']['rows'] = $q("SELECT email, source, created_at FROM subscribers WHERE {$wv['w24']} ORDER BY created_at DESC");
        foreach ($q("SELECT COALESCE(NULLIF(source, ''), '(unknown)') s, COUNT(*) n FROM subscribers GROUP BY s ORDER BY n DESC LIMIT 5") as $s) {
            $D['subs']['sources'][$s['s']] = (int) $s['n'];
        }
        $prevSubs = $q1("SELECT SUM({$wv['prev']}) p FROM subscribers");
        $D['pulse']['signups'] = ['w24' => $D['subs']['n24'], 'prev' => $i($prevSubs, 'p'), 'w7' => $D['subs']['n7'], 'all' => $D['subs']['total']];
    } catch (PDOException $e) {
        // subscribers is created lazily on the first signup; absence = none yet.
        $D['pulse']['signups'] = ['w24' => 0, 'prev' => 0, 'w7' => 0, 'all' => 0];
    }

    // ── the plant ────────────────────────────────────────────
    foreach ($BUILDS as $k => $rel) {
        $v = trim((string) @file_get_contents(__DIR__ . '/../' . $rel));
        if ($v !== '') $D['builds'][$k] = trim(explode('—', $v)[0]);
    }
    foreach ($PING as $path) {
        $t = microtime(true);
        $ctx = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true, 'user_agent' => 'msky-digest/2'], 'ssl' => ['verify_peer' => true]]);
        $body = @file_get_contents($SITE . $path, false, $ctx);
        $ms = (int) round((microtime(true) - $t) * 1000);
        $code = 0;
        if (!empty($http_response_header[0]) && preg_match('#HTTP/\S+\s+(\d{3})#', $http_response_header[0], $mm)) $code = (int) $mm[1];
        $row = ['code' => $code, 'ms' => $ms];
        if ($path === '/api/health.php' && $body !== false) {
            $j = json_decode($body, true);
            if (is_array($j)) $row['keys'] = $j;
        }
        $D['ping'][$path] = $row;
    }
    // Table sizes show growth, so only tables that still grow are listed: the
    // frozen v1 jd_* tables (2026-10-01) would print the same number forever.
    foreach (['page_events', 'pronoun_viz_events', 'conversations', 'onomatopoeia_feedback', 'jd2_prompts', 'jd2_generations', 'jd2_sessions', 'subscribers'] as $t) {
        try { $D['tables'][$t] = (int) $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn(); $D['queries']++; } catch (PDOException $e) { /* absent is fine */ }
    }
}

// ─────────────────────────────────────────────────────────────
// Render — every line clipped to $W columns. $FULL opens the slow-moving
// blocks; without it only what changed today is printed.
// ─────────────────────────────────────────────────────────────
$L = [];
$out = function ($s = '') use (&$L, $W) { $L[] = clip(rtrim($s), $W); };
$pulse = $D['pulse'];
$pv = function ($m, $k) use ($pulse) { return (int) ($pulse[$m][$k] ?? 0); };
$sep = ' ' . $G['dot'] . ' ';

// ── masthead ──
$moonIdx = moon_phase_index(time());
$dateLine = date('D j M Y');
$inner = $W - 2;
$edition = $FULL ? (isset($opts['full']) ? 'the long version' : 'the Monday edition') : 'the morning digest';
$out($G['tl'] . str_repeat($G['h'], $inner) . $G['tr']);
$out($G['v'] . ' ' . padr('M U N I C I P A L   S K Y', $inner - 2 - mbw($dateLine) - 1) . $dateLine . ' ' . $G['v']);
$sub = $edition . $sep . $D['hours'] . 'h to ' . $D['now_short'];
$moonTxt = $G['moon'][$moonIdx] . ' ' . moon_name($moonIdx);
$out($G['v'] . ' ' . padr($sub, $inner - 2 - mbw($moonTxt) - 1) . $moonTxt . ' ' . $G['v']);
$out($G['bl'] . str_repeat($G['h'], $inner) . $G['br']);

// ── the skyline: 14 days of views as a city ──
$series = array_map(function ($d) { return (int) $d['v']; }, $D['daily']);
$n = count($series);
if ($n > 0) {
    $out();
    $out(' THE SKYLINE' . $sep . 'page views, last ' . $n . ' days (today ' . $G['today'] . ' still rising)');
    $height = 7; $cw = 3; $gap = 1; $left = 2;
    $max = max(1, max($series));
    $rows = [];
    for ($r = $height - 1; $r >= 0; $r--) {       // r = row from the bottom
        $line = str_repeat(' ', $left);
        foreach ($series as $k => $v) {
            $h = $v > 0 ? max(1, (int) round(2 * $height * $v / $max)) : 0;   // in half-rows
            $today = ($k === $n - 1);
            if ($h >= 2 * ($r + 1)) {
                $body = $today ? str_repeat($G['today'], $cw) : (($r % 2 === 1) ? $G['full'] . $G['win'] . $G['full'] : str_repeat($G['full'], $cw));
            } elseif ($h === 2 * $r + 1) {
                $body = str_repeat($today ? $G['today'] : $G['half'], $cw);
            } else {
                $body = str_repeat(' ', $cw);
            }
            $line .= $body . str_repeat(' ', $gap);
        }
        $rows[$height - 1 - $r] = rtrim($line, ' ');
    }
    // sky: a few stars and the moon, only where there is no building
    $skyW = $left + $n * ($cw + $gap);
    $seed = crc32(date('Y-m-d'));
    for ($st = 0; $st < 11; $st++) {
        $seed = ($seed * 1103515245 + 12345) & 0x7fffffff;
        $rr = $seed % max(1, $height - 2);                  // the upper rows only
        $cc = $left + (($seed >> 8) % max(1, $skyW - $left));
        $row = padr($rows[$rr], $skyW);
        if (mb_substr($row, $cc, 1, 'UTF-8') === ' ' && mb_substr($row, max(0, $cc - 1), 1, 'UTF-8') === ' ') {
            $rows[$rr] = rtrim(mb_substr($row, 0, $cc, 'UTF-8') . $G['star'][$st % 3] . mb_substr($row, $cc + 1, null, 'UTF-8'));
        }
    }
    $mc = $left + ($n - 2) * ($cw + $gap) - 1;              // the gap before the last-but-one tower
    $row = padr($rows[0], $skyW);
    if (mb_substr($row, $mc, 1, 'UTF-8') === ' ') $rows[0] = rtrim(mb_substr($row, 0, $mc, 'UTF-8') . $G['moon'][$moonIdx] . mb_substr($row, $mc + 1, null, 'UTF-8'));
    foreach ($rows as $line) $out($line);
    $out(str_repeat(' ', $left) . str_repeat($G['ground'], $n * ($cw + $gap) - $gap));
    $dd = str_repeat(' ', $left); $vv = str_repeat(' ', $left); $ww = str_repeat(' ', $left);
    foreach ($D['daily'] as $k => $d) {
        $ts = strtotime($d['d']);
        $dd .= padr(date('j', $ts), $cw + $gap);
        $vv .= padr($d['v'] >= 1000 ? (string) round($d['v'] / 1000, 1) . 'k' : (string) $d['v'], $cw + $gap);
        $wd = date('D', $ts);
        $ww .= padr(in_array($wd, ['Sat', 'Sun'], true) ? strtolower(substr($wd, 0, 2)) : substr($wd, 0, 2), $cw + $gap);
    }
    $out($dd); $out($ww); $out($vv);
    if ($FULL) {
        $peak = max($series);
        $peakDay = $D['daily'][array_search($peak, $series, true)]['d'] ?? '';
        $out(str_repeat(' ', $left) . 'tallest ' . num($peak) . ' on ' . date('D j M', strtotime($peakDay)) . $sep . num(array_sum($series)) . ' views in ' . $n . ' days');
    }
}

// ── the pulse ──
$out();
$out(rule('THE PULSE'));
$prow = function ($a, $b, $c, $d, $e) { return ' ' . padr($a, 15) . padl($b, 6) . '   ' . padr($c, 9) . padl($d, 7) . padl($e, 10); };
$out($prow('', $D['hours'] . 'h', 'vs prev', '7d', 'all-time'));
foreach (['views', 'visitors', 'plays', 'drawer turns', 'onobot uses', 'signups'] as $m) {
    $out($prow($m, num($pv($m, 'w24')), delta($pv($m, 'w24'), $pv($m, 'prev')), num($pv($m, 'w7')), num($pv($m, 'all'))));
}
$rec = $D['records'];
$bits = [];
$recent = [date('Y-m-d'), date('Y-m-d', strtotime('-1 day'))];
if ($rec['best_v'] > 0 && in_array($rec['best_d'], $recent, true)) {
    $bits[] = $G['star'][0] . ' new best day: ' . num($rec['best_v']) . ' views ' . ($rec['best_d'] === $recent[0] ? 'today, still counting' : 'yesterday');
} elseif ($FULL && $rec['best_v'] > 0) {
    $bits[] = 'best day ' . num($rec['best_v']) . ' (' . date('j M', strtotime($rec['best_d'])) . ')';
}
if ($rec['streak'] > 0) $bits[] = 'streak ' . num($rec['streak']) . ' day' . ($rec['streak'] === 1 ? '' : 's') . ' with a visitor';
if ($FULL && $pv('views', 'all') > 0 && $pv('signups', 'all') > 0) $bits[] = '1 signup per ' . num(round($pv('views', 'all') / $pv('signups', 'all'))) . ' views';
if ($bits) wrap_out($out, ' ', $bits, $sep, $W);

// ── pages ──
$pages = array_filter($D['pages'], function ($k) use ($PUBLIC) { return is_public($k, $PUBLIC); }, ARRAY_FILTER_USE_KEY);
uasort($pages, function ($a, $b) { return [$b['v24'], $b['v7'], $b['vall']] <=> [$a['v24'], $a['v7'], $a['vall']]; });
if ($pages) {
    $out();
    $out(rule('PAGES'));
    $out(' ' . padr('', 20) . ' ' . padr('views ' . $D['hours'] . 'h', 12) . padl('v', 5) . padl('uniq', 5) . padl('plays', 6) . padl('7d', 6) . padl('all', 8));
    $maxV = max(1, max(array_column($pages, 'v24')));
    $quiet = [];
    foreach ($pages as $k => $p) {
        $name = $PAGE_NAMES[$k] ?? $k;
        if ($p['v24'] === 0 && $p['v7'] === 0) { $quiet[] = $name . ' ' . num($p['vall']); continue; }
        $plays = $p['pall'] > 0 ? num($p['p24']) : '';
        $out(' ' . padr(trunc($name, 20), 20) . ' ' . hbar($p['v24'], $maxV, 12) . padl(num($p['v24']), 5) . padl(num($p['u24']), 5) . padl($plays, 6) . padl(num($p['v7']), 6) . padl(num($p['vall']), 8));
    }
    $pr = $pages['pronoun'] ?? null;
    if ($pr && $pr['d24'] > 0) $out(' ' . padr('Pronoun distribution', 20) . ' ' . num($pr['d24']) . ' chart PNG' . ($pr['d24'] === 1 ? '' : 's') . ' downloaded');
    if ($FULL) {
        if ($quiet) wrap_out($out, ' quiet this week (all-time): ', $quiet, $sep, $W);
        if ($D['hidden']) {
            $hid = array_map(function ($k) use ($PAGE_NAMES) { return $PAGE_NAMES[$k] ?? $k; }, array_unique($D['hidden']));
            wrap_out($out, ' not listed on an index, not counted: ', $hid, $sep, $W);
        }
        $tracked = array_filter(array_keys($pages), function ($k) use ($D) { return !empty($D['tracks'][$k]); });
        if ($tracked) {
            $out(' plays by track, all-time');
            foreach ($tracked as $k) {
                $tr = [];
                foreach ($D['tracks'][$k] as $label => $t) $tr[] = $label . ' ' . num($t['pall']);
                wrap_out($out, '   ' . padr(trunc($PAGE_NAMES[$k] ?? $k, 20), 20) . ' ', $tr, $sep, $W);
            }
        }
        if ($pr && $D['charts']) {
            $ch = [];
            foreach ($D['charts'] as $c => $t) $ch[] = $c . ' ' . num($t['dall']);
            $out(' chart PNGs downloaded, all-time');
            wrap_out($out, '   ', $ch, $sep, $W);
        }
    }
}

// ── the rhythm (full only) ──
if ($FULL && (array_sum($D['hourly']) > 0 || array_sum($D['weekday']) > 0)) {
    $out();
    $out(rule('THE RHYTHM'));
    $lead = ' views by hour of day, last 7 days (' . $D['tz'] . ')';
    $peak = 'peak ' . str_pad((string) array_search(max($D['hourly']), $D['hourly'], true), 2, '0', STR_PAD_LEFT) . ':00 ';
    $out($lead . padl($peak, $W - mbw($lead)));
    $out(' ' . spark($D['hourly'], 2));
    $out(' ' . padr('0h', 12) . padr('6h', 12) . padr('12h', 12) . padr('18h', 12));
    $out(' views by weekday, last 8 weeks');
    $out(' ' . spark($D['weekday'], 3));
    $out(' ' . implode('', array_map(function ($d) { return padr($d, 3); }, ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'])));
}

// ── onobot ──
$o = $D['onobot'];
$out();
$out(rule('ONOBOT' . $sep . 'the onomatopoeia machine'));
$fails = [];
if ($o['cf24'] > 0) $fails[] = 'Claude ' . num($o['cf24']);
if ($o['of24'] > 0) $fails[] = 'GPT ' . num($o['of24']);
$out(' ' . padr($D['hours'] . 'h', 10) . num($o['c24']) . ' uses' . $sep . num($o['f24']) . ' rated' . $sep . 'failures ' . ($fails ? implode($sep, $fails) : 'none'));
if ($FULL) {
    $out(' ' . padr('all-time', 10) . num($o['call']) . ' uses' . $sep . num($o['fall']) . ' rated (' . pct($o['fall'], $o['call']) . ')' . $sep . 'failures Claude ' . num($o['cfall']) . $sep . 'GPT ' . num($o['ofall']));
    $pa = $o['pall']['a']; $pb = $o['pall']['b']; $pn = $o['pall']['n'];
    $tot = $pa + $pb;
    if ($tot > 0) {
        $bw = 24;
        $na = (int) round($bw * $pa / $tot);
        $out(' preference  Claude ' . $G['lt'] . str_repeat($G['full'], $na) . $G['pin'] . str_repeat($G['empty'], $bw - $na) . $G['gt'] . ' GPT  '
            . round(100 * $pa / $tot) . ':' . round(100 * $pb / $tot));
        $out('             all-time Claude ' . num($pa) . $sep . 'GPT ' . num($pb) . $sep . 'neutral ' . num($pn));
        $out('             ' . $D['hours'] . 'h Claude ' . num($o['p24']['a']) . $sep . 'GPT ' . num($o['p24']['b']) . $sep . 'neutral ' . num($o['p24']['n']));
    }
    if ($o['models']['a'] !== '') $out(' pair        A ' . model_label($o['models']['a']) . $sep . 'B ' . model_label($o['models']['b']));
}
if ($o['prompts']) {
    $out(' prompts ' . $D['hours'] . 'h (' . count($o['prompts']) . ')');
    foreach ($o['prompts'] as $r) {
        wrap_text($out, ' ' . $G['bullet'] . ' ' . substr($r['timestamp'], 5, 11) . '  ', $r['user_message'], $W);
    }
}

// ── the junk drawer ──
$j = $D['jd'];
$out();
$out(rule('THE JUNK DRAWER'));
// the about page counts every day, not only in the Monday edition (owner, 2026-10-03)
$out(' ' . padr($D['hours'] . 'h', 12) . num($j['v24']) . ' views' . $sep . num($j['u24']) . ' visitors' . $sep . num($j['io24']) . ' items opened' . $sep . num($j['av24']) . ' about');
if ($FULL) $out(' ' . padr('all-time', 12) . num($j['vall']) . ' views' . $sep . num($j['uall']) . ' visitors' . $sep . num($j['ioall']) . ' items opened');
$out(' ' . padr('legacy ' . $D['hours'] . 'h', 12) . num($j['lv24']) . ' views' . $sep . num($j['lu24']) . ' visitors' . $sep . num($j['lio24']) . ' items opened' . ($FULL ? $sep . 'all ' . num($j['lvall']) : ''));
$f = $j['funnel'];
$fm = max(1, $f['open']);
$out(' ' . padr('funnel ' . $D['hours'] . 'h', 12) . 'opened ' . num($f['open']) . ' ' . $G['arrow'] . ' submitted ' . num($f['submit']) . ' ' . $G['arrow'] . ' completed ' . num($f['done']) . $sep . 'errors ' . num($f['err']));
$out('             ' . hbar($f['open'], $fm, 12) . ' ' . hbar($f['submit'], $fm, 12) . ' ' . hbar($f['done'], $fm, 12));
if ($FULL) {
    $fa = $j['funnel_all'];
    $out(' ' . padr('funnel all', 12) . num($fa['open']) . ' ' . $G['arrow'] . ' ' . num($fa['submit']) . ' (' . pct($fa['submit'], $fa['open']) . ') ' . $G['arrow'] . ' ' . num($fa['done']) . ' (' . pct($fa['done'], $fa['submit']) . ')' . $sep . num($fa['err']) . ' errors');
}
$errs = $FULL ? $j['errors7'] : $j['errors24'];
if ($errs) {
    $e = [];
    foreach ($errs as $k => $cnt) $e[] = $k . ' ' . num($cnt);
    wrap_out($out, ' ' . padr('errors ' . ($FULL ? '7d' : $D['hours'] . 'h'), 12), $e, $sep, $W);
}
$t = $j['turns'];
$out(' ' . padr('turns filed', 12) . $D['hours'] . 'h ' . num($t['t24']) . $sep . '7d ' . num($t['t7']) . ($FULL ? $sep . 'all ' . num($t['tall']) . ' (' . num($t['rated']) . ' rated, ' . num($t['failed']) . ' failed)' : ''));
if ($FULL && $j['devices'] !== null) {
    $out(' ' . padr('devices', 12) . num($j['devices']) . ' have taken a turn' . $sep . num($j['returning']) . ' came back on another day');
}
$st = $j['spend_total'];
if (!$FULL) {
    if ($j['spend']) $out(' ' . padr('spend', 12) . $D['hours'] . 'h ' . money($st['w24']) . $sep . '7d ' . money($st['w7']));
    $h = $j['health24'];
    if ($h['n'] > 0) {
        $out(' ' . padr('drawings', 12) . $D['hours'] . 'h ' . num($h['ok']) . ' ok' . $sep . num($h['failed']) . ' failed' . $sep . num($h['rejected']) . ' rejected' . $sep . num($h['disobeyed']) . ' disobeyed');
    }
} else {
    if ($j['firsts']) {
        $lead = ' FIRST PLACE' . $sep . 'visitor turns, all-time (n=' . num($j['firsts_n']) . ')';
        $out($lead . padl($D['hours'] . 'h', $W - mbw($lead) - 2));
        $fmax = max(1, max(array_column($j['firsts'], 'fall')));
        foreach ($j['firsts'] as $m => $x) {
            $out('   ' . padr(trunc(model_label($m), 16), 16) . ' ' . hbar($x['fall'], $fmax, 14) . padl(pct($x['fall'], $j['firsts_n']), 5) . padl(num($x['fall']), 6) . padl(num($x['f24']), 7));
        }
    }
    if ($j['spend']) {
        $out(' SPEND' . $sep . "exact, from each provider's own token counts");
        $srow = function ($a, $b, $c, $d, $e) { return '   ' . padr($a, 16) . padl($b, 9) . padl($c, 9) . padl($d, 10) . padl($e, 10); };
        $out($srow('', $D['hours'] . 'h', '7d', 'all', 'per gen'));
        foreach ($j['spend'] as $m => $sp) {
            $out($srow(trunc(model_label($m), 16), money($sp['w24']), money($sp['w7']), money($sp['all']), money($sp['n'] > 0 ? $sp['all'] / $sp['n'] : null)));
        }
        $out($srow('total', money($st['w24']), money($st['w7']), money($st['all']), ''));
        if ($j['unpriced'] > 0) $out('   (' . num($j['unpriced']) . ' of ' . num($j['unpriced'] + $j['priced']) . ' generations unpriced, left out)');
    }
    $h = $j['health7'];
    if ($h['n'] > 0) {
        $out(' drawings 7d ' . hbar($h['ok'], $h['n'], 14) . ' ' . pct($h['ok'], $h['n']) . ' ok of ' . num($h['n']));
        $out('             ' . num($h['failed']) . ' failed' . $sep . num($h['rejected']) . ' rejected' . $sep . num($h['disobeyed']) . ' disobeyed the format');
    }
    if ($j['latency7']) {
        $lat = [];
        $short = model_shorts(array_keys($j['latency7']));
        foreach ($j['latency7'] as $m => $ms) $lat[] = $short[$m] . ' ' . sprintf('%.1fs', $ms / 1000);
        wrap_out($out, ' latency p50 ', $lat, $sep, $W);
    }
    if ($j['items24']) {
        $it = [];
        foreach ($j['items24'] as $x) $it[] = $x['title'] . ' ' . $G['times'] . num($x['n']);
        wrap_out($out, ' opened most ', $it, ', ', $W);
    }
}
if ($j['prompts']) {
    // Same shape as the onobot list: time, the prompt, a tail after a dot
    // (there the place, here the accepted title). jd2_* stamps UTC; the time
    // is shown in server time like every other stamp in the digest.
    $out(' prompts ' . $D['hours'] . 'h (' . count($j['prompts']) . ')');
    foreach ($j['prompts'] as $p) {
        try {
            $when = (new DateTime((string) $p['created'], new DateTimeZone('UTC')))
                ->setTimezone(new DateTimeZone(date_default_timezone_get()))->format('m-d H:i');
        } catch (Exception $e) {
            $when = substr((string) $p['created'], 5, 11);
        }
        $title = ($p['title'] !== null && $p['title'] !== '') ? $sep . trunc($p['title'], 40) : '';
        wrap_text($out, ' ' . $G['bullet'] . ' ' . $when . '  ', $p['text'] . $title, $W);
    }
}

// ── signups ──
$sg = $D['subs'];
$out();
$out(rule('SIGNUPS'));
$out(' ' . num($sg['n24']) . ' new in ' . $D['hours'] . 'h' . ($FULL ? $sep . num($sg['n7']) . ' this week' : '') . $sep . num($sg['active']) . ' on the list'
    . ($sg['total'] > $sg['active'] ? ' (' . num($sg['total'] - $sg['active']) . ' unsubscribed)' : ''));
foreach ($sg['rows'] as $r) {
    $out(' ' . $G['bullet'] . ' ' . substr($r['created_at'], 5, 11) . '  ' . trunc($r['email'], 36));
    if (($r['source'] ?? '') !== '') $out('                from ' . trunc($r['source'], $W - 21));
}
if ($FULL && $sg['sources']) {
    $src = [];
    foreach ($sg['sources'] as $k => $cnt) $src[] = $k . ' ' . num($cnt);
    wrap_out($out, ' signed up from  ', $src, $sep, $W);
}

// ── the plant (full) · the daily keeps only what is wrong ──
$notes = $D['notes'];
if (!$FULL) {   // the full edition shows these in THE PLANT itself
    foreach ($D['ping'] as $path => $pg) {
        $ok = $pg['code'] >= 200 && $pg['code'] < 400;
        if (!$ok) $notes[] = 'ping ' . $path . ': ' . ($pg['code'] ? 'HTTP ' . $pg['code'] : 'no reply') . ' after ' . num($pg['ms']) . ' ms';
        foreach ($pg['keys'] ?? [] as $name => $v) if (!$v) $notes[] = 'health: the ' . $name . ' API key is not loaded';
    }
}
if ($FULL) {
    $out();
    $out(rule('THE PLANT'));
    if ($D['builds']) {
        $b = [];
        foreach ($D['builds'] as $k => $v) $b[] = $k . ' ' . $v;
        wrap_out($out, ' live builds  ', $b, $sep, $W);
    }
    foreach ($D['ping'] as $path => $pg) {
        $ok = $pg['code'] >= 200 && $pg['code'] < 400;
        $out(sprintf(' ping         %-20s ', $path) . ($ok ? $G['ok'] : $G['bad']) . ' ' . ($pg['code'] ?: 'no reply') . ' in ' . num($pg['ms']) . ' ms');
        if (!empty($pg['keys'])) {
            $k = [];
            foreach ($pg['keys'] as $name => $v) $k[] = $name . ' ' . ($v ? $G['ok'] : $G['bad']);
            $out('              api keys loaded: ' . implode($sep, $k));
        }
    }
    if ($D['tables']) {
        $tb = [];
        foreach ($D['tables'] as $tn => $cnt) $tb[] = $tn . ' ' . num($cnt);
        wrap_out($out, ' rows         ', $tb, $sep, $W);
    }
}
if ($notes) {
    $out();
    $out(rule('NOTES'));
    foreach ($notes as $nt) $out(' !! ' . $nt);
}

// ── sign-off ──
$home = $D['ping']['/'] ?? null;
$site = $home ? (($home['code'] >= 200 && $home['code'] < 400) ? 'site up, ' . num($home['ms']) . ' ms' : 'site did not answer') : null;
$out();
$out(' ' . str_repeat($G['dot'] . ' ', intdiv($W - 2, 2)));
$tail = [sprintf('built in %.1f s', microtime(true) - $T0)];
if ($site) $tail[] = $site;
if ($DEMO) $tail[] = 'demo data';
if (!$FULL) $tail[] = '--full for more';
$out(' ' . implode($sep, $tail));

$text = implode("\n", $L) . "\n";

// ─────────────────────────────────────────────────────────────
// Subject · HTML · send
// ─────────────────────────────────────────────────────────────
$sparkSubj = $series ? spark(array_slice($series, -7)) : '';
$plural = function ($n, $one, $many) { return num($n) . ' ' . ($n == 1 ? $one : $many); };
$subject = 'Municipal Sky ' . $sparkSubj . ' ' . implode(' ' . $G['dot'] . ' ', [
    $plural($pv('views', 'w24'), 'view', 'views'),
    $plural($pv('drawer turns', 'w24'), 'turn', 'turns'),
    $plural($pv('onobot uses', 'w24'), 'onobot', 'onobot'),
    $plural($pv('signups', 'w24'), 'signup', 'signups'),
    date('D j M'),
]);
$subject = trim(preg_replace('/\s+/', ' ', $subject));

$html = "<!doctype html>\n<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
      . "<title>" . htmlspecialchars($subject, ENT_QUOTES, 'UTF-8') . "</title>"
      // 64 columns at 12px is ~460px; on a phone shrink the type so the whole
      // width fits (pinch to zoom). Clients that strip <style> fall back to a
      // horizontal scroll, never to wrapping.
      . "<style>@media (max-width: 520px) { pre.msky { font-size: 9.4px !important; line-height: 1.3 !important; padding: 8px 6px !important; } }</style>"
      . "</head>\n"
      . "<body style=\"margin:0;padding:14px 10px;background:#f4f1ea;\">\n"
      . "<pre class=\"msky\" style=\"margin:0;padding:12px 10px;background:#fbfaf6;border:1px solid #d9d4c7;color:#1b1b1b;"
      . "font-family:Menlo,Consolas,'DejaVu Sans Mono','Liberation Mono','Courier New',monospace;"
      . "font-size:12px;line-height:1.35;white-space:pre;overflow-x:auto;-webkit-text-size-adjust:100%;\">"
      . htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
      . "</pre>\n</body></html>\n";

if (isset($opts['html']) && $opts['html'] !== false && $opts['html'] !== '') {
    file_put_contents($opts['html'], $html);
    fwrite(STDERR, "html written to {$opts['html']}\n");
}

if (!$SEND) fwrite(STDERR, "subject: {$subject}\n");

if ($SEND) {
    $boundary = 'msky-' . bin2hex(random_bytes(8));
    $headers = "From: Municipal Sky <{$FROM}>\r\n"
             . "Reply-To: {$FROM}\r\n"
             . "MIME-Version: 1.0\r\n"
             . "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";
    // base64 for both parts: UTF-8 safe, no line-ending ambiguity between
    // PHP's mail() and the MTA, and every client decodes it.
    $body = "--{$boundary}\r\n"
          . "Content-Type: text/plain; charset=utf-8\r\n"
          . "Content-Transfer-Encoding: base64\r\n\r\n"
          . chunk_split(base64_encode($text), 76, "\r\n")
          . "--{$boundary}\r\n"
          . "Content-Type: text/html; charset=utf-8\r\n"
          . "Content-Transfer-Encoding: base64\r\n\r\n"
          . chunk_split(base64_encode($html), 76, "\r\n")
          . "--{$boundary}--\r\n";
    $encodedSubject = mb_encode_mimeheader($subject, 'UTF-8', 'B', "\r\n");
    if (!mail($TO, $encodedSubject, $body, $headers)) {
        fwrite(STDERR, "mail() returned false — the digest was not sent\n");
    }
}

// Echo too, so cron logs (or a cPanel cron-email, if you set one) carry it.
echo $text;
