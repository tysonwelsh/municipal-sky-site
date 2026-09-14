<?php
// _scripts.php — the drawer's script tags and the page-view ping, verbatim
// from index.php (factored out 2026-09-13, PLAN-PORTFOLIO §6.2). Requires
// _assets.php to have run first ($jd_scripts, jd_v). Included at the foot
// of every page that mounts the drawer.
?>
<!-- data-jd-turn-object / data-jd-instructions / data-jd-analytics: the
     content hashes of the three runtime-fetched artworks. The script fetches
     them itself, so their cache-busting tokens have to reach JS from here —
     there is no <link> or <img> to hang them on. They ride on the furniture
     module's tag (the module that fetches all three); JD_fetchArt in
     jd-core.js reads them off any script tag on the page. Order matters:
     core defines the shared helpers and the drawer, furniture/record/
     darkroom build on core, turn builds on darkroom, bench builds on turn. -->
<?php foreach ($jd_scripts as $jd_s): ?>
<script src="<?php echo $jd_base . $jd_s; ?>?v=<?php echo jd_v($jd_s); ?>"<?php if ($jd_s === 'jd-furniture.js'): ?>

        data-jd-turn-object="<?php echo jd_v('turn-object.svg'); ?>"
        data-jd-instructions="<?php echo jd_v('instructions-object.svg'); ?>"
        data-jd-analytics="<?php echo jd_v('analytics-folder.svg'); ?>"<?php endif; ?>></script>
<?php endforeach; ?>

<!-- Anonymous usage tracking: a page view. No personal data leaves the
     browser; the server records only a salted, daily-rotating visitor hash
     for unique-visit counts. The request itself is built by JD_track in
     jd-core.js (loaded above, synchronously) so every call on this page
     goes through the one JD_API base — no relative path here may assume the
     page and the API share a directory (APP §4.1). -->
<script>
  if (window.JD_track) JD_track("page_view", <?php echo $jd_page_label === null ? 'null' : json_encode((string) $jd_page_label); ?>);
</script>
