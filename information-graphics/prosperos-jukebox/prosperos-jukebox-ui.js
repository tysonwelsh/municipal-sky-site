// ============================================================================
// Prospero's Jukebox — UI Controller
// Wires DOM controls to ProsperoAudio engine
// ============================================================================

(function () {
  "use strict";

  // Layer definitions per track
  var TRACK_LAYERS = {
    library: [
      { key: "drone", label: "DRONE", desc: "Eno-style overlapping pads" },
      { key: "melody", label: "HARPSICHORD", desc: "Markov plucked strings" },
      { key: "musicBox", label: "MUSIC BOX", desc: "Sine pings with harmonics" },
      { key: "clock", label: "CLOCK", desc: "Tick-tock with personality" },
      { key: "hum", label: "HUM", desc: "Sparse male humming" },
      { key: "ambient", label: "AMBIENT", desc: "Page turns, owls, waves..." },
    ],
    sycorax: [
      { key: "drone", label: "DRONE", desc: "Dissonant sawtooth clusters" },
      { key: "whispers", label: "WHISPERS", desc: "Formant-filtered noise" },
      { key: "ghost", label: "GHOST TONES", desc: "Ethereal detuned triads" },
      { key: "waterphone", label: "WATERPHONE", desc: "Inharmonic bell + blooming wail" },
      { key: "heartbeat", label: "HEARTBEAT", desc: "Organic double-pulse" },
      { key: "scrape", label: "SCRAPE", desc: "Metallic pitch sweeps" },
      { key: "ambient", label: "AMBIENT", desc: "Thunder, chains, ravens..." },
    ],
    ariel: [
      { key: "breeze", label: "BREEZE", desc: "Airy sine pads with air noise" },
      { key: "chimes", label: "CHIMES", desc: "Wind chime pings with shimmer" },
      { key: "flutter", label: "FLUTTER", desc: "Quick playful melodic bursts" },
      { key: "bubbles", label: "BUBBLES", desc: "Ascending sine glissandos" },
      { key: "whistle", label: "WHISTLE", desc: "Airy flute-like phrases" },
      { key: "ambient", label: "AMBIENT", desc: "Giggles, birds, sparkles..." },
    ],
  };

  var FLAVOR_TEXT = {
    library:
      'Generative ambient in <em>C Dorian</em>. Eno-style drone pads drift and overlap. ' +
      'A Markov chain picks harpsichord notes via Karplus-Strong synthesis. ' +
      'Music box pings, a ticking clock with a mind of its own, sparse male humming, ' +
      'and Cage-style chance-selected ambient events &mdash; page turns, owl hoots, ' +
      'distant waves &mdash; create a soundscape that never repeats.',
    sycorax:
      'Dark generative soundscape in <em>Chromatic-Locrian</em>. ' +
      'Rotating dissonant drone clusters built on tritones and minor seconds. ' +
      'Markov-driven ghost tones with slow vibrato. A spooky waterphone &mdash; ' +
      'inharmonic bell partials with a blooming FM wail and tidal water wobble ' +
      '&mdash; emerges occasionally above the drone. Formant-filtered whispers ' +
      'with drifting vowel shapes. An organic heartbeat that drifts in intensity. ' +
      'Metallic pitch sweeps and dark ambient events &mdash; chains rattling, ' +
      'distant thunder, spectral moans, cauldron bubbles.',
    ariel:
      'Generative ambient in <em>F Lydian</em>. ' +
      'Airy breeze pads drift at open fifths with gentle amplitude breathing. ' +
      'Markov-driven wind chimes shimmer in the upper register. ' +
      'Playful melodic flutter fragments dart and leap. ' +
      'Ascending bubble glissandos, a breathy whistle, ' +
      'and whimsical ambient events &mdash; giggles, birdsong, ' +
      'sparkles, crickets &mdash; all carried on the wind.',
  };

  // Current UI state
  var currentTrack = "library";

  // DOM refs
  var jukeboxFrame = document.querySelector(".jukebox-frame");
  var jukeboxScene = document.querySelector(".jukebox-scene");
  var layersContainer = document.getElementById("jukebox-layers");
  var flavorEl = document.getElementById("jukebox-flavor");
  var statusEl = document.getElementById("jukebox-status");
  var playBtn = document.getElementById("jukebox-play");
  var stopBtn = document.getElementById("jukebox-stop");
  var resetBtn = document.getElementById("jukebox-reset");
  var masterVol = document.getElementById("jukebox-master-vol");
  var trackTabs = document.querySelectorAll(".jukebox-track-tab");

  // Build layer rows for the current track
  function buildLayers() {
    var layers = TRACK_LAYERS[currentTrack];
    var html = "";
    // Drone layers have no rate control (they are continuous)
    var hasRate = { drone: false, breeze: false };

    for (var i = 0; i < layers.length; i++) {
      var l = layers[i];
      var showRate = hasRate[l.key] !== false;
      html +=
        '<div class="jukebox-layer-row" data-layer="' + l.key + '">' +
          '<button type="button" class="jukebox-preview-btn" ' +
            'data-layer="' + l.key + '" title="Preview ' + l.label + '">' +
            '&#9654;</button>' +
          '<button type="button" class="jukebox-preview-stop-btn" ' +
            'data-layer="' + l.key + '" title="Stop preview">' +
            '&#9632;</button>' +
          '<input type="checkbox" class="jukebox-toggle" checked ' +
            'data-layer="' + l.key + '" title="Toggle ' + l.label + '" />' +
          '<label class="jukebox-layer-label" data-layer="' + l.key + '">' +
            l.label +
          '</label>' +
          '<div class="jukebox-layer-sliders">' +
            '<div class="jukebox-slider-row">' +
              '<span class="jukebox-slider-tag vol-tag">VOL</span>' +
              '<div class="jukebox-slider-wrap">' +
                '<input type="range" min="0" max="100" value="75" ' +
                  'class="jukebox-range vol-range" data-layer="' + l.key + '" />' +
              '</div>' +
            '</div>' +
            (showRate ?
            '<div class="jukebox-slider-row">' +
              '<span class="jukebox-slider-tag rate-tag">RATE</span>' +
              '<div class="jukebox-slider-wrap">' +
                '<input type="range" min="0" max="100" value="50" ' +
                  'class="jukebox-range rate-range" data-layer="' + l.key + '" />' +
              '</div>' +
            '</div>' : '') +
          '</div>' +
        '</div>';
    }
    layersContainer.innerHTML = html;
  }

  function updateTheme() {
    // The scene wraps both the mixer frame and the viz frame; placing the
    // theme class there lets CSS selectors cascade into both panels.
    var roots = [jukeboxFrame, jukeboxScene];
    for (var i = 0; i < roots.length; i++) {
      if (!roots[i]) continue;
      roots[i].classList.remove("sycorax-theme", "ariel-theme");
      if (currentTrack === "sycorax") {
        roots[i].classList.add("sycorax-theme");
      } else if (currentTrack === "ariel") {
        roots[i].classList.add("ariel-theme");
      }
    }
  }

  function updateFlavor() {
    flavorEl.innerHTML = FLAVOR_TEXT[currentTrack];
  }

  function updateStatus() {
    var state = ProsperoAudio.getState();
    if (state.playing) {
      statusEl.textContent = "PLAYING";
      statusEl.className = "jukebox-status is-playing";
      playBtn.classList.add("active");
      stopBtn.classList.remove("active");
    } else {
      statusEl.textContent = "STOPPED";
      statusEl.className = "jukebox-status";
      playBtn.classList.remove("active");
      stopBtn.classList.add("active");
    }
  }

  function updateTrackTabs() {
    for (var i = 0; i < trackTabs.length; i++) {
      var tab = trackTabs[i];
      if (tab.getAttribute("data-track") === currentTrack) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    }
  }

  // --- Delegated event handler for the mixer container ---
  // A single listener handles all mixer interactions, surviving innerHTML rebuilds.

  function handleLayerEvent(e) {
    var target = e.target;
    var layer;

    // Preview button click
    if (target.classList.contains("jukebox-preview-btn")) {
      layer = target.getAttribute("data-layer");
      ProsperoAudio.preview(currentTrack, layer);
      return;
    }

    // Preview stop button click
    if (target.classList.contains("jukebox-preview-stop-btn")) {
      ProsperoAudio.stopPreview();
      return;
    }

    // Toggle checkbox change
    if (target.classList.contains("jukebox-toggle")) {
      layer = target.getAttribute("data-layer");
      var enabled = ProsperoAudio.toggleLayer(currentTrack, layer);
      target.checked = enabled;
      var label = layersContainer.querySelector(
        '.jukebox-layer-label[data-layer="' + layer + '"]'
      );
      if (label) {
        if (enabled) {
          label.classList.remove("muted");
        } else {
          label.classList.add("muted");
        }
      }
      return;
    }

    // Label click toggles checkbox
    if (target.classList.contains("jukebox-layer-label")) {
      layer = target.getAttribute("data-layer");
      var toggle = layersContainer.querySelector(
        '.jukebox-toggle[data-layer="' + layer + '"]'
      );
      if (toggle) {
        toggle.checked = !toggle.checked;
        toggle.dispatchEvent(new Event("change"));
      }
      return;
    }

    // Volume slider
    if (target.classList.contains("vol-range")) {
      layer = target.getAttribute("data-layer");
      var vol = parseInt(target.value, 10) / 100;
      ProsperoAudio.setLayerVolume(currentTrack, layer, vol);
      return;
    }

    // Rate slider
    if (target.classList.contains("rate-range")) {
      layer = target.getAttribute("data-layer");
      var slider = parseInt(target.value, 10);
      var rate = Math.pow(10, (slider - 50) / 50);
      ProsperoAudio.setLayerRate(currentTrack, layer, rate);
      return;
    }
  }

  layersContainer.addEventListener("click", handleLayerEvent);
  layersContainer.addEventListener("change", handleLayerEvent);
  layersContainer.addEventListener("input", handleLayerEvent);

  function handlePlay() {
    var state = ProsperoAudio.getState();
    if (state.playing) {
      // Toggle: if already playing, stop
      ProsperoAudio.stop();
    } else {
      ProsperoAudio.play(currentTrack);
    }
    updateStatus();
  }

  function handleStop() {
    ProsperoAudio.stop();
    updateStatus();
  }

  function handleReset() {
    ProsperoAudio.resetLayers(currentTrack);
    buildLayers();
  }

  function handleMasterVol() {
    var val = parseInt(masterVol.value, 10) / 100;
    // Scale 0-1 slider to 0-0.2 audio range (0.12 default is ~60%)
    ProsperoAudio.setMasterVolume(val * 0.2);
  }

  function handleTrackSwitch(e) {
    var track = e.currentTarget.getAttribute("data-track");
    if (track === currentTrack) return;
    ProsperoAudio.switchTrack(track);
    currentTrack = track;
    updateTrackTabs();
    updateTheme();
    buildLayers();
    updateFlavor();
    updateStatus();
  }

  // --- Wire up events ---
  playBtn.addEventListener("click", handlePlay);
  stopBtn.addEventListener("click", handleStop);
  resetBtn.addEventListener("click", handleReset);
  masterVol.addEventListener("input", handleMasterVol);

  for (var i = 0; i < trackTabs.length; i++) {
    trackTabs[i].addEventListener("click", handleTrackSwitch);
  }

  // --- Initialize ---
  updateTheme();
  buildLayers();
  updateFlavor();
  updateStatus();

  // Initialize audio engine and set defaults
  ProsperoAudio.init();
  ProsperoAudio.setMasterVolume(0.12);

  // Illuminate the per-layer preview button while its preview is running.
  // The engine fires this when preview starts, ends naturally (after the
  // preview window), or is aborted by Stop / Play / track switch.
  ProsperoAudio.setPreviewListener(function (track, layer, active) {
    if (track !== currentTrack) return; // button no longer in DOM
    var btn = layersContainer.querySelector(
      '.jukebox-preview-btn[data-layer="' + layer + '"]'
    );
    if (!btn) return;
    if (active) btn.classList.add("active");
    else btn.classList.remove("active");
  });
})();
