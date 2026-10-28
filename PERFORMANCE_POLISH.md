# Performance optimization and Android polish

## Scope and recovery

Completed locally on `ui-redesign`. No commit, push or deployment was made.

Before editing, 24 pending files were copied byte-for-byte and SHA-256 verified at:

`D:\frontend\wattwatcher-checkpoints\2026-10-28T09-51-15-968Z-before-performance`

The manifest records their hashes, baseline build sizes and base commit. Ignored environment files were left untouched. Existing recovery points remain:

- Original full redesign: `c7a299e9477ee89cd890723630d94f7e924a4ccf` on `ui-redesign`.
- Before redesign: `c2de971b6bc2412042fd953392b3e729581a75c6` on `backup-before-ui-redesign`.

This report describes changes after the violet refinement and LAN preview fix. Those changes remain preserved in the working tree and checkpoint.

## Architecture audit

Meters upload through `POST /devices/{id}/readings/` using the existing provisioned device token. FastAPI saves the reading, marks the device online, updates `last_seen`, runs daily/monthly aggregation, and calls the existing notification service. Firebase-authenticated frontend requests read device metadata, readings, usage summaries and predictions. No WebSocket or streaming API exists.

The upload path and notification service were not modified. Their existing deduplication remains server-side and continues to work while the web app is closed. The UI does not generate alerts or sample readings during polling.

The main performance problems were:

- Home downloaded the complete raw and daily history every 15 seconds, although it plotted only 24 readings.
- Its device/readings load waited for the alerts endpoint, which also calculates forecasts.
- An error in any one request hid initial dashboard data. Requests continued after navigation even though results were ignored.
- Changing the Analysis period refetched daily history and monthly alerts even when they had just loaded.
- Charts rebuilt their SVG paths and full accessibility text during pointer selection, and their fixed 720-unit viewBox made labels too small on Android.
- Firebase Messaging loaded with the initial JavaScript even when notifications were unused. Routes were already lazy-loaded.
- The backend does not automatically turn an old online status into offline. A status flag alone cannot prove current hardware connectivity.

## Implemented changes

### Readings and requests

- Completion-based polling checks devices every 15 seconds. It fetches the latest 24 readings when the preferred meter or `last_seen` changes, with a once-per-minute fallback for unchanged/missing metadata.
- A separate 60-second loop loads the monthly alert/forecast summary and one most recent daily total. A slow forecast no longer blocks the power reading/chart.
- Polls never overlap within a loop. They abort on navigation, hidden tabs and loss of browser connectivity; returning to the tab or reconnecting refreshes immediately. Requests have a 30-second timeout, failures back off, and timers/listeners are cleaned up.
- Previously loaded data stays visible on refresh failures, with a clear warning. No device, no readings, failed refresh, offline browser and stale telemetry have distinct messages. Unknown values remain dashes.
- The dashboard displays the reading's own `recorded_at` timestamp, never the fetch time. “Stale” means telemetry is over two minutes old; it does not claim that the hardware is definitively disconnected. Invalid/future timestamps do not prove connection. The backend's explicit offline state is shown separately.
- `intervalMs`, `summaryMs` and `STALE_AFTER_MS` are code-level settings, not new environment variables. The two-minute freshness threshold should be calibrated against the eventual sensor upload cadence; no firmware/hardware cadence was verified.
- Analysis reuses its same-meter daily/monthly summary for up to 60 seconds when switching ranges. Retry and meter changes invalidate that reuse. The cache is component-local and is discarded when leaving the route.
- History and Analysis request up to 90 daily rows; Insights requests seven. The existing calendar filtering and totals remain intact. Unique per-device daily rows ensure the available 90-day History window is retained.
- Analytics, history, alerts and meter-selection requests now accept cancellation signals. Firebase token forwarding and the one-time 401 refresh/retry are unchanged.

The small backend change was explained before implementation: both raw-reading and daily-reading GET endpoints now accept an optional validated `limit` (1–1000). It is applied after ownership verification, sorting and device filtering. Omitting it keeps the previous response behavior. Response schemas, ingestion, stored readings, database schema, aggregation, notification triggers and CORS remain unchanged.

### Charts, bundles and mobile

- Chart arrays, paths, scales and accessibility summaries are memoized. Home's unchanged reading chart skips parent refresh renders. A ResizeObserver sizes the viewBox to its actual card width, preserving readable axes on mobile; it is disconnected on unmount.
- Charts retain pointer selection, a 44-pixel keyboard/touch range control, exact values and separate forecast styling. Displayed histories are bounded instead of feeding unbounded arrays to SVG.
- Firebase Messaging is dynamically imported when needed. Authentication remains available at startup. Notification registration, token refresh, foreground listener deduplication, unsubscribe, the worker and notification-click handling are preserved.
- React and Firebase Auth are split into stable bundles. Existing route-level lazy loading is retained, and the build manifest permits size measurement. No packages were added and the warning threshold was not increased.
- Android header height is 64 pixels plus the safe area (previously 80), the gauge is 216 rather than 260 pixels, navigation text is larger, forms use 16-pixel input text, and mobile dialogs align toward the bottom with bounded scrolling. Keyboard focus, touch sizes, light theme, safe areas and reduced motion remain supported. The violet/cyan palette is unchanged.

