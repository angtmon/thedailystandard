# The Daily Standard

Offline-first personal habit tracker PWA for GitHub Pages.

## Quote import

In **Quotes**, choose **Import CSV / Excel** to upload a `.csv`, `.txt`, or `.xlsx` file. The app previews the first worksheet/file, identifies common headers, shows new quotes and duplicate counts, and imports only after confirmation. Existing quotes are preserved.

Suggested CSV or Excel columns (header names are flexible):

| Quote | Author | Category | Favorite |
|---|---|---|---|
| Be comfortable being uncomfortable. | Unknown | Resilience | No |
| We become what we think about. | Earl Nightingale | Mindset | Yes |

A file without headers uses columns in this order: quote, author, category, favorite. Quote text is required; the other columns are optional. Duplicate checks normalize whitespace, capitalization, and common quote punctuation. Import size is limited to 25 MB.

CSV and TXT parsing works offline. `.xlsx` support downloads the open-source SheetJS browser parser from jsDelivr the first time an Excel file is selected. The workbook is parsed locally and is not uploaded, but Excel import requires an internet connection for that one-time parser download. No subscription or API key is required. The rest of the app does not load this dependency unless Excel import is used.

## Existing functionality

- Daily and measurable habit tracking, selected weekday scheduling, pauses, archiving, historical entries and notes.
- Calendar, daily/monthly summaries, streak display, and milestone list.
- Personal quote library, favorites, search, bulk paste, CSV export and offline keyword categorization.
- Date-keyed reflections and search.
- Weekly local Bible verse excerpt rotation.
- Dark/light theme, customizable dashboard, JSON backup/restore, CSV export, and printable report.
- Installable PWA and service-worker offline cache.

## Limitations

- Data remains in browser `localStorage` on that device. Export backups regularly; there is no cloud sync or IndexedDB migration.
- Weekly habit frequency is still represented as flexible-any-day in daily statistics; a weekly target is stored but is not yet used to calculate weekly success accurately.
- Quote categorization is offline keyword matching, not semantic AI.
- The verse collection is a small prototype excerpt set; it does not claim to be NLT or another fully licensed translation.
- Background timers cannot send reliable notifications while the app is closed, especially on iOS.
- Source changes have not been tested on physical iPhone or desktop browsers in this update.

## iPhone installation

Publish the repository root with GitHub Pages. Open its HTTPS URL in Safari on iPhone, choose **Share → Add to Home Screen**, then launch the installed app once online to cache its files for offline use.
