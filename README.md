# Ledger — Monthly Expense Tracker

A simple, private expense tracker you can install on your iPhone like a real app. All your data stays on your device (stored locally in the browser) — nothing is sent anywhere.

## What's included
- `index.html`, `styles.css`, `app.js` — the app itself
- `manifest.json`, `service-worker.js` — makes it installable and usable offline
- `icons/` — app icons for the home screen

## 1. Publish it on GitHub Pages

1. Go to https://github.com/new and create a new **public** repository (e.g. `ledger`).
2. Click **Add file → Upload files**, and drag in *all* the files and folders from this download (`index.html`, `styles.css`, `app.js`, `manifest.json`, `service-worker.js`, and the whole `icons` folder), then commit.
3. Go to the repo's **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Under **Branch**, choose `main` and folder `/ (root)`, then **Save**.
6. Wait about a minute, then refresh that Settings → Pages screen — your live URL will appear, looking like:
   `https://<your-username>.github.io/ledger/`

## 2. Install it on your iPhone

1. Open that URL in **Safari** on your iPhone (it must be Safari, not Chrome, for this to work).
2. Tap the **Share** button (square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.

You'll now have a "Ledger" icon on your home screen. Opening it launches in full-screen — no browser bar — and it keeps working even with no signal, since the app and your data are stored on your phone.

## Using it
- Add an expense with an amount, date, category, and an optional note.
- Swipe between months using the arrows, or tap **Today** to jump back to the current month.
- Tap any transaction to edit it, or the ✕ to delete it.
- Set a monthly budget from the gear icon — the progress bar turns amber near the limit and red if you go over.
- **Export CSV** downloads the current month's transactions if you want to open them in a spreadsheet.

## A note on your data
Everything is stored in your phone's local browser storage. It stays there between visits, but it is specific to that device — it won't sync to your other devices, and clearing Safari's website data would erase it. If you ever want a copy, use **Export CSV** first.
