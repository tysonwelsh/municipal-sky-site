/* ============================================================================
   THE JUNK DRAWER — jd-bench.js
   The curator's strip (?bench and, since 2026-09-05, ?admin): the key gate,
   the queue, the sync truth, and the curator-only acts around the turn card
   that JD_turn.curate seats. Loaded last. See jd-core.js for the file map.
   ========================================================================== */

/* ---- THE CURATOR'S BENCH (?bench) and ADMIN MODE (?admin) — JD_bench ------
   The re-rating driver for the backlog (owner, 2026-08-28; successor to the
   retired first instrument, removed at the v2 cutover). The INSTRUMENT is the turn card itself —
   JD_turn.curate() seats a run's drawings on the same bench, rail, podium
   and head to head a visitor gets, so the hours spent working the backlog
   are spent inside the real flow, and every refinement made along the way
   ships to visitors. This module is only the furniture AROUND that card:
   the key gate, the queue, the bottom strip, and the curator-only acts
   (new prompt, scrap, rerun, skip, prev, hidden items).

   ON DATASET v2 (PLAN-V2 §5, Phase 4b, 2026-10-01). The queue is
   /api/jd2-queue.php: one row per PROMPT whose bench run (the run the owner
   chose to show, else the newest) has no complete OWNER sitting. Whether a
   prompt is done is the payload's `complete`, and what it still lacks is
   its `needs` — read, never re-derived here. Filing is ONE owner session
   through /api/jd2-rate.php: the grades and axes by slot, the podium as a
   ranking, the six head-to-head scores as DIRECT pairs, the size, and the
   sitting's "notes for the record". Sessions are append-only: re-rating a
   prompt files a new sitting, nothing is replaced. The bench is BLIND —
   the queue names no model unless the page was opened with ?reveal=1; the
   names arrive with the filing's own reveal (jd2-rate.php is the one place
   identity is released), which is what the unveil prints.

   TWO MODES, ONE STRIP (owner, 2026-09-05):
     ?bench — the backlog walk: the queue seats the next prompt that still
              needs the owner, and the strip carries skip / prev / scrap /
              rerun, NEW PROMPT, HIDDEN ITEMS and the ledger link.
              ?bench&prompt=<id> seats that one prompt in any state (a
              closed one comes back with its prefill); ?bench&item=<id> is
              the same, kept as an alias for one release.
     ?admin — the key and the hidden list: with it verified, every REPORT
              CARD renders its grades as scales the owner can change and
              save in place (jd-record.js owns that editor). The strip here
              holds the gate, HIDDEN ITEMS, the ledger link, the build stamp
              and SIGN OUT.
   Both stand behind JD_admin (jd-core.js): the bench key, remembered per
   device, verified before anything paints, sent as X-Bench-Key on every
   keyed request. The server throttles wrong keys per address (429).

   THE OWNER'S RUNS. A NEW PROMPT (the owner's only way to add an item — no
   files, no git) and a RERUN both draw through jd2-generate's owner path
   under the `bench` profile, four slots one after another on one
   client_ref, in the ordinary darkroom (JD_turn.ownerRun). When the run
   lands the card comes down, the queue is re-read for that prompt, and its
   new run is seated for rating at once. SCRAP hides the prompt
   (jd2-curate visibility 'hidden'); HIDDEN ITEMS lists every hidden prompt
   from the ledger, and SHOW puts one back — live when a sitting on it was
   ever complete, else draft. STATE IS SERVER-SIDE, which keeps a phone and
   a desktop on the same backlog: the strip refetches whenever the tab comes
   back to the front. */
