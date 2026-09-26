// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — an American-utopian aleatoric hymn-engine (audio)
//
// A generative jukebox in the lineage of Prospero's Jukebox, Antariksh, ZANKYŌ
// and BARDO — but this one is close to home: the meetinghouse of a functioning
// colony out at the rim of Kolob's light. Bright where its siblings are dark.
// The congregation is out in the fields; the organ still plays prelude; the
// telegraph taps hymns toward home. Nothing here is derelict. Everything waits,
// hopeful, in enormous open air.
//
// The traditions flowing in (informing, never quoted):
//  · LDS hymnody + English dissenting psalmody — hymn METERS (8.6.8.6 …)
//    govern phrase structure; plagal (IV→I "amen") cadential gravity.
//  · Sacred Harp / camp-meeting — dispersed harmony (parallel fifths LEGAL and
//    lightly rewarded), open/third-less voicings, gapped scales, FUGING
//    entries, LINING-OUT call-and-response.
//  · Aaron Copland — open fifths, prairie strings, clarinet clarity.
//  · John Cage — chance as diegetic oracle (the LIAHONA), scheduled true
//    silence (the stillness), muted-tine prepared-piano timbre.
//  · La Monte Young (Bern, Idaho) — 5-limit just intonation over a fixed
//    tonic; pure sine drones that never stop. The ambient anchor.
//
// Architecture (what makes this one different from its siblings):
//  · A real FOUR-PART HARMONY engine: SATB voice-leading (common tones kept,
//    parallel octaves rejected, parallel fifths rewarded — the tradition).
//  · A hymn-meter PROSODY engine: melodic phrases are poured into metrical
//    lines with fermatas and breath at the line ends.
//  · THE AIR: a courtesy protocol. Melodic voices claim the open air before
//    speaking and defer while another holds it. Space is structural here —
//    as expansive as the frontier. If a motif never gets its turn in a
//    session, that is the piece working.
//  · Sections: prelude → invocation → hymn×n → testimony → sacrament →
//    doxology → postlude, conducted by THE CHORISTER; meetings drift across
//    META-SEASONS (ordinary / fast day / conference / jubilee).
//  · Everything seeded (mulberry32): a meeting is reproducible and shareable.
//
// Layers: organ, drone, choir, clarinet, harmonium, strings, bells, voice,
// telegraph, ambient — and the bagpipe, SHELVED (owner, 2026-09-13: "just
// kind of obnoxious"): its voice, params and cycle stay in the file, but it
// is never scheduled, never shown on the desk, and its layer gain is pinned
// at zero. See SHELVED below.   Public surface: window.KolobAudio
//
// THE HOUSE, ROOM BY ROOM (Kolob 2, phase 0a — split from the one-file
// kolob-audio.js of v0.30 without changing a note; SCORE.md §1 is the plan):
//   kolob-pitch.js     the tuning: collections, degrees, frequencies, monzos
//   kolob-melody.js    meters, prosody, the motif engine and its gestures
//   kolob-harmony.js   the four-part engine
//   kolob-voices-*.js  the instruments: organ, choir, winds (clarinet and
//                      harmonium), ground (drone, strings, bells, tuba), field
//                      (still small voice, telegraph, the valley), bagpipe
//                      (shelved)
//   kolob-guests.js    the visitations: the question, the bands, the steeples,
//                      the old tune, the cumulative assembly, the raspberry
//   kolob-meeting.js   the chorister: meetings, sections, joints, the arc
//   kolob-core.js      this file: the context, the rooms, the layers, the
//                      clock, the seeded die, and the KolobAudio facade
// The rooms share one state object, KOLOB._s (S); see the note at the top of
// each file. One seeded die (mulberry32) still serves the whole house, drawn
// in the same order as before.
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KolobAudio = (function () {
  "use strict";
  var KOLOB = window.KOLOB;
  // The house's shared state. Each room lends what the others need onto S
  // (see the LENT block above PUBLIC API); a name written S.x belongs
  // to another room; a bare name is this room's own or borrowed below.
  var S = KOLOB._s = KOLOB._s || {};

  // ---- BORROWED — the other rooms' functions, bound late through S (every
  // room is loaded before the first note, so the call always finds its owner) ----
  // from kolob-pitch.js
  function colN() { return S.colN(); }
  function projDeg(d7) { return S.projDeg(d7); }
  function degFreq(i) { return S.degFreq(i); }
  function rebuildScale() { return S.rebuildScale(); }
  function harm(h) { return S.harm(h); }
  // from kolob-voices-organ.js
  function organChord(t, dur, chord, gainMul) { return S.organChord(t, dur, chord, gainMul); }
  function organCycle() { return S.organCycle(); }
  // from kolob-voices-choir.js
  function choirVoiceLine(t, notes, vi, gainMul) { return S.choirVoiceLine(t, notes, vi, gainMul); }
  function choirVerse() { return S.choirVerse(); }
  // from kolob-voices-winds.js
  function renderClarinetLine(t, notes, gainMul) { return S.renderClarinetLine(t, notes, gainMul); }
  function clarinetPhrase() { return S.clarinetPhrase(); }
  function renderHarmonium(t, notes, gainMul) { return S.renderHarmonium(t, notes, gainMul); }
  function harmoniumCycle() { return S.harmoniumCycle(); }
  // from kolob-voices-ground.js
  function tubaBlat(t, gainMul) { return S.tubaBlat(t, gainMul); }
  function droneCycle() { return S.droneCycle(); }
  function stringsPad(t, dur, gainMul, fifthOnly) { return S.stringsPad(t, dur, gainMul, fifthOnly); }
  function stringsCycle() { return S.stringsCycle(); }
  function meetinghouseBell(t, gainMul) { return S.meetinghouseBell(t, gainMul); }
  function tineTap(t, f, amp) { return S.tineTap(t, f, amp); }
  function tineCycle() { return S.tineCycle(); }
  // from kolob-voices-field.js
  function stillVoiceRender(t, dur) { return S.stillVoiceRender(t, dur); }
  function stillVoicePhrase() { return S.stillVoicePhrase(); }
  function telegraphMessage(word) { return S.telegraphMessage(word); }
  function keyMorse(t, seq, side, peak) { return S.keyMorse(t, seq, side, peak); }
  function telegraphCycle() { return S.telegraphCycle(); }
  function evFarBell(t) { return S.evFarBell(t); }
  function ambientEvent() { return S.ambientEvent(); }
  // from kolob-voices-bagpipe.js
  function bagpipeLine(t, notes, gainMul, pan) { return S.bagpipeLine(t, notes, gainMul, pan); }
  function bagpipeCycle() { return S.bagpipeCycle(); }
  // from kolob-meeting.js
  function planMeeting() { return S.planMeeting(); }
  function localArc() { return S.localArc(); }
  function intensity() { return S.intensity(); }
  function inHush() { return S.inHush(); }
  function inFuging() { return S.inFuging(); }
  function inVisit() { return S.inVisit(); }
  function conductorTick() { return S.conductorTick(); }
  function skipToSection(type) { return S.skipToSection(type); }
  // (the other rooms' state, read and written through S: S.F0, S.mode, S.SCALE,
  // S.Harmony, S.C, S.forceVisitation, S.forceRaspberry, S.cumulativeMode,
  // S.seasonPos, S.Motif, S.VI_TO_CHORDPOS, S.OLD_TUNES, S.TELEGRAPH_WORDS,
  // S.FIELD_FNS)

  // ----- Core audio graph -----
  var ctx = null;
  var masterGain = null, compressorNode = null, masterSat = null, glueComp = null;
  var bg = null;                   // background-audio handle (lock-screen survival)
  // droneDuck sits between the drone layer and the hall: the stillness pulls
  // ONLY the drone's ground away (the volume slider owns layerGains.drone, so
  // the automation lives on its own node and the two never fight)
  var droneDuck = null;
  // voicesBus sits between every layer path and the master. STOP silences it
  // and LEAVES it silent — long drone cycles keep their oscillators running
  // for up to 90s after a stop, and the siblings' pattern of restoring the
  // master gain after the fade let them come back from the dead. Not here.
  var voicesBus = null;
  // ROOMS — one space, staged in depth (PLAN-ONE-ROOM phases A/B, v0.27).
  // Two rooms, and EVERY layer sings in both: the CLOSE room is the
  // meetinghouse itself (short; early reflections you can almost see), the
  // WIDE room is the tabernacle (long, breathing). A per-layer depth bias
  // seats each voice nearer or farther in the same building, and one
  // balance knob — set by the section, ramped — moves the whole gathering
  // deeper into the hall or closer to the ear. The equal-power crossfade is
  // Jukebox v2's PJ2.Fx.roomBlend, loaded by relative path (the ZANKYŌ
  // pattern: shared substrate, never modified from here). Before v0.27 each
  // layer was hard-assigned to ONE of two rooms — a parlor for the harmonium
  // and the wire, the tabernacle for the rest, the voice nearly dry — which
  // is exactly what "separate recordings layered on each other" sounds like.
  var roomClose = null, roomWide = null, roomBlend = null;
  var roomBalance = 0.45;          // where the gathering sits now (0 = all close … 1 = all wide)
  var roomBalanceHeld = false;     // dev (room lab): the sections stop moving it
  var roomRampNext = 0.05;         // the first section of a meeting lands at once
  var sharedNoiseBuf = null;
  var NOISE_BUF_DURATION = 30;

  var playing = false;
  var masterVolume = 0.6;

  // ==========================================================================
  // SEEDED RNG — every choice flows through rng(); meetings are reproducible.
  // ==========================================================================
  var seed = (function () {
    try {
      if (typeof location !== "undefined" && location.search) {
        var m = location.search.match(/[?&]seed=(\d+)/);
        if (m) return (parseInt(m[1], 10) >>> 0) || 1847;
      }
    } catch (e) {}
    return (Date.now() % 0xffffffff) >>> 0;
  })();
  var rngState = seed;
  function mulberry32() {
    rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
    var t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rng() { return mulberry32(); }
  function rnd(a, b) { return a + rng() * (b - a); }
  function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
  function chance(p) { return rng() < p; }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function pickW(pool) {              // pool = [[value, weight], ...]
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i][1];
    var r = rng() * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
  }

  // ==========================================================================
  // LAYERS + STATE
  // ==========================================================================
  // NOTE: "tuba" is RESERVED FOR THE RASPBERRY AMEN ONLY — see tubaBlat().
  var LAYERS = ["organ", "drone", "choir", "clarinet", "bagpipe", "harmonium", "strings", "bells", "voice", "telegraph", "tuba", "ambient"];
  // SHELVED layers keep their code, their graph node and their defaults so a
  // change of heart is one line here — but they never sound: their cycle is
  // not scheduled, the desk does not list them (getLayers/getVolumes filter
  // them out), and applyLayerGain pins their gain at zero, so even an
  // audition or a stray Motif hand-off comes out silent.
  var SHELVED = { bagpipe: true };
  // Depth bias per layer — added to the room balance before the equal-power
  // law (negative = nearer the ear). The still small voice stays close, but
  // in the room now; the wire is on the table; the deacon's parlor organ is
  // in the same building as the choir; the landscape and the field are at
  // the back, under the windows.
  var ROOM_DEPTH = { voice: -0.35, telegraph: -0.25, harmonium: -0.15, clarinet: -0.08, bells: 0, choir: 0.05, organ: 0.10, strings: 0.15, drone: 0.15, tuba: 0, bagpipe: 0.05, ambient: 0.20 };

  var layerGains = {};
  var layerVolumes = { organ: 0.52, drone: 0.55, choir: 0.8, clarinet: 0.38, bagpipe: 0.18, harmonium: 0.45, strings: 0.5, bells: 0.5, voice: 0.35, telegraph: 0.25, tuba: 0.5, ambient: 0.5 };
  var layerMuted = {}; LAYERS.forEach(function (l) { layerMuted[l] = false; });
  var layerRate = {}; LAYERS.forEach(function (l) { layerRate[l] = 1; });

  // FIELD — the ambient layer is one bus, but each of its events (wind, crickets,
  // …) now rides its own gain so they can be balanced individually. The event's
  // gain × the ambient bus gives its level; defaults preserve the old sound.
  var FIELD_KEYS = ["wind", "crickets", "clock", "fork", "rain", "coyote", "bell", "beacon"];
  var fieldVolumes = { wind: 2, crickets: 1.52, clock: 1, fork: 1, rain: 2, coyote: 2, bell: 1.56, beacon: 1.38 };
  var fieldMuted = {};
  var fieldGains = {};                            // key -> GainNode (lazily built)

  var LAYER_PARAM_DEFAULTS = {
    organ:     { stops: 0.5, tremulant: 0.15, pedal: 0.6 },
    drone:     { presence: 0.5, fifth: 0.4 },
    choir:     { size: 3, vowel: 0.4, scoop: 0.5 },
    clarinet:  { vibrato: 0.4, pace: 1.0, grace: 0.5 },
    bagpipe:   { grit: 0.42, reed: 0.5, breath: 0.32, pace: 1.0 },
    harmonium: { bellows: 0.5, reed: 0.5, shadow: 0.5 },
    strings:   { warmth: 0.5, lonesome: 0.4 },
    bells:     { ring: 0.55, tine: 0.5 },
    voice:     { presence: 0.4, syllables: 0.4 },
    telegraph: { clack: 0.5 },
    ambient:   {},
  };
  var layerParams = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS));
  // telegraph 0.5: the wire should be an occasional visitor, not a speaker —
  // half the event density while its RATE slider still reads a clean 1.00x.
  var LAYER_RATE_TRIM = { telegraph: 0.5, bells: 0.7 };
  // voice 1.35: the still small voice sat too low in the mix — lift it ~50%
  // in the room without moving its slider (the slider reads layerVolumes, this
  // trim rides on top).
  // clarinet 0.72 / bagpipe 0.49: both sat too loud in the mix. voice 9.0:
  // lifted further by owner request — but the trim was never the reason the
  // voice stayed faint (see the source peak in stillVoiceRender); this rides on
  // top of that source lift. bells 0.8: pulled down 20% by owner request.
  // telegraph 1.5: the wire lifted 50% so its taps carry. The trims seat each
  // while the sliders still read their usual positions.
  var LAYER_VOL_TRIM = { choir: 1.1, voice: 9.0, bagpipe: 0.44, clarinet: 0.72, bells: 0.8, telegraph: 1.5 };

  // The rooms. CLOSE: the meetinghouse — a plain plastered hall, quick and a
  // little bright, its early reflections doing the seating. WIDE: the
  // tabernacle — 5.5 s (down from the old 7.6 s wash), pre-delay 30 ms (down
  // from 55: the first reflections must arrive while the note is still being
  // sung, or the room reads as an effect on a send). Both are POURED —
  // decaying noise under a handful of discrete early taps — unless irUrl
  // names a MEASURED impulse response, which replaces the pour when it
  // decodes (the pour stays the fallback). The room lab (room-lab.php,
  // unlinked) auditions the candidates in ../prosperos-jukebox-v2/ir/.
  //   brightness — HF-damping exponent: LOWER = brighter tail
  //   ripple     — a slow amplitude swell on the tail (the hall inhaling)
  var ROOM_CLOSE = { decayS: 1.4, preDelayS: 0.012, wet: 0.28, brightness: 1.2, ripple: 0, irUrl: null };
  // The tabernacle is a REAL room (owner, 2026-09-14, chosen on the room
  // lab): St Margaret's Church, York — the National Centre for Early Music's
  // nave, measured 11 m back (OpenAIR, AudioLab, University of York,
  // CC BY-SA 3.0; provenance in ../prosperos-jukebox-v2/ir/README.md). The
  // shipped file is the stereo take of that same position, as the Library
  // ships it; the owner auditioned the mono take, which carries its 39 ms of
  // travel time inside the file — the pre-delay here (63 ms, not the pour's
  // 30) reproduces the arrival they chose. The pour below is the FALLBACK if
  // the file can't load.
  var ROOM_WIDE  = { decayS: 5.5, preDelayS: 0.063, wet: 0.40, brightness: 0.8, ripple: { depth: 0.07, hz: 0.5 }, irUrl: "../prosperos-jukebox-v2/ir/rooms/library-wide-st-margarets.wav" };
  // Where each section seats the gathering (0 = all meetinghouse, 1 = all
  // tabernacle), ramped at the boundary: the empty hall before and after;
  // the hymns a step forward; testimony close; the stillness has more room
  // in it.
  var ROOM_BALANCE = { prelude: 0.55, invocation: 0.45, hymn: 0.40, interlude: 0.45, testimony: 0.30, sacrament: 0.60, doxology: 0.50, postlude: 0.55 };
  var ROOM_RAMP_S = 15;

  // ==========================================================================
  // LISTENERS / LOG
  // ==========================================================================
  var noteListeners = [], eventListeners = [];
  function emitNote(layer, freq, startTime, duration, extra) {
    for (var i = 0; i < noteListeners.length; i++) {
      var n = { layer: layer, freq: freq, startTime: startTime, duration: duration || 0 };
      if (extra) { for (var ek in extra) n[ek] = extra[ek]; }   // e.g. telegraph { marks:[…] }
      try { noteListeners[i](n); } catch (e) {}
    }
  }
  function emitEvent(ev) {
    ev.t = ctx ? ctx.currentTime : 0;
    for (var i = 0; i < eventListeners.length; i++) {
      try { eventListeners[i](ev); } catch (e) {}
    }
  }

  // ==========================================================================
  // INIT — signal chain
  //   layers → layerGain → roomBlend (cos/sin pair per layer, depth-biased)
  //   → CLOSE room and WIDE room (each: dry + preDelay→convolver→wet)
  //   → voicesBus → glue → master → masterSat (gentle tanh) → compressor → out.
  //   NO grit bus in Zion: brightness comes from voicing and the hall, not
  //   saturation. (The one dangerous component of the siblings, deleted.)
  // ==========================================================================
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    var noiseSamples = Math.floor(ctx.sampleRate * NOISE_BUF_DURATION);
    sharedNoiseBuf = ctx.createBuffer(1, noiseSamples, ctx.sampleRate);
    var nd = sharedNoiseBuf.getChannelData(0);
    for (var ni = 0; ni < noiseSamples; ni++) nd[ni] = Math.random() * 2 - 1;

    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    voicesBus = ctx.createGain();
    voicesBus.gain.setValueAtTime(1, ctx.currentTime);
    // A gentle shared "glue" compressor across the whole ensemble, before the
    // master chain. Low ratio, wide knee, slow-ish attack: it lets the voices
    // breathe together as one body of sound rather than a stack of separate
    // tracks, without audibly pumping. The blend, not the level, is the point.
    glueComp = ctx.createDynamicsCompressor();
    glueComp.threshold.setValueAtTime(-20, ctx.currentTime);
    glueComp.knee.setValueAtTime(22, ctx.currentTime);
    glueComp.ratio.setValueAtTime(1.7, ctx.currentTime);
    glueComp.attack.setValueAtTime(0.025, ctx.currentTime);
    glueComp.release.setValueAtTime(0.22, ctx.currentTime);
    voicesBus.connect(glueComp);
    glueComp.connect(masterGain);
    compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-18, ctx.currentTime);
    compressorNode.knee.setValueAtTime(16, ctx.currentTime);
    compressorNode.ratio.setValueAtTime(3, ctx.currentTime);
    compressorNode.attack.setValueAtTime(0.015, ctx.currentTime);
    compressorNode.release.setValueAtTime(0.25, ctx.currentTime);
    masterSat = ctx.createWaveShaper();
    var msc = new Float32Array(1024);
    for (var mi = 0; mi < 1024; mi++) { var mx = (mi / 1023) * 2 - 1; msc[mi] = Math.tanh(mx * 1.15) / Math.tanh(1.15); }
    masterSat.curve = msc; masterSat.oversample = "2x";
    masterGain.connect(masterSat);
    masterSat.connect(compressorNode);
    // Final hop: prefer the background-audio route (a MediaStreamDestination
    // feeding a real <audio> element — survives screen lock / backgrounding
    // and carries lock-screen controls). Identical signal either way.
    bg = window.MskyBackgroundAudio ? window.MskyBackgroundAudio.create({
      context: ctx,
      source: compressorNode,
      title: "KOLOB 𐐗𐐄𐐢𐐉𐐒",
      artist: "Municipal Sky",
      artwork: "/images/kolob-share.png",
      onPlay: play,                                  // resumes a held meeting, or calls one
      onPause: pause,                                // the lock screen holds the meeting; it does not end it
    }) : null;
    if (!bg || !bg.routed) compressorNode.connect(ctx.destination);

    try {
      roomClose = makeRoom(ROOM_CLOSE);
      roomWide = makeRoom(ROOM_WIDE);
      roomClose.output.connect(voicesBus);
      roomWide.output.connect(voicesBus);
      if (window.PJ2 && window.PJ2.Fx && window.PJ2.Fx.roomBlend) {
        roomBlend = window.PJ2.Fx.roomBlend(ctx, { close: roomClose.send, wide: roomWide.send, balance: roomBalance });
      } else if (window.console) console.warn("Kolob: pj2-fx.js missing — every voice sings from the tabernacle alone");
    } catch (e) {
      roomClose = roomWide = roomBlend = null;
      if (window.console) console.warn("Kolob effects init failed, dry fallback:", e);
    }

    for (var li = 0; li < LAYERS.length; li++) {
      var layer = LAYERS[li];
      var node = ctx.createGain();
      node.gain.setValueAtTime(1, ctx.currentTime);
      var out = node;
      if (layer === "drone") {
        droneDuck = ctx.createGain();
        droneDuck.gain.setValueAtTime(1, ctx.currentTime);
        node.connect(droneDuck);
        out = droneDuck;                                       // the stillness dips the drone BEFORE the rooms
      }
      seatLayer(layer, out);
      layerGains[layer] = node;
      applyLayerGain(layer);
    }
  }
  // Every layer sings in both rooms; its depth bias seats it.
  function seatLayer(name, src) {
    if (roomBlend) roomBlend.register(name, src, ROOM_DEPTH[name] || 0);
    else if (roomWide) src.connect(roomWide.send);
    else src.connect(voicesBus);
  }
  function wideSend() { return roomWide ? roomWide.send : voicesBus; }

  // ==========================================================================
  // THE ROOMS — one reverb unit per room:
  //   send → dry(1) ──────────────────────────→ output   (→ voicesBus)
  //     └──→ preDelay → convolver → wet(w) ──↗
  // The wet chain is REPLACEABLE: a convolver's buffer is set once, so a new
  // impulse (a measured file that just decoded, or a room-lab swap) goes in
  // as a fresh pre→conv→wet chain crossfaded against the old one over 0.6 s.
  // ==========================================================================
  function makeRoom(spec) {
    var t = ctx.currentTime;
    var r = { spec: spec, send: ctx.createGain(), dry: ctx.createGain(), output: ctx.createGain(), chain: null, loaded: null, loading: null, error: null };
    r.send.gain.setValueAtTime(1, t); r.dry.gain.setValueAtTime(1, t); r.output.gain.setValueAtTime(1, t);
    r.send.connect(r.dry); r.dry.connect(r.output);
    r.chain = wetChain(r, pourIR(spec), 0);
    if (spec.irUrl) loadRoomIR(r, spec.irUrl);
    return r;
  }
  function wetChain(r, buffer, fadeS) {
    var t = ctx.currentTime;
    var pre = ctx.createDelay(0.25);
    pre.delayTime.setValueAtTime(r.spec.preDelayS, t);
    var conv = ctx.createConvolver(); conv.buffer = buffer;
    var wg = ctx.createGain();
    if (fadeS > 0) { wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(r.spec.wet, t + fadeS); }
    else wg.gain.setValueAtTime(r.spec.wet, t);
    r.send.connect(pre); pre.connect(conv); conv.connect(wg); wg.connect(r.output);
    return { pre: pre, conv: conv, wet: wg };
  }
  function setRoomBuffer(r, buffer) {
    var old = r.chain;
    r.chain = wetChain(r, buffer, 0.6);
    if (!old) return;
    var t = ctx.currentTime;
    old.wet.gain.cancelScheduledValues(t);
    old.wet.gain.setValueAtTime(old.wet.gain.value != null ? old.wet.gain.value : r.spec.wet, t);
    old.wet.gain.linearRampToValueAtTime(0, t + 0.6);
    setTimeout(function () {
      try { r.send.disconnect(old.pre); old.pre.disconnect(); old.conv.disconnect(); old.wet.disconnect(); } catch (e) {}
    }, 800);
  }
  // The pour: decaying noise under eight discrete EARLY TAPS. The taps are
  // the seating — the first 8–60 ms after a note is where the ear decides an
  // instrument stands IN a room rather than wearing reverb on a send; a bare
  // noise tail (the pre-v0.27 pour) has no such moment, so it read as a wash
  // behind close-miked tracks. The diffuse tail rises over 60 ms beneath the
  // taps, the way a real hall's does. Unseeded Math.random on purpose: this
  // is texture, not music (the zankyo rule) — the meeting replays from its
  // seed even though every room is a fresh pour.
  var EARLY_TAPS = [[0.008, 0.9], [0.013, 0.7], [0.019, 0.62], [0.026, 0.5], [0.033, 0.42], [0.041, 0.34], [0.052, 0.27], [0.064, 0.2]];
  function pourIR(spec) {
    var sr = ctx.sampleRate;
    var len = Math.max(2, Math.floor(sr * spec.decayS));
    var buf = ctx.createBuffer(2, len, sr);
    var rippleDepth = 0, rippleHz = 0.5;
    if (typeof spec.ripple === "number") rippleDepth = spec.ripple;
    else if (spec.ripple) { rippleDepth = spec.ripple.depth || 0; rippleHz = spec.ripple.hz || 0.5; }
    var tapScale = 0.45 + 0.55 * Math.min(1, spec.decayS / 5.5);   // a small room's walls are nearer
    var fadeStart = Math.floor(len * 0.95);                          // no truncation click at the edge
    var burst = Math.max(4, Math.floor(sr * 0.0015));
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      var ph = Math.random() * Math.PI * 2;
      for (var i = 0; i < len; i++) {
        var t = i / sr;
        var env = Math.exp(-2.2 * t / spec.decayS);
        var hf = Math.exp(-(spec.brightness * 2.6) * t / spec.decayS);
        var color = rippleDepth ? 1 + rippleDepth * Math.sin(2 * Math.PI * rippleHz * t + ph) : 1;
        var edge = i >= fadeStart ? (len - i) / (len - fadeStart) : 1;
        var rise = t < 0.06 ? t / 0.06 : 1;
        data[i] = (Math.random() * 2 - 1) * 0.5 * env * hf * color * edge * rise;
      }
      for (var k = 0; k < EARLY_TAPS.length; k++) {
        // each channel hears the wall a hair apart — decorrelated, so it reads as a SPACE
        var at = EARLY_TAPS[k][0] * tapScale + (ch ? 0.0011 : -0.0007) + Math.random() * 0.0015;
        var i0 = Math.floor(at * sr);
        for (var j = 0; j < burst && i0 + j < len; j++) {
          data[i0 + j] += EARLY_TAPS[k][1] * (Math.random() * 2 - 1) * Math.exp(-j / (sr * 0.0004));
        }
      }
    }
    return buf;
  }
  // A measured impulse response: fetched and decoded once per URL, poured in
  // as a new wet chain when it lands. Any failure — no fetch (the harness),
  // a missing file, undecodable bytes — leaves the pour in place: the
  // meeting can never lose its room to a network hiccup.
  var irCache = {};
  function fetchIR(url) {
    if (!irCache[url]) {
      irCache[url] = fetch(url).then(function (res) {
        if (!res || !res.ok) throw new Error("HTTP " + (res && res.status));
        return res.arrayBuffer();
      }).then(function (ab) {
        return new Promise(function (res, rej) {
          var done = false;
          function ok(b) { if (!done) { done = true; res(b); } }
          function bad(e) { if (!done) { done = true; rej(e || new Error("decode failed")); } }
          try {
            var p = ctx.decodeAudioData(ab, ok, bad);         // callback form first: old Safari
            if (p && p.then) p.then(ok, bad);
          } catch (e) { bad(e); }
        });
      }).catch(function (e) { delete irCache[url]; throw e; });
    }
    return irCache[url];
  }
  function loadRoomIR(r, url) {
    r.loading = url; r.error = null;
    if (typeof fetch !== "function" || typeof ctx.decodeAudioData !== "function") {
      r.loading = null; r.error = "no fetch/decode here"; return;
    }
    fetchIR(url).then(function (buf) {
      if (r.spec.irUrl !== url) return;                   // superseded meanwhile
      r.loading = null; r.loaded = url;
      setRoomBuffer(r, buf);
    }, function (e) {
      if (r.spec.irUrl !== url) return;
      r.loading = null; r.error = String((e && e.message) || e);   // r.loaded keeps naming what still plays
      if (window.console) console.warn("Kolob: room IR failed, the room that was playing stays:", url, e);
    });
  }
  // ---- room controls (the sections drive the balance; the room lab drives everything) ----
  function setRoomBalance(x, rampS, hold) {
    roomBalance = x < 0 ? 0 : x > 1 ? 1 : x;
    if (hold != null) roomBalanceHeld = !!hold;
    if (roomBlend) roomBlend.setBalance(roomBalance, rampS);
  }
  function setLayerDepth(layer, bias) {
    ROOM_DEPTH[layer] = bias;
    if (!roomBlend) return;
    for (var i = 0; i < roomBlend.layers.length; i++) if (roomBlend.layers[i].name === layer) roomBlend.layers[i].bias = bias;
    roomBlend.setBalance(roomBalance, 0.3);                // re-seat at the current balance
  }
  function setRoom(which, patch) {
    init();
    var r = which === "close" ? roomClose : roomWide;
    if (!r) return;
    var spec = r.spec;
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) spec[k] = patch[k];
    var t = ctx.currentTime;
    if ("wet" in patch && r.chain) {
      var g = r.chain.wet.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value != null ? g.value : spec.wet, t);
      g.linearRampToValueAtTime(spec.wet, t + 0.15);
    }
    if ("preDelayS" in patch && r.chain) r.chain.pre.delayTime.setValueAtTime(spec.preDelayS, t);
    if ("irUrl" in patch) {
      if (spec.irUrl) loadRoomIR(r, spec.irUrl);
      else { r.loaded = null; r.loading = null; r.error = null; setRoomBuffer(r, pourIR(spec)); }
    } else if (("decayS" in patch || "brightness" in patch || "ripple" in patch) && !r.loaded) {
      setRoomBuffer(r, pourIR(spec));
    }
  }
  function roomInfo(r) {
    if (!r) return null;
    var o = {};
    for (var k in r.spec) o[k] = r.spec[k];
    o.loaded = r.loaded; o.loading = r.loading; o.error = r.error;
    return o;
  }

  // ==========================================================================
  // SCHEDULING + HELPERS
  // ==========================================================================
  // Every cue the meeting schedules goes through here, so the meeting can be
  // HELD: pause() clears the live timers but keeps each one's function and
  // the time it had left, and suspends the AudioContext (which freezes the
  // clock every section, hush, fuging spell and visit is measured against);
  // resume() lets the clock run and re-arms the held timers with the time
  // they had left. Nothing is pre-generated: the meeting simply stands still.
  var timers = new Map();          // id → { fn, due }   (due on the performance clock, ms)
  var paused = false;
  var held = [];                   // while paused: [{ fn, remaining }]
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function arm(fn, ms) {
    var id = setTimeout(function () {
      timers.delete(id);
      if (!playing) return;
      if (paused) { held.push({ fn: fn, remaining: 0 }); return; }   // never lose a cue to a race
      fn();
    }, ms);
    timers.set(id, { fn: fn, due: nowMs() + ms });
  }
  function scheduleLayer(fn, baseMs, layer) { arm(fn, baseMs / (getRate(layer) || 1)); }
  function scheduleRaw(fn, ms) { arm(fn, ms); }
  function clearAllTimers() { timers.forEach(function (t, id) { clearTimeout(id); }); timers.clear(); held = []; }

  var panPool = {};
  function panAt(layer, p) {
    var pool = panPool[layer];
    if (!pool) {
      // Some width for the open air, but pulled in from the old hard ±0.65
      // slots: voices panned to the far edges read as separate tracks. Closer
      // in, they share the centre and blend into one ensemble.
      pool = panPool[layer] = [-0.42, 0, 0.42].map(function (pp) {
        var sp = ctx.createStereoPanner(); sp.pan.setValueAtTime(pp, ctx.currentTime); sp.connect(layerGains[layer]); return sp;
      });
    }
    var cl = p < -1 ? -1 : (p > 1 ? 1 : p);
    return pool[cl < -0.2 ? 0 : cl > 0.2 ? 2 : 1];
  }
  function getRate(layer) {
    var base = (layerRate[layer] != null ? layerRate[layer] : 1);
    var trim = LAYER_RATE_TRIM[layer] != null ? LAYER_RATE_TRIM[layer] : 1;
    return base * trim;
  }
  function getLayerParam(layer, key, fallback) {
    if (layerParams[layer] && layerParams[layer][key] != null) return layerParams[layer][key];
    return fallback;
  }
  function applyLayerGain(layer) {
    var node = layerGains[layer];
    if (!node) return;
    var trim = LAYER_VOL_TRIM[layer] != null ? LAYER_VOL_TRIM[layer] : 1;
    node.gain.setValueAtTime((layerMuted[layer] || SHELVED[layer]) ? 0 : layerVolumes[layer] * trim, ctx.currentTime);
  }
  function applyFieldGain(key) {
    var fg = fieldGains[key];
    if (fg && ctx) fg.gain.setValueAtTime(fieldMuted[key] ? 0 : fieldVolumes[key], ctx.currentTime);
  }
  // a per-event destination on the FIELD bus: <event gain> -> ambient layer gain,
  // so every field sound keeps the ambient routing (reverb) but its own level.
  function fieldDest(key, pan) {
    var fg = fieldGains[key];
    if (!fg) {
      fg = ctx.createGain();
      fg.connect(layerGains.ambient);
      fieldGains[key] = fg;
      applyFieldGain(key);
    }
    var sp = ctx.createStereoPanner();
    sp.pan.setValueAtTime(pan < -1 ? -1 : pan > 1 ? 1 : pan, ctx.currentTime);
    sp.connect(fg);
    return sp;
  }
  function noiseSource() {
    var n = ctx.createBufferSource();
    n.buffer = sharedNoiseBuf; n.loop = true;
    n.loopStart = 0; n.loopEnd = NOISE_BUF_DURATION;
    return n;
  }
  function noiseOffset() { return rng() * 20; }
  // Click-safe gain envelope: always from true zero, linear on/off ramps.
  function env(g, t, pts) {
    g.gain.setValueAtTime(0, t);
    var tt = t;
    for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); }
    return tt;
  }

  // ==========================================================================
  // THE AIR — the courtesy protocol. This engine's answer to clutter.
  // ==========================================================================
  // A melodic voice claims the air for the length of its phrase plus a margin
  // of silence after; other melodic voices defer and try again later. In hymn
  // sections two voices may share the air (lining-out is a conversation);
  // everywhere else, one speaker at a time and real space between speeches.
  // The landscape voices (organ, drone, strings) never claim it — they are
  // the prairie the speeches happen in.
  var air = { busyUntil: 0, holders: 0 };
  function airLimit() { return S.C.section === "hymn" || S.C.section === "doxology" ? 2 : 1; }
  function airFree() {
    if (!ctx) return true;
    if (ctx.currentTime >= air.busyUntil) { air.holders = 0; return true; }
    return air.holders < airLimit();
  }
  function claimAir(durS, marginS) {
    if (!ctx) return;
    var until = ctx.currentTime + durS + (marginS != null ? marginS : rnd(3, 8));
    if (ctx.currentTime >= air.busyUntil) air.holders = 1;
    else air.holders++;
    air.busyUntil = Math.max(air.busyUntil, until);
  }

  // ==========================================================================
  // SAMPLE — one short isolated gesture per layer, playable while stopped
  // (touch an instrument on the stop rail, hear it alone).
  // ==========================================================================
  function sample(layer) {
    init();
    if (!S.SCALE.length) rebuildScale();
    if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
    if (bg) bg.poke();               // audition while stopped: the <audio> route must be live
    var isField = layer.indexOf("field:") === 0;
    if (!playing && voicesBus) {
      // stopped: reopen the bus and only this layer's gain, so the audition
      // sounds alone
      voicesBus.gain.cancelScheduledValues(ctx.currentTime);
      voicesBus.gain.setValueAtTime(1, ctx.currentTime);
      applyLayerGain(isField ? "ambient" : layer);   // field events ride the ambient bus
    }
    var t = ctx.currentTime + 0.08;
    if (isField) {
      var ffn = S.FIELD_FNS[layer.slice(6)];
      if (ffn) { applyFieldGain(layer.slice(6)); ffn(t); }
      return;
    }
    switch (layer) {
      case "tuba": {
        // auditioning the tuba from the rail is part of the gag:
        // one dignified solo blat, then silence until an amen goes wrong
        tubaBlat(t, 1);
        break;
      }
      case "organ": {
        var ch = S.Harmony.voice(0, { open: false });
        organChord(t, 6, ch, 0.85);
        break;
      }
      case "drone": {
        var master = ctx.createGain();
        master.connect(panAt("drone", 0));
        [[1, 0.4], [2, 0.24], [3, 0.12]].forEach(function (p) {
          var o = ctx.createOscillator();
          o.type = "sine"; o.frequency.setValueAtTime(harm(p[0]), t);
          var og = ctx.createGain(); og.gain.setValueAtTime(p[1], t);
          o.connect(og); og.connect(master);
          o.start(t); o.stop(t + 7);
        });
        env(master, t, [[2.4, 0.5], [2, 0.46], [2.2, 0]]);
        emitNote("drone", S.F0, t, 6.5);
        break;
      }
      case "choir": {
        var ch2 = S.Harmony.voice(0, { open: false });
        [0, 1, 3].forEach(function (vi, k) {
          choirVoiceLine(t + k * 0.12, [{ f: ch2.freqs[S.VI_TO_CHORDPOS[vi]], dur: 4.5 }], vi, 0.85);
        });
        emitNote("choir", ch2.freqs[3], t, 4.5);
        break;
      }
      case "clarinet": {
        var notes = [[-3, 1], [0, 2], [1, 1], [0, 2.6]].map(function (n) {
          return { f: degFreq(projDeg(n[0]) + colN()), dur: n[1] };
        });
        renderClarinetLine(t, notes, 1);
        break;
      }
      case "harmonium": {
        renderHarmonium(t, [{ f: degFreq(projDeg(2)), dur: 5 }], 0.8);
        emitNote("harmonium", degFreq(projDeg(2)), t, 5);
        break;
      }
      case "bagpipe": {
        var bnotes = [[-3, 1], [0, 1.4], [2, 1], [0, 2.4]].map(function (n) {
          return { f: degFreq(projDeg(n[0]) + colN()), dur: n[1] };
        });
        bagpipeLine(t, bnotes, 0.95, 0);
        break;
      }
      case "strings": stringsPad(t, 9, 0.9, false); break;
      case "bells":
        meetinghouseBell(t, 0.8);
        tineTap(t + 2.2, degFreq(projDeg(4) + colN()) * 2, 0.3);
        break;
      case "voice": stillVoiceRender(t, 4.5); break;
      case "telegraph": {
        // a visitation flashes a word home, keyed like the wire
        var telWord = pick(S.TELEGRAPH_WORDS);
        var telSeq = telegraphMessage(telWord);
        var telEnd = keyMorse(t, telSeq, 0.6, 0.055);
        emitNote("telegraph", 0, t, telEnd - t, { marks: telSeq });
        break;
      }
      case "ambient": evFarBell(t); break;
      default: return;
    }
    emitEvent({ cat: "transport", label: "◈ sample " + layer, detail: "" });
  }

  // ==========================================================================
  // TRANSPORT
  // ==========================================================================
  function play() {
    init();
    if (playing) { if (paused) resume(); return; }   // PLAY on a held meeting lets it go on
    if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
    playing = true;
    if (bg) bg.started();
    air.busyUntil = 0; air.holders = 0;
    if (voicesBus) {
      voicesBus.gain.cancelScheduledValues(ctx.currentTime);
      voicesBus.gain.setValueAtTime(1, ctx.currentTime);
    }
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    if (droneDuck) {
      // a stop mid-stillness must not strand the next meeting on a low drone
      droneDuck.gain.cancelScheduledValues(ctx.currentTime);
      droneDuck.gain.setValueAtTime(1, ctx.currentTime);
    }
    LAYERS.forEach(applyLayerGain);
    roomRampNext = 0.05;
    planMeeting();
    // staggered assembly — the valley wakes the way a Sunday begins
    droneCycle();
    scheduleRaw(organCycle, 2500);
    scheduleRaw(stillVoicePhrase, 12000);
    scheduleRaw(ambientEvent, 16000);
    scheduleRaw(choirVerse, 20000);
    scheduleRaw(stringsCycle, 24000);
    scheduleRaw(harmoniumCycle, 30000);
    scheduleRaw(clarinetPhrase, 34000);
    if (!SHELVED.bagpipe) scheduleRaw(bagpipeCycle, 30000);
    scheduleRaw(tineCycle, 42000);
    scheduleRaw(telegraphCycle, 55000);
    scheduleRaw(conductorTick, 1000);
    emitEvent({ cat: "transport", label: "▶ the meeting is called", detail: "seed " + seed });
  }
  // HOLD the meeting where it stands — see the scheduling notes above. The
  // page's transport and the lock-screen pause both come here; PLAY, the
  // pause button again, or the lock-screen play resume it.
  //
  // The clock is not stopped outright: a suspend mid-wave is a click, and a
  // suspend under the lock-screen route (a live stream feeding an <audio>
  // element) is a stutter while the element pulls on a stalled stream. So
  // the master fades to nothing over a short breath first; then the element
  // rests, then the clock stops. Resume runs the same in reverse.
  var PAUSE_FADE = 0.16;                           // seconds
  var pauseTimer = null;
  function pause() {
    if (!playing || paused) return;
    paused = true;
    var now = nowMs();
    timers.forEach(function (t, id) { clearTimeout(id); held.push({ fn: t.fn, remaining: Math.max(0, t.due - now) }); });
    timers.clear();
    var t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.linearRampToValueAtTime(0, t + PAUSE_FADE);
    pauseTimer = setTimeout(function () {
      pauseTimer = null;
      if (!paused) return;                         // resumed during the fade
      if (bg) { if (bg.hold) bg.hold(); else bg.stopped(); }   // the element rests, the lock screen shows paused
      try { if (ctx.state === "running") ctx.suspend(); } catch (e) {}
    }, PAUSE_FADE * 1000 + 40);
  }
  function resume() {
    if (!playing || !paused) return;
    paused = false;
    if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
    var go = function () {
      if (!playing || paused) return;              // stopped, or held again, while the clock woke
      if (bg) bg.started();
      var t = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(t);
      masterGain.gain.setValueAtTime(masterGain.gain.value, t);
      masterGain.gain.linearRampToValueAtTime(masterVolume, t + PAUSE_FADE);
      var list = held; held = [];
      list.forEach(function (h) { arm(h.fn, h.remaining); });
    };
    if (ctx.state !== "running") {
      var p = null;
      try { p = ctx.resume(); } catch (e) {}
      if (p && p.then) p.then(go, go); else go();
    } else go();
  }
  function stop() {
    playing = false;
    if (bg) bg.stopped();
    clearAllTimers();
    if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
    if (paused) {                                    // a stop from a hold: let the clock run so the fade can
      paused = false;
      try { if (ctx && ctx.state !== "running") ctx.resume(); } catch (e) {}
    }
    if (voicesBus && ctx) {
      var t = ctx.currentTime;
      // fade the voices bus to zero and LEAVE it there — the drone's
      // oscillators keep running for up to 90s, silently, until they end
      voicesBus.gain.cancelScheduledValues(t);
      voicesBus.gain.setValueAtTime(voicesBus.gain.value != null ? voicesBus.gain.value : 1, t);
      voicesBus.gain.linearRampToValueAtTime(0, t + 0.6);
      // a stop during a stillness would otherwise strand the master at its
      // hushed level; restore it silently behind the closed bus
      masterGain.gain.cancelScheduledValues(t);
      masterGain.gain.setValueAtTime(masterVolume, t + 0.7);
      scheduleForStop();
    }
    emitEvent({ cat: "transport", label: "■ the benches empty", detail: "" });
  }
  function scheduleForStop() {
    setTimeout(function () {
      if (!playing && ctx) {
        // belt and braces: zero the layer gains too, so a later sample() of
        // one stop cannot resurrect another layer's lingering cycle
        LAYERS.forEach(function (l) {
          if (layerGains[l]) layerGains[l].gain.setValueAtTime(0, ctx.currentTime);
        });
      }
    }, 800);
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  Object.defineProperty(S, "ctx", { enumerable: true, get: function () { return ctx; }, set: function (v) { ctx = v; } });
  Object.defineProperty(S, "droneDuck", { enumerable: true, get: function () { return droneDuck; }, set: function (v) { droneDuck = v; } });
  Object.defineProperty(S, "roomBalanceHeld", { enumerable: true, get: function () { return roomBalanceHeld; }, set: function (v) { roomBalanceHeld = v; } });
  Object.defineProperty(S, "roomRampNext", { enumerable: true, get: function () { return roomRampNext; }, set: function (v) { roomRampNext = v; } });
  Object.defineProperty(S, "playing", { enumerable: true, get: function () { return playing; }, set: function (v) { playing = v; } });
  S.rng = rng;
  S.rnd = rnd;
  S.rint = rint;
  S.chance = chance;
  S.pick = pick;
  S.pickW = pickW;
  S.SHELVED = SHELVED;
  S.ROOM_BALANCE = ROOM_BALANCE;
  S.ROOM_RAMP_S = ROOM_RAMP_S;
  S.emitNote = emitNote;
  S.emitEvent = emitEvent;
  S.wideSend = wideSend;
  S.setRoomBalance = setRoomBalance;
  S.scheduleLayer = scheduleLayer;
  S.scheduleRaw = scheduleRaw;
  S.panAt = panAt;
  S.getLayerParam = getLayerParam;
  S.fieldDest = fieldDest;
  S.noiseSource = noiseSource;
  S.noiseOffset = noiseOffset;
  S.env = env;
  S.air = air;
  S.airFree = airFree;
  S.claimAir = claimAir;

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================
  return {
    init: init,
    play: play,
    pause: pause,
    resume: resume,
    stop: stop,
    isPlaying: function () { return playing; },
    isPaused: function () { return playing && paused; },
    sample: sample,
    setMasterVolume: function (v) { masterVolume = v; if (masterGain && ctx && playing) masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.1); },
    setLayerVolume: function (layer, v) { layerVolumes[layer] = v; if (ctx) applyLayerGain(layer); },
    toggleLayer: function (layer) { layerMuted[layer] = !layerMuted[layer]; if (ctx) applyLayerGain(layer); return !layerMuted[layer]; },
    setLayerRate: function (layer, r) { layerRate[layer] = r; },
    setLayerParam: function (layer, key, v) { if (!layerParams[layer]) layerParams[layer] = {}; layerParams[layer][key] = v; },
    getLayerParam: getLayerParam,
    getLayerDefaults: function () { return JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS)); },
    getLayers: function () { return LAYERS.filter(function (l) { return !SHELVED[l]; }); },
    getVolumes: function () {
      var out = {};
      for (var k in layerVolumes) if (!SHELVED[k]) out[k] = layerVolumes[k];
      return out;
    },
    getFieldKeys: function () { return FIELD_KEYS.slice(); },
    getFieldVolumes: function () { return JSON.parse(JSON.stringify(fieldVolumes)); },
    setFieldVolume: function (key, v) { fieldVolumes[key] = v; applyFieldGain(key); },
    toggleField: function (key) { fieldMuted[key] = !fieldMuted[key]; applyFieldGain(key); return !fieldMuted[key]; },
    getSeed: function () { return seed; },
    reseed: function (s) { seed = (s >>> 0) || 1847; rngState = seed; },
    getConductor: function () {
      return {
        meeting: S.C.meetingNum, activity: S.C.meeting ? S.C.meeting.activity : null,
        section: S.C.section, meter: S.C.meter, mode: S.mode,
        local: localArc(), intensity: intensity(),
        hush: inHush(), fuging: inFuging(),
        visit: (ctx && ctx.currentTime < S.C.assemblyUntil) ? "assembly" : (inVisit() ? S.C.visitType : null),
        f0: S.F0, season: S.seasonPos,
        sectionIndex: S.C.si, planLength: S.C.plan.length,
        plan: S.C.plan.map(function (s) { return s.type; }),   // the wheel folds hymns onto one seat
        fifths: S.Harmony.fifthCount(),
      };
    },
    getHarmony: function () { return S.Harmony.current(); },
    getAudioTime: function () { return ctx ? ctx.currentTime : 0; },
    skipToSection: skipToSection,
    getMotifStats: function () { return S.Motif.stats(); },
    setNoteListener: function (fn) { noteListeners.push(fn); },
    setEventListener: function (fn) { eventListeners.push(fn); },
    setForceVisitation: function (on) { S.forceVisitation = !!on; },
    setForceRaspberry: function (on) { S.forceRaspberry = !!on; },
    setCumulativeMode: function (s) { if (s === "always" || s === "natural" || s === "never") S.cumulativeMode = s; },
    getCumulativeMode: function () { return S.cumulativeMode; },
    // dev accessor for the tune lab — the pool lives HERE and only here, so
    // lab and engine can never drift apart
    getOldTunes: function () { return JSON.parse(JSON.stringify(S.OLD_TUNES)); },
    isForceVisitation: function () { return S.forceVisitation; },
    // the rooms (dev — the room lab drives these; the sections drive the balance)
    getRooms: function () {
      var depth = {}; for (var k in ROOM_DEPTH) depth[k] = ROOM_DEPTH[k];
      var sb = {}; for (var s2 in ROOM_BALANCE) sb[s2] = ROOM_BALANCE[s2];
      return { close: roomInfo(roomClose), wide: roomInfo(roomWide), blend: !!roomBlend, balance: roomBalance, held: roomBalanceHeld, depth: depth, sectionBalance: sb };
    },
    setRoom: setRoom,
    // warm a measured room before it is asked for, so an A/B flip is a crossfade, not a wait
    preloadRoomIR: function (url) { init(); return (typeof fetch === "function" && url) ? fetchIR(url) : Promise.reject(new Error("no fetch")); },
    setRoomBalance: setRoomBalance,
    setLayerDepth: setLayerDepth,
    attachAnalyser: function () {
      if (!ctx || !masterGain) return null;
      var an = ctx.createAnalyser(); an.fftSize = 1024;
      masterGain.connect(an);
      return an;
    },
  };
})();
