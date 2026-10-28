import { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider, useAuth } from './AuthContext'
import { ensureForegroundListener } from './notifications'

import SignIn from './components/SignIn'
import CreateAccount from './components/CreateAccount'
import HomeDashboard from './components/HomeDashboard'
import Analysis from './components/Analysis'
import Insights from './components/Insights'
import History from './components/History'
import Profile from './components/Profile'
import Devices from './components/Devices'
import PushSetup from './components/PushSetup'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading WattWatcher...</div>
  }

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  return <><PushSetup />{children}</>
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Loading WattWatcher...</div>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return children
}

function PushRegistration() {
  const { user } = useAuth()

  useEffect(() => {
    if (user?.firebaseUser) {
      ensureForegroundListener()
    }
  }, [user?.firebaseUser])

  return null
}

export default function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => {})
    }
  }, [])
  const [pushMessage, setPushMessage] = useState(null)

  useEffect(() => {
    const showPushMessage = (event) => {
      setPushMessage(event.detail)
    }

    window.addEventListener('wattwatcher:push', showPushMessage)
    return () => {
      window.removeEventListener('wattwatcher:push', showPushMessage)
    }
  }, [])

  useEffect(() => {
    const handleThemeChange = () => {
      const isLight = localStorage.getItem('wattwatcher_theme') === 'light'

      if (isLight) {
        document.body.classList.add('light-theme')
      } else {
        document.body.classList.remove('light-theme')
      }
    }

    handleThemeChange()

    window.addEventListener('themeChange', handleThemeChange)

    return () => {
      window.removeEventListener('themeChange', handleThemeChange)
    }
  }, [])

  return (
    <AuthProvider>
      <PushRegistration />
      <Router>
        {pushMessage && (
          <div className="fixed left-4 right-4 top-4 z-[100] mx-auto max-w-[420px] rounded-xl border border-electric/40 bg-dark-800 p-4 shadow-2xl">
            <p className="text-sm font-semibold text-white">{pushMessage.title}</p>
            <p className="mt-1 text-xs text-gray-300">{pushMessage.body}</p>
            <button
              onClick={() => setPushMessage(null)}
              className="mt-2 text-xs font-medium text-electric"
            >
              Dismiss
            </button>
          </div>
        )}
        <Routes>

          {/* Login pages */}
          <Route
            path="/signin"
            element={
              <PublicRoute>
                <SignIn />
              </PublicRoute>
            }
          />

          <Route
            path="/create-account"
            element={
              <PublicRoute>
                <CreateAccount />
              </PublicRoute>
            }
          />

          {/* Protected pages */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomeDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/analysis"
            element={
              <ProtectedRoute>
                <Analysis />
              </ProtectedRoute>
            }
          />

          <Route
            path="/insights"
            element={
              <ProtectedRoute>
                <Insights />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/devices"
            element={
              <ProtectedRoute>
                <Devices />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
    </AuthProvider>
  )
}
