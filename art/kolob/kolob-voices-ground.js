// ============================================================================
// KOLOB — kolob-voices-ground.js: tuba, drone, strings, bells
//
// The ground of the hall and its tower: the tuba (reserved for the raspberry
// amen), the La Monte Young drone, the prairie strings, the meetinghouse bell
// and the tines. Lends their cycles, the drone's turn (the reckoning) and
// the bell strike the far steeples ring (the LENT block at the foot).
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  var KOLOB = window.KOLOB;
  // The house's shared state. Each room lends what the others need onto S
  // (see the LENT block at the foot of this file); a name written S.x belongs
  // to another room; a bare name is this room's own or borrowed below.
  var S = KOLOB._s = KOLOB._s || {};

  // ---- BORROWED — the other rooms' functions, bound late through S (every
  // room is loaded before the first note, so the call always finds its owner;
  // each wrapper is named after the lend it calls and passes its arguments
  // through in order — tools/lends.js checks) ----
  // from kolob-pitch.js
  function colN() { return S.colN(); }
  function projDeg(d7) { return S.projDeg(d7); }
  function degFreq(i) { return S.degFreq(i); }
  function harm(h) { return S.harm(h); }
  // from kolob-meeting.js
  function intensity() { return S.intensity(); }
  function hallListens() { return S.hallListens(); }
  function houseRests(layer) { return S.houseRests(layer); }
  function inFuging() { return S.inFuging(); }
  function gapMul() { return S.gapMul(); }
  // from kolob-core.js
  function turn(label) { return S.turn(label); }
  function wait(label) { return S.wait(label); }
  function synth(voice) { return S.synth(voice); }
  function emitNote(layer, freq, startTime, duration, extra) { return S.emitNote(layer, freq, startTime, duration, extra); }
  function cueIn(lane, dtS, fn) { return S.cueIn(lane, dtS, fn); }
  function cueLayer(layer, baseS, fn) { return S.cueLayer(layer, baseS, fn); }
  function cycle(lane, self, turn, t, fallbackS) { return S.cycle(lane, self, turn, t, fallbackS); }
  function panAt(layer, p) { return S.panAt(layer, p); }
  function getLayerParam(layer, key, fallback) { return S.getLayerParam(layer, key, fallback); }
  function noiseSource() { return S.noiseSource(); }
  function noiseOffset() { return S.noiseOffset(); }
  function env(g, t, pts) { return S.env(g, t, pts); }
  function airFree() { return S.airFree(); }
  function claimAir(durS, marginS) { return S.claimAir(durS, marginS); }
  // (the other rooms' state, read and written through S: S.ctx, S.playing,
  // S.F0, S.ROOT_MULT, S.Harmony (the chord desk), S.Meeting (the
  // chorister's book), S.moment)
  var Motif = KOLOB.Melody.Motif;

  // ==========================================================================
  // VOICE: TUBA — the visiting brass.
  //
  // THE TUBA IS RESERVED FOR THE RASPBERRY AMEN ONLY. It has a stop in the
  // rail and a sample blat, but NO cycle — it must never be given a
  // scheduled voice in ordinary sections; the whole joke is that the stop
  // sits there doing nothing, meeting after meeting, until the amen goes
  // wrong. (Maintainers: do not "fix" this by wiring it into play().)
  //
  // His one entrance: a low committed blat — a scoop from under the note
  // that settles nearly on it, held beneath the cluster, released with the
  // organist's hands.
  // ==========================================================================
  function tubaBlat(t, gainMul) {
    var target = degFreq(1 - colN() * 2);          // the second, two octaves down
    var o = S.ctx.createOscillator();
    o.type = "sawtooth";
    var lp = S.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(target * 6, t);    // brassy at the attack…
    lp.frequency.linearRampToValueAtTime(target * 3, t + 0.35);   // …then dark
    // the blat: in from below, past the note, settling almost on it
    o.frequency.setValueAtTime(target * 0.86, t);
    o.frequency.linearRampToValueAtTime(target * 1.02, t + 0.12);
    o.frequency.linearRampToValueAtTime(target, t + 0.3);
    var g = S.ctx.createGain();
    o.connect(lp); lp.connect(g); g.connect(panAt("tuba", 0));
    var peak = 0.64 * (gainMul || 1);              // doubled again by owner request — the blat WILL be heard
    env(g, t, [[0.05, peak], [2.4, peak * 0.77], [0.7, 0]]);
    o.start(t); o.stop(t + 3.6);
    emitNote("tuba", target, t, 3.0);
  }

  // ==========================================================================
  // VOICE: DRONE — the La Monte Young register. Pure sines on the harmonic
  // series of F0, in very long crossfading cycles. It never stops — in the
  // sacrament it is all there is. The stillness is the point.
  //
  // THE KOLOB RECKONING (PLAN §7.2). On a Sunday the
  // reckoning holds, the drone MOVES: one note a section, the opening of the
  // tune the doxology will sing, each note the tonic, the third or the fifth
  // of the key its section is sung in. It turns only at a joint — S.droneTurn
  // (kolob-meeting.js calls it as a joint begins) glides every sine that is
  // sounding, and every one begun after, to the new note over four to six
  // seconds, under the joint's hush — and in the doxology it is home again,
  // under the tune it has been spelling. Each partial is a harmonic of the
  // drone's own fundamental, so the whole glides as one; when the note is
  // the section's third or fifth and not its tonic, the drone's own twelfth
  // (its third harmonic) and the fifth above step back, so the drone stands
  // as a pure octave-doubled tone and does not sound its own fifth against
  // the key (a third's twelfth is the key's seventh).
  // ==========================================================================
  // the drone's note: a multiplier on F0 (1 at the keynote), gliding from
  // `from` at `at` to `mul` at `until`; its role in the section's chord; its
  // monzo over the keynote (for the notes told)
  function droneHome() { return { mul: 1, from: 1, at: -1, until: -1, role: "tonic", monzo: [0, 0, 0, 0], k: null }; }
  var droneNow = droneHome();
  var droneLive = [];                               // the sines sounding: { o, base, gains: [{g, h, oct}], stopAt }
  // (a note ALONE — the still sacrament's, where nothing else sounds — keeps
  // its whole series, as the tonic does)
  var ROLE_GAINS = {
    tonic: function (h, oct, g) { return g; },
    third: function (h, oct, g) { return oct ? 0 : h === 3 ? g * 0.25 : g; },
    fifth: function (h, oct, g) { return oct ? 0 : h === 3 ? g * 0.5 : g; },
  };
  function roleGain(role, h, oct, g) { return (ROLE_GAINS[role] || ROLE_GAINS.tonic)(h, oct, g); }
  function droneMulAt(t) {
    var d = droneNow;
    if (t >= d.until) return d.mul;
    if (t <= d.at) return d.from;
    return d.from * Math.pow(d.mul / d.from, (t - d.at) / (d.until - d.at));
  }
  // at scheduled time t — the downbeat, then each overlap
  // (under the core's net, S.cycle: a turn that throws before it has
  // re-armed is re-armed by the core CYCLE_FALLBACK_S = 5 s later, and the
  // throw is reported)
  function droneCycle(t) { return cycle("drone", droneCycle, droneCycleTurn, t); }
  function droneCycleTurn(t) {
    if (!S.playing) return;
    var R = turn("drone");
    var dur = R.rnd(60, 90);
    var overlap = 20;
    var presence = getLayerParam("drone", "presence", 0.5);
    var fifthAmt = getLayerParam("drone", "fifth", 0.4);
    var sunday = S.Meeting.sunday();
    var bright = sunday ? sunday.bright : 0.5;
    var partials = [
      { h: 1, g: 0.4 }, { h: 2, g: 0.24 }, { h: 3, g: 0.12 }, { h: 4, g: 0.07 },
    ];
    if (fifthAmt > 0.1 && bright > 0.4) partials.push({ h: 3, g: fifthAmt * 0.1, oct: 1 });  // 3/2 above, one octave up
    var dest = panAt("drone", 0);
    var master = S.ctx.createGain();
    master.connect(dest);
    // (the reckoning: the note the drone stands on at t, and a glide already
    // written that this cycle begins inside or before)
    var m0 = droneMulAt(t), gl = droneNow.until > t ? droneNow : null;
    var live = { o: [], stopAt: t + dur + 0.5 };
    for (var i = 0; i < partials.length; i++) {
      var o = S.ctx.createOscillator();
      o.type = "sine";
      var base = harm(partials[i].h) * (partials[i].oct ? 2 : 1);
      o.frequency.setValueAtTime(base * m0, t);
      if (gl) { o.frequency.setValueAtTime(base * m0, Math.max(t, gl.at)); o.frequency.exponentialRampToValueAtTime(base * gl.mul, gl.until); }
      var og = S.ctx.createGain();
      var g0 = roleGain(droneNow.role, partials[i].h, partials[i].oct, partials[i].g);
      og.gain.setValueAtTime(g0, t);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + dur + 0.5);
      live.o.push({ o: o, base: base, og: og, h: partials[i].h, oct: partials[i].oct, g: partials[i].g });
    }
    droneLive = droneLive.filter(function (x) { return x.stopAt > t; });
    droneLive.push(live);
    var peak = 0.5 * (0.5 + presence * 0.8);
    // the drone holds through everything, even the sacrament — softer, never gone
    if (S.Meeting.section() === "sacrament") peak *= 0.8;
    env(master, t, [[overlap * 0.7, peak], [dur - overlap * 1.4, peak * 0.95], [overlap * 0.7, 0]]);
    // (told as the note it stands on — a cycle begun inside a glide is told
    // as the note the glide arrives at, from its arrival)
    var inGlide = !!gl && t < droneNow.until, mTold = inGlide ? droneNow.mul : m0;
    emitNote("drone", S.F0 * mTold, inGlide ? droneNow.until : t, inGlide ? dur - (droneNow.until - t) : dur, droneNow.k != null || mTold !== 1 ? droneTag() : undefined);
    cueLayer("drone", dur - overlap, droneCycle);
  }
  // the drone's note as a written note: its monzo over the keynote (the
  // drone sounds two octaves under it), the cantus's place
  function droneTag(extra) {
    var o = { monzo: droneNow.monzo.slice(), keyMonzo: [0, 0, 0, 0], role: droneNow.role, cantus: droneNow.k };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  // S.droneTurn(t, toMonzo, glideS, role, k): the drone turns to a new note
  // at t, gliding over glideS — every sine sounding, and every cycle begun
  // after. toMonzo: the note's class over the keynote (from the calendar's
  // reckoning); the drone takes the octave nearest where it stands, within a
  // fifth below and a sixth above the keynote's own. → the note turned to
  // (null when it is already there)
  var DRONE_WINDOW = [Math.pow(2, -7 / 12), Math.pow(2, 9 / 12)];
  function ratioOf(m) { return KOLOB.Pitch.ratio(m); }
  function droneTurn(t, toMonzo, glideS, role, k) {
    if (!S.ctx) return null;
    var from = droneMulAt(t), r = ratioOf(toMonzo), best = null;
    for (var oc = -2; oc <= 2; oc++) {
      var x = r * Math.pow(2, oc);
      if (x < DRONE_WINDOW[0] || x > DRONE_WINDOW[1]) continue;
      if (!best || Math.abs(Math.log(x / from)) < Math.abs(Math.log(best.x / from))) best = { x: x, oc: oc };
    }
    if (!best) return null;
    var same = Math.abs(1200 * Math.log2(best.x / from)) < 0.5;
    var roleNow = role || "tonic", g = Math.max(0.5, glideS || 4);
    // the drone's monzo over the keynote: two octaves below it, times the note
    var monzo = [toMonzo[0] + best.oc - 2, toMonzo[1], toMonzo[2], toMonzo[3] || 0];
    if (same && roleNow === droneNow.role) { droneNow.k = k != null ? k : droneNow.k; return null; }
    droneNow = { mul: best.x, from: from, at: t, until: same ? t : t + g, role: roleNow, monzo: monzo, k: k != null ? k : null };
    droneLive = droneLive.filter(function (x) { return x.stopAt > t; });
    droneLive.forEach(function (lv) {
      lv.o.forEach(function (p) {
        if (!same) {
          p.o.frequency.setValueAtTime(p.base * from, t);
          p.o.frequency.exponentialRampToValueAtTime(p.base * best.x, t + g);
        }
        p.og.gain.setTargetAtTime(roleGain(roleNow, p.h, p.oct, p.g), t, g / 3);
      });
    });
    // told as the note it arrives at (the harness holds it to its monzo)
    emitNote("drone", S.F0 * best.x, t + (same ? 0 : g), Math.max(4, lv0Until(t) - t - g), droneTag({ glide: same ? 0 : +g.toFixed(3), from: +(S.F0 * from).toFixed(3) }));
    return { fromHz: S.F0 * from, toHz: S.F0 * best.x, monzo: monzo, glide: same ? 0 : g };
  }
  function lv0Until(t) { var u = t + 30; droneLive.forEach(function (lv) { if (lv.stopAt > u) u = lv.stopAt; }); return u; }
  function droneNote() { return { mul: droneNow.mul, role: droneNow.role, monzo: droneNow.monzo.slice(), k: droneNow.k, until: droneNow.until }; }
  // a new visit (a reseed while stopped, kolob-core.js): the drone forgets
  // the note the old visit left it on and the sines it left behind the
  // closed doors, and stands home as on a page just loaded — else the new
  // visit's first meeting turned it home from there with a glide, and its
  // first turn was told as long as those old sines still ran
  function droneForget() { droneNow = droneHome(); droneLive = []; }

  // ==========================================================================
  // VOICE: STRINGS — the prairie. Open fifths of the sounding chord in long
  // trapezoid pads; one quiet high "lonesome" partial riding above. Widest in
  // the doxology; silent in the invocation and the sacrament.
  // ==========================================================================
  // (the bows' detune is sound-level: synth:strings)
  function stringsPad(t, dur, gainMul, fifthOnly) {
    var Y = synth("strings");
    var warmth = getLayerParam("strings", "warmth", 0.5);
    var lonesome = getLayerParam("strings", "lonesome", 0.4);
    // the chord standing when the bows begin (the book's, at t)
    var ch = S.Harmony.at(t);
    var rootF = ch ? ch.freqs[0] * 2 : S.F0 * S.ROOT_MULT;
    var fifthF = rootF * 1.5;
    // a chord whose own fifth is not pure (the diminished one on ti, on re in
    // aeolian, on la in dorian, on mi in mixolydian) has no open fifth to
    // give: its pad is the bare octave. A pure fifth bowed over it would be
    // a pitch outside the day's tuning, against the choir's own.
    var pure = pureFifth(rootF);
    var pitches = pure ? (fifthOnly ? [rootF, fifthF] : [rootF, fifthF, rootF * 2]) : [rootF, rootF * 2];
    var parts = pure ? ["root", "fifth", "octave"] : ["root", "octave"];
    var master = S.ctx.createGain();
    master.connect(panAt("strings", 0));
    var lp = S.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(700 + (1 - warmth) * 900 + intensity() * 900, t);  // set once, never swept
    lp.connect(master);
    for (var p = 0; p < pitches.length; p++) {
      for (var d = 0; d < 3; d++) {
        var o = S.ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(pitches[p] * (1 + (d - 1) * Y.rnd(0.002, 0.0035)), t);
        var og = S.ctx.createGain();
        og.gain.setValueAtTime(0.09 / pitches.length, t);
        o.connect(og); og.connect(lp);
        o.start(t); o.stop(t + dur + 0.5);
      }
    }
    if (lonesome > 0.05) {
      var lo = S.ctx.createOscillator();
      lo.type = "sine";
      lo.frequency.setValueAtTime((pure ? fifthF : rootF) * 4, t);
      var lg = S.ctx.createGain(); lg.gain.setValueAtTime(lonesome * 0.05, t);
      lo.connect(lg); lg.connect(master);
      lo.start(t); lo.stop(t + dur + 0.5);
    }
    var peak = (gainMul || 1) * 0.7 * (0.4 + intensity() * 0.7);
    var edge = Math.min(8, dur * 0.3);
    env(master, t, [[edge, peak], [Math.max(0.5, dur - edge * 2), peak * 0.92], [edge, 0]]);
    // every bowed pitch is told: the root, its fifth and, when the pad is
    // full, the root's octave (the lonesome sine is the fifth's overtone, a
    // colour of the pad, not a note)
    for (var pp = 0; pp < pitches.length; pp++) emitNote("strings", pitches[pp], t, dur, { part: parts[pp], chord: ch ? ch.id : null });
  }
  // is the pure fifth above f a tone of the day's collection (any octave)?
  function pureFifth(f) {
    var r = f * 1.5 / (S.F0 * S.ROOT_MULT);
    while (r >= 2) r /= 2;
    while (r < 1) r *= 2;
    var ratios = S.COL().ratios;
    for (var i = 0; i < ratios.length; i++) {
      var c = Math.abs(1200 * Math.log2(r / ratios[i]));
      if (c < 2 || c > 1198) return true;
    }
    return false;
  }
  // The strings' turn, at scheduled time t.
  // (under the core's net, S.cycle: a turn that throws before it has
  // re-armed is re-armed by the core CYCLE_FALLBACK_S = 5 s later, and the
  // throw is reported)
  function stringsCycle(t) { return cycle("strings", stringsCycle, stringsCycleTurn, t); }
  function stringsCycleTurn(t) {
    if (!S.playing) return;
    var s = S.Meeting.section();
    // (a rite seated as the brush arbor is the strings' own: they bow its
    // bare fifths, even in the invocation or an interlude,
    // where they are otherwise silent; the sacrament keeps its stillness)
    var arborRite = s !== "prelude" && S.Meeting.scene && S.Meeting.scene() && S.Meeting.scene().fifths;
    if ((s === "invocation" || s === "sacrament" || s === "interlude") && !(arborRite && s !== "sacrament")) { cueIn("strings", 8, stringsCycle); return; }
    if (hallListens() || houseRests("strings")) { cueIn("strings", 8, stringsCycle); return; }       // (the house listens: the trombones at dawn; or it is letting go)
    var R = turn("strings");
    var dur = R.rnd(22, 34);
    var overlap = 8;
    var seat = s === "prelude" ? S.Meeting.seating() : (S.Meeting.scene ? S.Meeting.scene() : null);   // (the brush arbor bows bare fifths — the prelude's, or a rite's)
    stringsPad(t + 0.1, dur, s === "doxology" ? 1 : 0.75, R.chance(0.7) || !!(seat && seat.fifths));
    // (the prelude's texture: a strings morning overlaps its pads)
    cueLayer("strings", (dur - overlap) * (s === "doxology" ? 0.9 : 1.3) * S.Meeting.lean("strings"), stringsCycle);
  }

  // ==========================================================================
  // VOICE: BELLS — the meetinghouse bell (section joints, festival peals) and
  // the muted TINE (the Cage nod: a prepared, damped, music-box tone that
  // taps motif heads between speeches, quantized to the sounding chord).
  // ==========================================================================
  // One bell, one strike — extracted so far steeples can ring the same KIND
  // of bell at their own bases and down their own wires. The partial stack
  // and beating doublets are the meetinghouse bell's, untouched. opts.hum
  // adds the 0.5× hum partial (the home bell keeps its hum; visitors don't,
  // so transposed hums never pile up under the drone).
  // (the doublets' beating and the partials' decay are sound-level: synth:bells)
  function bellStrike(t, gainMul, base, dest, opts) {
    var Y = synth("bells");
    var ratios = [1, 2.0, 2.76, 3.98, 5.4];
    var g0 = (gainMul || 0.6) * 0.55;
    for (var i = 0; i < ratios.length; i++) {
      for (var d = 0; d < 2; d++) {                            // beating doublets — a real bell shimmers
        var o = S.ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(base * ratios[i] + (d ? Y.rnd(0.4, 2.2) : 0), t);
        var og = S.ctx.createGain();
        o.connect(og); og.connect(dest);
        var pg = g0 * 0.5 / (1 + i * 1.0);
        env(og, t, [[0.005, pg], [Y.rnd(3.5, 8) / (1 + i * 0.55), 0]]);
        o.start(t); o.stop(t + 10);
      }
    }
    if (opts && opts.hum) {
      var hum = S.ctx.createOscillator();
      hum.type = "sine"; hum.frequency.setValueAtTime(base * 0.5, t);
      var hg = S.ctx.createGain();
      hum.connect(hg); hg.connect(dest);
      env(hg, t, [[0.012, g0 * 0.28], [Y.rnd(5, 9), 0]]);
      hum.start(t); hum.stop(t + 10);
    }
  }
  // R: the caller's stream (the joint's, or the audition's) — which bell is a pitch
  function meetinghouseBell(t, gainMul, R) {
    if (!S.ctx) return;
    var ringAmt = getLayerParam("bells", "ring", 0.55);
    var base = harm(R.pick([4, 5, 6]));
    while (base > 700) base /= 2;
    while (base < 300) base *= 2;
    bellStrike(t, (gainMul || 0.6) * ringAmt, base, panAt("bells", synth("bells").rnd(-0.2, 0.2)), { hum: true });
    emitNote("bells", 0, t, 7);
  }
  // (where the tine sits and how long it rings are sound-level)
  function tineTap(t, f, amp, extra) {
    var Y = synth("bells");
    var dest = panAt("bells", Y.rnd(-0.4, 0.4));
    var partials = [[1, 1], [5.43, 0.35]];
    for (var i = 0; i < partials.length; i++) {
      var o = S.ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f * partials[i][0], t);
      var og = S.ctx.createGain();
      o.connect(og); og.connect(dest);
      env(og, t, [[0.003, amp * partials[i][1]], [i === 0 ? Y.rnd(0.7, 1.2) : Y.rnd(0.12, 0.2), 0]]);
      o.start(t); o.stop(t + 1.5);
    }
    // the fingernail thump — the felt against the tine
    var n = noiseSource();
    var nf = S.ctx.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.setValueAtTime(500, t);
    var ng = S.ctx.createGain();
    n.connect(nf); nf.connect(ng); ng.connect(dest);
    env(ng, t, [[0.003, amp * 0.2], [0.06, 0]]);
    n.start(t, noiseOffset()); n.stop(t + 0.15);
    emitNote("bells", f, t, 1, extra);
  }
  // The tines' turn, at scheduled time tc.
  // (under the core's net, S.cycle: a turn that throws before it has
  // re-armed is re-armed by the core CYCLE_FALLBACK_S = 5 s later, and the
  // throw is reported)
  function tineCycle(tc) { return cycle("bells", tineCycle, tineCycleTurn, tc); }
  function tineCycleTurn(tc) {
    if (!S.playing) return;
    var s = S.Meeting.section();
    if (s === "invocation" || s === "sacrament" || inFuging()) { cueIn("bells", 9, tineCycle); return; }
    if (S.inVisit() && S.Meeting.visitType() === "hosanna") { cueIn("bells", 9, tineCycle); return; }   // (the tines keep still under the Hosanna: the day's theme is not rung over "The Spirit of God")
    if (!airFree()) { cueIn("bells", wait("bells").rnd(6, 12), tineCycle); return; }
    var R = turn("bells");
    var tineAmt = getLayerParam("bells", "tine", 0.5);
    var mo = S.moment();
    var motif = Motif.overdueFor("bells", mo) ? Motif.claim("bells", mo, R) : Motif.request("bells", mo, R);
    if (!motif) { cueIn("bells", 9, tineCycle); return; }
    var head = motif.notes.slice(0, R.rint(4, 6));
    var t = tc + 0.1;
    var beat = R.rnd(0.55, 0.85);
    var leanOn = S.Harmony.at(t);                              // the chord standing as the tines begin
    var tones = S.Harmony.chordTones(t);
    var total = 0;
    for (var i = 0; i < head.length; i++) {
      var pd = projDeg(head[i].deg) + colN();                  // up where a music box lives
      if (tones) {
        var cls = ((pd % colN()) + colN()) % colN();
        if (!tones[cls]) pd += 1;                              // lean onto the chord
      }
      var f = degFreq(pd) * 2;
      tineTap(t + total, f, 0.3 * tineAmt * 2, i === 0 && leanOn ? { chord: leanOn.id } : null);   // (the lean's chord, told with the first tap)
      total += Math.max(0.35, head[i].durBeats * beat * 0.6);
    }
    claimAir(total, R.rnd(3, 7));
    var gap = R.rnd(20, 45) * gapMul() * S.Meeting.lean("bells");      // (a valley morning taps more)
    cueLayer("bells", total + gap, tineCycle);
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.tubaBlat = tubaBlat;
  S.droneCycle = droneCycle;
  S.droneTurn = droneTurn;
  S.droneNote = droneNote;
  S.droneForget = droneForget;
  S.stringsPad = stringsPad;
  S.stringsCycle = stringsCycle;
  S.bellStrike = bellStrike;
  S.meetinghouseBell = meetinghouseBell;
  S.tineTap = tineTap;
  S.tineCycle = tineCycle;
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-voices-ground.js"] = true;   // the load guard's roll call
})();
