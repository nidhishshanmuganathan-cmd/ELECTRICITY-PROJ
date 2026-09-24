import { useAuth } from '../AuthContext'
import { sendTestNotification, updateUserProfile } from '../api'
import { useEffect, useState } from 'react'
import { Zap, User, Settings, Bell, LogOut, ChevronRight, Gauge, UserCircle, X, Check, Minus, Plus, Sun, Moon, Globe, Battery } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomNav } from './HomeDashboard'
import { useTranslation, setLanguage, useUnit, setEnergyUnit } from '../utils/translate'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { enablePushNotifications } from '../notifications'

export default function Profile() {
  const navigate = useNavigate()
  const { user, updateAppUser } = useAuth()
  const { t, currentLanguage } = useTranslation()
  const { unit } = useUnit()
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [showPersonalModal, setShowPersonalModal] = useState(false)
  const [showPrefsModal, setShowPrefsModal] = useState(false)
  const monthlyLimit = user?.appUser?.monthly_limit ?? 500
  const [tempLimit, setTempLimit] = useState(monthlyLimit)
  const [notifications, setNotifications] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )
  const [notifError, setNotifError] = useState(null)
  const [notifBusy, setNotifBusy] = useState(false)

  const handleToggleNotifications = async () => {
    if (notifBusy) {
      return
    }
    if (notifications) {
      setNotifications(false)
      setNotifError(null)
      return
    }
    setNotifBusy(true)
    setNotifError(null)
    const result = await enablePushNotifications()
    setNotifBusy(false)
    if (result.ok) {
      setNotifications(true)
    } else {
      setNotifications(false)
      setNotifError(result.message)
    }
  }

  const handleTestNotification = async () => {
    setNotifBusy(true)
    setNotifError(null)
    try {
      const result = await sendTestNotification()
      if (!result.sent) {
        setNotifError('No push token is registered. Enable notifications first.')
      }
    } catch (error) {
      console.error('Test notification failed:', error)
      setNotifError(error.message || 'Test notification failed.')
    } finally {
      setNotifBusy(false)
    }
  }
  const [darkMode, setDarkMode] = useState(localStorage.getItem('wattwatcher_theme') !== 'light')

  const toggleDarkMode = () => {
    const nextDark = !darkMode
    setDarkMode(nextDark)
    localStorage.setItem('wattwatcher_theme', nextDark ? 'dark' : 'light')
    window.dispatchEvent(new Event('themeChange'))
  }

  // Preferences state
  const [prefs, setPrefs] = useState({ language: currentLanguage, unit: unit })
  const [tempPrefs, setTempPrefs] = useState({ ...prefs })

  // Derived personal info from global state to prevent "vanishing" data
  const personalInfo = {
    fullName: user?.appUser?.full_name || user?.firebaseUser?.displayName || 'New User',
    email: user?.appUser?.email || user?.firebaseUser?.email || '',
    phone: user?.appUser?.phone || '',
    address: user?.appUser?.address || '',
  }

  const [tempInfo, setTempInfo] = useState({ ...personalInfo })

  // Keep tempInfo in sync when user data finally loads from server
  useEffect(() => {
    setTempInfo({
      fullName: personalInfo.fullName,
      email: personalInfo.email,
      phone: personalInfo.phone,
      address: personalInfo.address,
    })
  }, [user?.appUser])

  useEffect(() => {
    setTempLimit(monthlyLimit)
  }, [monthlyLimit])

  const menuItems = [
    { icon: UserCircle, label: t('personalInfo'), desc: t('fullName') + ', ' + t('email') + ' & ' + t('phone'), type: 'link', action: () => { setTempInfo({ ...personalInfo }); setShowPersonalModal(true) } },
    { icon: Gauge, label: t('limitSettings'), desc: `${t('remaining')}: ${monthlyLimit} ${unit}`, type: 'link', action: () => { setTempLimit(monthlyLimit); setShowLimitModal(true) } },
    { icon: Bell, label: t('notifications'), desc: notifError || (notifications ? 'Enabled' : 'Disabled'), type: 'toggle', value: notifications, onToggle: handleToggleNotifications },
    { icon: darkMode ? Moon : Sun, label: t('darkMode'), desc: darkMode ? 'On' : 'Off', type: 'toggle', value: darkMode, onToggle: toggleDarkMode },
    { icon: Settings, label: t('preferences'), desc: t('appSettings'), type: 'link', action: () => { setTempPrefs({ ...prefs }); setShowPrefsModal(true) } },
  ]

  const handleSaveLimit = async () => {
    try {
      const updatedUser = await updateUserProfile({ monthly_limit: tempLimit })
      updateAppUser({ monthly_limit: updatedUser.monthly_limit })
      setShowLimitModal(false)
    } catch (error) {
      console.error('Failed to save limit:', error)
    }
  }

  const handleSavePersonal = async () => {
  try {
    const updatedUser = await updateUserProfile({
      full_name: tempInfo.fullName,
      phone: tempInfo.phone || null,
      address: tempInfo.address || null,
    })

    updateAppUser({
      full_name: updatedUser.full_name,
      phone: updatedUser.phone,
      address: updatedUser.address,
    })

    setShowPersonalModal(false)

    alert('Profile saved successfully!')
  } catch (error) {
    console.error('Failed to save profile:', error)
    alert('Failed to save profile.')
  }
}

  const handleSavePrefs = () => {
    setLanguage(tempPrefs.language)
    setEnergyUnit(tempPrefs.unit)
    setPrefs({ ...tempPrefs })
    setShowPrefsModal(false)
  }
  const handleSignOut = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    console.error('Sign out failed:', error)
  }
}

  return (
    <div className="min-h-screen bg-dark-900 pb-20">
      <header className="sticky top-0 z-10 glass px-4 py-3 flex items-center gap-3">
        <Zap size={22} className="text-electric" fill="currentColor" />
        <h1 className="text-lg font-bold text-white">WattWatcher</h1>
      </header>

      <div className="px-4 py-6 space-y-5 max-w-[420px] mx-auto animate-fade-in">
        {/* Profile Card */}
        <div className="glass rounded-2xl p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-electric to-blue-400 flex items-center justify-center mx-auto mb-4 shadow-glow">
            <User size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">{personalInfo.fullName}</h2>
          <p className="text-sm text-gray-400 mt-1">{personalInfo.email}</p>
        </div>

        {/* Menu */}
        <div className="space-y-2">
          {menuItems.map((item, i) => {
            const Icon = item.icon
            return (
              <button
                key={i}
                onClick={item.type === 'toggle' ? item.onToggle : item.action}
                className="w-full glass rounded-2xl p-4 flex items-center gap-4 hover:border-electric/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-dark-600 flex items-center justify-center">
                  <Icon size={20} className="text-electric" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
                {item.type === 'toggle' ? (
                  <div className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-all duration-300 ${
                    item.value ? 'bg-electric' : 'bg-dark-500'
                  }`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
                      item.value ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                ) : (
                  <ChevronRight size={16} className="text-gray-500" />
                )}
              </button>
            )
          })}
        </div>

        {import.meta.env.DEV && notifications && (
          <button
            onClick={handleTestNotification}
            disabled={notifBusy}
            className="w-full rounded-2xl border border-electric/30 bg-electric/10 p-3 text-sm font-medium text-electric disabled:opacity-50"
          >
            {notifBusy ? 'Sending test notification…' : 'Send test notification'}
          </button>
        )}

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className="w-full glass rounded-2xl p-4 flex items-center gap-4 hover:border-red-500/30 transition-all duration-300 group"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <LogOut size={20} className="text-red-400" />
          </div>
          <span className="text-sm font-medium text-red-400">{t('signOut')}</span>
        </button>
      </div>

      <BottomNav active="Profile" />

      {/* ─── Monthly Limit Modal ─────────────────────────────────── */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowLimitModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div className="relative glass rounded-2xl p-6 w-full max-w-[380px] animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {/* Close */}
            <button onClick={() => setShowLimitModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-electric/10 flex items-center justify-center mx-auto mb-3">
                <Gauge size={24} className="text-electric" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('setMonthlyLimit')}</h3>
              <p className="text-xs text-gray-400 mt-1">{t('adjustLimitDesc')}</p>
            </div>

            {/* Limit control */}
            <div className="flex items-center justify-center gap-5 mb-6">
              <button
                onClick={() => setTempLimit(Math.max(50, tempLimit - 50))}
                className="w-10 h-10 rounded-full bg-dark-600 flex items-center justify-center text-gray-300 hover:bg-dark-500 hover:text-white transition-all active:scale-90"
              >
                <Minus size={18} />
              </button>
              <div className="text-center">
                <span className="text-4xl font-extrabold text-white">{tempLimit}</span>
                <p className="text-xs text-gray-400 mt-1">kWh</p>
              </div>
              <button
                onClick={() => setTempLimit(tempLimit + 50)}
                className="w-10 h-10 rounded-full bg-dark-600 flex items-center justify-center text-gray-300 hover:bg-dark-500 hover:text-white transition-all active:scale-90"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="50"
              max="2000"
              step="10"
              value={tempLimit}
              onChange={(e) => setTempLimit(Number(e.target.value))}
              className="w-full h-1.5 bg-dark-600 rounded-full appearance-none cursor-pointer accent-electric mb-6
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-electric [&::-webkit-slider-thumb]:shadow-glow"
            />

            {/* Quick presets */}
            <div className="flex gap-2 mb-6">
              {[200, 500, 750, 1000].map((val) => (
                <button
                  key={val}
                  onClick={() => setTempLimit(val)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                    tempLimit === val
                      ? 'bg-electric text-white'
                      : 'bg-dark-600 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>

            <button
              onClick={handleSaveLimit}
              className="w-full bg-electric hover:bg-electric-dark text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-glow active:scale-[0.98]"
            >
              <Check size={18} />
              {t('saveLimit')}
            </button>
          </div>
        </div>
      )}

      {/* ─── Personal Information Modal ──────────────────────────── */}
      {showPersonalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowPersonalModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div className="relative glass rounded-2xl p-6 w-full max-w-[380px] animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {/* Close */}
            <button onClick={() => setShowPersonalModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-electric/10 flex items-center justify-center mx-auto mb-3">
                <UserCircle size={24} className="text-electric" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('personalInfo')}</h3>
              <p className="text-xs text-gray-400 mt-1">{t('appSettings')}</p>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{t('fullName')}</label>
                <input
                  type="text"
                  value={tempInfo.fullName}
                  onChange={(e) => setTempInfo({ ...tempInfo, fullName: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl py-2.5 px-4 text-white text-sm placeholder-gray-500 focus:border-electric focus:ring-1 focus:ring-electric transition-all duration-300"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{t('email')}</label>
                <input
                  type="email"
                  value={tempInfo.email}
                  onChange={(e) => setTempInfo({ ...tempInfo, email: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl py-2.5 px-4 text-white text-sm placeholder-gray-500 focus:border-electric focus:ring-1 focus:ring-electric transition-all duration-300"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{t('phone')}</label>
                <input
                  type="tel"
                  value={tempInfo.phone}
                  onChange={(e) => setTempInfo({ ...tempInfo, phone: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl py-2.5 px-4 text-white text-sm placeholder-gray-500 focus:border-electric focus:ring-1 focus:ring-electric transition-all duration-300"
                />
              </div>

              {/* Address */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{t('address')}</label>
                <input
                  type="text"
                  value={tempInfo.address}
                  onChange={(e) => setTempInfo({ ...tempInfo, address: e.target.value })}
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl py-2.5 px-4 text-white text-sm placeholder-gray-500 focus:border-electric focus:ring-1 focus:ring-electric transition-all duration-300"
                />
              </div>
            </div>

            <button
              onClick={handleSavePersonal}
              className="w-full mt-6 bg-electric hover:bg-electric-dark text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-glow active:scale-[0.98]"
            >
              <Check size={18} />
              {t('saveChanges')}
            </button>
          </div>
        </div>
      )}

      {/* ─── Preferences Modal ───────────────────────────────────── */}
      {showPrefsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowPrefsModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div className="relative glass rounded-2xl p-6 w-full max-w-[380px] animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowPrefsModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-electric/10 flex items-center justify-center mx-auto mb-3">
                <Settings size={24} className="text-electric" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('preferences')}</h3>
              <p className="text-xs text-gray-400 mt-1">{t('appSettings')}</p>
            </div>

            <div className="space-y-4">
              {/* Language */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <Globe size={12} /> {t('language')}
                </label>
                <div className="flex gap-2">
                  {['English', 'Hindi', 'Tamil', 'Telugu'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setTempPrefs({ ...tempPrefs, language: lang })}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                        tempPrefs.language === lang
                          ? 'bg-electric text-white'
                          : 'bg-dark-600 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy Unit */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <Battery size={12} /> {t('energyUnit')}
                </label>
                <div className="flex gap-2">
                  {['kWh', 'MWh', 'Units'].map((unit) => (
                    <button
                      key={unit}
                      onClick={() => setTempPrefs({ ...tempPrefs, unit })}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-300 ${
                        tempPrefs.unit === unit
                          ? 'bg-electric text-white'
                          : 'bg-dark-600 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSavePrefs}
              className="w-full mt-6 bg-electric hover:bg-electric-dark text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 hover:shadow-glow active:scale-[0.98]"
            >
              <Check size={18} />
              {t('savePreferences')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
