// ============================================================================
// KOLOB — kolob-guests.js: the set pieces
//
// What a guest sounds like once the meeting has seated it (kolob-meeting.js
// plans and cues; this room plays and tells). Here, in order:
//   · the raspberry amen's cluster (razzCluster) and the cumulative assembly
//     (cumulativeAssembly) — not guests but the meeting's own set pieces;
//   · THE UNANSWERED QUESTION (shelved: the code stays, it never seats);
//   · FROM THE STEEPLES (steeplesAnswer), and change ringing from a far
//     tower in its place some Sundays (changesRing, kolob-guest-changes.js);
//   · THE OLD TUNE, HALF-REMEMBERED (oldTuneRemembered) and its law — which
//     Earth tunes a Sunday may remember (oldTuneCandidates, oldTunePool);
//   · THE TROMBONE CHOIR AT DAWN (trombonesAtDawn, kolob-guest-trombones.js);
//   · the guests who stand in the room — the handbells and the singing
//     school (standingGuest), the gift of tongues (tonguesGift), the Social
//     Hall (socialHall);
//   · the guests from outside the windows — the Nauvoo band, the handcart
//     company, the gulls (outdoorGuest);
//   · the organist's variations (organistVariations).
// The common shape: a set piece takes the visitation record V and the cue's
// time tc, lays its sound out on the guests' lane (hooks.defer, a slice at a
// time, never the whole piece in one cue), reports every note with
// guestNote(V, …) and every row with tell(V, …) — both carry whether the
// page may name the guest — claims the air where the house listens, and
// returns its span in seconds, which the conductor holds the joint for.
// Each throws its dice from its own stream, guest:<type>:<n>, so a guest
// that throws more or fewer never alters a hymn.
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
  // room is loaded before the first note, so the call always finds its owner) ----
  // from kolob-pitch.js
  function colN() { return S.colN(); }
  function projDeg(d7) { return S.projDeg(d7); }
  function degFreq(i) { return S.degFreq(i); }
  function harm(h) { return S.harm(h); }
  function isHome(m) { return KOLOB.Pitch.isHome(m); }
  // from kolob-voices-organ.js
  function organChord(t, dur, chord, gainMul) { return S.organChord(t, dur, chord, gainMul); }
  // from kolob-voices-choir.js
  function plagalAmen(chords, at, chordS, by, gainMul, holdMul) { return S.plagalAmen(chords, at, chordS, by, gainMul, holdMul); }
  function choirHarmonizedLine(t, harmonized, beat, gainMul) { return S.choirHarmonizedLine(t, harmonized, beat, gainMul); }
  // from kolob-voices-winds.js
  function renderClarinetLine(t, notes, gainMul, R) { return S.renderClarinetLine(t, notes, gainMul, R); }
  // from kolob-voices-ground.js
  function stringsPad(t, dur, gainMul, fifthOnly) { return S.stringsPad(t, dur, gainMul, fifthOnly); }
  function bellStrike(t, gainMul, base, dest, opts) { return S.bellStrike(t, gainMul, base, dest, opts); }
  // from kolob-meeting.js
  function localArc() { return S.localArc(); }
  // from kolob-core.js
  function stream(label) { return S.stream(label); }
  function synth(voice) { return S.synth(voice); }
  function emitNote(layer, freq, startTime, duration, extra) { return S.emitNote(layer, freq, startTime, duration, extra); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  function wideSend() { return S.wideSend(); }
  function cueAt(lane, t, fn) { return S.cueAt(lane, t, fn); }
  function panAt(layer, p) { return S.panAt(layer, p); }
  function getLayerParam(layer, key, fallback) { return S.getLayerParam(layer, key, fallback); }
  function claimAir(durS, marginS) { return S.claimAir(durS, marginS); }
  // (the other rooms' state, read and written through S: S.ctx, S.mode,
  // S.Harmony (the chord desk), S.Meeting (the chorister's book), S.moment,
  // S.reportLine)
  var Motif = KOLOB.Melody.Motif;
  // A guest's word to the minutes (SCORE §6): typed, and carrying whether the
  // page may name the guest at all — a guest the meeting marked unlogged
  // (V.logged false: the Hosanna) says so on every event it sends.
  function tell(V, ev) {
    ev.logged = !(V && V.logged === false);
    return emitEvent(ev);
  }
  // …and its notes say the same: each note a visitor sounds names the guest
  // and whether the page may show it. A note that says logged: false is
  // neither printed in the minutes nor engraved (else the steeples' first
  // bell and the band's steps reached the page untagged when their events
  // had been hushed). extra: the note's own fields.
  function guestNote(V, guest, extra) {
    var o = extra || {};
    o.guest = guest;
    o.logged = !(V && V.logged === false);
    return o;
  }
  // …and one of the ward who comes forward in a piece (its hooks' onCast:
  // the Social Hall's fiddler and caller, and the testimony-bearers, whom
  // kolob-meeting.js hears): their row, a cast event (SCORE §6) named in
  // Deseret — c is the piece's word {memberId, nameDs?, action}, `ward` the
  // meeting's, where they are found. The caller sends it (tell, or the
  // meeting's emitEvent) if its own piece is still live.
  function castEvent(c, ward) {
    var m = ward && ward.byId ? ward.byId[c.memberId] : null;
    return { type: "cast", memberId: c.memberId, nameDs: c.nameDs || (m ? m.nameDs : "") || "", action: c.action,
             actionDs: KOLOB.Cast && KOLOB.Cast.ACTION_DS ? KOLOB.Cast.ACTION_DS[c.action] || null : null, role: m ? m.role || null : null };
  }

  // THE RASPBERRY AMEN's cluster — two hands of neighboring seconds, every
  // tone a collection ratio, so the wrongness is spelled in the meeting's
  // own tuning. Warm JI beating, not a smear: dissonant, never broken.
  function razzCluster() {
    var n = colN();
    var idxs = [-1, 0, 1, n + 1, n + 2, n + 4];
    return { freqs: idxs.map(function (i) { return degFreq(i); }) };
  }

  // ==========================================================================
  // CUMULATIVE ASSEMBLY — the payoff of a withheld meeting. After twenty
  // minutes of tails, heads, and mirrors, the whole tune arrives for the
  // first time: a breath, then the theme VERBATIM in four parts — never
  // poured through the meter; this is a tune-statement, not a verse —
  // clarinet doubling above, organ beneath, strings holding the fifth,
  // closed with the plagal amen. The withholding lifts when it ends.
  // ==========================================================================
  function cumulativeAssembly(tc) {
    var theme = Motif.theme();
    if (!theme) return 8;
    var R = stream("guest:cumulative");
    var t = tc + 0.4;
    var breath = R.rnd(2, 3);                      // the room inhales
    // if the hour is late (the x>0.7 fallback), the statement compresses
    var beat = localArc() > 0.7 ? R.rnd(0.95, 1.15) : R.rnd(1.3, 1.6);
    var line = theme.notes.map(function (n) { return { deg: n.deg, dur: n.durBeats }; });
    var at = t + breath;
    var hz = S.Harmony.harmonize(line, R, at, beat, "assembly");   // each chord written where it is sung
    var total = choirHarmonizedLine(at, hz, beat, 0.95);
    // the deacon doubles the melody an octave above the sopranos
    var cnotes = theme.notes.map(function (n) {
      return { f: degFreq(projDeg(n.deg) + colN()), dur: Math.max(0.4, Math.min(beat * 3.5, n.durBeats * beat)) };
    });
    renderClarinetLine(at + 0.1, cnotes, 0.8, R);
    // the ground beneath the arrival
    if (hz.length) organChord(at, Math.max(6, total * 0.55), hz[0].chord, 0.5);
    var chDur = R.rnd(2.8, 3.4);
    stringsPad(at, total + chDur * 2 + 2, 0.85, true);
    // the plagal amen — every voice lands together, the organ following
    // and ending where it always did (THE PLAGAL AMEN, kolob-voices-choir.js:
    // here at 0.9, the organ's last chord held ×1.2)
    var cadAt = at + total + R.rnd(0.4, 0.9);
    var chords = S.Harmony.cadence("plagal", R, cadAt, "assembly");
    plagalAmen(chords, cadAt, chDur, "assembly", 0.9, 1.2);
    var dur = (cadAt + chDur * 2.2) - t;
    claimAir(dur, 6);
    tell(null, { type: "guest", guest: "assembly", stage: "whole-tune", theme: theme.name, gesture: theme.gesture || null, dur: dur });
    // the span the conductor holds is the SOUND's, counted from the cue: the
    // held amen (its last chord, ×1.7) and the strings under it both outlast
    // the air claimed above
    return Math.max(cadAt + chDur * 2.7, at + total + chDur * 2 + 2) - tc;
  }

  // ==========================================================================
  // IVES VISITATIONS — rare guests, drawn at planMeeting on independent dice.
  // (The Unanswered Question, after Ives, 1908, was the first of them and is
  // shelved — the owner, 2026-09-27: "one of the less interesting guests";
  // its set piece left this file on 2026-10-01 for
  // shelved/kolob-question-setpiece.js, its generator is
  // shelved/kolob-question.js, and kolob-meeting.js still throws its dice.)
  // ==========================================================================

  // ==========================================================================
  // FROM THE STEEPLES (after Ives, 'From the Steeples and the Mountains'):
  // the meetinghouse bell rings, and two or three far steeples answer from
  // the edges of the valley — each in ITS OWN key, each keeping its one fixed
  // pitch on its own slow period, phasing against the home bell for a minute.
  // Bells are landscape, not conversation: no air is claimed, the meeting
  // carries on beneath them, and the visitors are never engraved on the page
  // (not one of ours). The home bell has the first word and the last.
  // ==========================================================================
  // (the steeples' keys and the times of their strikes are musical; where
  // each stands in the valley and how loud it carries are synth:steeples)
  var BELL_RING_S = 7;                           // how long a strike is told as ringing
  function steeplesAnswer(V, tc) {
    // (some Sundays the far bells are a band ringing changes)
    if (V.changes && KOLOB.GuestChanges) return changesRing(V, tc);
    var R = stream("guest:steeples");
    var Y = synth("steeples");
    var t = tc + 0.3;
    // the whole minute: the conductor holds the joint while a guest sounds,
    // so the steeples are never cut short to fit what was left of the
    // section
    var dur = R.rnd(45, 75);

    // the home steeple — center field, the same bell the joints ring
    var homeBase = harm(R.pick([4, 5, 6]));
    while (homeBase > 700) homeBase /= 2;
    while (homeBase < 300) homeBase *= 2;
    var ringAmt = getLayerParam("bells", "ring", 0.55);
    var homeGain = 0.6 * ringAmt;

    // the visitors: fixed transposed bases drawn without replacement — a bell
    // keeps its key; a festive Sunday wakes a third steeple
    var pool = [9 / 8, 4 / 3, 16 / 9, 6 / 5];
    var nVis = S.Meeting.sunday().bells >= 0.8 && R.chance(0.7) ? 3 : 2;
    var visitors = [];
    for (var v = 0; v < nVis; v++) {
      var trans = pool.splice(R.rint(0, pool.length - 1), 1)[0];
      var base = homeBase * trans;
      while (base > 700) base /= 2;
      while (base < 300) base *= 2;
      // its own wire: the haze of distance, one fixed seat at a field edge
      var g = S.ctx.createGain();
      g.gain.setValueAtTime(1, t);
      var lp = S.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(2400, t);
      var pan = S.ctx.createStereoPanner();
      pan.pan.setValueAtTime((v % 2 === 0 ? 1 : -1) * Y.rnd(0.7, 0.95), t);
      g.connect(lp); lp.connect(pan); pan.connect(wideSend());                   // a far steeple: all tabernacle
      visitors.push({ base: base, dest: g, period: R.rnd(5.5, 11), gain: homeGain * Y.rnd(0.35, 0.5) });
    }

    // every strike scheduled upfront at absolute times (the bands precedent)
    var all = [];
    // the home steeple: first word, steady period, and the last bell alone
    var homeTimes = [t];
    var ht = t + R.rnd(7, 9);
    while (ht < t + dur - 6) { homeTimes.push(ht + R.rnd(-0.4, 0.4)); ht += R.rnd(7, 9); }
    homeTimes.push(t + dur - R.rnd(0.5, 1.5));
    for (var h = 0; h < homeTimes.length; h++) {
      all.push({ at: homeTimes[h], base: homeBase, home: true, gain: homeGain * (h === homeTimes.length - 1 ? 0.9 : 1) });
    }
    for (var v2 = 0; v2 < visitors.length; v2++) {
      var vis = visitors[v2];
      var times = [];
      var vt = t + 3.5 + v2 * R.rnd(2, 4);                     // each answers in turn
      var lastAt = t + dur * R.rnd(0.72, 0.85);                // gone before the last bell
      while (vt < lastAt) { times.push(vt + R.rnd(-0.4, 0.4)); vt += vis.period; }
      for (var k = 0; k < times.length; k++) {
        // ring in over the first two strikes, taper over the final two
        var m = k === 0 ? 0.55 : k === 1 ? 0.85 : k >= times.length - 1 ? 0.45 : k >= times.length - 2 ? 0.75 : 1;
        all.push({ at: times[k], base: vis.base, home: false, dest: vis.dest, gain: vis.gain * m });
      }
    }
    // sparse overlap is the texture; simultaneity is clangor — nudge collisions
    all.sort(function (a, b) { return a.at - b.at; });
    for (var s2 = 1; s2 < all.length; s2++) {
      if (all[s2].at - all[s2 - 1].at < 0.6) all[s2].at = all[s2 - 1].at + 0.7;
    }
    var ringEnd = t + dur;
    for (var s3 = 0; s3 < all.length; s3++) {
      var st = all[s3];
      if (st.home) {
        bellStrike(st.at, st.gain, st.base, panAt("bells", Y.rnd(-0.2, 0.2)), { hum: true });
        emitNote("bells", 0, st.at, BELL_RING_S, guestNote(V, "steeples"));
      } else {
        bellStrike(st.at, st.gain, st.base, st.dest, { hum: false });
      }
      if (st.at + BELL_RING_S > ringEnd) ringEnd = st.at + BELL_RING_S;
    }

    tell(V, { type: "guest", guest: "steeples", stage: "answer", bells: nVis, dur: dur });
    cueAt("guests", tc + dur, function () {
      tell(V, { type: "guest", guest: "steeples", stage: "last-bell" });
    });
    // the span runs until the last bell has rung out, not until it is struck:
    // the prelude or the postlude waits for the ring
    return ringEnd - tc;
  }

  // ==========================================================================
  // THE OLD TUNE, HALF-REMEMBERED (after Ives's borrowings): once in a great
  // while, far off at the edge of the field, a REAL hymn — one the colony
  // carried out from Earth — surfaces for its first line or two, maybe a
  // fainter second try at its head, and is gone. The engine's only
  // quotation of pre-existing music.
  //
  // THE TUNES are the Earth tunes (kolob-tunes.js, KOLOB.Tunes): every one
  // taken down from a public-domain printing and heard by the owner in the
  // Earth Tunes Lab (incipits drafted from hymnary.org's digits with guessed
  // rhythms were wrong, and are gone). The guest sings the MELODY of the
  // tune's first line, or of its
  // first two, in the book's own rhythm — a tie held, a rest between lines
  // kept, a breath at the line's end — at a remembered tempo, slower than
  // the book's. It reads only KOLOB.Tunes' public surface (list, byId), so a
  // tune added there joins the pool with nothing to change here.
  //
  // Unengraved: the memory comes from outside the valley (or outside the
  // present), so the page never prints it and the clerk's row is its only
  // record — its notes are reported on a layer of their own, "oldtune",
  // which the page does not engrave (every sounded note is told; each names
  // the Earth tune, the line and the beat it was written at).
  //
  // THE MODE LAW. A memory surfaces only
  // on a Sunday of its own colour: the minor tunes (the Earth tune's mode
  // aeolian or dorian) on dark Sundays, the major ones on bright Sundays — a
  // minor tune recoloured major is the wrong tune, and so is the reverse.
  // And only where the day's tuning holds EVERY note of the melody it will
  // sing, exactly: each note's pitch (its monzo, with the comma the book's
  // harmony leaned it by taken back out — the harmony is not heard) must be
  // the day's own pitch for its degree. So a line that sings ti waits for an
  // ionian Sunday (the mixolydian ti is flat); one that sings fa or ti never
  // comes on a pentatonic Sunday (penta folds them away), nor ti on a
  // hexatonic one; a minor line that sings le waits for aeolian (dorian
  // raises it); and a chromatic note keeps a line out altogether. Computed
  // from the tunes, never hand-listed. KINGSFOLD — the house hymn, "If You
  // Could Hie to Kolob" (LDS #284) — is weighed double among the tunes the
  // Saints sing, and those above the tradition's tunes they do not.
  //
  // A MEMORY IS A WHOLE THOUGHT. A tune whose
  // opening the day holds only in a short first line — SIMPLE GIFTS on a
  // mixolydian or hexatonic Sunday (its second line sings ti); DESERET,
  // MARTYR and NETTLETON on a pentatonic one — came and went in five or six
  // seconds, where a memory should last twelve to sixteen. So a tune
  // surfaces only where the lines the day holds last MIN_MEMORY_S even at
  // the quickest remembered tempo; every mode keeps tunes enough that the
  // old tune's odds stand.
  // ==========================================================================
  var COMMA = [-4, 4, -1, 0];                          // 81/80, the syntonic comma
  var DARK = { aeolian: true, dorian: true };
  var HOUSE_HYMN = "earth:kingsfold";
  var OLD_TUNE_CENTRE = 8;                             // where the memory sits: a 7-space degree above the keynote
  var OLD_TUNE_CEILING = 14;                           // …and never above do two octaves up, where the far voice's lowpass stands
  var TEMPO_MIN = 1.15, TEMPO_MAX = 1.45;              // the remembered tempo: the book's beat held this much longer
  var MIN_MEMORY_S = 8;                                // the shortest memory, at the quickest remembered tempo
  function earthTunes() { return (KOLOB.Tunes && KOLOB.Tunes.list) || []; }
  function openingLines(h) { return (h.lines || []).concat(h.refrain || []); }
  // does the day's tuning hold this melody note, exactly?
  function holds(mode, n) {
    if (n.alt) return false;                           // a chromatic note: no day holds it
    var P = KOLOB.Pitch, col = P.COLLECTIONS[mode], cls = ((n.deg % 7) + 7) % 7;
    if (cls > 0 && col.map[cls] === col.map[cls - 1]) return false;   // folded away (penta's fa and ti, hexa's ti)
    var c = n.comma || 0;
    var plain = P.octaveReduce(P.mul(n.monzo, [-c * COMMA[0], -c * COMMA[1], -c * COMMA[2], 0]));
    return plain.join() === P.MODE_MONZOS[mode][col.map[cls]].join();
  }
  // how many of a tune's opening lines this Sunday can hold: 0, 1 or 2
  function linesHeld(h, mode) {
    if (!!DARK[h.mode] !== !!DARK[mode]) return 0;
    var ls = openingLines(h), k = 0;
    while (k < 2 && ls[k] && (ls[k].notes[h.melodyPart] || []).every(function (n) { return holds(mode, n); })) k++;
    return k;
  }
  function tuneWeight(h) {
    if (h.id === HOUSE_HYMN) return 6;
    var L = h.lds;
    var sung = !!(L && ((L.hymns1985 && L.hymns1985.length) || (L.homeAndChurch && L.homeAndChurch.length)));
    return sung ? 3 : 1.5;
  }
  // how many opening lines the memory may sing on this Sunday: the lines the
  // law lets the day hold, if they make a whole thought — else none
  function linesAdmitted(h, mode) {
    var k = linesHeld(h, mode);
    return k > 0 && beatsOf(excerpt(h, k)) * h.beatS * TEMPO_MIN >= MIN_MEMORY_S ? k : 0;
  }
  // the pool for the day's mode: [[{id, lines}, weight], …] in the book's order
  function oldTuneCandidates(mode) {
    var m = mode || S.mode, pool = [];
    earthTunes().forEach(function (h) {
      var k = linesAdmitted(h, m);
      if (k > 0) pool.push([{ id: h.id, lines: k }, tuneWeight(h)]);
    });
    return pool;
  }
  // The melody of a tune's first k lines, as the memory holds it: ties
  // held as one note, each note's rest after it (a line's start in the book,
  // less where the line before it ended), a breath at every line's end.
  //   → [{ deg, beats, restAfter, breath, line, index, beat, monzo }]
  function excerpt(h, k) {
    var ls = openingLines(h), out = [], at = 0;
    for (var li = 0; li < k && li < ls.length; li++) {
      var ln = ls[li], mel = ln.notes[h.melodyPart] || [];
      var start = ln.startBeat != null ? ln.startBeat : at;
      if (out.length) out[out.length - 1].restAfter += Math.max(0, start - at);
      for (var i = 0; i < mel.length; i++) {
        var n = mel[i], prev = out[out.length - 1];
        if (prev && prev.tie && prev.line === li) { prev.beats += n.beats; prev.tie = n.tie; continue; }
        out.push({ deg: n.deg, beats: n.beats, restAfter: 0, breath: false, tie: n.tie, line: li, index: i, beat: n.beat, monzo: n.monzo, comma: n.comma || 0 });
      }
      if (out.length) out[out.length - 1].breath = true;
      at = start + KOLOB.Score.lineLength(ln);
    }
    return out;
  }
  function beatsOf(notes) { var b = 0; notes.forEach(function (n) { b += n.beats + n.restAfter; }); return b; }
  // The register: the octave that sets the excerpt's middle nearest
  // OLD_TUNE_CENTRE. A tune's tenor melody (the Sacred Harp's) is written
  // low; it rises to the same far place. On a tie the lower octave, and a
  // lower one again where the top would pass the ceiling, if the bottom
  // stays at the keynote or above (else MARTYR's tie rounded up and sang to
  // 1.3 kHz, over the far voice's lowpass; a memory never passes about
  // 880 Hz).
  function octaveFor(notes) {
    var lo = Infinity, hi = -Infinity;
    notes.forEach(function (n) { if (n.deg < lo) lo = n.deg; if (n.deg > hi) hi = n.deg; });
    var o = Math.ceil((OLD_TUNE_CENTRE - (lo + hi) / 2) / 7 - 0.5);
    while (hi + 7 * o > OLD_TUNE_CEILING && lo + 7 * (o - 1) >= 0) o--;
    return o;
  }
  // THE LEAP SUNG PURE (PLAN §2.4's comma tracking). The day's fixed tuning
  // makes one fourth and one fifth a comma
  // wide — te to me in the minor modes (27/20: KINGSFOLD's "voice of
  // Je-sus", in the house hymn), re to la in the major (40/27) — and no
  // singer leaps a wolf. Where the memory leaps a fourth or a fifth within
  // a line (a breath between lines lets the singer take the next pitch from
  // the drone again) that the day's pitches make a wolf, one of the two
  // notes leans a syntonic comma and the leap rings pure: the one whose
  // leaned pitch is the simpler ratio over the keynote, the drone's nearer
  // kin — so te rises to 9/5 (not me falling to 32/27), and re falls to
  // 10/9, the choir's own ii re (not la rising to 27/16). A lean that takes
  // a note further from the drone than a hair is never taken (in practice
  // only re and te ever lean, as a just choir leans them: a note of the
  // drone's own chords never wavers); nor one that would sour the other
  // neighbour; a run of one note leans together (never a comma jump on a
  // repeated note). The law is unchanged — the day holds every note; the
  // lean is how a singer tunes the leap. No die is thrown.
  //   ms: the day's monzos, in the order sung; joined[i]: note i follows
  //   note i-1 in the same breath → the comma each leans (-1, 0, +1)
  var LEAN_HAIR = 0.5;                                  // how much further from the drone a lean may take a note (bits of Tenney height)
  function leanBy(m, c) { return c ? KOLOB.Pitch.mul(m, [COMMA[0] * c, COMMA[1] * c, COMMA[2] * c, 0]) : m; }
  function wolfLeap(a, b) {
    var d = KOLOB.Pitch.div(b, a), c = KOLOB.Pitch.cents(d);
    var semi = Math.round((((c % 1200) + 1200) % 1200) / 100) % 12;
    if (semi === 7) return !(d[1] === 1 && d[2] === 0 && d[3] === 0);       // a fifth: 3/2, or the wolf 40/27
    if (semi === 5) return !(d[1] === -1 && d[2] === 0 && d[3] === 0);      // a fourth: 4/3, or the wolf 27/20
    return false;
  }
  function tenney(m) {                                   // how far a pitch is from the drone: log2 of n·d
    var r = KOLOB.Pitch.octaveReduce(m);
    return Math.abs(r[0]) + Math.abs(r[1]) * Math.log2(3) + Math.abs(r[2]) * Math.log2(5) + Math.abs(r[3]) * Math.log2(7);
  }
  function leapLeans(ms, joined) {
    var lean = ms.map(function () { return 0; });
    function at(i) { return leanBy(ms[i], lean[i]); }
    function tied(i) { return !joined || !!joined[i]; }   // note i follows i-1 in one breath
    function same(i, j) { return ms[i].join() === ms[j].join() && lean[i] === lean[j]; }
    // a neighbour in the same breath that the lean would sour
    function sours(x, y, m, left) { return left ? wolfLeap(at(x), m) && !wolfLeap(at(x), at(y)) : wolfLeap(m, at(y)) && !wolfLeap(at(x), at(y)); }
    for (var i = 1; i < ms.length; i++) {
      if (!tied(i) || !wolfLeap(at(i - 1), at(i))) continue;
      var best = null;
      [i - 1, i].forEach(function (j) {
        if (lean[j]) return;                             // a note leans once
        var lo = j, hi = j;
        while (lo > 0 && tied(lo) && same(lo - 1, j)) lo--;
        while (hi < ms.length - 1 && tied(hi + 1) && same(hi + 1, j)) hi++;
        [-1, 1].forEach(function (c) {
          var m = leanBy(ms[j], c), ok = tenney(m) <= tenney(ms[j]) + LEAN_HAIR;
          // the leap it is for rings pure, and neither neighbour of the run sours
          if (j === i ? wolfLeap(at(i - 1), m) : wolfLeap(m, at(i))) ok = false;
          if (lo > 0 && lo - 1 !== i - 1 && tied(lo) && sours(lo - 1, lo, m, true)) ok = false;
          if (hi < ms.length - 1 && hi + 1 !== i && tied(hi + 1) && sours(hi, hi + 1, m, false)) ok = false;
          if (ok && (!best || tenney(m) < best.h - 1e-9)) best = { lo: lo, hi: hi, c: c, h: tenney(m) };
        });
      });
      if (best) for (var k = best.lo; k <= best.hi; k++) lean[k] = best.c;
    }
    return lean;
  }
  // The pool as the tune lab (shelved/tune-lab.php) reads it
  // (KolobAudio.getOldTunes): name, weight, minor, [[deg, beats]] of the
  // first line in the lab's register (it adds an octave), the Earth tune's
  // id and the modes the law lets it surface in.
  function oldTunePool() {
    var MODES = KOLOB.Pitch.MODE_NAMES;
    return earthTunes().map(function (h) {
      var ex = excerpt(h, 1), o = octaveFor(ex);
      return {
        id: h.id, name: String(h.nameEn || h.id).toLowerCase(), w: tuneWeight(h), minor: !!DARK[h.mode],
        notes: ex.map(function (n) { return [n.deg + 7 * o - 7, n.beats]; }),
        modes: MODES.filter(function (m) { return linesAdmitted(h, m) > 0; }),
      };
    });
  }

  // the far voice — a self-contained carrier for the memory: soft triangle
  // with a breath of octave, dulled by distance, at the field's edge, all
  // tail. Not one of the console's instruments; it has no stop. Its notes
  // are {f, dur, restAfter, breath, tell}; a line's end draws a breath (the
  // swell dips and comes back), a rest lets the sound down between lines.
  //
  // HOW IT SPEAKS (PLAN-COMPOSITION §15). Measured, a memory as loud as the
  // hymn (−25 dB in the 300 Hz–4 kHz band against the hymn's −28) that
  // could not say a repeated note — it glided into every note and dipped
  // only at breaths, so MARTYR's "Praise to the" (do–do–do) was one 1.8 s
  // swell, and 76 of the 367 steps in the tunes' first two lines are
  // repeated notes — was a second hymn, not a memory. So:
  //   · it sits OLD_TUNE_DB (−7 dB) under where it stood — a memory, not a
  //     second hymn;
  //   · every note is struck: the level dips for about 50 ms at each onset,
  //     a light lift between two pitches and a real re-strike (down to a
  //     fifth of itself) where a note repeats, so the rhythm of the book is
  //     heard — the dotted pickup, the repeated tones;
  //   · the glide into a new pitch is short (at most 60 ms, inside the dip),
  //     a voice placing its note, not a slide;
  //   · the first note speaks at once (an attack of 0.12 s, not a 1.2 s
  //     swell that swallowed the pickup), and the memory still fades as it
  //     goes.
  var OLD_TUNE_DB = -7;
  var ONSET_DIP = { lift: 0.62, restrike: 0.2, down: 0.03, up: 0.045 };
  function farVoice(t, notes, gainMul, side) {
    var o = S.ctx.createOscillator(); o.type = "triangle";
    var o2 = S.ctx.createOscillator(); o2.type = "sine";
    var g2 = S.ctx.createGain(); g2.gain.setValueAtTime(0.1, t);
    var lp = S.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(1200, t);
    var g = S.ctx.createGain();
    var pn = S.ctx.createStereoPanner(); pn.pan.setValueAtTime(side, t);
    o.connect(lp); o2.connect(g2); g2.connect(lp);
    lp.connect(g); g.connect(pn); pn.connect(wideSend());                    // the memory, at the field's edge: all tabernacle
    var tt = t, prevF = 0, dips = [], onsets = [];
    for (var i = 0; i < notes.length; i++) {
      var f = notes[i].f;
      if (i === 0) {
        o.frequency.setValueAtTime(f, t);
        o2.frequency.setValueAtTime(f * 2, t);
      } else {
        // a new pitch is placed inside the onset's dip; a repeated one is
        // struck again on the same pitch (not glided into)
        var same = Math.abs(f / prevF - 1) < 1e-4;
        if (!same) {
          var port = Math.min(0.06, notes[i].dur * 0.1);
          o.frequency.setValueAtTime(prevF, tt);
          o.frequency.linearRampToValueAtTime(f, tt + port);
          o2.frequency.setValueAtTime(prevF * 2, tt);
          o2.frequency.linearRampToValueAtTime(f * 2, tt + port);
        }
        // (an onset that follows a breath or a rest is already articulated)
        var prev = notes[i - 1];
        if (!(prev.breath || prev.restAfter > 0)) onsets.push({ at: tt, depth: same ? ONSET_DIP.restrike : ONSET_DIP.lift });
      }
      if (notes[i].tell) notes[i].tell(tt);
      prevF = f;
      tt += notes[i].dur;
      if (i < notes.length - 1 && (notes[i].breath || notes[i].restAfter > 0)) dips.push({ at: tt, rest: notes[i].restAfter || 0 });
      tt += notes[i].restAfter || 0;
    }
    var total = tt - t;
    // the swell: in at once, easing to 0.85 of itself, out over the last
    // 1.6 s — a breath at each line's end and a lift at each onset on the way
    var ATK = 0.12;
    var peak = 0.14 * Math.pow(10, OLD_TUNE_DB / 20) * (gainMul || 1);
    var relAt = t + ATK + Math.max(0.4, total - 1.5);
    function level(x) { return peak * (1 - 0.15 * Math.min(1, Math.max(0, (x - t - ATK) / Math.max(0.4, total - 1.5)))); }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + ATK);
    // the breaths and the onsets, in time order, never overlapping each other
    var marks = dips.map(function (d) { return { t0: d.at - 0.18, t1: d.at + d.rest + 0.22, breath: d }; })
      .concat(onsets.map(function (n) { return { t0: n.at - ONSET_DIP.down, t1: n.at + ONSET_DIP.up, onset: n }; }))
      .sort(function (a, b) { return a.t0 - b.t0; });
    var cursor = t + ATK;
    marks.forEach(function (m) {
      if (m.t0 <= cursor + 0.005 || m.t1 >= relAt - 0.05) return;         // nothing inside the attack, the fade, or another mark
      g.gain.linearRampToValueAtTime(level(m.t0), m.t0);
      if (m.breath) {
        var d = m.breath;
        g.gain.linearRampToValueAtTime(level(d.at) * (d.rest > 0 ? 0.12 : 0.35), d.at + Math.min(0.1, d.rest));
        if (d.rest > 0.25) g.gain.linearRampToValueAtTime(level(d.at) * 0.12, d.at + d.rest - 0.05);
      } else {
        g.gain.linearRampToValueAtTime(level(m.onset.at) * m.onset.depth, m.onset.at + 0.004);
      }
      g.gain.linearRampToValueAtTime(level(m.t1), m.t1);
      cursor = m.t1;
    });
    g.gain.linearRampToValueAtTime(peak * 0.85, relAt);
    g.gain.linearRampToValueAtTime(0, relAt + 1.6);
    o.start(t); o.stop(t + total + 2);
    o2.start(t); o2.stop(t + total + 2);
    return total;
  }

  function oldTuneRemembered(V, tc) {
    var R = stream("guest:oldtune");
    // every die first, whether it is used or not (SCORE §3)
    var tempoDie = R.rnd(TEMPO_MIN, TEMPO_MAX);  // its own remembered tempo: slower than the book's
    var twoDie = R.chance(0.5);                  // the second line too
    var dropDie = R.chance(0.5), dropAt = R.rnd(0, 1);
    var holdDie = R.chance(0.4), holdAt = R.rnd(0, 1);
    var againDie = R.chance(0.6), gapS = R.rnd(6, 10);
    var side = synth("oldtune").pick([-0.85, 0.85]);   // which edge of the field: sound-level
    var det = Math.pow(2, 8 / 1200);             // 8 cents sharp of true — worn
    var pick = V && V.tune, h = pick && KOLOB.Tunes && KOLOB.Tunes.byId(pick.id);
    if (!h) return 4;
    var t = tc + 0.6;
    var beatS = h.beatS * tempoDie;
    // a line, or two: two when the dice say so or the first alone is short
    // (a six-syllable line is half a thought), when the day holds the
    // second, and when the two are not so long that the memory outstays
    var one = excerpt(h, 1), two = pick.lines >= 2 ? excerpt(h, 2) : null;
    var nLines = two && (twoDie || beatsOf(one) * beatS < 9) && beatsOf(two) * beatS <= 26 ? 2 : 1;
    var notes = nLines === 2 ? two : one;
    var oct = octaveFor(notes);
    // seeded wear — never the first two notes; recognition lives in the head
    var dropped = null, held = null;
    if (dropDie && notes.length > 4) {
      var di = 2 + Math.floor(dropAt * (notes.length - 3));
      var gone = notes[di], keep = notes[di - 1];
      keep.beats += keep.restAfter + gone.beats;  // a note dropped, its neighbour held wrong in its place
      keep.restAfter = gone.restAfter; keep.breath = gone.breath;
      notes.splice(di, 1);
      dropped = gone.index + (gone.line ? "@" + gone.line : "");
    }
    if (holdDie && notes.length > 2) {
      var hi = 2 + Math.floor(holdAt * (notes.length - 2));
      notes[hi].beats *= 1.6;
      held = notes[hi].index + (notes[hi].line ? "@" + notes[hi].line : "");
    }
    var perf = KOLOB.Score.performance({
      hymnId: h.id, verse: 0, practice: "hummed", tempoMul: tempoDie, rubato: 0, organ: null, singers: [],
      // (the performance's own fields: which lines, the octave it is set in, the wear, the worn tuning)
      lines: nLines === 2 ? [0, 1] : [0], octave: oct, beatS: beatS, wear: { dropped: dropped, held: held }, detuneCents: 8,
    });
    // each note, as the far voice sings it: its pitch the day's own for its
    // degree (the law made sure), set an octave `oct` from where it is
    // written — and a leap the day would sing as a wolf, sung pure (each try
    // is tuned as it is sung: the head alone leaps only what the head leaps)
    function sung(ns, try2) {
      var idxs = ns.map(function (n) { return projDeg(n.deg + 7 * oct); });
      var ms = idxs.map(function (idx) { return KOLOB.Pitch.degMonzo(S.mode, idx); });
      var lean = leapLeans(ms, ns.map(function (n, i) { return i > 0 && n.line === ns[i - 1].line; }));
      return ns.map(function (n, i) {
        var d = n.deg + 7 * oct, c = lean[i];
        var f = degFreq(idxs[i]) * det * (c ? Math.pow(81 / 80, c) : 1), dur = n.beats * beatS;
        return {
          f: f, dur: dur, restAfter: try2 ? 0 : n.restAfter * beatS, breath: !try2 && n.breath,
          tell: function (at) {
            emitNote("oldtune", f, at, dur, guestNote(V, "oldtune", { part: h.melodyPart, hymnId: h.id, line: n.line, index: n.index, beat: n.beat,
                                                                      deg: d, monzo: leanBy(ms[i], c), comma: c, tryNo: try2 ? 2 : 1 }));
          },
        };
      });
    }
    var dur1 = farVoice(t, sung(notes, false), 1.0, side);
    var total = dur1;
    tell(V, { type: "guest", guest: "oldtune", stage: "remembered", tune: h.id, nameDs: h.nameDs, section: S.Meeting.section(), lines: nLines, performance: perf });
    if (againDie) {
      // a fainter second try — the head only, trailing off
      var head = notes.slice(0, Math.min(5, notes.length - 1));
      var t2 = t + dur1 + gapS;
      var dur2 = farVoice(t2, sung(head, true), 0.6, side);
      total = dur1 + gapS + dur2;
      cueAt("guests", t2 + dur2, function () {
        tell(V, { type: "guest", guest: "oldtune", stage: "gives-out", tune: h.id });
      });
    }
    return total + 4;
  }

  // ==========================================================================
  // THE TROMBONE CHOIR AT DAWN (PLAN-COMPOSITION §14, item 3). In
  // Bethlehem the Moravians' trombones climb the belfry to play chorales
  // down onto the sleeping town; in Salem the Easter sunrise begins with
  // brass choirs in different streets, playing a hymn to one another, a
  // phrase here and the next phrase there. The colony keeps the custom. The
  // plan drew the moment and wrote the chorale (the day's first hymn, as
  // Harmony sets the day's theme — see dawnChorale in kolob-meeting.js); the
  // guest's own room (kolob-guest-trombones.js) places the two choirs, one
  // far across the settlement and one near on the other side, through the
  // guests' door into the tabernacle. Here it is played at t and told:
  //   · the far choir's first call    — ♪ trombones at dawn
  //   · the near choir's first answer — ♪ the near choir answers
  //   · the far choir joining the last chord, when it does
  //                                   — ♪ the two choirs together
  // Its notes are reported on their own layer (trombones), named as the
  // guest's; the staff does not engrave them (a visitor's, like the old
  // tune's). It claims the air for its length, and the organ, the harmonium
  // and the strings rest their hands while it sounds (S.hallListens): the
  // first hymn is heard before anyone sings it.
  // ==========================================================================
  // (a deferred phrase of a guest asks whether its meeting still stands: a
  // new meeting's plan seats new guests, and the old one's go unplayed)
  function C_live(V) { var g = S.Meeting.guests(); return V && V.stream && g.some(function (x) { return x.type === V.type && x.fired; }) && S.Meeting.meetingNum() === V.meetingNum; }
  function trombonesAtDawn(V, tc) {
    V.meetingNum = S.Meeting.meetingNum();
    var G = KOLOB.GuestTrombones;
    if (!G || !V || !V.material || !V.stream) return 4;
    var calls = [];                               // [stage, t, side] — the rows told
    // a stage's row, told at its phrase's first sound (the far choir's first
    // call at once: it is now)
    function call(stage, t0, side) {
      var c = [stage, t0, side];
      calls.push(c);
      function say() {
        tell(V, { type: "guest", guest: "trombones", stage: c[0], side: c[2], section: S.Meeting.section(), hymnId: V.fromHymn || null });
      }
      if (c[1] <= S.now() + 1e-6) say();
      else cueAt("guests", c[1], say);
    }
    // (the dawn is laid out a phrase at a time, on the guests' lane, each
    // phrase 2.5 s before it sounds — not the whole dawn in this cue: a
    // composed hymn's dawn cost 390 ms laid out at once; each
    // phrase's notes are reported, and its row told, as it is laid out)
    var end = G.perform(S.ctx, wideSend(), tc, V.material, V.stream, {
      defer: function (at, fn) {
        cueAt("guests", at, function () { if (S.playing && C_live(V)) fn(); });
      },
      onNote: function (x) {
        emitNote("trombones", x.freq, x.t, x.dur, guestNote(V, "trombones", { part: x.part, choir: x.choir, line: x.line, loud: x.loud, hymnId: V.fromHymn || null }));
      },
      onPhrase: function (ph) {
        var side = ph.pan < 0 ? "west" : "east";
        if (ph.joins) call("together", ph.t0, side);
        else if (ph.choir === "far" && !calls.some(function (c) { return c[0] === "far"; })) call("far", ph.t0, side);
        else if (ph.choir === "near" && !calls.some(function (c) { return c[0] === "answer"; })) call("answer", ph.t0, side);
      },
    });
    claimAir(end - tc, 3);
    // the span: the choirs' last chord, and the town's air a moment after it
    return end - tc + 2;
  }

  // ==========================================================================
  // THE GUESTS WHO STAND IN THE ROOM (PLAN-COMPOSITION §15 items 3 and 5):
  // the ward's HANDBELL CHOIR and the
  // SINGING SCHOOL (experimental). Each plans and plays itself (kolob-guest-
  // handbells.js, kolob-guest-singingschool.js: pure plans, their own
  // streams guest:<name>:<n>); the meeting seats them (kolob-meeting.js) and
  // cues them at their moment, with their material made ready (the day's
  // hymn, as the composer wrote it). This is the glue: their sound laid out
  // a slice at a time on the guests' lane of the engine's clock (hooks.defer
  // — never the whole piece inside one cue), their notes reported as they
  // are laid out, their moments told as they come. They are IN the chapel:
  // the bells stand a step nearer than
  // the ward, in both rooms (S.seatedSend("handbells")), and the practice is
  // the ward's own choir, into the choir's layer (S.seatedSend("choir")) —
  // not the tabernacle's wide send the visitors from outside take.
  // ==========================================================================
  var BELL_ROWS = { ring: 1, "verse2": 1, "round-entry": 1, cascade: 1 };
  function standingGuest(V, tc, G, name, layer, noteOf) {
    V.meetingNum = S.Meeting.meetingNum();
    if (!G || !V || !V.material || !V.stream) return 4;
    var told = {}, first = true;
    function say(stage, st) {
      if (told[stage]) return;
      told[stage] = true;
      var ev = { type: "guest", guest: name, stage: stage, section: S.Meeting.section(), hymnId: V.material.hymnId || null };
      if (V.experimental) ev.experimental = true;
      if (st.t0 <= S.now() + 1e-6) tell(V, ev);
      else cueAt("guests", st.t0, function () { if (S.playing && C_live(V)) tell(V, ev); });
    }
    var end = G.perform(S.ctx, S.seatedSend(layer), tc, V.material, V.stream, {
      defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing && C_live(V)) fn(); }); },
      onNote: noteOf,
      onStage: function (st) {
        // (the bells: their first sound, whatever it rings, is their row;
        // then the second setting, a round's first entry, the cascade)
        // (a guest that names its rows — the gift of tongues' ROWS — tells
        // only those; the rest are its own)
        if (name === "handbells") {
          if (first) { first = false; say("ring", st); }
          if (BELL_ROWS[st.stage] && st.stage !== "ring") say(st.stage, st);
        } else if (G.ROWS) { if (G.ROWS[st.stage]) say(st.stage, st); }
        else say(st.stage, st);
      },
    });
    claimAir(end - tc, 3);
    return end - tc + 2;
  }
  function handbellsRing(V, tc) {
    var G = KOLOB.GuestHandbells;
    if (!KOLOB.VoicesFolk) return 4;
    return standingGuest(V, tc, G, "handbells", "handbells", function (x) {
      emitNote("handbells", x.freq, x.t, x.dur, guestNote(V, "handbells", { part: x.part, role: x.role, ringer: x.ringer, bell: x.bell, tech: x.tech, pan: x.pan, loud: x.loud, reached: !!x.reached, rings: V.material.hymnId || null }));
    });
  }
  function singingSchool(V, tc) {
    var G = KOLOB.GuestSingingSchool;
    if (!KOLOB.VoicesVocal) return 4;
    return standingGuest(V, tc, G, "singingschool", "choir", function (x) {
      emitNote(x.layer || "choir", x.freq, x.t, x.dur, guestNote(V, "singingschool", { part: x.part, stage: x.stage, wrong: !!x.wrong, rehearses: V.material.hymnId || null }));
    });
  }

  // ==========================================================================
  // THE GUESTS FROM OUTSIDE THE WINDOWS (PLAN-COMPOSITION §8.2, §8.10,
  // §8.11): the NAUVOO BRASS BAND marching past with one of the day's
  // hymns as a march, the HANDCART COMPANY singing ALL IS WELL far across the
  // fields, and the GULLS quoting the first hymn. Each plans and plays
  // itself (kolob-guest-bands.js, kolob-guest-handcart.js,
  // kolob-guest-gulls.js: pure plans, their own streams guest:<type>:<n>);
  // the meeting seats and cues them with their material; this is the glue:
  // their sound laid out a bar, a line or a few seconds at a time on the
  // guests' lane (hooks.defer), their notes reported as they are laid out,
  // their moments told when they come. They are OUTSIDE: into the
  // tabernacle's wide send, as every visitor from the town is.
  // ==========================================================================
  function outdoorGuest(V, tc, G, rows, noteOf, claim) {
    V.meetingNum = S.Meeting.meetingNum();
    if (!G || !V || !V.material || !V.stream) return 4;
    var end = G.perform(S.ctx, wideSend(), tc, V.material, V.stream, {
      defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing && C_live(V)) fn(); }); },
      onNote: noteOf,
      onStage: function (st) {
        if (st.dev || !rows[st.stage]) return;
        var ev = { type: "guest", guest: V.type, stage: st.stage, side: st.side || null, section: S.Meeting.section() };
        if (st.band != null) ev.band = st.band;
        if (st.stage === "cross") ev.both = !!st.both;   // two bands crossing, or one going by: the minutes' row reads it
        if (st.t0 <= S.now() + 1e-6) tell(V, ev);
        else cueAt("guests", st.t0, function () { if (S.playing && C_live(V)) tell(V, ev); });
      },
    });
    // (the company is listened to: the melodic voices find the air taken;
    // the band and the gulls take no air — the meeting carries on)
    if (claim) claimAir(end - tc, 3);
    return end - tc + 1;
  }
  function nauvooBand(V, tc) {
    return outdoorGuest(V, tc, KOLOB.GuestBands, { approaches: 1, second: 1, cross: 1, passes: 1 }, function (x) {
      // (beat: the march's beat in seconds, as the page has always read a
      // band's note; beatInBar and bar, and downbeat on each bar's oom; each
      // band's notes carry its own hymn — a second band's are its own)
      emitNote("band", x.freq, x.t, x.dur, guestNote(V, "bands", { part: x.part, beat: x.beatS, bar: x.bar, beatInBar: x.beat, downbeat: x.downbeat,
        doubling: x.doubling, band: x.band, strain: x.strain, meter: x.meter, loud: x.loud, hymnId: x.hymnId || V.material.hymnId || null }));
    }, false);
  }
  function handcartCompany(V, tc) {
    return outdoorGuest(V, tc, KOLOB.GuestHandcart, { approaches: 1, sings: 1, passes: 1 }, function (x) {
      emitNote("handcart", x.freq, x.t, x.dur, guestNote(V, "handcart", { part: x.part, voice: x.voice, verse: x.verse, line: x.line, beat: x.beat, syl: x.syl, octave: x.octave, loud: x.loud, hymnId: "earth:all-is-well" }));
    }, true);
  }
  function gullsOver(V, tc) {
    return outdoorGuest(V, tc, KOLOB.GuestGulls, { gulls: 1 }, function (x) {
      emitNote("gulls", x.freq, x.t, x.dur, guestNote(V, "gulls", { part: x.part, index: x.index, deg: x.deg, monzo: x.monzo, loud: x.loud, hymnId: V.material.hymnId || null }));
    }, false);
  }

  // ==========================================================================
  // THE ORGANIST'S VARIATIONS AND THE FAR TOWER (PLAN §8.5, §8.3).
  // VARIATIONS ON A HYMN: the set on the organist's own
  // desk — one organ throughout (organistPlays: the organ's case, the organ
  // layer, its notes told in the Score's terms), at the prelude's level (no
  // lift under a ward: nobody sings); a hymn keyed away from home steps the
  // drone back under it, as the chorale prelude does.
  // ==========================================================================
  function organistVariations(V, tc) {
    V.meetingNum = S.Meeting.meetingNum();
    var G = KOLOB.GuestVariations, org = S.Meeting.organist();
    if (!G || !V.material || !org || !S.organistPlays) return 4;
    var t0 = tc + 0.1, M = V.material, until = t0 + M.dur;
    if (!isHome(M.keyMonzo)) S.droneStepBack(t0, until, 0.22, 3, 6);
    var end = G.perform(S.ctx, null, t0, M, V.stream, {
      organist: function (plan, at) {
        S.organistPlays(plan, at, { hymnId: M.hymnId, key: M.keyMonzo, variations: true, style: org.style,
                                    alive: function () { return !!S.playing && S.Meeting.meetingNum() === V.meetingNum && S.Meeting.section() === V.section; } });
      },
      onStage: function (st) {
        var ev = { type: "guest", guest: "variations", stage: st.stage, section: S.Meeting.section(), hymnId: M.hymnId, keys: st.keys, regs: st.regs };
        if (st.t0 <= S.now() + 1e-6) tell(V, ev); else cueAt("guests", st.t0, function () { if (S.playing && C_live(V)) tell(V, ev); });
      },
    });
    claimAir(end - tc, 3);
    return end - tc + 2;
  }
  // CHANGE RINGING FROM A FAR TOWER: the meetinghouse bell's first word (the
  // steeples' own dice, drawn in the steeples' own order: the span, then the
  // bell), a band across the valley ringing changes into the wide send, and
  // the meetinghouse bell's last word as the tower stands
  function changesRing(V, tc) {
    V.meetingNum = S.Meeting.meetingNum();
    var G = KOLOB.GuestChanges, R = stream("guest:steeples"), Y = synth("steeples"), t = tc + 0.3;
    R.rnd(45, 75);                                            // (the steeples' span, drawn as ever)
    var homeBase = harm(R.pick([4, 5, 6]));
    while (homeBase > 700) homeBase /= 2; while (homeBase < 300) homeBase *= 2;
    var hg = 0.6 * getLayerParam("bells", "ring", 0.55);
    bellStrike(t, hg, homeBase, panAt("bells", Y.rnd(-0.2, 0.2)), { hum: true });
    emitNote("bells", 0, t, BELL_RING_S, guestNote(V, "steeples"));
    var day = S.Meeting.day ? S.Meeting.day() : null;
    var mat = G.prepare({ keynoteHz: S.F0 * S.ROOT_MULT, sunday: day ? day.id : null }, V.stream), t1 = t + V.changes.at;
    var end = G.perform(S.ctx, wideSend(), t1, mat, V.stream, {
      defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing && C_live(V)) fn(); }); },
      onNote: function (x) {
        emitNote("tower", x.freq, x.t, x.dur, guestNote(V, "steeples", { part: "tower", bell: x.bell, place: x.place, row: x.row, hand: x.hand, muffled: x.muffled, monzo: x.monzo, changes: true }));
      },
      onStage: function (st) {
        var ev = { type: "guest", guest: "steeples", stage: "changes:" + st.stage, method: mat.methodName, touch: mat.touch, muffled: mat.muffled };
        if (st.t0 <= S.now() + 1e-6) tell(V, ev); else cueAt("guests", st.t0, function () { if (S.playing && C_live(V)) tell(V, ev); });
      },
    });
    var tl = G.score(mat, V.stream, t1).lastStrike + 3;
    cueAt("guests", tl - 2.5, function () {
      if (!S.playing || !C_live(V)) return;
      bellStrike(tl, hg * 0.9, homeBase, panAt("bells", Y.rnd(-0.2, 0.2)), { hum: true });
      emitNote("bells", 0, tl, BELL_RING_S, guestNote(V, "steeples"));
    });
    return Math.max(end, tl + BELL_RING_S) - tc;
  }

  // THE GIFT OF TONGUES (PLAN §8.6): a
  // standing guest, as the handbells are — one of the ward rises in the
  // testimony and sings; into the choir's layer, where the singing school's
  // calibration stands; its own reed answers (the house's harmonium sits it
  // out when the rite's seating has no harmonium)
  function tonguesGift(V, tc) {
    var G = KOLOB.GuestTongues;
    if (!G || !KOLOB.VoicesVocal) return 4;
    if (!V.material) {
      var ward = S.Meeting.ward ? S.Meeting.ward() : null;
      V.material = { mode: S.mode, keynoteHz: S.F0 * S.ROOT_MULT, house: S.Meeting.house ? S.Meeting.house() : null, ward: ward,
                     singer: V.singer || (ward && G.singerOf ? G.singerOf(V.seat, ward) : null),
                     harmonium: S.Meeting.sits && S.Meeting.sits("harmonium") ? false : undefined };
    }
    var span = standingGuest(V, tc, G, "tongues", "choir", function (x) {
      emitNote(x.layer, x.freq, x.t, x.dur, guestNote(V, "tongues", { part: x.part, member: x.member, role: x.role, deg: x.deg, monzo: x.monzo, wordDs: x.wordDs, slur: x.slur }));
    });
    // (the singer rises: their own row in the minutes, by name — a cast event
    // at the score's moment, as the testimony-bearers' are)
    var who = V.material.singer, w = V.material.ward, m = who && w && w.byId ? w.byId[who] : null, rise = null;
    try { (G.score(V.material, V.stream, tc).stages || []).forEach(function (st) { if (st.stage === "rises" && rise == null) rise = st.t0 != null ? st.t0 : st.t; }); }
    catch (e) { rise = null; S.confess("the gift of tongues' score could not be read (the singer's rising goes untold)", e); }
    if (m && rise != null) cueAt("guests", Math.max(rise, S.now()), function () {
      if (!S.playing || !C_live(V)) return;
      tell(V, { type: "cast", memberId: who, nameDs: m.nameDs || "", action: "rises and sings in tongues", role: m.role || null,
                actionDs: KOLOB.Cast && KOLOB.Cast.ACTION_DS ? KOLOB.Cast.ACTION_DS["rises and sings in tongues"] || null : null });
    });
    return span;
  }
  // THE SOCIAL HALL (PLAN §8.9): after the
  // benediction the benches are pushed back — the fiddle (a step nearer than
  // the ward), the dancers' floor, the caller at the ward's near seat; the
  // house lets go and listens, and the drone steps back for the dance (the
  // fiddle brings its own, on the dance's tonic) and returns under the
  // applause. The minutes: the benches, the honour, the strains, the final,
  // the applause; and the fiddler and the caller come forward (cast)
  var HALL_ROWS = { benches: 1, honour: 1, A: 1, B: 1, final: 1, applause: 1 };
  function socialHall(V, tc) {
    var G = KOLOB.GuestSocialHall;
    if (!G || !KOLOB.VoicesFolk || !KOLOB.VoicesVocal || !V.material) return 4;
    V.meetingNum = S.Meeting.meetingNum();
    var told = {}, sc = G.score(V.material, V.stream, tc), clap = null;
    sc.stages.forEach(function (st) { if (st.stage === "applause" && clap == null) clap = st.t0; });
    var end = G.perform(S.ctx, S.seatedSend("fiddle"), tc, V.material, V.stream, {
      dests: { fiddle: S.seatedSend("fiddle"), floor: S.seatedSend("floor"), caller: S.seatedSend("choir-near") },
      defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing && C_live(V)) fn(); }); },
      onNote: function (x) {
        emitNote(x.layer, x.freq, x.t, x.dur, guestNote(V, "socialhall", { part: x.part, strain: x.strain, time: x.time, line: x.line, bar: x.bar,
          deg: x.deg, monzo: x.monzo, septimal: !!x.septimal, orn: x.orn || null, member: x.member || null, call: x.call || null,
          // (the hymn danced is named `dances`, not hymnId: the caller's calls are on
          // the choir's layer, and a hymnId there is the ward singing that hymn — as
          // the singing school's notes say `rehearses`)
          dances: V.material.hymnId || null }));
      },
      onStage: function (st) {
        if (!HALL_ROWS[st.stage] || told[st.stage]) return;
        told[st.stage] = true;
        var ev = { type: "guest", guest: "socialhall", stage: st.stage, section: S.Meeting.section(), hymnId: V.material.hymnId || null };
        if (st.t0 <= S.now() + 1e-6) tell(V, ev); else cueAt("guests", st.t0, function () { if (S.playing && C_live(V)) tell(V, ev); });
      },
      onCast: function (c) {
        cueAt("guests", Math.max(c.t, S.now()), function () {
          if (!S.playing || !C_live(V)) return;
          tell(V, castEvent(c, S.Meeting.ward ? S.Meeting.ward() : null));
        });
      },
    });
    // (the drone steps back from the benches to the applause, and returns under it)
    S.droneStepBack(tc, clap != null ? clap : end - 4, 0.18, 3, 4);
    claimAir(end - tc, 3);
    return end - tc + 2;
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.castEvent = castEvent;
  S.razzCluster = razzCluster;
  S.cumulativeAssembly = cumulativeAssembly;
  S.steeplesAnswer = steeplesAnswer;
  S.oldTunePool = oldTunePool;
  S.oldTuneCandidates = oldTuneCandidates;
  S.oldTuneRemembered = oldTuneRemembered;
  S.trombonesAtDawn = trombonesAtDawn;
  S.handbellsRing = handbellsRing;
  S.singingSchool = singingSchool;
  // (the set pieces of the guests with rooms of their own)
  S.nauvooBand = nauvooBand;
  S.handcartCompany = handcartCompany;
  S.gullsOver = gullsOver;
  S.organistVariations = organistVariations;
  S.tonguesGift = tonguesGift;
  S.socialHall = socialHall;
  // the room's public face on the KOLOB namespace (dev: nothing on the page
  // reads it; the labs may. The old tune's law and excerpt are here for
  // them: linesHeld(tune, mode), linesAdmitted(tune, mode), excerpt(tune, k),
  // octaveFor(notes), leapLeans(monzos, joined), wolfLeap(a, b))
  KOLOB.Guests = {
    cumulativeAssembly: cumulativeAssembly, steeplesAnswer: steeplesAnswer,
    oldTuneRemembered: oldTuneRemembered, oldTuneCandidates: oldTuneCandidates, oldTunePool: oldTunePool, trombonesAtDawn: trombonesAtDawn,
    handbellsRing: handbellsRing, singingSchool: singingSchool, nauvooBand: nauvooBand, handcartCompany: handcartCompany, gullsOver: gullsOver,
    organistVariations: organistVariations, changesRing: changesRing, tonguesGift: tonguesGift, socialHall: socialHall,
    linesHeld: linesHeld, linesAdmitted: linesAdmitted, excerpt: excerpt, octaveFor: octaveFor, leapLeans: leapLeans, wolfLeap: wolfLeap,
    MIN_MEMORY_S: MIN_MEMORY_S, TEMPO_MIN: TEMPO_MIN,
  };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-guests.js"] = true;   // the load guard's roll call
})();
