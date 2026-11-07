(() => {
  'use strict';

  const bridge = () => window.DailyStandardQuoteBridge;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const normalizeHeader = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizeDuplicateKey = value => String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[“”‘’"']/g, '').replace(/[–—−]/g, '-')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

  // RFC 4180-style CSV reader: supports escaped quotes, commas and newlines in quoted cells.
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"' && cell.length === 0) quoted = true;
      else if (char === ',') { row.push(cell); cell = ''; }
      else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
      } else cell += char;
    }
    if (quoted) throw new Error('The CSV has an unclosed quoted field.');
    row.push(cell);
    if (row.some(value => value.trim())) rows.push(row);
    return rows;
  }

  function rowsToQuotes(rows) {
    if (!rows.length) return { quotes: [], errors: ['No rows found.'] };
    const headers = rows[0].map(normalizeHeader);
    const headerNames = ['quote', 'quotes', 'text', 'quotetext', 'quotation', 'quotationtext'];
    const quoteColumn = headers.findIndex(name => headerNames.includes(name));
    const hasHeader = quoteColumn >= 0;
    const columns = hasHeader ? {
      quote: quoteColumn,
      author: headers.findIndex(name => ['author', 'source', 'attribution'].includes(name)),
      category: headers.findIndex(name => ['category', 'categories', 'theme', 'topic'].includes(name)),
      favorite: headers.findIndex(name => ['favorite', 'favourite', 'isfavorite'].includes(name))
    } : { quote: 0, author: 1, category: 2, favorite: 3 };
    const sourceRows = hasHeader ? rows.slice(1) : rows;
    const quotes = [], errors = [];
    sourceRows.forEach((cells, index) => {
      const text = String(cells[columns.quote] ?? '').trim();
      if (!text) { errors.push(`Row ${index + (hasHeader ? 2 : 1)}: quote text is missing.`); return; }
      quotes.push({
        text,
        author: columns.author >= 0 ? String(cells[columns.author] ?? '').trim() : '',
        category: columns.category >= 0 ? String(cells[columns.category] ?? '').trim() : '',
        favorite: columns.favorite >= 0 && /^(yes|true|1|y)$/i.test(String(cells[columns.favorite] ?? '').trim())
      });
    });
    return { quotes, errors };
  }

  function inferCategory(text) {
    const value = text.toLowerCase();
    const rules = [
      ['Faith', /\b(god|lord|faith|prayer|christ|bible|spirit)\b/],
      ['Leadership', /\b(lead|leader|leadership|team|serve|integrity|mentor)\b/],
      ['Resilience', /\b(courage|resilien|adversity|overcome|setback|persever|grit)\b/],
      ['Discipline', /\b(discipline|consistent|habit|commitment|effort|focus)\b/],
      ['Confidence', /\b(confiden|believe|capable|self-worth)\b/],
      ['Growth', /\b(grow|learn|improv|progress|develop|potential)\b/],
      ['Wisdom', /\b(wisdom|wise|judgment|understand|insight)\b/],
      ['Purpose', /\b(purpose|meaning|mission|calling)\b/]
    ];
    return rules.find(([, pattern]) => pattern.test(value))?.[0] || 'Mindset';
  }

  let xlsxPromise;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxPromise) xlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('Spreadsheet parser did not load.'));
      script.onerror = () => reject(new Error('Could not download the spreadsheet parser. Use CSV while offline or check your connection.'));
      document.head.appendChild(script);
    });
    return xlsxPromise;
  }

  function addImportControls() {
    const api = bridge();
    const root = document.getElementById('view');
    if (!api || !root || !root.querySelector('textarea#quoteText') || root.querySelector('#quoteFileImport')) return;
    const bulkButton = [...root.querySelectorAll('button')].find(button => button.textContent.trim() === 'Bulk paste');
    if (!bulkButton) return;
    const button = document.createElement('button');
    button.className = 'secondary';
    button.type = 'button';
    button.textContent = 'Import CSV / Excel';
    button.addEventListener('click', () => document.getElementById('quoteFileImport').click());
    bulkButton.insertAdjacentElement('afterend', button);

    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'quoteFileImport';
    input.accept = '.csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.hidden = true;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        if (file.size > 25 * 1024 * 1024) throw new Error('The selected file is larger than the 25 MB import limit.');
        let rows;
        if (/\.xlsx$/i.test(file.name)) {
          const XLSX = await loadXLSX();
          const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          if (!sheet) throw new Error('The workbook does not contain a worksheet.');
          rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
        } else {
          rows = parseCSV(await file.text());
        }
        const parsed = rowsToQuotes(rows);
        if (!parsed.quotes.length) throw new Error(parsed.errors[0] || 'No quote rows were found.');
        showPreview(file.name, parsed);
      } catch (error) {
        alert(`Could not import quotes: ${error.message}`);
      } finally {
        input.value = '';
      }
    });
    root.appendChild(input);

    const note = document.createElement('p');
    note.className = 'muted tiny';
    note.textContent = 'CSV/TXT works offline. Excel files are parsed on this device; the spreadsheet parser is downloaded from jsDelivr the first time you import .xlsx. Your workbook is not uploaded.';
    bulkButton.parentElement?.insertAdjacentElement('afterend', note);
  }

  function showPreview(filename, parsed) {
    const api = bridge();
    const existing = new Set(api.getQuotes().map(quote => normalizeDuplicateKey(quote.text)));
    const seen = new Set(existing);
    const unique = [], duplicates = [];
    for (const quote of parsed.quotes) {
      const key = normalizeDuplicateKey(quote.text);
      if (!key || seen.has(key)) duplicates.push(quote);
      else { seen.add(key); unique.push(quote); }
    }
    const id = `quote-import-${Date.now()}`;
    window[id] = unique;
    const rows = unique.slice(0, 30).map(quote => `<div class="notice"><strong>${escapeHtml(quote.text)}</strong><br><small>${escapeHtml(quote.author || 'Unknown author')} · ${escapeHtml(quote.category || inferCategory(quote.text))}</small></div>`).join('');
    const errors = parsed.errors.slice(0, 10).map(error => `<li>${escapeHtml(error)}</li>`).join('');
    api.openModal(`<h2>Preview quote import</h2><p class="muted">${escapeHtml(filename)}</p><p><strong>${unique.length}</strong> new · <strong>${duplicates.length}</strong> duplicate(s) skipped · <strong>${parsed.errors.length}</strong> malformed row(s) skipped.</p>${errors ? `<details><summary>Skipped row details</summary><ul>${errors}</ul></details>` : ''}<div style="max-height:38vh;overflow:auto">${rows}${unique.length > 30 ? `<p class="muted">Showing first 30 of ${unique.length} new quotes.</p>` : ''}</div><div class="actions"><button id="confirmQuoteImport" ${unique.length ? '' : 'disabled'}>Import ${unique.length} quote(s)</button><button class="secondary" id="cancelQuoteImport">Cancel</button></div>`);
    document.getElementById('cancelQuoteImport').addEventListener('click', () => { delete window[id]; api.closeModal(); });
    document.getElementById('confirmQuoteImport').addEventListener('click', () => {
      const toAdd = (window[id] || []).map(quote => ({ ...quote, category: quote.category || inferCategory(quote.text) }));
      const result = api.addQuotes(toAdd);
      delete window[id];
      api.closeModal();
      api.render();
      alert(`Imported ${result.added} quote(s). ${result.duplicates} duplicate(s) were skipped.`);
    });
  }

  const observer = new MutationObserver(addImportControls);
  const start = () => {
    const root = document.getElementById('view');
    if (root) observer.observe(root, { childList: true, subtree: true });
    addImportControls();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
