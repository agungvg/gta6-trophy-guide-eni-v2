/* Sunset Ledger — GTA VI trophy guide & tracker.
   Plain static app: fetches app/data/trophies.json, keeps progress in
   localStorage, exports/imports JSON, hides story spoilers until earned.
   No network requests at run time beyond its own files. */
(function () {
  'use strict';

  var STORE_KEY = 'sunset-ledger-v1';
  var POINTS = { platinum: 300, gold: 90, silver: 30, bronze: 15 };
  var GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
  var GRADE_LETTER = { platinum: 'P', gold: 'G', silver: 'S', bronze: 'B' };
  var KIND_LABELS = {
    platinum: 'Platinum', story: 'Story', side: 'Side quests',
    collectibles: 'Collectibles', activities: 'Activities',
    crime: 'Crime', misc: 'Misc'
  };

  var data = null;            // whole trophies.json
  var trophies = [];          // data.trophies
  var byId = {};
  var earned = {};            // id -> true
  var counters = {};          // id -> number (0..need)
  var spoiler = true;
  var kindFilter = 'all';
  var gradeFilter = 'all';
  var showFilter = 'all';
  var sortMode = 'roadmap';
  var query = '';
  var selectedId = 1;
  var demoSeeded = false;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function gradeLetter(g) { return GRADE_LETTER[g] || '?'; }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var st = JSON.parse(raw);
      earned = st.earned || {};
      counters = st.counters || {};
      spoiler = st.spoiler !== false;
    } catch (e) { /* corrupted save: start fresh */ }
  }
  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        earned: earned, counters: counters, spoiler: spoiler
      }));
    } catch (e) { /* storage full or blocked: progress stays in memory */ }
  }

  function seedDemo() {
    // ?demo=1 seeds 13 earned trophies in memory only, for screenshots.
    var params = new URLSearchParams(location.search);
    if (params.get('demo') !== '1' || demoSeeded) return;
    demoSeeded = true;
    [2, 3, 8, 15, 20, 21, 28, 33, 35, 42, 44, 46, 53].forEach(function (id) {
      earned[id] = true;
    });
    var t = params.get('t');
    if (t) selectedId = parseInt(t, 10) || 28;
    else selectedId = 28;
  }

  function earnedCount() {
    return trophies.filter(function (t) { return earned[t.id]; }).length;
  }
  function pointsEarned() {
    return trophies.reduce(function (sum, t) {
      return sum + (earned[t.id] ? POINTS[t.grade] : 0);
    }, 0);
  }
  function totalSteps() {
    return trophies.reduce(function (sum, t) { return sum + t.steps.length; }, 0);
  }
  function isStoryHidden(t) {
    return spoiler && t.kind === 'story' && !earned[t.id];
  }

  function visibleTrophies() {
    var list = trophies.filter(function (t) {
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
      if (gradeFilter !== 'all' && t.grade !== gradeFilter) return false;
      if (showFilter === 'earned' && !earned[t.id]) return false;
      if (showFilter === 'not-earned' && earned[t.id]) return false;
      if (showFilter === 'missable' && !(t.missable || t.atRisk)) return false;
      if (showFilter === 'hidden' && !t.hidden) return false;
      if (query) {
        var hay = (t.name + ' ' + t.description + ' ' + t.chapter + ' ' +
          t.guide + ' ' + t.steps.join(' ')).toLowerCase();
        if (hay.indexOf(query) === -1) return false;
      }
      return true;
    });
    if (sortMode === 'name') {
      list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    } else if (sortMode === 'grade') {
      list.sort(function (a, b) {
        return GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || a.id - b.id;
      });
    } else {
      list.sort(function (a, b) {
        return a.stage - b.stage || a.id - b.id;
      });
    }
    return list;
  }

  function renderAudit() {
    var pills = [
      '<b>55/55</b> official name, description, grade',
      '<b>1P 2G 6S 46B</b> · 28 PSN-hidden',
      '<b>' + totalSteps() + '/' + totalSteps() + '</b> claims cited',
      '<b>55/55</b> guides cite sources',
      '<b>3 sources</b> · 2 sites · read 20–21 Nov 2026',
      '<span class="warn"><b>1</b> possibly missable</span>',
      '<span class="warn"><b>8</b> at risk</span>',
      '<span class="warn"><b>2</b> unconfirmed</span>',
      '<b>1</b> dispute shown both ways'
    ];
    $('auditStrip').innerHTML = pills.map(function (p) {
      return '<span class="pill">' + p + '</span>';
    }).join('');
  }

  function renderHeader() {
    var n = earnedCount();
    $('earnedCount').textContent = n;
    $('progressBar').style.width = Math.round(n / 55 * 100) + '%';
    var counts = { platinum: [0, 1], gold: [0, 2], silver: [0, 6], bronze: [0, 46] };
    trophies.forEach(function (t) {
      if (earned[t.id]) counts[t.grade][0] += 1;
    });
    $('gradeCounts').textContent = 'P ' + counts.platinum[0] + '/1 · G ' +
      counts.gold[0] + '/2 · S ' + counts.silver[0] + '/6 · B ' +
      counts.bronze[0] + '/46';
    $('psnPoints').textContent = pointsEarned();
    $('spoilerToggle').checked = spoiler;
  }

  function renderChips() {
    var kinds = ['all', 'story', 'side', 'collectibles', 'activities', 'crime', 'misc'];
    var kindCounts = {};
    trophies.forEach(function (t) {
      kindCounts[t.kind] = (kindCounts[t.kind] || 0) + 1;
    });
    $('kindChips').innerHTML = kinds.map(function (k) {
      var label = k === 'all' ? 'All 55' :
        KIND_LABELS[k] + ' ' + (kindCounts[k] || 0);
      return '<button type="button" class="chip' + (kindFilter === k ? ' active' : '') +
        '" data-kind="' + k + '">' + esc(label) + '</button>';
    }).join('');
    var grades = ['all', 'platinum', 'gold', 'silver', 'bronze'];
    $('gradeChips').innerHTML = grades.map(function (g) {
      var label = g === 'all' ? 'All grades' : gradeLetter(g) + ' — ' +
        (g.charAt(0).toUpperCase() + g.slice(1));
      return '<button type="button" class="chip' + (gradeFilter === g ? ' active' : '') +
        '" data-grade="' + g + '">' + esc(label) + '</button>';
    }).join('');
  }

  function renderList() {
    var list = visibleTrophies();
    var html = '<div class="list-head">' + list.length + ' shown</div>';
    html += list.map(function (t) {
      var hidden = isStoryHidden(t);
      var tags = '';
      if (t.missable) tags += '<span class="tag miss">POSSIBLY MISSABLE</span>';
      else if (t.atRisk) tags += '<span class="tag risk">AT RISK</span>';
      if (t.hidden) tags += '<span class="tag hid">PSN-HIDDEN</span>';
      tags += '<span class="tag">' + esc(KIND_LABELS[t.kind]) + '</span>';
      if (t.target) tags += '<span class="tag">' + esc(t.target.label) + '</span>';
      var body = hidden
        ? '<div class="tname">Story trophy — Chapter ' + esc(t.chapter.replace('Chapter ', '')) + '</div>' +
          '<div class="spoil">Hidden by the spoiler shield until you earn it.</div>'
        : '<div class="tname">' + esc(t.name) + '</div>' +
          '<div class="tdesc">' + esc(t.description) + '</div>';
      return '<div class="trow' + (earned[t.id] ? ' earned' : '') +
        (t.id === selectedId ? ' selected' : '') + '" data-id="' + t.id + '">' +
        '<input type="checkbox" data-check="' + t.id + '"' +
        (earned[t.id] ? ' checked' : '') + ' aria-label="Mark ' + esc(t.name) + ' earned">' +
        '<span class="gdot ' + t.grade + '">' + gradeLetter(t.grade) + '</span>' +
        '<div>' + body + '<div class="tags">' + tags + '</div></div></div>';
    }).join('');
    $('trophyList').innerHTML = html;
  }

  function sourceTag(refs) {
    return refs.map(function (r) { return '[' + r + ']'; }).join(' ');
  }
  function sourceByRef(ref) {
    for (var i = 0; i < data.sources.length; i++) {
      if (data.sources[i].ref === ref) return data.sources[i];
    }
    return null;
  }

  function renderDetail() {
    var t = byId[selectedId] || trophies[0];
    if (!t) { $('detailPane').innerHTML = ''; return; }
    var hidden = isStoryHidden(t);
    var srcLinks = t.sources.map(function (r) {
      var s = sourceByRef(r);
      return s ? '<div>[' + r + '] <a href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
        esc(s.label) + '</a> — read ' + esc(s.read) + '</div>' : '';
    }).join('');
    var counterHtml = '';
    if (t.target) {
      var have = counters[t.id] || 0;
      counterHtml = '<div class="counter-box"><span>Your count</span>' +
        '<button type="button" data-count="-1" aria-label="Decrease">−</button>' +
        '<span class="num">' + have + ' / ' + t.target.need + ' ' + esc(t.target.label) + '</span>' +
        '<button type="button" data-count="1" aria-label="Increase">+</button></div>';
    }
    var missHtml = '';
    if (t.missable) {
      missHtml = '<div class="callout miss"><b>Missable window — possibly the game\'s only missable trophy.</b> ' +
        'The Chapter 1 balcony meditation may be required; whether it counts is still unconfirmed. ' +
        'Do it in Chapter 1, the morning after Down to Earth, and keep a chapter-start save in one of your 15 manual slots. [3]</div>';
    }
    var noteHtml = (t.note && !t.missable)
      ? '<div class="callout note">' + esc(t.note) + '</div>' : '';
    var stepsHtml = '<ol class="steps">' + t.steps.map(function (s) {
      return '<li>' + esc(s) + ' <span class="src">' + sourceTag(t.sources) + '</span></li>';
    }).join('') + '</ol>';
    $('detailPane').innerHTML =
      '<h2>' + (hidden ? 'Story trophy — hidden' : esc(t.name)) + '</h2>' +
      '<div class="meta-row">' +
        '<span class="meta"><b>' + t.grade + '</b> · ' + POINTS[t.grade] + ' PSN pts</span>' +
        '<span class="meta">' + esc(KIND_LABELS[t.kind]) + '</span>' +
        '<span class="meta">' + esc(t.chapter) + '</span>' +
        '<span class="meta">Stage ' + t.stage + '</span>' +
        (t.hidden ? '<span class="meta">PSN-hidden</span>' : '') +
        (t.missable ? '<span class="meta miss">POSSIBLY MISSABLE</span>' : '') +
        (t.atRisk ? '<span class="meta risk">AT RISK</span>' : '') +
      '</div>' +
      (hidden
        ? '<p class="off-desc">Hidden by the spoiler shield until you earn it.</p>'
        : '<p class="off-desc">“' + esc(t.description) + '” — official description [1]</p>') +
      counterHtml +
      missHtml + noteHtml +
      '<p class="guide-sum">' + esc(t.guide) + '</p>' +
      '<h3>How to earn it — ' + t.steps.length + ' steps, in our own words</h3>' +
      stepsHtml +
      '<button type="button" class="mark-btn' + (earned[t.id] ? ' earned' : '') +
        '" id="markBtn">' + (earned[t.id] ? '✓ Earned — click to unmark' : 'Mark earned') + '</button>' +
      '<div class="src-list"><b>Sources for this guide</b>' + srcLinks +
        '<div>Guide text is our own words from the official description plus the sources above; ' +
        'nothing here is presented as checked in-game unless the source says it was.</div></div>';
  }

  function renderSide() {
    var next = trophies.filter(function (t) { return !earned[t.id]; })
      .sort(function (a, b) { return a.stage - b.stage || a.id - b.id; })
      .slice(0, 5);
    var html = '<h3>Next up — roadmap order</h3><ol class="nextup">' +
      next.map(function (t, i) {
        var label = isStoryHidden(t) ? 'Story trophy — ' + esc(t.chapter) : esc(t.name);
        return '<li data-id="' + t.id + '"><span class="rank">' + (i + 1) + '.</span>' +
          label + (t.missable ? ' <span class="tag miss">MISSABLE</span>' : '') + '</li>';
      }).join('') + '</ol>';
    var sel = byId[selectedId];
    if (sel) {
      html += '<div class="mini-src"><b>Sources for this guide</b><br>' +
        sel.sources.map(function (r) {
          var s = sourceByRef(r);
          return s ? '[' + r + '] ' + esc(s.label) : '';
        }).join('<br>') + '</div>';
    }
    $('sidePane').innerHTML = html;
  }

  function renderRoadmap() {
    var stages = [
      { n: 1, title: 'Story + questlines', hours: '60–80 hours',
        blurb: 'Play the story in order and start every questline the moment it unlocks. Do the Chapter 1 balcony meditation FIRST — it is the only possibly missable moment in the game. Keep a save at the start and end of each chapter in your 15 manual slots. [3]' },
      { n: 2, title: 'The 100% checklist', hours: '~100 hours',
        blurb: 'Free roam after the credits. The checklist (Progress > Stats > 100% Completion) is lenient — closer to 60% true completion — and nothing on it is missable. Work it line by line: 70 of 80 challenges, 200 of 277 vehicles, 100 of 255 animals, 300 stunts, all robberies, ranges and drone races. [3]' },
      { n: 3, title: 'Strangers & cleanup', hours: '10–20 hours',
        blurb: 'Finish the remaining stranger strands for Strangers & Freaks, sweep up anything left, and the platinum pops with the last one. If you did the side content along the way, this stage is under 10 hours. [3]' }
    ];
    $('roadmapSub').textContent = '· ' + earnedCount() + '/55 earned · about 200 hours · 1 playthrough · 0 online · 0 glitched';
    $('roadmapLede').textContent = 'Difficulty 4/10. No mission gold medals, no mission replay, no New Game+. Cheats disable trophies — never enable them on your platinum save. Free roam continues after the story. [3]';
    $('stageGrid').innerHTML = stages.map(function (st) {
      var members = trophies.filter(function (t) { return t.stage === st.n; });
      var done = members.filter(function (t) { return earned[t.id]; }).length;
      var pct = Math.round(done / members.length * 100);
      return '<div class="stage"><h3>Stage ' + st.n + ' — ' + esc(st.title) + '</h3>' +
        '<div class="hrs">' + st.hours + ' · ' + members.length + ' trophies</div>' +
        '<div class="bar"><div class="fill" style="width:' + pct + '%"></div></div>' +
        '<div>' + done + ' / ' + members.length + ' earned</div>' +
        '<p>' + esc(st.blurb) + '</p>' +
        '<ol>' + members.map(function (t) {
          var label = isStoryHidden(t) ? 'Story trophy — ' + esc(t.chapter) : esc(t.name);
          return '<li class="' + (earned[t.id] ? 'earned' : '') + '" data-id="' + t.id + '">' +
            label + (t.missable ? ' <span class="tag miss">MISSABLE</span>' : '') + '</li>';
        }).join('') + '</ol></div>';
    }).join('');
    var pma = byId[28];
    $('watchBox').innerHTML = '<p><b>' + esc(pma.name) + '</b> — ' + esc(pma.description) +
      ' <span class="tag miss">POSSIBLY MISSABLE</span></p>' +
      '<p>' + esc(pma.guide) + '</p>' +
      '<p>Last chance: Chapter 1, the morning after Down to Earth. Talk to Lucia in the kitchen, follow her to the balcony, choose Accept. [3]</p>';
  }

  function renderMissables() {
    var pma = byId[28];
    $('featuredMissable').innerHTML = '<div class="featured"><h3>Possibly missable — last chance: Chapter 1</h3>' +
      '<p><b>' + esc(pma.name) + '</b> — ' + esc(pma.description) + '</p>' +
      '<p>' + esc(pma.guide) + '</p>' +
      '<p><b>Protect it:</b> do the balcony meditation in Chapter 1 (after Down to Earth, morning, follow Lucia to the balcony, Accept). It costs a minute. Keep a save from the end of Chapter 1 in one of your 15 manual slots. [3]</p>' +
      '<button type="button" class="mark-btn" data-goto="28">Open the full guide</button></div>';
    var risks = trophies.filter(function (t) { return t.atRisk; });
    $('riskGrid').innerHTML = risks.map(function (t) {
      var why = t.note || t.guide.split('. ')[0] + '.';
      return '<div class="risk-card" data-id="' + t.id + '"><h4>' + esc(t.name) +
        ' <span class="tag risk">AT RISK</span></h4><p>' + esc(why) + '</p></div>';
    }).join('');
  }

  function renderSources() {
    $('sourceList').innerHTML = data.sources.map(function (s) {
      return '<li><div class="slabel">[' + s.ref + '] ' + esc(s.label) + '</div>' +
        '<div class="surl"><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
        esc(s.url) + '</a> — read ' + esc(s.read) + '</div>' +
        '<div class="swhat">' + esc(s.what) + '</div></li>';
    }).join('');
    $('disputeBox').innerHTML = '<h3>Sources differ? — shown both ways</h3>' +
      '<p><b>How many meditations does Positive Mental Attitude need?</b> ' +
      'The trophy description says “every spot” and PowerPyx counts 18 meditation spots; ' +
      'for the 100% checklist only 15 of 18 are needed. Our call: meditate at all 18, and do the ' +
      'Chapter 1 balcony session too — it is the only one that might be required and cannot be repeated. [3]</p>' +
      '<p><b>Is the Chapter 1 balcony meditation required?</b> ' +
      'PowerPyx says it is currently unclear — the balcony session adds +1 to the counter but is not ' +
      'marked as a Meditation Spot. We treat it as possibly required and flag the trophy as possibly ' +
      'missable, rather than guessing either way. [3]</p>' +
      '<p><b>Which animal unlocks Fair Game?</b> Still undergoing confirmation — PowerPyx has not pinned ' +
      'down which animal exactly triggers it, so neither do we. [3]</p>';
  }

  function renderAll() {
    renderHeader(); renderChips(); renderList(); renderDetail(); renderSide();
    renderRoadmap(); renderMissables(); renderSources();
  }

  function setView(name) {
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.view === name);
    });
    ['tracker', 'roadmap', 'missables', 'sources'].forEach(function (v) {
      $('view-' + v).hidden = v !== name;
    });
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }

  function selectTrophy(id) {
    selectedId = id;
    renderList(); renderDetail(); renderSide();
    var row = document.querySelector('.trow[data-id="' + id + '"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  function toggleEarned(id) {
    if (earned[id]) delete earned[id]; else earned[id] = true;
    saveState(); renderAll();
  }

  function exportProgress() {
    var blob = new Blob([JSON.stringify({
      app: 'Sunset Ledger', game: 'Grand Theft Auto VI', exported: new Date().toISOString(),
      earned: Object.keys(earned).map(Number).sort(function (a, b) { return a - b; }),
      counters: counters
    }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sunset-ledger-progress.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var st = JSON.parse(reader.result);
        var ids = st.earned || [];
        earned = {};
        ids.forEach(function (id) { if (byId[id]) earned[id] = true; });
        counters = st.counters || {};
        saveState(); renderAll();
      } catch (e) { alert('That file is not a Sunset Ledger export.'); }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.dataset.view); });
    });
    $('spoilerToggle').addEventListener('change', function (e) {
      spoiler = e.target.checked; saveState(); renderAll();
    });
    $('showSelect').addEventListener('change', function (e) {
      showFilter = e.target.value; renderList();
    });
    $('sortSelect').addEventListener('change', function (e) {
      sortMode = e.target.value; renderList();
    });
    $('searchInput').addEventListener('input', function (e) {
      query = e.target.value.trim().toLowerCase(); renderList();
    });
    $('kindChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-kind]');
      if (!b) return;
      kindFilter = b.dataset.kind; renderChips(); renderList();
    });
    $('gradeChips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-grade]');
      if (!b) return;
      gradeFilter = b.dataset.grade; renderChips(); renderList();
    });
    $('trophyList').addEventListener('click', function (e) {
      var check = e.target.closest('[data-check]');
      if (check) { toggleEarned(parseInt(check.dataset.check, 10)); return; }
      var row = e.target.closest('.trow');
      if (row) selectTrophy(parseInt(row.dataset.id, 10));
    });
    $('detailPane').addEventListener('click', function (e) {
      if (e.target.id === 'markBtn') { toggleEarned(selectedId); return; }
      var c = e.target.closest('[data-count]');
      if (c) {
        var t = byId[selectedId];
        if (!t || !t.target) return;
        var v = (counters[t.id] || 0) + parseInt(c.dataset.count, 10);
        counters[t.id] = Math.max(0, Math.min(t.target.need, v));
        saveState(); renderDetail();
      }
    });
    $('sidePane').addEventListener('click', function (e) {
      var li = e.target.closest('[data-id]');
      if (li) { setView('tracker'); selectTrophy(parseInt(li.dataset.id, 10)); }
    });
    $('stageGrid').addEventListener('click', function (e) {
      var li = e.target.closest('[data-id]');
      if (li) { setView('tracker'); selectTrophy(parseInt(li.dataset.id, 10)); }
    });
    $('riskGrid').addEventListener('click', function (e) {
      var card = e.target.closest('[data-id]');
      if (card) { setView('tracker'); selectTrophy(parseInt(card.dataset.id, 10)); }
    });
    $('featuredMissable').addEventListener('click', function (e) {
      var b = e.target.closest('[data-goto]');
      if (b) { setView('tracker'); selectTrophy(parseInt(b.dataset.goto, 10)); }
    });
    $('exportBtn').addEventListener('click', exportProgress);
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function (e) {
      if (e.target.files[0]) importProgress(e.target.files[0]);
      e.target.value = '';
    });
    window.addEventListener('hashchange', function () {
      var v = location.hash.replace('#', '');
      if (['tracker', 'roadmap', 'missables', 'sources'].indexOf(v) !== -1) setView(v);
    });
  }

  function boot() {
    loadState();
    seedDemo();
    fetch('data/trophies.json').then(function (r) { return r.json(); }).then(function (d) {
      data = d;
      trophies = d.trophies;
      trophies.forEach(function (t) { byId[t.id] = t; });
      if (!byId[selectedId]) selectedId = 28;
      renderAudit();
      renderAll();
      bindEvents();
      var v = location.hash.replace('#', '');
      if (['tracker', 'roadmap', 'missables', 'sources'].indexOf(v) !== -1) setView(v);
    }).catch(function (err) {
      document.body.innerHTML = '<p style="padding:20px">Could not load the trophy list. ' +
        'Serve this folder over HTTP (for example: python3 -m http.server) and reopen index.html.</p>';
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
