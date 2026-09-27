// ============================================================================
// KOLOB — kolob-score.js: the score as it is written
//
// Round 2's first page of the Score (SCORE.md §5; the composer's Hymn, Line
// and Note will join it): THE CHORD BOOK, the harmony of the hall set down
// against the music's own clock.
//
// Why a book. The choir writes its verse half a minute ahead — two lines
// harmonized in one turn, every chord placed at the time it will be sung.
// Before round 2 the harmony engine remembered only the LAST chord it had
// voiced, so while the congregation was still on the first line, the organ,
// the harmonium, the strings and the deacon's chord-tone lean all read the
// last chord of the second: a chord from the future. Now every chord that is
// sung or played is written into the book at its own time, and "the current
// chord" is a question asked of a time — what stands at t? — not of the
// order in which the voices happened to write.
//
// Pure (SCORE.md §1): no audio, no clock, no dice, no DOM, no KOLOB._s. The
// house keeps one book per tuning (kolob-meeting.js, THE CHORD DESK); a
// composer or a lab may keep books of its own.
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Score = (function () {
  "use strict";

  // THE CHORD BOOK. Entries are { t, chord, by }, kept in order of t; a chord
  // written at the same t as another stands after it (the later word wins).
  //   write(chord, t, by) → the chord's id (also set on the chord, so the
  //                         notes that follow it can say which chord it was)
  //   at(t)               → the chord that stands at t: the latest one
  //                         written at or before t — sounding, or still
  //                         ringing in the room after the voices breathe —
  //                         or null when nothing has been written yet
  //   reset()             → a clean page (a new meeting; a sunrise changes
  //                         the tuning): no chord of the old page leads the
  //                         new one, even one written for later
  // Only the last ten minutes are kept, and the chord standing before them.
  var KEEP_S = 600;
  function chordBook() {
    var entries = [];
    var nextId = 1;
    var page = 0;
    // the first index whose entry stands strictly after t
    function after(t) {
      var lo = 0, hi = entries.length;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (entries[mid].t <= t) lo = mid + 1; else hi = mid; }
      return lo;
    }
    function write(chord, t, by) {
      if (!chord) return null;
      if (chord.id == null) chord.id = nextId++;
      entries.splice(after(t), 0, { t: t, chord: chord, by: by || "" });
      // forget the far past, but keep the chord that stood at its edge
      var edge = after(t - KEEP_S) - 1;
      if (edge > 0) entries.splice(0, edge);
      return chord.id;
    }
    function at(t) {
      var i = after(t) - 1;
      return i >= 0 ? entries[i].chord : null;
    }
    function reset() { entries = []; page++; }
    return {
      write: write, at: at, reset: reset,
      page: function () { return page; },
      size: function () { return entries.length; },
    };
  }

  return { chordBook: chordBook };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-score.js"] = true;   // the load guard's roll call
