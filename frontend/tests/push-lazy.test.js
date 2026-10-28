import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("deferred messaging keeps registration, one foreground listener and unsubscribe working", async () => {
  const source = (
    await readFile(new URL("../src/notifications.js", import.meta.url), "utf8")
  )
    .replace(/^import .*$/gm, "")
    .replaceAll(
      "import('firebase/messaging')",
      "Promise.resolve(globalThis.__pushSDK)",
    );
  const saved = Object.fromEntries(
    ["window", "navigator", "localStorage", "Notification"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  let listeners = 0,
    registered = 0,
    removed = 0,
    deleted = 0;
  const storage = new Map();
  const values = {
    window: {
      isSecureContext: true,
      Notification: {},
      matchMedia: () => ({ matches: true }),
    },
    navigator: {
      userAgent: "Test desktop",
      platform: "",
      serviceWorker: {
        register: async () => ({ scope: "test-scope" }),
        ready: Promise.resolve({ scope: "test-scope" }),
      },
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    Notification: { permission: "granted" },
  };
  globalThis.__pushSDK = {
    onMessage: () => {
      listeners++;
    },
    getToken: async () => "TEST-ONLY-PUSH",
    deleteToken: async () => {
      deleted++;
    },
  };
  globalThis.__pushContext = {
    getMessagingInstance: async () => ({}),
    VAPID_KEY: "TEST-ONLY-PUBLIC",
    auth: { currentUser: { uid: "test-user" } },
    registerDeviceToken: async () => {
      registered++;
    },
    unregisterDeviceToken: async () => {
      removed++;
    },
  };
  try {
    for (const [key, value] of Object.entries(values))
      Object.defineProperty(globalThis, key, { configurable: true, value });
    const mod = await import(
      "data:text/javascript," +
        encodeURIComponent(
          "const {getMessagingInstance,VAPID_KEY,auth,registerDeviceToken,unregisterDeviceToken} = globalThis.__pushContext;\n" +
            source,
        )
    );
    assert.equal((await mod.enablePushNotifications()).ok, true);
    assert.equal(mod.pushEnabled(), true);
    assert.deepEqual(
      await Promise.all([
        mod.ensureForegroundListener(),
        mod.ensureForegroundListener(),
      ]),
      [true, true],
    );
    assert.equal(listeners, 1);
    assert.equal(registered, 3); // Enable plus both existing refresh calls update the server token.
    await mod.disablePushNotifications();
    assert.equal(removed, 1);
    assert.equal(deleted, 1);
    assert.equal(mod.pushEnabled(), false);
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
    delete globalThis.__pushSDK;
    delete globalThis.__pushContext;
  }
});
