import { auth } from './firebase'

// Keep local development zero-config while allowing a deployed frontend to
// point at its own API without a source-code change.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.PROD ? 'https://electricity-proj.onrender.com' : 'http://127.0.0.1:8000')).replace(/\/+$/, '')

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

export function getDevices() {
  return apiRequest('/devices/')
}

export function provisionDeviceToken(deviceId) {
  return apiRequest(`/devices/${deviceId}/provision-token`, { method: 'POST' })
}

export function createDemoData() {
  return apiRequest('/devices/demo-data', { method: 'POST' })
}

export function getReadings(deviceId) {
  return apiRequest(`/devices/${deviceId}/readings/`)
}

export function getDailyUsage(deviceId) {
  return apiRequest(`/devices/${deviceId}/readings/daily`)
}

export function getMonthlyUsage(deviceId) {
  return apiRequest(`/devices/${deviceId}/readings/monthly`)
}

export async function getPredictions(deviceId, range = '7D') {
  return apiRequest(`/devices/${deviceId}/readings/predictions?range=${range}`)
}

export function getUsageAnomaly(deviceId) {
  return apiRequest(`/devices/${deviceId}/readings/anomaly`)
}

export async function getUsageSummary(deviceId, range) {
  return apiRequest(`/devices/${deviceId}/readings/summary?range=${range}`)
}

export function getAlerts() {
  return apiRequest('/users/me/alerts')
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
