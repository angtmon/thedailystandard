/* Phase 1 interaction layer; the existing app remains the source of truth. */
(() => {
  'use strict';
  const bridge = () => window.DailyStandardQuoteBridge;
  const root = document.getElementById('view');
  if (!root || !bridge()) return;

  const uid = () => window.DailyStandardSafety?.safeId?.() || `reflection-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const plainDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '');
  const migrate = () => {
    const state = bridge().getState();
    let changed = false;
    state.reflections ||= {};
    for (const [date, value] of Object.entries(state.reflections)) {
      if (!plainDate(date)) continue;
      if (!Array.isArray(value) || value.some(entry => typeof entry === 'string')) {
        state.reflections[date] = (Array.isArray(value) ? value : [value]).filter(item => item != null).map((item, index) => {
          const old = item && typeof item === 'object' ? item : { text: item };
          const createdAt = old.createdAt || old.created_at || `${date}T12:00:00.000Z`;
          return { id: old.id || `legacy-${date}-${index}-${uid()}`, text: String(old.text ?? item ?? ''), createdAt, updatedAt: old.updatedAt || old.updated_at || createdAt, timestampEstimated: !old.createdAt && !old.created_at };
        }).filter(item => item.text.trim());
        changed = true;
      }
    }
    if (changed) bridge().restoreState(state);
  };
  const stateCopy = () => JSON.parse(JSON.stringify(bridge().getState()));
  const persist = next => {
    if (bridge().restoreState(next)) return true;
    alert('Could not save this change. Your existing data has not been intentionally replaced.');
    return false;
  };
  const selectedReflectionDate = () => root.querySelector('[data-reflection-date]')?.value || new Date().toLocaleDateString('en-CA');
  const dateLabel = value => {
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };
  const timestampLabel = value => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleString();
  };

  function reflectionMarkup() {
    const card = [...root.querySelectorAll('.card')].find(item => item.querySelector('h2')?.textContent.trim() === 'Daily reflection');
    if (!card || card.dataset.phaseReflection) return;
    card.dataset.phaseReflection = 'true';
    const oldDate = card.querySelector('#reflectionDate')?.value || new Date().toLocaleDateString('en-CA');
    card.innerHTML = `<h2>Daily reflection</h2><label for="phaseReflectionDate">Date</label><input type="date" id="phaseReflectionDate" data-reflection-date value="${esc(oldDate)}"><label for="phaseReflectionText">Your thoughts (optional)</label><textarea id="phaseReflectionText" rows="6" maxlength="100000" placeholder="What stood out today?"></textarea><div class="actions"><button type="button" data-action="new-reflection">Save new reflection</button></div><p class="muted tiny">Each save creates a separate reflection. Existing entries are not overwritten.</p>`;
  }

  function renderReflectionHistory() {
    const card = [...root.querySelectorAll('.card')].find(item => item.querySelector('h2')?.textContent.trim() === 'Past reflections');
    if (!card) return;
    card.dataset.phaseHistory = 'true';
    const state = bridge().getState();
    const search = card.querySelector('[data-reflection-search]')?.value ?? card.querySelector('input')?.value ?? '';
    const query = search.toLocaleLowerCase();
    const entries = [];
    for (const [date, list] of Object.entries(state.reflections || {})) {
      const normalized = Array.isArray(list) ? list : [{ id: `legacy-${date}`, text: String(list ?? ''), createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`, timestampEstimated: true }];
      for (const entry of normalized) {
        if (!entry || !String(entry.text ?? '').trim()) continue;
        if (query && !`${date} ${entry.text}`.toLocaleLowerCase().includes(query)) continue;
        entries.push({ date, ...entry });
      }
    }
    entries.sort((a, b) => b.date.localeCompare(a.date) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const searchBox = `<label class="tiny" for="phaseReflectionSearch">Search reflections</label><input id="phaseReflectionSearch" data-reflection-search type="search" placeholder="Search text or date" value="${esc(search)}">`;
    const list = entries.length ? entries.map(entry => {
      const id = esc(entry.id);
      const full = esc(entry.text);
      const preview = esc(entry.text.length > 220 ? `${entry.text.slice(0, 220)}…` : entry.text);
      const created = timestampLabel(entry.createdAt);
      const modified = entry.updatedAt && entry.updatedAt !== entry.createdAt ? `<span class="muted tiny"> · Edited ${esc(timestampLabel(entry.updatedAt))}</span>` : '';
      const estimated = entry.timestampEstimated ? '<span class="muted tiny"> · Original time not recorded</span>' : '';
      const editing = entry.editing ? `<textarea data-edit-text="${id}" rows="7" maxlength="100000">${full}</textarea><div class="actions"><button type="button" data-action="save-edit" data-id="${id}" data-date="${esc(entry.date)}">Save edit</button><button type="button" class="secondary" data-action="cancel-edit">Cancel</button></div>` : `<button type="button" class="ghost reflection-expand" aria-expanded="false" data-action="expand" data-id="${id}" data-date="${esc(entry.date)}"><strong>${esc(dateLabel(entry.date))}</strong><span class="muted tiny">${esc(created)}${modified}${estimated}</span><span class="reflection-preview">${preview}</span><span class="reflection-full hidden">${full}</span><span class="muted tiny" data-expand-label>Tap or press Enter to read full reflection</span></button><div class="actions"><button type="button" class="ghost" data-action="edit" data-id="${id}" data-date="${esc(entry.date)}">Edit</button><button type="button" class="ghost" data-action="delete-reflection" data-id="${id}" data-date="${esc(entry.date)}">Delete</button></div>`;
      return `<article class="habit reflection-entry" data-entry-id="${id}">${editing}</article>`;
    }).join('') : '<div class="empty">No reflections match yet.</div>';
    card.innerHTML = `<h2>Past reflections</h2>${searchBox}<div data-phase-reflection-list>${list}</div>`;
  }

  function enhanceReorder() {
    const habitsCard = [...root.querySelectorAll('.card')].find(item => item.querySelector('h2')?.textContent.trim() === "Today's habits");
    if (!habitsCard) return;
    habitsCard.dataset.phaseHabits = 'true';
    const state = bridge().getState();
    const visible = (state.habits || []).filter(habit => !habit.archived);
    const cards = [...habitsCard.querySelectorAll(':scope > .habit')];
    cards.forEach((card, index) => {
      const habit = visible[index];
      if (!habit) return;
      card.dataset.habitId = habit.id;
      if (!window.__dailyStandardReorder) return;
      if (!card.querySelector('[data-drag-handle]')) {
        const name = card.querySelector('.name');
        if (!name) return;
        const handle = document.createElement('button');
        handle.type = 'button'; handle.className = 'secondary phase-drag-handle'; handle.dataset.dragHandle = 'true'; handle.setAttribute('aria-label', `Drag to reorder ${habit.name}`); handle.textContent = '⠿'; handle.title = 'Drag to reorder';
        name.insertAdjacentElement('afterbegin', handle);
        card.setAttribute('draggable', 'false');
        card.querySelectorAll('input, .actions button').forEach(control => { control.disabled = true; });
        const controls = document.createElement('div'); controls.className = 'actions phase-move-controls';
        controls.innerHTML = `<button type="button" class="secondary" data-action="move-habit" data-id="${esc(habit.id)}" data-step="-1" aria-label="Move ${esc(habit.name)} up">Move Up</button><button type="button" class="secondary" data-action="move-habit" data-id="${esc(habit.id)}" data-step="1" aria-label="Move ${esc(habit.name)} down">Move Down</button>`;
        card.appendChild(controls);
      }
      card.classList.toggle('phase-dragging-mode', Boolean(window.__dailyStandardReorder));
    });
    let actions = habitsCard.querySelector('[data-reorder-actions]');
    if (!actions) { actions = document.createElement('div'); actions.className = 'actions'; actions.dataset.reorderActions = 'true'; habitsCard.querySelector('h2')?.insertAdjacentElement('afterend', actions); }
    actions.innerHTML = window.__dailyStandardReorder ? '<strong>Reordering habits</strong><button type="button" data-action="done-reorder">Done</button>' : '<button type="button" class="secondary" data-action="start-reorder">Reorder Habits</button>';
  }

  function enhance() {
    migrate();
    reflectionMarkup();
    renderReflectionHistory();
    enhanceReorder();
  }

  function reorderHabit(id, step) {
    const next = stateCopy();
    const active = next.habits.filter(habit => !habit.archived);
    const currentIndex = active.findIndex(habit => habit.id === id);
    const targetIndex = currentIndex + Number(step);
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= active.length) return;
    [active[currentIndex], active[targetIndex]] = [active[targetIndex], active[currentIndex]];
    let cursor = 0;
    next.habits = next.habits.map(habit => habit.archived ? habit : active[cursor++]);
    persist(next);
  }

  function moveByDrop(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const next = stateCopy();
    const active = next.habits.filter(habit => !habit.archived);
    const from = active.findIndex(habit => habit.id === sourceId), to = active.findIndex(habit => habit.id === targetId);
    if (from < 0 || to < 0) return;
    const [item] = active.splice(from, 1); active.splice(to, 0, item);
    let cursor = 0;
    next.habits = next.habits.map(habit => habit.archived ? habit : active[cursor++]);
    persist(next);
  }

  function saveNewReflection() {
    const text = root.querySelector('#phaseReflectionText')?.value.trim();
    if (!text) { alert('Write a reflection before saving.'); return; }
    const date = selectedReflectionDate();
    if (!plainDate(date)) { alert('Choose a valid reflection date.'); return; }
    const next = stateCopy(); next.reflections ||= {};
    const createdAt = new Date().toISOString();
    const entries = next.reflections[date];
    if (typeof entries === 'string') next.reflections[date] = [{ id: uid(), text: entries, createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`, timestampEstimated: true }];
    else if (!Array.isArray(entries)) next.reflections[date] = [];
    next.reflections[date].push({ id: uid(), text, createdAt, updatedAt: createdAt });
    if (persist(next)) window.render();
  }

  function updateEntry(date, id, action, text) {
    const next = stateCopy(); const list = next.reflections?.[date];
    if (!Array.isArray(list)) return;
    const index = list.findIndex(entry => entry.id === id);
    if (index < 0) return;
    if (action === 'delete') {
      if (!confirm('Delete this reflection permanently?')) return;
      list.splice(index, 1); if (!list.length) delete next.reflections[date];
    } else {
      const value = String(text ?? '').trim(); if (!value) { alert('A reflection cannot be empty.'); return; }
      list[index] = { ...list[index], text: value, updatedAt: new Date().toISOString() };
    }
    if (persist(next)) window.render();
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action;
    if (action === 'start-reorder') { window.__dailyStandardReorder = true; enhanceReorder(); }
    if (action === 'done-reorder') { window.__dailyStandardReorder = false; window.render(); }
    if (action === 'move-habit') reorderHabit(button.dataset.id, button.dataset.step);
    if (action === 'new-reflection') saveNewReflection();
    if (action === 'expand') {
      const expanded = button.getAttribute('aria-expanded') === 'true'; button.setAttribute('aria-expanded', String(!expanded));
      button.querySelector('.reflection-preview')?.classList.toggle('hidden', !expanded);
      button.querySelector('.reflection-full')?.classList.toggle('hidden', expanded);
      const label = button.querySelector('[data-expand-label]'); if (label) label.textContent = expanded ? 'Tap or press Enter to read full reflection' : 'Tap or press Enter to collapse';
    }
    if (action === 'edit') {
      const item = button.closest('[data-entry-id]'); if (!item) return;
      const state = bridge().getState(); const entry = (state.reflections?.[button.dataset.date] || []).find(item => item.id === button.dataset.id); if (!entry) return;
      const next = stateCopy(); next.reflections[button.dataset.date] = next.reflections[button.dataset.date].map(value => value.id === button.dataset.id ? { ...value, editing: true } : value); persist(next);
    }
    if (action === 'cancel-edit') { window.render(); }
    if (action === 'save-edit') {
      const text = root.querySelector(`[data-edit-text="${CSS.escape(button.dataset.id)}"]`)?.value;
      updateEntry(button.dataset.date, button.dataset.id, 'edit', text);
    }
    if (action === 'delete-reflection') updateEntry(button.dataset.date, button.dataset.id, 'delete');
  });

  root.addEventListener('input', event => {
    if (event.target.matches('[data-reflection-search]')) {
      const card = event.target.closest('.card');
      const scroll = card?.scrollTop || 0;
      renderReflectionHistory();
      const next = root.querySelector('[data-reflection-search]'); next?.focus(); next?.setSelectionRange(next.value.length, next.value.length);
      if (card) card.scrollTop = scroll;
    }
  });
  root.addEventListener('change', event => {
    if (event.target.matches('[data-reflection-date]')) window.selectDate?.(event.target.value);
  });

  let draggingId = null;
  root.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-drag-handle]');
    if (!window.__dailyStandardReorder || !handle) return;
    draggingId = handle.closest('[data-habit-id]')?.dataset.habitId || null;
    handle.setPointerCapture?.(event.pointerId);
  });
  root.addEventListener('pointerup', event => {
    if (!draggingId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-habit-id]');
    const from = draggingId; draggingId = null;
    if (target) moveByDrop(from, target.dataset.habitId);
  });
  root.addEventListener('pointercancel', () => { draggingId = null; });
  root.addEventListener('keydown', event => {
    if (event.target.matches('[data-action="expand"]') && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.target.click(); }
  });

  const style = document.createElement('style');
  style.textContent = `.reflection-entry{min-width:0;overflow:hidden}.reflection-expand{display:flex;width:100%;min-width:0;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;white-space:normal;overflow-wrap:anywhere;line-height:1.55}.reflection-expand .reflection-full{white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;max-height:65vh;overflow:auto;overscroll-behavior:contain}.reflection-preview{white-space:pre-wrap;overflow-wrap:anywhere}.phase-dragging-mode{outline:1px dashed var(--accent);touch-action:pan-y}.phase-drag-handle{margin-right:8px;touch-action:none;cursor:grab}.phase-move-controls{margin-top:8px}@media(prefers-reduced-motion:reduce){.reflection-expand{scroll-behavior:auto}}`;
  document.head.appendChild(style);
  new MutationObserver(() => requestAnimationFrame(enhance)).observe(root, { childList: true, subtree: true });
  migrate();
  enhance();
})();
