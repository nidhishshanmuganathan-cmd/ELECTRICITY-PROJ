/* WattWatcher background push handler (Firebase Cloud Messaging).
 * Served from the site root so it controls the whole app scope.
 * Displays incoming alert notifications while the app is in the background.
 * Uses the Firebase compat SDK (pinned to the installed v12.18.0).
 */
self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation()
  event.notification.close()
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (existing) return existing.focus()
    return self.clients.openWindow('/')
  })())
})
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyCRb_eZSnrHLx3WoeJDWD_iBdppkMMgksk",
  authDomain: "electric-ai-1f3a0.firebaseapp.com",
  projectId: "electric-ai-1f3a0",
  storageBucket: "electric-ai-1f3a0.firebasestorage.app",
  messagingSenderId: "815956393257",
  appId: "1:815956393257:web:afdcaeab6a05c53fe04b38"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  // FCM automatically displays notification payloads; do not display twice.
  if (payload.notification) return
  const title = (payload.notification && payload.notification.title) || 'WattWatcher'
  const options = {
    body: (payload.notification && payload.notification.body) || 'You have a new energy alert.',
    data: (payload && payload.data) || {},
  }
  return self.registration.showNotification(payload.data?.title || title, { ...options, body: payload.data?.body || options.body })
})
