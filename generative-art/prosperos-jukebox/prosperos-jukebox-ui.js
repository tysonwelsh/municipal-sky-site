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
      { key: "bass", label: "BASS", desc: "Aleatoric electric bass with a slow narrative arc" },
      { key: "chimes", label: "CHIMES", desc: "Wind chime pings with shimmer" },
      { key: "flutter", label: "FLUTTER", desc: "Quick playful melodic bursts" },
      { key: "bubbles", label: "BUBBLES", desc: "Ascending sine glissandos" },
      { key: "whistle", label: "WHISTLE", desc: "Airy flute-like phrases" },
      { key: "ambient", label: "AMBIENT", desc: "Giggles, birds, sparkles..." },
    ],
  };

  // Per-track explainer body. Rendered as a multi-section HTML blob inside
  // the collapsible #jukebox-flavor block below the mixer. Sections:
  //   <p class="flavor-comp">       — composition / what you're hearing
  //   <p class="flavor-harmonic">   — harmonic-center / "spell pose" concept
  //   <p class="flavor-viz">        — how to read the spiral + constellation
  //   <p class="flavor-mixer">      — mixer/control hint
  function flavor(comp, harmonic, viz, mixer) {
    return (
      '<p class="flavor-comp">' + comp + '</p>' +
      '<p class="flavor-harmonic"><strong>Harmonic state.</strong> ' + harmonic + '</p>' +
      '<p class="flavor-viz"><strong>Spiral.</strong> ' + viz + '</p>' +
      '<p class="flavor-mixer"><strong>Mixer.</strong> ' + mixer + '</p>'
    );
  }
  var VIZ_COMMON =
    'One full turn per octave, 96 spectral samples per turn, anchored on the song\'s tonic so the home note sits at &theta;=0. Each sample lifts upward by its current FFT magnitude; in-key pitch classes are tinted brighter on the label ring. Looking down through the top reveals the <strong>pulse constellation</strong>: drone partials sit on a chromatic ring with growing waveform halos and a connecting line labeled with the interval. ' +
    '<strong>Drag</strong> to rotate &mdash; <strong>AUTO</strong> spins slowly (on by default), <strong>VIEW</strong> resets the camera.';
  var MIXER_COMMON =
    'Each layer row collapses to NAME + PREVIEW + on/off + VOL. The chevron on the left expands the row to reveal layer-specific fine-tune controls (drone warmth, hum openness, chime decay, etc.) plus a per-layer reset.';

  var FLAVOR_TEXT = {
    library: flavor(
      'Generative ambient in <em>C Dorian</em>. Eno-style drone pads drift and overlap. ' +
      'A Markov chain picks harpsichord notes via Karplus-Strong synthesis. ' +
      'Music box pings, a ticking clock with a mind of its own, sparse male humming, ' +
      'and Cage-style chance-selected ambient events &mdash; page turns, owl hoots, ' +
      'distant waves &mdash; create a soundscape that never repeats.',
      'Each drone cycle picks one of four pairs &mdash; C+G (open 5th), Bb+F (warm 4th), D+A (bright 5th), C+Eb (minor 3rd). The active pair sets the <em>harmonic center</em>: melody, music box, and hum bias their note picks toward that center\'s chord tones, so the music drifts harmonically every ~20&nbsp;seconds.',
      VIZ_COMMON,
      MIXER_COMMON
    ),
    sycorax: flavor(
      'Dark generative soundscape in <em>Eb Chromatic-Locrian</em>. ' +
      'Rotating dissonant drone clusters built on tritones and minor seconds. ' +
      'Markov-driven ghost tones with slow vibrato. A spooky waterphone &mdash; ' +
      'inharmonic bell partials with a blooming FM wail and tidal water wobble ' +
      '&mdash; emerges occasionally above the drone. Formant-filtered whispers ' +
      'with drifting vowel shapes. An organic heartbeat that drifts in intensity. ' +
      'Metallic pitch sweeps and dark ambient events &mdash; chains rattling, ' +
      'distant thunder, spectral moans, cauldron bubbles.',
      'Each drone cycle picks a dissonant cluster &mdash; the current <em>spell pose</em>. Unlike Library, the melodic layers don\'t resolve toward the cluster\'s chord tones; the unresolved harmonic tension is the point.',
      VIZ_COMMON,
      MIXER_COMMON
    ),
    ariel: flavor(
      'Generative ambient in <em>F Lydian</em>. ' +
      'Airy breeze pads drift at open fifths with gentle amplitude breathing. ' +
      'A low electric bass anchors the bottom octaves, its sparse roots and ' +
      'occasional flourishes ebbing and swelling on a slow narrative arc. ' +
      'Markov-driven wind chimes shimmer in the upper register. ' +
      'Playful melodic flutter fragments dart and leap. ' +
      'Ascending bubble glissandos, a breathy whistle, ' +
      'and whimsical ambient events &mdash; giggles, birdsong, ' +
      'sparkles, crickets &mdash; all carried on the wind.',
      'Each breeze cycle picks an open-fifth pair as the current <em>harmonic center</em>. Chimes, flutter, and whistle all bias toward chord tones, so the line drifts through related modes without ever wandering far. The whistle layer also drives a <strong>lollipop overlay</strong> on the spiral, tracking its current pitch in real time.',
      VIZ_COMMON,
      MIXER_COMMON
    ),
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

  // Drone/breeze layers are continuous — no per-event rate control.
  var hasRate = { drone: false, breeze: false };

  // Per-layer "fine-tune" knobs that map to ProsperoAudio.setLayerParam.
  // Each entry: { key, label, min, max, step?, default, fmt?(val) }.
  // Slider range is min..max as numeric; `default` is the engine default.
  // Add additional knobs here as the engine exposes them.
  // Knob schema:
  //   { key, label, min, max, step?, default }
  //     Default control type is "slider".
  //   { key, label, type: "segmented", default, options: [{value, label}, ...] }
  //     A 3-position pill group. Engine value is the option's `value` string.
  var EXTRA_KNOBS = {
    library: {
      drone: [
        { key: "warmth",      label: "WARMTH",
          min: 120, max: 1200, step: 20, default: 240 },
        { key: "movement",    label: "MOVEMENT",
          min: 0, max: 0.5, step: 0.01, default: 0.19 },
        { key: "tremoloRate", label: "TREMOLO RATE",
          min: 0.1, max: 3, step: 0.05, default: 0.7 },
        { key: "subChance",   label: "SUB CHANCE",
          min: 0, max: 1, step: 0.05, default: 0.3 },
        { key: "cycleMin",    label: "CYCLE MIN",
          min: 8, max: 35, step: 1, default: 17 },
        { key: "cycleMax",    label: "CYCLE MAX",
          min: 8, max: 35, step: 1, default: 23 },
      ],
      melody: [
        { key: "brightness", label: "BRIGHTNESS",
          min: 1.0, max: 6.0, step: 0.1, default: 3.0 },
        { key: "resonance",  label: "RESONANCE",
          min: 0.3, max: 3.0, step: 0.05, default: 0.5 },
        { key: "sparkle",    label: "SPARKLE",
          min: 0, max: 0.08, step: 0.002, default: 0.03 },
      ],
      musicBox: [
        { key: "shimmer", label: "SHIMMER",
          min: 0, max: 0.02, step: 0.001, default: 0.006 },
        { key: "decay",   label: "DECAY",
          min: 0.4, max: 2.5, step: 0.05, default: 1.0 },
        { key: "cluster", label: "CLUSTER",
          min: 0, max: 0.6, step: 0.02, default: 0.2 },
      ],
      clock: [
        { key: "pitch",    label: "PITCH",
          min: 0.4, max: 1.6, step: 0.05, default: 1.0 },
        { key: "wander",   label: "WANDER",
          min: 0, max: 250, step: 5, default: 60 },
        { key: "mischief", label: "MISCHIEF",
          min: 0, max: 0.4, step: 0.02, default: 0.15 },
      ],
      hum: [
        // Higher = wider formant bandpass = more of the note's pitch
        // survives the vowel filter (more visible on the spiral).
        { key: "openness", label: "OPENNESS",
          min: 0.4, max: 3.0, step: 0.05, default: 1.0 },
        { key: "waver",    label: "WAVER",
          min: 0, max: 3, step: 0.05, default: 1.0 },
        { key: "vibrato",  label: "VIBRATO",
          min: 0, max: 3, step: 0.05, default: 1.0 },
      ],
      ambient: [
        { key: "density", label: "DENSITY",
          min: 0.3, max: 2.5, step: 0.05, default: 1.0 },
        { key: "variety", label: "VARIETY", type: "segmented",
          default: "default",
          options: [
            { value: "uniform", label: "UNIF" },
            { value: "default", label: "DFLT" },
            { value: "focused", label: "FOCS" },
          ],
        },
      ],
    },
    sycorax: {
      drone: [
        { key: "darkness",  label: "DARKNESS",
          min: 0.4, max: 2.5, step: 0.05, default: 1.0 },
        { key: "drift",     label: "DRIFT",
          min: 0, max: 2.5, step: 0.05, default: 1.0 },
        { key: "subChance", label: "SUB CHANCE",
          min: 0, max: 1, step: 0.05, default: 0.25 },
        { key: "cycleMin",  label: "CYCLE MIN",
          min: 8, max: 40, step: 1, default: 20 },
        { key: "cycleMax",  label: "CYCLE MAX",
          min: 8, max: 40, step: 1, default: 28 },
      ],
      whispers: [
        { key: "hushed", label: "HUSHED",
          min: 0.3, max: 2.5, step: 0.05, default: 1.0 },
        { key: "drift",  label: "DRIFT",
          min: 0, max: 3, step: 0.05, default: 1.0 },
        { key: "length", label: "LENGTH",
          min: 0.4, max: 2.5, step: 0.05, default: 1.0 },
      ],
      ghost: [
        { key: "detune",  label: "DETUNE",
          min: 0, max: 3, step: 0.05, default: 1.0 },
        { key: "vibrato", label: "VIBRATO",
          min: 0, max: 3, step: 0.05, default: 1.0 },
        { key: "vibRate", label: "VIB RATE",
          min: 0.3, max: 3, step: 0.05, default: 1.0 },
      ],
      waterphone: [
        { key: "wail",    label: "WAIL",
          min: 0, max: 2.5, step: 0.05, default: 1.0 },
        { key: "bloom",   label: "BLOOM",
          min: 0, max: 2, step: 0.05, default: 1.0 },
        { key: "shimmer", label: "SHIMMER",
          min: 0, max: 2.5, step: 0.05, default: 1.0 },
        { key: "gliss",   label: "GLISS",
          min: 0, max: 3, step: 0.05, default: 1.0 },
      ],
      heartbeat: [
        { key: "tempo",        label: "TEMPO",
          min: 0.3, max: 3, step: 0.05, default: 1.0 },
        { key: "depth",        label: "DEPTH",
          min: 0.3, max: 2, step: 0.05, default: 1.0 },
        { key: "irregularity", label: "IRREGULARITY",
          min: 0, max: 0.4, step: 0.02, default: 0.15 },
      ],
      scrape: [
        { key: "metal", label: "METAL",
          min: 0.3, max: 2.5, step: 0.05, default: 1.0 },
        { key: "range", label: "RANGE",
          min: 0.3, max: 3, step: 0.05, default: 1.0 },
        { key: "direction", label: "DIRECTION", type: "segmented",
          default: "random",
          options: [
            { value: "up",     label: "UP"  },
            { value: "down",   label: "DN"  },
            { value: "dip",    label: "DIP" },
            { value: "random", label: "RND" },
          ],
        },
      ],
      ambient: [
        { key: "density", label: "DENSITY",
          min: 0.3, max: 2.5, step: 0.05, default: 1.0 },
        { key: "variety", label: "VARIETY", type: "segmented",
          default: "default",
          options: [
            { value: "uniform", label: "UNIF" },
            { value: "default", label: "DFLT" },
            { value: "focused", label: "FOCS" },
          ],
        },
      ],
    },
    ariel: {
      breeze: [
        { key: "breath",    label: "BREATH",
          min: 0, max: 3, step: 0.1, default: 1.0 },
        { key: "drift",     label: "DRIFT",
          min: 0.3, max: 3, step: 0.05, default: 1.0 },
        { key: "subChance", label: "SUB CHANCE",
          min: 0, max: 1, step: 0.05, default: 0.4 },
        { key: "swell",     label: "SWELL",
          min: 0, max: 3, step: 0.05, default: 1.0 },
        { key: "cycleMin",  label: "CYCLE MIN",
          min: 8, max: 30, step: 1, default: 15 },
        { key: "cycleMax",  label: "CYCLE MAX",
          min: 8, max: 30, step: 1, default: 20 },
      ],
      bass: [
        { key: "space",    label: "SPACE",
          min: 0, max: 1, step: 0.01, default: 0.6 },
        { key: "flourish", label: "FLOURISH",
          min: 0, max: 1, step: 0.01, default: 0.2 },
        { key: "reach",    label: "REACH",
          min: 0, max: 1, step: 0.01, default: 0.25 },
      ],
      chimes: [
        { key: "decay",  label: "DECAY",
          min: 0.3, max: 3, step: 0.05, default: 1.0 },
        { key: "detune", label: "DETUNE",
          min: 0, max: 4, step: 0.05, default: 1.0 },
        { key: "burst",  label: "BURST",
          min: 0.3, max: 2.5, step: 0.05, default: 1.0 },
      ],
      flutter: [
        { key: "speed",  label: "SPEED",
          min: 0.3, max: 2.5, step: 0.05, default: 1.0 },
        { key: "detune", label: "DETUNE",
          min: 0, max: 4, step: 0.05, default: 1.0 },
        { key: "rest",   label: "REST",
          min: 0, max: 0.7, step: 0.02, default: 0.2 },
      ],
      bubbles: [
        { key: "reach",    label: "REACH",
          min: 0.3, max: 2.5, step: 0.05, default: 1.0 },
        { key: "duration", label: "DURATION",
          min: 0.3, max: 3, step: 0.05, default: 1.0 },
        { key: "cluster",  label: "CLUSTER",
          min: 0, max: 1, step: 0.02, default: 0.66 },
      ],
      whistle: [
        { key: "vibrato", label: "VIBRATO",
          min: 0, max: 3, step: 0.05, default: 1.0 },
        { key: "vibRate", label: "VIB RATE",
          min: 0.3, max: 2.5, step: 0.05, default: 1.0 },
        { key: "breath",  label: "BREATH",
          min: 0, max: 3, step: 0.05, default: 1.0 },
      ],
      ambient: [
        { key: "density", label: "DENSITY",
          min: 0.3, max: 2.5, step: 0.05, default: 1.0 },
        { key: "variety", label: "VARIETY", type: "segmented",
          default: "default",
          options: [
            { value: "uniform", label: "UNIF" },
            { value: "default", label: "DFLT" },
            { value: "focused", label: "FOCS" },
          ],
        },
      ],
    },
  };
  function getExtraKnobs(track, layer) {
    return (EXTRA_KNOBS[track] && EXTRA_KNOBS[track][layer]) || [];
  }

  // Per-layer expanded state, keyed by "<track>:<layer>". Survives mixer
  // rebuilds so toggling a track doesn't fold every row back up.
  var expandedState = {};
  function stateKey(track, layer) { return track + ":" + layer; }

  // Build layer rows for the current track. Each row is a collapsible
  // card: the header (chevron + preview + toggle + name) is always
  // visible; the body (description + sliders + reset) appears when
  // expanded. State persists in `expandedState`.
  function buildLayers() {
    var layers = TRACK_LAYERS[currentTrack];
    var html = "";

    for (var i = 0; i < layers.length; i++) {
      var l = layers[i];
      var showRate = hasRate[l.key] !== false;
      var isExpanded = !!expandedState[stateKey(currentTrack, l.key)];
      // Body sliders (everything except VOL which now lives in the header).
      // RATE first (where applicable), then any fine-tune knobs.
      var sliderRows = (showRate ?
        '<div class="jukebox-slider-row">' +
          '<span class="jukebox-slider-tag rate-tag">RATE</span>' +
          '<span class="jukebox-val-readout">50</span>' +
          '<div class="jukebox-slider-wrap">' +
            '<input type="range" min="0" max="100" value="50" ' +
              'class="jukebox-range rate-range" data-layer="' + l.key + '" />' +
          '</div>' +
        '</div>' : '');

      var extras = getExtraKnobs(currentTrack, l.key);
      for (var ek = 0; ek < extras.length; ek++) {
        var knob = extras[ek];
        var current = ProsperoAudio.getLayerParam
          ? ProsperoAudio.getLayerParam(currentTrack, l.key, knob.key, knob.default)
          : knob.default;
        if (knob.type === "segmented") {
          var segHtml = "";
          for (var oi = 0; oi < knob.options.length; oi++) {
            var opt = knob.options[oi];
            var activeCls = opt.value === current ? " active" : "";
            segHtml +=
              '<button type="button" class="jukebox-segmented-btn' + activeCls + '" ' +
                'data-layer="' + l.key + '" data-param="' + knob.key + '" ' +
                'data-value="' + opt.value + '">' +
                opt.label +
              '</button>';
          }
          sliderRows +=
            '<div class="jukebox-slider-row">' +
              '<span class="jukebox-slider-tag param-tag">' + knob.label + '</span>' +
              '<div class="jukebox-segmented">' + segHtml + '</div>' +
            '</div>';
        } else {
          sliderRows +=
            '<div class="jukebox-slider-row">' +
              '<span class="jukebox-slider-tag param-tag">' + knob.label + '</span>' +
              '<span class="jukebox-val-readout">' + current + '</span>' +
              '<div class="jukebox-slider-wrap">' +
                '<input type="range" ' +
                  'min="' + knob.min + '" max="' + knob.max + '" ' +
                  'step="' + (knob.step || 1) + '" ' +
                  'value="' + current + '" ' +
                  'class="jukebox-range param-range" ' +
                  'data-layer="' + l.key + '" data-param="' + knob.key + '" />' +
              '</div>' +
            '</div>';
        }
      }

      html +=
        '<div class="jukebox-layer-row' + (isExpanded ? ' is-expanded' : '') +
              '" data-layer="' + l.key + '">' +
          '<div class="jukebox-layer-header">' +
            '<button type="button" class="jukebox-layer-expand" ' +
              'data-layer="' + l.key + '" ' +
              'title="' + (isExpanded ? 'Collapse' : 'Expand') + '">&#9656;</button>' +
            '<button type="button" class="jukebox-preview-btn" ' +
              'data-layer="' + l.key + '" title="Preview ' + l.label + '">&#9654;</button>' +
            '<button type="button" class="jukebox-preview-stop-btn" ' +
              'data-layer="' + l.key + '" title="Stop preview">&#9632;</button>' +
            '<input type="checkbox" class="jukebox-toggle" checked ' +
              'data-layer="' + l.key + '" title="Toggle ' + l.label + '" />' +
            '<label class="jukebox-layer-label" data-layer="' + l.key + '">' +
              l.label +
            '</label>' +
            '<div class="jukebox-layer-vol-wrap">' +
              '<span class="jukebox-slider-tag vol-tag">VOL</span>' +
              '<span class="jukebox-val-readout">75</span>' +
              '<div class="jukebox-slider-wrap">' +
                '<input type="range" min="0" max="100" value="75" ' +
                  'class="jukebox-range vol-range" data-layer="' + l.key + '" />' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="jukebox-layer-body">' +
            '<p class="jukebox-layer-desc">' + l.desc + '</p>' +
            '<div class="jukebox-layer-sliders">' + sliderRows + '</div>' +
            '<button type="button" class="jukebox-layer-reset-btn" ' +
              'data-layer="' + l.key + '" title="Reset this layer to defaults">' +
              '&#8635; RESET' +
            '</button>' +
          '</div>' +
        '</div>';
    }
    layersContainer.innerHTML = html;
    // Initialize --val on every freshly-rendered range slider so the
    // amber fill matches each slider's default position out of the box.
    var ranges = layersContainer.querySelectorAll("input[type='range']");
    for (var rs = 0; rs < ranges.length; rs++) syncSliderFill(ranges[rs]);
  }

  function updateTheme() {
    // Apply the design-token theme (sets CSS vars from JUKEBOX_THEMES on
    // .jukebox-frame + .jukebox-scene). This is the source of truth for
    // every theme-aware component.
    if (typeof window.applyJukeboxTheme === "function") {
      window.applyJukeboxTheme(currentTrack);
    }
    // Legacy class hook — some unmigrated CSS rules still scope to
    // .sycorax-theme / .ariel-theme; keep the class in sync so they
    // don't go stale during the gradual migration to vars.
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
      stopBtn.classList.remove("active");
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

    // Chevron click: toggle the row's expanded state. State persists in
    // `expandedState` so switching tracks and back doesn't fold rows back up.
    if (target.classList.contains("jukebox-layer-expand")) {
      layer = target.getAttribute("data-layer");
      var row = layersContainer.querySelector(
        '.jukebox-layer-row[data-layer="' + layer + '"]'
      );
      if (row) {
        var nowExpanded = !row.classList.contains("is-expanded");
        row.classList.toggle("is-expanded", nowExpanded);
        expandedState[stateKey(currentTrack, layer)] = nowExpanded;
        target.title = nowExpanded ? "Collapse" : "Expand";
      }
      return;
    }

    // Per-layer reset: restore vol + rate + fine-tune knobs to defaults.
    if (target.classList.contains("jukebox-layer-reset-btn")) {
      layer = target.getAttribute("data-layer");
      var defaults = ProsperoAudio.DEFAULT_LAYER_VOL || {};
      var defaultVol = defaults[layer] != null ? defaults[layer] : 0.75;
      ProsperoAudio.setLayerVolume(currentTrack, layer, defaultVol);
      ProsperoAudio.setLayerRate(currentTrack, layer, 1.0);
      if (ProsperoAudio.resetLayerParams) {
        ProsperoAudio.resetLayerParams(currentTrack, layer);
      }
      // Sync the slider DOM so the UI reflects the engine state.
      var volEl = layersContainer.querySelector(
        '.vol-range[data-layer="' + layer + '"]'
      );
      if (volEl) volEl.value = Math.round(defaultVol * 100);
      var rateEl = layersContainer.querySelector(
        '.rate-range[data-layer="' + layer + '"]'
      );
      if (rateEl) rateEl.value = 50; // 50 maps to rate=1.0 via Math.pow(10, 0)
      // Reset each fine-tune knob (slider or segmented) to its default
      var extrasReset = getExtraKnobs(currentTrack, layer);
      for (var er = 0; er < extrasReset.length; er++) {
        var ek2 = extrasReset[er];
        if (ek2.type === "segmented") {
          var segBtns = layersContainer.querySelectorAll(
            '.jukebox-segmented-btn[data-layer="' + layer +
            '"][data-param="' + ek2.key + '"]'
          );
          for (var sr = 0; sr < segBtns.length; sr++) {
            segBtns[sr].classList.toggle(
              "active",
              segBtns[sr].getAttribute("data-value") === ek2.default
            );
          }
        } else {
          var el = layersContainer.querySelector(
            '.param-range[data-layer="' + layer +
            '"][data-param="' + ek2.key + '"]'
          );
          if (el) el.value = ek2.default;
        }
      }
      return;
    }

    // Preview button click. The engine's preview() silently no-ops when the
    // full transport is playing — so stop the transport first to make sure
    // the layer preview is always audible.
    if (target.classList.contains("jukebox-preview-btn")) {
      layer = target.getAttribute("data-layer");
      var st = ProsperoAudio.getState();
      if (st.playing) {
        ProsperoAudio.stop();
        updateStatus();
      }
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

    // Per-layer fine-tune knob (Phase 2)
    if (target.classList.contains("param-range")) {
      layer = target.getAttribute("data-layer");
      var paramKey = target.getAttribute("data-param");
      var paramVal = parseFloat(target.value);
      if (ProsperoAudio.setLayerParam) {
        ProsperoAudio.setLayerParam(currentTrack, layer, paramKey, paramVal);
      }
      return;
    }

    // Segmented control click — string-valued param. Toggle active state
    // on the clicked button and clear its siblings.
    if (target.classList.contains("jukebox-segmented-btn")) {
      layer = target.getAttribute("data-layer");
      var segKey = target.getAttribute("data-param");
      var segVal = target.getAttribute("data-value");
      if (ProsperoAudio.setLayerParam) {
        ProsperoAudio.setLayerParam(currentTrack, layer, segKey, segVal);
      }
      var siblings = layersContainer.querySelectorAll(
        '.jukebox-segmented-btn[data-layer="' + layer +
        '"][data-param="' + segKey + '"]'
      );
      for (var ss = 0; ss < siblings.length; ss++) {
        siblings[ss].classList.toggle("active", siblings[ss] === target);
      }
      return;
    }
  }

  layersContainer.addEventListener("click", handleLayerEvent);
  layersContainer.addEventListener("change", handleLayerEvent);
  layersContainer.addEventListener("input", handleLayerEvent);

  // Keep the CSS custom property --val in sync with every range input's
  // current value. The slider track's amber fill is `linear-gradient(...
  // var(--slider-fill) 0 var(--val), ...)`, so without this the fill
  // would freeze at the initial 50% defined in the base CSS.
  function syncSliderFill(el) {
    if (!el || el.type !== "range") return;
    var min = parseFloat(el.min || 0);
    var max = parseFloat(el.max || 100);
    var val = parseFloat(el.value);
    if (max === min) return;
    var pct = ((val - min) / (max - min)) * 100;
    el.style.setProperty("--val", pct.toFixed(2) + "%");
    // Update the readout text. The readout is the .jukebox-val-readout
    // span sitting just before the .jukebox-slider-wrap that contains
    // the input — look up one level (.jukebox-slider-wrap) then back
    // one sibling (.jukebox-val-readout). Falls back to a global id for
    // the master volume.
    var wrap = el.parentElement;
    var readout = wrap && wrap.previousElementSibling;
    if (!readout || !readout.classList.contains("jukebox-val-readout")) {
      // Master vol is wired via id rather than DOM proximity.
      if (el.id === "jukebox-master-vol") {
        readout = document.getElementById("jukebox-master-vol-val");
      } else {
        readout = null;
      }
    }
    if (readout) {
      // Param sliders use sub-integer steps — keep 1 decimal place when
      // step is fractional so the readout reads (e.g.) "0.5" not "1".
      var step = parseFloat(el.step || 1);
      readout.textContent = (step < 1)
        ? val.toFixed(step < 0.05 ? 2 : (step < 0.5 ? 2 : 1))
        : Math.round(val).toString();
    }
  }
  // Mixer sliders — delegated. Runs alongside handleLayerEvent.
  layersContainer.addEventListener("input", function (e) {
    syncSliderFill(e.target);
  });

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
    syncSliderFill(masterVol);
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
  syncSliderFill(masterVol);

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
