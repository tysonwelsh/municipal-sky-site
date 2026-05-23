<?php
// Determine current page for navigation active states
$current_page = basename($_SERVER['PHP_SELF']);
$current_dir = basename(dirname($_SERVER['PHP_SELF']));
$request_uri = $_SERVER['REQUEST_URI'];

// Check if we're in a subdirectory
$is_subdirectory = in_array($current_dir, ['blog', 'chatbots', 'information-graphics']);

// Set up paths based on directory
$css_path = $is_subdirectory ? '../css/style.css?v=4.0' : 'css/style.css?v=4.0';
$home_link = $is_subdirectory ? '../' : '/';
$blog_link = $is_subdirectory ? '../blog/' : 'blog/';
$graphics_link = $is_subdirectory ? '../information-graphics/' : 'information-graphics/';
$chatbots_link = $is_subdirectory ? '../chatbots/' : 'chatbots/';
$about_link = $is_subdirectory ? '../about.php' : 'about.php';

// Improved active page detection
$is_home = ($current_page === 'index.php' && !$is_subdirectory) || $request_uri === '/' || $request_uri === '';
$is_blog = $current_dir === 'blog' || strpos($request_uri, '/blog') !== false;
$is_graphics = $current_dir === 'information-graphics' || strpos($request_uri, '/information-graphics') !== false;
$is_chatbots = $current_dir === 'chatbots' || strpos($request_uri, '/chatbots') !== false;
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
    ?>
    <title><?php echo $page_title; ?></title>
    <meta name="description" content="<?php echo $page_description; ?>">
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
                <a href="<?php echo $blog_link; ?>" class="nav-blog<?php if ($is_blog)
                       echo ' active'; ?>">Blog</a>
                <a href="<?php echo $graphics_link; ?>" class="nav-graphics<?php if ($is_graphics)
                       echo ' active'; ?>">Information Graphics</a>
                <a href="<?php echo $chatbots_link; ?>" class="nav-chatbots<?php if ($is_chatbots)
                       echo ' active'; ?>">Chatbots</a>
                <a href="<?php echo $about_link; ?>" class="nav-about<?php if ($is_about)
                       echo ' active'; ?>">About</a>
            </nav>
        </div>
    </div>