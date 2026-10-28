import { test } from "node:test";
import assert from "node:assert/strict";
import { startVisiblePolling } from "../src/utils/polling.js";
import { meterStatus } from "../src/utils/meterStatus.js";

function fakeEnvironment() {
  const document = new EventTarget(),
    window = new EventTarget();
  document.hidden = false;
  const timers = new Map();
  let now = 0,
    id = 0;
  const environment = {
    document,
    window,
    navigator: { onLine: true },
    setTimeout(fn, delay) {
      timers.set(++id, { fn, at: now + delay });
      return id;
    },
    clearTimeout(key) {
      timers.delete(key);
    },
  };
  return {
    environment,
    timers,
    async tick(ms) {
      now += ms;
      for (const [key, value] of [...timers])
        if (value.at <= now) {
          timers.delete(key);
          value.fn();
        }
      for (let i = 0; i < 8; i++) await Promise.resolve();
    },
  };
}

test("polling never overlaps and pauses/resumes with visibility and connectivity", async () => {
  const fake = fakeEnvironment(),
    env = fake.environment;
  let calls = 0,
    finish;
  const poll = startVisiblePolling(
    () => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    { environment: env, intervalMs: 15, timeoutMs: 1000 },
  );
  await fake.tick(50);
  assert.equal(calls, 1);
  finish();
  await fake.tick(0);
  env.document.hidden = true;
  env.document.dispatchEvent(new Event("visibilitychange"));
  await fake.tick(500);
  assert.equal(calls, 1);
  env.document.hidden = false;
  env.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 2);
  finish();
  await fake.tick(0);
  env.navigator.onLine = false;
  env.window.dispatchEvent(new Event("offline"));
  await fake.tick(500);
  assert.equal(calls, 2);
  env.navigator.onLine = true;
  env.window.dispatchEvent(new Event("online"));
  assert.equal(calls, 3);
  finish();
  await fake.tick(0);
  poll.stop();
  await fake.tick(500);
  env.window.dispatchEvent(new Event("online"));
  assert.equal(calls, 3);
  assert.equal(fake.timers.size, 0);
});

test("timeouts abort requests, report a failure, and back off before retry", async () => {
  const fake = fakeEnvironment();
  let failures = 0,
    calls = 0;
  const poll = startVisiblePolling(
    (signal) => {
      calls++;
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason)),
      );
    },
    {
      environment: fake.environment,
      intervalMs: 15,
      timeoutMs: 20,
      onError: () => failures++,
    },
  );
  await fake.tick(20);
  assert.equal(failures, 1);
  await fake.tick(29);
  assert.equal(calls, 1);
  await fake.tick(1);
  assert.equal(calls, 2);
  poll.stop();
  await fake.tick(100);
  assert.equal(failures, 1);
  assert.equal(fake.timers.size, 0);
});

test("an old reading never proves connection; stale and disconnected states differ", () => {
  const now = Date.parse("2026-10-28T10:00:00Z");
  const device = { status: "online", last_seen: "2026-10-28T10:00:00Z" };
  assert.equal(
    meterStatus(device, { recorded_at: "2026-10-28T09:59:50Z" }, now),
    "connected",
  );
  assert.equal(
    meterStatus(device, { recorded_at: "2026-10-28T09:00:00Z" }, now),
    "staleReadings",
  );
  assert.equal(
    meterStatus({ ...device, status: "offline" }, null, now),
    "disconnected",
  );
  assert.equal(
    meterStatus({ ...device, last_seen: null }, null, now),
    "unknown",
  );
  assert.equal(
    meterStatus(device, { recorded_at: "2026-10-29T09:00:00Z" }, now),
    "unknown",
  );
  assert.equal(meterStatus(null, null, now), "noDeviceFound");
});
