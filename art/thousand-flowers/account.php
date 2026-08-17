<?php
/**
 * A Thousand Flowers — reader accounts.
 *
 * Register / sign in / sign out. Plain self-posting forms, zero JavaScript,
 * lofi skin to match the reader. Reading the board never requires an account;
 * an account is only an identity (and, later, a voice).
 *
 * Storage follows the project's jd-config pattern: MySQL in production
 * (credentials from secrets.php), a SQLite file under local-dev/ when serving
 * from localhost, where no MySQL runs. The table bootstraps itself on first
 * use, the same way api/subscribe.php does.
 */

$tf_https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
session_set_cookie_params(array(
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => $tf_https,
));
session_start();

require_once __DIR__ . '/flowers-lib.php';

const TF_DEV_DB_PATH = __DIR__ . '/../../local-dev/flowers-dev.sqlite';

/**
 * One PDO for the request. localhost gets the dev SQLite file (created on
 * demand); anything else gets the production MySQL from secrets.php.
 */
function tf_auth_db()
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    $is_local = preg_match('/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/', $host);

    if ($is_local) {
        $dir = dirname(TF_DEV_DB_PATH);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $pdo = new PDO('sqlite:' . TF_DEV_DB_PATH, null, null, array(
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ));
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS tf_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                pass_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_login_at TEXT
            )"
        );
        return $pdo;
    }

    $secrets_file = is_readable(__DIR__ . '/../../config/secrets.php')
        ? __DIR__ . '/../../config/secrets.php'
        : '/home1/tdrivemy/private_config/secrets.php';
    $secrets = include $secrets_file;
    $pdo = new PDO(
        'mysql:host=localhost;dbname=' . $secrets['db_name'] . ';charset=utf8mb4',
        $secrets['db_user'],
        $secrets['db_pass'],
        array(
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        )
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS tf_users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(24) NOT NULL,
            pass_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP NULL,
            UNIQUE KEY uniq_username (username)
        )"
    );
    return $pdo;
}

function tf_redirect($url)
{
    header('Location: ' . $url, true, 303);
    exit();
}

$tf_user = isset($_SESSION['tf_user']) ? $_SESSION['tf_user'] : null;
$error   = '';
$mode    = (isset($_GET['mode']) && $_GET['mode'] === 'register') ? 'register' : 'login';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = isset($_POST['action']) ? $_POST['action'] : '';

    if ($action === 'logout') {
        $_SESSION = array();
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        tf_redirect('./');
    }

    // Honeypot: real readers never see or fill this field. Bots that fill it
    // get a polite redirect and nothing is written (same trick as the
    // subscribe form).
    if (!empty($_POST['website'])) {
        tf_redirect('./');
    }

    $username = trim(isset($_POST['username']) ? (string) $_POST['username'] : '');
    $password = (string) (isset($_POST['password']) ? $_POST['password'] : '');

    if ($action === 'register') {
        $mode = 'register';
        if (!preg_match('/^[A-Za-z0-9_.-]{3,24}$/', $username)) {
            $error = 'Names are 3–24 characters: letters, digits, dot, dash, underscore.';
        } elseif (strlen($password) < 8) {
            $error = 'Passphrase must be at least 8 characters.';
        } elseif (strlen($password) > 72) {
            $error = 'Passphrase must be 72 characters or fewer.';
        } else {
            $db   = tf_auth_db();
            $stmt = $db->prepare('SELECT id FROM tf_users WHERE username = :u');
            $stmt->execute(array('u' => $username));
            if ($stmt->fetch()) {
                $error = 'That name is already traveling the relay. Choose another.';
            } else {
                $stmt = $db->prepare('INSERT INTO tf_users (username, pass_hash) VALUES (:u, :h)');
                $stmt->execute(array('u' => $username, 'h' => password_hash($password, PASSWORD_DEFAULT)));
                session_regenerate_id(true);
                $_SESSION['tf_user'] = $username;
                tf_redirect('./');
            }
        }
    } elseif ($action === 'login') {
        $db   = tf_auth_db();
        $stmt = $db->prepare('SELECT pass_hash FROM tf_users WHERE username = :u');
        $stmt->execute(array('u' => $username));
        $row  = $stmt->fetch();
        if ($row && password_verify($password, $row['pass_hash'])) {
            session_regenerate_id(true);
            $_SESSION['tf_user'] = $username;
            $db->prepare('UPDATE tf_users SET last_login_at = CURRENT_TIMESTAMP WHERE username = :u')
               ->execute(array('u' => $username));
            tf_redirect('./');
        }
        sleep(1); // a wrong guess costs time; a right one doesn't
        $error = 'Name and passphrase do not match anything the relay holds.';
    }
}

