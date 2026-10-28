import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeIndianPhone, confirmSavedPhone, profileSaveError } from '../src/utils/phone.js';

test('Indian phone input accepts local and +91 formats and optional clearing', () => {
  for (const value of ['6000000000', '+916000000000', '916000000000', '+91 (60000) 00000', ' +91-60000-00000 ']) {
    assert.equal(normalizeIndianPhone(value), '+916000000000');
  }
  for (const value of ['', '   ']) assert.equal(normalizeIndianPhone(value), null);
  for (const value of ['', '1234567890', '+16000000000', '600000000', '+916000000000x', '++916000000000', '6'.repeat(31)]) {
    assert.throws(() => normalizeIndianPhone(value, { required: true }), { code: 'invalidPhone' });
  }
});

test('phone saving requires an explicit matching backend response', () => {
  confirmSavedPhone({ phone: '+916000000000' }, '+916000000000');
  confirmSavedPhone({ phone: null }, null);
  for (const response of [undefined, {}, { phone: null }, { phone: '+917000000000' }]) {
    assert.throws(() => confirmSavedPhone(response, '+916000000000'), { code: 'saveUnconfirmed' });
  }
});

test('phone failures distinguish invalid input, conflicts, expired sessions and network errors', () => {
  const t = key => key;
  assert.equal(profileSaveError({ code: 'invalidPhone' }, t), 'invalidPhone');
  assert.equal(profileSaveError({ status: 422, fields: ['phone'] }, t), 'invalidPhone');
  assert.equal(profileSaveError({ status: 422, fields: ['full_name'] }, t), 'saveFailed');
  assert.equal(profileSaveError({ status: 409, message: 'This phone number cannot be used for this account.' }, t), 'phoneConflict');
  assert.equal(profileSaveError({ status: 401 }, t), 'saveSignInAgain');
  assert.equal(profileSaveError({ status: 503 }, t), 'saveFailed');
  assert.equal(profileSaveError(new TypeError('Failed to fetch'), t), 'saveNetworkError');
});

test('profile API sends Firebase token, reloads saved data and exposes safe failure metadata', async () => {
  const source = await readFile(new URL('../src/api.js', import.meta.url), 'utf8');
  const oldFetch = globalThis.fetch;
  const calls = [];
  globalThis.__phoneAuth = { currentUser: { getIdToken: async () => 'TEST-ONLY-ID-TOKEN' } };
  let saved = null, fail = false;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (fail) return { ok: false, status: 422, json: async () => ({ detail: [{ loc: ['body', 'phone'], input: 'PRIVATE-INPUT' }] }) };
    if (options.method === 'PUT') saved = JSON.parse(options.body).phone;
    return { ok: true, status: 200, json: async () => ({ phone: saved }) };
  };
  try {
    const api = await import('data:text/javascript,' + encodeURIComponent(source
      .replace("import { auth } from './firebase'", 'const auth = globalThis.__phoneAuth')
      .replaceAll('import.meta.env.DEV', 'false')
      .replaceAll('import.meta.env.VITE_API_BASE_URL', "'https://api.example.test'")));
    await api.updateUserProfile({ phone: '+916000000000' });
    assert.equal((await api.syncUser()).phone, '+916000000000');
    assert.ok(calls.every(call => call.url === 'https://api.example.test/users/me'));
    assert.ok(calls.every(call => call.options.headers.Authorization === 'Bearer TEST-ONLY-ID-TOKEN'));
    assert.deepEqual(JSON.parse(calls[0].options.body), { phone: '+916000000000' });
    fail = true;
    await assert.rejects(api.updateUserProfile({ phone: 'invalid' }), error => {
      assert.equal(error.status, 422);
      assert.deepEqual(error.fields, ['phone']);
      assert.ok(!error.message.includes('PRIVATE-INPUT'));
      return true;
    });
  } finally {
    globalThis.fetch = oldFetch;
    delete globalThis.__phoneAuth;
  }
});
