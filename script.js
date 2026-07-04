/**
 * Arabic DrillForge — vanilla JS study app
 * MSA + Levantine vocab drill with conjugation refreshers
 */
(function () {
  'use strict';

  const APP_VERSION = '5';

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
  let sentencesData = { sentences: [] };
  let progress = {};
  let stats = {};
  let settings = { register: 'msa', contentType: 'verbs' };

  let session = null;
  let selectedItem = null;
  let conjDrill = null;
  let sentenceSession = null;

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

  async function fetchJson(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} returned ${r.status}`);
    return r.json();
  }

  function buildSentencesFromVocab() {
    const sentences = [];
    vocabData.items.forEach(item => {
      ['msa', 'lev'].forEach(reg => {
        const ar = item[reg]?.example?.trim();
        if (!ar) return;
        const gloss = item.english.split('/')[0].replace(/^to /, '').trim().toLowerCase();
        const keywords = gloss.split(/\s+/).filter(w => w.length > 2);
        sentences.push({
          id: `${item.id}-${reg}`,
          vocab_id: item.id,
          register: reg,
          arabic: ar,
          english: item[reg]?.example_en || `(${item.english})`,
          keywords,
          tags: item.tags || [],
        });
      });
    });
    return sentences;
  }

  function ensureSentences() {
    if (sentencesData.sentences?.length) return sentencesData.sentences.length;
    sentencesData.sentences = buildSentencesFromVocab();
    return sentencesData.sentences.length;
  }

  async function loadData() {
    vocabData = await fetchJson(`data/vocab.json?v=${APP_VERSION}`);
    conjData = await fetchJson(`data/conjugations.json?v=${APP_VERSION}`);
    try {
      sentencesData = await fetchJson(`data/sentences.json?v=${APP_VERSION}`);
    } catch (err) {
      console.warn('Could not load sentences.json, using vocab fallback:', err);
      sentencesData = { sentences: [] };
    }
    ensureSentences();
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

  function normalizeEnglish(s) {
    return (s || '')
      .toLowerCase()
      .replace(/[^\w\s'?]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const val = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
        row[j - 1] = prev;
        prev = val;
      }
      row[b.length] = prev;
    }
    return row[b.length];
  }

  function similarity(a, b) {
    const x = normalizeEnglish(a);
    const y = normalizeEnglish(b);
    if (!x && !y) return 1;
    const maxLen = Math.max(x.length, y.length);
    if (!maxLen) return 1;
    return 1 - levenshtein(x, y) / maxLen;
  }

  function fuzzyMatchEnglish(input, sentence) {
    const norm = normalizeEnglish(input);
    if (!norm) return false;

    const targets = [sentence.english, ...(sentence.accept || [])];
    for (const target of targets) {
      const t = normalizeEnglish(target);
      if (!t) continue;
      if (norm === t) return true;
      if (similarity(norm, t) >= 0.82) return true;
      if (t.includes(norm) || norm.includes(t)) return true;
    }

    const keywords = sentence.keywords || [];
    if (keywords.length >= 2) {
      const words = norm.split(' ').filter(Boolean);
      const hit = keywords.filter(kw =>
        norm.includes(kw) || words.some(w => w === kw || similarity(w, kw) >= 0.8 || levenshtein(w, kw) <= 1)
      );
      if (hit.length / keywords.length >= 0.65 && hit.length >= 2) return true;
    }

    return false;
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
    document.getElementById('sentences-view').classList.add('hidden');
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
    setContentType(settings.contentType || 'verbs');
  }

  // ─── Conjugation ───────────────────────────────────────────

  function renderConjugation() {
    conjDrill = null;
    const drillArea = document.getElementById('conj-drill-area');
    if (drillArea) {
      drillArea.classList.add('hidden');
      drillArea.innerHTML = '';
    }

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

  function gatherConjWrongOptions(conj, reg, tense, pronoun, expected) {
    const pool = new Set();
    ['past', 'present'].forEach(t => {
      PRONOUNS.forEach(p => {
        const form = conj[reg]?.[t]?.[p];
        if (form && form !== expected) pool.add(form);
      });
      const otherReg = reg === 'msa' ? 'lev' : 'msa';
      PRONOUNS.forEach(p => {
        const form = conj[otherReg]?.[t]?.[p];
        if (form && form !== expected) pool.add(form);
      });
    });
    return shuffle([...pool]).slice(0, 8);
  }

  function startConjDrill() {
    const verbId = document.getElementById('conj-verb-select')?.value;
    const conj = conjData.tables[verbId];
    const area = document.getElementById('conj-drill-area');
    if (!conj || !area) {
      alert('Select a verb with conjugation data first.');
      return;
    }

    const tense = Math.random() < 0.5 ? 'past' : 'present';
    const pronoun = PRONOUNS[Math.floor(Math.random() * PRONOUNS.length)];
    const reg = settings.register;
    const expected = conj[reg]?.[tense]?.[pronoun];
    if (!expected) {
      alert('No conjugation form found for this combination. Try another verb.');
      return;
    }

    const labels = conjData._meta?.pronoun_labels || {};
    const wrongPool = gatherConjWrongOptions(conj, reg, tense, pronoun, expected);
    const distractors = wrongPool.slice(0, 3);
    while (distractors.length < 3) {
      const fallback = wrongPool[distractors.length] || expected;
      if (!distractors.includes(fallback)) distractors.push(fallback);
      else break;
    }
    const options = shuffle([
      { text: expected, correct: true },
      ...distractors.map(text => ({ text, correct: false })),
    ]).slice(0, 4);

    conjDrill = { verbId, tense, pronoun, reg, expected, options, answered: false };

    area.classList.remove('hidden');
    area.innerHTML = `
      <h4 class="font-semibold text-forge-accent mb-2">Conjugation Drill</h4>
      <p class="text-sm mb-3">Pick the correct form: <strong>${esc(conj.english)}</strong> — ${reg === 'lev' ? 'Levantine' : 'MSA'} <strong>${tense}</strong> for <strong>${esc(labels[pronoun] || pronoun)}</strong></p>
      <div class="grid sm:grid-cols-2 gap-2" id="conj-mc-options">
        ${options.map((o, i) => `
          <button class="mc-option p-3 text-left bg-forge-800 border border-forge-600 rounded arabic arabic-sm" data-idx="${i}">
            <span class="text-forge-500 text-xs mr-2">${i + 1}</span>
            ${esc(o.text)}
          </button>
        `).join('')}
      </div>
      <div id="conj-result" class="mt-3 hidden"></div>
      <button id="conj-show-table" class="mt-2 text-sm text-forge-400 hover:text-white hidden">Show full table</button>
      <button id="conj-next" class="mt-2 ml-2 px-4 py-2 bg-forge-accent text-forge-950 font-semibold rounded text-sm hidden">Next (Space)</button>
      <p class="text-xs text-forge-500 mt-2">Press 1–4 to choose</p>
    `;
    document.querySelectorAll('#conj-mc-options .mc-option').forEach(btn => {
      btn.addEventListener('click', () => pickConjMC(parseInt(btn.dataset.idx, 10)));
    });
  }

  function pickConjMC(idx) {
    if (!conjDrill || conjDrill.answered) return;
    conjDrill.answered = true;
    const correct = conjDrill.options[idx]?.correct;
    const picked = conjDrill.options[idx]?.text;

    document.querySelectorAll('#conj-mc-options .mc-option').forEach((btn, i) => {
      btn.disabled = true;
      if (conjDrill.options[i].correct) btn.classList.add('correct');
      else if (i === idx) btn.classList.add('wrong');
    });

    const result = document.getElementById('conj-result');
    result.classList.remove('hidden');
    result.className = `mt-3 p-3 rounded border ${correct ? 'feedback-correct' : 'feedback-wrong'}`;
    result.innerHTML = correct
      ? `<span class="text-forge-success font-semibold">✓ Correct: <span class="arabic arabic-sm">${esc(conjDrill.expected)}</span></span>`
      : `<span class="text-forge-danger font-semibold">✗ Expected: <span class="arabic arabic-sm">${esc(conjDrill.expected)}</span></span>${picked ? ` — You: <span class="arabic arabic-sm">${esc(picked)}</span>` : ''}`;

    document.getElementById('conj-show-table').classList.remove('hidden');
    document.getElementById('conj-show-table').onclick = () => renderConjTable(conjDrill.verbId);
    document.getElementById('conj-next').classList.remove('hidden');
    document.getElementById('conj-next').onclick = () => { conjDrill = null; startConjDrill(); };
    recordAnswer(conjDrill.verbId, conjDrill.reg, correct);
    updateStats();
  }

  // ─── Sentence drill ─────────────────────────────────────────

  function getSentencePool() {
    ensureSentences();
    return (sentencesData.sentences || []).filter(s => s.register === settings.register);
  }

  function updateSentenceStatus() {
    const el = document.getElementById('sentence-status');
    if (!el) return;
    const n = getSentencePool().length;
    el.textContent = n ? `${n} sentences ready (${settings.register.toUpperCase()})` : 'Loading sentences…';
  }

  function renderSentencesView() {
    updateSentenceStatus();
    if (!getSentencePool().length) {
      document.getElementById('sentence-idle').innerHTML =
        '<p class="text-forge-danger mb-2">Could not load sentences.</p><p class="text-sm">Hard-refresh the page (Ctrl+Shift+R).</p>';
      return;
    }
    document.getElementById('sentence-idle').innerHTML = `
      <p class="mb-2">Arabic sentence → English translation drill</p>
      <p class="text-sm">Click Start or press the button above. Typos are accepted.</p>
    `;
  }

  function buildSentenceQueue(count) {
    const pool = getSentencePool();
    if (!pool.length) return [];
    const sorted = [...pool].sort((a, b) => priorityScore({ id: b.vocab_id }) - priorityScore({ id: a.vocab_id }));
    const nw = Math.ceil(count * 0.6);
    const priority = sorted.slice(0, nw);
    const rest = sorted.slice(nw);
    return shuffle([...priority, ...rest]).slice(0, Math.min(count, pool.length));
  }

  function startSentenceDrill() {
    ensureSentences();
    const count = parseInt(document.getElementById('sentence-count')?.value || '20', 10);
    const queue = buildSentenceQueue(count);
    if (!queue.length) {
      alert(`No sentences for ${settings.register.toUpperCase()}. Try switching MSA/Levantine toggle.`);
      updateSentenceStatus();
      return;
    }

    sentenceSession = {
      queue,
      index: 0,
      results: [],
      answered: false,
    };

    document.getElementById('sentence-idle').classList.add('hidden');
    document.getElementById('sentence-summary').classList.add('hidden');
    document.getElementById('sentence-drill').classList.remove('hidden');
    renderSentenceItem();
  }

  function currentSentence() {
    return sentenceSession?.queue[sentenceSession.index];
  }

  function renderSentenceItem() {
    if (!sentenceSession) return;
    const s = currentSentence();
    if (!s) return endSentenceSession();

    sentenceSession.answered = false;
    const item = vocabData.items.find(i => i.id === s.vocab_id);
    const hint = item ? getRegister(item).translit : '';

    document.getElementById('sentence-progress').textContent =
      `${sentenceSession.index + 1} / ${sentenceSession.queue.length}`;
    document.getElementById('sentence-arabic').textContent = s.arabic;
    document.getElementById('sentence-hint').textContent = hint ? `Hint: ${hint}` : '';
    document.getElementById('sentence-input').value = '';
    document.getElementById('sentence-feedback').classList.add('hidden');
    document.getElementById('sentence-actions').innerHTML =
      `<button id="sentence-submit" class="px-6 py-2 bg-forge-accent text-forge-950 font-semibold rounded">Submit (Enter)</button>`;
    document.getElementById('sentence-submit').onclick = submitSentence;
    setTimeout(() => document.getElementById('sentence-input')?.focus(), 50);
  }

  function submitSentence() {
    if (!sentenceSession || sentenceSession.answered) return;
    sentenceSession.answered = true;
    const s = currentSentence();
    const input = document.getElementById('sentence-input').value;
    const correct = fuzzyMatchEnglish(input, s);

    recordAnswer(s.vocab_id, settings.register, correct);
    sentenceSession.results.push({ id: s.vocab_id, arabic: s.arabic, english: s.english, correct, input });

    const fb = document.getElementById('sentence-feedback');
    fb.classList.remove('hidden', 'feedback-correct', 'feedback-wrong');
    fb.classList.add(correct ? 'feedback-correct' : 'feedback-wrong');
    fb.innerHTML = `
      <div class="font-semibold ${correct ? 'text-forge-success' : 'text-forge-danger'}">${correct ? '✓ Correct' : '✗ Close — see expected answer'}</div>
      <div class="text-sm mt-1"><strong>Expected:</strong> ${esc(s.english)}</div>
      ${!correct && input ? `<div class="text-sm text-forge-400">You wrote: ${esc(input)}</div>` : ''}
      <div class="mt-2 text-sm text-forge-400"><span class="arabic arabic-sm">${esc(s.arabic)}</span></div>
    `;

    document.getElementById('sentence-actions').innerHTML =
      `<button id="sentence-next" class="px-6 py-2 bg-forge-accent text-forge-950 font-semibold rounded">Continue (Space)</button>`;
    document.getElementById('sentence-next').onclick = nextSentence;
    updateStats();
  }

  function nextSentence() {
    sentenceSession.index++;
    if (sentenceSession.index >= sentenceSession.queue.length) endSentenceSession();
    else renderSentenceItem();
  }

  function endSentenceSession() {
    const correct = sentenceSession.results.filter(r => r.correct).length;
    const total = sentenceSession.results.length;
    const acc = total ? Math.round((correct / total) * 100) : 0;

    document.getElementById('sentence-drill').classList.add('hidden');
    const summary = document.getElementById('sentence-summary');
    summary.classList.remove('hidden');
    summary.innerHTML = `
      <h3 class="text-lg font-bold text-forge-accent mb-2">Sentence Drill Complete</h3>
      <div class="grid sm:grid-cols-3 gap-4 mb-4">
        <div class="bg-forge-800 rounded p-4 text-center"><div class="text-forge-400 text-xs">Accuracy</div><div class="text-3xl font-bold text-forge-accent">${acc}%</div></div>
        <div class="bg-forge-800 rounded p-4 text-center"><div class="text-forge-400 text-xs">Correct</div><div class="text-3xl font-bold text-forge-success">${correct}</div></div>
        <div class="bg-forge-800 rounded p-4 text-center"><div class="text-forge-400 text-xs">Total</div><div class="text-3xl font-bold">${total}</div></div>
      </div>
      <button id="sentence-done" class="px-4 py-2 bg-forge-accent text-forge-950 font-semibold rounded">Done</button>
    `;
    document.getElementById('sentence-done').onclick = () => {
      sentenceSession = null;
      summary.classList.add('hidden');
      document.getElementById('sentence-idle').classList.remove('hidden');
    };
    sentenceSession = null;
    updateStats();
  }

  function exitSentenceDrill() {
    if (sentenceSession && !confirm('Exit sentence drill? Progress for answered items is saved.')) return;
    sentenceSession = null;
    document.getElementById('sentence-drill').classList.add('hidden');
    document.getElementById('sentence-summary').classList.add('hidden');
    document.getElementById('sentence-idle').classList.remove('hidden');
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
    if (settings.contentType === 'sentences') renderSentencesView();
    else if (settings.contentType === 'verbs' || settings.contentType === 'nouns') renderBrowse();
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
    const isSentences = type === 'sentences';
    const hideBrowse = isConj || isSentences;
    document.getElementById('browse-view').classList.toggle('hidden', hideBrowse);
    document.getElementById('browse-toolbar').classList.toggle('hidden', hideBrowse);
    document.getElementById('conjugation-view').classList.toggle('hidden', !isConj);
    document.getElementById('sentences-view').classList.toggle('hidden', !isSentences);

    if (isConj) renderConjugation();
    else if (isSentences) renderSentencesView();
    else renderBrowse();
  }

  function populateTags() {
    const sel = document.getElementById('tag-select');
    const current = sel.value;
    sel.innerHTML = '<option value="">All tags</option>' +
      allTags().map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    sel.value = current;
  }

  let ttsVoices = [];

  function initTtsVoices() {
    try {
      if (!window.speechSynthesis) return;
      const load = () => { ttsVoices = speechSynthesis.getVoices() || []; };
      load();
      if (typeof speechSynthesis.addEventListener === 'function') {
        speechSynthesis.addEventListener('voiceschanged', load);
      } else {
        speechSynthesis.onvoiceschanged = load;
      }
    } catch (err) {
      console.warn('TTS voice init failed:', err);
    }
  }

  function pickArabicVoice() {
    const prefs = settings.register === 'lev'
      ? ['ar-LB', 'ar-SY', 'ar-JO', 'ar-PS', 'ar-SA', 'ar-EG', 'ar']
      : ['ar-SA', 'ar-EG', 'ar', 'ar-LB'];
    for (const code of prefs) {
      const v = ttsVoices.find(v => v.lang === code || v.lang.startsWith(code + '-'));
      if (v) return v;
    }
    return ttsVoices.find(v => v.lang.startsWith('ar')) || null;
  }

  function showTtsNotice(msg) {
    let el = document.getElementById('tts-notice');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tts-notice';
      el.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md px-4 py-3 bg-forge-800 border border-forge-accent text-sm text-gray-200 rounded-lg shadow-lg';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(showTtsNotice._t);
    showTtsNotice._t = setTimeout(() => el.classList.add('hidden'), 5000);
  }

  function speakArabic(text, btn) {
    const clean = (text || '').replace(/\/.*$/, '').trim();
    if (!clean) return;

    if (!window.speechSynthesis) {
      showTtsNotice('Speech not supported in this browser.');
      return;
    }

    if (!ttsVoices.length) ttsVoices = speechSynthesis.getVoices() || [];
    const voice = pickArabicVoice();
    if (!voice) {
      showTtsNotice('No Arabic voice found. Install an Arabic language/speech pack in Windows Settings → Time & language → Speech, then reload.');
      return;
    }

    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(clean);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.9;

    const resetBtn = () => { if (btn) btn.textContent = '🔊 Listen'; };
    if (btn) btn.textContent = '🔊 Playing…';

    u.onend = resetBtn;
    u.onerror = () => {
      resetBtn();
      showTtsNotice('Playback failed. Try Chrome/Edge with Arabic speech installed.');
    };

    speechSynthesis.speak(u);

    // Chrome occasionally drops the first speak() call before voices load
    setTimeout(() => {
      if (!speechSynthesis.speaking && !speechSynthesis.pending) {
        speechSynthesis.speak(u);
      }
    }, 120);
  }

  // ─── Keyboard ────────────────────────────────────────────────

  function onKeydown(e) {
    const inSentenceInput = document.activeElement?.id === 'sentence-input';
    if (e.target.matches('input, textarea, select') && e.key !== 'Enter' && e.key !== ' ' && !inSentenceInput) return;
    if (inSentenceInput && e.key !== 'Enter') return;

    if (conjDrill && !conjDrill.answered && e.key >= '1' && e.key <= '4') {
      e.preventDefault();
      pickConjMC(parseInt(e.key, 10) - 1);
      return;
    }
    if (conjDrill && conjDrill.answered && e.code === 'Space') {
      e.preventDefault();
      conjDrill = null;
      startConjDrill();
      return;
    }

    if (sentenceSession && !sentenceSession.answered && e.key === 'Enter' && inSentenceInput) {
      e.preventDefault();
      submitSentence();
      return;
    }
    if (sentenceSession && sentenceSession.answered && (e.code === 'Space' || e.key === 'Enter')) {
      e.preventDefault();
      nextSentence();
      return;
    }

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

  }

  // ─── Init ────────────────────────────────────────────────────

  function bindClick(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  function bindEvents() {
    bindClick('tab-msa', () => setRegister('msa'));
    bindClick('tab-lev', () => setRegister('lev'));

    document.querySelectorAll('.content-tab').forEach(btn => {
      btn.addEventListener('click', () => setContentType(btn.dataset.content));
    });

    const search = document.getElementById('search-input');
    if (search) search.addEventListener('input', renderBrowse);
    const filter = document.getElementById('filter-select');
    if (filter) filter.addEventListener('change', renderBrowse);
    const tag = document.getElementById('tag-select');
    if (tag) tag.addEventListener('change', renderBrowse);

    bindClick('btn-start-drill', () => {
      document.getElementById('drill-setup')?.classList.remove('hidden');
    });
    bindClick('drill-begin', startDrill);
    bindClick('drill-cancel', () => {
      document.getElementById('drill-setup')?.classList.add('hidden');
    });
    bindClick('drill-exit', exitDrill);
    bindClick('summary-close', showBrowse);

    bindClick('modal-close', closeDetail);
    const modal = document.getElementById('detail-modal');
    if (modal) modal.addEventListener('click', (e) => {
      if (e.target.id === 'detail-modal') closeDetail();
    });

    bindClick('modal-drill', () => {
      if (!selectedItem) return;
      closeDetail();
      document.getElementById('drill-setup')?.classList.remove('hidden');
    });

    bindClick('conj-drill-btn', startConjDrill);
    bindClick('sentence-start', startSentenceDrill);
    bindClick('sentence-exit', exitSentenceDrill);

    bindClick('sentence-tts', (e) => {
      const ar = document.getElementById('sentence-arabic')?.textContent;
      speakArabic(ar, e.currentTarget);
    });
    bindClick('modal-tts', (e) => {
      if (selectedItem) speakArabic(getRegister(selectedItem).form, e.currentTarget);
    });

    bindClick('btn-export', exportProgress);
    const importFile = document.getElementById('import-file');
    if (importFile) importFile.addEventListener('change', (e) => {
      if (e.target.files[0]) importProgress(e.target.files[0]);
    });
    bindClick('btn-reset', hardReset);

    bindClick('stats-toggle', () => {
      const panel = document.getElementById('stats-panel');
      panel?.classList.toggle('mobile-open');
      panel?.classList.toggle('hidden');
    });

    bindClick('onboarding-dismiss', () => {
      document.getElementById('onboarding')?.classList.add('hidden');
      document.getElementById('onboarding')?.classList.remove('flex');
      localStorage.setItem(STORAGE.onboarded, '1');
    });

    document.addEventListener('keydown', onKeydown);
  }

  async function init() {
    loadStorage();
    bindEvents();
    initTtsVoices();
    try {
      await loadData();
      populateTags();
      setRegister(settings.register || 'msa');
      setContentType(settings.contentType || 'verbs');
      updateStats();
    } catch (err) {
      console.error(err);
      const mc = document.getElementById('main-content');
      if (mc) {
        mc.insertAdjacentHTML('afterbegin',
          `<p class="text-forge-danger p-4 mb-4 border border-forge-danger/40 rounded">Failed to load vocab data. Hard-refresh (Ctrl+Shift+R). Error: ${esc(String(err))}</p>`);
      }
    }

    if (!localStorage.getItem(STORAGE.onboarded)) {
      const ob = document.getElementById('onboarding');
      ob.classList.remove('hidden');
      ob.classList.add('flex');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();