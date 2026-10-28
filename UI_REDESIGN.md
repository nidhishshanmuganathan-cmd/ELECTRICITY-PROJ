# WattWatcher interface redesign

## Phase 1: architecture and screen inventory (before code changes)

React 19 + Vite 6, Tailwind 3, Lucide React, React Router 7, Firebase 12. No chart or animation packages. Inter is already loaded by index.html. App.jsx owns routes, theme events, push toast and service-worker registration. AuthContext combines Firebase auth state with `/users/me`; api.js forwards and refreshes Firebase ID tokens. Translation and energy-unit hooks use localStorage plus change events; English, Hindi, Tamil and Telugu are supported. Each existing screen renders a narrow 420px layout and imports navigation from HomeDashboard.

| Existing route | Screen and behavior to preserve |
| --- | --- |
| `/` | Home: device/readings polling, alerts, sample-data creation, meter link |
| `/history` | Daily usage records from the first meter |
| `/analysis` | 24H/7D/30D/90D usage totals and forecast calls |
| `/insights` | Summary, predictions, anomaly detection and recommendations |
| `/devices` | Register meter, provision/copy upload token, list meters |
| `/profile` | Profile editing, limits, push enable/disable/test, theme, language, units, logout |
| `/signin` | Firebase Google popup, email/password, password reset |
| `/create-account` | Firebase email/password signup, display name, Google popup, backend sync |

Alerts currently live in the dashboard; there is no persisted notification inbox, timestamped alert history, unread API or tariff configuration. Device responses include status and last_seen; sample meters are identified by the backend's DEMO- code convention (firmware is not returned by DeviceOut). Summary/prediction endpoints support existing ranges; forecasts are seven daily values, not guaranteed month-end predictions. No confidence interval is supplied. Existing production FCM service worker displays background notifications; notification helpers and server-side triggers must be preserved.

Visible issues: phone-width layouts on desktop; no shared page shell; unlabeled icon controls; modal focus not managed; missing translation keys render raw identifiers; placeholder carbon and comparison values; hardcoded gauge fraction and cost rate; period totals incorrectly compared to monthly budget; invented weekday chart labels and savings amounts. Existing CSS relies on broad light-theme overrides and expensive glass blur.

## Implementation plan

1. Shared navy/cyan design tokens, responsive desktop sidebar/mobile bottom navigation, page headers, cards, skeletons, accessible dialogs and responsive SVG charts. Retain Lucide and CSS animation; add no runtime dependency.
2. Home: real monthly gauge, daily rollups, meter status, summary cards and working quick actions. Explicit demo/empty/error states; no unsupported cost or carbon statistics.
3. History/analytics: real dates and units, keyboard/touch chart selection, period controls and meter selection. Keep current API calls; distinguish measured daily energy from seven-day forecast.
4. AI coach and alert center: measured/forecast/rule-based recommendations labeled clearly; preserve dashboard alerts and add an accessible destination using the existing alerts endpoint.
5. Devices, authentication, profile/settings: reuse existing API/auth/push handlers, improve layout/forms/accessibility, preserve provisioning and preferences.
6. Validate production build, existing worker tests, data formatting/localization checks, and browser responsive checks when local browser tooling is available. No backend changes, pushes or deployments.

## Protected boundaries

Do not modify api.js, AuthContext.jsx, firebase.js, notifications.js, firebase-messaging-sw.js, backend files, credentials, environment settings or PWA manifest. Keep the existing application and user journeys; only adapt presentation and correct misleading display calculations. No fake readings in production. Test-only fixtures, if used for browser checks, are isolated from application source.

## Completed interface

- Midnight-navy surfaces, restrained blue/cyan accents, violet AI panels, consistent typography, rounded cards, statuses, form controls and touch targets. The existing light theme remains supported through semantic tokens.
- Responsive shared desktop sidebar and five-destination mobile navigation. All eight original routes remain accessible. `/alerts` is an additional presentation of the existing alert API, not a new backend or invented inbox.
- Real aggregate monthly gauge, first-meter daily energy/power context, real percentages, demo badges, quick actions, forecasts, cost-unavailable state and sample-data loading. Removed placeholder carbon, fixed gauge fill, fake price/savings and comparison numbers.
- History uses calendar date filters and real dates with no invented zero-fill. Analysis keeps all four existing API ranges, explicitly labels the endpoint's latest-record semantics, and compares monthly budget only with aggregate monthly data. Charts support pointer/touch/keyboard exploration, measured/forecast legends and correct kW/kWh/MWh conversions.
- AI coach preserves forecast/anomaly calls, labels uncertainty and risk-based advice, and does not present anomaly scores as confidence percentages. Insufficient data has a real empty state.
- Device registration/provisioning/copy flow preserved; failed provisioning can be retried without creating a duplicate device. Registration does not imply hardware connectivity. Device status/last-seen values come from the API.
- Sign-in/signup use the original Firebase handlers. Added labeled inputs, autocomplete, password-toggle labels, clear error associations and a split desktop authentication layout.
- Profile preserves profile/limit edits, units/language/theme preferences, sign-out and all push controls. Dialogs support Escape, focus trapping/restoration and viewport scrolling. Save failures are visible.
- Existing English/Hindi/Tamil/Telugu dictionaries preserved; all new interface/help keys have entries in all four languages. Backend/Firebase error messages retain their original meaning and may remain English.
- Lazy-loaded screen bundles, CSS-only restrained animation, reduced-motion support, safe-area spacing and viewport-fit support. No new runtime dependencies.

