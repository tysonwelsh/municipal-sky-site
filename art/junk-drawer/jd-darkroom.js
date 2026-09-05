/* ============================================================================
   THE JUNK DRAWER — jd-darkroom.js
   The wait indicators the turn's darkroom deals to its four swatches, and
   nothing else: each is a generator that turns a seed (the turn's
   client_ref) into markup — a plotted circuit, the stray "please / wait",
   the scatterword LOADING…, the wristwatch, the honest bar, the word drift
   (plus the benched word mesh). The turn module (jd-turn.js) owns the
   swatches, the slot states and the card; it calls
     JD_dark.deal(seed)             the indicators dealt to slots a..d
     JD_dark.well(slot, anim, seed) one indicator's markup for a well
     JD_dark.mount(root)            build the word drift(s) in the painted DOM
     JD_dark.stopAll()              stop every drift's metronome
   Seeding is the house fold (JD_fnv1a / JD_xorshift, jd-core.js), so a
   repaint or a restored turn re-derives the identical animation. Loaded
   after jd-core.js and before jd-turn.js. See jd-core.js for the file map.
   ========================================================================== */
(function () {
  /* a fresh plotted circuit for slot A (round 18, owner pick 2026-08-17):
     a random spanning tree over a 5×3 grid of cells, then the closed tour
     that walks the fine 10×6 lattice around it — the classic plotter-art
     construction. Every intersection is visited exactly once, the line
     never crosses itself, and it ends where it began, so the CSS dash loop
     is seamless. ~1,242 distinct circuits observed over 2,000 seeds; the
     seed is the turn's client_ref, so every TURN draws a different circuit
     while repaints and restored turns re-derive the same one (paintSlots
     never rewrites a pending swatch, but the guarantee costs nothing).
     Geometry: 9px pitch + 4.5px margin = viewBox 0 0 90 54, and pathLength
     100 normalizes the dash arithmetic no matter where the turns fall. */
  function darkPlotCircuit(seed) {
    var CW = 5, CH = 3, PITCH = 9, MARGIN = 4.5, i;
    var rnd = JD_xorshift(JD_fnv1a(seed));   /* the house fold */
    /* randomized DFS spanning tree over the coarse cells; conn[cell] is a
       4-bit mask of tree edges: 1 up, 2 right, 4 down, 8 left */
    var conn = [], seen = [], stack = [], c, n, k;
    for (i = 0; i < CW * CH; i++) { conn.push(0); seen.push(false); }
    c = (rnd() * CW * CH) | 0;
    seen[c] = true; stack.push(c);
    while (stack.length) {
      c = stack[stack.length - 1];
      var cx = c % CW, cy = (c / CW) | 0, opts = [];
      if (cy > 0      && !seen[c - CW]) opts.push([c - CW, 1, 4]);
      if (cx < CW - 1 && !seen[c + 1])  opts.push([c + 1, 2, 8]);
      if (cy < CH - 1 && !seen[c + CW]) opts.push([c + CW, 4, 1]);
      if (cx > 0      && !seen[c - 1])  opts.push([c - 1, 8, 2]);
      if (!opts.length) { stack.pop(); continue; }
      k = opts[(rnd() * opts.length) | 0];
      n = k[0];
      conn[c] |= k[1]; conn[n] |= k[2];
      seen[n] = true; stack.push(n);
    }
    /* walk the fine lattice clockwise around the tree: at each vertex the
       move follows from its corner of the cell and the tree's edges —
       top-left goes up if the tree does (else right), and so on around */
    var x = 0, y = 0, px = [], py = [], v = 0;
    do {
      px.push(x); py.push(y);
      var m = conn[(y >> 1) * CW + (x >> 1)], ex = x & 1, ey = y & 1;
      if (!ex && !ey)     { if (m & 1) y--; else x++; }
      else if (ex && !ey) { if (m & 2) x++; else y++; }
      else if (ex && ey)  { if (m & 4) y++; else x--; }
      else                { if (m & 8) x--; else y--; }
      v++;
    } while ((x || y) && v <= CW * CH * 4);
    /* merge straight runs so the d stays short: keep only the turns */
    var d = 'M' + (MARGIN + px[0] * PITCH) + ' ' + (MARGIN + py[0] * PITCH), j;
    for (j = 1; j < px.length; j++) {
      var a = j - 1, b = (j + 1) % px.length;
      if ((px[a] === px[j] && px[j] === px[b]) ||
          (py[a] === py[j] && py[j] === py[b])) continue;
      d += 'L' + (MARGIN + px[j] * PITCH) + ' ' + (MARGIN + py[j] * PITCH);
    }
    return d + 'Z';
  }
  /* ---- the scatterword's ink ruler (owner report, 2026-08-30) ------------
     The stray's lesson, learned again one indicator over: the flight math
     runs on each glyph's BOX, but the eye watches the INK — and a glyph box
     carries half-leading above the ascender, air under the baseline, and
     side bearings plus the 0.08em tracking's trailing space, so when the box
     turned back at the roam wall the ink still had visible air on every
     side (the owner: the letters bounce off walls they never reach). Same
     cure as darkStrayInkInsets, per GLYPH this time — an L and a dot carry
     very different ink: offscreen clones of the assembled word (real
     classes, movers stilled, font pinned to a large px so cqw can't wobble
     the probe; two clones — see below — because the baseline probes cost
     tracking space) are measured in two steps. (1) THE BOX AND ITS BASELINE come
     from the DOM: each glyph span's rect, plus a zero-size inline-block
     probe inside it — an inline-block's baseline is its bottom edge, so the
     probe pins the glyph's baseline exactly where inline layout puts it
     (the dots' line-height:0 boxes measure 0px tall; their rects still
     carry the truth). (2) THE INK comes from canvas: the glyph drawn with
     its own computed font at that DOM baseline, alpha-scanned — and here
     the scatter needs one more idea than the stray did, because its glyphs
     SPIN. A wall is a straight edge, so the only ink that can ever touch
     it is the ink's CONVEX HULL; and a spinning glyph meets the wall at a
     different hull point every bounce. So instead of four box insets, the
     ruler returns each glyph's SUPPORT FUNCTION — how far the hull reaches
     from the box centre (the transform origin the flight translates and
     spins about) in each of 72 sampled directions, in em of the glyph's
     own font-size, the currency the track is emitted in. fly() reads it at
     the glyph's spin angle at each step, which is exact tangency: the
     bbox's mostly-empty corner never inflates the hit, and the real
     nearest ink lands on the wall whatever the tumble. A 0.025em safety
     (≈ stray's 0.4px at the sizes the swatch runs) keeps antialiased edges
     off the clipped wall. On any failure this returns null and the
     scatterword falls back to the old constant roam box — never a clip. */
  function darkScatterInkReach() {
    if (darkScatterInkReach.v !== undefined) return darkScatterInkReach.v;
    darkScatterInkReach.v = null;
    try {
      var CHARS = 'LOADING...';   /* must match darkScatterword's GLYPHS */
      var SAFE = 0.025, S = 2, SN = 72, i;   /* SN: support samples, 5° apart */
      var PROBE = '<span data-p style="display:inline-block;width:0;height:0"></span>';
      /* TWO clones of the word, because the probes are not free: tracking
         (letter-spacing 0.08em) applies after every character unit — a
         zero-size inline-block probe included — so a probed glyph's box is
         one tracking unit too wide and the error walks down the word, a
         glyph's worth per glyph. Clone A is pristine (and keeps the class's
         position:absolute, which blockifies the span exactly as the live
         word is blockified — a relative override leaves it inline, whose
         rect is a different animal): its rects are the live geometry, box
         centres included. Clone B carries the probes and answers ONE
         question, per glyph: how far below the box top the baseline sits —
         a vertical, which tracking cannot touch. */
      var mkA = '', mkB = '';
      for (i = 0; i < CHARS.length; i++) {
        var open2 = '<span class="jd-dark-gl jd-dark-gl' + i +
          '" style="animation:none;transform:none">' + CHARS.charAt(i);
        mkA += open2 + '</span>';
        mkB += open2 + PROBE + '</span>';
      }
      var host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-9999px;top:0;' +
        'visibility:hidden;pointer-events:none';
      host.innerHTML =
        '<span class="jd-dark-word" style="animation:none;left:0;top:0;' +
        'transform:none;font-size:44.2px">' + mkA + '</span>' +
        '<span class="jd-dark-word" style="animation:none;left:0;top:200px;' +
        'transform:none;font-size:44.2px">' + mkB + '</span>';
      document.body.appendChild(host);
      var word = host.querySelector('.jd-dark-word');
      var baseFs = parseFloat(getComputedStyle(word).fontSize);
      var gsA = word.querySelectorAll('.jd-dark-gl');
      var gsB = host.querySelectorAll('.jd-dark-word + .jd-dark-word .jd-dark-gl');
      var out = [], cv = document.createElement('canvas');
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) { document.body.removeChild(host); return null; }
      for (i = 0; i < gsA.length; i++) {
        var g = gsA[i], gB = gsB[i], probe = gB.querySelector('[data-p]');
        var gr = g.getBoundingClientRect();
        var baseAbs = gr.top + (probe.getBoundingClientRect().top -
          gB.getBoundingClientRect().top);
        var cs = getComputedStyle(g);
        var fs = parseFloat(cs.fontSize);
        if (!(fs > 0) || !(gr.width > 0)) { out = null; break; }
        /* margins catch overhang on every side; no letter-spacing on the
           canvas — tracking pads the ADVANCE after a glyph, never its ink */
        var M = fs * 1.25;
        cv.width = Math.ceil((gr.width + 2 * M) * S);
        cv.height = Math.ceil((fs + 2 * M) * S);
        ctx.setTransform(S, 0, 0, S, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        ctx.textAlign = 'left';          /* the span's text starts at its left edge */
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#000';
        ctx.fillText(CHARS.charAt(i), M, M);   /* canvas y=M ⇔ the DOM baseline */
        var img = ctx.getImageData(0, 0, cv.width, cv.height).data;
        /* per-row ink extents — the only pixels that can sit on the hull */
        var rows = [], any = false, x, y, rw;
        for (y = 0; y < cv.height; y++) {
          rw = null;
          for (x = 0; x < cv.width; x++) {
            if (img[(y * cv.width + x) * 4 + 3] > 16) {
              if (!rw) rw = [x, x]; else rw[1] = x;
              any = true;
            }
          }
          rows.push(rw);
        }
        if (!any) { out = null; break; }
        /* hull candidate points: the outer corners of each row's extreme
           pixels, as em offsets from the BOX CENTRE — the transform origin
           the flight spins about */
        var ox = gr.left + gr.width / 2, oy = gr.top + gr.height / 2;
        var pts = [], px2, py2, k2;
        for (y = 0; y < rows.length; y++) {
          if (!rows[y]) continue;
          for (k2 = 0; k2 < 4; k2++) {
            px2 = (k2 & 1) ? rows[y][1] + 1 : rows[y][0];
            py2 = (k2 & 2) ? y + 1 : y;
            pts.push([
              (gr.left + (px2 / S - M) - ox) / fs,
              (baseAbs + (py2 / S - M) - oy) / fs
            ]);
          }
        }
        /* the support samples: farthest reach among those points in each of
           SN directions (every candidate not on the hull can never win a
           max, so no explicit hull pass is needed), PLUS the safety — an
           inflated reach is what holds the ink that hair short of the
           clipped wall (deflating it, mirrored, would slice) */
        var sup = [], j2, ux, uy, bestd, d2, p2;
        for (j2 = 0; j2 < SN; j2++) {
          ux = Math.cos(j2 * 2 * Math.PI / SN);
          uy = Math.sin(j2 * 2 * Math.PI / SN);
          bestd = -1e9;
          for (p2 = 0; p2 < pts.length; p2++) {
            d2 = pts[p2][0] * ux + pts[p2][1] * uy;
            if (d2 > bestd) bestd = d2;
          }
          sup.push(bestd + SAFE);
        }
        /* the glyph's HOME CENTRE, measured off the same clone: its box
           centre relative to the word's, in em of the word's base type.
           The scatterword's CX/CY constants were measured 2026-08-18 on
           one platform's font; the live face can seat glyphs — the dots
           especially — a few tenths of a px elsewhere, and a flight
           anchored to a stale centre carries that error into every wall
           hit. Measured here, the anchor is platform-true; the constants
           stay as the no-ruler fallback. */
        var wr2 = word.getBoundingClientRect();
        out.push({
          sup: sup,
          cx: (ox - (wr2.left + wr2.width / 2)) / baseFs,
          cy: (oy - (wr2.top + wr2.height / 2)) / baseFs
        });
      }
      document.body.removeChild(host);
      darkScatterInkReach.v = out;
      return out;
    } catch (e) { return null; }
  }
  /* the scatterword for slot C (round-22 swap, owner pick 2026-08-18; the
     Win95 segmented block progress bar retires — mockup approved with seeded
     trajectories and the 3-bang super-cycle): the word LOADING… blown apart
     and pulled back together, forever.

     OWNER TUNING, 2026-08-18, three dials moved together and nothing else:
       · the type is 15% smaller (13 → 11.05 real-scale px) against an
         UNCHANGED 140×110 flight field, so the word sits more modestly on
         the paper while the explosion still throws it across the whole
         swatch. Only CX/CY/EM moved — the roam box did not;
       · the ellipsis is inked like the rest of the word (the blue is gone;
         see the CSS) — a sizing change only as far as this file cares; and
       · the bang runs at the 6s "house tempo" the owner picked off the
         variant sheet, up from the 4.2s "hard bang": a longer hold, a
         gentler impulse (V0 260 not 385) over a longer drag time (TAU 0.30
         not 0.24), lazier CURL, half the SPIN, and a slightly roomier ZOOP.
         Same choreography, walked instead of sprinted. BANGS stays 3, so
         the super-cycle is 18s.

     ONE BANG, IN BEATS. The word holds assembled just long enough to read.
     Then every glyph takes an impulse straight out along its own ray and
     FLIES — fastest at the instant of the bang, decelerating the whole way
     under quadratic drag, speed(t) = V0 / (1 + t/TAU). The float is not a
     second motion bolted on after the explosion; it IS the explosion's dying
     tail. The glyphs slow, curve (a slow constant CURL, so the early flight
     is a straight radial line and the late flight arcs lazily), knock back
     off the swatch's edges while they still have speed, and are barely
     moving by the end. Then the suction takes them: the zoop, a hard
     ease-IN that accelerates them inward and stops dead as the word snaps
     back onto its typed positions. Angular speed rides the same profile, so
     a glyph spins hardest right after the bang and the last of the spin is
     finished by the zoop — every glyph lands on a whole number of turns.

     WHY THIS IS GENERATED rather than hand-authored CSS, two reasons:
       · every TURN gets its own explosion — new rays, new spins, new walls
         to knock off — the way slot A gets its own circuit; and
       · the deceleration is baked into the WAYPOINT SPACING, not into an
         easing curve. Waypoints come out dense where the glyph is fast and
         sparse where it loiters (adaptive decimation to sub-pixel
         tolerance) and every flight keyframe is joined `linear`. That is
         what makes the outward throw readable frame by frame instead of
         reading as a cut, and no easing function in CSS draws that curve.
     A super-cycle is BANGS=3 of these end to end (owner-approved), so the
     swatch does not visibly repeat for 18s — three different explosions,
     each stratified into its own sector of the circle so no two of them can
     come out looking like the same bang.

     Seeded the house way (same FNV-1a → xorshift32 fold as darkPlotCircuit,
     from the turn's client_ref), so a repaint or a restored turn re-derives
     the identical animation, byte for byte. Emits a <style> block plus the
     glyph spans; the keyframe names and the binding selectors are all
     scoped by a prefix derived from that same hash, so two turns — or two
     slots, or a swatch left over mid-transition — can never collide.

     GEOMETRY. Everything is computed in "real-scale" px against a 140×110
     FIELD (the approved mockup's card) with an 11.05px glyph, then divided
     by each glyph's own font-size and emitted in em — so one generated
     stylesheet drives the swatch at every size the card ever takes. CX/CY
     are the glyph centres MEASURED in-browser from the assembled pose, and
     EM is the font-size each glyph's translate() resolves against (the
     three ellipsis dots are set 1.45×). They are only true for the exact
     type in the CSS: var(--tmono) at 700 with letter-spacing 0.08em and the
     dots' 1.45em / line-height 0 / −0.186em advance trim. Change any of
     those — including the glyph SIZE, as the 2026-08-18 tuning did — and
     these numbers must be re-measured, not adjusted by eye.
     The FIELD is deliberately not part of that: it stayed 140×110 through
     the shrink, which is why the roam box below is untouched and the
     explosion still covers as much of the swatch as it did before. */
  function darkScatterword(seed) {
    /* ---- choreography: FIXED for every seed, the 6s "house tempo" the
           owner picked off the variant sheet (2026-08-18) ----------------- */
    var BANG    = 6.0;      /* one bang, seconds                             */
    var BANGS   = 3;        /* bangs per super-cycle                         */
    var HOLD    = 0.70;     /* assembled hold, split across the loop seam    */
    var LEAD    = 0.35;     /* fraction of that hold before the impulse      */
    var ZOOP    = 0.38;     /* suction home, seconds                         */
    var EZ_ZOOP = 'cubic-bezier(.7,.05,.9,.92)'; /* accelerate in, dead stop */
    /* ---- physics: also fixed ------------------------------------------- */
    var V0  = 260;          /* muzzle speed, px/s at real scale              */
    var TAU = 0.30;         /* drag time constant, s                         */
    /* ---- what the seed is allowed to vary ------------------------------ */
    var V0_JITTER = 0.15;   /* ± fraction of V0                              */
    var RAY_JITTER = 10;    /* ± deg off the glyph's slot in the fan         */
    var SECTOR_JITTER = 32; /* ± deg a bang may wander inside its sector     */
    var CURL_MIN = 8, CURL_MAX = 17;      /* deg/s, either direction         */
    var SPIN_MIN = 450, SPIN_MAX = 700;   /* deg of spin during the flight   */
    var SPIN_LEFT_MIN = 80, SPIN_LEFT_MAX = 150; /* deg left for the snap    */
    /* ---- simulation / emission tuning ---------------------------------- */
    var DT = 0.003;         /* integration step, s                           */
    var POS_TOL = 0.60;     /* max waypoint error, real-scale px             */
    var ROT_TOL = 4.0;      /* …and degrees                                  */
    /* NEAR A WALL THE TOLERANCES TIGHTEN (2026-08-30, part of the ink-flush
       collision): the chord error is symmetric, so with the ink riding the
       wall exactly, POS_TOL of drift toward it — and the reach swing that
       ROT_TOL of rotation error buys — became a momentary CLIP under the
       well's overflow:hidden (measured up to ~0.9 real px on the dots).
       Within WALL_NEAR of any wall the chord must stay this much truer;
       elsewhere the old numbers stand, so the style barely grows. Their
       sum sits under the ruler's 0.025em safety — flush, never cut. */
    var WALL_NEAR = 2.0;    /* real px of clearance that counts as "near"    */
    var POS_TOL_W = 0.15;   /* near-wall waypoint error, real px             */
    var ROT_TOL_W = 1.0;    /* …and degrees                                  */
    var MAX_GAP = 0.20;     /* never leave a gap longer than this, s         */
    var ERR_PROBES = 6;     /* interior points probed per candidate chord    */
    var AIM_SWEEP = 54;     /* deg the ray may be nudged for clearance       */
    var AIM_STEP = 3;       /* granularity of that search, deg               */
    var AIM_CLEAR = 44;     /* px of clear run we try to buy                 */
    var AIM_COST = 0.45;    /* px of score paid per deg off the fan slot.
                               Deliberately steep: a weak penalty here lets
                               clearance override the seeded ray, and then
                               different seeds pick the SAME heading and the
                               bangs stop looking different from each other. */
    var EM_DP = 2, DEG_DP = 1, PCT_DP = 3;  /* 0.01em ≈ 0.11px at real scale */
    /* ---- the glyphs, measured (re-measured 2026-08-18 for the 11.05px
           type; the word now spans 0.537 of the field's width, was 0.632).
           Since 2026-08-30 CX/CY are the FALLBACK home centres: when the
           ink ruler runs, the live platform's own centres are measured off
           the same clone (HCX/HCY below) — these constants are one
           platform's 2026-08-18 reading, and a few tenths of a px of
           stale anchor shows once the ink bounces flush. ------------------ */
    var GLYPHS = 'LOADING...';
    var NG = 10;
    var CX = [36.16, 43.67, 51.19, 58.70, 66.22, 73.73, 81.25, 90.26, 97.79, 105.32];
    var CY = [55.00, 55.00, 55.00, 55.00, 55.00, 55.00, 55.00, 53.48, 53.48, 53.48];
    var EM = [11.05, 11.05, 11.05, 11.05, 11.05, 11.05, 11.05, 16.02, 16.02, 16.02];
    /* roam box for glyph CENTRES. Since 2026-08-30 (owner report: the
       letters bounced off walls they never reached) this is only (a) the
       clearance heuristic aim()/freeRun() score headings against, and
       (b) the FALLBACK walls when the ink ruler cannot run — the real
       collision below uses each glyph's measured ink extents, rotated to
       the glyph's spin at the moment of the hit, against the WELL's own
       edges, so the visible ink is what strikes the wall (the stray's
       principle, one indicator over; see darkScatterInkReach). */
    var XMIN = 8, XMAX = 132, YMIN = 12, YMAX = 98;
    /* THE WALLS THE INK STRIKES. Horizontally the field IS the well — the
       CSS sizes the field's 140-unit width to the swatch exactly (7.893cqw).
       Vertically the field (140×110, aspect 1.273) is letterboxed inside
       the well (41%×33% of the square card, aspect 41/33 ≈ 1.242), so the
       well's top and bottom edges sit a strip of (140·33/41 − 110)/2 ≈
       1.34 field-units beyond the field's own — the walls are pushed out
       to THEM, or a bounce would still turn back with the letterbox strip
       showing. Ink support samples per glyph arrive in em from the ruler
       and are cashed into real-scale px against EM here. */
    var YEXT = (140 * 33 / 41 - 110) / 2;
    /* CLEARANCE, SIDES ONLY (owner, 2026-08-30). The ink ruler put each
       glyph's real ink on the wall, which was the right idea — but the
       owner watching it reports the turn is honest at the TOP and BOTTOM
       and late on the LEFT and RIGHT, where letters cross the frame before
       coming back. The well is overflow:hidden and full-bleed, so a wall IS
       the clip: ink arriving past it is sliced, which is exactly what
       "drifting past the edge" looks like.
       The vertical walls are left alone — they are already right, and
       padding them would reintroduce the air the ruler removed. The
       horizontal pair get their clearance in FIELD units, so the gap holds
       whatever size the swatch takes: 5 units against the field's 140 is
       ~8px at the live width, still a fraction of the 7-26px of dead air
       the ink ruler was built to remove. ONE NUMBER TO TUNE if the sides
       now turn a shade early. */
    var WPADX = 5;
    var WX0 = WPADX, WX1 = 140 - WPADX;
    var WY0 = -YEXT, WY1 = 110 + YEXT;
    var inkEm = darkScatterInkReach();
    var INK = null, HCX = CX, HCY = CY;
    if (inkEm && inkEm.length === NG) {
      INK = []; HCX = []; HCY = [];
      for (i = 0; i < NG; i++) {
        var sup2 = [], j2;
        for (j2 = 0; j2 < inkEm[i].sup.length; j2++) {
          sup2.push(inkEm[i].sup[j2] * EM[i]);
        }
        INK.push(sup2);
        /* the word is centred in the well, and the field is centred in the
           well, so the word's box centre IS the field's (70, 55): the
           measured em offsets seat each glyph's live home centre exactly.
           EM[0] is the base type the offsets are counted in. */
        HCX.push(70 + inkEm[i].cx * EM[0]);
        HCY.push(55 + inkEm[i].cy * EM[0]);
      }
    }

    var DEG = Math.PI / 180;
    var CYCLE = BANG * BANGS;
    var T1 = HOLD * LEAD;                   /* impulse, local to the bang    */
    var T3 = BANG - (HOLD - T1) - ZOOP;     /* the suction grabs them        */
    var T4 = T3 + ZOOP;                     /* home                          */

    /* the house fold: FNV-1a of the seed string, then xorshift32 */
    var h = JD_fnv1a(seed), i;
    var prefix = 'jdsw' + h.toString(36);   /* scopes classes AND keyframes  */
    var rnd = JD_xorshift(h);
    function span(lo, hi) { return lo + rnd() * (hi - lo); }
    function coin() { return rnd() < 0.5 ? 1 : -1; }

    /* distance from (x, y) along `ang` before the roam box */
    function freeRun(x, y, ang) {
      var dx = Math.cos(ang), dy = Math.sin(ang), t = Infinity;
      if (dx > 1e-9) t = Math.min(t, (XMAX - x) / dx);
      else if (dx < -1e-9) t = Math.min(t, (XMIN - x) / dx);
      if (dy > 1e-9) t = Math.min(t, (YMAX - y) / dy);
      else if (dy < -1e-9) t = Math.min(t, (YMIN - y) / dy);
      return t;
    }
    /* Nudge a fan ray so the glyph has room to actually FLY outward: stay
       within ±AIM_SWEEP of its slot in the fan (the ten headings still cover
       the circle) but prefer a heading with a long clear run, so nothing
       smacks a wall 80ms in and loses its radial read. */
    function aim(x, y, target) {
      var best = target, bestScore = -1e9, dev, a, sc;
      for (dev = -AIM_SWEEP; dev <= AIM_SWEEP; dev += AIM_STEP) {
        a = target + dev * DEG;
        sc = Math.min(freeRun(x, y, a), AIM_CLEAR) - AIM_COST * Math.abs(dev);
        if (sc > bestScore) { bestScore = sc; best = a; }
      }
      return best;
    }
    /* one glyph's whole flight, integrated at DT; walls reflect elastically.
       THE COLLISION BODY IS THE INK (owner report, 2026-08-30 — the glyphs
       used to reverse with air showing on every side): when the ruler ran,
       `ink` carries this glyph's real-scale support samples — how far its
       ink's convex hull reaches from the box centre in each of 72
       directions — and each step reads them at the glyph's ROTATION at
       that instant. The reach toward a wall whose inward normal points
       along world direction φ is the hull's support at (φ − spin), so the
       walls for the CENTRE sit wherever the tumbling ink says: at the
       reversal the nearest real ink — a stem's end, a dot's rim, whatever
       the pose presents — is what touches the well, not a padded box and
       not a bounding rectangle's empty corner. Without the ruler, the old
       constant roam box falls out — never a clip, exactly the stray's
       degrade. */
    function fly(cx, cy, ang, v0, curl, rTotal, ink) {
      var n = Math.max(1, Math.round((T3 - T1) / DT));
      var dt = (T3 - T1) / n;
      var cc = Math.cos(curl * dt), ss = Math.sin(curl * dt);
      var denom = Math.log(1 + (T3 - T1) / TAU);
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var x = cx, y = cy;
      var ts = [T1], xs = [cx], ys = [cy], rs = [0], bz = [0], gs = [1e9];
      var k, t, sp, nx, ny, ndx, hit, r;
      var xlo = XMIN, xhi = XMAX, ylo = YMIN, yhi = YMAX;
      var SN = ink ? ink.length : 0;
      /* support at a world angle (degrees), linearly interpolated between
         the ruler's 5° samples — sub-hundredth-px error at glyph radii */
      function reach(phi) {
        var p = (phi / 360 * SN) % SN;
        if (p < 0) p += SN;
        var i0 = p | 0, f = p - i0;
        return ink[i0] * (1 - f) + ink[(i0 + 1) % SN] * f;
      }
      for (k = 1; k <= n; k++) {
        t = T1 + k * dt;
        /* spin on the same log profile as distance, normalised to rTotal —
           computed BEFORE the wall test since it is the collision's pose */
        r = rTotal * Math.log(1 + (t - T1) / TAU) / denom;
        if (ink) {
          xlo = WX0 + reach(180 - r); xhi = WX1 - reach(-r);
          ylo = WY0 + reach(-90 - r); yhi = WY1 - reach(90 - r);
        }
        sp = v0 / (1 + (k - 0.5) * dt / TAU);          /* midpoint speed */
        ndx = dx * cc - dy * ss; dy = dx * ss + dy * cc; dx = ndx;
        nx = x + dx * sp * dt;
        ny = y + dy * sp * dt;
        hit = 0;
        if (nx < xlo) { nx = 2 * xlo - nx; dx = -dx; hit = 1; }
        else if (nx > xhi) { nx = 2 * xhi - nx; dx = -dx; hit = 1; }
        if (ny < ylo) { ny = 2 * ylo - ny; dy = -dy; hit = 1; }
        else if (ny > yhi) { ny = 2 * yhi - ny; dy = -dy; hit = 1; }
        x = nx < xlo ? xlo : (nx > xhi ? xhi : nx);
        y = ny < ylo ? ylo : (ny > yhi ? yhi : ny);
        ts.push(t); xs.push(x); ys.push(y); bz.push(hit);
        rs.push(r);
        /* wall clearance at this step, for the decimator's near-wall gate */
        gs.push(Math.min(x - xlo, xhi - x, y - ylo, yhi - y));
      }
      return { ts: ts, xs: xs, ys: ys, rs: rs, bz: bz, gs: gs };
    }
    /* Does the straight chord i→cand stay within tolerance of the real
       flight? Probed at up to ERR_PROBES evenly spaced interior points: a
       segment never spans a bounce (those always cut), so between its ends
       the path is a smooth arc under monotonically decaying speed and has no
       high-frequency structure for the probes to step over. Keeping this
       O(1) per candidate is what keeps the whole generator linear. */
    function chordOk(s, i2, cand) {
      var steps = cand - i2, sp, probes, p, k, f, pt, rt;
      if (steps < 2) return true;
      sp = s.ts[cand] - s.ts[i2];
      probes = (steps - 1 < ERR_PROBES) ? steps - 1 : ERR_PROBES;
      for (p = 1; p <= probes; p++) {
        k = i2 + Math.round(steps * p / (probes + 1));
        if (k <= i2 || k >= cand) continue;
        f = (s.ts[k] - s.ts[i2]) / sp;
        /* the near-wall gate (see WALL_NEAR above): flush ink affords the
           chord no room to drift wallward, so truth is held tighter there */
        pt = s.gs[k] < WALL_NEAR ? POS_TOL_W : POS_TOL;
        rt = s.gs[k] < WALL_NEAR ? ROT_TOL_W : ROT_TOL;
        if (Math.abs(s.xs[i2] + (s.xs[cand] - s.xs[i2]) * f - s.xs[k]) > pt ||
            Math.abs(s.ys[i2] + (s.ys[cand] - s.ys[i2]) * f - s.ys[k]) > pt ||
            Math.abs(s.rs[i2] + (s.rs[cand] - s.rs[i2]) * f - s.rs[k]) > rt) {
          return false;
        }
      }
      return true;
    }
    /* Keep the fewest waypoints whose LINEAR-IN-TIME interpolation stays
       inside tolerance: dense while fast, sparse while loitering. Every
       bounce is forced to be a waypoint so the turn-back stays crisp. */
    function decimate(s) {
      var n = s.ts.length, keep = [0], i2 = 0, j, cand;
      while (i2 < n - 1) {
        j = i2 + 1;
        if (!s.bz[j]) {
          while (j + 1 < n) {
            cand = j + 1;
            if (s.ts[cand] - s.ts[i2] > MAX_GAP) break;
            if (!chordOk(s, i2, cand)) break;
            j = cand;
            if (s.bz[cand]) break;
          }
        }
        keep.push(j);
        i2 = j;
      }
      return keep;
    }
    /* one bang: ten independent flights. `base` and `fanDir` come from the
       super-cycle below, not from here — a bang's fan is a rigid golden-angle
       ring, so if two bangs drew similar bases independently the two
       explosions would look the same. The caller stratifies them instead. */
    function simulateBang(base, fanDir) {
      var out = [], g, ang, v0, curl, sg, turns, rTotal, rHome, s;
      for (g = 0; g < NG; g++) {
        /* golden angle between NEIGHBOURING glyphs, so adjacent letters —
           and the three dots, which start out touching — tear apart in very
           different directions while the ten headings still cover the circle */
        ang = aim(HCX[g], HCY[g],
          (base + fanDir * g * 137.5 + span(-RAY_JITTER, RAY_JITTER)) * DEG);
        v0 = V0 * (1 + span(-V0_JITTER, V0_JITTER));
        curl = span(CURL_MIN, CURL_MAX) * coin() * DEG;
        sg = coin();
        /* land the flight's spin a controlled 80–150deg short of a whole
           number of turns, so the zoop finishes it with a quarter-turn snap */
        turns = Math.max(1, Math.round(span(SPIN_MIN, SPIN_MAX) / 360));
        rTotal = sg * (360 * turns - span(SPIN_LEFT_MIN, SPIN_LEFT_MAX));
        rHome = sg * 360 * turns;
        s = fly(HCX[g], HCY[g], ang, v0, curl, rTotal, INK && INK[g]);
        out.push({ s: s, keep: decimate(s), rHome: rHome });
      }
      return out;
    }
    function tf(dx, dy, rot, em) {
      return 'translate(' + (dx / em).toFixed(EM_DP) + 'em,' +
        (dy / em).toFixed(EM_DP) + 'em) rotate(' + rot.toFixed(DEG_DP) + 'deg)';
    }
    function pc(t) { return (t / CYCLE * 100).toFixed(PCT_DP); }

    /* Stratify the three bangs around the circle instead of drawing three
       independent bases: each gets its own 360/BANGS sector (plus jitter,
       plus a coin flip on which way its fan is dealt round the circle). */
    var bangs = [], b, base0 = rnd() * 360;
    for (b = 0; b < BANGS; b++) {
      bangs.push(simulateBang(base0 + b * (360 / BANGS) +
        span(-SECTOR_JITTER, SECTOR_JITTER), coin()));
    }

    var out = ['<style>'], j, idx, rotAcc, tOff, tr, keep, s;
    for (i = 0; i < NG; i++) {
      out.push('@keyframes ', prefix, '_', i, '{0%{transform:', tf(0, 0, 0, EM[i]), '}');
      rotAcc = 0;
      for (b = 0; b < BANGS; b++) {
        tOff = b * BANG;
        tr = bangs[b][i]; s = tr.s; keep = tr.keep;
        /* flat hold right up to the impulse — the word must be EXACTLY the
           typed word for the whole beat, not merely near it */
        out.push(pc(tOff + T1), '%{transform:', tf(0, 0, rotAcc, EM[i]), '}');
        for (j = 1; j < keep.length; j++) {
          idx = keep[j];
          out.push(pc(tOff + s.ts[idx]), '%{transform:',
            tf(s.xs[idx] - HCX[i], s.ys[idx] - HCY[i], rotAcc + s.rs[idx], EM[i]));
          /* the last flight waypoint is where the suction takes over, and
             it carries the only easing curve in the whole animation */
          if (j === keep.length - 1) out.push(';animation-timing-function:', EZ_ZOOP);
          out.push('}');
        }
        rotAcc += tr.rHome;
        out.push(pc(tOff + T4), '%');
        if (b === BANGS - 1) out.push(',100%');
        out.push('{transform:', tf(0, 0, rotAcc, EM[i]), '}');
      }
      out.push('}');
    }
    /* The bindings live inside the reduced-motion guard, so a visitor who
       has asked for stillness gets the base pose — the assembled word — and
       the @keyframes above go inert with nothing referencing them. The
       DURATION is emitted here too, from CYCLE: change BANG or BANGS and the
       super-cycle length can never drift out of sync with a hand-written
       number in the stylesheet. Everything else about the loop
       (iteration-count, the linear joins, fill-mode) is in junk-drawer.css
       with the other slots. */
    out.push('@media (prefers-reduced-motion:no-preference){');
    out.push('.', prefix, ' .jd-dark-gl{animation-duration:', CYCLE.toFixed(2), 's}');
    for (i = 0; i < NG; i++) {
      out.push('.', prefix, ' .jd-dark-gl', i, '{animation-name:', prefix, '_', i, '}');
    }
    out.push('}</style><span class="jd-dark-word ', prefix, '">');
    for (i = 0; i < NG; i++) {
      out.push('<span class="jd-dark-gl jd-dark-gl', i, '">', GLYPHS.charAt(i), '</span>');
    }
    out.push('</span>');
    return out.join('');
  }
  /* the honest bar (rounds 24–25, owner pick 2026-08-21 — the pool's first
     member beyond the original four; tuned on mockup-24-honest-bar.html's
     bench, dressed by mockup-25-bar-styles.html's hatched-stripes option):
     a hand-wobbled ink bar outline whose hatched fill climbs SLOWLY, stalls,
     takes real setbacks, and once it gets above ~80 starts second-guessing
     itself in wider swings — never finishing, never quite erratic, and when
     the super-cycle ends it sighs and starts the climb over. No percentage,
     no "est. remaining": the commentary is entirely in the motion.
     OWNER TUNING, 2026-08-21 (pasted off the bench's copy-parameters
     button): rate 6, setback 0.17, depth 18, thresh 80, amp 12, tick 300ms.
     GENERATED, the house way (darkScatterword's precedent): the whole climb
     is simulated once per turn from the turn's client_ref and baked into a
     seed-scoped @keyframes track — one waypoint per tick, every segment
     joined steps(1, end), so the bar HOLDS each value for a tick and then
     jumps, like ink laid down one stroke at a time. A repaint or a restored
     turn re-derives the same climb byte for byte; reduced-motion visitors
     get the static base (parked at 68%) with the track inert. The loop seam
     is the joke completing itself: fluctuating in the high eighties at
     100%, then 0%. */
  function darkHonestBar(seed) {
    /* THE TELETYPE (owner pick, mockups/mockup-38-honest-bars.html option B,
       2026-08-26; the wobbled frame and hatched fill retire). The bar is set
       entirely in type, kin to the wait-words: the word LOADING (no
       ellipsis) shivering above a typed track — [####··········] — and a
       two-digit readout that LIES on its own schedule: usually the truth,
       every few ticks a number from nowhere, occasionally a ?? shrug. The
       joke said twice.
       Same architecture as before: everything is baked into this generated
       <style> from the seeded track — the cells are stacked #/· glyph pairs
       toggled by change-point keyframes, the readout is two one-glyph
       odometer strips stepped by translateY, the shiver is its own short
       seeded loop — so the whole thing runs on the animation clock with no
       JS ticking, pauses with the settle states, and a repaint re-derives
       the identical performance. */
    /* the bench's knobs, fixed by the owner 2026-08-21 */
    var RATE = 6, SETBACK = 0.17, DEPTH = 18, THRESH = 80, AMP = 12;
    var TICK = 0.3;          /* seconds per tick                              */
    var TICKS = 150;         /* the super-cycle: 150 × 0.3s = 45s             */
    var SEG = 14;            /* typed cells between the brackets              */
    /* the house fold: FNV-1a of the seed string, then xorshift32 */
    var h = JD_fnv1a(seed), i;
    var prefix = 'jdhb' + h.toString(36);   /* scopes classes AND keyframes */
    var rnd = JD_xorshift(h);
    /* the bench's motion model, verbatim: below the threshold a slow climb
       with stalls and setbacks; above it a mean-reverting wander around the
       high eighties — wider swings, but it never sprints, never finishes,
       and never falls apart. Alongside the true track, the readout's track:
       strip indices 0–9 are digits, 10 is the ? and 11 the blank tens of a
       single-digit value. */
    var fills = [], tens = [], units = [], v = 0, r, lie, shown, k;
    for (k = 0; k <= TICKS; k++) {
      fills.push(Math.round(v / 100 * SEG));
      lie = rnd();
      shown = lie < 0.12 ? Math.round(rnd() * 99)
            : lie < 0.18 ? -1 : Math.round(v);
      tens.push(shown < 0 ? 10 : shown < 10 ? 11 : Math.floor(shown / 10));
      units.push(shown < 0 ? 10 : shown % 10);
      r = rnd();
      if (v < THRESH) {
        if (r < SETBACK) v -= rnd() * DEPTH;            /* a setback */
        else if (r < SETBACK + 0.18) { /* a stall: hold this tick */ }
        else v += rnd() * RATE;                         /* the climb */
      } else {
        v += (THRESH + 5 - v) * 0.12 + (rnd() - 0.5) * 2 * AMP * 0.4;
      }
      v = Math.max(0, Math.min(98, v));
    }
    /* one keyframes block per series, CHANGE POINTS only — steps(1,end)
       between stops holds each value to the next, so a cell that toggles
       six times a cycle costs six lines, not 150 */
    function stepsKf(name, series, fmt) {
      var o = ['@keyframes ', prefix, name, '{'], prev = null, k;
      for (k = 0; k < series.length; k++) {
        if (series[k] === prev && k !== series.length - 1) continue;
        o.push((k / TICKS * 100).toFixed(3), '%{', fmt(series[k]),
          ';animation-timing-function:steps(1,end)}');
        prev = series[k];
      }
      return o.join('') + '}';
    }
    var DUR = (TICKS * TICK).toFixed(1) + 's';
    var out = ['<style>'];
    var binds = [];
    for (i = 0; i < SEG; i++) {
      var cell = fills.map(function (f) { return i < f ? 1 : 0; });
      out.push(stepsKf('_c' + i, cell, function (on) { return 'opacity:' + on; }));
      out.push(stepsKf('_e' + i, cell, function (on) { return 'opacity:' + (1 - on); }));
      binds.push('.', prefix, ' .t-c:nth-child(', i + 1, ') .gf{animation:',
        prefix, '_c', i, ' ', DUR, ' linear infinite both}',
        '.', prefix, ' .t-c:nth-child(', i + 1, ') .ge{animation:',
        prefix, '_e', i, ' ', DUR, ' linear infinite both}');
    }
    function slide(idx) { return 'transform:translateY(-' + idx + 'em)'; }
    out.push(stepsKf('_dt', tens, slide), stepsKf('_du', units, slide));
    binds.push('.', prefix, ' .t-dt .t-ds{animation:', prefix, '_dt ', DUR,
      ' linear infinite both}',
      '.', prefix, ' .t-du .t-ds{animation:', prefix, '_du ', DUR,
      ' linear infinite both}');
    /* the shiver: the word worries in place — a short seeded loop of
       one-pixel-ish lurches, stepwise like everything else here */
    out.push('@keyframes ', prefix, '_sh{');
    for (k = 0; k < 8; k++) {
      out.push((k / 8 * 100).toFixed(1), '%{transform:translateX(',
        (rnd() * 3 - 1.5).toFixed(1), 'px)}');
    }
    out.push('100%{transform:translateX(0)}}');
    binds.push('.', prefix, ' .t-word{animation:', prefix, '_sh 2.7s ',
      'steps(1,end) infinite}');
    out.push('@media (prefers-reduced-motion:no-preference){',
      binds.join(''), '}</style>');
    /* the markup: the word, then the typed track and its readout */
    out.push('<span class="jd-dark-tele ', prefix, '">',
      '<b class="t-word">LOADING</b>',
      '<span class="t-line">[');
    for (i = 0; i < SEG; i++) {
      out.push('<span class="t-c"><i class="gf">#</i><i class="ge">·</i></span>');
    }
    var strip = '<span class="t-ds"><i>0</i><i>1</i><i>2</i><i>3</i><i>4</i>' +
      '<i>5</i><i>6</i><i>7</i><i>8</i><i>9</i><i>?</i><i>&nbsp;</i></span>';
    out.push('] <span class="t-d t-dt">', strip, '</span>',
      '<span class="t-d t-du">', strip, '</span>%</span></span>');
    return out.join('');
  }
  /* the pending face: one retro wait indicator per slot, printed in ink on
     the graph paper. All of it is decoration — aria-hidden by the caller. */
  /* THE ROTATION (round 24, owner directive 2026-08-21): the waiting
     indicators are a POOL, not a seating chart — dealt fresh every turn so
     two runs of a prompt no longer show the same card and no two swatches
     in a turn ever match. The pool has run six deep; with 'words' benched
     (2026-08-30) it holds exactly four, so the deal is a full permutation
     and no indicator sits a turn out any more. The deal is a
     Fisher–Yates shuffle of the pool, seeded the house way from the turn's
     client_ref, so a repaint or a restored turn re-derives the same
     arrangement. The slot letters now mean POSITION only (the pencilled
     corner labels the later cards reference); which indicator a position
     hosts is the turn's own business. Each well wears its indicator's name
     — jd-dark-well--plot/stray/scatter/watch/bar/drift/words — and the
     CSS keys the full-bleed and overflow tailoring to THAT, not to the slot. */
  /* ---- the word drift (round 27) ------------------------------------------
     The rain, rewritten in English. Columns of words fall one letter to a
     printed square, strike the bottom rule, are thrown off it, and settle into
     a heap along the floor. How deep the heap is, is how long you have waited.

     It replaces the carbon rain — 78 writing systems and 5987 generated
     characters — which read as texture rather than as language. The owner
     wanted the wait said in words you can read. The falling is unchanged; the
     alphabet and the landing are new, and the generated character pool and its
     per-script font-size table are gone with it.

     ONE LETTER, ONE ELEMENT, created when it is due and gone when it is spent.
     No pool, nothing recycled. The bench version began with a fixed set of
     glyphs per column passed round — land one, relaunch it, retire it into the
     heap, mint a replacement — which needs the pool sized against a round
     trip, retire and replace to balance exactly, and a starvation guard for
     when they don't. Any slip there quietly shrinks the column, and words lose
     letters the longer it runs. A letter per element cannot drift out of
     balance. The cost is a few DOM nodes a second per column.
     -------------------------------------------------------------------- */
  var JD_DRIFT_WORDS = ['LOADING', 'STAND BY', 'PLEASE WAIT',
                        'ONE MOMENT PLEASE', 'PENDING', 'PROCESSING',
                        'PLEASE HOLD', 'ASSEMBLING', 'COMPUTING',
                        'AWAITING RESPONSES', 'TRANSMISSION IN PROGRESS',
                        'DO NOT ADJUST YOUR SET', 'TRANSMITTING',
                        'DO NOT REFRESH', 'REMAIN SEATED',
                        'PATIENCE IS APPRECIATED'];
  /* the owner's bench settings, 2026-08-23 (mockup-33-word-drift.html) */
  var JD_DRIFT = { cell: 9, density: 0.2, speedLo: 30, speedHi: 60,
                   throwLo: 50, throwHi: 200, liftLo: 70, liftHi: 230,
                   gravity: 1600, gap: 20, maxDepth: 10, cap: 900 };

  function jdDriftRnd(n) { return (Math.random() * n) | 0; }

  /* the floor is the sheet's OWN floor (owner report 2026-08-29): the
     darkroom paints while the card is still transitioning, so the height
     jdDriftBuild reads can run tens of px deep — and every letter landed
     below the frame until the heap grew back into view. Re-read the host
     before each letter is dealt: any bucket still at the virgin floor
     follows the container's real bottom edge; a bucket already carrying
     heap keeps its surface, so nothing landed ever moves. */
  function jdDriftSync(st) {
    var H = st.host.clientHeight;
    if (!H || H === st.H) return;
    for (var b = 0; b < st.top.length; b++) if (st.top[b] === st.H) st.top[b] = H;
    st.H = H;
    st.floorLimit = H - JD_DRIFT.maxDepth * JD_DRIFT.cell;
  }

  /* the heap's height field, in buckets a third of a square wide */
  function jdDriftSurface(st, x) {
    var C = JD_DRIFT.cell;
    var b0 = Math.max(0, Math.floor(x / st.bw));
    var b1 = Math.min(st.top.length - 1, Math.floor((x + C) / st.bw));
    var y = st.H;
    for (var b = b0; b <= b1; b++) if (st.top[b] < y) y = st.top[b];
    return y;
  }
  function jdDriftDeposit(st, x, restY) {
    var C = JD_DRIFT.cell;
    var b0 = Math.max(0, Math.floor(x / st.bw));
    var b1 = Math.min(st.top.length - 1, Math.floor((x + C) / st.bw));
    var t = restY + C * 0.56;              /* the next letter nests into this one */
    for (var b = b0; b <= b1; b++) if (t < st.top[b]) st.top[b] = t;
  }
  /* gravity down, reflected off the side walls, stopped by the heap */
  function jdDriftFly(st, x0, y0, vx, vy) {
    var C = JD_DRIFT.cell, dt = 1 / 60;
    var pts = [{ x: x0, y: y0 }], x = x0, y = y0;
    for (var n = 0; n < 240; n++) {
      vy += JD_DRIFT.gravity * dt; x += vx * dt; y += vy * dt;
      if (x <= 0) { x = -x; vx = -vx * 0.46; }
      else if (x >= st.W - C) { x = 2 * (st.W - C) - x; vx = -vx * 0.46; }
      var floorY = jdDriftSurface(st, x) - C;
      if (y >= floorY && vy > 0) { y = floorY; pts.push({ x: x, y: y }); break; }
      pts.push({ x: x, y: y });
    }
    return pts;
  }

  /* a lane is free only if nothing has RESERVED it and nothing is falling in
     it — reservation alone let a finished word's lane be taken while its last
     letters were still on their way down, and two words shared a column */
  function jdDriftClaim(st, owner, avoid) {
    var free = [], i;
    for (i = 0; i < st.cols; i++) if (!st.busy[i] && !st.lane[i]) free.push(i);
    if (!free.length) { st.busy[avoid] = owner; return avoid; }
    var p = free[jdDriftRnd(free.length)];
    st.busy[p] = owner;
    return p;
  }

  /* the next letter this column owes. REVERSED when a word is taken up:
     letters are dealt one per beat and each is a beat behind the last, so the
     letter sent first ends up LOWEST. Queued in reading order a word comes out
     upside down — LOADING reads GNIDAOL down the sheet. */
  function jdDriftNext(col) {
    var st = col.st;
    if (!col.queue.length) {
      if (col.rest > 0) { col.rest--; return null; }    /* the gap between words */
      /* no word twice on one sheet (owner, 2026-08-26): a column releases
         its word only here, when it is done spelling it, and deals the next
         from the words no other column holds. The fallback deck cannot be
         reached at 5 columns over 16 words; it is there so a future tuning
         (more columns, fewer words) degrades to repetition, not to a stall. */
      if (col.word) { delete st.inPlay[col.word]; col.word = null; }
      var deck = st.words.filter(function (w) { return !st.inPlay[w]; });
      if (!deck.length) deck = st.words;
      col.word = deck[jdDriftRnd(deck.length)];
      st.inPlay[col.word] = 1;
      col.queue = Array.from(col.word).reverse();
      col.rest = JD_DRIFT.gap;
      if (st.busy[col.c] === col) st.busy[col.c] = null;
      col.c = jdDriftClaim(st, col, col.c);             /* a new word, a new lane */
      col.x = col.c * JD_DRIFT.cell;
    }
    return col.queue.shift();
  }

  /* delayMs is how far from NOW this letter was actually due — negative when
     the metronome fired late. Handing it to the animation makes the letter's
     position depend on the schedule rather than on when the timer happened to
     run; without it, jitter of a tenth of a second puts a letter most of a
     square out and it lands on the one below. */
  function jdDriftEmit(col, delayMs) {
    var st = col.st, C = JD_DRIFT.cell;
    jdDriftSync(st);              /* the landing floor = the container floor */
    var ch = jdDriftNext(col);
    if (ch === null || ch === ' ') return;              /* the beat still passes */

    var x0 = col.x;
    var g = document.createElement('i');
    g.textContent = ch;
    g.style.left = x0 + 'px';
    col.el.appendChild(g);

    var lane = Math.round(x0 / C);
    st.lane[lane] = (st.lane[lane] || 0) + 1;

    var impactY = jdDriftSurface(st, x0) - C;
    var fallMs = Math.max(60, (impactY - col.y0) / col.speed * 1000);
    var vx = (Math.random() < 0.5 ? -1 : 1) *
             (JD_DRIFT.throwLo + Math.random() * (JD_DRIFT.throwHi - JD_DRIFT.throwLo));
    var vy = -(JD_DRIFT.liftLo + Math.random() * (JD_DRIFT.liftHi - JD_DRIFT.liftLo));
    var pts = jdDriftFly(st, x0, impactY, vx, vy);
    var flightMs = (pts.length - 1) / 60 * 1000;
    var spin = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 340);
    var total = fallMs + flightMs, i, f;

    /* sampled, not eased: no easing curve expresses constant acceleration, and
       an approximated one reads as a hang at the top of the throw */
    var frames = [
      { transform: 'translate(0px,' + col.y0 + 'px) rotate(0deg)', offset: 0, easing: 'linear' },
      { transform: 'translate(0px,' + impactY + 'px) rotate(0deg)',
        offset: fallMs / total, easing: 'linear' }];
    for (i = 1; i < pts.length; i++) {
      f = i / (pts.length - 1);
      frames.push({ transform: 'translate(' + (pts[i].x - x0).toFixed(1) + 'px,' +
        pts[i].y.toFixed(1) + 'px) rotate(' + (spin * f).toFixed(0) + 'deg)',
        offset: Math.min(1, (fallMs + f * flightMs) / total), easing: 'linear' });
    }
    var anim = g.animate(frames, { duration: total, delay: delayMs || 0, fill: 'both' });
    var rest = pts[pts.length - 1];

    /* POLLED, not evented: this WebView does not fire animation finish events
       while the page is hidden, and a wait that starts in a background tab
       would never land a single letter */
    var poll = setInterval(function () {
      if (anim.playState !== 'finished') return;
      clearInterval(poll);
      var ix = st.polls.indexOf(poll); if (ix >= 0) st.polls.splice(ix, 1);
      if (st.lane[lane]) st.lane[lane]--;
      if (st.n < JD_DRIFT.cap && rest.y > st.floorLimit) {
        anim.cancel();
        g.style.left = rest.x.toFixed(1) + 'px';
        g.style.top = rest.y.toFixed(1) + 'px';
        g.style.transform = 'rotate(' + ((spin % 360) + (jdDriftRnd(19) - 9)) + 'deg)';
        st.layer.appendChild(g);              /* the same letter, now at rest */
        jdDriftDeposit(st, rest.x, rest.y);
        st.n++;
      } else {
        g.remove();                           /* the heap is full: it is spent */
      }
    }, 40);
    st.polls.push(poll);
  }

  /* every drift on the page, so a repaint or a settle can stop them all */
  var jdDriftSheets = [];
  function jdDriftStopAll() {
    jdDriftSheets.forEach(function (st) {
      st.beats.forEach(clearInterval);
      st.polls.forEach(clearInterval);
      st.beats = []; st.polls = [];
    });
    jdDriftSheets = [];
  }

  function jdDriftBuild(host) {
    var C = JD_DRIFT.cell;
    var W = host.clientWidth, H = host.clientHeight;
    if (!W || !H) return false;
    host.innerHTML = '';
    var st = { W: W, H: H, host: host, bw: C / 3, cols: Math.floor(W / C), top: [],
               busy: {}, lane: {}, n: 0, words: JD_DRIFT_WORDS, inPlay: {},
               floorLimit: H - JD_DRIFT.maxDepth * C, beats: [], polls: [] };
    for (var b = 0; b < Math.ceil(W / st.bw) + 1; b++) st.top.push(H);
    var layer = document.createElement('span');
    layer.className = 'drift';
    host.appendChild(layer);
    st.layer = layer;
    jdDriftSheets.push(st);

    var bag = [], i, j, t;
    for (i = 0; i < st.cols; i++) bag.push(i);
    for (i = bag.length - 1; i > 0; i--) {
      j = jdDriftRnd(i + 1); t = bag[i]; bag[i] = bag[j]; bag[j] = t;
    }
    bag.slice(0, Math.max(1, Math.round(st.cols * JD_DRIFT.density)))
       .forEach(function (idx) {
      var el = document.createElement('span');
      el.className = 'col';
      host.appendChild(el);
      var speed = JD_DRIFT.speedLo + Math.random() * (JD_DRIFT.speedHi - JD_DRIFT.speedLo);
      var col = { el: el, c: idx, x: idx * C, st: st, speed: speed,
                  y0: -(C * (2 + jdDriftRnd(5))), beat: C / speed * 1000,
                  queue: [], word: null, rest: jdDriftRnd(JD_DRIFT.gap) };
      st.busy[idx] = col;
      /* One metronome per column, but WHEN EACH LETTER IS DUE is kept on a
         cursor rather than taken from when the timer fired. A beat is exactly
         one square of falling, so letters stay a square apart however badly
         the timer behaves. */
      col.next = performance.now() + Math.random() * 600;
      st.beats.push(setInterval(function () {
        /* while the tab is hidden the animation clock stops but timers do not,
           so emitting would mint letters that can never fall, land, or be
           cleared up — they pile up for as long as the visitor is elsewhere */
        if (document.hidden) { col.next = performance.now(); return; }
        var now = performance.now();
        if (now - col.next > col.beat * 6) col.next = now;   /* woke up behind */
        while (col.next <= now + 4) {
          jdDriftEmit(col, col.next - now);
          col.next += col.beat;
        }
      }, Math.max(24, col.beat / 2)));
    });
    return true;
  }

  function jdDriftMount(root) {
    jdDriftStopAll();
    var hosts = (root || document).querySelectorAll('.jd-drift');
    if (!hosts.length) return;
    /* setTimeout, NOT requestAnimationFrame: rAF is parked while the tab is
       hidden, and the swatch must be built and measured even if the visitor
       sent the turn and switched away immediately */
    Array.prototype.forEach.call(hosts, function (host) {
      var tries = 0;
      (function attempt() {
        if (jdDriftBuild(host)) return;
        if (++tries < 20) setTimeout(attempt, 40);   /* not laid out yet */
      })();
    });
  }

  /* 'bar' — the honest progress bar — is BENCHED, not deleted (owner,
     2026-08-21): darkHonestBar(), its darkWell branch and its CSS are all
     still here and still work. Put the string back in this array and it
     rejoins the rotation; nothing else needs touching.
     'plot' — the plotter circuit — joined it on the bench (owner,
     2026-08-26), on the same terms: darkPlotCircuit(), its darkWell branch
     and its CSS all stay.
     'words' — the Kimi's Take word mesh — joined them (benched, owner call
     2026-08-30): its falling word-streams cross the sheet and leave without
     ever piling, and twice running the owner took them for a broken word
     drift. One letters animation in the pool, the one that piles; the mesh's
     darkWell branch, its CSS and mini.php all stay, and the full piece
     lives on at /art/kimis-take/. */
  var DARK_POOL = ['stray', 'scatter', 'watch', 'drift'];
  function darkDeal(seed) {
    var rnd = JD_xorshift(JD_fnv1a(seed + ':rota')), i;
    var deck = DARK_POOL.slice(), j, t;
    for (i = deck.length - 1; i > 0; i--) {
      j = (rnd() * (i + 1)) | 0;
      t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    return deck;   /* slot a takes deck[0], b deck[1], and so on */
  }
  /* ---- the stray's ink ruler (owner directive, 2026-08-26) ---------------
     The ricochet's travel math runs on the word's BOX, but the eye watches
     the INK — and every face in the .sy stack (Snell Roundhand down to the
     cursive fallback) seats its ink differently inside that box: half-leading
     above the ascenders, no descenders at all on "wait", swash overhangs at
     the sides. So the box used to kiss the wall while the ink hung back —
     up to ~17px of air at the bottom. This ruler measures where the ink
     actually IS, in two steps that split the truth between the two renderers
     that each hold half of it. (1) THE BOX AND ITS BASELINES come from the
     DOM: an offscreen clone of the real .sy (real classes, movers stilled)
     is probed with zero-size inline-blocks — an inline-block's baseline is
     its bottom edge, so each probe's rect pins its line's baseline exactly
     where Chrome's inline layout puts it. No canvas font metric stands in
     for the line box math (an earlier draft did exactly that, and canvas
     fontBoundingBoxAscent seats the block 1–2px lower than real layout).
     (2) THE INK comes from canvas: the same two lines + dots (dots painted —
     they hold their space always, and a lit dot must never be the thing
     that clips), drawn with the clone's own computed font at those DOM
     baselines, alpha-scanned for the ink bbox. Each side's box-edge-to-ink
     distance (minus a 0.4px safety so antialiased swash tips never cross
     the wall) goes onto the mover as a --jd-si-* custom property, and the
     jdDarkStrayX/Y keyframes push the box PAST each wall by exactly that
     side's number, so the ink itself lands flush. Runtime measurement, not
     constants, because the stack resolves to different faces (with
     different overhangs) per platform. On any failure the zeros fall out
     and the bounce degrades to the old box-kiss — never a clip. */
  function darkStrayInkInsets() {
    if (darkStrayInkInsets.v) return darkStrayInkInsets.v;
    var zero = { l: 0, r: 0, t: 0, b: 0 };
    try {
      var SAFE = 0.4, S = 2;
      var PROBE = '<span data-p style="display:inline-block;width:0;height:0"></span>';
      var host = document.createElement('div');
      host.style.cssText = 'position:absolute;left:-9999px;top:0;' +
        'visibility:hidden;pointer-events:none';
      host.innerHTML =
        '<span class="jd-dark-stray" style="animation:none;position:relative;' +
        'left:0;top:0;transform:none;display:inline-block">' +
        '<span class="sy" style="animation:none;position:static;top:auto;' +
        'transform:none">please' + PROBE + '<br>wait...' + PROBE +
        '</span></span>';
      document.body.appendChild(host);
      var sy = host.querySelector('.sy');
      var probes = host.querySelectorAll('[data-p]');
      var box = sy.getBoundingClientRect();
      var b1 = probes[0].getBoundingClientRect().top - box.top;
      var b2 = probes[1].getBoundingClientRect().top - box.top;
      var cs = getComputedStyle(sy);
      var font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var lsp = cs.letterSpacing;
      var bw = box.width, bh = box.height;
      var M = parseFloat(cs.fontSize) * 1.5;  /* margin catches any overhang */
      document.body.removeChild(host);
      if (!(bw > 0) || !(bh > 0) || !(b2 > b1)) return zero;
      var cv = document.createElement('canvas');
      cv.width = Math.ceil((bw + 2 * M) * S);
      cv.height = Math.ceil((bh + 2 * M) * S);
      var ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) return zero;
      ctx.scale(S, S);
      ctx.font = font;
      if ('letterSpacing' in ctx && lsp !== 'normal') ctx.letterSpacing = lsp;
      ctx.textAlign = 'center';        /* .sy centres each line, so does this */
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#000';
      ctx.fillText('please', M + bw / 2, M + b1);
      ctx.fillText('wait...', M + bw / 2, M + b2);
      var img = ctx.getImageData(0, 0, cv.width, cv.height).data;
      var minx = cv.width, miny = cv.height, maxx = -1, maxy = -1, x, y;
      for (y = 0; y < cv.height; y++) {
        for (x = 0; x < cv.width; x++) {
          if (img[(y * cv.width + x) * 4 + 3] > 16) {
            if (x < minx) minx = x;
            if (x > maxx) maxx = x;
            if (y < miny) miny = y;
            if (y > maxy) maxy = y;
          }
        }
      }
      if (maxx < 0) return zero;
      var side = function (v) {
        return Math.max(0, Math.round((v - SAFE) * 100) / 100);
      };
      darkStrayInkInsets.v = {
        l: side(minx / S - M),
        r: side(M + bw - (maxx + 1) / S),
        t: side(miny / S - M),
        b: side(M + bh - (maxy + 1) / S)
      };
      return darkStrayInkInsets.v;
    } catch (e) { return zero; }
  }
  function darkWell(slot, anim, seed) {
    if (anim === 'plot') {
      /* the ink and the nib are the SAME path: the ink is a 15-unit dash
         window crawling around the circuit, the nib a 0.01-unit dot riding
         15 units ahead of the window's tail — i.e. exactly at its head */
      var d = darkPlotCircuit(seed + ':' + slot);
      return '<svg class="jd-dark-plot" width="90" height="54" viewBox="0 0 90 54">' +
        '<path class="plot-ink" d="' + d + '" pathLength="100"/>' +
        '<path class="plot-nib" d="' + d + '" pathLength="100"/>' +
        '</svg>';
    }
    if (anim === 'stray') {
      /* two nested movers, one axis each — the CSS runs them at
         incommensurate periods so the ricochet never visibly repeats */
      /* round-23 reword (owner pick 2026-08-18): the drifting word drops
         LOADING for the office's own plea — "please / wait", two lines, in
         an old-fashioned script hand (see .sy in the CSS). The trailing
         ellipsis (owner, 2026-08-26) blinks into place a dot at a time —
         none, one, two, three, back to none — on a stepped cycle; the dots
         hold their space whether lit or not, so the ricochet's measured
         box never changes mid-flight. */
      /* the --jd-si-* numbers are the ink ruler's per-side box-to-ink
         distances (see darkStrayInkInsets above): the keyframes read them
         so the INK, not the box, is what kisses each wall (owner directive,
         2026-08-26 — the word used to bounce with air under it) */
      var si = darkStrayInkInsets();
      return '<span class="jd-dark-stray" style="--jd-si-l:' + si.l +
        'px;--jd-si-r:' + si.r + 'px;--jd-si-t:' + si.t +
        'px;--jd-si-b:' + si.b + 'px"><span class="sy">please<br>wait' +
        '<i>.</i><i>.</i><i>.</i></span></span>';
    }
    if (anim === 'scatter') {
      /* the whole track is generated per turn (see darkScatterword): a
         <style> carrying ten seed-scoped keyframe blocks, then the ten
         glyphs that ride them. Style-via-innerHTML applies — a <style>
         element inserted this way is live, and it is display:none so it
         never counts as a child of the well's flex box. */
      return darkScatterword(seed + ':' + slot);
    }
    if (anim === 'drift') {
      /* cannot be a string on its own: it measures the well it lands in and
         starts a metronome per column, so it is built by jdDriftMount() from
         paint(), once this markup is in the document. */
      return '<span class="jd-drift"></span>';
    }
    if (anim === 'words') {
      /* BENCHED from the rotation (owner call 2026-08-30, see DARK_POOL):
         kept whole on the bar/plot terms — put 'words' back in the array
         and this branch serves it again unchanged. */
      /* the word mesh (owner directive 2026-08-23, mockup-34's tuning):
         Kimi's Take (art/kimis-take/) run small in word mode — every
         string is one of the office's sixteen wait-words, all of them
         commissioned (stubborn 100) to cross the whole swatch, at
         mockup-34's 2.8–5 cells/sec. The cast is 32 (owner call, same
         day) — more than a swatch can hold at once, which is the show:
         the traffic manager places what clear spacetime it finds and the
         rest of the cast waits its turn.
         It cannot be built in place the rain's way: the engine holds ONE
         sheet of state per page, and a darkroom can need four sheets at
         once. The frame is the isolation — same-origin, our own paper,
         our own ink, and mini.php re-deals itself if the swatch changes
         size. The well is aria-hidden, so the frame is too (tabindex
         keeps it out of the tab order); the status line beside it still
         does the talking. (The character-mode run of the same piece was
         in this rotation 2026-08-22 – 2026-08-26; the owner kept the wait
         said in words and retired the plain-character cast — the full
         piece lives on at /art/kimis-take/.) */
      return '<iframe class="jd-dark-mesh" ' +
        'src="/art/kimis-take/mini.php?words=1&n=32&stubborn=100&speedLo=2.8&speedHi=5" ' +
        'title="streams of words" tabindex="-1" scrolling="no"></iframe>';
    }
    if (anim === 'bar') {
      /* the whole climb is generated per turn (see darkHonestBar): a
         <style> carrying the seeded keyframe track, then the wobbled frame
         and the fill that rides it. Style-via-innerHTML applies — the
         scatterword's precedent. */
      return darkHonestBar(seed + ':' + slot);
    }
    /* watch — the wristwatch. The hands' base angles ride inline as CSS vars,
       seeded from the turn ref (same fold as darkPlotCircuit's) so each
       wait starts at a different plausible time: the minute hand lands ON
       a tick (a multiple of 30deg — steps(12) must stay on ticks) and the
       hour hand sits proportionally between its own ticks, the way a real
       watch holds its hour hand at ten past. The keyframes add 360deg to
       whatever these say, so the loop closes from any start. */
    var wh = JD_fnv1a(seed + ':' + slot);
    var wm = wh % 12, whr = (wh >> 4) % 12;
    return '<svg class="jd-dark-watch" width="62" height="67" viewBox="0 0 40 44"' +
      ' style="--jdwm:' + (wm * 30) + 'deg;--jdwh:' + (whr * 30 + wm * 2.5) + 'deg">' +
      '<rect class="w-lug" x="15" y="0.5" width="10" height="6" rx="1.5"/>' +
      '<rect class="w-lug" x="15" y="37.5" width="10" height="6" rx="1.5"/>' +
      '<circle class="w-case" cx="20" cy="22" r="15"/>' +
      '<circle class="w-ticks" cx="20" cy="22" r="12.5" pathLength="12"/>' +
      '<line class="w-min" x1="20" y1="22" x2="20" y2="11.5"/>' +
      '<line class="w-hr" x1="20" y1="22" x2="20" y2="15.5"/>' +
      '<circle class="w-pin" cx="20" cy="22" r="1.2"/></svg>';
  }
  window.JD_dark = {
    deal: darkDeal, well: darkWell, mount: jdDriftMount, stopAll: jdDriftStopAll
  };
})();
