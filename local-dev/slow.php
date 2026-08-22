<?php
// slow.php — holds the page's load event open so headless --dump-dom
// lets probe scripts run in REAL time before dumping.
header('Content-Type: image/gif');
header('Cache-Control: no-store, must-revalidate');
sleep(6);
echo base64_decode('R0lGODlhAQABAAAAACw=');
