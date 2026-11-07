# The Daily Standard

Offline-first personal habit tracker PWA for GitHub Pages.

## Move your data to a new phone or device

Your app data is stored locally in the browser, so it does not move automatically with the app or your GitHub Pages site. Use the full JSON backup to transfer it:

1. On the old phone, open **Settings → Export & backup → Move data to another device** (or tap **Full backup (.json)**).
2. Export the backup. Transfer the downloaded JSON privately using AirDrop, iCloud Drive, a cable, or another trusted method. The backup may contain private journal reflections, so do not post or email it to an untrusted recipient.
3. On the new phone, open the same HTTPS app in Safari, install it with **Share → Add to Home Screen** if desired, then open it once.
4. Go to **Settings → Export & backup → Restore backup** and select the JSON file from Files or Downloads.
5. Confirm the restore. The app validates it before replacing data and downloads a backup of the new device's current data first. Verify your habits, quotes, and reflections before deleting the transferred file.

This is a manual backup/restore, not synchronization. Later edits on one device will not appear on another automatically. Keep periodic backups in a private location. No cloud account or paid service is required.

## Engineering changes

The app keeps its existing `daily-standard-v1` localStorage data model. It is not migrated to a new database, and no existing user data is intentionally discarded.

- **Data safety:** `app-safety.js` contains pure validation/scheduling helpers; restore validates the full backup before replacement, remaps imported IDs, retains only valid records, and downloads existing data first. CSV exports escape spreadsheet formula cells.
- **Habit logic:** scheduling, pause, status, and daily-stat functions are guarded against invalid dates and malformed entries. Weekly-frequency semantics remain flexible-any-day; no weekly quota reporting is claimed yet.
- **Accessibility:** dialogs support Escape, focus containment and focus return; rendered controls and navigation receive accessible names where possible.
- **PWA lifecycle:** service worker uses a versioned cache, network-first app shell with offline fallback, and cached asset delivery.
- **Tests:** run `node --test` to exercise date validation, schedule/pause/status behavior, quote keys, CSV escaping, and backup validation. Unit-level tests are not browser/device testing.

## Quote import

In **Quotes**, choose **Import CSV / Excel** to upload `.csv`, `.txt`, or `.xlsx`. Preview rows and duplicate counts before confirming. The first worksheet is parsed locally; Excel parsing downloads SheetJS from jsDelivr on first use (internet required once). CSV/TXT remains offline-capable.

## Limitations

- Browser-local data only; no automatic cloud sync or IndexedDB migration. Back up regularly.
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
