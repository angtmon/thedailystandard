(() => {
  'use strict';

  const STORAGE_KEY = 'daily-standard-home-quote-order-v1';
  const bridge = () => window.DailyStandardQuoteBridge;
  const todayKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  let quoteState = null;

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function getQuoteState() {
    const quotes = bridge()?.getQuotes?.() || [];
    const ids = quotes.map((quote, index) => String(quote.id || `quote-${index}`));
    let stored;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { stored = null; }

    const validStored = stored && stored.date === todayKey() && Array.isArray(stored.ids) &&
      stored.ids.length === ids.length && stored.ids.every(id => ids.includes(id));

    if (!validStored) {
      stored = { date: todayKey(), ids: shuffle(ids), position: 0 };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch { /* Continue with an in-memory shuffle if storage is unavailable. */ }
    }
    stored.position = Math.max(0, Math.min(Number(stored.position) || 0, Math.max(0, stored.ids.length - 1)));
    quoteState = stored;
    return { quotes, state: stored };
  }

  function updateVisibleHomeQuote() {
    const activeTab = document.querySelector('#tabs [data-tab].active')?.dataset.tab;
    if (activeTab && activeTab !== 'today') return;

    const { quotes, state } = getQuoteState();
    if (!quotes.length) return;

    const heading = [...document.querySelectorAll('#view h2')].find(item => item.textContent.trim() === 'Daily quote');
    const card = heading?.closest('.card');
    if (!card) return;

    const quote = quotes.find(item => String(item.id || '') === state.ids[state.position]) || quotes[0];
    const quoteText = card.querySelector('.quote');
    if (quoteText) quoteText.textContent = `“${quote.text ?? ''}”`;

    const attribution = quoteText?.nextElementSibling;
    if (attribution) {
      const author = [...attribution.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
      if (author) author.textContent = `— ${quote.author || 'Unknown'} `;
      const category = attribution.querySelector('.pill');
      if (category) category.textContent = quote.category || 'Mindset';
    }
  }

  function persistState() {
    if (!quoteState) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(quoteState)); } catch { /* Keep current session working without persistence. */ }
  }

  const originalRender = window.render;
  if (typeof originalRender === 'function') {
    window.render = (...args) => {
      const result = originalRender.apply(window, args);
      updateVisibleHomeQuote();
      return result;
    };
  }

  window.cycleQuote = () => {
    const { quotes, state } = getQuoteState();
    if (quotes.length < 2) return;
    state.position = (state.position + 1) % state.ids.length;
    persistState();
    updateVisibleHomeQuote();
  };

  // The inline app's first render happens before deferred scripts run; repaint the initial dashboard.
  updateVisibleHomeQuote();
})();
