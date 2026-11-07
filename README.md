# The Daily Standard

An offline-first, free, single-user habit tracker PWA. This is a functional first build, not a hosted app.

## Install on iPhone (free GitHub Pages)

1. Create a public GitHub repository (or use your existing `momentum-habit-tracker`).
2. Upload **the contents** of this folder to the repository root (`index.html`, `sw.js`, `manifest.webmanifest`, and both PNG icons).
3. In the repository, choose **Settings → Pages → Deploy from a branch → main → /(root) → Save**.
4. Wait for GitHub Pages to publish, then open the resulting HTTPS URL in **Safari on your iPhone**.
5. Tap **Share → Add to Home Screen**, then open the new icon.

## Features

- Daily habit check-off and measurable habits with quick-add increments.
- Daily, selected-weekday, or flexible scheduling; edit past entries.
- Pause with a reason and optional end date; archive/reactivate; habit notes.
- Calendar and real recorded monthly/30-day progress.
- Quote entry, bulk paste, deduplication, search, favorites, CSV export; offline keyword-based categories.
- Daily reflection journal and search.
- Weekly rotating Bible verse excerpts, with history and no repeats until the curated set cycles.
- Customizable dashboard and dark/light mode.
- Full JSON backup/restore, CSV exports, printable progress report.
- Service worker for offline access after initial successful load.

## Limitations and privacy

- All data is stored in the browser's localStorage on that device. Clearing website data, deleting the Home Screen app, or switching devices may lose it. **Export JSON backups regularly.** No automatic cloud sync.
- Background hourly reminders while the app is closed **are not available** with GitHub Pages alone. The optional in-app reminder is best-effort while the app remains open.
- Quote categorization is keyword-based, not AI, and does not autonomously invent/merge semantic categories.
- The Bible verse collection is a small prototype selection; it includes short excerpts, not a licensed full NLT library. A published version should use a properly licensed translation or public-domain translation.
- The PDF action opens a printable report for the browser's Print → Save as PDF feature.
- No authentication, encryption, or privacy lock. Avoid sensitive notes on shared devices.
- This version has not undergone cross-device or long-term reliability testing.
