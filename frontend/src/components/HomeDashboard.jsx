import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Zap, Home, BarChart3, FileText, Clock, User,
  TrendingUp, TrendingDown, IndianRupee, Activity,
  CheckCircle2, AlertTriangle, AlertOctagon, RefreshCw
} from 'lucide-react'
import { useTranslation, useUnit } from '../utils/translate'
import { createDemoData, getDevices, getReadings, getAlerts } from '../api'
import { useAuth } from '../AuthContext'

function BottomNav({ active }) {
  const { t } = useTranslation()
  const items = [
    { icon: Home, label: t('home'), rawLabel: 'Home', path: '/' },
    { icon: Clock, label: t('history'), rawLabel: 'History', path: '/history' },
    { icon: BarChart3, label: t('analysis'), rawLabel: 'Analysis', path: '/analysis' },
    { icon: FileText, label: t('bill'), rawLabel: 'Bill', path: '/bill' },
    { icon: User, label: t('profile'), rawLabel: 'Profile', path: '/profile' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass border-t border-dark-500/50 z-50">
      <div className="max-w-[420px] mx-auto flex items-center justify-around py-2">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = active === item.rawLabel
          return (
            <Link
              key={item.rawLabel}
              to={item.path}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all duration-300 ${
                isActive
                  ? 'text-electric'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={20} fill={isActive ? 'currentColor' : 'none'} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

const ALERT_STYLES = {
  ok: {
    Icon: CheckCircle2,
    iconWrap: 'bg-green-500/10',
    iconClass: 'text-green-400',
    bar: 'bg-gradient-to-r from-green-500 to-emerald-400',
    pctClass: 'text-green-400',
  },
  warning: {
    Icon: AlertTriangle,
    iconWrap: 'bg-amber-500/10',
    iconClass: 'text-amber-400',
    bar: 'bg-gradient-to-r from-amber-500 to-yellow-400',
    pctClass: 'text-amber-400',
  },
  exceeded: {
    Icon: AlertOctagon,
    iconWrap: 'bg-red-500/10',
    iconClass: 'text-red-400',
    bar: 'bg-gradient-to-r from-red-500 to-red-400',
    pctClass: 'text-red-400',
  },
}

function AlertBanner({ alerts, loading, error, unit, t, onRetry }) {
  const fmtKwh = (v) => {
    const n = Number(v) || 0
    return unit === 'MWh' ? (n / 1000).toFixed(3) : n.toFixed(2)
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5 animate-pulse">
        <div className="h-4 w-2/3 bg-dark-600 rounded mb-3" />
        <div className="h-3 w-full bg-dark-600 rounded mb-2" />
        <div className="h-3 w-1/2 bg-dark-600 rounded" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-5 text-center space-y-3">
        <p className="text-sm text-gray-400">{error}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-xs text-electric underline"
        >
          <RefreshCw size={12} />
          {t('retry') || 'Retry'}
        </button>
      </div>
    )
  }

  if (!alerts) {
    return null
  }

  if (!alerts.devices || alerts.devices.length === 0) {
    return (
      <div className="glass rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center flex-shrink-0">
          <Zap size={20} className="text-electric" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">
            {t('usageAlerts') || 'Usage Alerts'}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {t('noDeviceFound') || 'No energy meter registered. Alerts will appear once a meter is linked.'}
          </p>
        </div>
      </div>
    )
  }

  const style = ALERT_STYLES[alerts.status] || ALERT_STYLES.ok
  const { Icon } = style
  const titles = {
    ok: t('alertOk') || 'Usage on track',
    warning: t('alertWarning') || 'Approaching monthly limit',
    exceeded: t('alertExceeded') || 'Monthly limit exceeded',
  }
  const barWidth = Math.min(Number(alerts.usage_percent) || 0, 100)

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-4 mb-4">
        <div className={`w-10 h-10 rounded-xl ${style.iconWrap} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={style.iconClass} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">
            {t('usageAlerts') || 'Usage Alerts'}
          </h3>
          <p className={`text-xs font-medium mt-0.5 ${style.pctClass}`}>
            {titles[alerts.status] || titles.ok} · {Number(alerts.usage_percent).toFixed(1)}% {t('used') || 'used'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="glass-light rounded-lg px-2 py-2">
          <p className="text-[10px] text-gray-400">{t('monthlyLimit')}</p>
          <p className="text-sm font-semibold text-white">
            {fmtKwh(alerts.monthly_limit)} <span className="text-[10px] font-normal text-gray-400">{unit}</span>
          </p>
        </div>
        <div className="glass-light rounded-lg px-2 py-2">
          <p className="text-[10px] text-gray-400">{t('currentUsage') || 'Current usage'}</p>
          <p className="text-sm font-semibold text-white">
            {fmtKwh(alerts.current_usage)} <span className="text-[10px] font-normal text-gray-400">{unit}</span>
          </p>
        </div>
        <div className="glass-light rounded-lg px-2 py-2">
          <p className="text-[10px] text-gray-400">{t('remaining')}</p>
          <p className="text-sm font-semibold text-white">
            {fmtKwh(alerts.remaining)} <span className="text-[10px] font-normal text-gray-400">{unit}</span>
          </p>
        </div>
      </div>

      <div className="relative w-full h-2.5 bg-dark-600 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${style.bar}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className={`rounded-xl px-4 py-2.5 flex items-center gap-2.5 ${
        alerts.predicted_will_exceed
          ? 'bg-amber-500/10 border border-amber-500/30'
          : 'glass-light'
      }`}>
        <TrendingUp size={16} className={alerts.predicted_will_exceed ? 'text-amber-400' : 'text-gray-400'} />
        <div className="flex-1">
          <p className="text-xs text-gray-400">
            {t('predicted') || 'Predicted'} (7d):{' '}
            <span className="text-white font-medium">
              {fmtKwh(alerts.predicted_next_7d_total)} {unit}
            </span>
            {' · '}
            {t('projectedTotal') || 'Projected'}:{' '}
            <span className="text-white font-medium">
              {fmtKwh(alerts.projected_month_total)} {unit}
            </span>
          </p>
          {alerts.predicted_will_exceed && (
            <p className="text-xs text-amber-400 font-medium mt-0.5">
              {t('forecastBreach') || 'Forecast: projected to exceed your monthly limit'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function HomeDashboard() {
  const { t } = useTranslation()
  const { unit } = useUnit()
  const { user } = useAuth()
  const monthlyLimit = user?.appUser?.monthly_limit ?? 500
  const [energy, setEnergy] = useState(null)
  const [bill, setBill] = useState(null)
  const [readings, setReadings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsError, setAlertsError] = useState(null)
  const [loadingDemo, setLoadingDemo] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function fetchDashboardData() {
      try {
        const devices = await getDevices()

        if (!devices || devices.length === 0) {
          if (isMounted) setError(t('noDeviceFound') || 'No energy meter registered.')
          return
        }

        const deviceId = devices[0].id
        const data = await getReadings(deviceId)

        if (data && data.length > 0) {
          const latest = data[0]
          if (!isMounted) return
          setError(null)
          setEnergy(latest.energy)

          // Rate from BillEstimation: 0.26 per unit
          setBill(latest.energy * 0.26)
          setReadings(data.slice(0, 12).reverse()) // Last 12 readings for the chart
        } else {
          if (isMounted) setError(t('noReadingsFound') || 'No readings found for this device.')
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err)
        if (isMounted) setError(t('apiError') || 'Failed to fetch real-time data.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchDashboardData()
    const refresh = window.setInterval(fetchDashboardData, 15000)
    return () => {
      isMounted = false
      window.clearInterval(refresh)
    }
  }, [])

  const handleLoadDemo = async () => {
    setLoadingDemo(true)
    try {
      await createDemoData()
      window.location.reload()
    } catch (err) {
      console.error('Demo data load failed:', err)
      setError('Could not load sample data. Please try again.')
    } finally {
      setLoadingDemo(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    async function fetchAlerts() {
      try {
        setAlertsLoading(true)
        setAlertsError(null)
        const data = await getAlerts()
        if (isMounted) {
          setAlerts(data)
        }
      } catch (err) {
        console.error('Alerts fetch error:', err)
        if (isMounted) {
          setAlertsError(t('alertsError') || 'Could not load usage alerts.')
        }
      } finally {
        if (isMounted) {
          setAlertsLoading(false)
        }
      }
    }

    fetchAlerts()
    return () => { isMounted = false }
  }, [])

  return (
    <div className="min-h-screen bg-dark-900 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 glass px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={22} className="text-electric" fill="currentColor" />
          <span className="text-lg font-bold text-white">{t('wattwatcher')}</span>
        </div>
        <button className="w-8 h-8 rounded-full bg-dark-600 flex items-center justify-center">
          <User size={16} className="text-gray-400" />
        </button>
      </header>

      {/* Content */}
      <div className="px-4 py-6 space-y-5 max-w-[420px] mx-auto animate-fade-in">
        <AlertBanner
          alerts={alerts}
          loading={alertsLoading}
          error={alertsError}
          unit={unit}
          t={t}
          onRetry={() => {
            setAlertsLoading(true)
            setAlertsError(null)
            getAlerts()
              .then((data) => {
                setAlerts(data)
                setAlertsLoading(false)
              })
              .catch((err) => {
                console.error('Alerts retry error:', err)
                setAlertsError(t('alertsError') || 'Could not load usage alerts.')
                setAlertsLoading(false)
              })
          }}
        />
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-4 border-electric border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm animate-pulse">{t('loadingData') || 'Fetching real-time data...'}</p>
          </div>
        ) : error ? (
          <div className="glass rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
              <Activity size={24} className="text-red-400" />
            </div>
            <p className="text-white font-medium">{error}</p>
            {(error.toLowerCase().includes('device') || error.toLowerCase().includes('meter')) && (
              <button
                onClick={handleLoadDemo}
                disabled={loadingDemo}
                className="rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {loadingDemo ? 'Loading sample data…' : 'Load sample data'}
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-electric underline"
            >
              {t('retry') || 'Retry'}
            </button>
          </div>
        ) : (
          <>
            {/* Usage Circle */}
            <div className="glass rounded-2xl p-6 text-center">
              <Link to="/analysis" className="relative w-40 h-40 mx-auto mb-4 block cursor-pointer group">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#1e2640" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke="#3b82f6" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52 * 0.75} ${2 * Math.PI * 52}`}
                    className="transition-all duration-1000 group-hover:stroke-[#60a5fa]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-extrabold text-white group-hover:text-electric transition-colors">
                    {energy != null ? Number(energy).toFixed(2) : '0.00'}
                  </span>
                  <span className="text-xs text-gray-400">{unit}</span>
                </div>
              </Link>
              <div className="flex justify-center gap-4">
                <div className="glass-light rounded-lg px-4 py-2">
                  <p className="text-xs text-gray-400">{t('dailyAvg')}</p>
                  <p className="text-sm font-semibold text-white">
                    {energy != null ? (Number(energy) / 30).toFixed(2) : '0.00'} <span className="text-xs text-gray-400">{unit}</span>
                  </p>
                </div>
                <div className="glass-light rounded-lg px-4 py-2">
                  <p className="text-xs text-gray-400">{t('monthlyLimit')}</p>
                  <p className="text-sm font-semibold text-white">
                    {unit === 'MWh' ? (monthlyLimit / 1000).toFixed(3) : monthlyLimit} <span className="text-xs text-gray-400">{unit}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Peak/Off-Peak Chart */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">{t('todaysUsage')}</h3>
                <Activity size={16} className="text-electric" />
              </div>
              <div className="h-24 flex items-end gap-1">
                {readings.length > 0 ? (
                  readings.map((r, i) => {
                    // Normalize height based on max power in the set
                    const maxPower = Math.max(...readings.map(v => v.power || 0), 1)
                    const height = ((r.power || 0) / maxPower) * 100
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-electric/40 to-electric transition-all duration-500 hover:from-electric/60 hover:to-electric-light"
                        style={{ height: `${height}%` }}
                      />
                    )
                  })
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                    No data available
                  </div>
                )}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-gray-500">
                <span>Past</span><span className="text-center">Recent</span><span>Now</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <IndianRupee size={16} className="text-electric" />
                  <span className="text-xs text-gray-400">{t('estBill')}</span>
                </div>
                <p className="text-xl font-bold text-white">₹{bill != null ? Number(bill).toFixed(2) : '0.00'}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown size={12} className="text-green-400" />
                  <span className="text-[10px] text-green-400">-5.2%</span>
                </div>
              </div>
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-yellow-400" />
                  <span className="text-xs text-gray-400">{t('carbon')}</span>
                </div>
                <p className="text-xl font-bold text-white">120 <span className="text-xs font-normal text-gray-400">kg</span></p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp size={12} className="text-red-400" />
                  <span className="text-[10px] text-red-400">+2.1%</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav active="Home" />
    </div>
  )
}

export { BottomNav }
