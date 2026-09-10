/* ============================================================================
   THE JUNK DRAWER — jd-bench.js
   The curator's strip (?bench and, since 2026-09-05, ?admin): the key gate,
   the queue, the sync truth, and the curator-only acts around the turn card
   that JD_turn.curate seats. Loaded last. See jd-core.js for the file map.
   ========================================================================== */

/* ---- THE CURATOR'S BENCH (?bench) and ADMIN MODE (?admin) — JD_bench ------
   The re-rating driver for the curated backlog (owner, 2026-08-28; successor
   to rating-bench.html, which was its own page in its own visual language).
   The INSTRUMENT is the turn card itself — JD_turn.curate() seats an item's
   existing responses on the same bench, rail and podium a visitor gets, so
   the hours spent working the backlog are spent inside the real flow, and
   every refinement made along the way ships to visitors. This module is only
   the furniture AROUND that card: the key gate, the queue, the bottom strip,
   and the curator-only acts (scrap, rerun, skip, prev). Nothing of the
   card's chrome is duplicated here.

   TWO MODES, ONE STRIP (owner, 2026-09-05):
     ?bench — the backlog walk: the queue seats the next item that still
              needs the curator, and the strip carries skip / prev.
     ?admin — the key and nothing else: with it verified, every REPORT
              CARD renders its grades as scales the owner can change and
              save in place (jd-record.js owns that editor, 2026-09-10; the
              2026-09-05 version seated the item on this bench instead,
              which the owner found roundabout). The strip here only holds
              the gate, the build stamp and SIGN OUT.
   Both stand behind JD_admin (jd-core.js): the bench key, remembered per
   device, verified before anything paints, sent as X-Bench-Key on every
   keyed request. The server throttles wrong keys per address (429).

   STATE IS SERVER-SIDE (jd_ratings / jd_ranks / jd_submissions, via
   jd-item-rate.php with replace-on-refile semantics and jd-curate.php),
   which is what keeps a phone and a desktop working the same backlog in
   sync: finish an item on one, and the other learns on its next queue load
   — the strip refetches whenever the tab comes back to the front. Scrap and
   rerun are INTENTS, stamped on the item's submission for a session to
   apply later (`retired` lives in git-tracked entry.json; a rerun's
   drawings land as turn rows) — the bench itself commits nothing.

   A RERUN IS A REAL TURN, exactly as the old bench held: the intent goes
   on the record, then JD_turn.rerun() runs the ordinary four-model turn —
   darkroom, blind bench, podium, unveil — and its ratings file through
   jd-rate.php like any visitor's. The strip resumes the backlog when that
   turn's card comes down. */
