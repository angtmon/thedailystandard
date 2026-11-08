/* Shared, dependency-free validation and habit logic. Works in browsers and Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DailyStandardSafety = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, max = 20000) => String(value ?? '').normalize('NFKC').replace(/\u0000/g, '').slice(0, max).trim();
  const safeId = () => globalThis.crypto?.randomUUID?.() || `ds-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const validDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const validDateTime = value => {
    if (typeof value !== 'string' || !value.trim()) return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  };
  const numeric = (value, fallback = 0, min = 0, max = 1_000_000) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const quoteKey = value => text(value).toLowerCase()
    .replace(/[“”‘’"']/g, '').replace(/[–—−]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  const csvCell = value => {
    let cell = String(value ?? '');
    if (/^[\s\u0000-\u001f]*[=+@\-]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replace(/"/g, '""')}"`;
  };

  function normalizeReflectionEntries(dateKey, rawValue) {
    const items = Array.isArray(rawValue) ? rawValue : [rawValue];
    const result = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item == null) continue;
      const entry = isObject(item) ? item : { text: item };
      const textValue = text(entry.text ?? entry, 100000);
      if (!textValue) continue;
      const createdAt = validDateTime(entry.createdAt || entry.created_at) ? entry.createdAt || entry.created_at : `${dateKey}T12:00:00.000Z`;
      const updatedAt = validDateTime(entry.updatedAt || entry.updated_at) ? entry.updatedAt || entry.updated_at : createdAt;
      result.push({
        id: text(entry.id, 200) || `reflection-${dateKey}-${index}-${safeId()}`,
        text: textValue,
        createdAt,
        updatedAt
      });
    }
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function validateBackup(input) {
    if (!isObject(input) || !Array.isArray(input.habits) || !Array.isArray(input.quotes) || !isObject(input.records) || !isObject(input.reflections)) {
      throw new Error('Invalid Daily Standard backup structure.');
    }
    if (input.habits.length > 5000 || input.quotes.length > 100000) throw new Error('Backup exceeds supported item limits.');

    const idMap = new Map();
    const habits = input.habits.map((raw, index) => {
      if (!isObject(raw)) throw new Error(`Habit ${index + 1} is invalid.`);
      const oldId = text(raw.id, 200);
      const name = text(raw.name, 500);
      if (!oldId || idMap.has(oldId) || !name) throw new Error(`Habit ${index + 1} needs a unique ID and name.`);
      if (raw.created != null && !validDate(raw.created)) throw new Error(`Habit “${name}” has an invalid creation date.`);
      if (raw.archived != null && raw.archived !== false && !validDate(raw.archived)) throw new Error(`Habit “${name}” has an invalid archive date.`);
      const target = numeric(raw.target, 1, 0.01, 1_000_000);
      const step = numeric(raw.step, 1, 0.01, 1_000_000);
      if (raw.days != null && (!Array.isArray(raw.days) || raw.days.some(day => !Number.isInteger(day) || day < 0 || day > 6))) throw new Error(`Habit “${name}” has invalid scheduled days.`);
      const pauses = raw.pauses == null ? [] : raw.pauses;
      if (!Array.isArray(pauses)) throw new Error(`Habit “${name}” has invalid pause history.`);
      for (const pause of pauses) {
        if (!isObject(pause) || !validDate(pause.start) || (pause.end && (!validDate(pause.end) || pause.end < pause.start))) throw new Error(`Habit “${name}” has an invalid pause period.`);
        if (typeof pause.reason !== 'string' || pause.reason.length > 1000) throw new Error(`Habit “${name}” has an invalid pause reason.`);
      }
      const newId = safeId();
      idMap.set(oldId, newId);
      return { ...raw, id: newId, name, target, step, created: raw.created || null, archived: raw.archived || null, days: Array.isArray(raw.days) ? [...new Set(raw.days)] : [], pauses: pauses.map(pause => ({ ...pause, start: pause.start, end: pause.end || null, reason: text(pause.reason, 1000) })) };
    });

    const records = {};
    for (const [date, byHabit] of Object.entries(input.records)) {
      if (!validDate(date) || !isObject(byHabit)) throw new Error(`Invalid records for date “${date}”.`);
      records[date] = {};
      for (const [oldId, raw] of Object.entries(byHabit)) {
        if (!idMap.has(oldId)) continue;
        if (!isObject(raw) || !Number.isFinite(Number(raw.value)) || Number(raw.value) < 0) throw new Error(`Invalid habit entry on ${date}.`);
        records[date][idMap.get(oldId)] = { ...raw, value: numeric(raw.value), note: text(raw.note, 20000) };
      }
    }

    const quotes = input.quotes.map((raw, index) => {
      if (!isObject(raw)) throw new Error(`Quote ${index + 1} is invalid.`);
      const quoteText = text(raw.text, 20000);
      if (!quoteText) throw new Error(`Quote ${index + 1} is empty.`);
      return { ...raw, id: safeId(), text: quoteText, author: text(raw.author, 2000), category: text(raw.category, 200) || 'Mindset', favorite: Boolean(raw.favorite) };
    });

    const reflections = {};
    for (const [date, value] of Object.entries(input.reflections)) {
      if (!validDate(date)) throw new Error(`Invalid reflection for ${date}.`);
      const entries = normalizeReflectionEntries(date, value);
      if (entries.length) reflections[date] = entries;
    }

    const allowed = ['progress', 'habits', 'quote', 'verse'];
    const defaults = { startHour: 8, endHour: 21, reminder: false, showProgress: true, showHabits: true, showQuote: true, showVerse: true, order: allowed };
    const settingsInput = isObject(input.settings) ? input.settings : {};
    const requestedOrder = Array.isArray(settingsInput.order) ? settingsInput.order.filter((item, index, list) => allowed.includes(item) && list.indexOf(item) === index) : defaults.order;
    const settings = { ...defaults, ...settingsInput, order: [...requestedOrder, ...allowed.filter(item => !requestedOrder.includes(item))] };
    for (const key of ['startHour', 'endHour']) settings[key] = Math.trunc(numeric(settings[key], defaults[key], 0, 23));
    for (const key of ['reminder', 'showProgress', 'showHabits', 'showQuote', 'showVerse']) settings[key] = Boolean(settings[key]);

    return {
      ...input, version: 1, habits, records, quotes, reflections, settings,
      theme: input.theme === 'light' ? 'light' : 'dark',
      verseHistory: Array.isArray(input.verseHistory) ? input.verseHistory.filter(item => isObject(item) && validDate(item.week) && Number.isInteger(item.index) && item.index >= 0).slice(-1000) : [],
      milestones: Array.isArray(input.milestones) ? input.milestones : []
    };
  }

  function createHabitLogic(state) {
    const dateValue = value => validDate(value) ? value : null;
    const habits = Array.isArray(state?.habits) ? state.habits : [];
    const records = isObject(state?.records) ? state.records : {};
    const dateObj = value => new Date(`${value}T12:00:00`);
    const frequencyScheduled = (habit, date) => {
      if (habit.frequency === 'days' || habit.frequency === 'custom') return (Array.isArray(habit.days) ? habit.days : []).includes(dateObj(date).getDay());
      if (habit.frequency === 'weekdays') return [1, 2, 3, 4, 5].includes(dateObj(date).getDay());
      if (habit.frequency === 'weekends') return [0, 6].includes(dateObj(date).getDay());
      return true;
    };
    const isScheduled = (habit, date) => {
      if (!isObject(habit) || !dateValue(date)) return false;
      if (habit.created && dateValue(habit.created) && date < habit.created) return false;
      if (habit.archived && dateValue(habit.archived) && date >= habit.archived) return false;
      return frequencyScheduled(habit, date);
    };
    const pauseOn = (habit, date) => {
      if (!Array.isArray(habit?.pauses) || !dateValue(date)) return null;
      return habit.pauses.find(pause => isObject(pause) && dateValue(pause.start) && date >= pause.start && (!pause.end || !dateValue(pause.end) || date <= pause.end)) || null;
    };
    const entryFor = (habit, date) => {
      const raw = records[date]?.[habit?.id];
      return isObject(raw) ? { value: numeric(raw.value), note: text(raw.note, 20000) } : { value: 0, note: '' };
    };
    const getStatus = (habit, date) => {
      if (!isScheduled(habit, date)) return 'off';
      if (pauseOn(habit, date)) return 'paused';
      const entry = entryFor(habit, date);
      const target = numeric(habit.target, 1, 0.01, 1_000_000);
      return entry.value >= target ? 'done' : entry.value > 0 ? 'partial' : 'missed';
    };
    const dayStats = date => {
      const active = habits.filter(habit => isScheduled(habit, date) && !pauseOn(habit, date));
      const done = active.filter(habit => getStatus(habit, date) === 'done').length;
      return { done, total: active.length, pct: active.length ? Math.round(done / active.length * 100) : 0 };
    };
    return { schedule: isScheduled, pauseFor: pauseOn, entry: entryFor, status: getStatus, dayStats };
  }

  return { isObject, text, safeId, validDate, validDateTime, numeric, quoteKey, csvCell, validateBackup, createHabitLogic, normalizeReflectionEntries };
});
