# The Daily Standard

Offline-first personal habit tracker PWA for GitHub Pages.

## Engineering changes

The app keeps its existing `daily-standard-v1` localStorage data model. It is not migrated to a new database, and no existing user data is intentionally discarded.

- **Data safety:** `app-safety.js` contains pure validation/scheduling helpers; restore validates the full backup before replacement, remaps imported IDs, retains only valid records, and downloads the existing data first. CSV exports escape spreadsheet formula cells.
- **Habit logic:** scheduling, pause, status, and daily-stat functions are guarded against invalid dates and malformed entries. Weekly-frequency semantics remain flexible-any-day; no weekly quota reporting is claimed yet.
- **Accessibility:** dialogs support Escape, focus containment and focus return; rendered controls and navigation receive accessible names where possible.
- **PWA lifecycle:** service worker uses a versioned cache, network-first app shell with offline fallback, and cached asset delivery. Updates are activated on install; there is no separate in-app update prompt.
- **Tests:** run `node --test` to exercise date validation, schedule/pause/status behavior, quote keys, CSV escaping, and backup validation. These are unit-level checks, not browser/device testing.

## Quote import

In **Quotes**, choose **Import CSV / Excel** to upload `.csv`, `.txt`, or `.xlsx`. Preview rows and duplicate counts before confirming. The first worksheet is parsed locally; Excel parsing downloads SheetJS from jsDelivr on first use (internet required once). CSV/TXT remains offline-capable.

## Existing functionality and limitations

- Habit completion, measurable tracking, selected weekdays, pauses, archive/reactivation, historical entries and notes.
- Calendar, summaries, quote library, reflections, weekly local verse excerpts, theme, backup and exports.
- Browser-local data only; no cloud sync or IndexedDB migration. Back up regularly.
- No reliable background notification while closed, especially on iOS.
- Quote categorization is local keyword matching, not semantic AI.
- Bible text is a small prototype excerpt set; no claim of NLT or a fully licensed translation.
- Physical-device and browser compatibility testing remains outstanding.

## Run tests

```sh
node --test
```

## iPhone installation

Publish the repository root with GitHub Pages. Open the HTTPS site in Safari on iPhone, choose **Share → Add to Home Screen**, then launch once online to cache the app for offline use.
