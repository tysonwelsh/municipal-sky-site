<?php
// _stage.php — THE DRAWER STAGE, verbatim from index.php (factored out
// 2026-09-13, PLAN-PORTFOLIO §6.2). Included by index.php and by
// about/index.php so both pages mount the identical drawer: same layer
// stack, same pull, same wiring. Edit the drawer HERE, never in a page.
?>
  <!-- ============ THE DRAWER STAGE (transplanted from Phase 0) ============
       Layer stack, bottom to top: craquelure (the DRAWER's own aging, under
       the items — G2), the pile (its own stacking context), wall shade,
       varnish sheen, vignette. The pile is built by junk-drawer.js from
       data.php; placements arrive from each entry.json (PLAN-BACKEND §7). -->
  <div class="jd-stage" id="drawer">
    <div class="jd-frame">
      <div class="jd-well">
        <div class="jd-pile"></div>
        <div class="jd-wallshade"></div>
      </div>
    </div>

    <div class="jd-craquelure"></div>
    <div class="jd-varnish"></div>
    <div class="jd-vignette"></div>

    <!-- the pull: victorian bail in PLAN VIEW (owner's pick, mockup-5,
         "for now"). The vertical backplate survives as a thin brass strip
         along the outer edge; the bail is a sliver past it; the posts two
         domes. Decorative only (pointer-events: none); overhangs the
         stage's bottom edge, shadow falling to the page floor. Shown at
         every width: on mobile the immersive stage gives back exactly the
         overhang so the hardware still seats on the outer edge and stays
         above the fold (see --jd-pull-drop in junk-drawer.css). -->
    <svg class="jd-pull" viewBox="0 0 300 70" aria-hidden="true">
      <defs>
        <linearGradient id="jdp-strip" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#dcb768"/>
          <stop offset="0.5" stop-color="#b3873a"/>
          <stop offset="1" stop-color="#6e4f1e"/>
        </linearGradient>
        <linearGradient id="jdp-bail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#e0bc6d"/>
          <stop offset="0.55" stop-color="#a87c30"/>
          <stop offset="1" stop-color="#4f3814"/>
        </linearGradient>
        <radialGradient id="jdp-post" cx="0.35" cy="0.32" r="0.85">
          <stop offset="0" stop-color="#f2dc9b"/>
          <stop offset="0.55" stop-color="#c1913c"/>
          <stop offset="1" stop-color="#5c421a"/>
        </radialGradient>
        <filter id="jdp-sh" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4"/>
        </filter>
      </defs>
      <g transform="translate(11,13)" filter="url(#jdp-sh)" opacity="0.38">
        <rect x="40" y="10" width="220" height="3.8" rx="1.5" fill="#1c0e05"/>
        <path d="M 95 20 C 115 32.5, 185 32.5, 205 20" fill="none" stroke="#1c0e05" stroke-width="4" stroke-linecap="round"/>
        <circle cx="95" cy="24" r="7" fill="#1c0e05"/>
        <circle cx="205" cy="24" r="7" fill="#1c0e05"/>
      </g>
      <rect x="40" y="10" width="220" height="3.8" rx="1.5" fill="url(#jdp-strip)" stroke="#3a280e" stroke-width="0.7" stroke-opacity="0.5"/>
      <line x1="46" y1="11" x2="110" y2="11" stroke="#f0d795" stroke-width="0.8" opacity="0.45"/>
      <path d="M 128 13.6 C 138 16.2, 162 16.2, 172 13.6 Z" fill="url(#jdp-strip)" stroke="#3a280e" stroke-width="0.6" stroke-opacity="0.5"/>
      <path d="M 95 20 C 115 32.5, 185 32.5, 205 20" fill="none" stroke="url(#jdp-bail)" stroke-width="4" stroke-linecap="round"/>
      <path d="M 96.5 19 C 116 30.5, 184 30.5, 203.5 19" fill="none" stroke="#f4df9e" stroke-width="1" opacity="0.5"/>
      <rect x="91.5" y="13" width="7" height="6" fill="#8a6427" stroke="#3a280e" stroke-width="0.6" stroke-opacity="0.5"/>
      <rect x="201.5" y="13" width="7" height="6" fill="#8a6427" stroke="#3a280e" stroke-width="0.6" stroke-opacity="0.5"/>
      <circle cx="95" cy="24" r="7" fill="url(#jdp-post)" stroke="#3a280e" stroke-width="0.7" stroke-opacity="0.55"/>
      <ellipse cx="92.2" cy="21.4" rx="1.9" ry="1.6" fill="#fff6d8" opacity="0.85"/>
      <circle cx="205" cy="24" r="7" fill="url(#jdp-post)" stroke="#3a280e" stroke-width="0.7" stroke-opacity="0.55"/>
      <ellipse cx="202.2" cy="21.4" rx="1.9" ry="1.6" fill="#fff6d8" opacity="0.85"/>
    </svg>

    <!-- TAKE A TURN: the visitor's own commission (PLAN-USER-PROMPTS §4.1).
         NO MARKUP HERE ANY MORE. The corner brass card-holder that used to
         sit on this front band was retired on 2026-08-10 for a doorbell in
         the pile (candidate 8e); on 2026-08-11 the doorbell was re-skinned
         in turn as candidate 9a — a backlit blue arcade credit button
         printed PUSH / 4 MORE / JUNK (relettered and enlarged 2026-09-10),
         the drawer's one light source. Same wiring
         either way: injected into .jd-pile by junk-drawer.js from
         turn-object.svg, fixed in the bottom-left corner and labelled from
         JD_STRINGS.turnButton. Nothing about the modal it opens changed. -->
  </div>
