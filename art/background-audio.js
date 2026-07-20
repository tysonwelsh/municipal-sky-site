// ============================================================================
// MSKY BACKGROUND AUDIO — keep a Web Audio engine sounding under a locked
// screen / backgrounded mobile browser, with lock-screen media controls.
//
// Mobile browsers treat a bare AudioContext as "page audio" and suspend it
// the moment the screen locks. Three cooperating pieces turn the page into
// something the OS treats as a media player instead:
//
//   1. MEDIA-ELEMENT ROUTE — the engine's final node feeds a
//      MediaStreamAudioDestinationNode wired into a real <audio> element.
//      An actively-playing audio element is background-capable media. On
//      iOS 16.4+ we additionally declare navigator.audioSession.type =
//      "playback". This is a re-route of the last hop only — synthesis,
//      seeding and mix are untouched.
//   2. MEDIA SESSION — lock-screen / control-center metadata and
//      play/pause handlers, so the OS shows transport controls and treats
//      the session as legitimate ongoing playback.
//   3. AUTO-RESUME — visibility/pageshow/statechange watchers that resume
//      a suspended (iOS: "interrupted") context when the page returns,
//      instead of requiring a manual restart. Never fires against the
//      engine's own STOP — it tracks the engine's intent via started()/
//      stopped().
//
// Shared by the engines under art/ — KOLOB, ZANKYŌ, BARDO.
//
// Usage, from the engine's init(), INSTEAD of finalNode.connect(ctx.destination):
//   bg = window.MskyBackgroundAudio.create({
//     context: ctx, source: finalNode,
//     title: "...", artist: "...", artwork: "/images/....png",
//     onPlay: play, onPause: stop,          // lock-screen transport → engine
//   });
//   if (!bg.routed) finalNode.connect(ctx.destination);   // old direct path
// Then: bg.started() inside play(); bg.stopped() inside stop(); bg.poke()
// before one-shot auditions while stopped (the element must be live to hear
// them).
// ============================================================================
window.MskyBackgroundAudio = (function () {
  "use strict";

  function noop() {}

  function create(opts) {
    var ctx = opts.context;
    var source = opts.source;
    var shouldPlay = false;              // the engine's intent, not the OS's mood
    var routed = false;
    var el = null, pauseTimer = null;

    // iOS 16.4+: declare this page's audio as media playback, which lets it
    // continue under a locked screen.
    try {
      if (navigator.audioSession && "type" in navigator.audioSession) {
        navigator.audioSession.type = "playback";
      }
    } catch (e) {}

    try {
      if (ctx.createMediaStreamDestination && window.HTMLAudioElement &&
          "srcObject" in HTMLAudioElement.prototype) {
        var dest = ctx.createMediaStreamDestination();
        source.connect(dest);
        el = document.createElement("audio");
        el.setAttribute("playsinline", "");
        el.srcObject = dest.stream;
        el.style.display = "none";
        document.body.appendChild(el);
        routed = true;
      }
    } catch (e) { routed = false; }

    // If the element route dies at runtime (a rejected play(), a stream
    // problem), fall back to the direct output once, permanently — silence
    // would otherwise be indistinguishable from a stopped engine.
    function fallbackToDirect() {
      if (!routed) return;
      routed = false;
      try { source.disconnect(); } catch (e) {}
      try { source.connect(ctx.destination); } catch (e) {}
      try { if (el) { el.pause(); el.srcObject = null; } } catch (e) {}
    }

    function playElement() {
      if (!routed || !el) return;
      if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
      if (!el.paused) return;
      try {
        var p = el.play();
        if (p && p.catch) p.catch(fallbackToDirect);
      } catch (e) { fallbackToDirect(); }
    }

    // Recover a context the OS parked. Only while the engine means to play,
    // and only when visible — fighting the OS mid-interruption (a phone
    // call) does not go well; the visibility kick handles the return.
    function kick() {
      if (!shouldPlay) return;
      try { if (ctx.state !== "running") ctx.resume().catch(noop); } catch (e) {}
      playElement();
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden) kick(); });
    window.addEventListener("pageshow", kick);
    window.addEventListener("focus", kick);
    try { ctx.addEventListener("statechange", function () { if (!document.hidden) kick(); }); } catch (e) {}
    // Some iOS builds insist on a gesture for resume(); the next touch retries.
    document.addEventListener("touchend", function () { kick(); }, { passive: true });

    var ms = ("mediaSession" in navigator) ? navigator.mediaSession : null;
    function setSession() {
      if (!ms) return;
      try {
        ms.metadata = new MediaMetadata({
          title: opts.title || document.title,
          artist: opts.artist || "",
          album: opts.album || "",
          artwork: opts.artworkList ? opts.artworkList
            : (opts.artwork ? [{ src: opts.artwork, type: "image/png" }] : []),
        });
      } catch (e) {}
      var wire = function (action, fn) { try { ms.setActionHandler(action, fn); } catch (e) {} };
      wire("play", function () { (opts.onPlay || noop)(); });
      wire("pause", function () { (opts.onPause || noop)(); });
      wire("stop", function () { (opts.onPause || noop)(); });
      // an endless generative piece has no timeline — decline seeking
      wire("seekbackward", null);
      wire("seekforward", null);
    }

    return {
      routed: routed,
      started: function () {
        shouldPlay = true;
        playElement();
        setSession();
        if (ms) { try { ms.playbackState = "playing"; } catch (e) {} }
      },
      stopped: function () {
        shouldPlay = false;
        if (ms) { try { ms.playbackState = "paused"; } catch (e) {} }
        // let the engine's stop-fade finish before the element pauses
        if (routed && el && !pauseTimer) {
          pauseTimer = setTimeout(function () {
            pauseTimer = null;
            if (!shouldPlay && el) { try { el.pause(); } catch (e) {} }
          }, 1500);
        }
      },
      // one-shot auditions while stopped still need the element live
      poke: playElement,
      // live now-playing updates (title / artwork) — additive; engines that
      // never call this behave exactly as before. Values merge into opts so
      // a later started()/setSession() keeps the latest.
      updateMetadata: function (meta) {
        if (meta) {
          if (meta.title !== undefined) opts.title = meta.title;
          if (meta.artist !== undefined) opts.artist = meta.artist;
          if (meta.album !== undefined) opts.album = meta.album;
          if (meta.artwork !== undefined) opts.artworkList = meta.artwork;
        }
        setSession();
      },
    };
  }

  return { create: create };
})();
