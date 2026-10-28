# WattWatcher authentication deployment

## Required Firebase Console change

Open project `electric-ai-1f3a0` in Firebase Console. Go to Authentication → Settings → Authorized domains → Add domain and add:

`electricity-proj.vercel.app`

Use only the hostname (no HTTPS prefix or path). Keep the existing Firebase domains. Add other preview/custom hostnames individually only if they need sign-in. Under Authentication → Sign-in method, enable Google (with a support email) and Email/Password.

The reported `auth/unauthorized-domain` means Firebase has rejected the calling website's domain. This Console setting cannot be repaired by a frontend deployment. It does not require a code redeploy after saving.

## Configuration verified

- Frontend initialization and messaging service worker use `electric-ai-1f3a0`. The deployed frontend bundle also contains this project. Firebase web configuration is public client configuration, not an Admin credential.
- Keep `authDomain` as `electric-ai-1f3a0.firebaseapp.com`. Vercel is not serving Firebase's `/__/auth` handler; changing authDomain to the Vercel hostname is not a fix.
- Firebase configuration is currently fixed in source. `VITE_FIREBASE_*` variables do not override it; only `VITE_FIREBASE_VAPID_KEY` is read for notifications.
- The local Admin credential project matches. Confirm the private credential mounted on Render also belongs to `electric-ai-1f3a0`; deployed credentials cannot be verified from public endpoints.
- API requests obtain Firebase ID tokens using `getIdToken()`, send `Authorization: Bearer <token>`, and retry a 401 once with a refreshed token. FastAPI verifies these using Firebase Admin.
- Live Render preflight for `/users/me` returned 200 with `Access-Control-Allow-Origin: https://electricity-proj.vercel.app`. Keep Render `CORS_ORIGINS=https://electricity-proj.vercel.app` (comma-separated if adding origins). Local backend defaults alone do not include production.

## Code changes to push and redeploy

- `frontend/src/api.js`: production defaults to the Render API instead of localhost, and trims whitespace/trailing slashes from an explicit URL. Set Vercel Production `VITE_API_BASE_URL=https://electricity-proj.onrender.com` and redeploy; Vite embeds variables at build time. The inspected deployed bundle did not contain this expected Render URL.
- `frontend/src/authErrors.js` and the two authentication components: show actionable error messages, trim email input, clear stale errors, and prevent duplicate login/signup submissions while busy. Existing Google popup flow and page design are preserved. Popups are started directly from the user's click; no redirect flow is used.
- `frontend/.env.example`: documents public client environment settings without secrets.

No backend code change or Render redeployment is required for these frontend changes. Push these files and this guide to GitHub and redeploy Vercel. Never upload `.env`, service-account JSON, or Admin private keys; never place Admin credentials in `VITE_*` variables.

## Manual acceptance checks after configuration

On desktop and Android Chrome / iPhone Safari, open the public HTTPS site directly (not an embedded social-app browser):

1. Sign in with Google, allowing popups; confirm the dashboard loads.
2. Sign out; create a test email/password account, then sign out and sign in again.
3. Refresh while signed in; confirm the session restores.
4. In browser Network tools, confirm `/users/me` targets Render, has a Bearer header, and returns 200. Do not copy/share the token.
5. Cancel a Google popup and try an incorrect password; verify usable errors and retry.
6. Request a password-reset email and complete the reset.

Build and backend tests cannot prove real Google account or mobile-browser sign-in. These checks require the Console change and an interactive account test.

References: https://firebase.google.com/docs/auth/web/google-signin and https://firebase.google.com/docs/auth/web/redirect-best-practices
