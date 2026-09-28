<?php
// ============================================================================
// KOLOB — _engine.php: the engine's rooms, in the order they are loaded.
//
// THE ONE LIST (round 2). Before it, the module list was written out four
// times — index.php, room-lab.php, tune-lab.php and the harness — and a
// stale copy failed silently. Now every page that plays the engine reads it
// from here:
//
//   $kolob_engine = require __DIR__ . '/_engine.php';
//   kolob_engine_tags($kolob_engine, 'kolob_v');   // the <script> tags + the load guard
//
// and the harness (art/kolob/_harness.js) reads this same file, so a module
// added here is loaded everywhere at once. The order is SCORE.md §1's: the
// Jukebox v2 substrate first (read-only, by relative path — never modified
// from Kolob), then pitch, the score and the Earth tunes, the composers,
// the voices, the performers, and last the core that raises the KolobAudio
// facade over them. (The lab modules — kolob-question.js, kolob-voices-vocal/
// -pipeorgan/-folk.js — join this list on the day the engine first uses
// them; kolob-tunes.js joined in round 2, milestone 3, when the old tune
// began to sing the Earth tunes; kolob-voices-band.js and
// kolob-guest-trombones.js joined at round 2's integration, when the
// trombone choir began to play at dawn.)
//
// THE LOAD GUARD. Each kolob-*.js room answers a roll call as its last act
// (KOLOB._rooms["kolob-organ.js"] = true), and the substrate — and the Earth
// tunes, whose file answers no roll call (it is the tunes crew's) — are
// checked by the globals they raise; kolob_engine_tags() prints a guard that names every room
// that did not answer, so a missing or broken module is reported at load, not
// as "S.x is not a function" at the first cue that needs it.
// ============================================================================

if (!function_exists('kolob_engine_tags')) {
    // Echo one <script> per room, cache-busted by $version_of($file), then the
    // load guard. $version_of is the page's own hash helper (kolob_v, otl_v…).
    function kolob_engine_tags(array $engine, $version_of)
    {
        foreach ($engine as $js) {
            echo '<script src="' . htmlspecialchars($js) . '?v=' . call_user_func($version_of, $js) . '"></script>' . "\n";
        }
        $names = array_map('basename', $engine);
        echo '<script>(function () {'
            . 'var need = ' . json_encode($names) . ', K = window.KOLOB || {}, r = K._rooms || {}, P = window.PJ2 || {},'
            . ' sub = { "pj2-rand.js": P.Rand, "pj2-clock.js": P.Clock, "pj2-fx.js": P.Fx, "kolob-tunes.js": K.Tunes }, miss = [];'
            . ' need.forEach(function (f) { if (f in sub ? !sub[f] : !r[f]) miss.push(f); });'
            . ' if (!window.KolobAudio) miss.push("the KolobAudio facade");'
            . ' if (miss.length) console.error("KOLOB AUDIO ENGINE FAILED TO LOAD: " + miss.join(", "));'
            . '})();</script>' . "\n";
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
    // the hymn composer (round 3, M1): pure, loaded ahead of the performers;
    // the engine begins singing its hymns in round 3's integration
    'kolob-dialects.js', 'kolob-hymnists.js', 'kolob-composer.js',
    // the voices
    'kolob-voices-organ.js', 'kolob-voices-choir.js', 'kolob-voices-winds.js',
    'kolob-voices-ground.js', 'kolob-voices-field.js', 'kolob-voices-bagpipe.js',
    'kolob-voices-band.js',
    // the performers (the trombone choir at dawn plans and plays itself;
    // the guests' room places it, the meeting seats it; the day's hymnal
    // orders the meeting's hymns from the composer and brings them back —
    // round 3's integration, when the meeting began to sing them)
    // round 3's new guests, loaded but not yet seated by the meeting (the
    // experimental registry first: the planner will consult it)
    'kolob-experimental.js', 'kolob-guest-handbells.js', 'kolob-guest-singingschool.js',
    // the organist (round 3): plans and a performer on the registrable pipe
    // organ; loaded but not yet seated by the meeting
    'kolob-voices-pipeorgan.js', 'kolob-organist.js',
    'kolob-hymnal.js', 'kolob-guest-trombones.js', 'kolob-guests.js', 'kolob-meeting.js',
    // the facade
    'kolob-core.js',
];
