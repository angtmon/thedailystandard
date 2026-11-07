/* Progressive hardening for the existing v1 app. Loaded by the versioned service worker. */
(() => {
  'use strict';
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
  const safeId = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const boundedText = (value, label, max = 20000, optional = false) => {
    if (optional && (value === undefined || value === null)) return '';
    if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text no longer than ${max} characters.`);
    return value;
  };
  const csvSafe = value => {
    const text = String(value ?? '');
    return /^[\s]*[=+@\-]/.test(text) ? `'${text}` : text;
  };
  const quoteKey = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/[“”‘’"']/g, '').replace(/[–—−]/g, '-').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  // Backup import is intercepted in capture phase, before the legacy v1 listener.
  const fileInput = document.getElementById('importFile');
  fileInput?.addEventListener('change', async event => {
    event.stopImmediatePropagation();
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Backup exceeds the 50 MB safety limit.');
      const candidate = JSON.parse(await file.text());
      if (!isObject(candidate) || !Array.isArray(candidate.habits) || !Array.isArray(candidate.quotes) || !isObject(candidate.records) || !isObject(candidate.reflections)) {
        throw new Error('This file does not have the expected Daily Standard backup structure.');
      }
      if (candidate.habits.length > 5000 || candidate.quotes.length > 100000) throw new Error('The backup contains more entries than this app supports safely.');

      const habitIds = new Map();
      const habits = candidate.habits.map((habit, index) => {
        if (!isObject(habit)) throw new Error(`Habit ${index + 1} is invalid.`);
        const oldId = boundedText(habit.id, `Habit ${index + 1} ID`, 200);
        if (!oldId || habitIds.has(oldId)) throw new Error('Habit IDs must be present and unique.');
        if (typeof habit.name !== 'string' || !habit.name.trim() || habit.name.length > 500) throw new Error(`Habit ${index + 1} has an invalid name.`);
        if (habit.created != null && !validDate(habit.created)) throw new Error(`Habit “${habit.name}” has an invalid creation date.`);
        if (habit.archived != null && habit.archived !== false && !validDate(habit.archived)) throw new Error(`Habit “${habit.name}” has an invalid archive date.`);
        if (habit.target != null && (!Number.isFinite(Number(habit.target)) || Number(habit.target) <= 0)) throw new Error(`Habit “${habit.name}” has an invalid target.`);
        if (habit.step != null && (!Number.isFinite(Number(habit.step)) || Number(habit.step) <= 0)) throw new Error(`Habit “${habit.name}” has an invalid increment.`);
        if (habit.days != null && (!Array.isArray(habit.days) || habit.days.some(day => !Number.isInteger(day) || day < 0 || day > 6))) throw new Error(`Habit “${habit.name}” has an invalid weekday schedule.`);
        const pauses = habit.pauses == null ? [] : habit.pauses;
        if (!Array.isArray(pauses)) throw new Error(`Habit “${habit.name}” has invalid pause history.`);
        pauses.forEach(pause => {
          if (!isObject(pause) || !validDate(pause.start) || (pause.end && !validDate(pause.end)) || (pause.end && pause.end < pause.start)) throw new Error(`Habit “${habit.name}” has an invalid pause period.`);
          boundedText(pause.reason, 'Pause reason', 1000);
        });
        habitIds.set(oldId, safeId());
        return { ...habit, id: habitIds.get(oldId), pauses: pauses.map(p => ({ ...p })) };
      });

      const records = {};
      for (const [date, day] of Object.entries(candidate.records)) {
        if (!validDate(date) || !isObject(day)) throw new Error(`Invalid records for date “${date}”.`);
        records[date] = {};
        for (const [oldId, record] of Object.entries(day)) {
          if (!habitIds.has(oldId)) continue;
          if (!isObject(record) || !Number.isFinite(Number(record.value)) || Number(record.value) < 0) throw new Error(`Invalid habit entry on ${date}.`);
          records[date][habitIds.get(oldId)] = { ...record, value: Number(record.value), note: boundedText(record.note, 'Habit note', 20000, true) };
        }
      }
      const quoteIds = new Set();
      const quotes = candidate.quotes.map((quote, index) => {
        if (!isObject(quote)) throw new Error(`Quote ${index + 1} is invalid.`);
        const text = boundedText(quote.text, `Quote ${index + 1}`, 20000);
        if (!text.trim()) throw new Error(`Quote ${index + 1} is empty.`);
        const id = safeId();
        quoteIds.add(id);
        return { ...quote, id, text, author: boundedText(quote.author, 'Quote author', 2000, true), category: boundedText(quote.category, 'Quote category', 200, true), favorite: Boolean(quote.favorite) };
      });
      const reflections = {};
      for (const [date, text] of Object.entries(candidate.reflections)) {
        if (!validDate(date)) throw new Error(`Invalid reflection date “${date}”.`);
        reflections[date] = boundedText(text, `Reflection for ${date}`, 100000);
      }
      const defaults = defaultData();
      const inputSettings = isObject(candidate.settings) ? candidate.settings : {};
      const allowedSections = ['progress', 'habits', 'quote', 'verse'];
      const order = Array.isArray(inputSettings.order) ? inputSettings.order.filter((item, index, list) => allowedSections.includes(item) && list.indexOf(item) === index) : defaults.settings.order;
      const settings = { ...defaults.settings, ...inputSettings, order: [...order, ...allowedSections.filter(item => !order.includes(item))] };
      for (const key of ['showProgress', 'showHabits', 'showQuote', 'showVerse', 'reminder']) if (key in settings) settings[key] = Boolean(settings[key]);
      for (const key of ['startHour', 'endHour']) settings[key] = Math.max(0, Math.min(23, Math.trunc(Number(settings[key]) || 0)));
      const normalized = {
        ...defaults, ...candidate, version: 1, habits, records, quotes, reflections, settings,
        theme: candidate.theme === 'light' ? 'light' : 'dark',
        verseHistory: Array.isArray(candidate.verseHistory) ? candidate.verseHistory.filter(x => isObject(x) && validDate(x.week) && Number.isInteger(x.index) && x.index >= 0 && x.index < 1000).slice(-1000) : [],
        milestones: Array.isArray(candidate.milestones) ? candidate.milestones : []
      };
      if (!confirm('Restore this validated backup? This replaces the data in this browser. A backup of your current data will be downloaded first.')) return;
      window.exportJSON();
      data = normalized;
      if (!save()) throw new Error('The restored data could not be saved. Your previous data should remain in the browser; restore was not confirmed.');
      render();
      alert('Backup validated and restored. A backup of the previous data was downloaded.');
    } catch (error) {
      alert(`Backup was not restored. Your existing data was not changed. ${error?.message || 'The file could not be read.'}`);
    } finally {
      event.target.value = '';
    }
  }, true);

  // Make the daily quote stable across reloads and days; retain the user's manual rotation for that date.
  const dateNow = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const quoteIndexForToday = () => {
    if (!data.quotes.length) return 0;
    if (!data.dailyQuote || data.dailyQuote.date !== dateNow()) {
      const day = dateNow().replaceAll('-', '');
      const seed = Number(day) % data.quotes.length;
      data.dailyQuote = { date: dateNow(), offset: seed };
      save();
    }
    return (Number(data.dailyQuote.offset) || 0) % data.quotes.length;
  };
  const originalRender = window.render;
  window.render = () => {
    quotePosition = quoteIndexForToday();
    originalRender();
    improveAccessibility();
  };
  window.cycleQuote = () => {
    const count = data.quotes.length;
    if (!count) return;
    quoteIndexForToday();
    data.dailyQuote.offset = (Number(data.dailyQuote.offset) + 1) % count;
    save();
    window.render();
  };

  // CSV formula injection protection; quote and habit text remain unchanged in the app and JSON backup.
  window.exportCSV = () => {
    const rows = [['Date', 'Habit', 'Value', 'Target', 'Unit', 'Status', 'Note']];
    for (const date of Object.keys(data.records).sort()) for (const habit of data.habits) {
      const record = data.records[date]?.[habit.id];
      if (record) rows.push([date, habit.name, record.value, habit.target, habit.unit, status(habit, date), record.note]);
    }
    download(`daily-standard-habits-${dateNow()}.csv`, rows.map(row => row.map(value => `"${csvSafe(value).replace(/"/g, '""')}"`).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  window.exportQuotes = () => {
    const rows = [['Quote', 'Author', 'Category', 'Favorite'], ...data.quotes.map(q => [q.text, q.author, q.category, q.favorite ? 'Yes' : 'No'])];
    download(`daily-standard-quotes-${dateNow()}.csv`, rows.map(row => row.map(value => `"${csvSafe(value).replace(/"/g, '""')}"`).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  window.exportJSON = () => {
    const backup = { ...data, backupFormatVersion: 1, exportedAt: new Date().toISOString() };
    download(`daily-standard-backup-${dateNow()}.json`, JSON.stringify(backup, null, 2), 'application/json');
  };

  function improveAccessibility() {
    const view = document.getElementById('view');
    if (!view) return;
    for (const element of view.querySelectorAll('input, textarea, select')) {
      if (element.getAttribute('aria-label') || element.labels?.length) continue;
      const previous = element.previousElementSibling;
      if (previous?.tagName === 'LABEL') {
        if (!element.id) element.id = `field-${safeId()}`;
        previous.htmlFor = element.id;
      } else {
        const name = element.placeholder || element.id || (element.type === 'checkbox' ? 'Option' : 'Input');
        element.setAttribute('aria-label', name);
      }
    }
    document.querySelectorAll('[data-tab]').forEach(button => {
      const name = button.dataset.tab;
      button.setAttribute('aria-label', name[0].toUpperCase() + name.slice(1));
      if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  const modal = document.getElementById('modal');
  let restoreFocus = null;
  document.addEventListener('click', event => { if (!modal?.classList.contains('hidden')) return; restoreFocus = event.target.closest('button, a, input, select, textarea') || document.activeElement; }, true);
  if (modal) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Application dialog');
    new MutationObserver(() => {
      if (!modal.classList.contains('hidden')) {
        const focusable = modal.querySelector('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])');
        (focusable || modal).focus?.();
      } else restoreFocus?.focus?.();
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    modal.tabIndex = -1;
  }
  document.addEventListener('keydown', event => {
    if (modal?.classList.contains('hidden')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
    if (event.key !== 'Tab') return;
    const items = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')];
    if (!items.length) { event.preventDefault(); modal.focus(); return; }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) document.documentElement.style.setProperty('--motion-duration', '0ms');
  improveAccessibility();
})();
