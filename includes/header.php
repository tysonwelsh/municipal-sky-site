<?php
// Determine current page for navigation active states
$current_page = basename($_SERVER['PHP_SELF']);
$current_dir = basename(dirname($_SERVER['PHP_SELF']));
$request_uri = $_SERVER['REQUEST_URI'];

// Root-relative paths — work regardless of subdirectory depth.
$css_path = '/css/style.css?v=67031ad4';
$home_link = '/';
$blog_link = '/blog/';
$graphics_link = '/information-graphics/';
$genart_link = '/art/';
$about_link = '/about.php';

// "Generative Art" holds the music engines (under /art/) and the
// Onomatopoeia Machine (which keeps its /chatbots/ URL), so its active state
// spans both paths.
$is_home = $request_uri === '/' || $request_uri === '' || $request_uri === '/index.php';
$is_blog = $current_dir === 'blog' || strpos($request_uri, '/blog') !== false;
$is_genart = strpos($request_uri, '/art/') === 0 || rtrim($request_uri, '/') === '/art' || strpos($request_uri, '/chatbots') !== false;
$is_graphics = strpos($request_uri, '/information-graphics') !== false;
$is_about = $current_page === 'about.php' ||
    $current_page === 'about' ||
    strpos($request_uri, '/about') !== false ||
    strpos($request_uri, 'about.php') !== false;
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Preload critical fonts to reduce FOUT -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="<?php echo $css_path; ?>">
    <meta http-equiv="cache-control" content="max-age=3600">
    <meta http-equiv="expires" content="3600">
    <?php
    // Allow pages to set their own title and description
    if (!isset($page_title))
        $page_title = 'Municipal Sky';
    if (!isset($page_description))
        $page_description = 'Creative explorations, digital experiments, and innovative projects';

    // ── Social-share (Open Graph / Twitter Card) metadata ──────────────
    // A page can override any of these before include'ing this header:
    //   $page_title, $page_description  (already used above)
    //   $page_image  — root-relative ("/images/foo.png") or a full URL
    //   $page_type   — "article" for posts; defaults to "website"
    $site_base = 'https://municipalsky.com';
    $page_url = $site_base . strtok($_SERVER['REQUEST_URI'], '?'); // canonical, no query string
    if (!isset($page_image))
        $page_image = '/images/og-default.png';
    $page_image_url = (strncmp($page_image, 'http', 4) === 0) ? $page_image : $site_base . $page_image;
    if (!isset($page_type))
        $page_type = 'website';

    $og_title = htmlspecialchars($page_title, ENT_QUOTES, 'UTF-8');
    $og_desc  = htmlspecialchars($page_description, ENT_QUOTES, 'UTF-8');
    $og_url   = htmlspecialchars($page_url, ENT_QUOTES, 'UTF-8');
    $og_img   = htmlspecialchars($page_image_url, ENT_QUOTES, 'UTF-8');
    $og_type  = htmlspecialchars($page_type, ENT_QUOTES, 'UTF-8');
    ?>
    <title><?php echo $page_title; ?></title>
    <meta name="description" content="<?php echo $og_desc; ?>">
    <link rel="canonical" href="<?php echo $og_url; ?>">

    <!-- Open Graph: Reddit, LinkedIn, Facebook, Discord, iMessage, Slack, etc. -->
    <meta property="og:site_name" content="Municipal Sky">
    <meta property="og:type" content="<?php echo $og_type; ?>">
    <meta property="og:title" content="<?php echo $og_title; ?>">
    <meta property="og:description" content="<?php echo $og_desc; ?>">
    <meta property="og:url" content="<?php echo $og_url; ?>">
    <meta property="og:image" content="<?php echo $og_img; ?>">

    <!-- Twitter / X Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="<?php echo $og_title; ?>">
    <meta name="twitter:description" content="<?php echo $og_desc; ?>">
    <meta name="twitter:image" content="<?php echo $og_img; ?>">
</head>

<body>
    <div class="site-banner">
        <input type="checkbox" id="mobile-menu-checkbox" />
        <div class="site-banner-inner">
            <a href="<?php echo $home_link; ?>" class="site-title">Municipal Sky</a>
            <label for="mobile-menu-checkbox" class="mobile-menu-toggle">
                <span></span>
                <span></span>
                <span></span>
            </label>
            <nav class="site-navigation">
                <!-- HIDDEN (temporarily commented out — un-comment to restore) -->
                <!--
                <a href="<?php echo $blog_link; ?>" class="nav-blog<?php if ($is_blog)
                       echo ' active'; ?>">Blog</a>
                -->
                <!-- END HIDDEN -->
                <a href="<?php echo $graphics_link; ?>" class="nav-graphics<?php if ($is_graphics)
                       echo ' active'; ?>">Information Graphics</a>
                <a href="<?php echo $genart_link; ?>" class="nav-genart<?php if ($is_genart)
                       echo ' active'; ?>">Art</a>
                <a href="<?php echo $about_link; ?>" class="nav-about<?php if ($is_about)
                       echo ' active'; ?>">About</a>
            </nav>
        </div>
    </div>