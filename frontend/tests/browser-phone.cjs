/* Local browser regression: real components/AuthContext/API, mocked Firebase
 * identity and HTTP backend. Never contacts production or sends notifications. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let profile = { id: 'test-user', full_name: 'Phone test', email: 'phone-test@example.com',
      phone: null, address: null, monthly_limit: 500 };
    let mode = 'ok', putCount = 0, pushCalls = 0, release;
    const errors = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1') return route.abort();
      let body;
      if (url.pathname === '/src/firebase.js') body = `export const auth={currentUser:{uid:'test-user',email:'phone-test@example.com',getIdToken:async()=> 'TEST-ONLY-ID-TOKEN'}}; export async function getMessagingInstance(){return null}`;
      else if (url.pathname.endsWith('/firebase_auth.js')) body = `
        export function onAuthStateChanged(auth,callback){window.__testAuth=callback;queueMicrotask(()=>callback(auth.currentUser));return()=>{}};
        export async function signOut(){};`;
      else if (url.pathname === '/src/notifications.js') body = `
        export const pushEnabled=()=>false;
        export async function ensureForegroundListener(){};
        export async function enablePushNotifications(){await fetch('/test-push');return {ok:true}};
        export async function disablePushNotifications(){await fetch('/test-push')};`;
      else if (url.pathname === '/test-push') {
        pushCalls++;
        return route.fulfill({ status: 200, body: '{}' });
      } else if (url.pathname.startsWith('/api/')) {
        assert.equal(route.request().headers().authorization, 'Bearer TEST-ONLY-ID-TOKEN');
        assert.equal(url.pathname, '/api/users/me');
        if (route.request().method() === 'PUT') {
          putCount++;
          if (mode === 'network') return route.abort();
          if (mode === 'pending') await new Promise(resolve => { release = resolve; });
          if (mode === 'conflict') return route.fulfill({ status: 409, json: { detail: 'This phone number cannot be used for this account.' } });
          if (mode === 'expired') return route.fulfill({ status: 401, json: { detail: 'Invalid or expired authentication token' } });
          if (mode === 'server') return route.fulfill({ status: 503, json: { detail: 'Could not save your profile. Please try again.' } });
          if (mode === 'unconfirmed') return route.fulfill({ status: 200, json: { ...profile, phone: null } });
          profile = { ...profile, ...route.request().postDataJSON() };
        }
        return route.fulfill({ status: 200, json: profile });
      }
      return body !== undefined ? route.fulfill({ contentType: 'application/javascript', body }) : route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/profile');
    const setup = page.locator('.push-setup');
    await setup.locator('summary').click();
    await setup.getByLabel('Phone', { exact: true }).fill('1234567890');
    await setup.getByRole('button', { name: 'Save phone number', exact: true }).click();
    await setup.getByText('Enter a valid 10-digit Indian mobile number, with or without +91.').waitFor();
    assert.equal(putCount, 0);

    mode = 'pending';
    await setup.getByLabel('Phone', { exact: true }).fill('+91 (60000) 00000');
    await setup.getByRole('button', { name: 'Save phone number', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.push-setup button')?.disabled);
    assert.equal(await setup.getByText('Phone saved.', { exact: false }).count(), 0);
    while (!release) await new Promise(resolve => setTimeout(resolve, 10));
    release();
    await setup.getByText('Phone saved.', { exact: false }).waitFor();
    assert.equal(profile.phone, '+916000000000');
    assert.equal(putCount, 1);
    assert.equal(pushCalls, 0);

    // Real AuthContext reloads the saved backend profile on a fresh sign-in.
    mode = 'ok';
    await page.reload();
    await page.getByRole('button', { name: /Personal information/ }).click();
    const dialog = page.getByRole('dialog');
    assert.equal(await dialog.getByLabel('Phone', { exact: true }).inputValue(), '+916000000000');
    const input = dialog.getByLabel('Phone', { exact: true });
    const save = dialog.getByRole('button', { name: 'Save changes', exact: true });
    await input.fill('+91 70000 00000');
    await save.click();
    await page.getByText('Your profile has been saved.').waitFor();
    assert.equal(profile.phone, '+917000000000');

    await page.getByRole('button', { name: /Personal information/ }).click();
    await input.fill('+91 80000 00000');
    for (const [failure, message] of [
      ['conflict', 'This phone number cannot be used for this account. Check the number and try again.'],
      ['expired', 'Your session could not be verified. Sign in again before saving.'],
      ['server', 'Could not save changes. Please try again.'],
      ['network', 'Could not reach the server. Check your connection and try again.'],
      ['unconfirmed', 'The server did not confirm saving your number. Please try again.'],
    ]) {
      mode = failure;
      await save.click();
      await dialog.getByText(message, { exact: true }).waitFor();
      assert.equal(await page.getByText('Your profile has been saved.').count(), 0);
      assert.equal(profile.phone, '+917000000000');
    }
    mode = 'ok';
    await input.fill('');
    await save.click();
    await page.getByText('Your profile has been saved.').waitFor();
    assert.equal(profile.phone, null);
    assert.equal(pushCalls, 0);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    console.log('Phone browser regression passed: save, pending confirmation, reload, update, clear, invalid input, five failure states; no notification calls or browser errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
