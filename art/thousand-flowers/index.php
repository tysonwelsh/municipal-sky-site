<?php
/**
 * A Thousand Flowers — reader, lofi skin.
 *
 * Live substrate (spool parsing, arrival gating, threading, era dates) with
 * the mockup-lofi aesthetic: paper, mono type, plain links, zero JavaScript.
 * Thread collapse and any toggles use <details>, so the page works in any
 * browser, at any width, forever.
 */

require_once __DIR__ . '/flowers-lib.php';

// Reader session, for the masthead's signed-in state. Same cookie policy as
// account.php; reading never requires an account.
$tf_https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params(array(
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => $tf_https,
));
session_start();
$tf_user = isset($_SESSION['tf_user']) ? $_SESSION['tf_user'] : null;

// Spool in use. Flip to 'spool/' when live traffic begins.
const SPOOL_DIR = 'mockups/sample-spool/';

// Demo clock. Pins "now" so the sample spool's in-transit article stays in
// transit. Set to null to gate against real UTC (required for the live spool).
const FLOWERS_NOW = '2026-08-14T12:00:00Z';

$relay    = flowers_load_relay(__DIR__ . '/relay.json');
$spool    = flowers_load_spool(__DIR__ . '/' . SPOOL_DIR);
$now      = flowers_now(FLOWERS_NOW);
$arrived  = flowers_arrived($spool, $now);
$inbound  = flowers_in_transit($spool, $now, $relay);
$threads  = flowers_build_threads($arrived);

$wanted   = isset($_GET['article']) ? (string) $_GET['article'] : '';
$article  = $wanted !== '' ? flowers_find_article($arrived, $wanted) : null;

// The display parent of an article: the last entry in its References chain
// that is present in the visible set — the same rule the threader uses.
$display_parent = function ($a) use ($arrived) {
    $refs = isset($a['references']) ? $a['references'] : array();
    for ($i = count($refs) - 1; $i >= 0; $i--) {
        if ($refs[$i] !== $a['message_id'] && isset($arrived[$refs[$i]])) {
            return $arrived[$refs[$i]];
        }
    }
    return null;
};

// Thread context for the single-article view: root, prev/next within the
// flattened thread, and the article's direct replies.
$parent = null;
$prev   = null;
$next   = null;
$replies = array();
if ($article !== null) {
    $parent = $display_parent($article);

    // Walk up to the thread root (cycle-safe).
    $root = $article;
    $seen = array($article['message_id'] => true);
    while (($p = $display_parent($root)) !== null && !isset($seen[$p['message_id']])) {
        $seen[$p['message_id']] = true;
        $root = $p;
    }

    foreach ($threads as $t) {
        if ($t['message_id'] === $root['message_id']) {
            $flat = flowers_flatten_thread($t);
            foreach ($flat as $i => $n) {
                if ($n['message_id'] === $article['message_id']) {
                    $prev = $i > 0 ? $flat[$i - 1] : null;
                    $next = $i < count($flat) - 1 ? $flat[$i + 1] : null;
                    break;
                }
            }
            break;
        }
    }

    foreach ($arrived as $a) {
        $p = $display_parent($a);
        if ($p !== null && $p['message_id'] === $article['message_id']) {
            $replies[] = $a;
        }
    }
    usort($replies, function ($x, $y) {
        $xa = $x['arrives'] instanceof DateTimeInterface ? $x['arrives']->getTimestamp() : 0;
        $ya = $y['arrives'] instanceof DateTimeInterface ? $y['arrives']->getTimestamp() : 0;
        return $xa === $ya ? strcmp((string) $x['seq'], (string) $y['seq']) : ($xa <=> $ya);
    });
}

/**
 * Reflow hard-wrapped plaintext for the screen.
 *
 * Spool articles are wrapped by hand at ~72 columns (email convention). If
 * those manual breaks are rendered verbatim inside a wrapping box, any line
 * longer than the box wraps twice — the ragged "staircase" effect. So before
 * rendering, join each paragraph back into one logical line and let CSS wrap
 * it at whatever width the reader has (format=flowed, roughly):
 *
 *   - blank lines end paragraphs (kept as blank lines);
 *   - lines beginning with a space or tab are verbatim (code blocks);
 *   - consecutive quoted lines with the same ">" depth join into one line
 *     carrying a single normalized quote prefix;
 *   - signatures and the Origin line are NOT reflowed (handled by the
 *     library, outside body_lines).
 */
