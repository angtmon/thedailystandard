(() => {
  'use strict';

  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  const validDate = value => (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(`${value}T12:00:00`).getTime())
  );

  const safeId = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const clampNumber = (value, fallback = 0, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(Math.max(num, min), max);
  };

  const normalizeText = value => String(value ?? '').normalize('NFKC').trim();

  const quoteKey = text => String(text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[“”‘’"']/g, '')
    .replace(/[–—−]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

  const categoryFromText = text => {
    const value = String(text ?? '').toLowerCase();
    if (/god|lord|faith|prayer|christ|scripture|bible|verse/.test(value)) return 'Faith';
    if (/leader|integrity|service|team|mentor|serve|honest|discipline/.test(value)) return 'Leadership';
    if (/courage|fear|resilien|adversity|struggle|setback|uncomfort|strength/.test(value)) return 'Resilience';
    if (/discipline|habit|consisten|effort|commit|routine|focus/.test(value)) return 'Discipline';
    if (/confiden|believ|capab|self|worth|purpose|dream/.test(value)) return 'Confidence';
    if (/grow|learn|improv|progress|skill|wisdom/.test(value)) return 'Growth';
    return 'Mindset';
  };

  function sanitizeQuote(raw = {}) {
    const text = normalizeText(raw.text || raw.quote || '');
    const author = normalizeText(raw.author || raw.source || '');
    const category = normalizeText(raw.category || '');
    const favorite = Boolean(raw.favorite);

    return {
      id: String(raw.id || safeId()),
      text,
      author,
      category: category || categoryFromText(text),
      favorite,
      createdAt: validDate(raw.createdAt) ? raw.createdAt : new Date().toISOString().slice(0, 10),
      updatedAt: validDate(raw.updatedAt) ? raw.updatedAt : new Date().toISOString().slice(0, 10)
    };
  }

  function sanitizeHabit(raw = {}) {
    const item = isObject(raw) ? raw : {};
    const days = Array.isArray(item.days) ? item.days.filter(day => Number.isInteger(day) && day >= 0 && day <= 6) : [1, 2, 3, 4, 5];

    return {
      id: String(item.id || safeId()),
      name: normalizeText(item.name || item.title || 'New habit'),
      unit: ['check', 'minutes', 'count'].includes(item.unit) ? item.unit : 'check',
      target: clampNumber(item.target, 1, 1, 10_000),
      step: clampNumber(item.step, 1, 1, 10_000),
      frequency: ['daily', 'weekly', 'weekdays', 'custom'].includes(item.frequency) ? item.frequency : 'daily',
      days: [...new Set(days)],
      created: validDate(item.created) ? item.created : new Date().toISOString().slice(0, 10),
      archived: validDate(item.archived) ? item.archived : (item.archived ? String(item.archived) : null),
      pauses: Array.isArray(item.pauses) ? item.pauses.filter(Boolean).map(pause => ({
        start: validDate(pause.start) ? pause.start : new Date().toISOString().slice(0, 10),
        end: validDate(pause.end) ? pause.end : null,
        reason: normalizeText(pause.reason || 'Paused')
      })) : [],
      notes: normalizeText(item.notes || '')
    };
  }

  function sanitizeRecords(raw = {}) {
    if (!isObject(raw)) return {};

    const safe = {};
    for (const [date, recordMap] of Object.entries(raw)) {
      if (!validDate(date) || !isObject(recordMap)) continue;
      safe[date] = {};
      for (const [habitId, entry] of Object.entries(recordMap)) {
        if (!habitId || !isObject(entry)) continue;
        const value = clampNumber(entry.value, 0, 0, 1_000_000);
        const note = normalizeText(entry.note || '');
        safe[date][habitId] = { value, note };
      }
    }
    return safe;
  }

  function sanitizeReflections(raw = {}) {
    if (!isObject(raw)) return {};
    const safe = {};
    for (const [date, text] of Object.entries(raw)) {
      if (!validDate(date)) continue;
      safe[date] = normalizeText(text);
    }
    return safe;
  }

  function sanitizeState(raw = {}) {
    const source = isObject(raw) ? raw : {};
    const habits = Array.isArray(source.habits) ? source.habits.map(sanitizeHabit) : [];
    const quotes = Array.isArray(source.quotes) ? source.quotes.map(sanitizeQuote) : [];
    const records = sanitizeRecords(source.records || {});
    const reflections = sanitizeReflections(source.reflections || {});

    return {
      ...source,
      version: 1,
      habits,
      quotes,
      records,
      reflections,
      settings: isObject(source.settings) ? source.settings : {},
      theme: ['dark', 'light'].includes(source.theme) ? source.theme : 'dark',
      milestone: Array.isArray(source.milestones) ? source.milestones : [],
      verseHistory: Array.isArray(source.verseHistory) ? source.verseHistory : []
    };
  }

  function safeStorageLoad(storageKey, fallbackFactory) {
    try {
      const raw = globalThis.localStorage?.getItem(storageKey);
      if (!raw) return typeof fallbackFactory === 'function' ? fallbackFactory() : null;
      const parsed = JSON.parse(raw);
      return sanitizeState(parsed);
    } catch (error) {
      console.warn('Failed to load app state safely:', error);
      return typeof fallbackFactory === 'function' ? fallbackFactory() : null;
    }
  }

  function safeStorageSave(storageKey, value) {
    try {
      globalThis.localStorage?.setItem(storageKey, JSON.stringify(sanitizeState(value)));
      return true;
    } catch (error) {
      console.warn('Failed to save app state safely:', error);
      return false;
    }
  }

  const api = {
    isObject,
    validDate,
    safeId,
    clampNumber,
    sanitizeQuote,
    sanitizeHabit,
    sanitizeRecords,
    sanitizeReflections,
    sanitizeState,
    safeStorageLoad,
    safeStorageSave,
    quoteKey,
    categoryFromText
  };

  if (typeof window !== 'undefined') {
    window.DailyStandardHardening = api;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.DailyStandardHardening = api;
  }
})();
