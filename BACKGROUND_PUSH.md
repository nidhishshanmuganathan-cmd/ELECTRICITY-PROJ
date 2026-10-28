# Background notification verification and deployment

The existing test endpoint already sent through Firebase Admin. Its message claimed delivery even though FCM acceptance is not proof of Android display. The deployed public site now includes the token-registration code and a public VAPID-shaped key in addition to the SDK default. Its service worker returns HTTP 200 with the correct Firebase project. Actual permission and token generation on the user's phone cannot be inspected from here.

## Changes

- `backend/app/services/fcm.py`: high-urgency Web Push with one-hour TTL, app icon, notification tag and HTTPS click link. Logs the FCM message ID only after acceptance; rejects failures with sanitized errors, never token values or provider exception contents.
- `backend/app/routes/users.py`: test responses include `status=accepted_by_fcm` and `message_id`; failures return actionable errors, not success. The authenticated user's stored FCM token remains the only target.
- `backend/app/services/notifications.py`: serializes concurrent checks using a PostgreSQL row lock, records month and status only after FCM acceptance, and preserves retry eligibility on failed sends. Tags collapse repeated display of the same monthly alert. Existing meter uploads, aggregation and simulation continue triggering server-side alerts without the website open.
- `backend/app/models/user.py`: documents the month/status value in the existing 20-character column; no schema migration required. An old bare status can produce one new alert after deployment.
- `frontend/public/firebase-messaging-sw.js`: activates updated worker promptly, preserves FCM's automatic display for notification payloads, adds icon/tag for data-only fallback, and retains tap-to-focus/open behavior. It deliberately avoids manually displaying a second copy of an FCM notification.
- `frontend/src/notifications.js`: uses matching tags for foreground system notifications, handles registration failures more clearly, and removes raw error-object logging.
- `frontend/src/components/Profile.jsx`: refreshes this device's registration before sending a test and requires an FCM acceptance result before showing confirmation. Page design remains unchanged.
- Tests: `backend/tests/test_fcm_service.py`, `backend/tests/test_push_test_route.py`, `backend/tests/test_notification_dedup.py`, and `frontend/tests/push-worker.test.js` cover payload construction, sanitized failures, accepted responses, persistence, monthly retries, concurrent checks, duplicate display prevention and notification clicks.

## Deployment after approval

1. Push the reviewed changes, then deploy Render and Vercel. Deploy Render first because the frontend expects the new acceptance response.
2. Keep Vercel `VITE_FIREBASE_VAPID_KEY` set to the public Web Push key from `electric-ai-1f3a0`, and `VITE_API_BASE_URL=https://electricity-proj.onrender.com`.
3. Keep Render `DATABASE_URL`, `FIREBASE_CREDENTIALS_PATH`, and `CORS_ORIGINS=https://electricity-proj.vercel.app` configured. The Admin credential must be for the same Firebase project with FCM send permissions. No new environment variables are introduced.
4. Reload/reopen the phone app so the updated worker activates; enable notifications and tap Send test notification. The API response must report `accepted_by_fcm` with a message ID. Render's `push_accepted` log confirms server acceptance only. Ensure the application log collector includes INFO logs if using these for diagnostics.

## Android acceptance test

- Allow notifications for WattWatcher in Chrome site settings and allow Chrome/PWA notifications in Android Settings. Check lock-screen notification visibility and Do Not Disturb settings.
- Test while the app is foregrounded, then while Chrome is minimized, then with the phone locked. To avoid racing the test button, keep the phone app closed and trigger an authenticated usage simulation from another browser without enabling push in that browser; the stored phone token remains the target. Cross the warning threshold (80%) and limit (100%) using a test account/device. These are test data changes; do not change real meter totals merely to test push.
- Tap the notification: WattWatcher should open or focus. Repeat the same usage level: no duplicate alert should be sent. Verify escalation from warning to exceeded still sends.
- A native-looking Android notification is expected where Web Push is supported; this does not grant the PWA native-app privileges. Force-stopped Chrome, disabled notification channels, offline devices and battery restrictions may delay or suppress display. High urgency is a delivery hint, not a guarantee.

## Limits

No live FCM send or Android display was confirmed in this development run. Automated tests mock Firebase sends. A successful live message ID still does not prove the OS displayed it; inspect the phone.

There is currently one stored FCM token per user, so registering another device replaces the target. A test refresh selects the device making that request; simultaneous registrations can still replace it. Automatic alerts require incoming meter readings/server evaluation: a static usage value cannot update itself while the app is closed. Render must be reachable for meter uploads.

Row locking prevents ordinary concurrent duplicate sends, but a process crash after FCM accepts and before the database commits can cause a retry; stable tags prevent multiple active tray entries for that alert, not exactly-once transport delivery.

Reference: https://firebase.google.com/docs/cloud-messaging/web/receive-messages
