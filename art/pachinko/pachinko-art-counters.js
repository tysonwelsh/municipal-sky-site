/* MOTHER LODE — the machine's own dials (the integration phase)
 *
 * Everything on the cabinet that answers the game, drawn over the art
 * director's cabinet in cabinet px, from view.ui (see pachinko-main.js):
 *
 *   right pillar, top      the SCRIP counter: three drums that roll one
 *                          mechanical tick per scrip this game (and count
 *                          back down as the scrip is paid out)
 *   right pillar, middle   a typed card on a nail over the coin door:
 *                          INSERT TOKEN, flipped to MODEL IN USE; a pilot
 *                          bulb; the coin going in; the door rattling on an
 *                          empty pocket; the nickel it finds in its return
 *   under the coin door    what's in your pocket: a brass token and two
 *                          drums, a pink ticket and three (the place knows)
 *   the ticket mouth       pink scrip feeding out at the payout, hanging
 *                          down the pillar, torn off at the end
 *   left pillar            the speaker grille (a rag stuffed in it when muted)
 *   the glass              PLEASE DO NOT TAP GLASS shivers when you do
 *
 * and, inside the glass (A.drawGlassFx, called by the renderer after the
 * emissive layer): bay cards that light when a marble pays in them (a
 * worthless bay's card just gets knocked), the scrip stub flipping up,
 * pockets that hop, the 13's card flaring.
 *
 * Deterministic: everything is a function of view.t and view.ui.
 */
