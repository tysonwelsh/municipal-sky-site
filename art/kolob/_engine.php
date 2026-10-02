<?php
// ============================================================================
// KOLOB — _engine.php: the engine's rooms, in the order they are loaded.
//
// THE ONE LIST. Every page that plays the engine reads it from here (a list
// written out in four places once failed silently when a copy went stale):
//
//   $kolob_engine = require __DIR__ . '/_engine.php';
//   kolob_engine_tags($kolob_engine, 'kolob_v');   // the <script> tags + the load guard
//
// and the harness (art/kolob/_harness.js) reads this same file, so a module
// added here is loaded everywhere at once. The order is SCORE.md §1's: the
// Jukebox v2 substrate first (read-only, by relative path — never modified
// from Kolob), then pitch, the score and the Earth tunes, the composers,
// the voices, the performers, and last the core that raises the KolobAudio
// facade over them. (A lab module joins this list on the day the engine first
// uses it — kolob-voices-folk.js did; kolob-question.js never did, and is in
// shelved/ since 2026-10-01 with the bagpipe.)
//
// THE LOAD GUARD. Each kolob-*.js room answers a roll call as its last act
// (KOLOB._rooms["kolob-voices-organ.js"] = true), and the substrate — and the
// Earth tunes, whose file answers no roll call — are
// checked by the globals they raise; kolob_engine_tags() prints a guard that names every room
// that did not answer, so a missing or broken module is reported at load, not
// as "S.x is not a function" at the first cue that needs it. The guard tells
// the page as well as the console: it sets KOLOB._broken to the names it
// found missing (the facade among them when KolobAudio did not rise), and
// nothing on a page that loaded whole. kolob-ui.js reads it at start-up and,
// when it is set, wires nothing: PLAY stays disabled and the minutes say the
// engine failed to load, so a broken page never calls a meeting that would
// throw at its first cue. The guard is kolob_engine_guard(), below, and
// tools/loadcheck.js runs that same script after the same list, as the page
// does.
// ============================================================================

if (!function_exists('kolob_engine_tags')) {
    // Echo one <script> per room, cache-busted by $version_of($file), then the
    // load guard, called with the list's file names. $version_of is the
    // page's own hash helper (kolob_v, otl_v…).
    function kolob_engine_tags(array $engine, $version_of)
    {
        foreach ($engine as $js) {
            echo '<script src="' . htmlspecialchars($js) . '?v=' . call_user_func($version_of, $js) . '"></script>' . "\n";
        }
        echo '<script>(' . kolob_engine_guard() . ')(' . json_encode(array_map('basename', $engine)) . ');</script>' . "\n";
    }
    // THE LOAD GUARD's script: a function of the list's file names (`need`),
    // run once every room's tag has run. tools/loadcheck.js reads it from
    // here, between the markers, and runs it after the rooms as the page does.
    function kolob_engine_guard()
    {
        return <<<'JS'
function (need) {
  var K = window.KOLOB = window.KOLOB || {}, r = K._rooms || {}, P = window.PJ2 || {},
    sub = { "pj2-rand.js": P.Rand, "pj2-clock.js": P.Clock, "pj2-fx.js": P.Fx, "kolob-tunes.js": K.Tunes }, miss = [];
  need.forEach(function (f) { if (f in sub ? !sub[f] : !r[f]) miss.push(f); });
  if (!window.KolobAudio) miss.push("the KolobAudio facade");
  if (miss.length) { K._broken = miss; console.error("KOLOB AUDIO ENGINE FAILED TO LOAD: " + miss.join(", ")); }
}
JS;
    }
}

return [
    // the Jukebox v2 substrate (read-only): the dice, the clock, the rooms' crossfade
    '../prosperos-jukebox-v2/pj2-rand.js',
    '../prosperos-jukebox-v2/pj2-clock.js',
    '../prosperos-jukebox-v2/pj2-fx.js',
    // the tuning, the score as it is written, and the Earth tunes (the old
    // tune sings them)
    'kolob-pitch.js', 'kolob-score.js', 'kolob-tunes.js',
    // the composers (pure: handed a moment and the caller's dice)
    'kolob-melody.js', 'kolob-harmony.js',
    // the hymn composer: pure, loaded ahead of the performers
    'kolob-dialects.js', 'kolob-hymnists.js', 'kolob-composer.js',
    // the Sunday's organist: pure planning — the chorale prelude, the hymn
    // in pieces, the walk into a new key — played on the pipe organ among
    // the voices
    'kolob-organist.js',
    // the experiments' switch: the engine asks it once a meeting before
    // seating an experimental feature (the singing school);
    // ?exp=-singingSchool turns one off for a visit
    'kolob-experimental.js',
    // the Sunday of the colony year, the arc of light, the rites' seatings
    // and the Kolob reckoning: pure; the meeting draws the Sunday from it,
    // and the composer's desk reads the reckoning in it
    'kolob-calendar.js',
    // the voices (the registrable pipe organ is the meeting's one organ —
    // kolob-voices-organ.js keeps the old additive one as the A/B)
    'kolob-voices-pipeorgan.js',
    'kolob-voices-organ.js', 'kolob-voices-choir.js', 'kolob-voices-winds.js',
    'kolob-voices-ground.js', 'kolob-voices-field.js',
    // (the bagpipe, shelved by the owner on 2026-09-13, left the list on
    // 2026-10-01: its room and lab are in shelved/)
    'kolob-voices-band.js',
    // the folk instruments: the ward's handbells, the Social Hall's fiddle
    'kolob-voices-folk.js',
    // the ward's thirty-two voices (a throat each; the meeting's one
    // congregation)
    'kolob-voices-vocal.js',
    // the performers: the Sunday's ward and its people, the performer of
    // every hymn
    'kolob-cast.js',
    // the day's hymnal (it orders the meeting's hymns from the composer and
    // brings them back); the scaffold every guest room stands on (its
    // stream, its odds, its decision, its slices on the clock, its
    // teardown), ahead of the first of them; the trombone choir at dawn, the
    // ward's handbell choir and the singing school, each planning and
    // playing itself (the guests' room places them, the meeting seats them)
    'kolob-hymnal.js', 'kolob-guest-room.js',
    'kolob-guest-trombones.js', 'kolob-guest-handbells.js', 'kolob-guest-singingschool.js',
    // (the other guests, each planning and playing itself — the Nauvoo band
    // that marches, the handcart company, the gulls; the organist's
    // variations on a hymn and change ringing from a far tower; the gift of
    // tongues, the far ward and the Hosanna; the Social Hall; and the
    // testimony-bearers, who are not guests but the testimony's own people)
    'kolob-guest-bands.js', 'kolob-guest-handcart.js', 'kolob-guest-gulls.js',
    'kolob-guest-variations.js', 'kolob-guest-changes.js',
    'kolob-guest-tongues.js', 'kolob-guest-farward.js', 'kolob-guest-hosanna.js',
    'kolob-guest-socialhall.js', 'kolob-testimony.js',
    'kolob-guests.js',
    // the meeting's plan (pure: the Sunday, the order of service, every die
    // of meeting:<n>), ahead of the chorister who conducts it, who requires it
    'kolob-plan.js', 'kolob-meeting.js',
    // the facade
    'kolob-core.js',
];