Implementation references: [Vite 6 chunk splitting](https://v6.vite.dev/guide/build), [Firebase module bundling](https://firebase.google.com/docs/web/module-bundling).

## Before / after measurements

Decimal KB, production minified files. Initial shared JS includes all statically imported entry bundles, not just the renamed entry file; route chunks are excluded on both sides.

| Metric | Before | After |
| --- | ---: | ---: |
| Largest JS chunk | 543.39 KB | 193.85 KB |
| Initial shared JS, uncompressed | 543.39 KB | 492.55 KB |
| Initial shared JS, sum of gzip sizes | 141.42 KB | 134.88 KB |
| Messaging JS deferred until needed | none | 57.85 KB / 9.35 KB gzip |
| Raw rows requested by Home | entire history | latest 24 |
| Daily rows requested by Home | entire history | latest 1 |
| Forecast/alert refresh interval | 15 seconds | 60 seconds |
| Analysis range-switch calls with a fresh same-meter summary | 4 | 2 |

The initial shared JS reduction is about 9.4% uncompressed and 4.6% gzip. Splitting improves caching and eliminates the large-chunk warning; it does not mean a 64% improvement in real-world page load time.

For a continuously visible dashboard with fast successful responses, the configured steady-state request rate falls from approximately 16/minute to 10/minute with changing readings, or 7/minute with unchanged metadata. These are scheduling-derived rates verified with simulated timers, not production traffic measurements; initial loads, retries and tab returns add requests. Completion-based scheduling stretches the interval when the backend is slow.

Bounded response sizes require deployment of the optional backend limits. The currently deployed older backend may ignore these query parameters and still return full histories; frontend rendering and polling improvements work independently. No production latency, Android CPU/battery or physical sensor benchmark was claimed.

## Validation

- Production build passed with no large-bundle warning.
- 15 frontend tests passed: data formatting/localization, default meter selection, API paths/token refresh/proxy behavior, polling overlap/visibility/offline/timeout/cleanup, stale states, deferred messaging registration/unsubscribe and existing push-worker behavior.
- 41 backend tests passed, including limit ordering/default compatibility, validation, ownership checks, existing sensor ingestion/aggregation and notification/deduplication regressions. They ran in a newly created temporary local PostgreSQL database, which was removed afterward. Application records and schema were untouched. Firebase delivery was mocked.
- Browser suite passed 63 screen/viewport combinations plus 36 language layouts (99 total), 12 empty/error states and 17 interaction flows, with zero page errors. Widths: 320, 360, 390, 430, 768, 1440 and 844×390 landscape. Simulated telemetry verifies automatic updates, skipped unchanged reads, limited requests, hidden-tab pause/resume, summary failure isolation and polling cleanup.
- Production-bundle Chrome smoke tests loaded login and signup with no page errors; messaging was not requested before use. External requests were blocked.
- Screenshots were reviewed for mobile/desktop layout and chart readability. Fixtures are test-only and were not written to the application's database.
- Existing backend dependency deprecation warnings remain (Starlette/httpx and Firebase's message token property). No dependency upgrades were bundled into this task.
- No real Android delivery, live Firebase login or physical meter test was performed.

## Files changed in this task

- `backend/app/routes/readings.py`, `backend/tests/test_reading_limits.py` — optional limits and regression coverage.
- `frontend/src/api.js` — cancellation options and bounded-reading queries; existing LAN proxy behavior retained.
- `frontend/src/hooks/useDashboardData.js`, `frontend/src/utils/polling.js`, `frontend/src/utils/meterStatus.js` — polling, staged loads and freshness logic.
- `frontend/src/components/HomeDashboard.jsx`, `EnergyChart.jsx`, `Devices.jsx` — live-reading display, chart performance and truthful status.
- `frontend/src/components/Analysis.jsx`, `History.jsx`, `Insights.jsx`, `Alerts.jsx`, `frontend/src/hooks/useMeter.js` — request bounds, cancellation and range-switch reuse.
- `frontend/src/firebase.js`, `frontend/src/notifications.js`, `frontend/vite.config.js` — deferred messaging and production chunking. Firebase project settings and dev proxy/CORS behavior remain unchanged.
- `frontend/src/index.css`, `frontend/src/utils/translate.js`, `frontend/src/utils/uiTranslations.js` — Android polish, stable translation callbacks and four-language state messages.
- `frontend/tests/browser-ui.cjs`, `frontend/tests/polling.test.js`, `frontend/tests/push-lazy.test.js` — browser lifecycle and notification regressions.
- `PERFORMANCE_POLISH.md` — this report.

## Manual Android checklist and later deployment

1. After approval, commit reviewed changes without `.env`, credentials or checkpoint files. Deploy the backward-compatible Render GET limits first, then the Vercel frontend. No new environment variables, CORS changes or schema migrations are needed.
2. Sign in on the HTTPS site and connect a real provisioned meter. Confirm the displayed timestamp/value matches a real upload and updates after the next poll without reloading.
3. Stop uploads for over two minutes. Confirm stale telemetry is labeled and the timestamp is not replaced with the current time. Check the meter connection before assuming hardware failure.
4. Minimize Chrome, return, and toggle network connectivity. Confirm refresh resumes without duplicate requests or a blank dashboard; old readings must remain labeled when refresh fails.
5. Test narrow screens, landscape, all four languages, charts, form keyboard, dialogs and bottom navigation on the actual phone.
6. Enable push over HTTPS using the existing public VAPID configuration. Confirm a test notification and an actual threshold alert appear in Android's system panel when locked/backgrounded, with no duplicate notification and correct tap navigation. FCM acceptance alone is not proof of device delivery.

Nothing has been pushed or deployed. The LAN preview remains available, but HTTP on a LAN IP still cannot provide FCM/service-worker background notifications; use HTTPS for that check.
