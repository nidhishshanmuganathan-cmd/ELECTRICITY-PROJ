import { useState, useEffect } from 'react'
import { ArrowLeft, Zap, Brain, Lightbulb, Thermometer, Timer, TrendingUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BottomNav } from './HomeDashboard'
import { useTranslation, useUnit } from '../utils/translate'
import { getDevices, getMonthlyUsage, getPredictions, getUsageSummary } from '../api'
import { useAuth } from '../AuthContext'

export default function Analysis() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { unit } = useUnit()
  const { user } = useAuth()
  const monthlyLimit = user?.appUser?.monthly_limit ?? 500
  const [activeRange, setActiveRange] = useState('7D')
  const [currentTotal, setCurrentTotal] = useState(null)
  const [actualData, setActualData] = useState([])
  const [predictedData, setPredictedData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true;
    async function fetchAnalysisData() {
      try {
        setIsLoading(true)
        const devices = await getDevices()
        if (!isMounted) return;
        if (!devices || devices.length === 0) {
          setError(t('noDeviceFound') || 'No device found')
          return
        }

        const deviceId = devices[0].id

        // Parallel fetch to reduce waterfall and prevent sequential failures
        const [summary, predictions] = await Promise.all([
          getUsageSummary(deviceId, activeRange),
          getPredictions(deviceId, activeRange)
        ]);

        if (!isMounted) return;

        if (summary && summary.total_energy !== undefined) {
          setCurrentTotal(summary.total_energy)
        }

        setActualData(predictions?.actual || [])
        setPredictedData(predictions?.predicted || [])
      } catch (err) {
        if (isMounted) {
          console.error('Analysis fetch error:', err)
          setError(t('apiError') || 'Failed to load analysis data')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchAnalysisData()
    return () => { isMounted = false; };
  }, [activeRange])

  const currentUnits = currentTotal !== null ? (Number(currentTotal) || 0) : 0
  const usagePercent = Math.round((currentUnits / monthlyLimit) * 100)
  const remaining = monthlyLimit - currentUnits

  const chartData = actualData && actualData.length > 0 ? actualData : [0, 0, 0, 0, 0, 0, 0]
  const predData = predictedData && predictedData.length > 0 ? predictedData : [0, 0, 0, 0]

  const labels = chartData.length <= 7
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today']
    : ['Start', '...', 'Today']
  const predictedLabels = ['Today', 'Thu', 'Fri', 'Sat']

  const chartW = 340
  const chartH = 140
  const padX = 10
  const padY = 10
  const allValues = [...chartData, ...predData]
  const minVal = Math.min(...allValues) - 30
  const maxVal = Math.max(...allValues) + 20
  const range = maxVal - minVal === 0 ? 1 : maxVal - minVal

  const toX = (i, total) => padX + (i / (total > 1 ? total - 1 : 1)) * (chartW - 2 * padX)
  const toY = (v) => padY + ((maxVal - v) / range) * (chartH - 2 * padY)

  const actualPoints = chartData.map((v, i) => `${toX(i, chartData.length)},${toY(v)}`).join(' ')
  const predXStart = toX(chartData.length - 1, chartData.length)
  const totalPredPoints = predData.length
  const predPoints = predData.map((v, i) => {
    const x = predXStart + (i / (totalPredPoints > 1 ? totalPredPoints - 1 : 1)) * (chartW - padX - predXStart)
    return `${x},${toY(v)}`
  }).join(' ')

  const areaPath = chartData.length > 0 ? (
    `M ${toX(0, chartData.length)},${chartH - padY} ` +
    chartData.map((v, i) => `L ${toX(i, chartData.length)},${toY(v)}`).join(' ') +
    ` L ${toX(chartData.length - 1, chartData.length)},${chartH - padY} Z`
  ) : ''

  const limitY = toY(monthlyLimit)

  const tips = [
    {
      icon: Lightbulb,
      title: 'Switch to LED Bulbs',
      desc: 'Replace incandescent bulbs with LEDs to save up to 75% energy on lighting.',
      savings: '₹12.50/mo',
      color: 'from-yellow-500/20 to-amber-500/20',
      iconColor: 'text-yellow-400',
    },
    {
      icon: Thermometer,
      title: 'Optimize AC Temperature',
      desc: 'Set your AC to 24°C instead of 20°C. Each degree saves ~6% energy.',
      savings: '₹18.30/mo',
      color: 'from-cyan-500/20 to-blue-500/20',
      iconColor: 'text-cyan-400',
    },
    {
      icon: Timer,
      title: 'Use Off-Peak Hours',
      desc: 'Run heavy appliances during off-peak hours (10PM-6AM) for lower rates.',
      savings: '₹8.75/mo',
      color: 'from-purple-500/20 to-indigo-500/20',
      iconColor: 'text-purple-400',
    },
  ]

  const ranges = ['24H', '7D', '30D', '90D']

  return (
    <div className="min-h-screen bg-dark-900 pb-20">
      <header className="sticky top-0 z-10 glass px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-white">Analysis</h1>
        <Brain size={20} className="text-electric ml-auto" />
      </header>

      <div className="px-4 py-6 space-y-5 max-w-[420px] mx-auto animate-fade-in">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-4 border-electric border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm animate-pulse">{t('loadingData') || 'Analyzing usage...'}</p>
          </div>
        ) : error ? (
          <div className="glass rounded-2xl p-8 text-center space-y-4">
            <p className="text-white font-medium">{error}</p>
            <button onClick={() => window.location.reload()} className="text-xs text-electric underline">Retry</button>
          </div>
        ) : (
          <>
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Total Consumption ({activeRange})</p>
                <div className="flex items-center gap-1 text-green-400">
                  <TrendingUp size={14} />
                  <span className="text-xs font-medium">+3.2%</span>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-4xl font-extrabold text-white">
                  {unit === 'MWh' ? (currentUnits / 1000).toFixed(3) : currentUnits.toFixed(0)}
                </span>
                <span className="text-sm text-gray-400">{unit}</span>
              </div>

              <div className="flex gap-2 mb-5">
                {ranges.map((r) => (
                  <button
                    key={r}
                    onClick={() => setActiveRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                      activeRange === r
                        ? 'bg-electric text-white'
                        : 'bg-dark-600 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="relative">
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                  {[0.25, 0.5, 0.75].map((frac) => (
                    <line
                      key={frac}
                      x1={padX} y1={padY + frac * (chartH - 2 * padY)}
                      x2={chartW - padX} y2={padY + frac * (chartH - 2 * padY)}
                      stroke="#1e2640" strokeWidth="0.5"
                    />
                  ))}
                  <line
                    x1={padX} y1={limitY}
                    x2={chartW - padX} y2={limitY}
                    stroke="#ef4444" strokeWidth="1" strokeDasharray="6 4" opacity="0.5"
                  />
                  <text x={chartW - padX - 2} y={limitY - 4} fill="#ef4444" fontSize="7" textAnchor="end" opacity="0.7">
                    Limit {unit === 'MWh' ? (monthlyLimit / 1000).toFixed(3) : monthlyLimit} {unit}
                  </text>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d={areaPath} fill="url(#areaGrad)" />
                  <polyline
                    points={actualPoints}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={predPoints}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="6 4"
                    opacity="0.8"
                  />
                  {chartData.map((v, i) => (
                    <circle
                      key={i}
                      cx={toX(i, chartData.length)}
                      cy={toY(v)}
                      r="3"
                      fill="#3b82f6"
                      stroke="#0a0e1a"
                      strokeWidth="1.5"
                    />
                  ))}
                  <circle
                    cx={toX(chartData.length - 1, chartData.length)}
                    cy={toY(chartData[chartData.length - 1])}
                    r="5"
                    fill="#3b82f6"
                    opacity="0.3"
                  />
                </svg>
                <div className="flex justify-between px-1 mt-1">
                  {labels.map((l, i) => (
                    <span key={i} className={`text-[9px] ${i === labels.length - 1 ? 'text-electric font-semibold' : 'text-gray-500'}`}>
                      {l}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-5 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-electric rounded-full"></div>
                  <span className="text-[10px] text-gray-400">Actual</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-amber-400 rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #f59e0b 0px, #f59e0b 3px, transparent 3px, transparent 5px)' }}></div>
                  <span className="text-[10px] text-gray-400">Predicted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-red-500 rounded-full opacity-60"></div>
                  <span className="text-[10px] text-gray-400">Limit</span>
                </div>
              </div>
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Monthly Usage Limit</h3>
                <span className="text-xs text-gray-400">
                  {unit === 'MWh' ? (currentUnits / 1000).toFixed(3) : currentUnits.toFixed(0)} / {unit === 'MWh' ? (monthlyLimit / 1000).toFixed(3) : monthlyLimit} {unit}
                </span>
              </div>
              <div className="relative w-full h-3 bg-dark-600 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    usagePercent > 90 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                    usagePercent > 70 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                    'bg-gradient-to-r from-electric to-blue-400'
                  }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-500">0 {unit}</span>
                <span className={`text-xs font-semibold ${
                  usagePercent > 90 ? 'text-red-400' :
                  usagePercent > 70 ? 'text-amber-400' :
                  'text-electric'
                }`}>
                  {usagePercent}% used
                </span>
                <span className="text-xs text-gray-500">{unit === 'MWh' ? (monthlyLimit / 1000).toFixed(3) : monthlyLimit} {unit}</span>
              </div>
              <div className="glass-light rounded-lg px-4 py-2.5 mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">Remaining</span>
                <span className="text-sm font-bold text-white">
                  {unit === 'MWh' ? ((remaining / 1000).toFixed(3)) : remaining.toFixed(0)} <span className="text-xs font-normal text-gray-400">{unit}</span>
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3 px-1">AI Recommendations</h3>
              <div className="space-y-3">
                {tips.map((tip, i) => {
                  const Icon = tip.icon
                  return (
                    <div key={i} className="glass rounded-2xl p-4 flex gap-4 items-start hover:border-electric/20 transition-all duration-300">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tip.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={20} className={tip.iconColor} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-white mb-1">{tip.title}</h4>
                        <p className="text-xs text-gray-400 leading-relaxed">{tip.desc}</p>
                        <p className="text-xs text-green-400 font-medium mt-2">Save {tip.savings}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav active="Analysis" />
    </div>
  )
}
