(() => {
  'use strict';

  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

  const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;
  const bannerId = 'pwa-update-banner';
  let registration;
  let waitingWorker;
  let applying = false;
  let dismissedWorkerUrl = '';

  function hasUnsavedChanges() {
    // A visible dialog may contain an editor, confirmation, or imported data not yet committed.
    const modal = document.getElementById('modal');
    if (modal && !modal.classList.contains('hidden')) return true;

    const root = document.getElementById('view') || document.body;
    return [...root.querySelectorAll('input, textarea, select, [contenteditable="true"]')].some(control => {
      if (control.disabled || control.type === 'file') return false;
      if (control.isContentEditable) return control.textContent !== (control.dataset.initialText || '');
      if (control.type === 'checkbox' || control.type === 'radio') return control.checked !== control.defaultChecked;
      return control.value !== control.defaultValue;
    });
  }

  function removeBanner() {
    document.getElementById(bannerId)?.remove();
  }

  function showBanner(worker) {
    if (!worker || worker === waitingWorker && dismissedWorkerUrl === worker.scriptURL) return;
    waitingWorker = worker;
    if (dismissedWorkerUrl === worker.scriptURL) return;

    let banner = document.getElementById(bannerId);
    if (!banner) {
      banner = document.createElement('section');
      banner.id = bannerId;
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      banner.style.cssText = 'position:fixed;z-index:10000;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:620px;margin:auto;padding:14px 16px;border:1px solid #9ce0b7;border-radius:14px;background:#15382e;color:#f2f8f3;box-shadow:0 8px 32px #0008;font:inherit';
      document.body.appendChild(banner);
    }

    banner.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">An update is ready</div>
      <div data-update-message style="font-size:.92em;margin-bottom:10px">The Daily Standard has a new version. Your saved data will be kept.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" data-update-now>Update now</button>
        <button type="button" class="secondary" data-update-later>Later</button>
      </div>`;
    banner.querySelector('[data-update-now]').addEventListener('click', applyUpdate);
    banner.querySelector('[data-update-later]').addEventListener('click', () => {
      dismissedWorkerUrl = worker.scriptURL;
      removeBanner();
    });
  }

  function applyUpdate() {
    if (applying || !waitingWorker) return;
    if (hasUnsavedChanges()) {
      const message = document.querySelector(`#${bannerId} [data-update-message]`);
      if (message) message.textContent = 'Save or close your current editor first. The update is waiting and will not discard unsaved changes.';
      return;
    }

    applying = true;
    const button = document.querySelector(`#${bannerId} [data-update-now]`);
    if (button) { button.disabled = true; button.textContent = 'Updating…'; }
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  function watchInstallingWorker(worker) {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) showBanner(registration?.waiting || worker);
    });
  }

  async function checkForUpdate() {
    if (!registration || !navigator.onLine || document.visibilityState === 'hidden') return;
    try { await registration.update(); } catch (_) { /* Offline; retry on visibility/focus or interval. */ }
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!applying) return;
    // The existing app persists user changes to localStorage; a reload is safe after the user chose Update now.
    window.location.reload();
  });

  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    registration = reg;
    if (reg.waiting && navigator.serviceWorker.controller) showBanner(reg.waiting);
    if (reg.installing) watchInstallingWorker(reg.installing);
    reg.addEventListener('updatefound', () => {
      if (reg.installing) watchInstallingWorker(reg.installing);
    });
    checkForUpdate();
    window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    window.addEventListener('focus', checkForUpdate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
    window.addEventListener('online', checkForUpdate);
  }).catch(error => console.warn('PWA update checks could not start:', error));
})();