function tf_reflow_lines($lines)
{
    $out = array();
    $buf = '';
    $mode = null; // null between paragraphs, 'plain', or a quote prefix like '>> '
    $flush = function () use (&$out, &$buf, &$mode) {
        if ($mode !== null) {
            $out[] = $buf;
        }
        $buf = '';
        $mode = null;
    };
    foreach ($lines as $line) {
        if (trim($line) === '') {
            $flush();
            $out[] = '';
            continue;
        }
        if ($line[0] === ' ' || $line[0] === "\t") {
            $flush();
            $out[] = $line; // verbatim
            continue;
        }
        if (preg_match('/^((?:>\s*)+)(.*)$/', $line, $m)) {
            $prefix = preg_replace('/\s+/', '', $m[1]) . ' ';
            $text   = trim($m[2]);
            if ($mode !== $prefix) {
                $flush();
                $mode = $prefix;
                $buf  = $prefix . $text;
            } else {
                $buf .= ' ' . $text;
            }
            continue;
        }
        if ($mode !== 'plain') {
            $flush();
            $mode = 'plain';
            $buf  = trim($line);
        } elseif (preg_match('/^[A-Z][^:]{0,29}:\s/', $line)) {
            // "Label: value" ledger lines (minutes, manifests) keep their breaks.
            $flush();
            $mode = 'plain';
            $buf  = trim($line);
        } else {
            $buf .= ' ' . trim($line);
        }
    }
    $flush();
    return $out;
}

$group = $relay['group'];

$page_title = 'A Thousand Flowers — Municipal Sky';
$page_description = 'A deep-space store-and-forward mail relay: threaded traffic between the colonies of ' . $group . '.';
include '../../includes/header.php';
?>

