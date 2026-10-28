import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import { createServer } from 'vite'
import configure from '../vite.config.js'

const source = await readFile(new URL('../src/api.js', import.meta.url), 'utf8')
const importClient = (dev, url) => import('data:text/javascript,' + encodeURIComponent(
  source.replace("import { auth } from './firebase'", 'const auth = globalThis.__previewTestAuth')
    .replaceAll('import.meta.env.DEV', JSON.stringify(dev))
    .replaceAll('import.meta.env.VITE_API_BASE_URL', JSON.stringify(url)),
))

test('development uses same-origin API and preserves Firebase refresh on 401', async () => {
  const previousFetch = globalThis.fetch
  const refreshed = [], requests = []
  globalThis.__previewTestAuth = { currentUser: { getIdToken: async (force = false) => {
    refreshed.push(force)
    return force ? 'TEST-ONLY-REFRESHED' : 'TEST-ONLY-INITIAL'
  } } }
  globalThis.fetch = async (url, options) => {
    requests.push({ url, authorization: options.headers.Authorization })
    return { status: requests.length === 1 ? 401 : 200, ok: requests.length !== 1, json: async () => [] }
  }
  try {
    const api = await importClient(true, 'https://electricity-proj.onrender.com')
    await api.getDevices()
    assert.deepEqual(refreshed, [false, true])
    assert.deepEqual(requests.map(r => r.url), ['/api/devices/', '/api/devices/'])
    assert.equal(requests[1].authorization, 'Bearer TEST-ONLY-REFRESHED')
  } finally {
    globalThis.fetch = previousFetch
    delete globalThis.__previewTestAuth
  }
})

test('production keeps direct backend URLs, including the existing fallback', async () => {
  const previousFetch = globalThis.fetch
  const requests = []
  globalThis.__previewTestAuth = { currentUser: null }
  globalThis.fetch = async url => {
    requests.push(url)
    return { status: 200, ok: true, json: async () => ({}) }
  }
  try {
    await (await importClient(false, '')).getAlerts()
    await (await importClient(false, 'https://api.example.test/')).getAlerts()
    assert.deepEqual(requests, [
      'https://electricity-proj.onrender.com/users/me/alerts',
      'https://api.example.test/users/me/alerts',
    ])
    assert.equal(configure({ command: 'build', mode: 'production' }).server, undefined)
  } finally {
    globalThis.fetch = previousFetch
    delete globalThis.__previewTestAuth
  }
})

test('Vite proxy preserves authenticated paths and upstream rejection without changing CORS', async () => {
  const received = []
  const upstream = http.createServer((req, res) => {
    received.push({ path: req.url, auth: req.headers.authorization, origin: req.headers.origin })
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ detail: 'Invalid or expired authentication token' }))
  })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  let vite
  try {
    const config = configure({ command: 'serve', mode: 'development' })
    const proxy = config.server.proxy['^/api(?:/|$)']
    assert.equal(proxy.secure, true)
    assert.equal(config.server.cors, undefined)
    proxy.target = `http://127.0.0.1:${upstream.address().port}`
    vite = await createServer({ ...config, configFile: false, logLevel: 'silent',
      server: { ...config.server, host: '127.0.0.1', port: 0, watch: null } })
    await vite.listen()
    for (const path of ['/devices/', '/users/me/alerts']) {
      const response = await fetch(`http://127.0.0.1:${vite.httpServer.address().port}/api${path}`, {
        headers: { Authorization: 'Bearer TEST-ONLY-TOKEN', Origin: 'http://192.168.1.5:5173' },
      })
      assert.equal(response.status, 401)
      assert.equal((await response.json()).detail, 'Invalid or expired authentication token')
    }
    assert.deepEqual(received.map(r => r.path), ['/devices/', '/users/me/alerts'])
    assert.ok(received.every(r => r.auth === 'Bearer TEST-ONLY-TOKEN'))
    assert.ok(received.every(r => r.origin === 'http://192.168.1.5:5173'))
  } finally {
    await vite?.close()
    await new Promise(resolve => upstream.close(resolve))
  }
})
