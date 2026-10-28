import { auth } from './firebase'

// Development requests stay on the page's origin. Vite forwards them to
// VITE_API_BASE_URL, so a phone never tries to reach its own loopback address.
// Production continues to call the configured HTTPS backend directly.
const API_BASE_URL = (import.meta.env.DEV ? '/api' :
  (import.meta.env.VITE_API_BASE_URL?.trim() || 'https://electricity-proj.onrender.com')).replace(/\/+$/, '')

async function apiRequest(path, options = {}) {
  const user = auth.currentUser
  const requestWithToken = async (token) => fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  let token = user ? await user.getIdToken() : null
  let response = await requestWithToken(token)

  // Firebase can restore an expired token from local storage during page
  // startup. Retry a rejected authenticated request once with a forced
  // refresh before reporting an error to the caller.
  if (response.status === 401 && user) {
    token = await user.getIdToken(true)
    response = await requestWithToken(token)
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Something went wrong')
  }

  return response.json()
}

export function syncUser() {
  return apiRequest('/users/me')
}

export function addDevice(deviceData) {
  return apiRequest('/devices/', {
    method: 'POST',
    body: JSON.stringify(deviceData),
  })
}

export function getDevices(options = {}) {
  return apiRequest('/devices/', options)
}

export function provisionDeviceToken(deviceId) {
  return apiRequest(`/devices/${deviceId}/provision-token`, { method: 'POST' })
}

export function createDemoData() {
  return apiRequest('/devices/demo-data', { method: 'POST' })
}

export function getReadings(deviceId, { limit, ...options } = {}) {
  return apiRequest(`/devices/${deviceId}/readings/${limit ? `?limit=${limit}` : ''}`, options)
}

export function getDailyUsage(deviceId, { limit, ...options } = {}) {
  return apiRequest(`/devices/${deviceId}/readings/daily${limit ? `?limit=${limit}` : ''}`, options)
}

export function getMonthlyUsage(deviceId) {
  return apiRequest(`/devices/${deviceId}/readings/monthly`)
}

export async function getPredictions(deviceId, range = '7D', options = {}) {
  return apiRequest(`/devices/${deviceId}/readings/predictions?range=${range}`, options)
}

export function getUsageAnomaly(deviceId, options = {}) {
  return apiRequest(`/devices/${deviceId}/readings/anomaly`, options)
}

export async function getUsageSummary(deviceId, range, options = {}) {
  return apiRequest(`/devices/${deviceId}/readings/summary?range=${range}`, options)
}

export function getAlerts(options = {}) {
  return apiRequest('/users/me/alerts', options)
}

export function updateUserProfile(userData) {
  return apiRequest('/users/me', {
    method: 'PUT',
    body: JSON.stringify(userData),
  })
}

export function registerDeviceToken(fcmToken) {
  return apiRequest('/users/me/device-token', {
    method: 'POST',
    body: JSON.stringify({ fcm_token: fcmToken }),
  })
}

export function unregisterDeviceToken(token) {
  return apiRequest('/users/me/device-token', {
    method: 'DELETE', body: JSON.stringify({ fcm_token: token }),
  })
}

export function sendPushTest() {
  return apiRequest('/users/me/push-test', { method: 'POST' })
}
