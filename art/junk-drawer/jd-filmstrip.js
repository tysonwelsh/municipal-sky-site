/* ============================================================================
   jd-filmstrip.js — THE FILMSTRIP, the replay/scrub control under a drawing
   (ported from mockups/mockup-46-filmstrip.html rev b, variant B — "the same,
   unwashed" — owner's pick, 2026-09-16; it replaces mockup 45's sheet-and-bar,
   which stacked a row of frames over a bar graph that said the same thing
   twice for 60–70px of the card). It went in on /about/ first and was promoted
   to the drawer proper on 2026-09-16: mounted by jd-record.js under the report
   card's plate, by jd-turn.js inside the rating bench's pinned plate, and by
   about-scenes.js under the same two plates on the /about/ walkthrough. The
   replay affordances it replaces — the report card's ↻ and the bench plate's
   pencil — are dropped wherever it mounts.

   ONE row the plate's width: [play/pause] [strip] [14 over 31]. The bar graph
   is gone and the FRAMES ARE THE TRACK — twelve paused copies of the drawing
   butted edge to edge, each held at the end of a twelfth of the marks, with
   the red caret scrubbing over the top of the pictures. The ruling says
   timeline: a hairline the full height at every cell boundary, and the
   ruler's ticks overprinted along the strip's floor — majors at the frames,
   three minors between, no band and no baseline, so the ruler costs the strip
   no height. The pictures are left alone (the unwashed reading) and the
   elapsed run is inked along the floor instead. The x-axis is still the MARK
   index and a press anywhere on the strip scrubs continuously; each cell
   shows the drawing at the END of its own stretch, so cell k and the stretch
   under it are the same span of the run and the last cell is the finished
   drawing. No seconds anywhere.

   It scrubs the REAL draw-on: JD_drawOn runs, the run is parked (the
   engine's strip timer defeated via svg.__jdDrawSeq), and every element's
   CSS animation is driven through the Web Animations API — pause +
   currentTime to seek, play() only for animations still ahead (play() on a
   finished one rewinds it and the element vanishes).

   window.JD_filmstrip(svg, after, opts) → { bar, seekMark, play, pause,
   toggle, get, destroy }. `svg` is the plate's inlined drawing,
   `after` the element the control is inserted after, opts.pfx the id prefix
   for the cell copies, opts.label the group's aria-label, opts.autoplay
   (default true) plays the run once on mount unless motion is reduced.
   ========================================================================== */
