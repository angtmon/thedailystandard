(() => {
  'use strict';

  const addTransferAction = () => {
    const root = document.getElementById('view');
    const bridge = window.DailyStandardQuoteBridge;
    if (!root || !bridge) return;

    const title = [...root.querySelectorAll('h2')].find(item => item.textContent.trim().toLowerCase() === 'export & backup');
    const card = title?.closest('.card');
    const actions = card?.querySelector('.actions');
    if (!actions || actions.querySelector('[data-device-transfer]')) return;

    const button = document.createElement('button');
    button.className = 'secondary';
    button.type = 'button';
    button.dataset.deviceTransfer = 'true';
    button.textContent = 'Move data to another device';
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', openTransferDialog);
    actions.appendChild(button);

    const hint = document.createElement('p');
    hint.className = 'muted tiny';
    hint.textContent = 'Your data stays on this device unless you export and transfer a backup file.';
    actions.insertAdjacentElement('afterend', hint);
  };

  function openTransferDialog() {
    const bridge = window.DailyStandardQuoteBridge;
    bridge.openModal(`
      <h2>Move your data to another device</h2>
      <p>Your habits, history, quotes, reflections, preferences, and verse history are stored in this browser—not in your GitHub account.</p>
      <ol>
        <li>On this device, export a full JSON backup.</li>
        <li>Transfer the file privately using AirDrop, iCloud Drive, a cable, or another trusted method. Do not post it publicly; it may contain private reflections.</li>
        <li>Open The Daily Standard on the new device, go to <strong>Settings → Export &amp; backup</strong>, choose <strong>Restore backup</strong>, and select the JSON file from Files or Downloads.</li>
        <li>Review the confirmation. The new device’s current data is backed up before the imported backup replaces it.</li>
      </ol>
      <p class="notice">A backup is a copy, not sync. Changes made later on one device will not automatically appear on the other. Keep the original file somewhere safe until you verify the restore.</p>
      <div class="actions">
        <button id="transferExport">Export full backup</button>
        <button class="secondary" id="transferRestore">Choose backup to restore</button>
        <button class="secondary" id="transferClose">Close</button>
      </div>
    `);
    document.getElementById('transferExport')?.addEventListener('click', () => bridge.downloadBackup());
    document.getElementById('transferRestore')?.addEventListener('click', () => {
      bridge.closeModal();
      document.getElementById('importFile')?.click();
    });
    document.getElementById('transferClose')?.addEventListener('click', () => bridge.closeModal());
  }

  const start = () => {
    const root = document.getElementById('view');
    if (!root) return;
    new MutationObserver(addTransferAction).observe(root, { childList: true, subtree: true });
    addTransferAction();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
