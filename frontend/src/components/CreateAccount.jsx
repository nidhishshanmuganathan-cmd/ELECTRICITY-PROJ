import { useState } from 'react'
import { Zap, Mail, Eye, EyeOff, User, Lock } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth } from '../firebase'
import { syncUser } from '../api'

export default function CreateAccount() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState({})

  const clearError = (field) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

    const handleSubmit = async (e) => {
    e.preventDefault()
    const newErrors = {}

    if (!fullName.trim()) newErrors.fullName = 'This field is required'
    if (!email.trim()) newErrors.email = 'This field is required'
    if (!password) newErrors.password = 'This field is required'
    if (!confirmPassword) {
      newErrors.confirmPassword = 'This field is required'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(userCredential.user, { displayName: fullName })
      await syncUser()
      navigate('/')
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setErrors({ email: 'This email is already registered' })
      } else if (error.code === 'auth/weak-password') {
        setErrors({ password: 'Password should be at least 6 characters' })
      } else {
        setErrors({ email: 'Something went wrong. Please try again.' })
      }
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="max-w-[420px] w-full glass rounded-2xl p-8 animate-fade-in">
        {/* Logo */}
        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-gradient-to-br from-electric to-blue-400 flex items-center justify-center shadow-glow">
          <Zap size={28} className="text-white" fill="white" />
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Let's get started 🚀</h1>
          <p className="text-sm text-gray-400">Every Watt Counts.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); clearError('fullName') }}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder-gray-500 focus:border-electric focus:ring-1 focus:ring-electric transition-all duration-300"
              />
            </div>
            {errors.fullName && (
              <p className="text-xs text-red-400 mt-1 animate-fade-in">{errors.fullName}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearError('email') }}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder-gray-500 focus:border-electric focus:ring-1 focus:ring-electric transition-all duration-300"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-400 mt-1 animate-fade-in">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearError('password') }}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl py-3 pl-10 pr-11 text-white text-sm placeholder-gray-500 focus:border-electric focus:ring-1 focus:ring-electric transition-all duration-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-400 mt-1 animate-fade-in">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearError('confirmPassword') }}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl py-3 pl-10 pr-11 text-white text-sm placeholder-gray-500 focus:border-electric focus:ring-1 focus:ring-electric transition-all duration-300"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-400 mt-1 animate-fade-in">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full mt-6 bg-electric hover:bg-electric-dark text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-glow active:scale-[0.98]"
          >
            Create Account
            <Zap size={18} />
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-dark-500"></div>
          <span className="text-xs text-gray-500 uppercase tracking-wider">Or continue with</span>
          <div className="flex-1 h-px bg-dark-500"></div>
        </div>

        {/* Social Buttons */}
        <div className="flex gap-4">
          <button className="flex-1 glass-light rounded-xl py-3 flex items-center justify-center gap-2 hover:border-electric/30 transition-all duration-300">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm text-gray-300">Google</span>
          </button>
          <button className="flex-1 glass-light rounded-xl py-3 flex items-center justify-center gap-2 hover:border-electric/30 transition-all duration-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <span className="text-sm text-gray-300">Apple</span>
          </button>
        </div>

        {/* Bottom Link */}
        <p className="text-center mt-8 text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/signin" className="text-electric hover:text-electric-light font-medium transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
