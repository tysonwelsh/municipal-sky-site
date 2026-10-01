// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — kolob-core.js: the facade (window.KolobAudio)
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
// What makes this one different from its siblings:
//  · A real FOUR-PART HARMONY engine: SATB voice-leading (common tones kept,
//    parallel octaves rejected, parallel fifths rewarded — the tradition).
//  · A hymn-meter PROSODY engine: melodic phrases are poured into metrical
//    lines with fermatas and breath at the line ends.
//  · THE AIR: a courtesy protocol. Melodic voices claim the open air before
//    speaking and defer while another holds it. Space is structural here —
//    as expansive as the frontier. If a motif never gets its turn in a
//    session, that is the piece working.
//  · Sections: prelude → invocation → hymn×n → testimony → sacrament →
//    doxology → postlude, conducted by THE CHORISTER (kolob-meeting.js);
//    every visit draws a Sunday of the colony year (kolob-calendar.js), and
//    the four kinds of meeting the house has always known (ordinary / fast
//    day / conference / jubilee) stand under the nine Sundays.
//  · Everything seeded (PJ2.Rand streams, one per voice and purpose) and
//    kept on the audio clock (PJ2.Clock): a meeting is reproducible and
//    shareable, and the same seed plays the same meeting however late the
//    browser's timers run.
//
// THIS FILE is the house's foundation and its one public face:
//  · the audio graph — the layers, the two rooms and their blend, the glue
//    and the master chain (INIT — signal chain, below);
//  · THE DICE — the visit's seed, and every stream forked from it by name;
//  · THE CLOCK — PJ2.Clock: every cue on the audio clock, at its own time;
//  · THE DOORS — what a meeting connects into the hall, shut at STOP;
//  · THE HOUSE LETS GO, THE AIR, the audition rail (SAMPLE), the TRANSPORT;
//  · the LENT block (what this room shares on KOLOB._s) and the PUBLIC API,
//    the only thing the page (kolob-ui.js, kolob-viz.js) calls.
// Layers: organ, drone, choir, clarinet, harmonium, strings, bells, voice,
// telegraph, tuba, ambient. A guest's seat (the band, the handbells, the
// fiddle…) is not a layer: see seatedSend and wideSend. SHELVED below is
// the mechanism for a layer kept but silenced; it is empty (the bagpipe,
// shelved by the owner on 2026-09-13, is kept in shelved/ with its lab).
//
// The rooms share one state object, KOLOB._s (S); see the note at the top of
// each file. The house is loaded in the order _engine.php gives (the one
// list), after the Jukebox v2 substrate it borrows: pj2-rand.js (the dice),
// pj2-clock.js (the clock) and pj2-fx.js (the rooms' crossfade), all
// read-only. README.md's folder table says what every file is.
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
  function organCycle(t) { return S.organCycle(t); }
  // from kolob-voices-choir.js
  function choirVoiceLine(t, notes, vi, gainMul) { return S.choirVoiceLine(t, notes, vi, gainMul); }
  function choirVerse(t) { return S.choirVerse(t); }
  // from kolob-voices-winds.js
  function renderClarinetLine(t, notes, gainMul, R) { return S.renderClarinetLine(t, notes, gainMul, R); }
  function clarinetPhrase(t) { return S.clarinetPhrase(t); }
  function renderHarmonium(t, notes, gainMul) { return S.renderHarmonium(t, notes, gainMul); }
  function harmoniumCycle(t) { return S.harmoniumCycle(t); }
  // from kolob-voices-ground.js
  function tubaBlat(t, gainMul) { return S.tubaBlat(t, gainMul); }
  function droneCycle(t) { return S.droneCycle(t); }
  function stringsPad(t, dur, gainMul, fifthOnly) { return S.stringsPad(t, dur, gainMul, fifthOnly); }
  function stringsCycle(t) { return S.stringsCycle(t); }
  function meetinghouseBell(t, gainMul, R) { return S.meetinghouseBell(t, gainMul, R); }
  function tineTap(t, f, amp) { return S.tineTap(t, f, amp); }
  function tineCycle(t) { return S.tineCycle(t); }
  // from kolob-voices-field.js
  function stillVoiceRender(t, dur) { return S.stillVoiceRender(t, dur); }
  function stillVoicePhrase(t) { return S.stillVoicePhrase(t); }
  function telegraphMessage(word) { return S.telegraphMessage(word); }
  function keyMorse(t, seq, side, peak) { return S.keyMorse(t, seq, side, peak); }
  function telegraphCycle(t) { return S.telegraphCycle(t); }
  function evFarBell(t, R) { return S.evFarBell(t, R); }
  function ambientEvent(t) { return S.ambientEvent(t); }
  // from kolob-meeting.js
  function planMeeting(t) { return S.planMeeting(t); }
  function localArc() { return S.localArc(); }
  function intensity() { return S.intensity(); }
  function inHush() { return S.inHush(); }
  function inFuging() { return S.inFuging(); }
  function inVisit() { return S.inVisit(); }
  function conductorTick(t) { return S.conductorTick(t); }
  function skipToSection(type) { return S.skipToSection(type); }
  function resetVisit() { return S.resetVisit(); }
  // (the other rooms' state is read and written through S as well — the
  // tuning's S.F0, S.mode, S.SCALE; S.Harmony and S.Meeting, the chord desk
  // and the chorister's book; the meeting's switches S.forceVisitation,
  // S.forceRaspberry, S.cumulativeMode, S.seasonPos, S.CUMULATIVE_ODDS; the
  // voices' tables S.VI_TO_CHORDPOS, S.CHOIR_PART, S.TELEGRAPH_WORDS,
  // S.FIELD_FNS; the ward's and the organist's S.theWard, S.wardStats,
  // S.wardStop, S.pipeOn, S.organStats, S.organStop; the old
  // tune's S.oldTunePool. tools/lends.js checks that every read has a lend.)

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
  // ROOMS — one space, staged in depth (PLAN-ONE-ROOM phases A/B).
  // Two rooms, and EVERY layer sings in both: the CLOSE room is the
  // meetinghouse itself (short; early reflections you can almost see), the
  // WIDE room is the tabernacle (long, breathing). A per-layer depth bias
  // seats each voice nearer or farther in the same building, and one
  // balance knob — set by the section, ramped — moves the whole gathering
  // deeper into the hall or closer to the ear. The equal-power crossfade is
  // Jukebox v2's PJ2.Fx.roomBlend, loaded by relative path (the ZANKYŌ
  // pattern: shared substrate, never modified from here). A layer
  // hard-assigned to ONE of two rooms — a parlor for the harmonium and the
  // wire, the tabernacle for the rest, the voice nearly dry — is exactly
  // what "separate recordings layered on each other" sounds like.
  var roomClose = null, roomWide = null, roomBlend = null;
  var roomBalance = 0.45;          // where the gathering sits now (0 = all close … 1 = all wide)
  var roomBalanceHeld = false;     // dev (room lab): the sections stop moving it
  var roomRampNext = 0.05;         // the first section of a meeting lands at once
  var sharedNoiseBuf = null;
  var NOISE_BUF_DURATION = 30;

  var playing = false;
  var masterVolume = 0.6;

  // ==========================================================================
  // THE DICE — seeded streams (PJ2.Rand; SCORE.md §3). The seed is the visit.
  // ==========================================================================
  // One die for the whole house would let a new envelope jitter in the
  // clarinet re-roll every hymn sung after it. So each purpose forks its own
  // stream off the visit's seed, by name, and a fork is born of its parent's
  // birth seed, so the order the forks are asked for never matters:
  //
  //   meeting:<n>          the meeting's plan — its sections, guests, sunrise
  //   <voice>:<n>          what a voice plays in meeting n (organ, drone, choir,
  //                        clarinet, harmonium, strings, bells, voice,
  //                        telegraph, field, fuging, stillness):
  //                        every TURN a voice takes is a fork of its own
  //                        (turn:<k>), so a turn that throws more dice or fewer
  //                        never shifts the next one
  //   <voice>:wait:<n>     how long a voice waits when the air is taken: a
  //                        refusal never shifts what the voice plays after it
  //   motif:<n>            the day's gestures and temper
  //   conductor:<n>, joints:<n>, guest:<type>:<n>
  //   synth:<voice>        SOUND-LEVEL detail only — detune, envelopes, onset
  //                        stagger, pan, vibrato and tremolo rates: how a note
  //                        sounds, never what is played. Musical dice never
  //                        come from these, and these never move the music
  //   audition             everything sample() throws, so touching a stop on
  //                        the rail never disturbs the meeting
  //
  // Musical means anything the note and event streams report, or a pitch that
  // sounds: which notes, when, how long, how high, which section, which guest.
  // Draw every die a decision might need, even one it may refuse (SCORE §3):
  // the plan and the conductor throw theirs unconditionally, and a voice's
  // turn fork makes the rest safe.
  var seed = (function () {
    try {
      if (typeof location !== "undefined" && location.search) {
        var m = location.search.match(/[?&]seed=(\d+)/);
        if (m) return (parseInt(m[1], 10) >>> 0) || 1847;
      }
    } catch (e) {}
    return (Date.now() % 0xffffffff) >>> 0;     // no seed asked for: the hour chooses the visit
  })();
  var root = null;                 // the visit's stream: every fork is born of it
  var dice = { n: -1, streams: {}, turns: {} };   // this meeting's streams, by label
  var synths = {};                 // synth:<voice>, one per voice for the whole visit
  var auditionStream = null;
  var auditioning = false;         // true for the length of one sample() call
  function visitRoot() {
    if (!root) {
      var Rand = window.PJ2 && window.PJ2.Rand;
      if (!Rand) throw new Error("Kolob: pj2-rand.js is not loaded — the house has no dice");
      root = Rand.stream(seed);
    }
    return root;
  }
  function audition() { return auditionStream || (auditionStream = visitRoot().fork("audition")); }
  // stream(label): this meeting's stream `label:<n>` (n = the meeting number).
  function stream(label) {
    if (auditioning) return audition();
    var n = S.Meeting ? S.Meeting.meetingNum() : 0;
    if (dice.n !== n) dice = { n: n, streams: {}, turns: {} };
    return dice.streams[label] || (dice.streams[label] = visitRoot().fork(label + ":" + n));
  }
  // turn(label): the next turn of a voice — a fresh fork of its stream.
  function turn(label) {
    if (auditioning) return audition();
    var s = stream(label);
    var k = dice.turns[label] || 0;
    dice.turns[label] = k + 1;
    return s.fork("turn:" + k);
  }
  // wait(label): the voice's waiting-room stream (how long a refusal waits).
  function wait(label) { return stream(label + ":wait"); }
  // hymnStream(n, i): the i-th hymn of meeting n (SCORE §3: hymn:<n>:<i> —
  // the composer writes on it, and the performance is a fork below it).
  // The day's hymnal hands the seed and the label to the composer's desk,
  // which may be another thread: the same fork is born there.
  function hymnStream(n, i) { return visitRoot().fork("hymn:" + n + ":" + i); }
  // castStream(n): the ward seated for meeting n (SCORE §3: cast:<n>; each
  // member's dice are member:<id> below it, the people's role:<role>). Pure
  // seating (kolob-cast.js); meeting 0 is the rail's audition.
  function castStream(n) { return visitRoot().fork("cast:" + n); }
  // synth(voice): sound-level detail for a voice, the whole visit long.
  function synth(voice) {
    if (auditioning) return audition();
    return synths[voice] || (synths[voice] = visitRoot().fork("synth:" + voice));
  }
  function reseedDice() { root = null; dice = { n: -1, streams: {}, turns: {} }; synths = {}; auditionStream = null; }

  // ==========================================================================
  // LAYERS + STATE
  // ==========================================================================
  // NOTE: "tuba" is RESERVED FOR THE RASPBERRY AMEN ONLY — see tubaBlat().
  var LAYERS = ["organ", "drone", "choir", "clarinet", "harmonium", "strings", "bells", "voice", "telegraph", "tuba", "ambient"];
  // SHELVED layers keep their code, their graph node and their defaults so a
  // change of heart is one line here — but they never sound: their cycle is
  // not scheduled, the desk does not list them (getLayers/getVolumes filter
  // them out), and applyLayerGain pins their gain at zero, so even an
  // audition or a stray Motif hand-off comes out silent.
  var SHELVED = {};   // (none today: the bagpipe, shelved by the owner on 2026-09-13, is in shelved/)
  // Depth bias per layer — added to the room balance before the equal-power
  // law (negative = nearer the ear). The still small voice stays close, but
  // in the room now; the wire is on the table; the deacon's parlor organ is
  // in the same building as the choir; the landscape and the field are at
  // the back, under the windows.
  var ROOM_DEPTH = { voice: -0.35, telegraph: -0.25, harmonium: -0.15, clarinet: -0.08, bells: 0, choir: 0.05, organ: 0.10, strings: 0.15, drone: 0.15, tuba: 0, ambient: 0.20,
                     // (a person of the ward come forward — the alto's verse, the
                     // precentor's line, the descant — is heard a step nearer than the ward)
                     "choir-near": -0.2,
                     // (the handbell choir stands at the front of the chapel, as near as
                     // the still small voice; the cornet of the ward's band plays the
                     // first hymn against the partner from the front pew)
                     handbells: -0.35, cornet: -0.12,
                     // (the Social Hall is in the room with us, a step nearer than the
                     // ward — the fiddle and the dancers' floor; the testimony-bearers
                     // speak where the still small voice is, and the reed that plays
                     // their words back sits where the harmonium does. Each is a guest's
                     // own seat at unity, not a house layer's slider; the depths were
                     // measured in the lab)
                     fiddle: -0.2, floor: -0.25, speaker: -0.35, reed: -0.15 };

  var layerGains = {};
  var choirNear = null;            // the ward's nearer way into the rooms, under the choir's slider
  // organ 0.52 → 0.40 (about 2.3 dB down): the owner found the organ "pretty
  // loud" in the v0.34 preview (2026-09-28)
  var layerVolumes = { organ: 0.40, drone: 0.55, choir: 0.8, clarinet: 0.38, harmonium: 0.45, strings: 0.5, bells: 0.5, voice: 0.35, telegraph: 0.25, tuba: 0.5, ambient: 0.5 };
  var layerMuted = {}; LAYERS.forEach(function (l) { layerMuted[l] = false; });

  // FIELD — the ambient layer is one bus, but each of its events (wind, crickets,
  // …) now rides its own gain so they can be balanced individually. The event's
  // gain × the ambient bus gives its level; defaults preserve the old sound.
  var FIELD_KEYS = ["wind", "crickets", "clock", "fork", "rain", "coyote", "bell", "beacon"];
  var fieldVolumes = { wind: 2, crickets: 1.52, clock: 1, fork: 1, rain: 2, coyote: 2, bell: 1.56, beacon: 1.38 };
  var fieldMuted = {};

  // THE PARAMS: each voice reads its own (getLayerParam) at these values.
  // The console has no parameter drawers (volume and mute only), and the
  // setters a lab once moved them with (setLayerParam, getLayerDefaults)
  // were retired on 2026-10-01 — nothing called them — so these are the
  // values, not defaults.
  var LAYER_PARAMS = {
    organ:     { stops: 0.5, tremulant: 0.15, pedal: 0.6 },
    drone:     { presence: 0.5, fifth: 0.4 },
    choir:     { size: 3, vowel: 0.4, scoop: 0.5 },
    clarinet:  { vibrato: 0.4, pace: 1.0, grace: 0.5 },
    harmonium: { bellows: 0.5, reed: 0.5, shadow: 0.5 },
    strings:   { warmth: 0.5, lonesome: 0.4 },
    bells:     { ring: 0.55, tine: 0.5 },
    voice:     { presence: 0.4, syllables: 0.4 },
    telegraph: { clack: 0.5 },
    ambient:   {},
  };
  // THE RATE: a layer's lane runs at its trim (rateOf), 1 where none is set.
  // The console exposes volume and mute only, and the per-layer rate a lab
  // once set (setLayerRate) was retired on 2026-10-01 — nothing called it.
  // telegraph 0.5: the wire should be an occasional visitor, not a speaker
  // — half the event density.
  var LAYER_RATE_TRIM = { telegraph: 0.5, bells: 0.7 };
  // THE VOLUME TRIMS ride on top of the sliders (the slider reads
  // layerVolumes; a trim seats the layer without moving the slider's
  // position). voice 9.0: the still small voice sat too low in the mix and
  // was lifted by owner request — but the trim was never the reason the
  // voice stayed faint (see the source peak in stillVoiceRender); this rides
  // on top of that source lift. clarinet 0.72: it sat too loud in the mix.
  // bells 0.8: pulled down 20% by owner request. telegraph 1.5: the wire
  // lifted 50% so its taps carry.
  var LAYER_VOL_TRIM = { choir: 1.1, voice: 9.0, clarinet: 0.72, bells: 0.8, telegraph: 1.5 };

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
  // THE BUS (SCORE.md §6). Every event the page or the harness reads is
  // TYPED — { type, t, …payload }, its words in KOLOB.Score.EVENTS — and the
  // page reads the type and the payload, nothing else. (The log words
  // { cat, label, detail } that rode on every event beside its type were
  // retired on 2026-10-01; tools/lib/dump.js still reads them out of dumps
  // of builds older than 2026-09-27.) A guest the minutes must not name (the
  // Hosanna) says logged: false on every event it sends, and on every note
  // the page may not show (a visitor's notes name it: guest, logged).
  var noteListeners = [], eventListeners = [];
  function emitNote(layer, freq, startTime, duration, extra) {
    if (HOUSE[layer] && !auditioning && duration > 0) heldByHouse(layer, freq, startTime, duration);
    for (var i = 0; i < noteListeners.length; i++) {
      var n = { layer: layer, freq: freq, startTime: startTime, duration: duration || 0 };
      if (extra) { for (var ek in extra) n[ek] = extra[ek]; }   // e.g. telegraph { marks:[…] }
      try { noteListeners[i](n); } catch (e) {}
    }
  }
  function emitEvent(ev) {
    ev.t = ctx ? now() : 0;                                  // the moment it happens in the music
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
    // unseeded on purpose, like the pour below: the tape of hiss is texture,
    // not music (the zankyo rule); where a sound starts on it is synth:noise
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
    // THE WARD'S NEAR WAY: a person come forward sings into the
    // rooms a step nearer than the ward (ROOM_DEPTH["choir-near"]), under the
    // choir's own slider (applyLayerGain keeps the two together)
    choirNear = ctx.createGain();
    seatLayer("choir-near", choirNear);
    applyLayerGain("choir");
    makeClock();
    // the composer's desk is opened now — at the button press, not in a
    // cue — so its rooms are loaded long before the first hymn is ordered
    // (kolob-hymnal.js: a worker where the page has one)
    if (KOLOB.Hymnal && KOLOB.Hymnal.warm) {
      try { KOLOB.Hymnal.warm(); } catch (e) { if (window.console) console.warn("Kolob: the composer's desk could not be opened:", e); }
    }
    // the town's air, for the trombones at dawn, is poured now — once, at the
    // button press — not inside the clock's callback that first needs it
    // (KOLOB.VoicesBand.warm: an outdoor tail of 2.6 s, tens of ms to build)
    if (KOLOB.VoicesBand && KOLOB.VoicesBand.warm) {
      try { KOLOB.VoicesBand.warm(ctx); } catch (e) { if (window.console) console.warn("Kolob: the town's air could not be built:", e); }
    }
    // and the guests' own, all at the press, never in a cue:
    // the handcart company's throat, sung once and silently (a voice's first
    // line bakes its breath and compiles it — 5–7 ms — which must not land in
    // the clock's wake of a company passing in the prelude), with the folk
    // voices' noise; change ringing's true touches searched (15 ms, once);
    // the far ward's valley poured (as the town's air is)
    [["GuestHandcart", "the company's throat could not be warmed"], ["GuestChanges", "the ringers' touches could not be found"],
     ["GuestFarWard", "the far ward's valley could not be poured"]].forEach(function (w) {
      var G = KOLOB[w[0]];
      if (G && G.warm) { try { G.warm(ctx); } catch (e) { if (window.console) console.warn("Kolob: " + w[1] + ":", e); } }
    });
  }
  // Every layer sings in both rooms; its depth bias seats it.
  function seatLayer(name, src) {
    if (roomBlend) roomBlend.register(name, src, ROOM_DEPTH[name] || 0);
    else if (roomWide) src.connect(roomWide.send);
    else src.connect(voicesBus);
  }
  // THE STANDING GUESTS' WAY INTO THE ROOM: a guest who stands IN the chapel
  // — the handbell choir, the cornet of the ward's band, the Social Hall's
  // fiddle and floor, the testimony's speaker and reed — is seated as a
  // layer is, into both rooms
  // at a depth of its own (ROOM_DEPTH), a step nearer than the ward, and not
  // through the tabernacle's wide send the visitors from outside take; the
  // singing school, the ward's own choir practising, goes into the choir's
  // own layer (its slider, its seat). One seat for each (the room blend has
  // no unregister), and the meeting's own door in front of it, so STOP
  // closes it as it closes the wide send.
  var guestSeats = {};
  function seatedSend(layer) {
    var d = liveDoors();
    if (d.seats[layer]) return d.seats[layer];
    var into = layerGains[layer];
    if (!into) {
      if (!guestSeats[layer]) { guestSeats[layer] = ctx.createGain(); guestSeats[layer].gain.setValueAtTime(1, ctx.currentTime); seatLayer(layer, guestSeats[layer]); }
      into = guestSeats[layer];
    }
    var g = ctx.createGain();
    g.gain.setValueAtTime(1, ctx.currentTime);
    g.connect(into);
    return (d.seats[layer] = g);
  }
  // the tabernacle's send for the guests outside the windows — through the
  // meeting's doors, like every other voice
  function wideSend() {
    var d = liveDoors();
    if (!d.wide) {
      d.wide = ctx.createGain();
      d.wide.gain.setValueAtTime(1, ctx.currentTime);
      d.wide.connect(roomWide ? roomWide.send : voicesBus);
    }
    return d.wide;
  }

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
  // FLUSH THE HALL — a new meeting called after a STOP begins in a silent
  // hall: each room's wet chain (pre-delay → convolver → wet) is replaced by
  // a fresh one on the same impulse, so the stopped meeting's reverberation,
  // still decaying inside the convolvers, never comes back through the
  // reopened bus. (The doors keep its notes out; this keeps its echo out.)
  function flushRooms() {
    [roomClose, roomWide].forEach(function (r) {
      if (!r || !r.chain) return;
      var old = r.chain;
      r.chain = wetChain(r, old.conv.buffer, 0);
      try { r.send.disconnect(old.pre); old.pre.disconnect(); old.conv.disconnect(); old.wet.disconnect(); } catch (e) {}
    });
  }

  // The pour: decaying noise under eight discrete EARLY TAPS. The taps are
  // the seating — the first 8–60 ms after a note is where the ear decides an
  // instrument stands IN a room rather than wearing reverb on a send; a bare
  // noise tail has no such moment, and reads as a wash behind close-miked
  // tracks. The diffuse tail rises over 60 ms beneath the
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
  // THE CLOCK — PJ2.Clock, the lookahead transport (SCORE.md §4).
  // ==========================================================================
  // Every cue the meeting schedules is an event on the AUDIO clock, on a lane
  // named for its layer (the conductor and the guests have lanes of their
  // own). The clock wakes every 25 ms and fires whatever falls due in the
  // next quarter second, each cue receiving the time it was SCHEDULED for:
  // `t`, the music's own now. A cue places its notes at t and measures every
  // decision against t (S.now() reads it for the helpers deep in the house —
  // the arc, the hush, the air), so a timer that wakes late, or a tab that
  // was hidden, changes nothing that is played. The same seed gives the same
  // meeting, note for note. Outside a cue — a press of a button — now() is
  // simply the audio clock.
  //
  // HOLD: pause() fades the master and suspends the AudioContext, and the
  // clock stands still with it (nothing falls due while the audio clock is
  // frozen); resume() lets it run on from where it stood. STOP cancels every
  // pending cue (clock.stop()), and closes the meeting's doors (below). A
  // layer's turn that throws is reported and its cycle armed again (THE NET
  // UNDER EVERY TURN, below).
  var clock = null;
  var pump = null;                 // the clock's own wake-up (kept, to pump it once at a resume)
  var musicNow = null;             // the scheduled time of the cue now firing
  var paused = false;
  var LEAD_S = 0.1;                // the downbeat sits this far after PLAY
  function now() { return musicNow != null ? musicNow : (ctx ? ctx.currentTime : 0); }
  function makeClock() {
    if (clock) return clock;
    if (!(window.PJ2 && window.PJ2.Clock)) throw new Error("Kolob: pj2-clock.js is not loaded — the house has no clock");
    clock = window.PJ2.Clock.create(ctx, {
      // the ordinary interval, but the clock's wake-up is kept, so a resume
      // can fill the window at once instead of waiting on a timer a hidden
      // tab may have slowed
      setInterval: function (fn, ms) { pump = fn; return setInterval(fn, ms); },
      clearInterval: function (id) { clearInterval(id); },
      onError: function (err, info) { cueThrew(err, info && info.lane, info && info.t); },
    });
    LAYERS.forEach(function (l) { clock.lane(l).rate = rateOf(l); });
    return clock;
  }
  // cueAt: call fn(t) at scheduled time t, on the named lane.
  // (the clock's health, for the silent checks: how many cues fired after
  // their own time — a callback that runs late places its notes in the past —
  // and how late the latest was, on the audio clock)
  var clockHealth = { cues: 0, late: 0, maxLate: 0 };
  function cueAt(lane, t, fn) {
    if (!clock) return null;
    var id = clock.lane(lane).at(t, function (tt) {
      var was = musicNow;
      musicNow = tt;
      clockHealth.cues++;
      if (ctx && ctx.currentTime > tt + 0.003) { clockHealth.late++; if (ctx.currentTime - tt > clockHealth.maxLate) clockHealth.maxLate = ctx.currentTime - tt; }
      try { fn(tt); } finally { musicNow = was; }
    });
    // (the net's question, below — has the turn now running re-armed its
    // own cycle? — answered only once the clock has taken the cue)
    if (turning && turning.self === fn && turning.lane === lane) turning.armed = true;
    return id;
  }
  // cueIn: dtS seconds after the music's now, at the clock's own speed —
  // a retry, a timed announcement, the next section.
  function cueIn(lane, dtS, fn) { return cueAt(lane, now() + dtS, fn); }
  // cueLayer: a layer's own pace — baseS scaled by its lane's rate (its
  // trim, rateOf).
  function cueLayer(layer, baseS, fn) { return cueAt(layer, now() + baseS / rateOf(layer), fn); }
  // a cue that threw, reported: by the clock (onError, above), or by the net
  function cueThrew(err, lane, t, more) {
    if (typeof console !== "undefined" && console.error) console.error("Kolob: a cue on '" + lane + "' threw at t=" + t + (more || ""), err);
  }

  // THE NET UNDER EVERY TURN. Each layer's turn — the drone's, the
  // strings', the tines', the organist's, the deacon's, the harmonium's, the
  // choir's verse, the still voice's, the wire's, the valley's — the
  // conductor's tick, and the two pumps (the ward's desk, the organist's)
  // re-arm their own lane as the last thing they do: the next turn is the
  // last thing a turn writes. The clock catches a cue that throws, reports
  // it and arms nothing, so a turn that threw before it had re-armed was the
  // end of its layer for the rest of the visit, a tick that threw was the end
  // of the meeting's sections, and a pump that threw at its re-arm left its
  // flag up with no tick behind it, so nothing woke it again. So the cue the
  // clock runs for a layer is its room's cycle — droneCycle, organCycle, …,
  // conductorTick, wardTick, organistTick — and the cycle is one line,
  // cycle(lane, self, turn, t, fallbackS): its turn runs, and if the turn
  // throws before it has re-armed its own cycle (self, on its lane), the
  // throw is reported and the cycle is armed again fallbackS later —
  // CYCLE_FALLBACK_S, unless the cycle names its own (the tick and the pumps
  // keep their own pace) — where it takes up its turns. Whether it re-armed
  // is asked of cueAt after the clock has taken the cue, so a re-arm the
  // clock refused is not mistaken for one. On a throw, cycle() says whether
  // the cycle now stands armed (the turn's re-arm or its own), so a pump
  // sets its flag by that word, once; otherwise it says nothing. A turn that
  // returns without re-arming (it found the meeting stopped) is left alone,
  // and where nothing throws the net does nothing at all: no die, no cue,
  // no flag and no cue's order is moved. (A composed hymn is a chain of
  // cues, not a cycle: a link of it that throws lets the hymn go —
  // kolob-voices-choir.js, A LINK THAT THROWS.)
  var CYCLE_FALLBACK_S = 5;        // a turn that threw is tried again this long after: soon enough that the layer comes back, slow enough that a fault that repeats is told a few times a minute, not at every turn
  var turning = null;              // the turn running under the net: { lane, self, armed }
  function cycle(lane, self, turn, t, fallbackS) {
    var was = turning, me = turning = { lane: lane, self: self, armed: false };
    try { turn(t); }
    catch (err) {
      var again = !me.armed && playing, dt = fallbackS || CYCLE_FALLBACK_S;
      cueThrew(err, lane, t, again ? " (its cycle is armed again " + dt + " s later)" : "");
      if (again) cueIn(lane, dt, self);
      return me.armed || again;
    } finally { turning = was; }
  }

  // THE DOORS — each meeting enters the hall through doors of its own: the
  // panners, field gains and the tabernacle send its voices connect to. The
  // choir writes its lines up to half a minute ahead and the drone holds for
  // a minute and a half, all of it already in the audio graph, so STOP closes
  // the meeting's doors (disconnects them once the fade is done) and PLAY
  // opens new ones. Without them the old meeting's lines came back through
  // the bus when PLAY reopened it within ~30 s of a STOP.
  var doors = null;
  var closing = [];                // doors shut at STOP, disconnected after the fade
  var hallRinging = false;         // a meeting was stopped: its echo is still in the rooms
  function openDoors() { return { pans: {}, field: {}, wide: null, hands: {}, spent: [], ward: null, seats: {} }; }
  function liveDoors() { return doors || (doors = openDoors()); }
  function shutDoors(d) {
    var k, i;
    try {
      for (k in d.pans) for (i = 0; i < d.pans[k].length; i++) d.pans[k][i].disconnect();
      for (k in d.hands) d.hands[k].disconnect();
      for (i = 0; i < d.spent.length; i++) d.spent[i].disconnect();
      for (k in d.field) d.field[k].disconnect();
      if (d.wide) d.wide.disconnect();
      for (k in d.seats) d.seats[k].disconnect();
      if (d.ward) { d.ward.hall.disconnect(); d.ward.near.disconnect(); }
    } catch (e) {}
  }
  function shutClosingDoors() { while (closing.length) shutDoors(closing.pop()); }

  // ==========================================================================
  // THE HOUSE LETS GO (PLAN-COMPOSITION §15, a guest rule of the Score).
  // When a guest enters — the trombones at dawn, the old tune, the bands,
  // the steeples — the house's held notes (the organ's chord, the strings'
  // pad, the harmonium's and the clarinet's lines, all of them written
  // seconds ahead) let go over HOUSE_RELEASE_S instead of ringing on under
  // the visitor or being cut. Listening only by starting no new turns is not
  // enough: measured so, in 17 of 24 forced dawns an organ chord was still
  // sounding 1.6–8.1 s into the far choir's entry, and in three it beat
  // against it a comma apart.
  //
  // How: each house layer enters the hall through HANDS of its own (a gain
  // in the meeting's doors, between the layer's panners and its volume
  // slider). At the guest's entrance the hands let go — a 1.5 s ramp to
  // nothing — and that door is spent: everything already written through
  // it (the rest of a line, a chord that had not yet begun) goes with it,
  // and the reverb keeps the tail it was given. The layer's next note comes
  // in by new hands, and no house turn begins inside the release. The
  // notes the house had reported are the written ones (SCORE §9.2); the
  // typed event house-lets-go names each one released and when it was
  // gone, so a reader of the dump hears what the hall heard.
  // ==========================================================================
  var HOUSE = { organ: true, strings: true, harmonium: true, clarinet: true };
  var HOUSE_RELEASE_S = 1.5;
  var houseNotes = {};             // layer → its reported notes still to end [{s, e, f}]
  var houseRest = {};              // layer → no turn of it begins before this (the release)
  function heldByHouse(layer, f, s, dur) {
    var a = houseNotes[layer] || (houseNotes[layer] = []);
    a.push({ s: s, e: s + dur, f: f });
    // (forget what has already ended by the music's now — never by the new
    // note's start: a voice writes a line ahead, and its later notes arrive
    // together with its sooner ones)
    if (a.length > 48) { var tn = now(); houseNotes[layer] = a.filter(function (n) { return n.e > tn - 1; }); }
  }
  function handsFor(d, layer) {
    var h = d.hands[layer];
    if (!h) {
      h = d.hands[layer] = ctx.createGain();
      h.gain.value = 1;
      h.connect(layerGains[layer]);
    }
    return h;
  }
  // at te (the guest's entrance, the cue's scheduled time): who lets go
  // (logged: false for a guest the minutes may not name — the event says so,
  // as every event of that guest's does)
  // (only: a rite whose seating sits some of the house out lets those alone
  // go as it begins: a clarinet phrase the deacon
  // wrote during the joint does not ring half a minute into THE CHOIR ALONE)
  function houseLetsGo(te, guest, logged, only) {
    if (!ctx || !doors) return null;
    var d = doors, layers = [], released = [], until = te + HOUSE_RELEASE_S;
    Object.keys(HOUSE).forEach(function (L) {
      if (only && !only[L]) return;
      // the house takes its hands off as the visitor comes in, whether or not
      // they were playing: no turn of it begins inside the release
      houseRest[L] = Math.max(houseRest[L] || 0, until);
      var h = d.hands[L];
      var ns = (houseNotes[L] || []).filter(function (n) { return n.e > te + 0.02; });
      if (!h || !ns.length) return;                // nothing of this layer is still to sound
      h.gain.setValueAtTime(1, te);
      h.gain.linearRampToValueAtTime(0, until);
      d.spent.push(h);
      if (d.pans[L]) { d.spent.push.apply(d.spent, d.pans[L]); delete d.pans[L]; }
      delete d.hands[L];
      var written = te;
      ns.forEach(function (n) {
        var heard = Math.max(n.s, Math.min(n.e, until));
        released.push({ layer: L, freq: n.f, startTime: n.s, duration: n.e - n.s, until: heard });
        written = Math.max(written, n.e);
        n.e = heard;
      });
      // the spent hands leave the hall once the last note written through
      // them has stopped (its oscillators stop up to half a second after
      // their written end): a long session does not keep a pile of silent
      // doors open (the panners stay wired to the hands, so what went
      // through them can still be traced)
      cueAt("conductor", written + 1, function () {
        try { h.disconnect(); } catch (e) {}
        var at = d.spent.indexOf(h); if (at >= 0) d.spent.splice(at, 1);
      });
      layers.push(L);
    });
    if (!layers.length) return null;
    emitEvent({
      type: "house-lets-go", guest: guest, at: te, until: until, layers: layers, released: released, logged: logged !== false,
    });
    return until;
  }
  // a house voice asks before it begins a turn: is my release still going?
  // (or does the rite's seating sit me out — the brush arbor's organ, the
  // lined-out rite's strings, the choir alone's deacon)
  function houseRests(layer) { return !!ctx && (now() < (houseRest[layer] || 0) || !!(S.Meeting && S.Meeting.sits && S.Meeting.sits(layer))); }

  function panAt(layer, p) {
    var d = liveDoors();
    var pool = d.pans[layer];
    if (!pool) {
      // Some width for the open air, but pulled in from the old hard ±0.65
      // slots: voices panned to the far edges read as separate tracks. Closer
      // in, they share the centre and blend into one ensemble. (A house
      // layer's panners go through its hands: THE HOUSE LETS GO, above.)
      var into = HOUSE[layer] ? handsFor(d, layer) : layerGains[layer];
      pool = d.pans[layer] = [-0.42, 0, 0.42].map(function (pp) {
        var sp = ctx.createStereoPanner(); sp.pan.setValueAtTime(pp, ctx.currentTime); sp.connect(into); return sp;
      });
    }
    var cl = p < -1 ? -1 : (p > 1 ? 1 : p);
    return pool[cl < -0.2 ? 0 : cl > 0.2 ? 2 : 1];
  }
  // THE WARD'S WAYS INTO THE ROOM: the thirty-two pour into the
  // choir's own layer (its slider, its seat in the rooms); a person come
  // forward, into the nearer way beside it. Both belong to the meeting's
  // doors: a STOP closes them on everything the ward had written ahead.
  // WARD_LEVEL sets the ward in the house's mix (each singer's line is the
  // cast's 1/√8 a part): measured against the house voices it replaces
  var WARD_LEVEL = 0.16;
  function wardBuses() {
    var d = liveDoors();
    if (!d.ward) {
      var hall = ctx.createGain(), near = ctx.createGain();
      hall.gain.setValueAtTime(WARD_LEVEL, ctx.currentTime); near.gain.setValueAtTime(WARD_LEVEL, ctx.currentTime);
      hall.connect(layerGains.choir); near.connect(choirNear || layerGains.choir);
      d.ward = { hall: hall, near: near };
    }
    return d.ward;
  }
  // the lane's rate: the layer's trim (LAYER_RATE_TRIM), 1 where none is set
  function rateOf(layer) { return LAYER_RATE_TRIM[layer] != null ? LAYER_RATE_TRIM[layer] : 1; }
  function getLayerParam(layer, key, fallback) {
    if (LAYER_PARAMS[layer] && LAYER_PARAMS[layer][key] != null) return LAYER_PARAMS[layer][key];
    return fallback;
  }
  function applyLayerGain(layer) {
    var node = layerGains[layer];
    if (!node) return;
    var trim = LAYER_VOL_TRIM[layer] != null ? LAYER_VOL_TRIM[layer] : 1;
    var v = (layerMuted[layer] || SHELVED[layer]) ? 0 : layerVolumes[layer] * trim;
    node.gain.setValueAtTime(v, ctx.currentTime);
    if (layer === "choir" && choirNear) choirNear.gain.setValueAtTime(v, ctx.currentTime);
  }
  function applyFieldGain(key) {
    var fg = doors && doors.field[key];
    if (fg && ctx) fg.gain.setValueAtTime(fieldMuted[key] ? 0 : fieldVolumes[key], ctx.currentTime);
  }
  // a per-event destination on the FIELD bus: <event gain> -> ambient layer gain,
  // so every field sound keeps the ambient routing (reverb) but its own level.
  // The event gains belong to the meeting's doors.
  function fieldDest(key, pan) {
    var d = liveDoors();
    var fg = d.field[key];
    if (!fg) {
      fg = ctx.createGain();
      fg.connect(layerGains.ambient);
      d.field[key] = fg;
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
  function noiseOffset() { return synth("noise").rnd(0, 20); }   // where in the noise tape a hiss begins: sound-level
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
  // (a composed hymn holds the air alone: the ward is the whole speech; two
  // voices share it in a singing section otherwise)
  function airLimit() {
    var s = S.Meeting.section();
    if (S.Meeting.hymnSounding && S.Meeting.hymnSounding()) return 1;
    return s === "hymn" || s === "doxology" ? 2 : 1;
  }
  function airFree() {
    if (!ctx) return true;
    if (now() >= air.busyUntil) { air.holders = 0; return true; }
    return air.holders < airLimit();
  }
  // (every caller names its margin, drawn from its own stream)
  function claimAir(durS, marginS) {
    if (!ctx) return;
    var t = now();
    var until = t + durS + (marginS != null ? marginS : 5.5);
    if (t >= air.busyUntil) air.holders = 1;
    else air.holders++;
    air.busyUntil = Math.max(air.busyUntil, until);
  }

  // ==========================================================================
  // SAMPLE — one short isolated gesture per layer, playable while stopped
  // (touch an instrument on the stop rail, hear it alone). Every die an
  // audition throws comes from the audition stream, and the organ's chord is
  // voiced without being written into the meeting's harmony, so touching a
  // stop never disturbs the meeting that is playing.
  // ==========================================================================
  function sample(layer) {
    init();
    auditioning = true;
    try { audit(layer); } finally { auditioning = false; }
  }
  function audit(layer) {
    if (!S.SCALE.length) rebuildScale();
    if (ctx.state !== "running") { try { ctx.resume(); } catch (e) {} }
    if (bg) bg.poke();               // audition while stopped: the <audio> route must be live
    var A = audition();
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
      if (ffn) { liveDoors(); applyFieldGain(layer.slice(6)); ffn(t, A); }
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
        // voiced from the chord standing now, and written nowhere
        var ch = S.Harmony.voice(0, { open: false }, A, t);
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
        var ch2 = S.Harmony.voice(0, { open: false }, A, t);
        [0, 1, 3].forEach(function (vi, k) {
          choirVoiceLine(t + k * 0.12, [{ f: ch2.freqs[S.VI_TO_CHORDPOS[vi]], dur: 4.5 }], vi, 0.85);
          emitNote("choir", ch2.freqs[S.VI_TO_CHORDPOS[vi]], t, 4.5, { part: S.CHOIR_PART[vi] });   // every voice that sounds
        });
        break;
      }
      case "clarinet": {
        var notes = [[-3, 1], [0, 2], [1, 1], [0, 2.6]].map(function (n) {
          return { f: degFreq(projDeg(n[0]) + colN()), dur: n[1] };
        });
        renderClarinetLine(t, notes, 1, A);
        break;
      }
      case "harmonium": {
        renderHarmonium(t, [{ f: degFreq(projDeg(2)), dur: 5 }], 0.8);
        emitNote("harmonium", degFreq(projDeg(2)), t, 5);
        break;
      }
      case "strings": stringsPad(t, 9, 0.9, false); break;
      case "bells":
        meetinghouseBell(t, 0.8, A);
        tineTap(t + 2.2, degFreq(projDeg(4) + colN()) * 2, 0.3);
        break;
      case "voice": stillVoiceRender(t, 4.5); break;
      case "telegraph": {
        // a visitation flashes a word home, keyed like the wire
        var telWord = A.pick(S.TELEGRAPH_WORDS);
        var telSeq = telegraphMessage(telWord);
        var telEnd = keyMorse(t, telSeq, 0.6, 0.055);
        emitNote("telegraph", 0, t, telEnd - t, { marks: telSeq });
        break;
      }
      case "ambient": evFarBell(t, A); break;
      default: return;
    }
    emitEvent({ type: "transport", action: "sample", layer: layer });
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
    shutClosingDoors();              // the last meeting's written-ahead lines stay outside
    if (hallRinging) { flushRooms(); hallRinging = false; }   // and its echo with them
    liveDoors();
    houseNotes = {}; houseRest = {};               // the stopped meeting's held notes stay outside with it
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
    // THE DOWNBEAT — the first cue of the meeting, LEAD_S after the press;
    // every time in the meeting is counted from it
    cueAt("conductor", ctx.currentTime + LEAD_S, function (t0) {
      planMeeting(t0);
      // staggered assembly — the valley wakes the way a Sunday begins, and
      // each Sunday in its own order: the prelude's seating (kolob-meeting.js,
      // THE PRELUDE'S SEATING) drew every entrance (one timetable for every
      // visit — the drone at 0.1 s, the organ at 2.7, the field at 16, the
      // strings at 24 — made every first minute the same; the fallback below
      // is that timetable, for a plan without a seating). The voice and the
      // choir only listen for their sections, each from a drawn first call;
      // on a humming Sunday the choir is the first awake.
      var W = S.Meeting.waking() || { drone: 0, organ: 2.5, ambient: 16, strings: 24, harmonium: 30, clarinet: 34, bells: 42, telegraph: 55, choir: 20, voice: 12 };
      cueAt("drone", t0 + W.drone, droneCycle);
      cueAt("organ", t0 + W.organ, organCycle);
      cueAt("voice", t0 + (W.voice != null ? W.voice : 12), stillVoicePhrase);
      cueAt("ambient", t0 + W.ambient, ambientEvent);
      cueAt("choir", t0 + (W.choir != null ? W.choir : 20), choirVerse);
      cueAt("strings", t0 + W.strings, stringsCycle);
      cueAt("harmonium", t0 + W.harmonium, harmoniumCycle);
      cueAt("clarinet", t0 + W.clarinet, clarinetPhrase);
      cueAt("bells", t0 + W.bells, tineCycle);
      cueAt("telegraph", t0 + W.telegraph, telegraphCycle);
      cueAt("conductor", t0 + 1, conductorTick);
    });
    clock.start();                   // the downbeat falls inside the first window: it fires now
    emitEvent({ type: "transport", action: "play", seed: seed });
  }
  // HOLD the meeting where it stands — see the clock's notes above. The
  // page's transport and the lock-screen pause both come here; PLAY, the
  // pause button again, or the lock-screen play resume it.
  //
  // The audio clock is not stopped outright: a suspend mid-wave is a click,
  // and a suspend under the lock-screen route (a live stream feeding an
  // <audio> element) is a stutter while the element pulls on a stalled
  // stream. So the master fades to nothing over a short breath first; then
  // the element rests, then the clock stops — and every cue stops with it,
  // because every cue waits on that clock. Resume runs the same in reverse.
  var PAUSE_FADE = 0.16;                           // seconds
  var pauseTimer = null;
  function pause() {
    if (!playing || paused) return;
    paused = true;
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
      if (pump) pump();                            // the clock looks ahead at once
    };
    if (ctx.state !== "running") {
      var p = null;
      try { p = ctx.resume(); } catch (e) {}
      if (p && p.then) p.then(go, go); else go();
    } else go();
  }
  function stop() {
    playing = false;
    if (clock) clock.stop();         // every pending cue is cancelled: nothing of this meeting is called again
    if (S.wardStop) S.wardStop();    // and nothing more of the ward's is handed to the voices, or joined
    if (S.organStop && ctx) S.organStop(ctx.currentTime + 0.7);   // nor of the organist's; the organ's case is shut after the fade
    if (doors) { closing.push(doors); doors = null; }
    hallRinging = true;
    if (bg) bg.stopped();
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
    emitEvent({ type: "transport", action: "stop" });
  }
  function scheduleForStop() {
    setTimeout(function () {
      // the fade is done: the stopped meeting's doors are disconnected (a PLAY
      // inside these 800 ms has already shut them)
      shutClosingDoors();
      if (!playing && ctx) {
        // belt and braces: zero the layer gains too, so a later sample() of
        // one stop cannot resurrect another layer's lingering cycle
        LAYERS.forEach(function (l) {
          if (layerGains[l]) layerGains[l].gain.setValueAtTime(0, ctx.currentTime);
        });
        if (choirNear) choirNear.gain.setValueAtTime(0, ctx.currentTime);
      }
    }, 800);
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  // (accessor lends are configurable, so a room can be loaded again — a lab,
  // a hot reload — without "Cannot redefine")
  Object.defineProperty(S, "ctx", { enumerable: true, configurable: true, get: function () { return ctx; }, set: function (v) { ctx = v; } });
  Object.defineProperty(S, "droneDuck", { enumerable: true, configurable: true, get: function () { return droneDuck; }, set: function (v) { droneDuck = v; } });
  Object.defineProperty(S, "roomBalanceHeld", { enumerable: true, configurable: true, get: function () { return roomBalanceHeld; }, set: function (v) { roomBalanceHeld = v; } });
  Object.defineProperty(S, "roomRampNext", { enumerable: true, configurable: true, get: function () { return roomRampNext; }, set: function (v) { roomRampNext = v; } });
  Object.defineProperty(S, "playing", { enumerable: true, configurable: true, get: function () { return playing; }, set: function (v) { playing = v; } });
  // the dice and the clock
  S.stream = stream;
  S.turn = turn;
  S.wait = wait;
  S.synth = synth;
  S.now = now;
  S.cueAt = cueAt;
  S.cueIn = cueIn;
  S.cueLayer = cueLayer;
  S.cycle = cycle;
  S.hymnStream = hymnStream;
  S.seatedSend = seatedSend;
  S.formStream = function (label) { return visitRoot().fork(label); };
  S.castStream = castStream;
  S.wardBuses = wardBuses;
  S.visitSeed = function () { return seed; };
  // is the music's now a cue's? (the hymnal counts a hymn written inside one)
  S.inCue = function () { return musicNow != null; };
  S.SHELVED = SHELVED;
  S.ROOM_BALANCE = ROOM_BALANCE;
  S.ROOM_RAMP_S = ROOM_RAMP_S;
  S.emitNote = emitNote;
  S.emitEvent = emitEvent;
  S.wideSend = wideSend;
  S.setRoomBalance = setRoomBalance;
  S.panAt = panAt;
  S.houseLetsGo = houseLetsGo;
  S.houseRests = houseRests;
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
    // THE BAND'S OWN VOLUME (the caterpillar on the console): the listener's
    // hand on the Nauvoo band alone, both bands and their drums, 0 … 1.5
    // (linear; 1 is the band as the meeting seats it), gliding over 50 ms.
    // It multiplies whatever the band is given (the instruments panel has
    // no band slider) and changes nothing of the meeting but loudness: the
    // band keeps its time, its notes still print, the minutes still name it.
    // getBandHeardUntil() is when the last note or drum of the band now in
    // the street stops sounding, on the audio clock (0 if none).
    setBandVolume: function (v) { var VB = KOLOB.VoicesBand; return VB && VB.setHand ? VB.setHand(v) : 1; },
    getBandVolume: function () { var VB = KOLOB.VoicesBand; return VB && VB.hand ? VB.hand() : 1; },
    getBandHeardUntil: function () { var VB = KOLOB.VoicesBand; return ctx && VB && VB.heardUntil ? VB.heardUntil(ctx) : 0; },
    setLayerVolume: function (layer, v) { layerVolumes[layer] = v; if (ctx) applyLayerGain(layer); },
    toggleLayer: function (layer) { layerMuted[layer] = !layerMuted[layer]; if (ctx) applyLayerGain(layer); return !layerMuted[layer]; },
    getLayerParam: getLayerParam,
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
    // a new seed is a new visit: fresh dice, and (while stopped) the meeting
    // count starts again, so ?seed=X and GATHER X call the same first meeting
    reseed: function (s) { seed = (s >>> 0) || 1847; reseedDice(); if (!playing) resetVisit(); },
    getConductor: function () {
      var M = S.Meeting, plan = M.plan();
      return {
        meeting: M.meetingNum(), activity: M.activity(),
        // (the calendar's Sunday, for the programme card; the rite's light
        // and its seating)
        sunday: M.day ? M.day() : null, light: M.light ? M.light() : null, scene: M.scene && M.scene() ? M.scene().name : null,
        section: M.section(), meter: M.meter(), mode: S.mode,
        local: localArc(), intensity: intensity(),
        hush: inHush(), fuging: inFuging(),
        // (the page's clock: this is what is sounding now, read off the audio clock)
        // (a guest the minutes may not name — logged: false, the Hosanna —
        // is not told to the page at all)
        visit: (ctx && ctx.currentTime < M.assemblyUntil()) ? "assembly" : (inVisit() && M.visitLogged() ? M.visitType() : null),
        twoBands: M.visitSecond ? M.visitSecond() : false,
        f0: S.F0, season: S.seasonPos,
        sectionIndex: M.sectionIndex(), planLength: plan.length,
        plan: plan,                                            // the wheel folds hymns onto one seat
        fifths: S.Harmony.fifthCount(),
      };
    },
    // the chord standing now (the chord book's, on the audio clock)
    getHarmony: function () { return S.Harmony.at(ctx ? ctx.currentTime : 0); },
    getAudioTime: function () { return ctx ? ctx.currentTime : 0; },
    skipToSection: skipToSection,
    getMotifStats: function () { return KOLOB.Melody.Motif.stats(); },
    // the day's hymnal: the house dialect and the day's hymns, the
    // hymn being sung, and the composer's desk's account of itself (how many
    // were written, where, how long they took; late ones written in a cue)
    getHymnal: function () { return { house: S.Meeting.house(), hymns: S.Meeting.hymnal(), singing: S.Meeting.hymn() }; },
    getHymn: function (id) { return KOLOB.Hymnal ? KOLOB.Hymnal.hymnOf(id) : null; },
    hymnalStats: function () { return KOLOB.Hymnal ? KOLOB.Hymnal.stats() : null; },
    clockHealth: function () { return { cues: clockHealth.cues, late: clockHealth.late, maxLate: +clockHealth.maxLate.toFixed(4) }; },
    // the ward: who is seated this Sunday — the people you come
    // to know, by role, in Deseret (nameEn and the archetype are dev-only) —
    // and the desk's account of itself (lines handed, how many late, the
    // tightest margin, the most in one pump, the mouths joined to the room)
    getWard: function () {
      var W = S.theWard ? S.theWard() : null;
      if (!W) return null;
      return { seated: W.members.filter(function (m) { return m.k != null; }).length,
               people: W.individuals.map(function (id) { var m = W.byId[id]; return { memberId: id, role: m.role, nameDs: m.nameDs, part: m.part, archetype: m.archetype, archetypeEn: m.archetypeEn, nameEn: m.nameEn }; }) };
    },
    wardStats: function () { return S.wardStats ? S.wardStats() : null; },
    // the organ: who is on the bench this Sunday (their
    // style and habits; the name in Deseret, nameEn dev-only; whether the
    // morning was seated for the chorale prelude, and the meeting's ledger —
    // hymns, fills, the one strange fill), what the pipes cost (the cases,
    // the nodes built, the most alive at once, plans still on the desk)
    getOrganist: function () {
      var o = S.Meeting && S.Meeting.organist ? S.Meeting.organist() : null;
      if (!o) return null;
      return { style: o.style, nameDs: o.nameDs, nameEn: o.nameEn, habits: JSON.parse(JSON.stringify(o.habits)), ledger: { hymns: o.ledger.hymns, fills: o.ledger.fills, strange: o.ledger.strange },
               prelude: o.preludeDraw || null, chorale: S.Meeting.chorale ? S.Meeting.chorale() : null };
    },
    organStats: function () { return S.organStats ? S.organStats() : null; },
    setNoteListener: function (fn) { noteListeners.push(fn); },
    setEventListener: function (fn) { eventListeners.push(fn); },
    // on: true (a guest, drawn as the switch draws it), false, or — dev, the
    // harness and the labs — a guest's name ("bands", "steeples", "oldtune")
    setForceVisitation: function (on) { S.forceVisitation = typeof on === "string" ? on : !!on; },
    setForceRaspberry: function (on) { S.forceRaspberry = !!on; },
    setCumulativeMode: function (s) { if (s === "always" || s === "natural" || s === "never") S.cumulativeMode = s; },
    getCumulativeMode: function () { return S.cumulativeMode; },
    // the natural draw's odds (kolob-meeting.js CUMULATIVE_ODDS): the page's one source for the Whole switch's text
    getCumulativeOdds: function () { return S.CUMULATIVE_ODDS != null ? S.CUMULATIVE_ODDS : 0.08; },
    // dev accessor for the tune lab (shelved/tune-lab.php) — the pool is the
    // Earth tunes (kolob-tunes.js), read through the old-tune guest's own
    // law, so lab and engine can never drift apart
    getOldTunes: function () { return S.oldTunePool(); },
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
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-core.js"] = !!window.KolobAudio;   // the load guard's roll call
