/**
 * Arabic DrillForge — vanilla JS study app
 * MSA + Levantine vocab drill with conjugation refreshers
 */
(function () {
  'use strict';

  const STORAGE = {
    progress: 'adf_progress',
    stats: 'adf_stats',
    settings: 'adf_settings',
    onboarded: 'adf_onboarded',
  };

  const MASTERY_THRESHOLD = 4;
  const PRONOUNS = ['ana', 'enta', 'enti', 'huwa', 'hiya', 'nihna', 'intu', 'hum'];

  let vocabData = { items: [] };
  let conjData = { tables: {}, _meta: {} };
  let progress = {};
  let stats = {};
  let settings = { register: 'msa', contentType: 'verbs' };

  let session = null;
  let selectedItem = null;
  let conjDrill = null;

  // ─── Storage ───────────────────────────────────────────────

  function loadStorage() {
    try {
      progress = JSON.parse(localStorage.getItem(STORAGE.progress) || '{}');
    } catch { progress = {}; }
    try {
      stats = JSON.parse(localStorage.getItem(STORAGE.stats) || '{}');
    } catch { stats = {}; }
    try {
      settings = { register: 'msa', contentType: 'verbs', ...JSON.parse(localStorage.getItem(STORAGE.settings) || '{}') };
    } catch { /* keep defaults */ }

    if (!stats.today) stats.today = todayKey();
    if (!stats.daily) stats.daily = {};
    if (!stats.sessions) stats.sessions = [];
    if (!stats.streak) stats.streak = 0;
    if (!stats.lastStudyDate) stats.lastStudyDate = null;
    if (stats.today !== todayKey()) resetDailyStats();
  }

  function saveProgress() {
    localStorage.setItem(STORAGE.progress, JSON.stringify(progress));
    localStorage.setItem(STORAGE.stats, JSON.stringify(stats));
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function resetDailyStats() {
    const prev = stats.today;
    stats.today = todayKey();
    if (!stats.daily[stats.today]) {
      stats.daily[stats.today] = { drilled: 0, correct: 0, total: 0 };
    }
    if (prev && stats.lastStudyDate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = yesterday.toISOString().slice(0, 10);
      if (stats.lastStudyDate === yKey || stats.lastStudyDate === stats.today) {
        // streak continues if studied yesterday or today
      } else if (stats.lastStudyDate !== stats.today) {
        const d1 = new Date(stats.lastStudyDate);
        const d2 = new Date(stats.today);
        const diff = (d2 - d1) / 86400000;
        if (diff > 1) stats.streak = 0;
      }
    }
  }

  function getItemProgress(id) {
    if (!progress[id]) {
      progress[id] = { msa: { mastery: 0, correct: 0, wrong: 0, streak: 0 }, lev: { mastery: 0, correct: 0, wrong: 0, streak: 0 }, lastSeen: 0 };
    }
    return progress[id];
  }

  function recordAnswer(id, register, correct) {
    const p = getItemProgress(id);
    const r = p[register];
    if (correct) {
      r.correct++;
      r.streak = Math.min(5, r.streak + 1);
      r.mastery = Math.min(5, r.mastery + (r.streak >= 3 ? 1 : 0.5));
      if (r.streak >= 2 && r.mastery < 1) r.mastery = 1;
    } else {
      r.wrong++;
      r.streak = 0;
      r.mastery = Math.max(0, r.mastery - 1);
    }
    p.lastSeen = Date.now();

    const day = stats.daily[stats.today] || (stats.daily[stats.today] = { drilled: 0, correct: 0, total: 0 });
    day.drilled++;
    day.total++;
    if (correct) day.correct++;

    stats.lastStudyDate = stats.today;
    if (day.drilled === 1) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      if (stats.lastStudyDate === todayKey() && (stats._prevStudy === y.toISOString().slice(0, 10) || stats.streak === 0)) {
        stats.streak = (stats._prevStudy === y.toISOString().slice(0, 10)) ? stats.streak + 1 : 1;
      } else if (!stats._prevStudy) stats.streak = Math.max(1, stats.streak);
    }
    stats._prevStudy = stats.today;
    saveProgress();
  }

  // ─── Data helpers ──────────────────────────────────────────

  async function loadData() {
    const [v, c] = await Promise.all([
      fetch('data/vocab.json').then(r => r.json()),
      fetch('data/conjugations.json').then(r => r.json()),
    ]);
    vocabData = v;
    conjData = c;
  }

  function getItems() {
    const type = settings.contentType === 'nouns' ? 'noun' : 'verb';
    if (settings.contentType === 'conjugation') {
      return vocabData.items.filter(i => i.type === 'verb');
    }
    return vocabData.items.filter(i => i.type === type);
  }

  function getRegister(item) {
    return item[settings.register] || item.msa;
  }

  function getOtherRegister(item) {
    return settings.register === 'msa' ? item.lev : item.msa;
  }

  function normalizeArabic(s) {
    if (!s) return '';
    return s
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/[ىی]/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ـ/g, '')
      .trim();
  }

  function normalizeAnswer(s) {
    return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }

  function matchesAnswer(input, expected, isArabic) {
    const a = isArabic ? normalizeArabic(input) : normalizeAnswer(input);
    const parts = (expected || '').split('/').map(p => p.trim());
    return parts.some(exp => {
      const e = isArabic ? normalizeArabic(exp) : normalizeAnswer(exp);
      return a === e || a.includes(e) || e.includes(a);
    });
  }

  function masteryStars(level) {
    const n = Math.round(level);
    return Array.from({ length: 5 }, (_, i) =>
      `<span class="star ${i < n ? 'filled' : ''}">★</span>`
    ).join('');
  }

  function isKnown(id, reg) {
    return getItemProgress(id)[reg].mastery >= MASTERY_THRESHOLD;
  }

  function needsWork(id, reg) {
    const p = getItemProgress(id)[reg];
    return p.mastery < 2 || p.wrong > p.correct;
  }

  function priorityScore(item) {
    const p = getItemProgress(item.id);
    const r = p[settings.register];
    let score = 100 - r.mastery * 15;
    score += r.wrong * 5;
    score -= r.streak * 3;
    score += (Date.now() - (p.lastSeen || 0)) / 86400000;
    return score;
  }

  function allTags() {
    const tags = new Set();
    vocabData.items.forEach(i => (i.tags || []).forEach(t => tags.add(t)));
    return [...tags].sort();
  }

  // ─── Filtering ─────────────────────────────────────────────

  function getFilteredItems() {
    const q = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const filter = document.getElementById('filter-select')?.value || 'all';
    const tag = document.getElementById('tag-select')?.value || '';

    return getItems().filter(item => {
      const reg = getRegister(item);
      const other = getOtherRegister(item);
      if (tag && !(item.tags || []).includes(tag)) return false;

      if (filter === 'known' && !isKnown(item.id, settings.register)) return false;
      if (filter === 'needs-work' && !needsWork(item.id, settings.register)) return false;

      if (q) {
        const hay = [
          item.english, reg.form, reg.translit, reg.root, reg.example,
          other.form, other.translit, other.example,
          ...(item.tags || []),
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  // ─── Render: Browse ────────────────────────────────────────

  function renderBrowse() {
    const items = getFilteredItems();
    const list = document.getElementById('item-list');
    const empty = document.getElementById('empty-state');
    list.innerHTML = '';

    if (items.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    items.forEach(item => {
      const reg = getRegister(item);
      const other = getOtherRegister(item);
      const p = getItemProgress(item.id);
      const m = p[settings.register].mastery;

      const card = document.createElement('button');
      card.className = 'item-card text-left w-full p-3 bg-forge-900 border border-forge-700 rounded-lg';
      card.innerHTML = `
        <div class="flex justify-between items-start gap-2 mb-1">
          <span class="text-sm text-gray-300">${esc(item.english)}</span>
          <span class="stars shrink-0">${masteryStars(m)}</span>
        </div>
        <div class="arabic arabic-sm text-forge-300 mb-1">${esc(reg.form)}</div>
        <div class="translit mb-2">${esc(reg.translit)}</div>
        <div class="text-xs text-forge-500 border-t border-forge-700 pt-2">
          <span class="text-forge-400">${settings.register === 'msa' ? 'Lev' : 'MSA'}:</span>
          ${esc(other.form)}
        </div>
        <div class="mt-1 flex flex-wrap gap-1">${(item.tags || []).slice(0, 3).map(t => `<span class="tag-pill">${esc(t)}</span>`).join('')}</div>
      `;
      card.addEventListener('click', () => openDetail(item));
      list.appendChild(card);
    });
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ─── Detail modal ──────────────────────────────────────────

  function openDetail(item) {
    selectedItem = item;
    const reg = getRegister(item);
    const other = getOtherRegister(item);
    const conj = conjData.tables[item.id];

    document.getElementById('modal-title').textContent = item.english;
    let body = `
      <div class="grid sm:grid-cols-2 gap-4 mb-4">
        <div class="p-3 bg-forge-800 rounded border border-forge-600">
          <div class="text-xs text-forge-accent font-semibold mb-1">MSA</div>
          <div class="arabic mb-1">${esc(item.msa.form)}</div>
          <div class="translit">${esc(item.msa.translit)}</div>
          ${item.msa.root ? `<div class="text-xs text-forge-500 mt-1">Root: ${esc(item.msa.root)}</div>` : ''}
          <div class="text-sm text-gray-400 mt-2 italic arabic arabic-sm">${esc(item.msa.example)}</div>
        </div>
        <div class="p-3 bg-forge-800 rounded border border-forge-600">
          <div class="text-xs text-forge-success font-semibold mb-1">Levantine</div>
          <div class="arabic mb-1">${esc(item.lev.form)}</div>
          <div class="translit">${esc(item.lev.translit)}</div>
          ${item.lev.notes ? `<div class="text-xs text-forge-500 mt-1">${esc(item.lev.notes)}</div>` : ''}
          <div class="text-sm text-gray-400 mt-2 italic arabic arabic-sm">${esc(item.lev.example)}</div>
        </div>
      </div>
    `;

    if (conj && item.type === 'verb') {
      body += `<p class="text-sm text-forge-400 mb-2">Conjugation available — see Conjugation tab for full tables.</p>`;
      body += renderMiniConj(conj);
    }

    document.getElementById('modal-body').innerHTML = body;
    const modal = document.getElementById('detail-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function renderMiniConj(conj) {
    const p = 'ana';
    const msaP = conj.msa?.past?.[p] || '—';
    const msaPr = conj.msa?.present?.[p] || '—';
    const levP = conj.lev?.past?.[p] || '—';
    const levPr = conj.lev?.present?.[p] || '—';
    return `
      <table class="conj-table text-sm">
        <tr><th></th><th>MSA Past</th><th>MSA Present</th><th>Lev Past</th><th>Lev Present</th></tr>
        <tr><td>أنا</td><td class="arabic-cell">${esc(msaP)}</td><td class="arabic-cell">${esc(msaPr)}</td><td class="arabic-cell">${esc(levP)}</td><td class="arabic-cell">${esc(levPr)}</td></tr>
      </table>
    `;
  }

  function closeDetail() {
    document.getElementById('detail-modal').classList.add('hidden');
    document.getElementById('detail-modal').classList.remove('flex');
    selectedItem = null;
  }

  // ─── Drill session ─────────────────────────────────────────

  function buildSessionQueue(count) {
    const pool = getFilteredItems();
    if (pool.length === 0) return [];

    const sorted = [...pool].sort((a, b) => priorityScore(b) - priorityScore(a));
    const needsWorkItems = sorted.filter(i => needsWork(i.id, settings.register));
    const queue = [];
    const nwCount = Math.ceil(count * 0.6);
    const rest = count - nwCount;

    for (let i = 0; i < nwCount && i < needsWorkItems.length; i++) queue.push(needsWorkItems[i]);
    const remaining = sorted.filter(i => !queue.includes(i));
    for (let i = 0; i < rest && i < remaining.length; i++) queue.push(remaining[i]);

    while (queue.length < count && queue.length < pool.length) {
      const next = remaining.find(i => !queue.includes(i));
      if (!next) break;
      queue.push(next);
    }

    return shuffle(queue).slice(0, count);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startDrill() {
    const mode = document.getElementById('drill-mode').value;
    const count = parseInt(document.getElementById('drill-count').value, 10);
    const direction = document.getElementById('drill-direction').value;
    const queue = buildSessionQueue(count);

    if (queue.length === 0) {
      alert('No items to drill. Adjust filters or browse more words.');
      return;
    }

    session = {
      mode,
      direction,
      queue,
      index: 0,
      results: [],
      flipped: false,
      answered: false,
      mcOptions: null,
      startTime: Date.now(),
    };

    document.getElementById('drill-setup').classList.add('hidden');
    document.getElementById('browse-view').classList.add('hidden');
    document.getElementById('browse-toolbar').classList.add('hidden');
    document.getElementById('conjugation-view').classList.add('hidden');
    document.getElementById('session-summary').classList.add('hidden');
    document.getElementById('drill-view').classList.remove('hidden');
    document.getElementById('drill-mode-label').textContent =
      mode === 'flashcard' ? 'Flashcard' : mode === 'mc' ? 'Multiple Choice' : 'Typing';

    renderDrillItem();
  }

  function currentItem() {
    return session?.queue[session.index];
  }

  function getPromptDirection() {
    if (session.direction === 'mixed') {
      return Math.random() < 0.5 ? 'ar-en' : 'en-ar';
    }
    return session.direction;
  }

  function renderDrillItem() {
    if (!session) return;
    const item = currentItem();
    if (!item) return endSession();

    session.flipped = false;
    session.answered = false;
    session.itemDirection = getPromptDirection();
    session.mcOptions = null;

    document.getElementById('drill-progress-text').textContent =
      `${session.index + 1} / ${session.queue.length}`;
    document.getElementById('drill-feedback').classList.add('hidden');

    const area = document.getElementById('drill-card-area');
    const actions = document.getElementById('drill-actions');
    actions.innerHTML = '';

    if (session.mode === 'flashcard') renderFlashcard(area, actions, item);
    else if (session.mode === 'mc') renderMC(area, actions, item);
    else renderTyping(area, actions, item);
  }

  function renderFlashcard(area, actions, item) {
    const reg = getRegister(item);
    const showArabic = session.itemDirection === 'ar-en';
    const front = showArabic ? reg.form : item.english;
    const back = showArabic ? item.english : reg.form;
    const backTrans = showArabic ? '' : reg.translit;
    const other = getOtherRegister(item);

    area.innerHTML = `
      <div class="flashcard" id="flashcard">
        <div class="flashcard-inner" id="flashcard-inner">
          <div class="flashcard-face front">
            <div class="text-xs text-forge-400 mb-3 uppercase tracking-wider">${showArabic ? 'Arabic' : 'English'} — press Space to flip</div>
            <div class="${showArabic ? 'arabic arabic-lg' : 'text-2xl font-semibold'}">${esc(front)}</div>
          </div>
          <div class="flashcard-face back">
            <div class="text-xs text-forge-400 mb-3">${showArabic ? 'English' : 'Arabic'}</div>
            <div class="${showArabic ? 'text-2xl font-semibold' : 'arabic arabic-lg'}">${esc(back)}</div>
            ${backTrans ? `<div class="translit mt-2">${esc(backTrans)}</div>` : ''}
            <div class="mt-4 text-sm text-forge-400 border-t border-forge-600 pt-3 w-full">
              <span class="text-forge-accent">${settings.register === 'msa' ? 'Levantine' : 'MSA'}:</span>
              <span class="arabic arabic-sm mr-2">${esc(other.form)}</span>
              <span class="translit">${esc(other.translit)}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const inner = document.getElementById('flashcard-inner');
    const flip = () => { session.flipped = !session.flipped; inner.classList.toggle('flipped', session.flipped); };
    document.getElementById('flashcard').addEventListener('click', flip);

    if (!session.answered) {
      actions.innerHTML = `
        <button id="btn-knew" class="px-6 py-2 bg-forge-success text-forge-950 font-semibold rounded">Knew it</button>
        <button id="btn-missed" class="px-6 py-2 bg-forge-danger/80 text-white font-semibold rounded">Missed</button>
      `;
      document.getElementById('btn-knew').onclick = () => submitFlashcard(true);
      document.getElementById('btn-missed').onclick = () => submitFlashcard(false);
    }
  }

  function submitFlashcard(correct) {
    if (session.answered) return;
    session.answered = true;
    const item = currentItem();
    recordAnswer(item.id, settings.register, correct);
    session.results.push({ id: item.id, english: item.english, correct });
    showFeedback(item, correct);
    document.getElementById('drill-actions').innerHTML =
      `<button id="btn-next" class="px-6 py-2 bg-forge-accent text-forge-950 font-semibold rounded">Continue (Space)</button>`;
    document.getElementById('btn-next').onclick = nextDrill;
  }

  function renderMC(area, actions, item) {
    const reg = getRegister(item);
    const showArabic = session.itemDirection === 'ar-en';
    const prompt = showArabic ? reg.form : item.english;

    const pool = getItems().filter(i => i.id !== item.id);
    const distractors = shuffle(pool).slice(0, 3);
    const correctText = showArabic ? item.english : reg.form;
    const options = shuffle([
      { text: correctText, correct: true },
      ...distractors.map(d => ({
        text: showArabic ? d.english : getRegister(d).form,
        correct: false,
      })),
    ]);
    session.mcOptions = options;

    area.innerHTML = `
      <div class="p-6 bg-forge-900 border border-forge-600 rounded-lg text-center mb-4">
        <div class="text-xs text-forge-400 mb-2">${showArabic ? 'What does this mean?' : 'How do you say this?'}</div>
        <div class="${showArabic ? 'arabic arabic-lg' : 'text-2xl font-semibold'}">${esc(prompt)}</div>
        ${showArabic ? `<div class="translit mt-1">${esc(reg.translit)}</div>` : ''}
      </div>
      <div class="grid sm:grid-cols-2 gap-2" id="mc-options">
        ${options.map((o, i) => `
          <button class="mc-option p-3 text-left bg-forge-800 border border-forge-600 rounded ${!showArabic && o.correct ? 'arabic' : ''}" data-idx="${i}">
            <span class="text-forge-500 text-xs mr-2">${i + 1}</span>
            ${esc(o.text)}
          </button>
        `).join('')}
      </div>
    `;

    document.querySelectorAll('.mc-option').forEach(btn => {
      btn.addEventListener('click', () => pickMC(parseInt(btn.dataset.idx, 10)));
    });
  }

  function pickMC(idx) {
    if (session.answered) return;
    session.answered = true;
    const item = currentItem();
    const correct = session.mcOptions[idx].correct;

    document.querySelectorAll('.mc-option').forEach((btn, i) => {
      btn.disabled = true;
      if (session.mcOptions[i].correct) btn.classList.add('correct');
      else if (i === idx) btn.classList.add('wrong');
    });

    recordAnswer(item.id, settings.register, correct);
    session.results.push({ id: item.id, english: item.english, correct });
    showFeedback(item, correct);
    document.getElementById('drill-actions').innerHTML =
      `<button id="btn-next" class="px-6 py-2 bg-forge-accent text-forge-950 font-semibold rounded">Continue (Space)</button>`;
    document.getElementById('btn-next').onclick = nextDrill;
  }

  function renderTyping(area, actions, item) {
    const reg = getRegister(item);
    const showArabic = session.itemDirection === 'ar-en';
    const prompt = showArabic ? reg.form : item.english;
    const placeholder = showArabic ? 'Type English meaning…' : 'Type Arabic (diacritics optional)…';

    area.innerHTML = `
      <div class="p-6 bg-forge-900 border border-forge-600 rounded-lg text-center mb-4">
        <div class="text-xs text-forge-400 mb-2">${showArabic ? 'Type the English meaning' : 'Type the Arabic'}</div>
        <div class="${showArabic ? 'arabic arabic-lg' : 'text-2xl font-semibold'}">${esc(prompt)}</div>
        ${showArabic ? `<div class="translit mt-1">${esc(reg.translit)}</div>` : ''}
      </div>
      <input type="text" id="typing-input" class="w-full px-4 py-3 bg-forge-800 border border-forge-600 rounded text-lg focus:border-forge-accent" placeholder="${placeholder}" autocomplete="off" dir="${showArabic ? 'ltr' : 'rtl'}">
    `;

    actions.innerHTML = `<button id="btn-submit" class="px-6 py-2 bg-forge-accent text-forge-950 font-semibold rounded">Submit (Enter)</button>`;
    document.getElementById('btn-submit').onclick = submitTyping;
    setTimeout(() => document.getElementById('typing-input')?.focus(), 50);
  }

  function submitTyping() {
    if (session.answered) return;
    const item = currentItem();
    const reg = getRegister(item);
    const input = document.getElementById('typing-input')?.value || '';
    const showArabic = session.itemDirection === 'ar-en';
    const expected = showArabic ? item.english : reg.form;
    const correct = matchesAnswer(input, expected, !showArabic);

    session.answered = true;
    recordAnswer(item.id, settings.register, correct);
    session.results.push({ id: item.id, english: item.english, correct });
    showFeedback(item, correct, input, expected);
    document.getElementById('drill-actions').innerHTML =
      `<button id="btn-next" class="px-6 py-2 bg-forge-accent text-forge-950 font-semibold rounded">Continue (Space)</button>`;
    document.getElementById('btn-next').onclick = nextDrill;
  }

  function showFeedback(item, correct, userAns, expected) {
    const fb = document.getElementById('drill-feedback');
    const other = getOtherRegister(item);
    const reg = getRegister(item);
    fb.classList.remove('hidden', 'feedback-correct', 'feedback-wrong');
    fb.classList.add(correct ? 'feedback-correct' : 'feedback-wrong');
    fb.innerHTML = `
      <div class="font-semibold ${correct ? 'text-forge-success' : 'text-forge-danger'}">${correct ? '✓ Correct' : '✗ Incorrect'}</div>
      ${!correct && expected ? `<div class="text-sm mt-1">Expected: <strong>${esc(expected)}</strong>${userAns ? ` — You: ${esc(userAns)}` : ''}</div>` : ''}
      <div class="mt-2 text-sm text-forge-400">
        <span class="text-forge-accent">${settings.register.toUpperCase()}:</span> <span class="arabic arabic-sm">${esc(reg.form)}</span>
        &nbsp;|&nbsp;
        <span class="text-forge-success">${settings.register === 'msa' ? 'LEV' : 'MSA'}:</span> <span class="arabic arabic-sm">${esc(other.form)}</span>
      </div>
      ${item.lev.notes ? `<div class="text-xs text-forge-500 mt-1">${esc(item.lev.notes)}</div>` : ''}
    `;
    updateStats();
  }

  function nextDrill() {
    session.index++;
    if (session.index >= session.queue.length) endSession();
    else renderDrillItem();
  }

  function endSession() {
    const correct = session.results.filter(r => r.correct).length;
    const total = session.results.length;
    const acc = total ? Math.round((correct / total) * 100) : 0;

    stats.sessions.push({
      date: new Date().toISOString(),
      mode: session.mode,
      register: settings.register,
      correct,
      total,
      accuracy: acc,
    });
    saveProgress();

    document.getElementById('drill-view').classList.add('hidden');
    const summary = document.getElementById('session-summary');
    summary.classList.remove('hidden');

    document.getElementById('summary-stats').innerHTML = `
      <div class="bg-forge-800 rounded p-4 text-center"><div class="text-forge-400 text-xs">Accuracy</div><div class="text-3xl font-bold text-forge-accent">${acc}%</div></div>
      <div class="bg-forge-800 rounded p-4 text-center"><div class="text-forge-400 text-xs">Correct</div><div class="text-3xl font-bold text-forge-success">${correct}</div></div>
      <div class="bg-forge-800 rounded p-4 text-center"><div class="text-forge-400 text-xs">Total</div><div class="text-3xl font-bold">${total}</div></div>
    `;

    const weak = session.results.filter(r => !r.correct);
    const weakEl = document.getElementById('summary-weak');
    if (weak.length) {
      weakEl.innerHTML = `<h4 class="text-sm font-semibold text-forge-danger mb-2">Needs more work:</h4><ul class="text-sm space-y-1">${weak.map(w => `<li>• ${esc(w.english)}</li>`).join('')}</ul>`;
    } else {
      weakEl.innerHTML = `<p class="text-forge-success text-sm">Perfect session — outstanding.</p>`;
    }

    session = null;
    updateStats();
  }

  function exitDrill() {
    if (session && !confirm('Exit drill? Progress for answered items is saved.')) return;
    session = null;
    showBrowse();
  }

  function showBrowse() {
    document.getElementById('drill-view').classList.add('hidden');
    document.getElementById('drill-setup').classList.add('hidden');
    document.getElementById('session-summary').classList.add('hidden');
    document.getElementById('conjugation-view').classList.add('hidden');
    document.getElementById('browse-toolbar').classList.remove('hidden');
    document.getElementById('browse-view').classList.remove('hidden');
    renderBrowse();
  }

  // ─── Conjugation ───────────────────────────────────────────

  function renderConjugation() {
    const select = document.getElementById('conj-verb-select');
    const verbs = vocabData.items.filter(i => i.type === 'verb' && conjData.tables[i.id]);
    select.innerHTML = verbs.map(v =>
      `<option value="${v.id}">${esc(v.english)} — ${esc(v.msa.form.split('/')[0].trim())}</option>`
    ).join('');

    if (verbs.length === 0) {
      document.getElementById('conj-tables').innerHTML =
        '<p class="text-forge-400">No conjugation tables yet. Add entries in data/conjugations.json.</p>';
      return;
    }

    select.onchange = () => renderConjTable(select.value);
    renderConjTable(select.value || verbs[0].id);
  }

  function renderConjTable(verbId) {
    const conj = conjData.tables[verbId];
    if (!conj) return;
    const labels = conjData._meta?.pronoun_labels || {};

    const row = (tense, msaForms, levForms) => PRONOUNS.map(p => `
      <tr>
        <td>${esc(labels[p] || p)}</td>
        <td class="arabic-cell">${esc(msaForms?.[p] || '—')}</td>
        <td class="arabic-cell">${esc(levForms?.[p] || '—')}</td>
      </tr>
    `).join('');

    document.getElementById('conj-tables').innerHTML = `
      <h3 class="font-semibold mb-3">${esc(conj.english)}</h3>
      <div class="mb-2 p-2 bg-forge-800 rounded text-xs text-forge-400">
        <strong>Lev note:</strong> Present uses b- prefix (بْ). Case endings dropped in speech.
        ${conj.lev?.future_note ? ` Future: ${esc(conj.lev.future_note)}` : ''}
      </div>
      <h4 class="text-sm text-forge-accent mt-4 mb-2">Past (Perfect)</h4>
      <table class="conj-table mb-4">
        <tr><th>Pronoun</th><th>MSA</th><th>Levantine</th></tr>
        ${row('past', conj.msa?.past, conj.lev?.past)}
      </table>
      <h4 class="text-sm text-forge-accent mb-2">Present (Imperfect)</h4>
      <table class="conj-table mb-4">
        <tr><th>Pronoun</th><th>MSA</th><th>Levantine (b-)</th></tr>
        ${row('present', conj.msa?.present, conj.lev?.present)}
      </table>
      <div class="text-xs text-forge-500">
        MSA Future: ${esc(conj.msa?.future_note || 'سَ + present')}
      </div>
    `;
  }

  function startConjDrill() {
    const verbId = document.getElementById('conj-verb-select').value;
    const conj = conjData.tables[verbId];
    if (!conj) return;

    const tense = Math.random() < 0.5 ? 'past' : 'present';
    const pronoun = PRONOUNS[Math.floor(Math.random() * PRONOUNS.length)];
    const reg = settings.register;
    const expected = conj[reg]?.[tense]?.[pronoun];
    if (!expected) return;

    const labels = conjData._meta?.pronoun_labels || {};
    conjDrill = { verbId, tense, pronoun, reg, expected, answered: false };

    const area = document.getElementById('conj-drill-area');
    area.classList.remove('hidden');
    area.innerHTML = `
      <h4 class="font-semibold text-forge-accent mb-2">Conjugation Drill</h4>
      <p class="text-sm mb-3">Conjugate <strong>${esc(conj.english)}</strong> — ${reg === 'lev' ? 'Levantine' : 'MSA'} <strong>${tense}</strong> for <strong>${esc(labels[pronoun] || pronoun)}</strong></p>
      <input type="text" id="conj-input" class="w-full px-4 py-3 bg-forge-800 border border-forge-600 rounded arabic text-xl mb-3" dir="rtl" autocomplete="off" placeholder="Type conjugated form…">
      <button id="conj-submit" class="px-4 py-2 bg-forge-accent text-forge-950 font-semibold rounded">Check (Enter)</button>
      <div id="conj-result" class="mt-3 hidden"></div>
      <button id="conj-show-table" class="mt-2 text-sm text-forge-400 hover:text-white hidden">Show full table</button>
    `;
    document.getElementById('conj-submit').onclick = checkConjDrill;
    document.getElementById('conj-input').focus();
  }

  function checkConjDrill() {
    if (!conjDrill || conjDrill.answered) return;
    conjDrill.answered = true;
    const input = document.getElementById('conj-input').value;
    const correct = matchesAnswer(input, conjDrill.expected, true);
    const result = document.getElementById('conj-result');
    result.classList.remove('hidden');
    result.className = `mt-3 p-3 rounded border ${correct ? 'feedback-correct' : 'feedback-wrong'}`;
    result.innerHTML = correct
      ? `<span class="text-forge-success font-semibold">✓ Correct: ${esc(conjDrill.expected)}</span>`
      : `<span class="text-forge-danger font-semibold">✗ Expected: ${esc(conjDrill.expected)}</span>${input ? ` — You: ${esc(input)}` : ''}`;

    document.getElementById('conj-show-table').classList.remove('hidden');
    document.getElementById('conj-show-table').onclick = () => renderConjTable(conjDrill.verbId);
    recordAnswer(conjDrill.verbId, conjDrill.reg, correct);
    updateStats();
  }

  // ─── Stats ─────────────────────────────────────────────────

  function updateStats() {
    const day = stats.daily[stats.today] || { drilled: 0, correct: 0, total: 0 };
    document.getElementById('stat-today').textContent = day.drilled;
    document.getElementById('stat-accuracy').textContent =
      day.total ? `${Math.round((day.correct / day.total) * 100)}%` : '—';
    document.getElementById('stat-streak').textContent = stats.streak || 0;

    let mastered = 0;
    vocabData.items.forEach(i => {
      if (isKnown(i.id, settings.register)) mastered++;
    });
    document.getElementById('stat-mastered').textContent = mastered;

    const verbs = vocabData.items.filter(i => i.type === 'verb');
    const nouns = vocabData.items.filter(i => i.type === 'noun');
    const all = vocabData.items;

    let msaKnown = 0, levKnown = 0;
    all.forEach(i => {
      if (isKnown(i.id, 'msa')) msaKnown++;
      if (isKnown(i.id, 'lev')) levKnown++;
    });

    const msaPct = all.length ? (msaKnown / all.length) * 100 : 0;
    const levPct = all.length ? (levKnown / all.length) * 100 : 0;
    document.getElementById('bar-msa').style.width = `${msaPct}%`;
    document.getElementById('bar-lev').style.width = `${levPct}%`;
    document.getElementById('bar-msa-label').textContent = `${msaKnown} / ${all.length}`;
    document.getElementById('bar-lev-label').textContent = `${levKnown} / ${all.length}`;
  }

  function exportProgress() {
    const blob = new Blob([JSON.stringify({ progress, stats, settings, exported: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `drillforge-progress-${todayKey()}.json`;
    a.click();
  }

  function importProgress(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.progress) progress = data.progress;
        if (data.stats) stats = { ...stats, ...data.stats };
        if (data.settings) settings = { ...settings, ...data.settings };
        saveProgress();
        updateStats();
        renderBrowse();
        alert('Progress imported successfully.');
      } catch {
        alert('Invalid progress file.');
      }
    };
    reader.readAsText(file);
  }

  function hardReset() {
    if (!confirm('Delete ALL progress? This cannot be undone.')) return;
    progress = {};
    stats = { today: todayKey(), daily: {}, sessions: [], streak: 0, lastStudyDate: null };
    localStorage.removeItem(STORAGE.progress);
    localStorage.removeItem(STORAGE.stats);
    saveProgress();
    updateStats();
    renderBrowse();
  }

  // ─── Views / navigation ──────────────────────────────────────

  function setRegister(reg) {
    settings.register = reg;
    saveProgress();
    document.querySelectorAll('.register-tab').forEach(btn => {
      const active = btn.dataset.register === reg;
      btn.classList.toggle('bg-forge-accent', active);
      btn.classList.toggle('text-forge-950', active);
      btn.classList.toggle('bg-forge-800', !active);
      btn.classList.toggle('text-gray-300', !active);
      btn.setAttribute('aria-selected', active);
    });
    renderBrowse();
    updateStats();
  }

  function setContentType(type) {
    settings.contentType = type;
    saveProgress();
    document.querySelectorAll('.content-tab').forEach(btn => {
      const active = btn.dataset.content === type;
      btn.classList.toggle('bg-forge-700', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('bg-forge-800', !active);
      btn.classList.toggle('text-gray-400', !active);
    });

    const isConj = type === 'conjugation';
    document.getElementById('browse-view').classList.toggle('hidden', isConj);
    document.getElementById('browse-toolbar').classList.toggle('hidden', isConj);
    document.getElementById('conjugation-view').classList.toggle('hidden', !isConj);

    if (isConj) renderConjugation();
    else renderBrowse();
  }

  function populateTags() {
    const sel = document.getElementById('tag-select');
    const current = sel.value;
    sel.innerHTML = '<option value="">All tags</option>' +
      allTags().map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    sel.value = current;
  }

  function speakArabic(text) {
    if (!text || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text.replace(/\/.*$/, '').trim());
    u.lang = settings.register === 'lev' ? 'ar-LB' : 'ar-SA';
    speechSynthesis.speak(u);
  }

  // ─── Keyboard ────────────────────────────────────────────────

  function onKeydown(e) {
    if (e.target.matches('input, textarea, select') && e.key !== 'Enter' && e.key !== ' ') return;

    if (session && !session.answered) {
      if (session.mode === 'flashcard' && e.code === 'Space') {
        e.preventDefault();
        const inner = document.getElementById('flashcard-inner');
        if (inner) { session.flipped = !session.flipped; inner.classList.toggle('flipped', session.flipped); }
        return;
      }
      if (session.mode === 'mc' && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        pickMC(parseInt(e.key, 10) - 1);
        return;
      }
      if (session.mode === 'typing' && e.key === 'Enter') {
        e.preventDefault();
        submitTyping();
        return;
      }
    }

    if (session && session.answered && (e.code === 'Space' || e.key === 'Enter')) {
      e.preventDefault();
      nextDrill();
      return;
    }

    if (conjDrill && !conjDrill.answered && e.key === 'Enter' && document.activeElement?.id === 'conj-input') {
      e.preventDefault();
      checkConjDrill();
    }
  }

  // ─── Init ────────────────────────────────────────────────────

  function bindEvents() {
    document.getElementById('tab-msa').onclick = () => setRegister('msa');
    document.getElementById('tab-lev').onclick = () => setRegister('lev');

    document.querySelectorAll('.content-tab').forEach(btn => {
      btn.onclick = () => setContentType(btn.dataset.content);
    });

    document.getElementById('search-input').oninput = renderBrowse;
    document.getElementById('filter-select').onchange = renderBrowse;
    document.getElementById('tag-select').onchange = renderBrowse;

    document.getElementById('btn-start-drill').onclick = () => {
      document.getElementById('drill-setup').classList.remove('hidden');
    };
    document.getElementById('drill-begin').onclick = startDrill;
    document.getElementById('drill-cancel').onclick = () => {
      document.getElementById('drill-setup').classList.add('hidden');
    };
    document.getElementById('drill-exit').onclick = exitDrill;
    document.getElementById('summary-close').onclick = showBrowse;

    document.getElementById('modal-close').onclick = closeDetail;
    document.getElementById('detail-modal').onclick = (e) => {
      if (e.target.id === 'detail-modal') closeDetail();
    };
    document.getElementById('modal-tts').onclick = () => {
      if (selectedItem) speakArabic(getRegister(selectedItem).form);
    };
    document.getElementById('modal-drill').onclick = () => {
      if (!selectedItem) return;
      closeDetail();
      document.getElementById('drill-setup').classList.remove('hidden');
    };

    document.getElementById('conj-drill-btn').onclick = startConjDrill;

    document.getElementById('btn-export').onclick = exportProgress;
    document.getElementById('import-file').onchange = (e) => {
      if (e.target.files[0]) importProgress(e.target.files[0]);
    };
    document.getElementById('btn-reset').onclick = hardReset;

    document.getElementById('stats-toggle')?.addEventListener('click', () => {
      const panel = document.getElementById('stats-panel');
      panel.classList.toggle('mobile-open');
      panel.classList.toggle('hidden');
    });

    document.getElementById('onboarding-dismiss').onclick = () => {
      document.getElementById('onboarding').classList.add('hidden');
      document.getElementById('onboarding').classList.remove('flex');
      localStorage.setItem(STORAGE.onboarded, '1');
    };

    document.addEventListener('keydown', onKeydown);
  }

  async function init() {
    loadStorage();
    await loadData();
    populateTags();
    bindEvents();
    setRegister(settings.register || 'msa');
    setContentType(settings.contentType || 'verbs');
    updateStats();

    if (!localStorage.getItem(STORAGE.onboarded)) {
      const ob = document.getElementById('onboarding');
      ob.classList.remove('hidden');
      ob.classList.add('flex');
    }
  }

  init().catch(err => {
    console.error(err);
    document.getElementById('main-content').innerHTML =
      `<p class="text-forge-danger p-4">Failed to load data. Serve via HTTP (e.g. GitHub Pages), not file://. Error: ${esc(String(err))}</p>`;
  });
})();