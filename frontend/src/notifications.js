import { getToken, onMessage } from 'firebase/messaging'
import { getMessagingInstance, VAPID_KEY } from './firebase'
import { registerDeviceToken } from './api'

/**
 * Enable browser push notifications for usage alerts.
 *
 * Flow: check support -> request permission -> register the messaging
 * service worker -> obtain the FCM registration token -> POST it to
 * the backend (/users/me/device-token), which stores it on the user row.
 *
 * Never throws: always resolves { ok, message?, token? } so callers can
 * update the toggle UI accordingly.
 */
let foregroundListenerAttached = false

function attachForegroundListener(messaging) {
  // Attach once per page load; permission is already granted at this point.
  if (foregroundListenerAttached) {
    return
  }
  foregroundListenerAttached = true
  console.log('[FCM] onMessage attached | permission=' + Notification.permission)
  onMessage(messaging, (payload) => {
    console.log('[FCM] onMessage FIRED', payload && payload.notification)
    const title = (payload.notification && payload.notification.title) || 'WattWatcher'
    const body = (payload.notification && payload.notification.body) || 'You have a new energy alert.'

    // Native banners can be suppressed by Windows Focus Assist or browser
    // settings. Always surface foreground messages inside the app as well.
    window.dispatchEvent(new CustomEvent('wattwatcher:push', {
      detail: { title, body },
    }))
    try {
      new Notification(title, { body })
    } catch (err) {
      console.error('Foreground notification display failed:', err)
    }
  })
}

/**
 * Attach the foreground onMessage listener for the current page session
 * when permission was already granted (e.g. after a reload, where the
 * toggle shows ON but enablePushNotifications() has not run yet).
 * Reuses the same singleton instance and once-per-load guard, so no
 * duplicate listeners are created. Never throws.
 */
export async function ensureForegroundListener() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }
  if (Notification.permission !== 'granted') {
    return false
  }
  try {
    const messaging = await getMessagingInstance()
    if (!messaging) {
      return false
    }
    let registration = null
    if ('serviceWorker' in navigator) {
      console.log('[FCM] registering service worker...')
      await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      console.log('[FCM] service worker registered, waiting for ready...')
      registration = await navigator.serviceWorker.ready
      console.log('[FCM] service worker ready | scope=' + registration.scope)
    }
    const token = await getToken(
      messaging,
      registration
        ? { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }
        : { vapidKey: VAPID_KEY },
    )
    // FCM registration tokens can change.  Refresh the server-side copy on
    // every authenticated reload, not only when the settings toggle is used.
    if (token) {
      await registerDeviceToken(token)
    }
    attachForegroundListener(messaging)
    return true
  } catch (err) {
    console.error('Foreground listener attach failed:', err)
    return false
  }
}

export async function enablePushNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, message: 'Notifications are not supported in this browser.' }
  }

  if (!VAPID_KEY) {
    return { ok: false, message: 'Push configuration is missing. Please contact support.' }
  }

  let permission = Notification.permission
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission()
    } catch (err) {
      console.error('Notification permission request failed:', err)
      return { ok: false, message: 'Notification permission request failed.' }
    }
  }

  if (permission === 'denied') {
    return { ok: false, message: 'Permission denied. Enable notifications in browser site settings to receive alerts.' }
  }

  if (permission !== 'granted') {
    return { ok: false, message: 'Notification permission was not granted.' }
  }

  try {
    const messaging = await getMessagingInstance()
    console.log('[FCM] enablePushNotifications | messaging=' + !!messaging)
    if (!messaging) {
      return { ok: false, message: 'Push messaging is not supported in this browser.' }
    }
    attachForegroundListener(messaging)

    let registration = null
    if ('serviceWorker' in navigator) {
      console.log('[FCM] registering service worker...')
      await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      console.log('[FCM] service worker registered, waiting for ready...')
      registration = await navigator.serviceWorker.ready
      console.log('[FCM] service worker ready | scope=' + registration.scope)
    }

    console.log('[FCM] calling getToken...')
    const token = await getToken(
      messaging,
      registration
        ? { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }
        : { vapidKey: VAPID_KEY },
    )
    console.log('[FCM] getToken returned | token=' + String(token || '').slice(0, 16) + ' | hasSW=' + !!registration)

    console.log('[FCM] token obtained | prefix=' + String(token || '').slice(0, 16))
    if (!token) {
      return { ok: false, message: 'Could not obtain a push token. Please try again.' }
    }

    await registerDeviceToken(token)
    return { ok: true, token }
  } catch (err) {
    console.error('Push registration failed:', err)
    return { ok: false, message: 'Push registration failed. Please try again.' }
  }
}
