# Japan Trip Hub

A small React app for a friends-and-family Japan trip: shared **moments** (photos, warnings, updates) with comments and reactions, plus per-person **itineraries** on a drag-and-drop JST timeline. Hosting is **GitHub Pages** (static); shared data lives in **Firebase** (Firestore + Storage + Anonymous Auth).

## Trip gate

- Password for the UI: **`JP2026`** (change in [`src/context/TripContext.tsx`](src/context/TripContext.tsx) if you like).
- Unlock is stored in a cookie (and `localStorage` fallback) so people only type it once per browser.
- **Calendar editing** is a second step: your own calendar opens **read-only** until you enter the same password again (stored in `sessionStorage` until the tab closes).

## Local setup

1. **Node.js 20+** recommended.
2. Copy [`.env.example`](.env.example) to `.env` and fill in Firebase web config (`VITE_FIREBASE_*`).
3. For GitHub project Pages, set `VITE_BASE=/your-repo-name/` in `.env`. For local dev at `/`, use `VITE_BASE=/`.
4. Install and run:

```bash
npm install
npm run dev
```

5. Build:

```bash
npm run build
```

The build copies `index.html` to `dist/404.html` so client-side routes work on GitHub Pages.

## Firebase console

1. Create a project → enable **Firestore**, **Storage**, and **Authentication** → **Anonymous** sign-in.
2. Deploy rules from this repo:
   - [`firebase/firestore.rules`](firebase/firestore.rules)
   - [`firebase/storage.rules`](firebase/storage.rules)
   (Use Firebase CLI `firebase deploy --only firestore:rules,storage` or paste into the console.)
3. Create a web app and copy config into `.env`.

Firestore rules assume **authenticated** users (anonymous is enough). Anyone who can load your site and complete anonymous sign-in can read shared data; the trip password is **not** a cryptographic lock on Firebase—keep the repo and URL among friends.

## GitHub Pages (Actions)

1. Repo **Settings → Pages**: **Source** = **GitHub Actions**.
2. Add repository **Secrets** (same names as in `.env`):  
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.  
   Optional: `VITE_FIREBASE_MEASUREMENT_ID` if you use Google Analytics in the Firebase console (same value as `measurementId` in the web app config).
3. Keep this project at the **repository root** (`package.json` next to `.github/`) so the workflow finds `npm` scripts and `dist/` without extra paths.
4. Push to `main`. The workflow sets `VITE_BASE` to `/<repository-name>/` automatically for project pages.

If you use a **custom domain** at the site root, change the workflow env `VITE_BASE` to `/` and set your DNS in Pages settings.

## Data model (summary)

- `users/{uid}` — display name, accent color.
- `posts/{postId}` — feed posts; subcollections `comments`, `reactions`.
- `itineraries/{uid}` — `tripStartDate`, `numDays`, `blocks[]` (each block has JST `start`/`end` as Firestore timestamps).

## License

Private trip use; adjust as you like.
