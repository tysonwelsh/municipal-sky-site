/* HOLLER ROLLER — boot & mount
 *
 * SkeeBall.mount(container) creates the canvas, handles crisp integer
 * scaling against the real device pixel grid, and runs the frame loop.
 * This is the factory the eventual RPG will call to put this machine
 * inside the big building; today index.php calls it standalone.
 */
window.SkeeBall = (function () {
  'use strict';

  function mount(container, opts) {
    opts = opts || {};
    var R = window.SkeeBallRender;
    var canvas = document.createElement('canvas');
    canvas.width = R.W;
    canvas.height = R.H;
    canvas.className = 'skeeball-canvas';
    canvas.setAttribute('aria-label', 'HOLLER ROLLER skee ball machine');
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Integer scaling in *device* pixels: on a 3× phone a CSS scale of
    // 1.66 can still be a whole number of physical pixels. Compute the
    // largest device-pixel multiple that fits the container, then set the
    // CSS size to (multiple / dpr) so pixels stay square and crisp.
    function fit() {
      var dpr = window.devicePixelRatio || 1;
      var availW = container.clientWidth * dpr;
      var availH = container.clientHeight * dpr;
      var scale = Math.max(1, Math.floor(Math.min(availW / R.W, availH / R.H)));
      canvas.style.width = (R.W * scale / dpr) + 'px';
      canvas.style.height = (R.H * scale / dpr) + 'px';
    }
    fit();
    window.addEventListener('resize', fit);

    R.buildStatic();

    var running = true;
    var start = null;
    function frame(now) {
      if (!running) return;
      if (start === null) start = now;
      R.drawFrame(ctx, (now - start) / 1000);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return {
      destroy: function () {
        running = false;
        window.removeEventListener('resize', fit);
        canvas.remove();
      }
    };
  }

  return { mount: mount };
})();

document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('skeeball-mount');
  if (el) window.SkeeBall.mount(el);
});
