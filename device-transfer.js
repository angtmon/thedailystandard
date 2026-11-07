(() => {
  'use strict';

  const transferTitle = 'Move data to another device';
  const getState = () => window.DailyStandardQuoteBridge?.getState?.() || {};
  const isEmptyInstall = () => {
    const state = getState();
    const habits = Array.isArray(state.habits) ? state.habits : [];
    const quotes = Array.isArray(state.quotes) ? state.quotes : [];
    const reflections = state.reflections && typeof state.reflections === 'object' ? state.reflections : {};
    return habits.length === 0 && quotes.length === 0 && Object.keys(reflections).length === 0;
  };

  function openTransferDialog() {
    const bridge = window.DailyStandardQuoteBridge;
    if (!bridge) return;
    bridge.openModal(`
      <h2>${transferTitle}</h2>
      <p>Your data is saved in this browser on this device. It is not automatically copied to a new phone or synced through GitHub Pages.</p>
      <ol>
        <li>On your old device, choose <strong>Export full backup</strong>.</li>
        <li>Transfer the JSON file privately using AirDrop, iCloud Drive, a cable, or another trusted method.</li>
        <li>On the new device, open The Daily Standard, choose <strong>Import backup</strong>, and select that file.</li>
        <li>Review the restore confirmation and verify your data before deleting the transfer file.</li>
      </ol>
      <div class="notice"><strong>Privacy warning:</strong> The backup contains your habit history, quotes, and reflections. It is a plain JSON file and is not encrypted. Store and share it only somewhere you trust. Restoring replaces the destination device’s data; the app offers a backup of that device first.</div>
      <p class="muted tiny">This is a manual transfer, not sync. Changes made later on one device will not appear on another automatically.</p>
      <div class="actions">
        <button id="transferExport">Export full backup</button>
        <button class="secondary" id="transferImport">Import backup</button>
        <button class="secondary" id="transferClose">Close</button>
      </div>
    `);
    document.getElementById('transferExport')?.addEventListener('click', () => bridge.downloadBackup());
    document.getElementById('transferImport')?.addEventListener('click', () => {
      bridge.closeModal();
      document.getElementById('importFile')?.click();
    });
    document.getElementById('transferClose')?.addEventListener('click', () => bridge.closeModal());
  }

  function addFirstLaunchImport() {
    const view = document.getElementById('view');
    const bridge = window.DailyStandardQuoteBridge;
    if (!view || !bridge || !isEmptyInstall() || view.querySelector('[data-first-run-transfer]')) return;
    const todayHeading = [...view.querySelectorAll('h2')].find(el => el.textContent.trim() === "Today's habits");
    const host = todayHeading?.closest('.card') || view.firstElementChild;
    if (!host) return;

    const card = document.createElement('section');
    card.className = 'card notice';
    card.dataset.firstRunTransfer = 'true';
    card.setAttribute('aria-labelledby', 'firstRunTransferTitle');
    card.innerHTML = `
      <h2 id="firstRunTransferTitle">New phone or existing backup?</h2>
      <p class="muted">Bring over your habits, history, quotes, and reflections with a backup file.</p>
      <div class="actions">
        <button type="button" data-first-run-import>Import backup</button>
        <button type="button" class="secondary" data-first-run-help>Transfer data help</button>
      </div>
    `;
    card.querySelector('[data-first-run-import]')?.addEventListener('click', () => document.getElementById('importFile')?.click());
    card.querySelector('[data-first-run-help]')?.addEventListener('click', openTransferDialog);
    host.insertAdjacentElement('beforebegin', card);
  }

  function improveBackupCopy() {
    const view = document.getElementById('view');
    if (!view) return;
    const heading = [...view.querySelectorAll('h2')].find(el => el.textContent.trim().toLowerCase() === 'export & backup');
    const card = heading?.closest('.card');
    if (!card) return;
    let warning = card.querySelector('[data-backup-warning]');
    if (!warning) {
      warning = document.createElement('div');
      warning.className = 'notice';
      warning.dataset.backupWarning = 'true';
      heading.insertAdjacentElement('afterend', warning);
    }
    warning.innerHTML = '<strong>Your data stays on this device.</strong> There is no automatic cloud sync. Clearing browser data or changing phones can make it unavailable here. Export backups regularly. Backups include reflections and are unencrypted JSON files—store them privately.';

    const oldCopy = card.querySelector('p.muted.tiny');
    if (oldCopy && !oldCopy.dataset.transferCopyUpdated) {
      oldCopy.textContent = 'Export a full backup to move your data to another device. Restore replaces this browser’s data after validation and confirmation; the app downloads a copy of the current data first.';
      oldCopy.dataset.transferCopyUpdated = 'true';
    }
  }

  function ensureTransferAction() {
    const view = document.getElementById('view');
    const bridge = window.DailyStandardQuoteBridge;
    if (!view || !bridge) return;
    const heading = [...view.querySelectorAll('h2')].find(el => el.textContent.trim().toLowerCase() === 'export & backup');
    const actions = heading?.closest('.card')?.querySelector('.actions');
    if (!actions || actions.querySelector('[data-device-transfer]')) return;
    const button = document.createElement('button');
    button.className = 'secondary';
    button.type = 'button';
    button.dataset.deviceTransfer = 'true';
    button.textContent = transferTitle;
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', openTransferDialog);
    actions.appendChild(button);
  }

  function enhance() {
    improveBackupCopy();
    ensureTransferAction();
    if (window.location.hash !== '#settings') addFirstLaunchImport();
  }

  const root = document.getElementById('view');
  if (root) new MutationObserver(enhance).observe(root, { childList: true, subtree: true });
  window.addEventListener('hashchange', enhance);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, { once: true });
  else enhance();
})();
