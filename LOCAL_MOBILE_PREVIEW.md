# Local mobile API fix

The running LAN preview had no `VITE_API_BASE_URL`, so its API client fell back to `http://127.0.0.1:8000`. On Android that is the phone, not the development computer. The dashboard starts with `GET /devices/` and `GET /users/me/alerts`; either failure produces the generic dashboard error. Auth restoration also calls `GET /users/me` and tolerates failure, explaining why the UI can load without backend data.

An isolated Chrome reproduction from `http://192.168.1.5:5173` to `http://127.0.0.1:8000/devices/` failed with `net::ERR_FAILED` / `TypeError: Failed to fetch`. This reproduction did not access the phone's browser session. Render's live preflight for `/devices/` returned **400 Disallowed CORS origin** for the LAN origin; the production Vercel origin returned **200 OK** with its exact allowed origin.

## Smallest local fix without changing production CORS

- `frontend/.env.development.local` (Git-ignored) sets the existing `VITE_API_BASE_URL=https://electricity-proj.onrender.com`.
- `frontend/src/api.js` uses `/api` only during Vite development. Production still uses the configured backend URL or the unchanged Render fallback.
- `frontend/vite.config.js` forwards development `/api/...` to that configured backend, removing only the `/api` prefix. HTTPS certificate validation stays enabled, and Authorization headers are forwarded unchanged. No wildcard CORS, authentication bypass or backend changes are introduced.
- Without a configured URL, local backend development still works through Vite's server-side `http://127.0.0.1:8000` target.

Restart Vite from `frontend` with `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort`, then reload the phone's LAN URL. The browser should request `/api/devices/` and `/api/users/me/alerts` on the Vite origin; the laptop forwards them to Render. Keep this HTTP preview on a trusted local network because the phone-to-laptop hop is not encrypted.

## Authentication and notifications

The app still gets Firebase ID tokens from `auth.currentUser.getIdToken()`, sends `Authorization: Bearer ...`, and refreshes/retries once on 401. Backend `firebase_admin.auth.verify_id_token` remains unchanged. The frontend Firebase project is `electric-ai-1f3a0`. Local tests can confirm header forwarding and retry behavior, but cannot confirm the validity of the Android user's current token without their session. No passwords or real tokens were collected or logged.

HTTP on a LAN IP is not a secure context. It can display dashboard data through the proxy, but cannot provide the full FCM/service-worker notification experience. The checked local development environment also has no `VITE_FIREBASE_VAPID_KEY`; use the existing project's public VAPID key when preparing a notification-capable preview, without changing production settings.

For notification testing, use an approved Vercel HTTPS preview of this branch, with the existing Firebase/public VAPID settings and `VITE_API_BASE_URL=https://electricity-proj.onrender.com`. Add only that exact preview origin to Render's existing `CORS_ORIGINS` allowlist (retain production), and its hostname to Firebase Authorized domains. This is a later manual deployment/configuration step, not performed by this fix. An HTTPS tunnel with a trusted certificate to the local Vite server is another option; authorize only its exact hostname in Firebase and Vite's host allowlist. Do not enable unrestricted hosts or wildcard production CORS.

References: [Vite development proxy](https://vite.dev/config/server-options#server-proxy), [Firebase HTTPS requirement](https://firebase.google.com/docs/cloud-messaging/web/get-started).

No backend routes, database records, readings, redesign files, FCM helpers or service worker were changed. Nothing was pushed or deployed.

## Verification

- The running Vite server picked up the configuration change. Both LAN proxy endpoints returned Render's `401 {"detail":"Not authenticated"}` in isolated Chrome with no signed-in session, replacing the earlier network failure. This confirms reachability and continued authentication enforcement, not successful login or a valid phone session.
- All 11 tests pass: three API/proxy tests, five data/localization tests and three existing push-worker tests. The proxy integration test uses a temporary local mock server and test-only token strings; it verifies Authorization forwarding, path rewriting and preservation of 401 responses. Client tests verify token refresh and unchanged production URL behavior.
- Production build passes; the existing shared-bundle warning above 500 kB remains.
- The production build asset hashes match the pre-fix build, consistent with the change applying only to development.
- The local environment file is ignored by Git. No secrets were added to tracked files.
- Remaining check: reload and sign in on Android, then confirm the dashboard. The phone's actual Firebase session was not accessed, so its token validity has not been asserted.