## Changed files

Existing files:

- `frontend/index.html`: viewport-fit only; manifest and icon links preserved.
- `frontend/tailwind.config.js`, `frontend/src/index.css`: palette and reusable layout/control styling.
- `frontend/src/App.jsx`: shared shell, lazy route loading, language metadata, alert route and accessible push toast; registration effects preserved.
- `frontend/src/components/HomeDashboard.jsx`, `History.jsx`, `Analysis.jsx`, `Insights.jsx`, `Devices.jsx`, `SignIn.jsx`, `CreateAccount.jsx`, `Profile.jsx`, `PushSetup.jsx`: screen presentations and display correctness described above.
- `frontend/src/utils/translate.js`: merge additional dictionaries with the existing translation fallback.

New files:

- `frontend/src/components/ui.jsx`: shared shell, navigation, cards, gauge, forms, auth layout and accessible dialog.
- `frontend/src/components/EnergyChart.jsx`, `Alerts.jsx`: reusable chart and alert center/summary.
- `frontend/src/hooks/useMeter.js`: shared device selection/loading.
- `frontend/src/utils/energy.js`, `uiTranslations.js`, `uiHelpTranslations.js`: data formatting and localization.
- `frontend/tests/energy-ui.test.js`, `browser-ui.cjs`: data/localization and isolated browser regression checks.
- `UI_REDESIGN.md`: audit, implementation and verification report.

## Verification

- Production build passes. Screens split into lazy chunks. The initial shared bundle is approximately 542 kB uncompressed / 141 kB gzip; Vite still warns about the shared chunk exceeding 500 kB. The Firebase integration was deliberately not restructured to silence this warning.
- Seven Node tests pass: energy-unit/missing-value handling, real-date ordering/gaps, demo detection, localization coverage, plus the three existing background-worker/display/click tests.
- Headless Chrome: nine routes at 320, 390, 768 and 1440 pixels, plus 844×390 landscape (45 layouts). All nine routes also checked at 320px in all four languages (36 additional cases). No horizontal document overflow or page errors.
- Twelve empty/error/no-reading screen checks pass. UI flow checks cover profile/limit saves, theme changes, modal keyboard handling, meter provisioning, meter/range selection, push enable/test/disable, logout, email and Google sign-in, signup validation/success, and password-reset invocation.
- Browser checks intercept only test traffic with isolated fixtures; production source contains no mocks. This proves UI wiring and rendering, not live authentication, real meter ingestion or FCM delivery.
- Desktop/mobile login, dashboard, insights and profile screenshots were inspected. Native-language translations should still receive fluent-speaker review.
- No type-checker or linter is configured in this JavaScript project. Backend tests were not rerun because no backend files changed. A Git diff confirms backend, API utility, AuthContext, Firebase initialization, notification service, service worker, manifest, package/lockfiles and Vite config are unchanged.
- Playwright and Prettier were installed only in a temporary QA folder; neither was added to application dependencies. The browser test accepts `PLAYWRIGHT_MODULE` and `UI_SCREENSHOT_DIR` environment variables and expects the local Vite server on port 5174.

## Remaining manual checks

1. On a real Android phone, sign in with Google and email/password; check signup, reset and logout with a test account. Check keyboard appearance, rotation, zoom, long names and native-language readability.
2. Confirm actual device readings, sample-data labels, history/range selection and aggregate monthly limit changes against the backend. Demo loading refreshes the sample meter's history, as before.
3. In Profile, confirm browser notification permission and token registration, then send a test. Verify actual system notification display while backgrounded and locked, and tap-to-open behavior. No Android delivery claim is made by this redesign.
4. Check installed PWA launch, icons and standalone navigation. The manifest and single FCM worker are unchanged; headless tests intentionally block workers and do not prove Android installability.
5. Test the light theme and all four languages, including screen-reader navigation and preference dialogs. There is no fabricated unread count or alert timestamp history.

## Deployment (only after approval)

Commit only the reviewed frontend/tests/documentation files, excluding .env and credentials. Push to the existing main branch and let Vercel rebuild with its existing environment settings and frontend root/build configuration. No Render deployment, new environment variables, database change or Firebase configuration change is required. Reopen the installed PWA after deployment and complete the device checks above. Nothing has been committed, pushed or deployed for this redesign.
