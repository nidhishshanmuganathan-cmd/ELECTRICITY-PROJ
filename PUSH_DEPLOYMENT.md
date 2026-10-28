# Mobile push configuration

## Verified cause

`frontend/src/notifications.js` returns "Push configuration is missing" when `VAPID_KEY` is empty. `frontend/src/firebase.js` reads it from `import.meta.env.VITE_FIREBASE_VAPID_KEY`. The inspected production bundle has this failure branch compiled in instead of the token-registration path. Local `.env` also has no nonempty value. This happens before token creation or backend registration.

## Vercel settings

In Firebase project `electric-ai-1f3a0`, open Project settings → Cloud Messaging → Web configuration → Web Push certificates. Copy the existing **public** key; if there is no key pair, generate one there. Do not rotate an existing pair unnecessarily. The correct project ownership of the key must be checked in Console; a key's format alone cannot prove it.

In the existing Vercel project's Settings → Environment Variables set:

| Variable | Value |
| --- | --- |
| `VITE_FIREBASE_VAPID_KEY` | The Firebase Web Push certificate public key, without quotes |
| `VITE_API_BASE_URL` | `https://electricity-proj.onrender.com` |

Select Production (and Preview/Development if those builds should support push). Redeploy after saving: changing environment variables does not update an already-built Vite bundle. For local development, use the ignored `frontend/.env.local` and restart Vite. Never put private keys or service-account JSON in Vite variables.

## Render settings

The backend reads these existing settings:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | The existing PostgreSQL connection string, kept secret |
| `FIREBASE_CREDENTIALS_PATH` | Absolute path to the existing mounted service-account secret file for `electric-ai-1f3a0` |
| `CORS_ORIGINS` | `https://electricity-proj.vercel.app` (comma-separated for additional origins) |

Render does **not** need a VAPID variable. Firebase Admin sends through FCM using its service-account credential. Confirm Firebase Cloud Messaging API and FCM Registration API are enabled for the same project and the service account has permission to send messages. Actual Render credential permissions have not been verified through a live send.

## Implementation checks

- `/firebase-messaging-sw.js` responds 200 as JavaScript on the public site and uses the same Firebase project as the frontend. The app registers it at root scope, waits for readiness, and passes the registration plus VAPID key to `getToken`.
- Authenticated `POST /users/me/device-token` saves the token to `users.fcm_token`; Firebase ID tokens authorize requests. The current schema stores one token per user, so another device registration replaces the previous one.
- `POST /users/me/push-test` sends to that stored token using Firebase Admin. Tests cover persistence, authentication, unsubscribe and sending with mocked FCM; they do not prove live phone delivery.
- Push does not require a phone number. Profile and onboarding currently require one as an application rule, preserved here. The inspected notification service sends FCM messages, not SMS.
- Small code fixes trim accidental whitespace from the public key, avoid refreshing tokens without configuration, and remove token-fragment/notification-content logging. The existing UI and notification flow are preserved.

## Verify after redeployment

Open the production HTTPS URL on the phone, sign in, enable notifications and grant permission. On iPhone, use the installed Home Screen app on iOS 16.4+. Use Profile → Send test notification, then test again with the app backgrounded. Confirm token registration succeeds before testing delivery. Never paste registration tokens into logs or screenshots.

The missing configuration is verified; the actual project's VAPID public key and real-device delivery remain to be verified after Console/Vercel setup.

Reference: https://firebase.google.com/docs/cloud-messaging/web/get-started