$page_title = 'A Thousand Flowers — sign in';
$page_description = 'Reader accounts for the colonies.music.flowers relay.';
include '../../includes/header.php';
?>

<style>
/* same lofi sheet as the reader */
.tf-wrap {
  background: #fffffb;
  color: #111;
  font: 13px/1.5 ui-monospace, "SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", monospace;
  max-width: 64ch;
  margin: 1.5rem auto 3rem;
  padding: 1.5rem 2.5rem 2.5rem;
  border: 1px solid #e3e3da;
}
.tf-wrap a { color: #0000ee; }
.tf-wrap a:visited { color: #551a8b; }
.tf-dim { color: #6f6f6f; }
.tf-account h1 { font: inherit; font-weight: bold; font-size: 1.15em; margin: 0 0 1rem; }
.tf-field { margin: 0 0 .75rem; }
.tf-field label { display: block; color: #6f6f6f; }
.tf-field input {
  font: inherit;
  background: #fff;
  color: #111;
  border: 1px solid #999;
  padding: .3rem .5rem;
  width: 32ch;
  max-width: 100%;
}
.tf-submit {
  font: inherit;
  font-weight: bold;
  background: #111;
  color: #fffffb;
  border: 1px solid #111;
  padding: .35rem 1rem;
  cursor: pointer;
}
.tf-error { border-left: 3px solid #8b1a1a; padding-left: .5rem; margin: 0 0 1rem; }
.tf-hp { position: absolute; left: -9999px; }
.tf-switch { margin-top: 1rem; }
</style>

<div class="main-wrapper">
<div class="content-frame">
<div class="tf-wrap">
<div class="tf-account">

  <h1>A THOUSAND FLOWERS &middot; <?php echo $tf_user !== null ? 'your lamp' : ($mode === 'register' ? 'new reader' : 'sign in'); ?></h1>
  <p class="tf-dim"><a href="./">&laquo; back to the board</a></p>

<?php if ($tf_user !== null): ?>

  <p>Signed in as <strong><?php echo flowers_e($tf_user); ?></strong>. The lamps
    recognize you.</p>
  <form method="post" action="account.php">
    <input type="hidden" name="action" value="logout">
    <button class="tf-submit" type="submit">sign out</button>
  </form>

<?php elseif ($mode === 'register'): ?>

  <?php if ($error !== ''): ?><p class="tf-error"><?php echo flowers_e($error); ?></p><?php endif; ?>
  <form method="post" action="account.php" novalidate>
    <input type="hidden" name="action" value="register">
    <div class="tf-field">
      <label for="r-name">name (this is what the board shows)</label>
      <input id="r-name" name="username" type="text" required maxlength="24"
             pattern="[A-Za-z0-9_.\-]{3,24}" autocomplete="username"
             value="<?php echo isset($_POST['username']) ? flowers_e($username) : ''; ?>">
    </div>
    <div class="tf-field">
      <label for="r-pass">passphrase (8+ characters)</label>
      <input id="r-pass" name="password" type="password" required minlength="8" maxlength="72"
             autocomplete="new-password">
    </div>
    <input class="tf-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="tf-submit" type="submit">join the relay</button>
  </form>
  <p class="tf-switch tf-dim">Already have a lamp? <a href="account.php">sign in</a>.</p>

<?php else: ?>

  <?php if ($error !== ''): ?><p class="tf-error"><?php echo flowers_e($error); ?></p><?php endif; ?>
  <form method="post" action="account.php" novalidate>
    <input type="hidden" name="action" value="login">
    <div class="tf-field">
      <label for="l-name">name</label>
      <input id="l-name" name="username" type="text" required maxlength="24" autocomplete="username">
    </div>
    <div class="tf-field">
      <label for="l-pass">passphrase</label>
      <input id="l-pass" name="password" type="password" required maxlength="72" autocomplete="current-password">
    </div>
    <input class="tf-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="tf-submit" type="submit">sign in</button>
  </form>
  <p class="tf-switch tf-dim">No lamp yet? <a href="account.php?mode=register">join the relay</a>.</p>

<?php endif; ?>

</div>
</div>
</div>
</div>

<?php include '../../includes/footer.php'; ?>