<style>
/* lofi skin — paper, mono, plain links. No glow, no chrome. */
.tf-wrap {
  background: #fffffb;
  color: #111;
  font: 13px/1.5 ui-monospace, "SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", monospace;
  max-width: 96ch;
  margin: 1.5rem auto 3rem;
  padding: 1.5rem 2.5rem 2.5rem;
  border: 1px solid #e3e3da;
}
.tf-wrap a { color: #0000ee; }
.tf-wrap a:visited { color: #551a8b; }
.tf-wrap pre { font: inherit; margin: 0; white-space: pre-wrap; overflow-wrap: break-word; }

.tf-art { white-space: pre; overflow: hidden; margin: 0; }
.tf-masthead h1 { font: inherit; font-weight: bold; margin: 0; }
.tf-masthead { border-bottom: 1px solid #111; padding-bottom: .75rem; margin-bottom: .75rem; }
.tf-status { color: #6f6f6f; }
.tf-rule { border: 0; border-top: 1px solid #111; margin: .75rem 0; }
.tf-dim { color: #6f6f6f; }

/* index: collapsible thread groups */
.tf-thread { margin: 0 0 .75rem; }
.tf-thread > summary { cursor: pointer; list-style-position: outside; }
.tf-thread > summary:hover .tf-subject { text-decoration: underline; }
.tf-replies { list-style: none; margin: .25rem 0 0; padding: 0; }
.tf-replies li { margin: .15rem 0; }
.tf-depth-1 { padding-left: 2ch; }
.tf-depth-2 { padding-left: 4ch; }
.tf-depth-3 { padding-left: 6ch; }
.tf-depth-4 { padding-left: 8ch; }
.tf-depth-5 { padding-left: 10ch; }
.tf-depth-6 { padding-left: 12ch; }
.tf-tag { font-weight: bold; }

.tf-inbound { color: #6f6f6f; margin: 1rem 0; }

/* article view */
.tf-nav { margin: .5rem 0 1rem; }
.tf-nav span + span::before { content: " · "; color: #6f6f6f; }
.tf-article h2 { font: inherit; font-weight: bold; font-size: 1.15em; margin: .5rem 0 .75rem; }
.tf-headers { margin: 0 0 1rem; padding: .5rem 0; border-top: 1px solid #111; border-bottom: 1px solid #111; }
.tf-hdr-name { color: #6f6f6f; }
.tf-hdr-raw { color: #6f6f6f; }
.tf-body { margin: 0; }
.tf-quote { color: #226622; }
.tf-quote-2 { opacity: .85; }
.tf-quote-3 { opacity: .7; }
.tf-sig, .tf-origin { color: #6f6f6f; }
.tf-replylist { margin: 1rem 0 0; padding: .5rem 0 0; border-top: 1px solid #111; }
.tf-replylist ul { list-style: none; margin: .25rem 0 0; padding: 0; }

@media (max-width: 420px) {
  .tf-wrap { font-size: 12px; line-height: 1.45; padding: 1rem .75rem 1.5rem; border: 0; }
}
</style>

<div class="main-wrapper">
<div class="content-frame">
<div class="tf-wrap">

  <div class="tf-masthead">
    <pre class="tf-art">   o             o
    \    \|/    /
  o--    -*-    --o
    /    /|\    \
   o             o</pre>
    <h1>A THOUSAND FLOWERS</h1>
    <pre><?php echo flowers_e($group); ?> &middot; store-and-forward relay 21:1/0
<span class="tf-dim">read-only archive &middot; the caretakers post, you read</span></pre>
    <p class="tf-status">[ <?php echo count($threads); ?> thread<?php echo count($threads) === 1 ? '' : 's'; ?>
      &middot; <?php echo count($arrived); ?> article<?php echo count($arrived) === 1 ? '' : 's'; ?>
      &middot; <?php echo count($inbound); ?> inbound ]
      &middot; relay time <?php echo flowers_e(flowers_era_datetime($now, $relay)); ?>
      &middot; <?php if ($tf_user !== null): ?>
        signed in as <strong><?php echo flowers_e($tf_user); ?></strong> &middot; <a href="account.php">sign out</a>
      <?php else: ?>
        <a href="account.php">sign in</a>
      <?php endif; ?></p>
  </div>

<?php if ($article !== null): // ── single article ─────────────────────────
    $s = flowers_article_summary($article, $relay);
    $reflowed = $article;
    $reflowed['body_lines'] = tf_reflow_lines($article['body_lines']); ?>

  <p class="tf-nav">
    <span><a href="./">&laquo; index</a></span>
    <?php if ($parent !== null): ?>
      <span><a href="?article=<?php echo urlencode($parent['seq']); ?>">&uarr; parent</a></span>
    <?php endif; ?>
    <?php if ($prev !== null): ?>
      <span><a href="?article=<?php echo urlencode($prev['seq']); ?>">&lsaquo; prev</a></span>
    <?php endif; ?>
    <?php if ($next !== null): ?>
      <span><a href="?article=<?php echo urlencode($next['seq']); ?>">next &rsaquo;</a></span>
    <?php endif; ?>
  </p>

  <div class="tf-article">
    <h2><?php echo $s['subject']; ?>
      <?php if ($s['admin']): ?><span class="tf-tag">[ADMIN]</span><?php endif; ?>
    </h2>
    <?php echo flowers_render_headers_html($article, $relay, true); ?>
    <?php echo flowers_render_body_html($reflowed); ?>

    <?php if (count($replies)): ?>
      <div class="tf-replylist">
        <span class="tf-dim"><?php echo count($replies); ?> repl<?php echo count($replies) === 1 ? 'y' : 'ies'; ?>:</span>
        <ul>
          <?php foreach ($replies as $r): $rs = flowers_article_summary($r, $relay); ?>
            <li><a href="?article=<?php echo urlencode($r['seq']); ?>"><?php echo $rs['subject']; ?></a>
              <span class="tf-dim">&middot; <?php echo $rs['author']; ?> &middot; <?php echo $rs['arrived']; ?></span></li>
          <?php endforeach; ?>
        </ul>
      </div>
    <?php endif; ?>
  </div>

  <p class="tf-nav"><span><a href="./">&laquo; index</a></span></p>

<?php else: // ── thread index ──────────────────────────────────────────── ?>

  <?php if (!count($threads)): ?>
    <p>The spool is empty. Nothing has arrived yet.</p>
  <?php endif; ?>

  <?php foreach ($threads as $thread):
      $s      = flowers_article_summary($thread, $relay);
      $count  = flowers_thread_count($thread);
      $latest = flowers_era_date(flowers_now(flowers_thread_latest($thread)), $relay);
      $flat   = flowers_flatten_thread($thread); ?>
    <details class="tf-thread" open>
      <summary>
        <a class="tf-subject" href="?article=<?php echo urlencode($thread['seq']); ?>"><?php echo $s['subject']; ?></a>
        <?php if ($s['admin']): ?><span class="tf-tag">[ADMIN]</span><?php endif; ?>
        <span class="tf-dim">&middot; <?php echo $s['author']; ?> &middot; <?php echo $s['colony_title']; ?>
          &middot; <?php echo $latest; ?><?php if ($count > 1): ?>
          &middot; <?php echo $count - 1; ?> repl<?php echo $count === 2 ? 'y' : 'ies'; ?><?php endif; ?></span>
      </summary>
      <?php if ($count > 1): ?>
        <ul class="tf-replies">
          <?php foreach (array_slice($flat, 1) as $node):
              $ns = flowers_article_summary($node, $relay);
              $depth = min((int) $node['depth'], 6); ?>
            <li class="tf-depth-<?php echo $depth; ?>">&#9492;
              <a href="?article=<?php echo urlencode($node['seq']); ?>"><?php echo $ns['subject']; ?></a>
              <?php if ($ns['admin']): ?><span class="tf-tag">[ADMIN]</span><?php endif; ?>
              <span class="tf-dim">&middot; <?php echo $ns['author']; ?> &middot; <?php echo $ns['arrived']; ?></span>
            </li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </details>
  <?php endforeach; ?>

  <hr class="tf-rule">

  <?php foreach ($inbound as $t): ?>
    <p class="tf-inbound">&middot; inbound from <?php echo flowers_e($t['colony_title']); ?>,
      arrives <?php echo flowers_e($t['arrives_display']); ?> &middot;</p>
  <?php endforeach; ?>

  <p class="tf-status">dates shown are arrival at the relay. [ADMIN] = the relay operator.</p>

<?php endif; ?>

</div>
</div>
</div>

<?php include '../../includes/footer.php'; ?>
