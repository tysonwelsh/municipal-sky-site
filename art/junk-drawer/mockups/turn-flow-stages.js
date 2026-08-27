/* turn-flow-stages.js — shared stage builder for mockup-35 (desktop) and
   mockup-36 (mobile). AS-BUILT captures of the post-darkroom turn flow:
   the markup below mirrors what junk-drawer.js paints (viewReveal /
   viewRate / callPanel / viewUnveil, 2026-08-26) and each stage is
   rendered inside an iframe that links the REAL ../junk-drawer.css, so
   the live breakpoints decide the layout at whatever width the iframe
   gives them. Nothing here is a design proposal — it is the review copy
   the owner marks changes on. Interactive plumbing (zoom, tooltips,
   drag, filing) is not wired; selects and the podium are inert. */

(function () {
  'use strict';

  /* taxonomy v20, live axes in survey order + the grade scale */
  var AXES = [
    { id: 'understanding-assignment', label: 'Understanding the Assignment',
      desc: 'Did the model grasp the brief — each explicit ask, the evident intent behind it, and the brief’s negative space? Prompts underspecify and filling the gaps is the job; additions are charged here only when they crowd, contradict, or upstage what was asked. Judged on what it TRIED to draw; whether the drawing itself holds up belongs to the axes below.',
      values: [
        { rank: 4, label: 'Fully Understands' },
        { rank: 3, label: 'Mostly Understands' },
        { rank: 2, label: 'Somewhat Understands' },
        { rank: 1, label: 'Barely Understands' }] },
    { id: 'structural-coherence', label: 'Structural Coherence',
      desc: 'Errors of the object: parts attach, anatomy is possible, proportions and viewpoint stay self-consistent. If fixing it means redrawing geometry, it lands here.',
      values: [
        { rank: 3, label: 'No problems' },
        { rank: 2, label: 'Small problems' },
        { rank: 1, label: 'Big problems' }] },
    { id: 'layering', label: 'Layering',
      desc: 'Errors of the picture: stacking order and occlusion as rendered, fill, stroke and gradient work, framing and use of the canvas. The test — if it could be fixed without moving a single path (reorder, repaint, reframe), it lands here.',
      values: [
        { rank: 3, label: 'No problems' },
        { rank: 2, label: 'Small problems' },
        { rank: 1, label: 'Big problems' }] },
    { id: 'jnsq', label: 'Je ne sais quoi',
      desc: 'The intangible — whatever makes a piece more than the sum of its axes. Not captured elsewhere; graded anyway.',
      values: [
        { rank: 3, label: 'Has it' },
        { rank: 2, label: 'Just a hint' },
        { rank: 1, label: 'Ain’t got it' }] }
  ];
  var GRADES = [
    { rank: 5, label: 'Prime' }, { rank: 4, label: 'Choice' },
    { rank: 3, label: 'Select' }, { rank: 2, label: 'Standard' },
    { rank: 1, label: 'Utility' }];
  var GRADE_DESC = 'The drawer’s own five-tier scale, best to worst.';

  /* sample turn: the four fish-skeleton responses (items/2026-07-29-fish-
     skeleton/, copied verbatim) standing in for one turn's four anonymous
     slots. None of the four declares an id, so inlining copies needs no
     namespacing. a=claude-fable-5, b=claude-opus-5, c=kimi-k3,
     d=claude-sonnet-5 — the pairing to slots is arbitrary sample data. */
  var ART = {
    a: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 57 392 116">
  <g stroke="#23211f" stroke-width="10" stroke-linecap="round" fill="none">
    <path d="M130.5 79.3 Q152.5 113.6 159.7 153.7"/>
    <path d="M169 67 Q186.2 104 187.8 144.8"/>
    <path d="M208.4 64.5 Q219.8 99.6 215.2 136.1"/>
    <path d="M247 69.6 Q253.4 100 243.8 129.6"/>
    <path d="M284 80.4 Q287.1 105.5 274.6 127.4"/>
    <path d="M112 132 Q222 72 336 122" stroke-width="11"/>
  </g>
  <g stroke="#f6f1e3" stroke-width="5" stroke-linecap="round" fill="none">
    <path d="M130.5 79.3 Q152.5 113.6 159.7 153.7"/>
    <path d="M169 67 Q186.2 104 187.8 144.8"/>
    <path d="M208.4 64.5 Q219.8 99.6 215.2 136.1"/>
    <path d="M247 69.6 Q253.4 100 243.8 129.6"/>
    <path d="M284 80.4 Q287.1 105.5 274.6 127.4"/>
    <path d="M112 132 Q222 72 336 122" stroke-width="6"/>
  </g>
  <g stroke-linejoin="round">
    <path d="M334 114 L389 76 L373 119 L389 161 L334 130 Q325 122 334 114 Z" fill="#8fc1bb" stroke="#23211f" stroke-width="5"/>
    <g stroke="#23211f" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.85">
      <path d="M341 120 L376 93"/>
      <path d="M342 123 L368 119"/>
      <path d="M341 126 L375 148"/>
    </g>
    <path d="M10 130 C24 98 62 84 98 90 C114 94 122 108 122 126 C122 146 112 160 94 165 C70 171 44 168 22 158 L38 143 Z" fill="#8fc1bb" stroke="#23211f" stroke-width="5"/>
    <path d="M102 96 Q88 126 100 162" fill="none" stroke="#23211f" stroke-width="4" stroke-linecap="round"/>
    <g stroke="#23211f" stroke-width="5.5" stroke-linecap="round">
      <path d="M49 113 L67 131"/>
      <path d="M67 113 L49 131"/>
    </g>
  </g>
</svg>`,
    b: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" role="img" aria-label="Cartoon fish skeleton with a fish head and X eyes"><g fill="none" stroke="#2A2A33" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M 638 143 C 678 104, 726 56, 786 10 C 758 62, 726 120, 702 172 C 728 212, 758 252, 782 292 C 734 256, 682 196, 638 143 Z" fill="#F5EDDD"/><g stroke-width="5" stroke="#3D3A46" opacity="0.85"><path d="M 656 146 L 758 44 M 660 154 L 736 84 M 664 162 L 712 128 M 656 152 L 748 252 M 660 160 L 730 228 M 664 168 L 708 196"/></g><path d="M 273 214 Q 265 129 327 59 M 273 214 Q 265 299 327 369 M 328 240 Q 321 161 378 97 M 328 240 Q 321 319 378 383 M 384 251 Q 377 177 431 116 M 384 251 Q 377 325 431 386 M 439 247 Q 433 180 482 125 M 439 247 Q 433 314 482 369 M 493 233 Q 488 176 529 129 M 493 233 Q 488 290 529 337 M 543 212 Q 539 167 572 130 M 543 212 Q 539 257 572 294 M 583 188 Q 580 156 603 130 M 583 188 Q 580 220 603 246 M 613 167 Q 611 146 626 129 M 613 167 Q 611 188 626 205" stroke-width="13"/><path d="M 273 214 Q 265 129 327 59 M 273 214 Q 265 299 327 369 M 328 240 Q 321 161 378 97 M 328 240 Q 321 319 378 383 M 384 251 Q 377 177 431 116 M 384 251 Q 377 325 431 386 M 439 247 Q 433 180 482 125 M 439 247 Q 433 314 482 369 M 493 233 Q 488 176 529 129 M 493 233 Q 488 290 529 337 M 543 212 Q 539 167 572 130 M 543 212 Q 539 257 572 294 M 583 188 Q 580 156 603 130 M 583 188 Q 580 220 603 246 M 613 167 Q 611 146 626 129 M 613 167 Q 611 188 626 205" stroke="#F5EDDD" stroke-width="6"/><path d="M 230 175 C 370 330, 560 215, 640 146" stroke-width="24"/><path d="M 230 175 C 370 330, 560 215, 640 146" stroke="#F5EDDD" stroke-width="14"/><path d="M 305 220 L 296 236 M 358 239 L 354 256 M 410 243 L 413 260 M 464 233 L 469 250 M 514 215 L 522 231 M 559 192 L 568 208 M 593 170 L 603 184" stroke-width="4" stroke-linecap="butt" opacity="0.9"/><path d="M 18 176 L 16 248 L 102 208 Z" fill="#8C3D4A" stroke="none"/><path d="M 16 176 C 60 100, 150 68, 236 92 C 250 170, 248 248, 226 302 C 160 332, 92 310, 62 272 L 14 248 L 100 208 Z" fill="#7FB8CA"/><path d="M 62 272 C 92 310, 160 332, 226 302 C 218 282, 150 296, 76 256 Z" fill="#B4DCE7" stroke="none"/><path d="M 206 104 C 228 168, 226 240, 202 296" stroke-width="7" opacity="0.65"/><path d="M 35 184 L 48 189 L 36 200 Z M 61 194 L 74 198 L 62 209 Z M 38 236 L 52 230 L 39 220 Z" fill="#F5EDDD" stroke-width="4"/><circle cx="126" cy="148" r="27" fill="#EAF6F8" stroke-width="5"/><path d="M 110 132 L 142 164 M 142 132 L 110 164" stroke-width="10"/><path d="M 100 108 C 118 97, 142 99, 158 111" stroke-width="6" opacity="0.75"/><circle cx="66" cy="163" r="5" fill="#2A2A33" stroke="none"/></g></svg>`,
    c: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 58 788 300">
    <g fill="none" stroke="#33302a" stroke-linecap="round">
      <g stroke-width="16">
        <path d="M60 140 L18 72"/>
        <path d="M60 140 L12 106"/>
        <path d="M60 140 L10 142"/>
        <path d="M60 140 L14 178"/>
        <path d="M60 140 L28 210"/>
      </g>
      <g stroke-width="17">
        <path d="M146 155 Q122 200 146 245"/>
        <path d="M199 150 Q175 220 199 290"/>
        <path d="M253 146 Q229 234 253 322"/>
        <path d="M308 141 Q284 241 308 341"/>
        <path d="M364 138 Q340 242 364 346"/>
        <path d="M420 135 Q396 235 420 335"/>
        <path d="M476 133 Q452 221 476 309"/>
        <path d="M531 129 Q507 199 531 269"/>
      </g>
      <path stroke-width="20" d="M60 140 C220 260 420 280 600 170"/>
    </g>
    <g fill="none" stroke="#f8f3e3" stroke-linecap="round">
      <g stroke-width="8">
        <path d="M60 140 L18 72"/>
        <path d="M60 140 L12 106"/>
        <path d="M60 140 L10 142"/>
        <path d="M60 140 L14 178"/>
        <path d="M60 140 L28 210"/>
      </g>
      <g stroke-width="9">
        <path d="M146 155 Q122 200 146 245"/>
        <path d="M199 150 Q175 220 199 290"/>
        <path d="M253 146 Q229 234 253 322"/>
        <path d="M308 141 Q284 241 308 341"/>
        <path d="M364 138 Q340 242 364 346"/>
        <path d="M420 135 Q396 235 420 335"/>
        <path d="M476 133 Q452 221 476 309"/>
        <path d="M531 129 Q507 199 531 269"/>
      </g>
      <path stroke-width="12" d="M60 140 C220 260 420 280 600 170"/>
    </g>
    <g fill="#f8f3e3" stroke="#33302a" stroke-width="5">
      <circle cx="18" cy="72" r="7"/>
      <circle cx="12" cy="106" r="7"/>
      <circle cx="10" cy="142" r="7"/>
      <circle cx="14" cy="178" r="7"/>
      <circle cx="28" cy="210" r="7"/>
      <circle cx="60" cy="140" r="9"/>
      <circle cx="146" cy="155" r="8"/><circle cx="146" cy="245" r="8"/>
      <circle cx="160" cy="200" r="8"/>
      <circle cx="199" cy="150" r="8"/><circle cx="199" cy="290" r="8"/>
      <circle cx="213" cy="220" r="8"/>
      <circle cx="253" cy="146" r="8"/><circle cx="253" cy="322" r="8"/>
      <circle cx="267" cy="234" r="8"/>
      <circle cx="308" cy="141" r="8"/><circle cx="308" cy="341" r="8"/>
      <circle cx="322" cy="241" r="8"/>
      <circle cx="364" cy="138" r="8"/><circle cx="364" cy="346" r="8"/>
      <circle cx="378" cy="242" r="8"/>
      <circle cx="420" cy="135" r="8"/><circle cx="420" cy="335" r="8"/>
      <circle cx="434" cy="235" r="8"/>
      <circle cx="476" cy="133" r="8"/><circle cx="476" cy="309" r="8"/>
      <circle cx="490" cy="221" r="8"/>
      <circle cx="531" cy="129" r="8"/><circle cx="531" cy="269" r="8"/>
      <circle cx="545" cy="199" r="8"/>
    </g>
    <path d="M788 143 L708 164 Q698 185 714 201 L782 217 Z" fill="#4a4438"/>
    <path d="M590 120 Q655 35 742 88 Q778 108 782 150 L715 168 Q705 185 718 196 L775 210 Q740 285 655 290 Q600 285 588 240 Q572 175 590 120 Z"
          fill="#a3c26a" stroke="#33302a" stroke-width="7" stroke-linejoin="round"/>
    <path d="M615 128 Q592 195 610 258" fill="none" stroke="#33302a" stroke-width="6" stroke-linecap="round"/>
    <path d="M628 268 Q596 306 562 300 Q584 272 608 252 Z" fill="#86a84f" stroke="#33302a" stroke-width="5" stroke-linejoin="round"/>
    <path d="M600 262 Q584 282 572 292 M612 272 Q596 290 582 296" fill="none" stroke="#33302a" stroke-width="4" stroke-linecap="round"/>
    <g fill="none" stroke="#33302a" stroke-linecap="round">
      <path stroke-width="8" d="M677 117 L713 153 M713 117 L677 153"/>
      <path stroke-width="7" d="M627 89 L653 115 M653 89 L627 115"/>
    </g>
  </svg>`,
    d: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 158">
  <g transform="translate(-15,-49)" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#4a372a" stroke-width="2.2" opacity="0.75">
      <path d="M58,86 Q64,73 58,60 Q52,49 58,40"/>
      <path d="M80,89 Q86,77 80,66 Q75,56 80,47"/>
    </g>
    <path d="M110,140 Q275,95 440,140" stroke="#3a2a1f" stroke-width="11"/>
    <path d="M110,140 Q275,95 440,140" stroke="#f4ecd8" stroke-width="7.5"/>
    <g stroke="#3a2a1f" stroke-width="2.6">
      <g transform="translate(149.6,130.5) rotate(-41.7)"><path d="M -8,0 Q -4,-25 0,-45.8 Q 4,-25 8,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(149.6,130.5) rotate(18.3)"><path d="M -8,0 Q -4,25 0,45.8 Q 4,25 8,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(189.2,123.6) rotate(-38.06)"><path d="M -7.5,0 Q -3.7,-23 0,-41.6 Q 3.7,-23 7.5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(189.2,123.6) rotate(21.94)"><path d="M -7.5,0 Q -3.7,23 0,41.6 Q 3.7,23 7.5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(228.8,119.26) rotate(-34.36)"><path d="M -6.5,0 Q -3.2,-20.5 0,-37.4 Q 3.2,-20.5 6.5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(228.8,119.26) rotate(25.64)"><path d="M -6.5,0 Q -3.2,20.5 0,37.4 Q 3.2,20.5 6.5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(268.4,118.6) rotate(-30.62)"><path d="M -6,0 Q -3,-18 0,-33.2 Q 3,-18 6,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(268.4,118.6) rotate(29.38)"><path d="M -6,0 Q -3,18 0,33.2 Q 3,18 6,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(308,118.4) rotate(-26.88)"><path d="M -5,0 Q -2.5,-16 0,-29 Q 2.5,-16 5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(308,118.4) rotate(33.12)"><path d="M -5,0 Q -2.5,16 0,29 Q 2.5,16 5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(347.6,121.86) rotate(-23.16)"><path d="M -4.5,0 Q -2.2,-13.5 0,-24.8 Q 2.2,-13.5 4.5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(347.6,121.86) rotate(36.84)"><path d="M -4.5,0 Q -2.2,13.5 0,24.8 Q 2.2,13.5 4.5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(387.2,127.9) rotate(-19.49)"><path d="M -3.5,0 Q -1.7,-11 0,-20.6 Q 1.7,-11 3.5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(387.2,127.9) rotate(40.51)"><path d="M -3.5,0 Q -1.7,11 0,20.6 Q 1.7,11 3.5,0 Z" fill="#f4ecd8"/></g>
    </g>
    <g stroke="#3a2a1f" stroke-width="3">
      <g transform="translate(440,140) rotate(60.3)"><path d="M -6,0 Q -3.5,-38 0,-70 Q 3.5,-38 6,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(440,140) rotate(90.3)"><path d="M -4.5,0 Q -2.6,-27 0,-50 Q 2.6,-27 4.5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(440,140) rotate(120.3)"><path d="M -4.5,0 Q -2.6,-27 0,-50 Q 2.6,-27 4.5,0 Z" fill="#f4ecd8"/></g>
      <g transform="translate(440,140) rotate(150.3)"><path d="M -6,0 Q -3.5,-38 0,-70 Q 3.5,-38 6,0 Z" fill="#f4ecd8"/></g>
    </g>
    <path d="M110,140 C100,172 60,175 40,155 C25,140 25,110 40,92 C55,78 95,80 112,112 Z"
          fill="#f4ecd8" stroke="#3a2a1f" stroke-width="4"/>
    <path d="M107,96 Q95,128 107,160" stroke="#3a2a1f" stroke-width="3"/>
    <g stroke="#2a1c13" stroke-width="6">
      <path d="M58,105 L76,123"/>
      <path d="M58,123 L76,105"/>
    </g>
    <path d="M32,128 Q40,140 52,131" stroke="#3a2a1f" stroke-width="3"/>
    <path d="M39,133 L41,140 L43,133 Z" fill="#f4ecd8" stroke="#3a2a1f" stroke-width="1.5"/>
    <path d="M46,133 L48,140 L50,133 Z" fill="#f4ecd8" stroke="#3a2a1f" stroke-width="1.5"/>
  </g>
</svg>`
  };
  /* the unveil's answer sheet — the models that really drew the samples */
  var WHO = { a: 'Claude Fable 5', b: 'Claude Opus 5', c: 'Kimi K3', d: 'Claude Sonnet 5' };
  var POD_ORD = ['1st', '2nd', '3rd', '4th'];
  var OK = ['a', 'b', 'c', 'd'];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---- mirrors of the real builders --------------------------------------- */

  function plate(slot, opts) {
    opts = opts || {};
    return '<figure class="jd-turn-plate"' +
      (opts.zoom ? ' role="button" tabindex="0" data-slot="' + slot + '"' +
        ' aria-label="Enlarge the artwork"' : '') + '>' +
      '<div class="jd-turn-art">' +
      '<span class="jd-turn-corner tl"></span><span class="jd-turn-corner tr"></span>' +
      '<span class="jd-turn-corner bl"></span><span class="jd-turn-corner br"></span>' +
      '<div class="jd-turn-art-in" role="img" aria-label="drawing ' +
      slot.toUpperCase() + '">' + ART[slot] + '</div>' +
      (opts.replay
        ? '<button type="button" class="jd-turn-draw" title="watch the drawing draw itself again">REPLAY ✎</button>'
        : '') +
      /* podium prints (owner, 2026-08-26): label inside the frame, grade
         spark along the foot — mirrors plate() in junk-drawer.js */
      (opts.overlay
        ? '<span class="jd-pod-tag" aria-hidden="true">Model ' +
          slot.toUpperCase() + '</span>' + (opts.spark || '')
        : '') +
      '</div>' +
      (opts.pin || opts.overlay
        ? '' : '<figcaption>Model ' + slot.toUpperCase() + '</figcaption>') +
      '</figure>';
  }

  function actions(inner) { return '<div class="jd-turn-actions">' + inner + '</div>'; }

  /* barHTML — the report card's segmented gauge, verbatim shape */
  function barHTML(rank, total, cls) {
    var full = Math.max(1, Math.min(total, rank));
    var h = '<span class="rc-bar ' + cls + '" aria-hidden="true">' +
      '<span class="rc-bar-fill" style="width:' +
      (100 * full / total).toFixed(1) + '%"></span>';
    for (var t = 1; t < total; t++) {
      h += '<span class="rc-bar-tick" style="left:' + (100 * t / total).toFixed(1) + '%"></span>';
    }
    return h + '</span>';
  }
  function axisCls(ax, rank) {
    return (ax.values.length === 4 ? 'rc-q' : 'rc-r') + rank;
  }

  function scaleRow(slot, ax, chosen) {
    var label = ax ? ax.label : 'overall grade';
    var desc = ax ? ax.desc : GRADE_DESC;
    var levels = ax ? ax.values : GRADES;
    var descId = 'jd-d-' + slot + '-' + (ax ? ax.id : 'grade');
    var gauge = '';
    if (chosen != null) {
      gauge = barHTML(chosen, levels.length,
        ax ? axisCls(ax, chosen) : 'rc-g' + chosen);
    }
    var h = '<div class="jd-row' + (ax ? '' : ' jd-row--grade') + '">' +
      '<div class="jd-rowhead">' +
      '<span class="jd-def" data-tt-t="' + esc(label) + '" data-tt-d="' + esc(desc) +
      '"><span>' + esc(label) + '</span></span></div>' +
      '<span class="jd-vh" id="' + descId + '">' + esc(desc) + '</span>' +
      '<div class="jd-row-ctrl">' + gauge +
      '<select class="jd-turn-select' + (chosen != null ? ' is-set' : '') +
      '" aria-label="' + esc(label) + ' for response ' + slot.toUpperCase() +
      '" aria-describedby="' + descId + '">' +
      '<option value=""' + (chosen == null ? ' selected' : '') + '>skip</option>';
    levels.forEach(function (l) {
      h += '<option value="' + l.rank + '"' +
        (chosen != null && chosen === l.rank ? ' selected' : '') + '>' +
        esc(l.label) + '</option>';
    });
    return h + '</select></div></div>';
  }

  /* THE DOCKET (owner redesign 2026-08-26, mockup-39): circled letters,
     graphite fill for finished steps, the drawn scales for "best to
     worst", hairline links solid-behind/dashed-ahead. Mirrors railHTML in
     junk-drawer.js. */
  var RAIL_SCALES =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M3.5 6 H20.5"/><circle cx="12" cy="3.8" r="1.2"/>' +
    '<path d="M12 6 V18.5 M8.5 19.5 H15.5"/>' +
    '<path d="M6 6 L3.5 11.5 M6 6 L8.5 11.5"/>' +
    '<path d="M2.5 11.5 A3.5 3.5 0 0 0 9.5 11.5"/>' +
    '<path d="M18 6 L15.5 11.5 M18 6 L20.5 11.5"/>' +
    '<path d="M14.5 11.5 A3.5 3.5 0 0 0 21.5 11.5"/></svg>';
  function railHTML(step, reached) {
    var steps = OK.map(function (s, i) {
      return { id: s, n: i + 1, label: 'drawing ' + s.toUpperCase(), face: s.toUpperCase() };
    });
    steps.push({ id: 'call', n: OK.length + 1, label: 'best to worst',
      face: RAIL_SCALES, word: 'ranking' });
    var h = '<div class="jd-rail" role="list">';
    steps.forEach(function (st, i) {
      var current = step === st.id;
      var isReached = reached.indexOf(st.id) !== -1;
      if (i > 0) {
        h += '<i class="jd-rail-lnk' + (isReached ? ' is-walked' : '') +
          '" aria-hidden="true"></i>';
      }
      h += '<button type="button" role="listitem" class="jd-rail-step' +
        (st.id === 'call' ? ' jd-rail-step--call' : '') +
        (current ? ' is-current' : isReached ? ' is-done' : '') + '"' +
        (current || isReached ? '' : ' disabled') +
        (current ? ' aria-current="step"' : '') +
        ' aria-label="step ' + st.n + ' — ' + st.label + '">' +
        '<span class="jd-rail-ring">' + st.face + '</span>' +
        '<span class="jd-rail-word">' + (st.word || st.label) + '</span>' +
        '</button>';
    });
    return h + '</div>';
  }

  function benchPanel(slot, answers) {
    var idx = OK.indexOf(slot);
    var h = '<div class="jd-bench">' +
      '<div class="jd-bench-l"><div class="jd-turn-pin">' +
      plate(slot, { pin: true, zoom: true, replay: true }) + '</div></div>' +
      '<div class="jd-bench-r">' +
      '<div class="jd-row jd-row--head" aria-hidden="true">' +
      '<span>Axis</span><span>Your rating</span></div>';
    AXES.forEach(function (ax) { h += scaleRow(slot, ax, answers[ax.id]); });
    h += scaleRow(slot, null, answers.grade);
    /* the report path (checkbox + note) is benched from the form
       (owner, 2026-08-26) — see the matching note in junk-drawer.js */
    var acts = '';
    if (idx > 0) acts += '<button type="button" class="jd-turn-alt">&larr; back</button>';
    var next = idx + 1 < OK.length ? 'drawing ' + OK[idx + 1].toUpperCase() : 'best to worst';
    acts += '<button type="button" class="jd-turn-go">next — ' + next + ' &rarr;</button>';
    return h + actions(acts) + '</div></div>';
  }

  /* sample overall grades for the podium sparks — what this visitor filed
     on the bench (d matches ANSWERED.grade; the rest invented) */
  var POD_GRADES = { a: 3, b: 5, c: 2, d: 4 };
  function podPrintHTML(slot, rank) {
    var g = POD_GRADES[slot];
    var spark = g == null ? '' :
      '<span class="jd-pod-spark" aria-hidden="true">' +
      barHTML(g, GRADES.length, 'rc-g' + g) + '</span>';
    return '<div class="jd-pod-print" data-pod="' + slot + '" data-slot="' + slot +
      '" role="button" tabindex="0" draggable="false" aria-label="Model ' +
      slot.toUpperCase() + (rank ? ', ' + POD_ORD[rank - 1] : ', unplaced') +
      '. Press to enlarge">' + plate(slot, { overlay: true, spark: spark }) + '</div>';
  }

  /* ranks: {slot: rank}; the working call (§5) */
  function callPanel(ranks) {
    var byRank = {};
    OK.forEach(function (s) { if (ranks[s]) byRank[ranks[s]] = s; });
    var placed = Object.keys(byRank).length;
    var ready = placed === OK.length && byRank[1];
    var h = '<div class="jd-pod"><div class="jd-pod-row">';
    for (var k = 1; k <= OK.length; k++) {
      var occ = byRank[k];
      h += '<div class="jd-pod-tier" data-rank="' + k + '" role="button" tabindex="0"' +
        ' aria-label="' + POD_ORD[k - 1] + (occ ? ', Model ' + occ.toUpperCase() : ', empty') + '">' +
        '<div class="jd-pod-stand">' +
        '<div class="jd-pod-hole"' + (occ ? ' hidden' : '') + ' aria-hidden="true"></div>' +
        (occ ? podPrintHTML(occ, k) : '') + '</div>' +
        '<div class="jd-pod-block">' + POD_ORD[k - 1] + '</div></div>';
    }
    h += '</div><div class="jd-pod-floor" aria-hidden="true"></div>';
    h += '<div class="jd-pod-tray' + (placed === OK.length ? ' is-bare' : '') +
      '" role="button" tabindex="0" aria-label="The row">';
    OK.forEach(function (s, i) {
      h += '<div class="jd-pod-cell" data-cell="' + i + '">' +
        (ranks[s] ? '' : podPrintHTML(s, 0)) + '</div>';
    });
    h += '</div><span class="jd-vh jd-pod-live" role="status"></span></div>';
    return h + actions(
      '<button type="button" class="jd-turn-alt">&larr; back</button>' +
      '<button type="button" class="jd-turn-go"' + (ready ? '' : ' disabled') +
      '>file the grades</button>');
  }

  /* the unveil (§6): the same podium, pedestals named */
  function saidPanel(ranks) {
    var byRank = {};
    OK.forEach(function (s) { if (ranks[s]) byRank[ranks[s]] = s; });
    var n = OK.length;
    var h = '<div class="jd-pod jd-pod--said"><div class="jd-pod-row">';
    for (var k = 1; k <= n; k++) {
      var occ = byRank[k];
      h += '<div class="jd-pod-tier" data-rank="' + k +
        '" style="--pdelay:' + ((n - k) * 180) + 'ms">' +
        '<div class="jd-pod-stand">' + (occ ? podPrintHTML(occ, k) : '') + '</div>' +
        '<div class="jd-pod-block"><span class="jd-pod-ord">' + POD_ORD[k - 1] +
        '</span>' + (occ ? '<span class="jd-pod-who"><b>' + esc(WHO[occ]) + '</b></span>' : '') +
        '</div></div>';
    }
    h += '</div><div class="jd-pod-floor" aria-hidden="true"></div></div>';
    return h + actions(
      '<button type="button" class="jd-turn-go">done</button>' +
      '<button type="button" class="jd-turn-alt">take another turn</button>');
  }

  function shell(title, view, body) {
    return '<div class="jd-turn-scrim is-on">' +
      '<div class="jd-turn" role="dialog" aria-modal="true" aria-label="' + esc(title) +
      '" data-view="' + view + '">' +
      '<header class="jd-turn-head"><div class="jd-turn-headline">' +
      '<h2 class="jd-turn-title" tabindex="-1">' + esc(title) + '</h2></div>' +
      '<button type="button" class="jd-turn-close" aria-label="close">' +
      '<span aria-hidden="true">✕</span></button></header>' +
      '<div class="jd-turn-scroll">' + body + '</div></div></div>';
  }

  /* ---- the stages --------------------------------------------------------- */

  var ANSWERED = { 'understanding-assignment': 3, 'structural-coherence': 3,
    layering: 2, jnsq: 2, grade: 4 };
  var MID_RANKS = { b: 1, d: 2 };                    /* two placed, two in the row */
  var FULL_RANKS = { b: 1, d: 2, a: 3, c: 4 };       /* podium full, ready to file */

  window.JD_STAGES = [
    { id: 'results',
      title: '§3 — The results',
      note: 'The 2×2 pile the darkroom hands off to. One button; the pencilled Model letters ride under each print.',
      html: shell('The results', 'plates',
        '<div class="jd-turn-plates">' + OK.map(function (s) { return plate(s); }).join('') + '</div>' +
        actions('<button type="button" class="jd-turn-go">grade them</button>')) },
    { id: 'bench-blank',
      title: '§4 — The bench, untouched (drawing A)',
      note: 'First bench step as the visitor lands on it: exhibit pinned left, paperwork right (portrait: stacked, exhibit sticky). Every scale opens on skip; the rail’s later steps are locked.',
      html: shell('Grade drawing A', 'bench',
        railHTML('a', ['a']) + benchPanel('a', {})) },
    { id: 'bench-answered',
      title: '§4 — The bench, filled in (drawing D)',
      note: 'A worked panel: chosen values grow the report card’s segmented gauge beside each select, and the grade row sits last above its rule (the broken-or-offensive report path was benched 2026-08-26). Button hands off to best to worst.',
      html: shell('Grade drawing D', 'bench',
        railHTML('d', ['a', 'b', 'c', 'd']) +
        benchPanel('d', ANSWERED)) },
    { id: 'call-mid',
      title: '§5 — Best to worst, mid-arrangement',
      note: 'The podium half-built: two prints stand on steps, two wait in the row, and FILE THE GRADES stays disabled until every survivor is placed.',
      html: shell('Best to worst', 'call',
        railHTML('call', ['a', 'b', 'c', 'd', 'call']) + callPanel(MID_RANKS)) },
    { id: 'call-full',
      title: '§5 — Best to worst, complete',
      note: 'All four placed — the row goes bare, the filing button arms.',
      html: shell('Best to worst', 'call',
        railHTML('call', ['a', 'b', 'c', 'd', 'call']) + callPanel(FULL_RANKS)) },
    { id: 'unveil',
      title: '§6 — Who drew what',
      note: 'The unveil: the visitor’s own podium, untouched, each pedestal learning its model’s name at the base. Names below are sample data.',
      html: shell('Who drew what', 'said', saidPanel(FULL_RANKS)) }
  ];

  /* ---- iframe mounting ----------------------------------------------------
     Each stage renders in its own iframe linking the REAL stylesheet, so
     media queries answer to the iframe's width — 390px engages the same
     portrait rules a phone does. The scrim keeps its live position:fixed;
     inside an iframe that IS the phone/desktop viewport. */
  window.JD_mountStage = function (frameEl, stage) {
    var doc = frameEl.contentDocument;
    doc.open();
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<link rel="stylesheet" href="../junk-drawer.css">' +
      '<style>' +
      /* site tokens junk-drawer.css expects from css/style.css */
      ':root{--banner-h:56px;--banner-h-mobile:48px;' +
      '--font-mono:"Courier Prime","Courier New",Courier,monospace;' +
      '--plot-red:#b22222;--ink:#111;--paper:#fff;--s-1:8px;--s-2:16px;--max-narrow:600px}' +
      '@media(max-width:768px){:root{--banner-h:48px}}' +
      /* stand-in for the drawer page glimpsed behind the scrim */
      'html,body{margin:0}body{background:#e8dfc4}' +
      '</style></head><body>' + stage.html + '</body></html>');
    doc.close();
  };
})();
