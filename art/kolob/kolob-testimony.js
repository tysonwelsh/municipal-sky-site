// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE TESTIMONY-BEARERS SPEAK (KOLOB.Testimony)
//
// In 1988 Steve Reich put a string quartet beside three voices: his
// governess Virginia, the Pullman porter Lawrence Davis, and people who had
// ridden other trains in the same years, in Europe. He cut their speech into
// phrases and wrote down the melody each phrase already had — the pitches
// and the rhythm of a person saying "from Chicago to New York" — and the
// quartet played those melodies with the voices, and after them, until the
// speech was music and the music was still speech (Different Trains).
//
// A testimony meeting is made of speech. On a fast Sunday, and on others,
// the pulpit is left open and whoever feels to rises from the pews and
// bears testimony: a few sentences, plain, often halting, spoken to the
// ward. At the rim of Kolob's light two or three of the Sunday's ward rise
// (kolob-cast.js seats them: the widow, the returned missionary, the young
// father, the old pioneer, the quick bright teenager, the Relief Society
// sister, the farmer of few words, the Primary teacher), one at a time,
// with the testimony's stillness between them. Each SPEAKS — a speech-
// melody on their own voice, the pitch of a person talking (not singing):
// rising into the stressed syllables and falling off them, a line that
// drifts down across a sentence, the last syllable falling to rest or
// lifting into a question; vowels and soft consonants only, no English —
// and the parlor's HARMONIUM, or the deacon's CLARINET, takes the melody up.
//
// EACH BEARER'S ARC (Reich's, in small):
//   · they rise (the pew creaks; two steps to the stand);
//   · the first sentence alone — and, a breath after it, the reed plays it
//     back, the speech's own pitches (the nearest of the day's just scale)
//     in the speech's own rhythm: you hear the melody that was in it;
//   · the next sentence with the reed doubling it as it is spoken, a
//     hair behind the lips;
//   · (a speaker of more words) another, and the reed takes it up twice:
//     as spoken, and then AS A TUNE — its rhythm drawn to a pulse, the
//     stressed syllables on the beats, closing on the key's own chord —
//     the words become music;
//   · they sit down.
// Every speaker's contour is their own: their voice (the ward's: part, age,
// timbre), their pace (syllables a second), their compass, their shape (the
// widow's falls, the teenager's lifts at every end, the missionary's arches)
// and their pauses — all from the cast (ROSTER.testimony's habits).
//
// THE MOTIF ENGINE MAY ANSWER. Each tune the reeds make of a speaker's words
// is handed back (score().answers, hooks.onAnswer) as a motif — degrees and
// beats — for the meeting to post to the melodic ledger (the clarinet or the
// choir may quote the testimony later: PLAN §5.5, the speaker whose speech
// becomes the theme).
//
// PURE PLANNING. plan(), decide(), prepare(), speech() and score() touch no
// AudioContext, DOM, clock or Math.random; every die comes from the stream
// passed in (guest:testimony:<n>), on forks: "seat" (the odds, the moment),
// "shape" (who rises, in what order, on which reed), "speech:<k>" (bearer
// k's sentences: their syllables, stresses, pitches), "reed:<k>" (how the
// reed plays them) and "synth" (the creaks, the reeds' breath: sound-level,
// never reported).
//
// Public surface: window.KOLOB.Testimony
//   plan(meetingInfo, stream) → { guest: "testimony", seat: "testimony",
//        section, at, dur, holdUntil, bearers, estimated, odds, logged: true } | null
//     meetingInfo: { n, kind, sunday?, sections: [{type, dur}], guests:
//       [{type, section}], bearers? ([lo, hi] | n), material?, force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   prepare(material, stream) → the testimonies, ready (pure; itself material)
//     material = { ward (KOLOB.Cast's), keynoteHz, keyMonzo?, mode?, sunday?,
//                  silenceMul?, droneMonzo? (the drone's note, relative to the
//                  keynote: the reed's scale takes its pitch for that letter) }
//   speech(habit, voice, stream, opts) → one sentence's syllables (pure)
//   score(material, stream, t0) → the whole as data (pure)
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { onNote({layer, freq, t, dur, part, member, deg, monzo,
//              speech, instrument}), onStage({stage, t0, t1, label, member}),
//              onCast({memberId, nameDs, action, t}), onAnswer({t, memberId,
//              instrument, motif}), defer(at, fn), dests: {speaker,
//              harmonium, clarinet} }
//   ODDS, NAME, LABEL, LEVEL, REEDS
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Testimony = (function () {
  "use strict";

  var NAME = "testimony";
  var LABEL = "guest:testimony:";                 // + the meeting number

  // ==========================================================================
  // THE ODDS — the testimony is theirs, nearly always: the bearers the cast
  // seats rise wherever the meeting keeps its testimony, unless a guest
  // already holds it (the old tune remembered there) — a few Sundays in ten
  // the ward keeps the silence instead, and the house plays on (the
  // seatings of §7.4: lined out, the arbor, the choir alone)
  // ==========================================================================
  var ODDS = {
    base: 0.82,
    weight: {
      ordinary: 1, conference: 0.9, jubilee: 1, fast: 1.25,
      pioneer: 1, christmas: 0.95, easter: 1, wedding: 0.9, funeral: 1.15, dedication: 0.9,
    },
    cap: 1,
  };
  var AT = [3, 7];                                // s into the testimony: the rite settles first
  // THE LEVEL (the testimony's bus), measured against the guests lab's
  // organ reference (the loudest 3 s, as seated): the stillest rite of the
  // morning, and a person speaking — the speaker's loudest near −3.5 LU,
  // the reed a little under the voice, the whole about −2 at its fullest
  var LEVEL = 0.6;

  function oddsFor(info) {
    var w = ODDS.weight;
    var k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1));
  }
  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.Testimony: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function nBearers(info, u) {
    var b = info.bearers;
    if (typeof b === "number") return b;
    if (Array.isArray(b)) return b[0] + Math.floor(u * (b[1] - b[0] + 1));
    return u < 0.5 ? 2 : 3;
  }
  // (without the speeches: a bearer about 32 s, the stillness between 5)
  function estimate(n) { return n * 32 + (n - 1) * 5 + 2; }

  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), atU = rs.next(), nU = rs.next();              // DICE: every die, first, whether or not the testimony is seated — deliberate; must stay
    var p = oddsFor(info), why = null;
    var order = (info.sections || []).map(function (s) { return s && s.type; });
    var held = null;
    (info.guests || []).forEach(function (g) { if (g && g.section === "testimony" && !held) held = g.type || "a guest"; });
    if (order.indexOf("testimony") < 0) why = "no testimony today";
    else if (held) why = "the testimony is the " + held + "'s";
    else if (!(info.force || roll < p)) why = "the ward keeps the silence";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var at = AT[0] + (AT[1] - AT[0]) * atU;
    var mat = info.material && info.material.prepared ? info.material : null;
    var n = mat ? mat.bearers.length : nBearers(info, nU);
    var dur = mat ? score(mat, stream, 0).end : estimate(n);
    return {
      seat: {
        guest: NAME, seat: "testimony", section: "testimony", at: +at.toFixed(2), dur: +dur.toFixed(2),
        holdUntil: +(at + dur + 4).toFixed(2),        // the testimony lasts at least this long
        bearers: n, estimated: !mat, odds: +p.toFixed(3), logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // SPEECH (pure) — one sentence of a bearer's, as a person says it
  // ==========================================================================
  // A speaking voice sits well under a singing one: a man's about 100–130 Hz,
  // a woman's 180–220; age lowers a woman's a little and lifts a man's.
  var SPEAK_HZ = { S: 210, A: 188, T: 124, B: 104, child: 265 };
  function speakingHz(voice) {
    var part = (voice && voice.part) || "T", hz = SPEAK_HZ[part] || 124, woman = part === "S" || part === "A";
    if (voice && voice.age === "old") hz *= woman ? 0.92 : 1.05; else if (voice && voice.age === "young") hz *= 1.05;
    return hz * Math.pow(2, ((voice && voice.pitchHabitCents) || 0) / 1200);
  }
  // the syllables: open vowels carry the stresses, the weak ones are the
  // mouth half-closed (kolob-voices-vocal.js SPOKEN: vowels, m and l — no hiss)
  var STRESSED_V = [["ah", 3], ["oh", 2], ["eh", 2], ["ma", 2], ["mo", 1.5], ["la", 2], ["lo", 1.5], ["moo", 0.6], ["loo", 0.6]];
  var WEAK_V = [["eh", 3], ["ee", 2], ["meh", 2], ["leh", 2], ["lee", 1.5], ["mi", 1], ["ah", 1], ["oo", 0.8]];
  function st(x) { return Math.pow(2, x / 12); }                        // semitones → a ratio
  // speech(habit, voice, R, opts) → { syllables: [{vowel, dur, f, glide,
  //   stress, accent, p (semitones re the speaker's base: the pitch heard)}
  //   | {rest, dur}], dur, base }
  //   habit: { rate (syllables a second), range (semitones), contour:
  //     falling | arch | rising, pauses (s) } — the cast's ROSTER.testimony
  //   opts: { last (the testimony's last sentence: it comes to rest) }
  function speech(habit, voice, R, opts) {
    opts = opts || {};
    var rate = habit.rate || 3, range = habit.range || 5, shape = habit.contour || "arch", base = speakingHz(voice);
    var n = Math.max(5, Math.min(16, Math.round(rate * R.rnd(2.1, 3.9))));
    // WORDS: one to three syllables, one stressed (a monosyllable now and then not)
    var syl = [];
    while (syl.length < n) {
      var wl = Math.min(n - syl.length, R.pickW([[1, 3], [2, 4], [3, 2]])), sAt = R.chance(0.65) ? 0 : 1, lone = R.chance(0.55);
      for (var j = 0; j < wl; j++) syl.push({ stressed: j === Math.min(sAt, wl - 1) && (wl > 1 || lone), word: j === 0 });
    }
    // a breath inside a long sentence, at a word's edge past its middle
    var cut = -1;
    if (n >= 9) for (var c = Math.floor(n * 0.45); c < n - 3; c++) if (syl[c].word) { cut = c; break; }
    // THE LINE: a declination across the sentence; the accents on the
    // stressed syllables, placed by the speaker's shape; the weak syllables
    // near the line, leaning toward the next accent
    // (a phrase carries a few pitch accents, not one on every stress: the
    // first stressed syllable and the last — the nucleus — always, the
    // others two times in five; a stress left unaccented is longer and
    // louder, and only a little higher. Every stress accented is a chant.)
    var decl = R.rnd(1.2, 2.8), accents = [], stressed = [];
    syl.forEach(function (s, i) { if (s.stressed) stressed.push(i); });
    if (!stressed.length) { syl[0].stressed = true; stressed.push(0); }
    stressed.forEach(function (i, k) { var keep = R.chance(0.4); if (k === 0 || k === stressed.length - 1 || keep) accents.push(i); });
    var hts = accents.map(function (ai, k) {
      var x = accents.length > 1 ? k / (accents.length - 1) : 0.5, h;
      if (shape === "falling") h = range * (0.95 - 0.45 * x);
      else if (shape === "rising") h = range * (0.55 + 0.1 * Math.sin(Math.PI * x));
      else h = range * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, x * 0.9 + 0.1)));
      return h * R.rnd(0.95, 1.3);
    });
    var pitch = syl.map(function (s, i) {
      var line = -decl * i / Math.max(1, n - 1), ak = accents.indexOf(i);
      if (ak >= 0) return line + hts[ak];
      // (a weak syllable sits near the line: the accents stand 2.5–5
      // semitones over it in a speaker of middling compass, as emphatic
      // speech does; the one before an accent leans up toward it)
      var nx = accents.filter(function (a) { return a > i; })[0], lean = nx != null && nx - i === 1 ? 0.12 : 0;
      return line + range * (lean + (s.stressed ? 0.12 : 0) + R.rnd(0, 0.08));
    });
    // THE ENDS: a phrase that goes on lifts a little; the sentence falls to
    // rest — or, from a speaker who lifts every end, rises (never the last)
    var endKind = opts.last ? "fall" : shape === "rising" ? "rise" : shape === "arch" && R.chance(0.3) ? "level" : "fall";
    var out = [], t = 0, dFall = R.rnd(2.5, 4.5), dRise = R.rnd(3, 6), pausesIn = (habit.pauses || 0.4) * R.rnd(0.35, 0.6);
    // (a voice carries on from where the last syllable left it: a syllable
    // begins at the pitch the one before ended on — after a breath, fresh —
    // and an accent rises out of it; only the breath resets the line)
    var prevEnd = null;
    syl.forEach(function (s, i) {
      var last = i === n - 1, phraseEnd = last || i === cut, p = pitch[i], nextP = i + 1 < n ? pitch[i + 1] : p;
      var d = (1 / rate) * (s.stressed ? 1.25 : 0.8) * R.rnd(0.88, 1.12) * (phraseEnd ? R.rnd(1.5, 1.9) : 1);
      var p0, pk = null, p1, rise = R.rnd(1, 2.2), fall = R.rnd(0.8, 1.8), acc = accents.indexOf(i) >= 0;
      if (acc) { p0 = prevEnd == null ? p - rise : Math.min(prevEnd, p - 0.5 * rise); pk = p; p1 = p - fall; }
      else { p0 = prevEnd == null ? p : prevEnd; p1 = p + (nextP - p) * 0.45; }
      if (last) { if (endKind === "fall") p1 = Math.min(p1, p) - dFall; else if (endKind === "rise") p1 = Math.max(p1, p) + dRise; else p1 = p - 0.5; }
      else if (i === cut) p1 = Math.max(p1, p) + R.rnd(0.8, 2);
      var glide = pk != null ? [[0, st(p0 - p0)], [R.rnd(0.35, 0.55), st(pk - p0)], [1, st(p1 - p0)]] : [[0, 1], [1, st(p1 - p0)]];
      var v = pickV(s.stressed ? STRESSED_V : WEAK_V, R, out.length ? out[out.length - 1].vowel : null);
      out.push({ vowel: v, dur: +d.toFixed(4), f: base * st(p0), glide: glide, stress: acc ? 1 : s.stressed ? 0.85 : i === 0 ? 0.75 : R.rnd(0.4, 0.6), accent: acc, p: pk != null ? pk : (p0 + p1) / 2, pStart: p0, pEnd: p1, last: last });
      t += d;
      prevEnd = p1;
      if (i === cut) { out.push({ rest: true, dur: +pausesIn.toFixed(4) }); t += pausesIn; prevEnd = null; }
    });
    return { syllables: out, dur: t, base: base, end: endKind };
  }
  function pickV(pool, R, prev) {
    var v = R.pickW(pool);
    if (v === prev) v = R.pickW(pool);                 // (not the same syllable twice running, most times)
    return v;
  }

  // ==========================================================================
  // THE DOUBLING (pure) — the speech's melody written down, as Reich wrote
  // his speakers' down: each syllable's heard pitch (an accent's peak;
  // elsewhere the middle of its glide) moved to the nearest tone of the
  // day's just scale in the testimony's key, then carried by octaves into
  // the reed's register; repeated tones joined; the speech's own rhythm.
  // ==========================================================================
  var PARENT_FR = {
    ionian:     ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"],
    mixolydian: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "16/9"],
    dorian:     ["1/1", "9/8", "6/5", "4/3", "3/2", "5/3", "16/9"],
    aeolian:    ["1/1", "9/8", "6/5", "4/3", "3/2", "8/5", "16/9"],
  };
  PARENT_FR.penta = PARENT_FR.hexa = PARENT_FR.ionian;
  var CLASSES = {
    ionian: [0, 1, 2, 3, 4, 5, 6], mixolydian: [0, 1, 2, 3, 4, 5, 6], dorian: [0, 1, 2, 3, 4, 5, 6],
    aeolian: [0, 1, 2, 3, 4, 5, 6], penta: [0, 1, 2, 4, 5], hexa: [0, 1, 2, 3, 4, 5],
  };
  function mod(a, n) { return ((a % n) + n) % n; }
  function fromFraction(s) {
    var p = String(s).split("/"), m = [0, 0, 0, 0];
    [+p[0], -(+(p[1] || 1))].forEach(function (x, side) {
      var v = Math.abs(x), sg = side ? -1 : 1;
      [2, 3, 5, 7].forEach(function (q, i) { while (v % q === 0 && v > 1) { v /= q; m[i] += sg; } });
    });
    return m;
  }
  function mRatio(m) { m = m || [0, 0, 0, 0]; return Math.pow(2, m[0] || 0) * Math.pow(3, m[1] || 0) * Math.pow(5, m[2] || 0) * Math.pow(7, m[3] || 0); }
  function modeName(m) { return PARENT_FR[m] ? m : "ionian"; }
  // the scale the reed plays: the mode's just tones in the key — with the
  // drone's own pitch for its letter, where the drone stands a comma or a
  // semitone off the mode's (the reckoning's cantus can: a note of a
  // doxology keyed a fifth away), so the reed never rubs a second against it
  function tableFor(mode, droneRel) {
    var tbl = PARENT_FR[mode].map(fromFraction);
    if (droneRel) {
      var dm = droneRel.slice(0, 4), r = mRatio(dm); while (r >= 2) { dm[0]--; r /= 2; } while (r < 1) { dm[0]++; r *= 2; }
      var best = -1, bc = Infinity;
      tbl.forEach(function (m, c) { var x = Math.abs(1200 * Math.log(r / mRatio(m)) / Math.LN2); if (x < bc) { bc = x; best = c; } });
      if (bc > 1 && bc < 120 && CLASSES[mode].indexOf(best) >= 0) tbl[best] = dm;
    }
    return tbl;
  }
  function monzoOf(tbl, d) { var m = tbl[mod(d, 7)].slice(); m[0] += Math.floor(d / 7); return m; }
  // the nearest tone of the mode to hz (degrees from the key's final, any octave)
  function nearest(hz, finalHz, mode, tbl) {
    var best = null, bc = Infinity, d0 = Math.round(7 * Math.log(hz / finalHz) / Math.LN2);
    for (var d = d0 - 4; d <= d0 + 4; d++) {
      if (CLASSES[mode].indexOf(mod(d, 7)) < 0) continue;
      var c = Math.abs(1200 * Math.log(hz / (finalHz * mRatio(monzoOf(tbl, d)))) / Math.LN2);
      if (c < bc) { bc = c; best = d; }
    }
    return best;
  }
  // the reeds' registers: the middle each melody is carried to
  var REEDS = { harmonium: { mid: 330, lo: 175, hi: 760 }, clarinet: { mid: 440, lo: 190, hi: 1050 } };
  function transcribe(sent, M, reed, kFixed) {
    var mode = M.mode, F = M.finalHz, tbl = M.table || tableFor(mode), raw = [], acc = 0;
    sent.syllables.forEach(function (s) {
      if (s.rest) { if (raw.length) raw[raw.length - 1].dur += s.dur; else acc += s.dur; return; }
      // (the sentence's last syllable, where it falls or lifts far — a third
      // or more — is written as the two notes it moves between: the ending
      // IS the speaker's gesture)
      if (s.last && Math.abs(s.pEnd - s.pStart) >= 2.5) {
        raw.push({ d: nearest(sent.base * st(s.pStart), F, mode, tbl), dur: s.dur * 0.4 + acc, stress: s.stress, accent: true });
        raw.push({ d: nearest(sent.base * st(s.pEnd), F, mode, tbl), dur: s.dur * 0.6, stress: s.stress, accent: false });
      } else raw.push({ d: nearest(sent.base * st(s.p), F, mode, tbl), dur: s.dur + acc, stress: s.stress, accent: !!s.accent });
      acc = 0;
    });
    // into the reed's register, by whole octaves (the melody's middle nearest the reed's)
    var ds = raw.map(function (x) { return x.d; }).sort(function (a, b) { return a - b; }), mid = ds[ds.length >> 1];
    var R = REEDS[reed], k = kFixed != null ? kFixed : Math.round(Math.log(R.mid / (F * mRatio(monzoOf(tbl, mid)))) / Math.LN2);
    var lo = ds[0] + 7 * k, hi = ds[ds.length - 1] + 7 * k;
    if (kFixed == null) { if (F * mRatio(monzoOf(tbl, lo)) < R.lo) k++; else if (F * mRatio(monzoOf(tbl, hi)) > R.hi) k--; }
    var notes = [];
    raw.forEach(function (x) {
      var d = x.d + 7 * k, prev = notes[notes.length - 1];
      // (a repeated tone is held on, unless a stressed syllable strikes it again)
      if (prev && prev.d === d && !x.accent) { prev.dur += x.dur; prev.stress = Math.max(prev.stress, x.stress); return; }
      var m = monzoOf(tbl, d);
      notes.push({ d: d, m: m, f: F * mRatio(m), dur: x.dur, stress: x.stress, accent: x.accent });
    });
    return notes;
  }
  // THE WORDS BECOME MUSIC: the transcribed melody drawn to a pulse — an
  // eighth the length of one of the speaker's syllables, each note a whole
  // number of them, a stressed note moved onto the beat, the last held to the
  // bar's end — and closing on the key's own chord (do, mi or sol, whichever
  // is nearest), where the speech had stopped anywhere
  function tuneOf(notes, rate, mode, R, tbl) {
    tbl = tbl || tableFor(mode);
    var unit = Math.max(0.2, Math.min(0.36, (1 / rate) * R.rnd(1.05, 1.25))), out = [], q = 0;
    notes.forEach(function (n, i) {
      var n8 = Math.max(1, Math.round(n.dur / unit));
      if (n.accent && q % 2 === 1 && out.length) { out[out.length - 1].n8++; q++; }          // the stress onto the beat
      out.push({ d: n.d, m: n.m, f: n.f, n8: n8, stress: n.stress });
      q += n8;
    });
    var last = out[out.length - 1], home = [0, 2, 4].filter(function (c) { return CLASSES[mode].indexOf(c) >= 0; });
    if (home.indexOf(mod(last.d, 7)) < 0) {
      var best = null;
      for (var dd = 1; dd <= 3 && best == null; dd++) [last.d - dd, last.d + dd].forEach(function (x) { if (best == null && home.indexOf(mod(x, 7)) >= 0) best = x; });
      var m = monzoOf(tbl, best), F = last.f / mRatio(last.m);
      out.push({ d: best, m: m, f: F * mRatio(m), n8: 2, stress: 1, close: true });
      q += 2;
    }
    out[out.length - 1].n8 += (4 - (q % 4)) % 4 + 2;                                          // held to the bar's end, and a beat more
    out.forEach(function (n) { n.dur = n.n8 * unit; });
    return { notes: out, unit: unit };
  }

  // ==========================================================================
  // PREPARE (pure) — who rises, in what order, on which reed, and what they
  // say. The bearers are the Sunday's (the ward's roles.testimony, each with
  // the voice the cast gave them and the habits of their archetype); a lab
  // with no ward gets two of no one in particular.
  // ==========================================================================
  // which reed takes a speaker up (the harmonium's likelihood): the parlor's
  // old pump organ for the widow, the pioneer, the sister and the farmer;
  // the deacon's clarinet more often for the young
  var HARMONIUM_LEAN = { widow: 0.75, pioneer: 0.75, sister: 0.7, farmer: 0.7, father: 0.55, teacher: 0.5, missionary: 0.4, teen: 0.3 };
  // what the reed does with each sentence, by how many a bearer says:
  //   echo    the sentence alone, then the reed plays it back
  //   double  the reed with the speaker, a hair behind the lips
  //   tune    the reed with the speaker, then the reed alone makes a tune of it
  var MOVES = { 2: ["echo", "tune"], 3: ["echo", "double", "tune"], 4: ["echo", "double", "double", "tune"] };
  var ANON = [
    { id: null, nameDs: null, nameEn: null, archetype: "sister", archetypeEn: "a sister of the ward", voice: { part: "A", age: "mid", confidence: 0.7, brightness: 0.45, breath: 0.35 }, habit: { rate: 3.2, range: 5, contour: "arch", pauses: 0.4 } },
    { id: null, nameDs: null, nameEn: null, archetype: "father", archetypeEn: "a father of the ward", voice: { part: "B", age: "mid", confidence: 0.65, brightness: 0.4, breath: 0.35 }, habit: { rate: 3.3, range: 5, contour: "rising", pauses: 0.45 } },
  ];
  function num(x, d) { x = +x; return isFinite(x) && x > 0 ? x : d; }
  // a speaking voice: the singer's own, without the vibrato (an old voice
  // keeps its tremor), a little breathier, on time (speech keeps its own)
  function speakingVoice(v) {
    var s = {}; for (var k in v) s[k] = v[k];
    s.vibrato = v && v.age === "old" ? { rate: 4.6, depth: 14, onsetDelay: 0.05 } : { depth: 0 };
    s.breath = Math.min(0.6, ((v && v.breath) || 0.35) + 0.1);
    s.confidence = Math.max(0.6, (v && v.confidence) || 0.7);
    s.timingHabitMs = 0; s.pitchHabitCents = 0;         // (the pitch habit is in the speaking pitch already)
    return s;
  }
  function sentencesFor(h, u) {
    var n = 2 + (h.range >= 6 ? 1 : 0) + (h.rate >= 3.6 ? 1 : 0) + (u < 0.35 ? 1 : 0) - (h.rate < 2.6 && h.range <= 4 ? 1 : 0);
    return Math.max(2, Math.min(4, n));
  }
  function prepare(material, stream) {
    if (material && material.prepared) return material;
    var M = material || {}, rs = need(stream).fork("shape");
    var K = num(M.keynoteHz, 262), keyM = (M.keyMonzo || [0, 0, 0, 0]).slice(0, 4), mode = modeName(M.mode), ward = M.ward;
    var people = ward && ward.roles && ward.roles.testimony ? ward.roles.testimony.map(function (id) { return ward.byId[id]; }).filter(function (m) { return m && m.voice && m.habit; }) : [];
    if (!people.length) people = ANON;
    // the order they rise: the cast's, or (a third of Sundays) the last first
    if (rs.next() < 0.33 && people.length > 1) people = people.slice(1).concat(people.slice(0, 1));
    var F = K * mRatio(keyM), lastReed = null, streak = 0, silence = num(M.silenceMul, 1);
    // (the drone's note, relative to the key: material.droneMonzo is relative to the keynote)
    var tbl = tableFor(mode, M.droneMonzo ? [0, 1, 2, 3].map(function (i) { return (M.droneMonzo[i] || 0) - (keyM[i] || 0); }) : null);
    var bearers = people.map(function (b, k) {
      var r = need(stream).fork("speech:" + k), rr = need(stream).fork("reed:" + k);
      var reedU = rs.next(), nU = rs.next();                               // DICE: every die, drawn, in order, even where the streak rule overrides the reed — deliberate; must stay
      var lean = HARMONIUM_LEAN[b.archetype] != null ? HARMONIUM_LEAN[b.archetype] : 0.6;
      var reed = reedU < lean ? "harmonium" : "clarinet";
      if (reed === lastReed && streak >= 2) reed = reed === "harmonium" ? "clarinet" : "harmonium";   // (never three on one reed)
      streak = reed === lastReed ? streak + 1 : 1; lastReed = reed;
      var hab = b.habit, n = sentencesFor(hab, nU), moves = MOVES[n];
      var sents = [], said = [];
      for (var i0 = 0; i0 < n; i0++) said.push(speech(hab, b.voice, r, { last: i0 === n - 1 }));
      // ONE REGISTER A BEARER: the octave that carries the middle of all
      // they say to the middle of the reed's compass (a sentence at a time,
      // one sentence's echo and the next one's doubling could sit an octave apart)
      var heard = [];
      said.forEach(function (sp0) { sp0.syllables.forEach(function (y) { if (!y.rest) heard.push(sp0.base * st(y.p)); }); });
      heard.sort(function (a, c2) { return a - c2; });
      var kOct = Math.round(Math.log(REEDS[reed].mid / heard[heard.length >> 1]) / Math.LN2);
      for (var i = 0; i < n; i++) {
        var sp = said[i], notes = transcribe(sp, { mode: mode, finalHz: F, table: tbl }, reed, kOct);
        sents.push({ speech: sp, move: moves[i], notes: notes, tune: moves[i] === "tune" ? tuneOf(notes, hab.rate || 3, mode, rr, tbl) : null,
                     lag: rr.rnd(0.04, 0.07), gap: rr.rnd(0.45, 0.8), after: (hab.pauses || 0.4) * rr.rnd(1.6, 2.6) });
      }
      return { k: k, id: b.id, nameDs: b.nameDs, nameEn: b.nameEn || null, archetype: b.archetype, archetypeEn: b.archetypeEn || null, part: b.voice.part, pew: b.pew ? b.pew.x : null,
               voice: speakingVoice(b.voice), habit: hab, reed: reed, sentences: sents, walk: rr.rnd(1.4, 2.2) };
    });
    var stills = bearers.map(function () { return rs.rnd(3.5, 6.5) * silence; });
    return { prepared: true, keynoteHz: K, keyMonzo: keyM, finalHz: F, mode: mode, table: tbl, droneMonzo: M.droneMonzo || null, bearers: bearers, stills: stills, sunday: M.sunday || null };
  }

  // ==========================================================================
  // THE SCORE (pure) — the testimonies as data, seconds from t0
  //   speakers: [{t, member, voice, notes (VoicesVocal's), pan, k, i, move}]
  //   reeds:    [{t, reed, notes: [{f, dur}], move, member, vib}]
  //   creaks:   [{t, kind: rise | step | sit, pan, v}]
  //   stages, cast, answers (a tune handed to the motif engine), notes, end
  // ==========================================================================
  var STAND = [0.05, -0.12, 0.15];                // where each speaks: the stand, a little aside
  var WHO = { harmonium: "the harmonium", clarinet: "the clarinet" };
  function score(material, stream, t0) {
    var M = material && material.prepared ? material : prepare(material, stream);
    t0 = t0 || 0;
    var out = { speakers: [], reeds: [], creaks: [], stages: [], cast: [], answers: [], notes: [] }, t = 0;
    function stage(name, a, b, label, member) { out.stages.push({ stage: name, t0: t0 + a, t1: t0 + b, label: label, member: member }); }
    function reedLine(at, b, notes, move, s) {
      var tt = at, list = notes.map(function (n) { return { f: n.f, dur: n.dur, stress: n.stress }; }), rep = [];
      notes.forEach(function (n) { var r = { layer: b.reed, freq: n.f, t: t0 + tt, dur: n.dur, part: "testimony", member: b.id, deg: n.d, monzo: n.m, keyMonzo: M.keyMonzo, move: move }; rep.push(r); out.notes.push(r); tt += n.dur; });
      out.reeds.push({ t: t0 + at, reed: b.reed, notes: list, move: move, member: b.id, k: b.k, vib: move === "tune", report: rep });
      return tt - at;
    }
    M.bearers.forEach(function (b, k) {
      var who = b.nameEn || b.archetypeEn || "a bearer", pan = STAND[k % 3], pew = b.pew != null ? b.pew * 0.8 : pan * 3, tb = t;
      // THEY RISE: the pew, and two steps to the stand
      out.creaks.push({ t: t0 + t, kind: "rise", pan: pew, v: 1 }, { t: t0 + t + 0.6, kind: "step", pan: (pew + pan) / 2, v: 0.7 }, { t: t0 + t + 1.05, kind: "step", pan: pan, v: 0.6 });
      out.cast.push({ memberId: b.id, nameDs: b.nameDs, action: "rises to bear testimony", t: t0 + t });
      stage("rise", t, t + b.walk, who + " rises", b.id);
      t += b.walk;
      b.sentences.forEach(function (s, i) {
        var ts = t, sp = s.speech, tt = ts;
        var said = [];
        sp.syllables.forEach(function (y) { if (!y.rest) { var r = { layer: "voice", freq: sp.base * st(y.p), t: t0 + tt, dur: y.dur, part: b.part, member: b.id, speech: true, accent: !!y.accent }; said.push(r); out.notes.push(r); } tt += y.dur; });
        out.speakers.push({ t: t0 + ts, member: b.id, voice: b.voice, pan: pan, k: k, i: i, move: s.move, report: said,
                            notes: sp.syllables.map(function (y) { return y.rest ? { rest: true, dur: y.dur } : { f: y.f, dur: y.dur, vowel: y.vowel, stress: y.stress, glide: y.glide }; }) });
        if (s.move === "echo") {
          stage("speaks", ts, ts + sp.dur, who + " speaks", b.id);
          t = ts + sp.dur + s.gap;
          var d1 = reedLine(t, b, s.notes, "echo", s);
          stage("echo", t, t + d1, WHO[b.reed] + " plays the words back", b.id);
          t += d1 + 0.35;
        } else {
          reedLine(ts + s.lag, b, s.notes, "double", s);
          stage("double", ts, ts + sp.dur, who + " speaks, and " + WHO[b.reed] + " speaks with " + (b.part === "S" || b.part === "A" ? "her" : "him"), b.id);
          t = ts + sp.dur + s.lag;
          if (s.move === "tune") {
            t += s.gap + 0.25;
            var d2 = reedLine(t, b, s.tune.notes, "tune", s);
            stage("tune", t, t + d2, WHO[b.reed] + " makes a tune of the words", b.id);
            out.answers.push({ t: t0 + t + d2, memberId: b.id, instrument: b.reed,
                               motif: { name: "testimony:" + (b.id || k), gesture: "testimony", gen: 0, chain: [], notes: s.tune.notes.map(function (n) { return { deg: n.d, durBeats: n.n8 / 2 }; }), unit: s.tune.unit } });
            t += d2 + 0.4;
          }
        }
        t += s.after;
      });
      // THEY SIT
      out.creaks.push({ t: t0 + t, kind: "step", pan: pan, v: 0.55 }, { t: t0 + t + 0.5, kind: "sit", pan: pew, v: 0.85 });
      out.cast.push({ memberId: b.id, nameDs: b.nameDs, action: "sits down", t: t0 + t + 0.5 });
      stage("bearer", tb, t + 1, who + " (" + (b.archetypeEn || b.archetype) + ") bears testimony; " + WHO[b.reed] + " takes up the words", b.id);
      t += 1.2 + (k < M.bearers.length - 1 ? M.stills[k] : 0);
      if (k < M.bearers.length - 1) stage("stillness", t - M.stills[k], t, "the testimony's stillness", null);
    });
    out.notes.sort(function (a, b) { return a.t - b.t; });
    out.end = t0 + t; out.until = t0 + t + 2.5;
    return out;
  }

  // ==========================================================================
  // THE REEDS — the parlor's harmonium and the deacon's clarinet, as the
  // house voices them (kolob-voices-winds.js: the harmonium a detuned pair
  // of saws through a still reed formant, breathing at the bellows; the
  // clarinet a triangle and a soft octave through a fixed lowpass), but
  // made to follow a voice: a reed speaks in a few hundredths, not in a
  // second, and a new syllable is a new reed — the pitch steps, the air dips
  // an instant and speaks again. Only the tune gets the clarinet's vibrato.
  // One line is one voice (9 nodes the harmonium, 5 the clarinet, 7 with
  // its vibrato), however many notes.
  // ==========================================================================
  function kRate(p) { try { p.automationRate = "k-rate"; } catch (e) { /* an old browser */ } }
  function playReed(ctx, dest, t, notes, reed, o, Y) {
    var total = 0; notes.forEach(function (n) { total += n.dur; });
    if (!notes.length || total <= 0) return 0;
    var g = ctx.createGain(), nodes = [g], oscs = [], peak = (o.gain || 1) * (reed === "harmonium" ? 0.22 : 0.3);
    g.gain.setValueAtTime(0, t);
    if (reed === "harmonium") {
      var mix = ctx.createGain(); mix.gain.value = 0.5;
      [1 - Y.rnd(0.003, 0.005), 1 + Y.rnd(0.003, 0.005)].forEach(function (det) { var os = ctx.createOscillator(); os.type = "sawtooth"; os.det = det; kRate(os.frequency); os.connect(mix); oscs.push(os); });
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2000; bp.Q.value = 3.5;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600;
      // the bellows: a slow breath in the wind, on a stage of its own BEFORE
      // the envelope (on the envelope itself it would breathe on through the
      // release, and the reed would never quite fall silent)
      var bw = ctx.createGain(); bw.gain.value = 1;
      mix.connect(bw); bw.connect(bp); bp.connect(lp); lp.connect(g);
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = Y.rnd(0.2, 0.4); lg.gain.value = 0.06; lfo.connect(lg); lg.connect(bw.gain); oscs.push(lfo);
      nodes.push(mix, bw, bp, lp, lg);
    } else {
      var tri = ctx.createOscillator(); tri.type = "triangle"; tri.det = 1; kRate(tri.frequency);
      var oct = ctx.createOscillator(); oct.type = "sine"; oct.det = 2; kRate(oct.frequency);
      var og = ctx.createGain(); og.gain.value = 0.12;
      var lp2 = ctx.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = Math.min(6000, notes[0].f * 5);
      tri.connect(lp2); oct.connect(og); og.connect(lp2); lp2.connect(g); oscs.push(tri, oct); nodes.push(og, lp2);
      if (o.vib) {
        var vl = ctx.createOscillator(), vg = ctx.createGain(); vl.frequency.value = Y.rnd(4.6, 5.4); vg.gain.setValueAtTime(0, t);
        vg.gain.setValueAtTime(0, t + total * 0.3); vg.gain.linearRampToValueAtTime(8, t + total * 0.6);
        vl.connect(vg); oscs.filter(function (x) { return x.det; }).forEach(function (x) { vg.connect(x.detune); }); oscs.push(vl); nodes.push(vg);
      }
    }
    g.connect(dest);
    // the notes: a pitch step (15 ms) and, on every note after the first, the
    // air dipping an instant as the new reed speaks — deeper on a stressed one
    var tt = t;
    notes.forEach(function (n, i) {
      oscs.forEach(function (x) { if (!x.det) return; if (i === 0) x.frequency.setValueAtTime(n.f * x.det, t); else { x.frequency.setValueAtTime(notes[i - 1].f * x.det, tt); x.frequency.linearRampToValueAtTime(n.f * x.det, tt + 0.015); } });
      var lv = peak * (0.85 + 0.15 * (n.stress != null ? n.stress : 1));
      if (i === 0) { g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(lv, tt + 0.05); }
      else { g.gain.setTargetAtTime(lv * (n.stress >= 1 ? 0.45 : 0.7), tt - 0.012, 0.008); g.gain.setTargetAtTime(lv, tt + 0.01, 0.02); }
      if (n.dur > 0.9 && o.vib) g.gain.setTargetAtTime(lv * 1.08, tt + n.dur * 0.4, 0.3);
      tt += n.dur;
    });
    g.gain.setTargetAtTime(0, t + total, reed === "harmonium" ? 0.12 : 0.08);
    var end = t + total + 1.2;
    oscs.forEach(function (x) { x.start(t); x.stop(end); });
    oscs[0].onended = function () { try { nodes.forEach(function (x) { x.disconnect(); }); } catch (e) { /* gone */ } };
    return nodes.length + oscs.length;
  }

  // THE PEWS — baked once per context: a pew's board creaking as the weight
  // leaves it (stick–slip, higher and shorter than a bench dragged), and a
  // step on the boards
  var BAKED = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function bake(ctx) {
    if (BAKED && BAKED.get(ctx)) return BAKED.get(ctx);
    var SR = ctx.sampleRate, s = 4242;
    function rnd() { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function buf(sec, fill) { var n = Math.ceil(sec * SR), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0); fill(d, n); var m = 0; for (var i = 0; i < n; i++) m = Math.max(m, Math.abs(d[i])); if (m) for (var j = 0; j < n; j++) d[j] *= 0.5 / m; return b; }
    function ring(d, at, f, tau, amp) { var w = 2 * Math.PI * f / SR, n = Math.min(d.length - at, Math.ceil(tau * 7 * SR)); for (var i = 0; i < n; i++) d[at + i] += amp * Math.exp(-i / (tau * SR)) * Math.sin(w * i); }
    var B = {
      creak: [0, 1, 2].map(function () { return buf(0.55, function (d) { var tt = 0.01, len = 0.3 + rnd() * 0.15, rate = 70 + rnd() * 40, f = 380 + rnd() * 260; while (tt < len) { var x = tt / len, env = Math.sin(Math.PI * x); ring(d, Math.floor(tt * SR), f * (1 + 0.1 * x), 0.006, env); ring(d, Math.floor(tt * SR), f * 2.7, 0.003, env * 0.3); tt += 1 / (rate * (0.8 + rnd() * 0.4)); } }); }),
      step: [0, 1, 2].map(function () { return buf(0.3, function (d) { ring(d, 10, 80 + rnd() * 30, 0.045, 1); ring(d, 12, 260 + rnd() * 120, 0.014, 0.3); }); }),
    };
    if (BAKED) BAKED.set(ctx, B);
    return B;
  }

  // ==========================================================================
  // PERFORM — the testimonies, placed at t (synthesis; reads no clock)
  // ==========================================================================
  // the parts' balance under LEVEL: the speaker, the reeds, the pews
  // (measured soloed at LEVEL 0.5 with the reeds at MIX 0.8: the speaker's
  // loudest 3 s −5.1 LU, the reeds' +3.5 — the reed drowning the voice it
  // follows — and the pews' −22; so the reeds are set 10 dB down, to sit a
  // little under the speaker)
  var MIX ={ speaker: 1, harmonium: 0.25, clarinet: 0.25, room: 0.66 };
  function perform(ctx, dest, t, material, stream, hooks) {
    var VV = window.KOLOB.VoicesVocal;
    if (!VV || !VV.singer) throw new Error("KOLOB.Testimony: load kolob-voices-vocal.js first");
    hooks = hooks || {};
    var M = material && material.prepared ? material : prepare(material, stream);
    var sc = score(M, stream, t), synth = need(stream).fork("synth"), ds = hooks.dests || {}, made = [];
    function bus(key, to) { var g = ctx.createGain(); g.gain.value = LEVEL * MIX[key]; g.connect(ds[to || key] || dest); made.push(g); return g; }
    var spBus = bus("speaker"), reedBus = { harmonium: bus("harmonium"), clarinet: bus("clarinet") }, roomBus = bus("room", "speaker");
    var B = bake(ctx), Y = synth.fork("reeds"), hand = synth.fork("room"), nodes = { reeds: 0, room: 0 };
    // DICE: which creak, a hair of its speed — drawn for every one now, in
    // order, before any is placed, so a creak left out later moves no other
    // draw — deliberate; must stay
    var CR =sc.creaks.map(function () { return { u: hand.next(), rate: hand.rnd(0.94, 1.06) }; });
    var singers = {};
    function singerOf(sp) {
      var key = sp.member || "k" + sp.k;
      if (!singers[key]) { var v = {}; for (var x in sp.voice) v[x] = sp.voice[x]; v.rand = synth.fork("voice:" + key); v.pan = sp.pan; singers[key] = VV.singer(v); }
      return singers[key];
    }
    var items = [];
    sc.creaks.forEach(function (c, i) {
      items.push({ t: c.t, go: function () {
        var src = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(), arr = c.kind === "step" ? B.step : B.creak;
        src.buffer = arr[Math.floor(CR[i].u * arr.length)]; src.playbackRate.value = CR[i].rate;
        g.gain.value = (c.kind === "step" ? 0.3 : 0.4) * c.v; if (p.pan) p.pan.value = Math.max(-1, Math.min(1, c.pan));
        src.connect(g); g.connect(p); p.connect(roomBus); src.start(Math.max(0, c.t)); nodes.room += 3;
        src.onended = function () { try { g.disconnect(); p.disconnect(); } catch (e) { /* gone */ } };
      } });
    });
    sc.speakers.forEach(function (sp) { items.push({ t: sp.t - 0.6, notes: sp.report, go: function () { singerOf(sp).sing(ctx, spBus, sp.t, sp.notes, 1, { breathBefore: 0.55, inhale: 0.9, pan: sp.pan }); } }); });
    sc.reeds.forEach(function (r, i) { items.push({ t: r.t, notes: r.report, go: function () { nodes.reeds += playReed(ctx, reedBus[r.reed], r.t, r.notes, r.reed, { vib: r.vib, gain: r.move === "tune" ? 1.08 : 1 }, Y.fork("line:" + i)); } }); });
    items.sort(function (a, b) { return a.t - b.t; });
    // LAID OUT A SLICE AT A TIME (hooks.defer — the engine's clock), each
    // slice AHEAD seconds before its first sound, its notes told then
    var AHEAD = 2.5, SLICE = 1.5, slices = [];
    items.forEach(function (it) { var cur = slices[slices.length - 1]; if (!cur || it.t >= cur.t0 + SLICE) slices.push(cur = { t0: it.t, items: [] }); cur.items.push(it); });
    slices.forEach(function (sl) {
      function lay() { sl.items.forEach(function (it) { it.go(); if (hooks.onNote && it.notes) it.notes.forEach(hooks.onNote); }); }
      var when = sl.t0 - AHEAD;
      if (hooks.defer && when > t + 0.05) hooks.defer(when, lay); else lay();
    });
    if (hooks.onStage) sc.stages.forEach(function (st2) { hooks.onStage(st2); });
    if (hooks.onCast) sc.cast.forEach(function (c) { if (c.memberId) hooks.onCast(c); });
    // the motif engine may answer: each tune handed back as it ends
    if (hooks.onAnswer) sc.answers.forEach(function (a) { if (hooks.defer && a.t > t + 0.05) hooks.defer(a.t, function () { hooks.onAnswer(a); }); else hooks.onAnswer(a); });
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator(), sg = ctx.createGain();
    sg.gain.value = 0; sent.connect(sg); sg.connect(dest);
    sent.onended = function () { try { made.forEach(function (n) { n.disconnect(); }); sg.disconnect(); sent.disconnect(); } catch (e) { /* gone already */ } };
    sent.start(Math.max(0, t)); sent.stop(sc.until + 1.5);
    perform.last = { score: sc, slices: slices.length, nodes: nodes };
    return sc.end;
  }

  return {
    plan: plan, decide: decide, prepare: prepare, speech: speech, transcribe: transcribe, tuneOf: tuneOf, score: score, perform: perform, bake: bake, speakingHz: speakingHz, MIX: MIX,
    REEDS: REEDS, MOVES: MOVES, HARMONIUM_LEAN: HARMONIUM_LEAN,
    NAME: NAME, LABEL: LABEL, ODDS: ODDS,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-testimony.js"] = true;   // the load guard's roll call
