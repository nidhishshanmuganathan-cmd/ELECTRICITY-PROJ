# Phone saving repair

## Findings

The original path was `PushSetup` / `Profile` → `updateUserProfile` → authenticated
`PUT /users/me` → PostgreSQL `users.phone`. It already used the Firebase ID token
in the Authorization header, refreshed once after HTTP 401, and selected the
database row using the verified token's UID. `AuthContext` reloads the profile
using `GET /users/me` when Firebase restores a session.

Reproduced defects in an isolated PostgreSQL database:

- The database phone column is unique. Saving an existing number raised an
  unhandled integrity exception and returned HTTP 500. The UI replaced the
  actual reason with a generic save error.
- The request accepted 30 characters but the database column permits 20.
  A valid number containing enough formatting characters caused HTTP 500.
- No Indian mobile validation or normalization existed, so invalid inputs were
  stored successfully and equivalent formats were stored inconsistently.
- The backend ignored an explicit `null` phone, so clearing a saved number
  retained the old value while reporting success.

Nine of the initial 14 regression cases failed before the fix. A normal unused
number already saved successfully in the old implementation. The user's exact
failed production request was not available; these are reproduced code defects,
not a claim about which exception occurred in that live account.

## Changes

| File | Change |
| --- | --- |
| `backend/app/routes/users.py` | Validate Indian mobile numbers; normalize accepted values to +91 plus ten digits; distinguish omitted phone from explicit clearing; roll back failed writes; return safe 409/503 errors without database exception details. |
| `frontend/src/api.js` | Preserve HTTP status and invalid field names for error handling; do not copy validation input values into errors. |
| `frontend/src/utils/phone.js` | Shared validation, backend-response confirmation and translated error selection. |
| `frontend/src/components/PushSetup.jsx` | Validate and normalize before saving; guard repeat submissions; show confirmation only after a matching backend response; display clear errors. |
| `frontend/src/components/Profile.jsx` | Apply the same validation and confirmation to profile updates and clearing; remove stale success messages when reopening the form. |
| `frontend/src/utils/uiTranslations.js` | English input, conflict, session, network and confirmation messages. |
| `frontend/src/utils/uiHelpTranslations.js` | Corresponding Hindi, Tamil and Telugu messages. |
| `backend/tests/test_user_phone.py` | Persistence, reload, update, clear, invalid input, formatting, duplicate rollback, new account creation, token validation, cross-user protection and database failure regressions. |
| `frontend/tests/phone.test.js` | Validation, confirmation, failure mapping, API payload and Firebase header regressions. |
| `frontend/tests/browser-phone.cjs` | Actual React components, AuthContext and API client with mocked Firebase identity/HTTP; save, pending state, reload, update, clear and five failure states. |
| `frontend/tests/browser-ui.cjs` | Replace its invalid synthetic phone fixture with a syntactically valid test-only Indian number. |
| `PHONE_SAVE_FIX.md` | Findings, verification and release notes. |

Accepted input is a ten-digit mobile number beginning with 6–9, optionally
prefixed with +91 or 91. Spaces, parentheses and hyphens are removed. Input is
limited to 30 characters and stored as 13 characters. This validates formatting;
it does not verify ownership through OTP. Empty profile input clears the phone;
the setup form still requires a number.

The existing unique constraint remains. Existing stored values are not rewritten
or migrated. Updates select only the authenticated UID; body-supplied user IDs
cannot select another account. There are no SMS sends, opt-ins, FCM changes,
notification permission requests or phone-number logs introduced by saving.

## Verification

- Backend: 57 tests passed (including 16 phone regressions). The suite used a new
  temporary local PostgreSQL database; only that test database was removed.
  Existing application records were untouched. Five existing deprecation warnings
  concern Starlette/httpx and Firebase Message.token.
- Frontend Node tests: 19 passed, including existing token-refresh, proxy,
  polling and push/service-worker regressions.
- Dedicated mobile-width Chrome phone regression: passed with zero browser
  errors and zero push-enable/disable calls. Pending and failed responses never
  showed success. Reload used the real AuthContext and API client.
- `npm run build`: passed.
- Existing browser suite: 63 viewport/route layouts, 12 empty/error states and
  17 functional flows passed with zero page errors, including profile editing,
  authentication, push controls and polling.
- Changed-file secret scan found no private keys, credential files or secrets;
  `.env` and service-account paths remain Git-ignored.

Browser HTTP responses and Firebase identities were mocked. Real authenticated
production saving and physical Android testing remain to be checked after an
approved deployment. No Firebase credentials or live user tokens were inspected.

## Initial verification status

At initial verification, changes were uncommitted on `ui-redesign` and had not
been pushed or deployed. The subsequent release is tracked in Git and the
hosting providers' deployment records.
No database migration or environment-variable change is required. To apply the
complete fix publicly, deploy the backend to Render and frontend to Vercel after
approval, then save/update a number and sign in again to confirm persistence.
A local frontend that proxies to Render still uses the currently deployed backend
until that backend is updated.
