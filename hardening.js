(() => {
  'use strict';
  const safety = window.DailyStandardSafety;
  const bridge = () => window.DailyStandardQuoteBridge;
  if (!safety || !bridge()) return;

  // Expose safe schedule/status helpers to the existing global app, preserving its v1 storage format.
  const logic = () => safety.createHabitLogic(bridge().getState());
  window.schedule = (habit, date) => logic().schedule(habit, date);
  window.pauseFor = (habit, date) => logic().pauseFor(habit, date);
  window.entry = (habit, date) => logic().entry(habit, date);
  window.status = (habit, date) => logic().status(habit, date);
  window.dayStats = date => logic().dayStats(date);

  // Validate an entire backup before modifying data. Current data is downloaded first.
  const fileInput = document.getElementById('importFile');
  fileInput?.addEventListener('change', async event => {
    event.stopImmediatePropagation();
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Backup exceeds the 50 MB limit.');
      const candidate = JSON.parse(await file.text());
      const normalized = safety.validateBackup(candidate);
      if (!confirm('Restore this validated backup? It will replace this browser’s current app data. A backup of your current data will be downloaded first.')) return;
      bridge().downloadBackup();
      if (!bridge().restoreState(normalized)) throw new Error('Could not save the restored backup. Existing data was not intentionally replaced.');
      window.render();
      alert('Backup validated and restored. A backup of the previous data was downloaded.');
    } catch (error) {
      alert(`Backup was not restored. Existing data was not changed. ${error?.message || 'Invalid backup file.'}`);
    } finally {
      event.target.value = '';
    }
  }, true);

  // Export through spreadsheet-safe CSV escaping. Formulas remain inert when opened in spreadsheet software.
  window.exportCSV = () => bridge().exportHabitCSV();
  window.exportQuotes = () => bridge().exportQuoteCSV();
  window.exportJSON = () => bridge().downloadBackup();

  // Accessible modal behavior: focus initial control, return focus, Escape close, and contain tab navigation.
  const modal = document.getElementById('modal');
  const dialog = document.getElementById('dialog');
  let previousFocus = null;
  if (modal && dialog) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Application dialog');
    dialog.tabIndex = -1;
    const focusableSelector = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';
    const observer = new MutationObserver(() => {
      if (!modal.classList.contains('hidden')) {
        previousFocus = document.activeElement;
        const first = dialog.querySelector(focusableSelector);
        (first || dialog).focus();
      } else if (previousFocus?.isConnected) {
        previousFocus.focus();
        previousFocus = null;
      }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('keydown', event => {
      if (modal.classList.contains('hidden')) return;
      if (event.key === 'Escape') { event.preventDefault(); window.closeModal(); return; }
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll(focusableSelector)];
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }

  // Apply labels to controls whose existing markup relied on placeholder text.
  const labelControls = () => {
    const root = document.getElementById('view');
    if (!root) return;
    for (const control of root.querySelectorAll('input,textarea,select')) {
      if (control.labels?.length || control.hasAttribute('aria-label')) continue;
      const label = control.previousElementSibling;
      if (label?.tagName === 'LABEL') {
        if (!control.id) control.id = `accessible-${safety.safeId()}`;
        label.htmlFor = control.id;
      } else if (control.placeholder) control.setAttribute('aria-label', control.placeholder);
    }
    document.querySelectorAll('[data-tab]').forEach(button => {
      const name = button.dataset.tab || 'Navigation';
      button.setAttribute('aria-label', name[0].toUpperCase() + name.slice(1));
      if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  };
  new MutationObserver(labelControls).observe(document.getElementById('view'), { childList: true, subtree: true });
  labelControls();
})();
