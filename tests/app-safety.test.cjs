const test = require('node:test');
const assert = require('node:assert/strict');
const safety = require('../app-safety.js');

const daily = { id: 'daily', name: 'Daily', frequency: 'daily', target: 1, created: '2026-01-01', pauses: [] };
const weekdays = { id: 'weekdays', name: 'Weekdays', frequency: 'days', days: [1, 2, 3, 4, 5], target: 1, created: '2026-01-01', pauses: [] };

 test('validates real calendar dates, rejecting rollover dates', () => {
  assert.equal(safety.validDate('2026-02-28'), true);
  assert.equal(safety.validDate('2026-02-30'), false);
  assert.equal(safety.validDate('2026-2-03'), false);
});

test('honors weekday schedules, creation and archive boundaries', () => {
  const logic = safety.createHabitLogic({ habits: [daily, weekdays, { ...daily, id: 'old', created: '2026-01-10', archived: '2026-01-12' }], records: {} });
  assert.equal(logic.schedule(weekdays, '2026-01-05'), true); // Monday
  assert.equal(logic.schedule(weekdays, '2026-01-04'), false); // Sunday
  assert.equal(logic.schedule(daily, '2025-12-31'), false);
  assert.equal(logic.schedule({ ...daily, id: 'old', created: '2026-01-10', archived: '2026-01-12' }, '2026-01-12'), false);
});

test('paused dates are neutral and date ranges are inclusive', () => {
  const habit = { ...daily, pauses: [{ start: '2026-01-05', end: '2026-01-06', reason: 'Vacation' }] };
  const logic = safety.createHabitLogic({ habits: [habit], records: {} });
  assert.equal(logic.status(habit, '2026-01-05'), 'paused');
  assert.equal(logic.status(habit, '2026-01-06'), 'paused');
  assert.equal(logic.status(habit, '2026-01-07'), 'missed');
  assert.deepEqual(logic.dayStats('2026-01-05'), { done: 0, total: 0, pct: 0 });
});

test('calculates status against target and ignores invalid records safely', () => {
  const habit = { ...daily, target: 30 };
  const logic = safety.createHabitLogic({ habits: [habit], records: { '2026-01-05': { daily: { value: 15 } }, '2026-01-06': { daily: { value: 30 } }, '2026-01-07': { daily: null } } });
  assert.equal(logic.status(habit, '2026-01-05'), 'partial');
  assert.equal(logic.status(habit, '2026-01-06'), 'done');
  assert.equal(logic.status(habit, '2026-01-07'), 'missed');
});

test('normalizes quote duplicates and neutralizes CSV formulas', () => {
  assert.equal(safety.quoteKey(' “Be—kind!” '), safety.quoteKey('be-kind'));
  assert.match(safety.csvCell('=1+1'), /^"'=1\+1"$/);
  assert.equal(safety.csvCell('A, "B"'), '"A, ""B"""');
});

test('validates backups atomically and remaps record keys with habit IDs', () => {
  const normalized = safety.validateBackup({
    version: 1,
    habits: [{ id: 'old-id', name: 'Read', target: 10, created: '2026-01-01', pauses: [] }],
    quotes: [{ id: 'q1', text: 'Keep going', author: 'A', category: 'Resilience', favorite: true }],
    records: { '2026-01-02': { 'old-id': { value: 5, note: 'Pages' }, orphan: { value: 99 } } },
    reflections: { '2026-01-02': 'A reflection' }, settings: { order: ['habits'] }, theme: 'dark'
  });
  assert.notEqual(normalized.habits[0].id, 'old-id');
  assert.equal(normalized.records['2026-01-02'][normalized.habits[0].id].value, 5);
  assert.equal(Object.keys(normalized.records['2026-01-02']).length, 1);
  assert.equal(normalized.quotes[0].category, 'Resilience');
  assert.throws(() => safety.validateBackup({ habits: [], quotes: [], records: { '2026-02-30': {} }, reflections: {} }));
});