(function (root) {
  'use strict';
  var A = root.PachinkoArt, S = A.S, P = A.PAL;
  var px = S.px, rect = S.rect, hline = S.hline, vline = S.vline, dither = S.dither;
  var disc = A.disc, bayer = A.bayer, line = A.line;
  var C = A.CAB;

  /* ── geometry (cabinet px) ──────────────────────────────────────── */
  var PIL = { x0: 351, x1: 369 };                              // the right pillar's usable face
  var K = A.COUNTERS = {
    tally: { x: 350, y: 77, w: 21, h: 23 },                    // the SCRIP drum counter
    sign: { nx: 360, ny: 255, x: 347, y: 262, w: 27, h: 22 },  // the flip card and its nail
    bulb: { x: 360, y: 250 },                                   // the pilot bulb over the card
    pocket: { x: 351, y: 347, w: 19, h: 21 },                   // tokens, scrip (your pocket)
    mouth: { x: 352, y: 372, w: 17, h: 5 },                     // the ticket mouth
    speaker: { x: 15, y: 246, r: 7 }                            // the grille on the left pillar
  };

  /* ── digits: tall odometer numerals (3 × 7) ─────────────────────── */
  var D7 = [
    ['###', '#.#', '#.#', '#.#', '#.#', '#.#', '###'],
    ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
    ['###', '..#', '..#', '###', '#..', '#..', '###'],
    ['###', '..#', '..#', '.##', '..#', '..#', '###'],
    ['#.#', '#.#', '#.#', '###', '..#', '..#', '..#'],
    ['###', '#..', '#..', '###', '..#', '..#', '###'],
    ['###', '#..', '#..', '###', '#.#', '#.#', '###'],
    ['###', '..#', '..#', '.#.', '.#.', '.#.', '.#.'],
    ['###', '#.#', '#.#', '###', '#.#', '#.#', '###'],
    ['###', '#.#', '#.#', '###', '..#', '..#', '###']
  ];
  var D5 = [
    ['###', '#.#', '#.#', '#.#', '###'], ['.#.', '##.', '.#.', '.#.', '###'], ['###', '..#', '###', '#..', '###'],
    ['###', '..#', '.##', '..#', '###'], ['#.#', '#.#', '###', '..#', '..#'], ['###', '#..', '###', '..#', '###'],
    ['###', '#..', '###', '#.#', '###'], ['###', '..#', '.#.', '.#.', '.#.'], ['###', '#.#', '###', '#.#', '###'],
    ['###', '#.#', '###', '..#', '###']
  ];
  function glyph(g, font, d, x, y, c, clipY0, clipY1) {
    var rows = font[d]; if (!rows) return;
    for (var j = 0; j < rows.length; j++) {
      var yy = y + j; if (yy < clipY0 || yy > clipY1) continue;
      for (var i = 0; i < 3; i++) if (rows[j][i] === '#') px(g, x + i, yy, c);
    }
  }
  // one drum in a window (wx, wy, ww, wh): digit `d` rolling in from `from`
  // (u 0..1, dir +1 = the new digit comes up from below, like an odometer)
  function drum(g, font, wx, wy, ww, wh, d, from, u, dir, ink, bg) {
    rect(g, wx, wy, ww, wh, bg);
    var gh = font[0].length, gx = wx + Math.floor((ww - 3) / 2), gy = wy + Math.floor((wh - gh) / 2);
    var y0 = wy, y1 = wy + wh - 1;
    if (u >= 1 || from === d) glyph(g, font, d, gx, gy, ink, y0, y1);
    else {
      var off = Math.round(u * wh) * dir;
      glyph(g, font, from, gx, gy - off, ink, y0, y1);
      glyph(g, font, d, gx, gy - off + wh * dir, ink, y0, y1);
    }
    // the drum's curve: the top and bottom rows fall into shadow
    hline(g, wx, wx + ww - 1, wy, 'rgba(0,0,0,0.55)');
    hline(g, wx, wx + ww - 1, wy + wh - 1, 'rgba(0,0,0,0.6)');
    px(g, wx, wy + 1, 'rgba(255,255,255,0.08)');
  }
  // a row of drums showing `value` (rolling from `prev`)
  function drums(g, font, x, y, n, ww, wh, gap, value, prev, u, dir, ink, bg) {
    value = Math.max(0, value | 0); prev = Math.max(0, prev | 0);
    var cap = Math.pow(10, n) - 1;
    value = Math.min(cap, value); prev = Math.min(cap, prev);
    for (var i = 0; i < n; i++) {
      var p10 = Math.pow(10, n - 1 - i);
      var d = Math.floor(value / p10) % 10, f = Math.floor(prev / p10) % 10;
      drum(g, font, x + i * (ww + gap), y, ww, wh, d, f, u, dir, ink, bg);
    }
  }
  function bezel(g, x, y, w, h) {
    rect(g, x - 1, y - 1, w + 2, h + 2, P.CASE0);
    rect(g, x, y, w, h, P.BRASS1);
    hline(g, x, x + w - 1, y, P.BRASS3); vline(g, x, y, y + h - 1, P.BRASS2);
    hline(g, x, x + w - 1, y + h - 1, P.BRASS0); vline(g, x + w - 1, y, y + h - 1, P.BRASS0);
    dither(g, x + 1, y + 1, w - 2, h - 2, P.BRASS0, 0.18);
  }
  function screw(g, x, y) { px(g, x, y, P.BRASS2); px(g, x + 1, y, P.BRASS0); px(g, x, y + 1, P.BRASS1); }

  /* ── the SCRIP counter ──────────────────────────────────────────── */
  function drawTally(g, ui, t) {
    var k = K.tally, tl = ui.tally || { value: 0, prev: 0, roll: 1, dir: 1 };
    bezel(g, k.x, k.y, k.w, k.h);
    // the label: a pink scrip stub riveted on, the same paper the bays pay in
    var lx = k.x + 1, ly = k.y + 2;
    rect(g, lx, ly, k.w - 2, 7, P.PINK_D); rect(g, lx, ly + 1, k.w - 2, 5, P.PINK);
    px(g, lx, ly + 3, P.BRASS1); px(g, lx + k.w - 3, ly + 3, P.BRASS1);   // the ticket's notches
    A.textC(g, 'SCRIP', k.x + k.w / 2 + 0.5, ly + 1, '#ffffff');
    // three drums behind a glass strip
    var wy = k.y + 11, lit = ui.mode === 'play' || ui.mode === 'dive' || ui.mode === 'payout';
    var ink = lit ? '#f4ecd8' : '#bdb4a0';
    drums(g, D7, k.x + 2, wy, 3, 5, 9, 1, tl.value, tl.prev, tl.roll, tl.dir || 1, ink, '#120e14');
    // the glass over the drums: one lit edge, a sheen pixel
    hline(g, k.x + 1, k.x + k.w - 2, wy - 1, P.BRASS0);
    px(g, k.x + 3, wy, 'rgba(255,255,255,0.25)');
    // a win makes the counter's little lamp wink (between the label and the drums)
    var justRolled = tl.roll < 1 && tl.dir > 0;
    px(g, k.x + k.w - 2, k.y + 10, justRolled ? P.FLAME1 : P.BRASS0);
    screw(g, k.x + 1, k.y + k.h - 2); screw(g, k.x + k.w - 3, k.y + k.h - 2);
  }

  /* ── the flip card and the pilot bulb ───────────────────────────── */
  function typedLine(g, str, cx, y, seed) {
    var w = A.textW(str), x = Math.round(cx - w / 2);
    A.text(g, str, x, y, P.INK, 1, function (i, col, row) {
      var h = A.hash01(seed, i, 0);
      if (h > 0.9 && row === 0) return P.INK_L;
      return P.INK;
    });
  }
  var SIDES = {
    insert: ['INSERT', 'TOKEN'],
    inuse: ['MODEL', 'IN USE']
  };
  function drawSign(g, ui, t) {
    var k = K.sign, sg = ui.sign || { side: 'insert', t0: -10 };
    var u = t - sg.t0;
    // the flip: five stop-motion frames (full, half, edge, half, full), the
    // side changing at the edge; then it swings on its string and settles
    var FR = [1, 0.55, 0.08, 0.55, 1], fi = u < 0 ? 0 : Math.min(4, Math.floor(u / 0.05));
    var sx = u < 0 || u > 0.25 ? 1 : FR[fi];
    var side = u < 0.1 ? (sg.side === 'insert' ? 'inuse' : 'insert') : sg.side;
    if (sg.t0 < 0) side = sg.side;
    var tap = ui.tap != null ? t - ui.tap : 9;
    var swing = u > 0.25 && u < 1.4 ? Math.round(Math.sin((u - 0.25) * 14) * 1.5 * (1 - (u - 0.25) / 1.15)) :
      tap < 0.9 ? Math.round(Math.sin(tap * 18) * (1 - tap / 0.9) * 1.6) : 0;
    // the nail and the string
    px(g, k.nx, k.ny, P.IRON4); px(g, k.nx + 1, k.ny + 1, P.IRON1);
    var w = Math.max(2, Math.round(k.w * sx)), cx = k.x + k.w / 2 + swing, x0 = Math.round(cx - w / 2);
    line(g, k.nx, k.ny + 1, x0 + 2, k.y, '#8a7e68'); line(g, k.nx, k.ny + 1, x0 + w - 3, k.y, '#8a7e68');
    // the card: nicotine cream, a darker rim, a shadow on the enamel
    rect(g, x0 + 1, k.y + 1, w, k.h, 'rgba(0,0,0,0.45)');
    rect(g, x0, k.y, w, k.h, sx < 0.2 ? P.PAPER_DD : P.PAPER);
    if (w > 6) {
      for (var yy = k.y; yy < k.y + k.h; yy++) for (var xx = x0; xx < x0 + w; xx++) {
        var e = Math.min(xx - x0, x0 + w - 1 - xx, yy - k.y, k.y + k.h - 1 - yy);
        if (e < 2 && bayer(xx, yy) < 0.45 - e * 0.2) px(g, xx, yy, P.PAPER_D);
      }
      // the hole the string goes through, reinforced
      px(g, Math.round(cx), k.y + 1, P.PAPER_DD);
    }
    if (sx < 0.9) return;
    var lines = SIDES[side] || SIDES.insert;
    typedLine(g, lines[0], cx + 0.5, k.y + 4, 71);
    typedLine(g, lines[1], cx + 0.5, k.y + 10, 72);
    if (side === 'insert') {
      // a typed arrow down to the slot, the way a typist draws one: v's
      var ax = Math.round(cx);
      px(g, ax - 2, k.y + 16, P.INK); px(g, ax + 2, k.y + 16, P.INK); px(g, ax - 1, k.y + 17, P.INK); px(g, ax + 1, k.y + 17, P.INK); px(g, ax, k.y + 18, P.INK);
      vline(g, ax, k.y + 15, k.y + 17, P.INK_L);
    } else {
      // a pencilled tick where the attendant initialled it
      px(g, Math.round(cx) + 7, k.y + 17, '#6a6a7a'); px(g, Math.round(cx) + 8, k.y + 18, '#6a6a7a'); px(g, Math.round(cx) + 9, k.y + 17, '#6a6a7a'); px(g, Math.round(cx) + 10, k.y + 16, '#6a6a7a');
    }
  }
  function drawPilot(g, ui, t) {
    var b = K.bulb, attract = ui.mode === 'attract';
    var tap = ui.tap != null ? t - ui.tap : 9;
    var on;
    if (!attract) on = 0;
    else if (ui.hoverCoin || tap < 0.9) on = tap < 0.9 ? (Math.floor(tap * 10) % 2 ? 1 : 0.2) : 1;
    else on = Math.floor(t * 2) % 2 === 0 ? 1 : 0.25;
    // the socket
    rect(g, b.x - 2, b.y - 1, 5, 4, P.CASE0); px(g, b.x - 2, b.y - 1, P.BRASS1); px(g, b.x + 2, b.y - 1, P.BRASS1);
    if (on >= 1) {
      rect(g, b.x - 1, b.y - 2, 3, 3, P.RED2); px(g, b.x, b.y - 1, '#ffb0a0'); px(g, b.x - 1, b.y - 2, '#ffe0d8');
      px(g, b.x - 2, b.y - 1, 'rgba(255,80,60,0.55)'); px(g, b.x + 2, b.y - 1, 'rgba(255,80,60,0.55)'); px(g, b.x, b.y - 3, 'rgba(255,80,60,0.55)');
    } else rect(g, b.x - 1, b.y - 2, 3, 3, on > 0 ? '#5a1a1e' : '#2a1216');
  }

  /* ── the coin door: the slot's glow, a token going in, the rattle,
   *    the nickel in the return ─────────────────────────────────────── */
  function drawCoin(g, ui, t) {
    var c = C.coin, attract = ui.mode === 'attract';
    var tap = ui.tap != null ? t - ui.tap : 9;
    // the slot glows in ATTRACT (a lamp behind it: that's where it starts)
    var glow = attract && (ui.hoverCoin || tap < 0.9 || Math.floor(t * 2) % 2 === 0);
    if (glow) { vline(g, c.x + 9, c.y + 6, c.y + 15, '#ffd060'); vline(g, c.x + 10, c.y + 7, c.y + 14, '#ff9a3a'); if (ui.hoverCoin) { px(g, c.x + 8, c.y + 10, 'rgba(255,208,96,0.5)'); px(g, c.x + 11, c.y + 10, 'rgba(255,208,96,0.5)'); } }
    // the token going in: a brass disc at the slit, then edge-on, then gone
    if (ui.coin) {
      var u = t - ui.coin.t0;
      if (u >= 0 && u < 0.3) {
        var fr = Math.floor(u / 0.075), x = c.x + 10, y = c.y + 10;
        if (fr === 0) { disc(g, x - 5.5, y + 0.5, 3.2, P.BRASS2); disc(g, x - 5.5, y + 0.5, 2, P.BRASS3); px(g, x - 7, y - 1, P.BRASS4); }
        else if (fr === 1) { rect(g, x - 3, y - 3, 3, 7, P.BRASS2); vline(g, x - 3, y - 3, y + 3, P.BRASS4); }
        else if (fr === 2) { vline(g, x - 1, y - 3, y + 3, P.BRASS3); }
      }
    }
    // an empty pocket: the door rattles in its frame, the slot goes dark
    if (ui.noTokens != null) {
      var nu = t - ui.noTokens;
      if (nu < 0.5) {
        var j = Math.floor(nu * 40) % 2 ? 1 : -1;
        g.drawImage(g.canvas, c.x - 1, c.y - 1, c.w + 2, c.h + 2, c.x - 1 + j, c.y - 1, c.w + 2, c.h + 2);
      }
    }
    // the found nickel: five tokens drop into the coin return, one by one
    if (ui.found) {
      var fu = t - ui.found.t0, rx = c.x + 7, ry = c.y + 38;
      var n = Math.min(ui.found.n || 5, Math.floor(fu / 0.12) + 1);
      if (fu < 4) for (var i = 0; i < n; i++) {
        var cx2 = rx + (i % 3) * 2, cy2 = ry - Math.floor(i / 3);
        px(g, cx2, cy2, i % 2 ? P.BRASS3 : P.BRASS2); px(g, cx2 + 1, cy2, P.BRASS1);
      }
    }
  }

  /* ── your pocket: tokens and scrip ──────────────────────────────── */
  var shown = { tokens: null, scrip: null, tPrev: null, sPrev: null, tT0: -9, sT0: -9 };
  function drawPocket(g, ui, t) {
    var k = K.pocket;
    bezel(g, k.x, k.y, k.w, k.h);
    // the counters roll when the balance changes (a draw-side memory: it
    // only decides the roll's direction and start, never the number)
    var tok = ui.tokens == null ? null : Math.max(0, ui.tokens | 0), scr = ui.scrip == null ? null : Math.max(0, ui.scrip | 0);
    if (shown.tokens !== tok) { shown.tPrev = shown.tokens == null ? tok : shown.tokens; shown.tokens = tok; shown.tT0 = t; }
    if (shown.scrip !== scr) { shown.sPrev = shown.scrip == null ? scr : shown.scrip; shown.scrip = scr; shown.sT0 = t; }
    if (t < shown.tT0) shown.tT0 = t; if (t < shown.sT0) shown.sT0 = t;
    var tu = Math.min(1, (t - shown.tT0) / 0.12), su = Math.min(1, (t - shown.sT0) / 0.12);
    // row 1: a brass token, and how many are in your pocket
    var y1 = k.y + 2;
    disc(g, k.x + 4.5, y1 + 3.5, 3, P.BRASS3); disc(g, k.x + 4.5, y1 + 3.5, 2, P.BRASS2); px(g, k.x + 3, y1 + 2, P.BRASS4); px(g, k.x + 5, y1 + 5, P.BRASS0);
    var none = ui.noTokens != null && t - ui.noTokens < 1.6 && tok === 0;
    var tink = none ? (Math.floor(t * 8) % 2 ? '#ff6a5a' : '#6a2a2a') : '#f1dc9a';
    if (tok == null) { A.text(g, '--', k.x + 10, y1 + 1, P.BRASS0); }
    else drums(g, D5, k.x + 9, y1, 2, 4, 7, 1, tok, shown.tPrev, tu, tok >= shown.tPrev ? 1 : -1, tink, '#120e14');
    // row 2: a pink ticket, and the scrip you're carrying
    var y2 = k.y + 11;
    if (scr != null && scr >= 1000) {
      drums(g, D5, k.x + 1, y2, 4, 4, 7, 0, scr, shown.sPrev, su, scr >= shown.sPrev ? 1 : -1, '#ffd0e6', '#120e14');
    } else {
      rect(g, k.x + 1, y2 + 1, 5, 5, P.PINK_D); rect(g, k.x + 2, y2 + 2, 3, 3, P.PINK); px(g, k.x + 1, y2 + 3, P.BRASS1); px(g, k.x + 5, y2 + 3, P.BRASS1);
      if (scr == null) A.text(g, '---', k.x + 7, y2 + 1, P.BRASS0);
      else drums(g, D5, k.x + 7, y2, 3, 4, 7, 0, scr, shown.sPrev, su, scr >= shown.sPrev ? 1 : -1, '#ffd0e6', '#120e14');
    }
  }

  /* ── the ticket mouth and the tongue of scrip ───────────────────── */
  function drawMouth(g, ui, t) {
    var m = K.mouth;
    rect(g, m.x - 1, m.y - 1, m.w + 2, m.h + 2, P.CASE0);
    rect(g, m.x, m.y, m.w, m.h, P.BRASS2);
    hline(g, m.x, m.x + m.w - 1, m.y, P.BRASS4); hline(g, m.x, m.x + m.w - 1, m.y + m.h - 1, P.BRASS0);
    rect(g, m.x + 2, m.y + 2, m.w - 4, 1, P.NIGHT0);
    px(g, m.x, m.y + 2, P.BRASS1); px(g, m.x + m.w - 1, m.y + 2, P.BRASS0);
    var tg = ui.tongue;
    if (!tg || t < tg.t0) return;
    var n = tg.n | 0; if (n <= 0 && tg.torn == null) return;
    var TW = 9, TL = 6, x0 = m.x + 4, y0 = m.y + 3;
    var room = C.lower.y0 - 1 - y0, hang = Math.min(n * TL, room);
    var fall = 0, fade = 1;
    if (tg.torn != null) {
      var fu = t - tg.torn;
      if (fu > 0.7) return;
      fall = Math.round(fu * fu * 520 + fu * 30); fade = 1 - fu / 0.7;
    }
    // the newest ticket is still coming out of the mouth (a feed of ~0.1 s)
    for (var i = 0; i < Math.ceil(hang / TL); i++) {
      var ty = y0 + i * TL + fall;
      if (ty > C.H) break;
      var h2 = Math.min(TL, y0 + hang - (y0 + i * TL));
      for (var yy = 0; yy < h2; yy++) {
        var Y = ty + yy; if (Y >= C.H) break;
        if (fade < 1 && bayer(x0, Y) > fade) continue;
        var edge = yy === TL - 1;                                          // the perforation
        for (var xx = 0; xx < TW; xx++) {
          var X = x0 + xx + ((i % 2) && tg.torn == null ? 0 : 0);
          if (fade < 1 && bayer(X, Y) > fade) continue;
          var c = xx === 0 ? P.PINK_D : xx === TW - 1 ? '#a8305f' : edge ? (xx % 2 ? P.PINK_D : P.PINK) : P.PINK;
          px(g, X, Y, c);
        }
        if (yy === 2) { px(g, x0 + 4, Y, '#ffffff'); px(g, x0 + 3, Y + 1, 'rgba(255,255,255,0.6)'); } // the printed 1
      }
    }
    // more than reaches the ledge: it folds up on the lip in an accordion
    var extra = n * TL - room;
    if (extra > 0 && tg.torn == null) {
      var folds = Math.min(10, Math.ceil(extra / TL)), ly = C.lower.y0 - 1;
      for (var f = 0; f < folds; f++) {
        var fx = x0 - 2 - (f % 2) * 3, fy = ly - 1 - f;
        hline(g, fx, fx + TW + 3, fy, f % 2 ? P.PINK_D : P.PINK);
      }
    }
  }

  /* ── the speaker grille (left pillar) and the rag ───────────────── */
  function drawSpeaker(g, ui, t) {
    var s = K.speaker;
    disc(g, s.x + 0.5, s.y + 0.5, s.r + 1, P.CASE0);
    disc(g, s.x + 0.5, s.y + 0.5, s.r, P.CASE1);
    for (var y = -s.r + 1; y < s.r; y += 2) for (var x = -s.r + 1; x < s.r; x += 2)
      if (x * x + y * y < (s.r - 1) * (s.r - 1)) px(g, s.x + x, s.y + y, P.NIGHT0);
    px(g, s.x - s.r + 1, s.y - 2, P.CASE4); px(g, s.x - 2, s.y - s.r + 1, P.CASE4);
    if (!ui.muted) {
      // the cone behind the grille breathes with the music, barely
      return;
    }
    // muted: somebody has stuffed a rag in it (grey, a knot, a loose end)
    var mu = ui.muteT0 != null ? t - ui.muteT0 : 9, pop = mu < 0.15 ? 1 : 0;
    var rx = s.x, ry = s.y - pop;
    [[-4, -2], [-3, -3], [-2, -4], [0, -4], [2, -3], [3, -2], [4, 0], [3, 2], [1, 3], [-1, 3], [-3, 2], [-4, 0]].forEach(function (q, i) {
      px(g, rx + q[0], ry + q[1], i % 3 ? '#b8b0a0' : '#8a8274');
    });
    rect(g, rx - 3, ry - 2, 7, 5, '#a8a090'); dither(g, rx - 3, ry - 2, 7, 5, '#d0c8b4', 0.4);
    px(g, rx, ry, '#6a6456'); px(g, rx + 1, ry, '#6a6456'); px(g, rx, ry + 1, '#8a8274');   // the knot
    // a loose end hanging out, a little grubby
    vline(g, rx + 4, ry + 3, ry + 9, '#a8a090'); px(g, rx + 5, ry + 10, '#8a8274'); px(g, rx + 4, ry + 10, '#b8b0a0');
  }

  /* ── PLEASE DO NOT TAP GLASS ────────────────────────────────────── */
  function drawStickerShiver(g, ui, t) {
    if (ui.tap == null) return;
    var u = t - ui.tap; if (u < 0 || u > 0.35) return;
    var s = C.sticker; if (!s) return;
    var dx = Math.floor(u * 50) % 2 ? 1 : -1, dy = Math.floor(u * 35) % 3 === 0 ? -1 : 0;
    g.drawImage(g.canvas, s.x, s.y, s.w + 1, s.h + 1, s.x + dx, s.y + dy, s.w + 1, s.h + 1);
  }

  A.drawMachine = function (g, view) {
    var ui = view.ui; if (!ui) return;
    var t = view.t || 0;
    drawTally(g, ui, t);
    drawPilot(g, ui, t);
    drawSign(g, ui, t);
    drawCoin(g, ui, t);
    drawPocket(g, ui, t);
    drawMouth(g, ui, t);
    drawSpeaker(g, ui, t);
    drawStickerShiver(g, ui, t);
  };

  /* ══ inside the glass: bays and pockets answering ══════════════════ */
  A.drawGlassFx = function (g, view, board) {
    var fx = view.fx || {}, t = view.t || 0, cards = A.bayCards || {};
    var bays = fx.bays;
    if (bays) for (var id in bays) {
      var b = bays[id], u = t - b.t0, cd = cards[id];
      if (!cd || u < 0 || u > 1.8) continue;
      if (cd.lode) {
        // the 13's card: a gold flare that throbs
        var on = u < 1.8 && Math.floor(u * 8) % 2 === 0;
        rect(g, cd.x - 1, cd.y - 1, cd.w + 2, cd.h + 2, on ? P.GOLD4 : P.GOLD2);
        rect(g, cd.x, cd.y, cd.w, cd.h, on ? '#3a2008' : '#1a0e04');
        A.textC(g, '13', cd.x + cd.w / 2, cd.y + 2, on ? '#ffffff' : P.GOLD5);
        continue;
      }
      if (!(b.value > 0)) {
        // a worthless bay: the card gets knocked and swings on its pin
        if (u < 0.3) {
          var dx = Math.round(Math.sin(u * 40) * (1 - u / 0.3));
          if (dx) g.drawImage(g.canvas, cd.x, cd.y, cd.w, cd.h, cd.x + dx, cd.y, cd.w, cd.h);
        }
        continue;
      }
      // a paying bay: the card comes up bright under its work light, and
      // the scrip stub flips up on its pin and back
      var k = u < 1.2 ? 1 : 1 - (u - 1.2) / 0.6;
      if (k <= 0) continue;
      for (var yy = cd.y; yy < cd.y + cd.h; yy++) for (var xx = cd.x; xx < cd.x + cd.w; xx++) if (bayer(xx, yy) < k) px(g, xx, yy, yy === cd.y ? '#fff4d8' : '#f0e2b8');
      if (k > 0.5) A.textC(g, cd.name, cd.x + cd.w / 2, cd.y + 2, P.INK);
      if (cd.stub) {
        var st = cd.stub, lift = u < 0.12 ? -2 : u < 0.2 ? -1 : 0;
        var flash = u < 0.6 && Math.floor(u * 10) % 2 === 0;
        rect(g, st.x, st.y + lift, st.w, st.h, flash ? '#ffffff' : P.PINK_D); rect(g, st.x + 1, st.y + 1 + lift, st.w - 2, st.h - 2, P.PINK);
        px(g, st.x, st.y + 3 + lift, P.VOID0); px(g, st.x + st.w - 1, st.y + 3 + lift, P.VOID0);
        A.textC(g, '+' + b.value, st.x + st.w / 2 + 0.5, st.y + 1 + lift, '#ffffff');
      }
    }
    // pockets: the pail (or the powder box) hops on its nail and a glint runs its rim
    var pk = fx.pockets;
    if (pk) for (var pid in pk) {
      var P2 = board.byId[pid], pu = t - pk[pid].t0;
      if (!P2 || pu < 0 || pu > 0.6) continue;
      var x0 = Math.round(P2.x - 10), y0 = Math.round(P2.y - 8);
      if (pu < 0.14) g.drawImage(g.canvas, x0, y0, 21, 21, x0, y0 - 1, 21, 21);
      var gx = Math.round(P2.x - 8 + (pu / 0.6) * 16);
      px(g, gx, Math.round(P2.y - 1), '#ffffff'); px(g, gx - 1, Math.round(P2.y - 1), P.FLAME1);
      // and a puff of coal dust out of it
      for (var q = 0; q < 5; q++) {
        var dy2 = Math.round(pu * 20 * (0.6 + A.hash01(q, 3, 1) * 0.6)), dx2 = Math.round((A.hash01(q, 5, 2) - 0.5) * 10 * pu * 3);
        if (bayer(q, dy2) < 1 - pu / 0.6) px(g, Math.round(P2.x) + dx2, Math.round(P2.y) - 2 - dy2, 'rgba(40,34,44,0.7)');
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
