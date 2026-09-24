/* WattWatcher background push handler (Firebase Cloud Messaging).
 * Served from the site root so it controls the whole app scope.
 * Displays incoming alert notifications while the app is in the background.
 * Uses the Firebase compat SDK (pinned to the installed v12.18.0).
 */
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
  const title = (payload.notification && payload.notification.title) || 'WattWatcher'
  const options = {
    body: (payload.notification && payload.notification.body) || 'You have a new energy alert.',
    data: (payload && payload.data) || {},
  }
  self.registration.showNotification(title, options)
})
