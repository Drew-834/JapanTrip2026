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
4. **Authorized domains (required for the live GitHub Pages URL):** Firebase Console → **Authentication** → **Settings** → **Authorized domains** → **Add domain**. Use the **hostname only** (no `https://`, no path), e.g. `drew-834.github.io`. That covers `https://drew-834.github.io/JapanTrip2026/` and any path on that host.  
   If this is missing, **photo uploads** can fail and the browser may show a misleading **CORS / preflight** error on `firebasestorage.googleapis.com` even though the real issue is auth/session for that origin.
5. Deploy **Storage rules** (see above). If uploads still fail after step 4, confirm **Anonymous** sign-in is enabled and check the browser **Network** tab status code on the failing Storage request (403 → rules or auth).

### Troubleshooting: “CORS / preflight” on Storage (GitHub Pages)

The app uses the Firebase Web SDK; you do **not** add CORS files to this repo. If DevTools shows a CORS or preflight error for `firebasestorage.googleapis.com`, work through this list:

1. **Authorized domains** — In **Authentication** → **Settings** → **Authorized domains**, add the GitHub Pages **hostname** (e.g. `drew-834.github.io`). `localhost` is allowed by default; your production host is not.
2. **Anonymous sign-in** — **Authentication** → **Sign-in method** → **Anonymous** = enabled (required for uploads with the current app rules).
3. **`VITE_FIREBASE_STORAGE_BUCKET`** — In **Project settings** → **Your apps** (or **Storage**), copy the default bucket (often `project-id.firebasestorage.app`). The same value must be in local `.env` and in the repo’s **Settings → Secrets and variables → Actions** for the GitHub Pages workflow (see [`.github/workflows/pages.yml`](.github/workflows/pages.yml)). A wrong bucket can produce failed requests that the browser reports as CORS.
4. **Re-test in the browser** — After changes, hard-refresh the site. In **Network**, inspect the Storage `POST` (and `OPTIONS` if present): **2xx** means success; **403** often means auth, rules, or App Check. **App Check** — If you enabled **enforcement** for Storage, register the web app and configure App Check (e.g. reCAPTCHA) or temporarily turn enforcement off to verify uploads.

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
