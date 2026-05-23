<?php
// Local dev router for `php -S localhost:8000 router.php`.
// Mimics the production .htaccess rule that appends .php to extensionless URLs,
// so links like /blog/natural-light resolve to natural-light.php locally.
// Not used in production — Bluehost serves via Apache + .htaccess.
//
// Apache (production) sets the working directory to the directory containing
// the script being executed. The PHP built-in dev server does NOT — it leaves
// the CWD wherever `php -S` was launched from (project root). That breaks the
// many subdirectory pages that use relative includes like `../includes/header.php`,
// because PHP resolves those against CWD rather than the script's location.
// We chdir() into the script's directory below to match Apache's behavior.

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . $uri;

if (file_exists($file)) {
    if (is_file($file) && substr($file, -4) === '.php') {
        chdir(dirname($file));
    }
    return false;
}

if (preg_match('/^[^.]+$/', basename($uri)) && is_file($file . '.php')) {
    chdir(dirname($file . '.php'));
    $_SERVER['SCRIPT_NAME'] = $uri . '.php';
    $_SERVER['SCRIPT_FILENAME'] = $file . '.php';
    $_SERVER['PHP_SELF'] = $uri . '.php';
    require $file . '.php';
    return true;
}

return false;