(function () {
  if (!window.JD_admin || !JD_admin.on) return;
  var MODE = JD_admin.mode;             /* 'bench' | 'admin' */
  var ADMIN = MODE === 'admin';

  /* DIRECT ADDRESSING: ?bench&prompt=<prompt id> seats that prompt whatever
     its state (the ledger's RE-RATE link). ?bench&item=<id> is the v1 name
     for the same door, kept as an alias for one release. */
  var directM = /[?&](?:prompt|item)=([^&#]+)/.exec(location.search);
  var directId = directM ? decodeURIComponent(directM[1]) : null;
  /* ?reveal=1 asks the queue for model ids — the bench is blind without it */
  var REVEAL = /[?&]reveal=1(?:&|#|$)/.test(location.search);

  var API_Q = JD_API + '/api/jd2-queue.php';
  var API_R = JD_API + '/api/jd2-rate.php';
  var API_C = JD_API + '/api/jd2-curate.php';
  var API_L = JD_API + '/api/jd2-ledger.php';
  var API_I = JD_API + '/api/jd2-intake.php';

  var Q = null;             /* the queue payload */
  var curId = null;         /* the prompt on (or awaiting) the bench */
  var visited = [];         /* prompt ids opened this session — prev walks it */
  var filedNow = {};        /* prompt id -> true once a sitting on it filed */
  var svgCache = {};        /* generation id -> SVG text */
  var intent = null;        /* why the card is coming down: scrap|skip|prev|owner */
  var pendingRun = null;    /* an owner's run waiting for the card to come down */
  var running = null;       /* the owner's run holding the stage: {kind, prompt_id?, title?, size?, category?} */
  var stale = false;        /* a deploy landed since this page loaded */
  var sync = { state: 'idle', detail: '' };
  var bar = null, sheet = null;

  var esc = JD_esc;
  function itemById(id) {
    var list = (Q && Q.items) || [];
    for (var i = 0; i < list.length; i++) if (list[i].prompt_id === id) return list[i];
    return null;
  }
  function tag() {
    return '<span class="jd-bench-tag" aria-hidden="true">' + (ADMIN ? 'ADMIN' : 'BENCH') + '</span>';
  }
  function outHTML() {
    return '<button type="button" class="jd-bench-out" data-bench="out" ' +
      'title="forget the key on this device">sign out</button>';
  }

  /* ---------- what still needs the owner: the payload says ---------------- */
  /* the drawings the card can seat: every ok drawing the owner has not
     dropped from the card (a hidden drawing is neither rated nor ranked) */
  function seatable(it) {
    return (it.responses || []).filter(function (r) { return !r.hidden; });
  }
  function itemDone(it) { return !!it.complete; }
  function workable(it) {
    if (!it || it.complete || it.visibility === 'hidden' || !it.settled) return false;
    var n = seatable(it).length;
    return n >= 1 && n <= JD_SLOTS.length;   /* the card seats four at most */
  }
  /* a direct address seats a closed prompt too — only the card's own limits apply */
  function seatableItem(it) {
    var n = it ? seatable(it).length : 0;
    return !!(it && it.run_id && it.settled && n >= 1 && n <= JD_SLOTS.length);
  }
  function firstWorkable(afterId) {
    var list = (Q && Q.items) || [], start = 0, i;
    if (afterId) {
      for (i = 0; i < list.length; i++) {
        if (list[i].prompt_id === afterId) { start = i + 1; break; }
      }
    }
    for (i = start; i < list.length; i++) if (workable(list[i])) return list[i];
    /* wrap once — prompts skipped earlier come round again */
    for (i = 0; i < start; i++) if (workable(list[i])) return list[i];
    return null;
  }
  /* the campaign's count is the payload's `progress` (every prompt not hidden
     whose bench run settled), with this tab's own filings folded in */
  function counts() {
    var p = (Q && Q.progress) || {};
    var left = Math.max(0, (p.prompts || 0) - (p.complete || 0));
    return { left: left, prompts: p.prompts || 0, done: p.complete || 0, drawing: p.drawing || 0 };
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
    }, function () {
      return { ok: false, error: { code: 'network' } };
    }).then(function (j) {
      if (!j || !j.ok) throw ((j && j.error) || { code: 'network' });
      /* a write endpoint that names its build — a mismatch means a deploy
         landed under this page, and the rubric could have moved. The
         writers (jd2-rate, jd2-curate) answer the fingerprint string, as
         v1's did; the queue carries the whole stamp, {version, build, …} */
      var jb = j.build && (typeof j.build === 'string' ? j.build : j.build.build);
      if (jb && Q && Q.build && Q.build.build && jb !== Q.build.build) stale = true;
      return j;
    });
  }
  function getJSON(url) {
    /* the timestamp defeats any cache that ignores the endpoint's no-store
       headers (the host's edge cache was caught serving a stale queue,
       2026-08-28) — a cached queue would quietly break cross-device sync */
    return fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now(),
      { headers: JD_admin.headers() })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw (((j || {}).error || {}).code || 'network');
        return j;
      }, function (e) { throw (typeof e === 'string' ? e : 'network'); });
  }
  function setSync(state, detail) {
    sync = { state: state, detail: detail || '' };
    paintBar();
  }

  /* the curate card's file() callback: ONE owner session through jd2-rate.
     The card seats the drawings in a shuffled order, so every answer is
     mapped back to the run's REAL slot — by its generation id against the
     queue row (each `per` entry also carries the job's real slot, and the
     pairs their generation ids). blind: true — the bench never showed a
     name. The filing answers with the reveal, which names the models on the
     job's responses for the unveil the card is about to stand. */
  function fileItem(it, job, per, size, pairs, note) {
    setSync('saving');
    var realOf = {};
    seatable(it).forEach(function (r) { realOf[r.generation_id] = r.slot; });
    function real(gid, fallback) { return realOf[gid] || fallback || null; }
    var ratings = [], ranking = [], multi = per.length > 1, ranked = multi;
    per.forEach(function (p) {
      var slot = real(p.generation_id, p.slot);
      if (p.grade != null) ratings.push({ slot: slot, kind: 'grade', value: p.grade });
      Object.keys(p.axes || {}).forEach(function (a) {
        if (p.axes[a] != null) ratings.push({ slot: slot, kind: 'axis', axis_id: a, value: p.axes[a] });
      });
      if (p.rank >= 1) ranking.push({ slot: slot, rank: p.rank });
      else ranked = false;
    });
    var wirePairs = (pairs || []).map(function (p) {
      var a = real(p.gen_a), b = real(p.gen_b);
      return { slot_a: a, slot_b: b, score: p.score,
        shown_left: p.shown_left === p.slot_b ? b : a };
    });
    var body = {
      run_id: it.run_id,
      client: JD_CLIENT,
      ratings: ratings,
      ranking: ranked ? ranking.sort(function (x, y) { return x.rank - y.rank; }) : null,
      pairs: wirePairs.length ? wirePairs : null,
      blind: true
    };
    if (size) body.size = size;
    if (note) body.note = note;
    return post(API_R, body).then(function (res) {
      filedNow[it.prompt_id] = true;
      it.complete = !!res.complete;
      if (res.complete) it.needs = [];
      if (size) it.size_class = size;
      /* fold the answers back into the queue copy, so prev re-seats what
         the server now holds */
      per.forEach(function (p) {
        var slot = real(p.generation_id, p.slot);
        seatable(it).forEach(function (r) {
          if (r.slot !== slot) return;
          r.prefill = { grade: p.grade, axes: p.axes || {}, rank_pos: p.rank >= 1 ? p.rank : null };
        });
      });
      it.pairs_prefill = wirePairs.map(function (p) {
        return { slot_a: p.slot_a, slot_b: p.slot_b, score: p.score, source: 'direct' };
      });
      if (res.complete && Q && Q.progress && !it._counted) {
        Q.progress.complete = (Q.progress.complete || 0) + 1;
        it._counted = true;
      }
      /* the unveil's names: the filing's reveal, by real slot */
      var names = {};
      (res.reveal || []).forEach(function (rv) { names[rv.slot] = rv; });
      job.responses.forEach(function (r) {
        var rv = names[r.slot];
        if (rv) { r.model_id = rv.model_id; r.label = rv.label || rv.model_id; }
      });
      setSync('saved', res.complete ? '' : 'filed, not complete');
      return res;
    }, function (err) {
      setSync('failed', (err && err.code) || '');
      throw err;
    });
  }

  /* ---------- seating a prompt on the bench ------------------------------- */
  function openItem(it) {
    if (!it) { curId = null; paintBar(); return; }
    curId = it.prompt_id;
    if (visited[visited.length - 1] !== it.prompt_id) visited.push(it.prompt_id);
    hideSheet();
    paintBar();
    var usable = seatable(it);
    Promise.all(usable.map(function (r) {
      if (svgCache[r.generation_id]) return null;
      /* a draft's drawings are the bench key's to see (jd2-gen-svg) */
      return fetch(JD_API + r.svg_url, { headers: JD_admin.headers() }).then(function (res) {
        if (!res.ok) throw new Error('svg ' + res.status);
        return res.text();
      }).then(function (t) { svgCache[r.generation_id] = t; });
    })).then(function () {
      if (curId !== it.prompt_id) return;   /* the owner moved on mid-fetch */
      var models = (Q && Q.models) || {};
      var job = {
        prompt: it.prompt,
        /* the closing size card's scale, and the tier already on file */
        sizeTiers: (Q && Q.size_tiers) || [],
        size: it.size_class || null,
        /* the size card carries "notes for the record" for the bench */
        withNote: true,
        responses: usable.map(function (r) {
          var pf = r.prefill || {};
          return {
            generation_id: r.generation_id,
            /* the REAL slot: the card shuffles seats, filing maps back */
            slot: r.slot,
            svg: svgCache[r.generation_id] || '',
            /* blind unless ?reveal=1 — and even then the card names no one
               before the unveil; without it the filing's reveal names them */
            model_id: REVEAL ? (r.model_id || '') : '',
            label: REVEAL && r.model_id ? (models[r.model_id] || r.model_id) : '',
            grade: pf.grade != null ? pf.grade : null,
            axes: pf.axes || {},
            rank: pf.rank_pos != null ? pf.rank_pos : null
          };
        }),
        /* the owner's last direct head-to-head answers, by real slot (a
           derived pair is an inference from gaps, not an answer to carry) */
        pairs: (it.pairs_prefill || []).filter(function (p) { return p.source === 'direct'; })
          .map(function (p) { return { slot_a: p.slot_a, slot_b: p.slot_b, score: p.score }; }),
        file: function (per, size, pairs, note) {
          return fileItem(it, job, per, size, pairs, note);
        }
      };
      if (!window.JD_turn.curate(job)) setSync('failed', 'the card would not open');
      paintBar();
    }, function () {
      setSync('failed', 'svg fetch');
    });
  }

  /* ---------- the owner's runs: a new prompt, a rerun --------------------- */
  /* starts at once when the stage is free, else when the card comes down */
  function ownerRun(run) {
    if (running) return;
    if (window.JD_turn.isOpen()) {
      pendingRun = run;
      intent = 'owner';
      window.JD_turn.close();
      return;
    }
    startRun(run);
  }
  function startRun(run) {
    hideSheet();
    var job = run.kind === 'rerun'
      ? { rerun_of: run.prompt_id, prompt: run.prompt, profile: 'bench' }
      : { prompt: run.prompt, profile: 'bench' };
    running = run;
    if (!window.JD_turn.ownerRun(job)) {
      running = null;
      setSync('failed', 'the run would not start');
      return;
    }
    setSync('idle');
  }
  /* the run is back (or was stopped): file a new prompt's title, size and
     category, ask the intake clerk for what the form left open, re-read the
     queue for that prompt, and seat its new run */
  function runLanded(r) {
    var run = running;
    running = null;
    var pid = r.prompt_id || (run && run.prompt_id) || null;
    var chain = Promise.resolve();
    var fresh = run && run.kind === 'new' && pid;
    if (fresh && (run.title || run.size || run.category)) {
      var cb = { prompt_id: pid };
      if (run.title) cb.title = run.title;
      /* a size chosen here is the owner's (size_by owner): the clerk never overwrites it */
      if (run.size) cb.size_class = run.size;
      if (run.category) cb.category = run.category;
      chain = post(API_C, cb).then(null, function (err) {
        setSync('failed', 'title/size/category: ' + ((err && err.code) || 'failed'));
      });
    }
    /* THE INTAKE (2026-10-02): the clerk files the heading, the size tier and
       the classification on the new prompt — unless the form gave both a
       title and a size. It fills only what the owner left open (a title the
       owner typed and an owner's size stand), and a failed intake simply
       leaves the size card to ask. The queue is read after it, so the size
       card opens on the clerk's tier. */
    if (fresh && !(run.title && run.size)) {
      chain = chain.then(function () {
        setSync('saving', 'intake');
        return post(API_I, { prompt_id: pid }).then(function (j) {
          setSync('idle', j && j.fallback ? 'intake fell back' : '');
        }, function (err) {
          setSync('failed', 'intake: ' + ((err && err.code) || 'failed'));
        });
      });
    }
    chain.then(function () {
      if (!pid) { loadQueue(false); return null; }
      /* the whole backlog first (the campaign's count moved), then the prompt */
      return fetchQueue().then(null, function () { return null; }).then(function () {
        return fetchOne(pid);
      }).then(function (it) {
        if (r.abandoned || !r.ok) {
          setSync('failed', r.abandoned ? 'run stopped' : 'nothing came back');
          openItem(firstWorkable(null));
          return;
        }
        if (it.run_id !== r.run_id) {
          /* the owner pinned an earlier run as the shown run: the bench rates
             that one, so the new run waits for the ledger's SHOW THIS RUN */
          setSync('failed', 'shown run is pinned — choose the new run in the ledger');
          openItem(firstWorkable(null));
          return;
        }
        if (seatableItem(it)) openItem(it);
        else { setSync('failed', (it.needs || []).join('; ') || 'not seatable'); openItem(firstWorkable(null)); }
      }, function (code) {
        setSync('failed', code || 'network');
      });
    });
  }

  /* ---------- the card coming down --------------------------------------- */
  window.addEventListener('jd-turn-close', function (e) {
    var d = e && e.detail;
    if (d && d.owner_run) { runLanded(d.owner_run); return; }
    var why = intent;
    intent = null;
    if (ADMIN) { paintBar(); return; }   /* nothing is ever seated in admin mode */
    if (why === 'owner' && pendingRun) {
      var run = pendingRun;
      pendingRun = null;
      startRun(run);
      return;
    }
    if (why === 'scrap' || why === 'skip') { openItem(firstWorkable(curId)); return; }
    if (why === 'prev') return;          /* act() reopens the earlier prompt */
    var cur = itemById(curId);
    if (curId && filedNow[curId] && (!cur || !workable(cur))) {
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
      setSync('saving');
      post(API_C, { prompt_id: it.prompt_id, visibility: 'hidden' }).then(function () {
        setSync('saved', 'hidden');
      }, function (err) { setSync('failed', (err && err.code) || ''); });
      /* the local copy learns it now — the strip must not re-offer a prompt
         the owner just hid, whatever the wire is doing */
      it.visibility = 'hidden';
      if (open) { intent = 'scrap'; window.JD_turn.close(); }
      else openItem(firstWorkable(curId));
    } else if (kind === 'rerun') {
      if (!it) return;
      ownerRun({ kind: 'rerun', prompt_id: it.prompt_id, prompt: it.prompt });
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
    } else if (kind === 'hidden') {
      hiddenList();
    } else if (kind === 'new') {
      newPromptForm();
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
    sheet.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-show]') : null;
      if (b) { showAgain(b.getAttribute('data-show'), b.getAttribute('data-to'), b); return; }
      var c = e.target.closest ? e.target.closest('[data-np]') : null;
      if (c && c.getAttribute('data-np') === 'cancel') hideSheet();
    });
    sheet.addEventListener('submit', function (e) {
      e.preventDefault();
      submitNewPrompt(e.target);
    });
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
  function hideSheet() { if (sheet) { sheet.hidden = true; sheet.removeAttribute('data-sheet'); } }
  /* the sheet's toggles share their first half: a sheet that is up goes
     down, and that press is spent (true) — unless it is showing another
     sheet, which this press replaces (false, for the caller to fill) */
  function closeSheetIfOpen(which) {
    if (sheet && !sheet.hidden) {
      var was = sheet.getAttribute('data-sheet');
      hideSheet();
      return was === which;
    }
    return false;
  }
  function showSheet(which, html) {
    sheet.innerHTML = html;
    sheet.setAttribute('data-sheet', which);
    sheet.hidden = false;
  }
  function toggleSheet() {
    var it = itemById(curId);
    if (!sheet || !it) return;
    if (closeSheetIfOpen('prompt')) return;
    var n = seatable(it).length;
    showSheet('prompt',
      '<b>' + esc(it.title) + '</b> · ' + esc(String(it.created).slice(0, 10)) +
      ' · ' + n + (n === 1 ? ' drawing' : ' drawings') +
      (it.runs > 1 ? ' · run ' + it.runs + ' of ' + it.runs : '') +
      (it.category ? ' · ' + esc(it.category) : '') +
      (it.size_class ? ' · size ' + esc(it.size_class) + (it.size_by ? ' (' + esc(it.size_by) + ')' : '') : '') +
      '<p>' + esc(it.prompt) + '</p>' +
      tagsLine(it) +
      ((it.needs || []).length ? '<p class="jd-bench-needs">needs: ' + esc(it.needs.join('; ')) + '</p>' : ''));
  }

  /* the intake clerk's classification, one facet per clause (the ids as
     filed; the ledger edits them) — or why there is none */
  function tagsLine(it) {
    if (it.fallback) return '<p class="jd-bench-needs">intake fell back — no headings on file (the ledger shows why)</p>';
    var t = it.tags;
    if (!t) return '';
    var parts = Object.keys(t).map(function (f) {
      return f + ': ' + ((t[f] || []).length ? t[f].join(', ') : '—');
    });
    return '<p class="jd-bench-needs">filed under ' + esc(parts.join(' · ')) + '</p>';
  }

  /* ---------- NEW PROMPT (owner only: the strip exists only behind the key) */
  function newPromptForm() {
    if (!sheet || running) return;
    if (closeSheetIfOpen('new')) return;
    showSheet('new',
      '<form class="jd-bench-new" autocomplete="off">' +
      '<b>new prompt</b> · drawn under the bench profile, then seated here to rate' +
      '<label>prompt<textarea name="prompt" rows="3" maxlength="500" required></textarea></label>' +
      '<div class="jd-bench-new-row">' +
      '<label>title <i>(optional)</i><input name="title" maxlength="80"></label>' +
      '<label>size <i>(optional)</i><select name="size">' + sizeOptions() + '</select></label>' +
      '<label>category <i>(optional)</i><input name="category" maxlength="32"></label>' +
      '</div>' +
      '<div class="jd-bench-new-row">' +
      '<button type="submit" class="jd-bench-show">draw it</button>' +
      '<button type="button" class="jd-bench-np-cancel" data-np="cancel">cancel</button>' +
      '</div></form>');
    var ta = sheet.querySelector('textarea');
    if (ta) ta.focus();
  }
  /* the NEW PROMPT form's size: the queue's tiers; blank = the intake clerk decides */
  function sizeOptions() {
    return '<option value="">the clerk decides</option>' + ((Q && Q.size_tiers) || []).map(function (t) {
      return '<option value="' + esc(t.id) + '">' + esc(t.label || t.id) + '</option>';
    }).join('');
  }
  function submitNewPrompt(form) {
    function val(name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el ? String(el.value || '') : '';
    }
    var text = val('prompt');
    if (!text.trim().length || text.length > 500) return;
    var run = {
      kind: 'new', prompt: text,
      title: val('title').trim().slice(0, 80) || null,
      size: val('size') || null,
      category: val('category').trim().slice(0, 32) || null
    };
    hideSheet();
    ownerRun(run);
  }

  /* ---------- HIDDEN ITEMS: every hidden prompt, from the ledger ---------- */
  /* SHOW puts a prompt back where it was going: live when a sitting on one
     of its runs was ever complete (the ledger's run `display.complete`),
     else draft — a draft goes live on its first complete sitting */
  function showTarget(row) {
    var done = (row.runs || []).some(function (run) { return run.display && run.display.complete; });
    return done ? 'live' : 'draft';
  }
  function hiddenList() {
    if (!sheet) return;
    if (closeSheetIfOpen('hidden')) return;
    showSheet('hidden', '<b>hidden items</b> · loading…');
    getJSON(API_L).then(function (l) {
      if (sheet.getAttribute('data-sheet') !== 'hidden') return;
      var rows = (l.items || []).filter(function (row) {
        return row.visibility === 'hidden' || (row.drawer && row.drawer.state === 'hidden');
      });
      var h = '<b>hidden items</b> · ' + rows.length;
      rows.forEach(function (row) {
        var to = showTarget(row);
        h += '<div class="jd-bench-hidden-row"><b>' + esc(row.title) + '</b>' +
          '<span>' + esc(String(row.created).slice(0, 10)) +
          (row.hidden_by ? ' · by ' + esc(row.hidden_by) : '') + '</span>' +
          '<button type="button" class="jd-bench-show" data-show="' + esc(row.prompt_id) +
          '" data-to="' + to + '" title="' + (to === 'live' ? 'back into the drawer'
            : 'back as a draft — it goes live on its first complete sitting') + '">show' +
          (to === 'draft' ? ' (draft)' : '') + '</button></div>';
      });
      if (!rows.length) h += '<p>nothing is hidden</p>';
      sheet.innerHTML = h;
    }, function (code) {
      sheet.innerHTML = '<b>hidden items</b> · ⚠ ' + esc(code || 'network');
    });
  }
  function showAgain(promptId, to, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'showing…'; }
    post(API_C, { prompt_id: promptId, visibility: to === 'draft' ? 'draft' : 'live' }).then(function () {
      /* the admin page's pile takes it back on a reload; the bench re-reads
         its queue (a prompt still open comes back to the backlog) */
      if (ADMIN) { location.reload(); return; }
      var it = itemById(promptId);
      if (it) it.visibility = to === 'draft' ? 'draft' : 'live';
      if (btn) {
        var row = btn.closest('.jd-bench-hidden-row');
        if (row && row.parentNode) row.parentNode.removeChild(row);
      }
      loadQueue(true);
    }, function (err) {
      if (btn) { btn.disabled = false; btn.textContent = '⚠ ' + ((err && err.code) || 'failed'); }
    });
  }

  function syncHTML() {
    if (sync.state === 'saving') return '<span class="jd-bench-sync is-saving">saving…</span>';
    if (sync.state === 'saved') {
      return '<span class="jd-bench-sync is-saved">✓ filed' +
        (sync.detail ? ' · ' + esc(sync.detail) : '') + '</span>';
    }
    if (sync.state === 'failed') {
      return '<span class="jd-bench-sync is-failed">⚠ ' +
        esc(sync.detail || 'failed') + '</span>';
    }
    return '';
  }
  /* the stamp names the rubric the sitting files under: the taxonomy and
     the instrument versions jd2-rate stamps on every session */
  function stampHTML() {
    var b = (Q && Q.build) || null;
    var info = JD_admin.info();
    if (stale) return '<span class="jd-bench-build is-stale">a deploy landed — reload before rating on</span>';
    if (b) {
      return '<span class="jd-bench-build">' +
        esc(b.version + ' · ' + b.build + ' · tax v' + Q.taxonomy_version +
          ' · instr ' + Q.instrument_version) + '</span>';
    }
    if (info && info.build) {
      return '<span class="jd-bench-build">' +
        esc((info.version || '') + ' · ' + info.build + ' · tax v' + info.taxonomy_version) + '</span>';
    }
    return '';
  }
  /* the strip's standing tools: hidden items and the ledger in both modes,
     NEW PROMPT on the bench */
  function toolsHTML() {
    return (ADMIN ? '' : '<button type="button" class="jd-bench-new-btn" data-bench="new" ' +
        'title="draw a new prompt under the bench profile and rate it here">new prompt +</button>') +
      '<button type="button" data-bench="hidden" title="prompts hidden from the drawer">hidden items</button>' +
      /* THE LEDGER (owner, 2026-09-10): the whole collection as a table —
         what is in the drawer and why not, every run and every sitting */
      '<a class="jd-bench-link" href="ledger.html" title="every prompt as a table — drawer state, runs, sittings, the bench\'s view">ledger</a>';
  }
  function paintBar() {
    if (!bar) return;
    var c = counts();
    var it = itemById(curId);
    var open = window.JD_turn.isOpen();
    var left = '';
    if (running) {
      left = '<span class="jd-bench-note">' + (running.kind === 'rerun' ? 'rerun' : 'new prompt') +
        ' drawing under the bench profile — it seats here when it lands</span>';
    } else if (it && !ADMIN) {
      left = '<span class="jd-bench-pos">' + c.left + ' to go</span>' +
        '<button type="button" class="jd-bench-title" data-bench="prompt" ' +
        'title="the prompt, and what it still needs">' + esc(it.title) + '</button>' +
        (!open ? '<button type="button" data-bench="resume">resume</button>' : '') +
        toolsHTML();
    } else if (ADMIN) {
      left = '<span class="jd-bench-note">open any report card — its grades are yours to change and save</span>' +
        toolsHTML();
    } else {
      left = '<span class="jd-bench-note">backlog clear — ' + c.done + '/' + c.prompts +
        ' prompts rated' + (c.drawing ? ', ' + c.drawing + ' still drawing' : '') + '</span>' +
        toolsHTML();
    }
    var acts = (it && !running && !ADMIN)
      ? '<div class="jd-bench-acts">' +
        (visited.length > 1 ? '<button type="button" data-bench="prev" title="previous prompt">&larr;</button>' : '') +
        '<button type="button" data-bench="skip" title="set this prompt aside for now">skip &rarr;</button>' +
        '<button type="button" class="jd-bench-scrap" data-bench="scrap" ' +
        'title="hide this prompt from the drawer and the bench (HIDDEN ITEMS brings it back)">scrap ✕</button>' +
        '<button type="button" class="jd-bench-rerun" data-bench="rerun" ' +
        'title="draw this prompt again under the bench profile — a new run to rate">rerun ↻</button>' +
        '</div>'
      : '';
    bar.innerHTML = tag() + left + syncHTML() + acts + stampHTML() + outHTML();
    barHeight();
  }
  /* the strip wraps onto more lines as it fills; the sheet above it and the
     card's clearance read its real height from this property */
  function barHeight() {
    if (!bar) return;
    try {
      document.documentElement.style.setProperty('--jd-bench-bar-h', bar.offsetHeight + 'px');
    } catch (e) {}
  }
  window.addEventListener('resize', barHeight);

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
    hideSheet();
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
  function queueURL(promptId) {
    var u = API_Q, q = [];
    if (promptId) q.push('prompt=' + encodeURIComponent(promptId));
    if (REVEAL) q.push('reveal=1');
    return q.length ? u + '?' + q.join('&') : u;
  }
  /* the backlog, keyed; resolves Q, rejects with the error code */
  function fetchQueue() {
    return getJSON(queueURL(null)).then(function (j) {
      /* a prompt seated by direct address is not in the default backlog —
         keep this tab's copy of it, so the strip still knows what is up */
      var keep = curId && !j.items.some(function (x) { return x.prompt_id === curId; })
        ? itemById(curId) : null;
      Q = j;
      if (keep) Q.items.push(keep);
      return j;
    });
  }
  /* one prompt in any state (?prompt=), merged into the backlog copy. Its
     `progress` is NOT taken: a ?prompt= read counts only that one prompt */
  function fetchOne(promptId) {
    return getJSON(queueURL(promptId)).then(function (j) {
      var it = (j.items || [])[0];
      if (!it) throw 'not_found';
      if (!Q) { Q = j; return it; }
      var list = Q.items, at = -1;
      for (var i = 0; i < list.length; i++) if (list[i].prompt_id === it.prompt_id) { at = i; break; }
      if (at === -1) list.unshift(it); else list[at] = it;
      return it;
    });
  }
  function loadQueue(quiet) {
    if (!quiet && bar) {
      bar.innerHTML = tag() + '<span class="jd-bench-note">loading the queue…</span>';
    }
    fetchQueue().then(function () {
      var open = window.JD_turn.isOpen();
      /* the directly-addressed prompt takes the stage first, in any state —
         once, so filing it advances into the ordinary queue */
      if (directId && !open && !running) {
        var want = directId;
        directId = null;
        fetchOne(want).then(function (it) {
          if (seatableItem(it)) openItem(it);
          else {
            setSync('failed', 'that prompt can’t be seated: ' + ((it.needs || []).join('; ') || 'no drawings'));
            openItem(firstWorkable(null));
          }
        }, function (code) {
          setSync('failed', 'prompt ' + (code || 'network'));
          openItem(firstWorkable(null));
        });
        return;
      }
      if (!open && !running) {
        /* nothing on the stage: seat the current prompt if it still needs
           work (it may have been finished on another device), else move on */
        var cur = itemById(curId);
        if (!cur || !workable(cur)) openItem(firstWorkable(curId));
        else paintBar();
      } else {
        paintBar();
      }
    }, function (code) {
      /* a refused key always reopens the gate — a quiet refetch (the tab
         coming back) just says nothing about why; any other failure is
         reported only when the load was not quiet */
      if (!quiet) gate(gateMsg(code));
      else if (code === 'forbidden' || code === 'too_many_attempts') gate('');
    });
  }

  /* the key first, then the mode: the gate on refusal, the queue walk on
     ?bench, the idle strip on ?admin */
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
    if (!ADMIN && !running && document.visibilityState === 'visible' && Q) loadQueue(true);
  });

  /* the test harness and the console read the bench's state through this */
  window.JD_bench = {
    queue: function () { return Q; },
    current: function () { return curId; },
    done: itemDone
  };

  buildBar();
  boot();
})();
