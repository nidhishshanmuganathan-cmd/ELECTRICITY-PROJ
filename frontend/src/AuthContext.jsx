import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import { syncUser } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const updateAppUser = (updatedData) => {
    setUser(prev => prev ? { ...prev, appUser: { ...prev.appUser, ...updatedData } } : null)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Attempt to sync user from backend
          const appUser = await syncUser()

          setUser({
            firebaseUser: currentUser,
            appUser: appUser,
          })
        } catch (error) {
          console.warn('Backend sync non-critical error:', error)

          // CRITICAL FIX: Do NOT throw an error here.
          // If backend sync fails, we still let the user in using Firebase data.
          // This prevents the "API Error" during sign-in.
          setUser({
            firebaseUser: currentUser,
            appUser: {
              full_name: currentUser.displayName || 'New User',
              email: currentUser.email || '',
              phone: null,
              address: null,
            },
          })
        }
      } else {
        setUser(null)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, updateAppUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}