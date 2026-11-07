const isoDate = value => {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeHabitDays = habit => {
  if (!habit || typeof habit !== 'object') return [1, 2, 3, 4, 5];
  const raw = Array.isArray(habit.days) ? habit.days : [];
  const candidate = raw
    .map(v => Number(v))
    .filter(v => Number.isInteger(v) && v >= 0 && v <= 6);

  if (!candidate.length) return [1, 2, 3, 4, 5];
  return [...new Set(candidate)].sort((a, b) => a - b);
};

function schedule(h, date) {
  if (!h || typeof h !== 'object') return false;
  const reference = isoDate(date) || isoDate(TODAY()) || new Date();
  const target = reference.toLocaleDateString('en-CA');
  const created = isoDate(h.created);
  if (created && target < h.created) return false;
  const archived = isoDate(h.archived);
  if (archived && target >= h.archived) return false;

  const currentDay = reference.getDay();
  const frequency = String(h.frequency || 'daily').toLowerCase();
  const days = normalizeHabitDays(h);

  if (frequency === 'weekly') return true;
  if (frequency === 'weekdays') return [1, 2, 3, 4, 5].includes(currentDay);
  if (frequency === 'weekends') return [0, 6].includes(currentDay);
  if (frequency === 'custom') return days.includes(currentDay);

  if (Array.isArray(h.days) && h.days.length) return days.includes(currentDay);
  return true;
}

function pauseFor(h, date) {
  if (!h || typeof h !== 'object' || !Array.isArray(h.pauses) || !h.pauses.length) return null;

  const reference = isoDate(date) || isoDate(TODAY()) || new Date();
  const targetKey = reference.toLocaleDateString('en-CA');

  for (const pause of h.pauses) {
    if (!pause || typeof pause !== 'object') continue;
    const start = isoDate(pause.start);
    const end = isoDate(pause.end);
    if (!start) continue;

    const startKey = start.toLocaleDateString('en-CA');
    const endKey = end ? end.toLocaleDateString('en-CA') : null;
    const isActive = targetKey >= startKey && (!endKey || targetKey <= endKey);
    if (isActive) return pause;
  }

  return null;
}

function status(h, date) {
  if (!h || typeof h !== 'object') return 'off';
  if (!schedule(h, date)) return 'off';
  if (pauseFor(h, date)) return 'paused';

  const entryValue = Number(entry(h, date).value) || 0;
  const target = Number(h.target) || 1;

  if (entryValue >= target) return 'done';
  if (entryValue > 0) return 'partial';
  return 'missed';
}

function dayStats(date) {
  const safeDate = isoDate(date) ? date : TODAY();
  if (!Array.isArray(data?.habits)) return { done: 0, total: 0, pct: 0 };

  const active = data.habits.filter(h => schedule(h, safeDate) && !pauseFor(h, safeDate));
  const done = active.filter(h => status(h, safeDate) === 'done').length;
  const total = active.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return { done, total, pct };
}

function updateEntry(id, date, value, note) {
  if (!id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const habit = data?.habits?.find(x => x.id === id);
  if (!habit) return;

  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
  const textNote = String(note ?? '').slice(0, 500);

  data.records[date] ??= {};
  data.records[date][id] = {
    value: safeValue,
    note: textNote
  };

  if (typeof save === 'function') save();
}
