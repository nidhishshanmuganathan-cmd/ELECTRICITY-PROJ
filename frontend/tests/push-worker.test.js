import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function worker(windows = []) {
  const events = {}, displayed = [], opened = []
  let background
  const self = {
    location: { origin: 'https://electricity-proj.vercel.app' },
    addEventListener: (name, callback) => { events[name] = callback },
    registration: { showNotification: async (...args) => { displayed.push(args) } },
    clients: { matchAll: async () => windows, openWindow: async url => opened.push(url), claim: async () => {} },
    skipWaiting: async () => {},
  }
  vm.runInNewContext(readFileSync(new URL('../public/firebase-messaging-sw.js', import.meta.url), 'utf8'), {
    self, URL, importScripts() {}, firebase: {
      initializeApp() {}, messaging: () => ({ onBackgroundMessage: callback => { background = callback } }),
    },
  })
  return { events, displayed, opened, background: payload => background(payload) }
}

test('FCM display payload is not displayed a second time', async () => {
  const w = worker()
  await w.background({ notification: { title: 'Energy' } })
  assert.equal(w.displayed.length, 0)
})

test('data-only fallback displays a tagged system notification', async () => {
  const w = worker()
  await w.background({ data: { title: 'Limit exceeded', body: '500 kWh', notification_tag: 'month-alert' } })
  assert.equal(w.displayed.length, 1)
  assert.equal(w.displayed[0][0], 'Limit exceeded')
  assert.equal(w.displayed[0][1].tag, 'month-alert')
})

test('tap opens app or focuses its existing window', async () => {
  for (const existing of [false, true]) {
    let focused = false, pending
    const w = worker(existing ? [{ url: 'https://electricity-proj.vercel.app/', focus: async () => { focused = true } }] : [])
    w.events.notificationclick({ stopImmediatePropagation() {}, notification: { close() {} }, waitUntil(promise) { pending = promise } })
    await pending
    assert.equal(focused, existing)
    assert.equal(w.opened.length, existing ? 0 : 1)
    if (!existing) assert.equal(w.opened[0], '/')
  }
})
