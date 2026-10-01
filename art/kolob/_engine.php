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
// facade over them. (A lab module joins this list on the day the engine first
// uses it — kolob-voices-folk.js did; kolob-question.js never did, and is in
// shelved/ since 2026-10-01 with the bagpipe;
// kolob-tunes.js joined in round 2, milestone 3, when the old tune began to
// sing the Earth tunes; kolob-voices-band.js and kolob-guest-trombones.js
// joined at round 2's integration, when the trombone choir began to play at
// dawn; kolob-voices-vocal.js and kolob-cast.js at round 3b, when the ward
// began to sing the meeting; kolob-organist.js and kolob-voices-pipeorgan.js
// at round 3b's second step, when the Sunday's organist took the bench;
// kolob-experimental.js, kolob-voices-folk.js, kolob-guest-handbells.js and
// kolob-guest-singingschool.js at its third, when the handbell choir and the
// singing school came into the meeting; kolob-calendar.js at its fourth, when
// every visit began to draw a Sunday of the colony year; the nine round-3c
// guests and kolob-testimony.js at round 3c's integration, when the guest
// budget began to seat them.)
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
    // the Sunday's organist (round 3b, step 2): pure planning — the chorale
    // prelude, the hymn in pieces, the walk into a new key — played on the
    // pipe organ among the voices
    'kolob-organist.js',
    // the experiments' switch (round 3b, step 3): the engine asks it once a
    // meeting before seating an experimental feature (the singing school);
    // ?exp=-singingSchool turns one off for a visit
    'kolob-experimental.js',
    // the Sunday of the colony year, the arc of light, the rites' seatings
    // and the Kolob reckoning (round 3b, step 4): pure; the meeting draws
    // the Sunday from it, and the composer's desk reads the reckoning in it
    'kolob-calendar.js',
    // the voices (the registrable pipe organ, round 3b, step 2: the meeting's
    // one organ — kolob-voices-organ.js keeps the old one as the A/B)
    'kolob-voices-pipeorgan.js',
    'kolob-voices-organ.js', 'kolob-voices-choir.js', 'kolob-voices-winds.js',
    'kolob-voices-ground.js', 'kolob-voices-field.js',
    // (the bagpipe, shelved by the owner on 2026-09-13, left the list on
    // 2026-10-01: its room and lab are in shelved/)
    'kolob-voices-band.js',
    // the folk instruments: the ward's handbells (round 3b, step 3)
    'kolob-voices-folk.js',
    // the ward's thirty-two voices (round 3b: a throat each; the meeting's
    // one congregation)
    'kolob-voices-vocal.js',
    // the performers (the trombone choir at dawn plans and plays itself;
    // the guests' room places it, the meeting seats it; the day's hymnal
    // orders the meeting's hymns from the composer and brings them back —
    // round 3's integration, when the meeting began to sing them)
    // the Sunday's ward and its people, the performer of every hymn (round 3b)
    'kolob-cast.js',
    // (and the guests who stand in the room — the ward's handbell choir and
    // the singing school — plan and play themselves, round 3b, step 3)
    'kolob-hymnal.js', 'kolob-guest-trombones.js', 'kolob-guest-handbells.js', 'kolob-guest-singingschool.js',
    // (round 3c: the new guests, each planning and playing itself — the
    // Nauvoo band that marches (it replaces the looping fife), the handcart
    // company, the gulls; the organist's variations on a hymn and change
    // ringing from a far tower; the gift of tongues, the far ward and the
    // Hosanna; the Social Hall; and the testimony-bearers, who are not
    // guests but the testimony's own people)
    'kolob-guest-bands.js', 'kolob-guest-handcart.js', 'kolob-guest-gulls.js',
    'kolob-guest-variations.js', 'kolob-guest-changes.js',
    'kolob-guest-tongues.js', 'kolob-guest-farward.js', 'kolob-guest-hosanna.js',
    'kolob-guest-socialhall.js', 'kolob-testimony.js',
    'kolob-guests.js', 'kolob-meeting.js',
    // the facade
    'kolob-core.js',
];
