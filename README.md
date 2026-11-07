# The Daily Standard

An offline-first, free, single-user habit tracker PWA for GitHub Pages.

## Current application audit

The existing app is a dependency-free HTML/CSS/JavaScript application. It stores version-1 application data in browser `localStorage` under `daily-standard-v1`. The hardening update keeps that data model and its current features intact.

### Implemented

- Daily check-off and measurable habits, with daily, selected-weekday, or flexible-any-day schedules.
- Habit notes, historical editing, pauses with reasons, archiving/reactivation, and permanent deletion with confirmation.
- Calendar, daily and monthly/30-day completion summaries.
- Personal quotes, keyword-based categories, bulk text import, search, favorites, and CSV export.
- Date-keyed private reflections and search.
- Weekly rotating local verse excerpts and verse history.
- Customizable Today dashboard, dark/light theme, optional in-app reminders, JSON backup/restore, CSV export, and printable reports.
- Installable PWA manifest and service worker for cached offline access after a successful initial visit.

### Known limitations retained

- Data remains local to the browser/device; this update does not add cloud sync or IndexedDB migration.
- Existing scheduling supports daily, selected weekdays, and flexible tracking on any day, but not a numerical “N times per week” goal.
- The verse collection is a small set of prototype excerpts; it does not claim to be NLT or another fully licensed translation.
- Category assignment is offline keyword matching, not semantic AI.
- Timers cannot provide reliable background notifications after the app is closed, especially on iOS. The reminder remains best-effort while open.
- No iPhone/desktop device testing was performed as part of this source change.

## Safety improvements in this update

- Restore validates the complete supported structure before changing stored data, rejects malformed or oversized files, remaps imported habit and quote IDs to safe generated IDs, and downloads a backup of current data before replacement.
- Existing v1 records are mapped to their remapped habit IDs; unsupported/orphaned record references are ignored rather than executable.
- Today’s quote is stable for the local calendar day and manual rotation is retained for that date.
- CSV exports prefix formula-leading cells to reduce spreadsheet formula injection risk.
- JSON exports include a backup format version and export timestamp while keeping the app’s stored data format compatible.
- Dialogs gain Escape handling, focus return and basic focus trapping; unlabeled controls and navigation receive accessible names where possible.
- Service worker cache is versioned, refreshes the app page, retains offline fallback, and injects the hardening script from a relative URL compatible with GitHub Pages subpaths.

## Install on iPhone (GitHub Pages)

1. In this repository, open **Settings → Pages** and publish the `main` branch from `/(root)`.
2. Open the published HTTPS site in Safari on iPhone.
3. Tap **Share → Add to Home Screen**.
4. Open the installed app once while online so its files are cached for offline use.

## Data and privacy

All habits, quotes, and reflections stay in browser storage unless you explicitly export them. Clearing site data or changing devices can remove access to local data, so export JSON backups regularly. Restoring replaces the current dataset only after validation and confirmation; the current dataset is downloaded first. Do not store sensitive notes on a shared device. No account, analytics, external AI, or cloud service is added.