(function () {
  if (!window.JD_admin || !JD_admin.on) return;
  var MODE = JD_admin.mode;             /* 'bench' | 'admin' */
  var ADMIN = MODE === 'admin';

  /* DIRECT ADDRESSING (owner, 2026-08-29): ?bench&item=<item_id> opens that
     one item on the bench whatever its flags say — the door back onto the
     bench for a LEGACY response the owner wants to keep in the drawer (rate
     it under the current rubric here, then scripts/keep-legacy.py applies
     the ratings and pins it). Responses the entry retired are not seated. */
  var directM = /[?&]item=([^&]+)/.exec(location.search);
  var directId = directM ? decodeURIComponent(directM[1]) : null;

  var API_Q = JD_API + '/api/jd-bench-queue.php';
  var API_R = JD_API + '/api/jd-item-rate.php';
  var API_C = JD_API + '/api/jd-curate.php';
  var BASE = '/art/junk-drawer/';

  var Q = null;             /* the queue payload */
  var curId = null;         /* the item on (or awaiting) the bench */
  var visited = [];         /* item_ids opened this session — prev walks it */
  var filedNow = {};        /* item_id -> true once its batch filed */
  var svgCache = {};        /* svg path -> document text */
  var intent = null;        /* why the card is coming down: scrap|skip|prev|rerun */
  var rerunFor = null;      /* item_id whose rerun turn holds the stage */
  var stale = false;        /* a deploy landed since this page loaded */
  var sync = { state: 'idle', detail: '' };
  var bar = null, sheet = null;

  var esc = JD_esc;
  function itemById(id) {
    var list = (Q && Q.items) || [];
    for (var i = 0; i < list.length; i++) if (list[i].item_id === id) return list[i];
    return null;
  }
  function tag() {
    return '<span class="jd-bench-tag" aria-hidden="true">' + (ADMIN ? 'ADMIN' : 'BENCH') + '</span>';
  }
  function outHTML() {
    return '<button type="button" class="jd-bench-out" data-bench="out" ' +
      'title="forget the key on this device">sign out</button>';
  }

  /* ---------- what still needs the curator ------------------------------- */
  /* the intents arrive on the item itself (retire_requested /
     rerun_requested, read off the submission's columns by the queue) */
  function itemDone(it) {
    var live = it.responses.filter(function (r) { return !r.retired; });
    var multi = live.length > 1;
    for (var i = 0; i < live.length; i++) {
      var r = live[i];
      if (!r.complete) return false;
      if (multi && !(r.rank >= 1)) return false;
    }
    /* A TURN IS NOT DONE UNTIL IT IS SIZED (2026-08-30). A turn earns its
       place in the drawer by being promoted into an item, and an item
       cannot be filed without a size — the one field the rubric never
       covered. Items rated from a tab still running the pre-size-card
       script filed with no size at all and then counted as finished, which
       put them beyond the bench's reach with nothing to promote. They come
       back now, and open straight on the card that is missing. (A curated
       item already carries its size in its entry, so this asks nothing of
       the corpus.) */
    if (it.source === 'turn' && !it.size_filed) return false;
    return true;
  }
  /* AN INTENT IS NOT AN OUTCOME (owner report, 2026-08-30). Pressing RERUN
     files the flag at once, and the flag alone used to retire an item from
     the backlog — so a rerun that never finished (a closed window, a turn
     left unrated, a slot that timed out) left the item in LIMBO: marked
     sent, never returned, never decided. Four items sat there. Now the flag
     only settles an item once the rerun LANDED (a rated turn on the same
     prompt — the queue answers that with rerun_landed), and an unlanded one
     comes back to the bench for the owner to scrap or rerun afresh. SCRAP
     is different and stays absolute: it is a decision, not a pending act.
     (An older queue payload carries no rerun_landed; treating the flag as
     landed then keeps the pre-2026-08-30 behaviour rather than flooding a
     stale client's backlog with items it thinks are already handled.) */
  function rerunPending(it) {
    return !!it.rerun_requested && it.rerun_landed === false;
  }
  /* the responses the card can seat: on disk or in the database, and not
     retired by the entry (a rerun set's retired originals stay on file for
     the record — jd-curated-sync — but never come to the bench) */
  function seatable(it) {
    return it.responses.filter(function (r) { return !!(r.svg || r.svg_url) && !r.retired; });
  }
  function workable(it) {
    if (it.retired || it.retire_requested) return false;
    var n = seatable(it).length;
    if (!n || n > 4) return false;           /* the card seats four at most */
    if (rerunPending(it)) return true;      /* unfinished business, always */
    return !itemDone(it) && !it.rerun_requested;
  }
  function firstWorkable(afterId) {
    var list = (Q && Q.items) || [], start = 0, i;
    if (afterId) {
      for (i = 0; i < list.length; i++) {
        if (list[i].item_id === afterId) { start = i + 1; break; }
      }
    }
    for (i = start; i < list.length; i++) if (workable(list[i])) return list[i];
    /* wrap once — items skipped earlier come round again */
    for (i = 0; i < start; i++) if (workable(list[i])) return list[i];
    return null;
  }
  function counts() {
    var list = (Q && Q.items) || [];
    var c = { left: 0, scrapped: 0, rerun: 0, resp: 0, respDone: 0 };
    list.forEach(function (it) {
      if (it.retired) return;
      if (it.retire_requested) { c.scrapped++; return; }
      /* a rerun the owner asked for and that LANDED is settled; one that
         never landed is back in the queue, so it counts as work to go */
      if (it.rerun_requested && !rerunPending(it)) { c.rerun++; return; }
      if (rerunPending(it) || !itemDone(it)) c.left++;
      it.responses.forEach(function (r) {
        if (r.retired) return;
        c.resp++;
        if (r.complete) c.respDone++;
      });
    });
    return c;
  }

  /* ---------- the wire ---------------------------------------------------- */
  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: JD_admin.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () {
        return { ok: false, error: { code: 'server_error' } };
      });
    }).then(function (j) {
      if (!j || !j.ok) throw ((j && j.error) || { code: 'network' });
      /* the write endpoint names its own build — a mismatch means a deploy
         landed under this page, and the rubric could have moved */
      if (j.build && Q && Q.build && j.build !== Q.build.build) stale = true;
      return j;
    });
  }
  function setSync(state, detail) {
    sync = { state: state, detail: detail || '' };
    paintBar();
  }

  /* the curate card's file() callback: one item — every response's grades
     and rank, and the size — filed as ONE request. jd-item-rate.php writes
     the whole batch in a single transaction (since 2026-09-05; it used to
     take one generation per request, which could leave an item half-filed
     when a later request failed), and replace-on-refile makes a retry
     converge rather than double. The size lands on the item's submission
     (size_class), where data.php now reads it straight onto the item. */
  function fileItem(it, per, size) {
    setSync('saving');
    var body = { submission_id: it.submission_id, responses: [] };
    if (size) body.size = size;
    per.forEach(function (p) {
      body.responses.push({
        generation_id: p.generation_id,
        grade: p.grade != null ? p.grade : null,
        axes: p.axes || {},
        rank: p.rank >= 1 ? p.rank : null
      });
    });
    return post(API_R, body).then(function () {
      if (size) it.size_filed = size;      /* the queue copy learns it now */
      filedNow[it.item_id] = true;
      /* fold the answers back into the queue copy, so done/left arithmetic
         and any revisit read what the server now holds */
      it.responses.forEach(function (r) {
        for (var i = 0; i < per.length; i++) {
          if (per[i].generation_id !== r.generation_id) continue;
          r.axes = per[i].axes;
          r.grade = per[i].grade;
          if (per[i].rank >= 1) r.rank = per[i].rank;
          r.complete = true;   /* it passed the card's own gate to get here */
        }
      });
      setSync('saved');
    }, function (err) {
      setSync('failed', (err && err.code) || '');
      throw err;
    });
  }

  /* a standing intent on the item — 'retire' (scrap) or 'rerun' — stamped
     on its submission through jd-curate.php */
  function fileIntent(it, which) {
    setSync('saving');
    var body = { submission_id: it.submission_id };
    body[which] = true;
    post(API_C, body).then(function () { setSync('saved'); },
      function (err) { setSync('failed', (err && err.code) || ''); });
    /* the local queue copy learns it now — the strip must not re-offer an
       item the curator just dispatched, whatever the wire is doing */
    it[which + '_requested'] = true;
  }

  /* ---------- seating an item on the bench ------------------------------- */
  function openItem(it) {
    if (!it) { curId = null; paintBar(); return; }
    curId = it.item_id;
    if (visited[visited.length - 1] !== it.item_id) visited.push(it.item_id);
    hideSheet();
    paintBar();
    /* a curated response's artwork is a file under the item; a TURN's lives
       in the database and comes from jd-gen-svg.php (2026-08-30). One cache,
       keyed on whichever address the response carries. */
    var usable = seatable(it);
    Promise.all(usable.map(function (r) {
      var key = r.svg || r.svg_url;
      if (svgCache[key]) return null;
      return fetch(r.svg ? (BASE + r.svg) : (JD_API + r.svg_url), {
        headers: JD_admin.headers()
      }).then(function (res) {
        if (!res.ok) throw new Error('svg ' + res.status);
        return res.text();
      }).then(function (t) { svgCache[key] = t; });
    })).then(function () {
      if (curId !== it.item_id) return;   /* the curator moved on mid-fetch */
      var models = (Q && Q.models) || {};
      window.JD_turn.curate({
        prompt: it.prompt,
        /* the closing size card's scale, and the tier already on file —
           the bench's own last word first, else the entry's (2026-08-30) */
        sizeTiers: (Q && Q.size_tiers) || [],
        size: it.size_filed || it.size_class || null,
        responses: usable.map(function (r) {
          /* the bench's own answers outrank the seeds: a turn arrives
             carrying the judgment its visitor pass filed under today's
             rubric (axes_seed/grade_seed/rank_seed), which prefills the
             card for the owner to confirm or change (2026-08-30) */
          var ax = r.axes && Object.keys(r.axes).length ? r.axes
                 : (r.axes_seed || {});
          return {
            generation_id: r.generation_id,
            svg: svgCache[r.svg || r.svg_url] || '',
            model_id: r.model_id,
            label: models[r.model_id] || r.model_id,
            axes: ax,
            grade: r.grade,
            grade_seed: r.grade_seed,
            rank: r.rank != null ? r.rank : r.rank_seed
          };
        }),
        /* the size rides through with the ratings — the card hands it to
           this callback, which used to drop it on the floor (2026-08-30) */
        file: function (per, size) { return fileItem(it, per, size); }
      });
      paintBar();
    }, function () {
      setSync('failed', 'svg fetch');
    });
  }

  /* ---------- the card coming down --------------------------------------- */
  window.addEventListener('jd-turn-close', function () {
    var why = intent;
    intent = null;
    if (ADMIN) { paintBar(); return; }   /* nothing is ever seated in admin mode */
    if (why === 'rerun') {
      var rr = itemById(rerunFor);
      if (rr && window.JD_turn.rerun(rr.prompt)) { paintBar(); return; }
      rerunFor = null;                   /* the turn refused to start */
      openItem(firstWorkable(curId));
      return;
    }
    if (rerunFor) {
      /* the rerun turn itself just closed — back to the backlog */
      rerunFor = null;
      openItem(firstWorkable(curId));
      return;
    }
    if (why === 'scrap' || why === 'skip') { openItem(firstWorkable(curId)); return; }
    if (why === 'prev') return;          /* act() reopens the earlier item */
    if (curId && filedNow[curId] && itemById(curId) && !workable(itemById(curId))) {
      openItem(firstWorkable(curId));    /* filed and dismissed — next */
      return;
    }
    paintBar();                          /* set aside — the strip offers resume */
  });

  /* ---------- the strip's acts ------------------------------------------- */
  function act(kind) {
    var it = itemById(curId);
    var open = window.JD_turn.isOpen();
    if (kind === 'out') {
      /* forget the key on this device and leave the mode: the plain drawer */
      JD_admin.signOut();
      location.href = location.pathname;
    } else if (kind === 'skip') {
      if (open) { intent = 'skip'; window.JD_turn.close(); }
      else openItem(firstWorkable(curId));
    } else if (kind === 'scrap') {
      if (!it) return;
      fileIntent(it, 'retire');
      if (open) { intent = 'scrap'; window.JD_turn.close(); }
      else openItem(firstWorkable(curId));
    } else if (kind === 'rerun') {
      if (!it) return;
      fileIntent(it, 'rerun');
      rerunFor = it.item_id;
      if (open) { intent = 'rerun'; window.JD_turn.close(); }
      else if (!window.JD_turn.rerun(it.prompt)) { rerunFor = null; }
      paintBar();
    } else if (kind === 'resume') {
      if (!open) openItem(it || firstWorkable(null));
    } else if (kind === 'prev') {
      if (visited.length < 2) return;
      visited.pop();
      var back = itemById(visited[visited.length - 1]);
      if (open) { intent = 'prev'; window.JD_turn.close(); }
      if (back) openItem(back);
    } else if (kind === 'prompt') {
      toggleSheet();
    }
  }

  /* ---------- the strip --------------------------------------------------- */
  function buildBar() {
    if (bar) return;
    document.documentElement.classList.add('jd-bench-on');
    sheet = document.createElement('div');
    sheet.className = 'jd-bench-sheet';
    sheet.hidden = true;
    document.body.appendChild(sheet);
    bar = document.createElement('div');
    bar.className = 'jd-bench-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', ADMIN ? 'admin strip' : 'curator’s bench');
    document.body.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-bench]') : null;
      if (b) act(b.getAttribute('data-bench'));
    });
  }
  function hideSheet() { if (sheet) sheet.hidden = true; }
  function toggleSheet() {
    var it = itemById(curId);
    if (!sheet || !it) return;
    if (!sheet.hidden) { sheet.hidden = true; return; }
    sheet.innerHTML =
      '<b>' + esc(it.title) + '</b> · ' + esc(String(it.created).slice(0, 10)) +
      ' · ' + it.responses.length +
      (it.responses.length === 1 ? ' response' : ' responses') +
      '<p>' + esc(it.prompt) + '</p>';
    sheet.hidden = false;
  }
  function syncHTML() {
    if (sync.state === 'saving') return '<span class="jd-bench-sync is-saving">saving…</span>';
    if (sync.state === 'saved') return '<span class="jd-bench-sync is-saved">✓ filed</span>';
    if (sync.state === 'failed') {
      return '<span class="jd-bench-sync is-failed">⚠ ' +
        esc(sync.detail || 'failed') + '</span>';
    }
    return '';
  }
  function stampHTML() {
    var b = (Q && Q.build) || null;
    var info = JD_admin.info();
    if (stale) return '<span class="jd-bench-build is-stale">a deploy landed — reload before rating on</span>';
    if (b) {
      return '<span class="jd-bench-build">' +
        esc(b.version + ' · ' + b.build + ' · tax v' + Q.taxonomy_version) + '</span>';
    }
    if (info && info.build) {
      return '<span class="jd-bench-build">' +
        esc((info.version || '') + ' · ' + info.build + ' · tax v' + info.taxonomy_version) + '</span>';
    }
    return '';
  }
  function paintBar() {
    if (!bar) return;
    var c = counts();
    var it = itemById(curId);
    var open = window.JD_turn.isOpen();
    var left = '';
    if (rerunFor) {
      left = '<span class="jd-bench-note">rerun running — it files as a real turn</span>';
    } else if (it) {
      left = (ADMIN ? '' : '<span class="jd-bench-pos">' + c.left + ' to go</span>') +
        '<button type="button" class="jd-bench-title" data-bench="prompt" ' +
        'title="the item’s prompt">' + esc(it.title) + '</button>' +
        (!open ? '<button type="button" data-bench="resume">resume</button>' : '');
    } else if (ADMIN) {
      left = '<span class="jd-bench-note">open any report card — its grades are yours to change and save</span>';
    } else {
      left = '<span class="jd-bench-note">backlog clear — ' + c.respDone + '/' +
        c.resp + ' responses filed' +
        (c.scrapped ? ', ' + c.scrapped + ' scrapped' : '') +
        (c.rerun ? ', ' + c.rerun + ' sent to rerun' : '') + '</span>';
    }
    var acts = (it && !rerunFor && !ADMIN)
      ? '<div class="jd-bench-acts">' +
        (visited.length > 1 ? '<button type="button" data-bench="prev" title="previous item">&larr;</button>' : '') +
        '<button type="button" data-bench="skip" title="set this item aside for now">skip &rarr;</button>' +
        '<button type="button" class="jd-bench-scrap" data-bench="scrap" ' +
        'title="flag this item to be retired from the drawer">scrap ✕</button>' +
        '<button type="button" class="jd-bench-rerun" data-bench="rerun" ' +
        'title="re-issue this prompt to the four current models, as a real turn">rerun ↻</button>' +
        '</div>'
      : '';
    bar.innerHTML = tag() + left + syncHTML() + acts + stampHTML() + outHTML();
  }

  /* ---------- the gate and the queue -------------------------------------- */
  function gateMsg(code, retry) {
    if (code === 'too_many_attempts') {
      return 'too many wrong keys — try again in ' +
        Math.max(1, Math.ceil((retry || 3600) / 60)) + ' min —';
    }
    if (code === 'forbidden') return JD_admin.key() ? 'the key was refused —' : '';
    return 'the gate didn’t answer (' + (code || 'network') + ') —';
  }
  function gate(msg) {
    if (!bar) buildBar();
    bar.innerHTML = tag() +
      '<label class="jd-bench-gate">' + (msg ? esc(msg) + ' ' : '') +
      'bench key <input type="password" autocomplete="off"></label>';
    var input = bar.querySelector('input');
    input.focus();
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      JD_admin.setKey(input.value);
      boot();
    });
  }
  /* the queue, keyed; resolves Q, rejects with the error code */
  function fetchQueue() {
    /* the timestamp defeats any cache that ignores the endpoint's no-store
       headers (the host's edge cache was caught serving a stale queue,
       2026-08-28) — a cached queue would quietly break cross-device sync */
    return fetch(API_Q + '?t=' + Date.now(), { headers: JD_admin.headers() })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw (((j || {}).error || {}).code || 'network');
        Q = j;
        return j;
      }, function () { throw 'network'; });
  }
  function loadQueue(quiet) {
    if (!quiet && bar) {
      bar.innerHTML = tag() + '<span class="jd-bench-note">loading the queue…</span>';
    }
    fetchQueue().then(function () {
      var open = window.JD_turn.isOpen();
      /* the directly-addressed item takes the stage first, flags or not —
         once, so filing it advances into the ordinary queue */
      if (directId && !open && !rerunFor) {
        var direct = itemById(directId);
        directId = null;
        if (direct) { openItem(direct); return; }
      }
      if (!open && !rerunFor) {
        /* nothing on the stage: seat the current item if it still needs
           work (it may have been finished on another device), else move on */
        var cur = itemById(curId);
        if (!cur || !workable(cur)) openItem(firstWorkable(curId));
        else paintBar();
      } else {
        paintBar();
      }
    }, function (code) {
      if (code === 'forbidden' || code === 'too_many_attempts') { gate(quiet ? '' : gateMsg(code)); return; }
      if (!quiet) gate(gateMsg(code));
    });
  }

  /* the key first, then the mode: the gate on refusal, the queue walk on
     ?bench, the idle strip on ?admin (or the addressed item, if any) */
  function boot() {
    if (!bar) buildBar();
    bar.innerHTML = tag() + '<span class="jd-bench-note">checking the key…</span>';
    JD_admin.verify().then(function (res) {
      if (!res.ok) { gate(gateMsg(res.code, res.retry_after)); return; }
      if (!ADMIN) { loadQueue(false); return; }
      paintBar();
      /* a deep-linked card may have painted before the key verified: repaint
         so its grades come up as the editor */
      if (window.JD_record && window.JD_record.refresh) window.JD_record.refresh();
    });
  }

  window.addEventListener('jd-turn-open', function () { paintBar(); });

  /* the other device may have moved the backlog — refetch when this tab
     comes back to the front (never mid-card: an open card is not disturbed) */
  document.addEventListener('visibilitychange', function () {
    if (!ADMIN && document.visibilityState === 'visible' && Q) loadQueue(true);
  });

  buildBar();
  boot();
})();