(function () {
  'use strict';

  var SEL = 'path,line,polyline,polygon,circle,ellipse,rect,text,use';
  var SKIP = 'defs,clipPath,mask,pattern,linearGradient,radialGradient,symbol,marker';

  var PLAY_G = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path class="g-play" d="M4 2.6 13.4 8 4 13.4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path class="g-pause" d="M5 2.6v10.8M11 2.6v10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';

  /* the marks: the engine's element walk (same selector, same skips, same
     visibility test) so the list is exactly what JD_drawOn schedules, with
     each mark's measured length for its bar */
  function marksOf(svg) {
    var els = svg.querySelectorAll(SEL), out = [], i, el, cs, L, stroked, filled;
    for (i = 0; i < els.length; i++) {
      el = els[i];
      if (el.closest && el.closest(SKIP)) continue;
      cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      L = 0;
      try { if (el.getTotalLength) L = el.getTotalLength(); } catch (e) {}
      stroked = cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 &&
        parseFloat(cs.strokeOpacity) > 0 && cs.strokeDasharray === 'none' && L > 0;
      filled = cs.fill !== 'none' && parseFloat(cs.fillOpacity) > 0;
      if (!stroked && !filled) continue;
      out.push({ el: el, L: Math.max(L, 4), start: 0, end: 0 });
    }
    return out;
  }

  /* strip the engine's inline animation styles off a subtree */
  function clean(root) {
    var els = root.querySelectorAll(SEL);
    for (var i = 0; i < els.length; i++) {
      els[i].style.animation = ''; els[i].style.strokeDasharray = '';
      els[i].style.strokeDashoffset = '';
      els[i].style.removeProperty('--jdfo'); els[i].style.removeProperty('--jdo');
    }
  }

  /* a cell copy: the plate's drawing cloned, animation styles cleared, and
     every id (and every reference to one — url(#…), href, aria) rewritten
     under a prefix so eight copies can share the document with the plate */
  function copyOf(svg, prefix) {
    var g = svg.cloneNode(true);
    clean(g);
    g.removeAttribute('id');
    var els = g.querySelectorAll('[id]'), map = {}, i;
    for (i = 0; i < els.length; i++) {
      var id = els[i].getAttribute('id');
      map[id] = prefix + id;
      els[i].setAttribute('id', prefix + id);
    }
    var ids = Object.keys(map).sort(function (a, b) { return b.length - a.length; });
    if (ids.length) {
      var re = new RegExp('#(' + ids.map(function (s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('|') + ')(?![\\w-])', 'g');
      var all = g.querySelectorAll('*');
      for (i = 0; i < all.length; i++) {
        var el = all[i], attrs = el.attributes, j;
        for (j = 0; j < attrs.length; j++) {
          var a = attrs[j];
          if (a.name === 'id') continue;
          if (a.value.indexOf('#') >= 0) {
            var v = a.value.replace(re, function (m, x) { return '#' + map[x]; });
            if (v !== a.value) el.setAttribute(a.name, v);
          }
        }
        if (el.tagName && el.tagName.toLowerCase() === 'style' && el.textContent.indexOf('#') >= 0) {
          el.textContent = el.textContent.replace(re, function (m, x) { return '#' + map[x]; });
        }
      }
    }
    return g;
  }

  function controlHTML(label, NF) {
    /* --nf is what the ruling is keyed off: the cell divisions and the
       ruler's majors both repeat at 100%/nf, so they agree by construction
       at any cell count */
    var h = '<div class="jd-filmstrip" role="group" aria-label="' + label +
      '" style="--nf:' + NF + '">' +
      '<button type="button" class="fs-play" title="play / pause the drawing" aria-label="Play the drawing" aria-pressed="false">' + PLAY_G + '</button>' +
      '<div class="fs-strip" role="slider" tabindex="0" aria-label="Drawing timeline, one step per mark" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">' +
      '<div class="fs-cells">';
    for (var k = 0; k < NF; k++) {
      h += '<span class="fs-cell"><span class="fs-cell-art"></span></span>';
    }
    /* the inked run first, then the ruler over it, then the caret over both */
    h += '</div>' +
      '<div class="fs-fill"></div>' +
      '<div class="fs-grid"></div>' +
      '<div class="fs-caret"></div>' +
      '</div>' +
      '<div class="fs-read" aria-hidden="true">' +
      '<span class="fs-read-n"><b class="fs-n">0</b></span>' +
      '<span class="fs-read-d"><span class="fs-m">0</span></span></div>' +
      '</div>';
    return h;
  }

  function filmstrip(svg, after, opts) {
    opts = opts || {};
    var pfx = opts.pfx || 'fs_';
    /* twelve cells (owner, 2026-09-16): the most stages the strip will show.
       It no longer sets the row's height — --fs-h does, fixed — so the count
       buys stages rather than costing millimetres. */
    var NF = 12;
    after.insertAdjacentHTML('afterend', controlHTML(opts.label || 'Replay the drawing', NF));
    var bar = after.nextElementSibling;
    bar.__svg = svg;
    var play = bar.querySelector('.fs-play'), strip = bar.querySelector('.fs-strip');
    var fill = bar.querySelector('.fs-fill');
    var caret = bar.querySelector('.fs-caret');
    var rN = bar.querySelector('.fs-n'), rM = bar.querySelector('.fs-m');
    var cells = Array.prototype.slice.call(bar.querySelectorAll('.fs-cell'));
    var anims = [], clock = null, marks = [], T = [0], M = 0, total = 0, secs = 0;
    var u = 0, playing = false, raf = 0, armed = false, framesBuilt = false, frameC = [];
    /* NFa: the cells actually in play (min(NF, M)); shown: those cells */
    var NFa = NF, shown = cells.slice();
    var dead = false;

    /* the cell copies, made once from the plate's drawing */
    cells.forEach(function (f, k) {
      f.querySelector('.fs-cell-art').appendChild(copyOf(svg, pfx + 'f' + k + '_'));
    });

    /* ARM the plate: run the engine, park the run, read each mark's start
       and end off its own animations, and build the cumulative end times
       T[i] the mark axis maps through */
    function arm() {
      clean(svg);   /* an identical animation string would not restart a cancelled one */
      secs = window.JD_drawOn(svg, { force: true });
      if (!secs) { armed = false; return false; }
      svg.__jdDrawSeq = -1;
      anims = svg.getAnimations({ subtree: true });
      if (!anims.length) { armed = false; return false; }
      marks = marksOf(svg);
      var byEl = new Map();
      marks.forEach(function (m) { byEl.set(m.el, m); m.start = Infinity; m.end = 0; });
      clock = null; var cEnd = -1;
      anims.forEach(function (a) {
        var tm = a.effect.getTiming();
        var s = (+tm.delay || 0) / 1000, e = s + (+tm.duration || 0) / 1000;
        var m = byEl.get(a.effect.target);
        if (m) { if (s < m.start) m.start = s; if (e > m.end) m.end = e; }
        if (e > cEnd) { cEnd = e; clock = a; }
      });
      marks = marks.filter(function (m) { return m.end > 0; });
      M = marks.length;
      T = [0];
      for (var i = 0; i < M; i++) T[i + 1] = Math.max(T[i], marks[i].end);
      total = T[M];
      /* each cell shows the END of its own stretch: cell and stretch are
         then the same span of the run, and the last cell is the finished
         drawing */
      /* a drawing with fewer marks than cells would otherwise repeat itself
         — frameC [1,1,2,2,3,…] on a seven-mark drawing at twelve cells, five
         of them duplicates. So NF is a REQUEST: the strip shows one cell per
         mark and no more, the surplus is taken out of the flex flow, and --nf
         is rewritten so the ruling stays in register with what is left. */
      NFa = Math.max(1, Math.min(NF, M));
      shown = cells.slice(0, NFa);
      cells.forEach(function (f, k) { f.hidden = k >= NFa; });
      bar.style.setProperty('--nf', NFa);
      frameC = [];
      for (var k = 0; k < NFa; k++) frameC.push(Math.round((k + 1) * M / NFa));
      shown.forEach(function (f, k) {
        f.title = 'marks 1 to ' + frameC[k] + ' of ' + M;
      });
      strip.setAttribute('aria-valuemax', M);
      rM.textContent = M;
      armed = true;
      if (!framesBuilt) buildFrames();
      return true;
    }
    /* the cells: paused copies, each held at its stretch's end forever */
    function buildFrames() {
      shown.forEach(function (f, k) {
        var fs = f.querySelector('svg');
        if (!fs) return;
        window.JD_drawOn(fs, { force: true, secs: secs });
        fs.__jdDrawSeq = -1;
        var fa = fs.getAnimations({ subtree: true });
        var ms = T[frameC[k]] * 1000;
        fa.forEach(function (a) { a.pause(); a.currentTime = ms; });
      });
      framesBuilt = true;
    }
    function live() {
      return armed && anims.length && clock && clock.playState !== 'idle' && document.contains(svg);
    }
    function ensure() { if (dead || !document.contains(svg)) return false; if (!live()) arm(); return armed; }

    /* the mark axis ↔ time */
    function tOf(uu) {
      uu = Math.max(0, Math.min(M, uu));
      var i = Math.ceil(uu - 1e-9);
      if (i <= 0) return 0;
      return T[i - 1] + (uu - (i - 1)) * (T[i] - T[i - 1]);
    }
    function uOf(tt) {
      if (tt <= 0) return 0;
      for (var i = 1; i <= M; i++) {
        if (tt <= T[i] + 1e-9) {
          var span = T[i] - T[i - 1];
          return span > 0 ? (i - 1) + (tt - T[i - 1]) / span : i;
        }
      }
      return M;
    }
    function markN(uu) { return Math.max(0, Math.ceil(uu - 1e-9)); }
    function curFrame(uu) {
      if (uu <= 0) return 0;
      var n = markN(uu), k = 0;
      while (k < NFa - 1 && n > frameC[k]) k++;
      return k;
    }

    function paint() {
      var p = M ? u / M : 0;
      caret.style.left = (p * 100) + '%';
      /* the unwashed reading: the pictures stay as they are and the elapsed
         run is inked along the strip's floor */
      fill.style.width = (p * 100).toFixed(3) + '%';
      var n = markN(u);
      rN.textContent = n;
      strip.setAttribute('aria-valuenow', n);
      strip.setAttribute('aria-valuetext', 'mark ' + n + ' of ' + M);
      var cf = curFrame(u);
      shown.forEach(function (f, k) { f.classList.toggle('is-cur', k === cf); });
    }
    function setPlaying(on) {
      playing = on;
      bar.classList.toggle('is-playing', on);
      play.setAttribute('aria-pressed', on ? 'true' : 'false');
      play.setAttribute('aria-label', on ? 'Pause the drawing' : 'Play the drawing');
    }
    function seekU(uu) {
      if (!ensure()) return;
      u = Math.max(0, Math.min(M, uu));
      var ms = tOf(u) * 1000;
      anims.forEach(function (a) { a.pause(); a.currentTime = ms; });
      if (playing) { setPlaying(false); cancelAnimationFrame(raf); }
      paint();
    }
    function tick() {
      if (!playing) return;
      /* the card re-rendered under us: the plate is gone, so is the run */
      if (dead || !document.contains(svg)) { setPlaying(false); return; }
      var tt = Math.min(total, (clock.currentTime || 0) / 1000);
      u = uOf(tt);
      paint();
      if (clock.playState === 'finished' || tt >= total) { finish(); return; }
      raf = requestAnimationFrame(tick);
    }
    function finish() {
      u = M; setPlaying(false); cancelAnimationFrame(raf);
      anims.forEach(function (a) { a.pause(); a.currentTime = total * 1000; });
      paint();
    }
    function start() {
      if (!ensure()) return;
      if (u >= M - 1e-6) u = 0;
      var tt = tOf(u), ms = tt * 1000;
      anims.forEach(function (a) {
        var tm = a.effect.getTiming();
        var end = ((+tm.delay || 0) + (+tm.duration || 0)) / 1000;
        a.currentTime = ms;
        if (end > tt + 1e-6) a.play(); else a.pause();
      });
      clock.onfinish = function () { if (playing) finish(); };
      setPlaying(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }
    function pause() {
      if (!playing) return;
      u = uOf(Math.min(total, (clock.currentTime || 0) / 1000));
      anims.forEach(function (a) { a.pause(); });
      setPlaying(false); cancelAnimationFrame(raf); paint();
    }
    function toggle() { if (playing) pause(); else start(); }

    /* the strip: pointer scrub with capture; keyboard per the slider pattern */
    function posU(e) {
      var r = strip.getBoundingClientRect();
      var x = (e.clientX - r.left) / (r.width || 1);
      return Math.max(0, Math.min(1, x)) * M;
    }
    var dragging = false;
    strip.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault(); e.stopPropagation();
      try { strip.setPointerCapture(e.pointerId); } catch (x) {}
      dragging = true; strip.classList.add('is-scrubbing');
      ensure(); seekU(posU(e)); strip.focus({ preventScroll: true });
    });
    strip.addEventListener('pointermove', function (e) { if (dragging) seekU(posU(e)); });
    function drop(e) {
      if (!dragging) return;
      dragging = false; strip.classList.remove('is-scrubbing');
      try { strip.releasePointerCapture(e.pointerId); } catch (x) {}
    }
    strip.addEventListener('pointerup', drop);
    strip.addEventListener('pointercancel', drop);
    strip.addEventListener('click', function (e) { e.stopPropagation(); if (e.clientX || e.clientY) seekU(posU(e)); });
    strip.addEventListener('keydown', function (e) {
      var k = e.key, step = M / NFa;
      if (k === 'ArrowLeft' || k === 'ArrowDown') seekU(Math.ceil(u - 1e-9) - 1);
      else if (k === 'ArrowRight' || k === 'ArrowUp') seekU(Math.floor(u + 1e-9) + 1);
      else if (k === 'PageDown') seekU(u - step);
      else if (k === 'PageUp') seekU(u + step);
      else if (k === 'Home') seekU(0);
      else if (k === 'End') seekU(M);
      else if (k === ' ' || k === 'Enter') toggle();
      else return;
      e.preventDefault(); e.stopPropagation();
    });
    /* the cards' own delegated handlers (zoom on the plate, the record's
       swipe-to-flip) must not hear presses inside the control */
    bar.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    bar.addEventListener('keydown', function (e) { e.stopPropagation(); });
    play.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    /* the cells are the strip's own content now, not buttons: pointer-events
       stay on the strip, so a press anywhere scrubs continuously rather than
       jumping to a cell's end — strictly more control, one less gesture to
       explain */

    if (arm()) {
      if ((window.JD_reduced && window.JD_reduced()) || opts.autoplay === false) seekU(M);
      else { u = 0; start(); }
    }
    var api = {
      bar: bar, seekMark: seekU, play: start, pause: pause, toggle: toggle,
      get: function () { return { u: u, mark: markN(u), M: M, t: tOf(u), total: total, playing: playing,
        anims: anims.length, playState: clock ? clock.playState : null, frame: curFrame(u), frames: NFa,
        frameC: frameC.slice() }; },
      destroy: function () {
        dead = true; cancelAnimationFrame(raf);
        anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
        if (document.contains(svg)) clean(svg);
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }
    };
    svg.__jdFilmstrip = api;
    return api;
  }
  window.JD_filmstrip = filmstrip;
})();
