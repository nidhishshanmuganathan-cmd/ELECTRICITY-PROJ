import { ArrowLeft, Zap, Calendar, TrendingUp, TrendingDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BottomNav } from './HomeDashboard'
import { useTranslation, useUnit } from '../utils/translate'
import { useEffect, useState } from 'react'
import { getDevices, getDailyUsage } from '../api'

export default function History() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { format } = useUnit()
  const [records, setRecords] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchHistory() {
      try {
        setIsLoading(true)
        const devices = await getDevices()

        if (!devices || devices.length === 0) {
          setError(t('noDeviceFound') || 'No device found')
          setIsLoading(false)
          return
        }

        const deviceId = devices[0].id
        const data = await getDailyUsage(deviceId)

        if (data && data.length > 0) {
          const formattedRecords = data.map((day, index, arr) => {
            const prevValue = index < arr.length - 1 ? arr[index + 1].total_energy : null
            const trend = prevValue !== null ? (day.total_energy > prevValue ? 'up' : 'down') : 'down'

            return {
              date: day.date,
              value: day.total_energy,
              cost: `₹${(day.total_energy * 0.26).toFixed(2)}`,
              trend: trend
            }
          })
          setRecords(formattedRecords)
        } else {
          setError(t('noReadingsFound') || 'No readings found for this device.')
        }
      } catch (err) {
        console.error('History fetch error:', err)
        setError(t('apiError') || 'Failed to load history')
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [])

  return (
    <div className="min-h-screen bg-dark-900 pb-20">
      <header className="sticky top-0 z-10 glass px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-white">{t('history')}</h1>
        <Calendar size={20} className="text-electric ml-auto" />
      </header>

      <div className="px-4 py-6 space-y-4 max-w-[420px] mx-auto animate-fade-in">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-10 h-10 border-4 border-electric border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm animate-pulse">{t('loadingData') || 'Loading history...'}</p>
          </div>
        ) : error ? (
          <div className="glass rounded-2xl p-8 text-center space-y-4">
            <p className="text-white font-medium">{error}</p>
            <button onClick={() => window.location.reload()} className="text-xs text-electric underline">Retry</button>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-gray-300 px-1">{t('dailyRecords')}</h3>
            {records.length > 0 ? (
              records.map((record, i) => (
                <div key={i} className="glass rounded-2xl p-4 flex items-center justify-between hover:border-electric/20 transition-all duration-300">
                  <div>
                    <p className="text-sm font-medium text-white">{record.date}</p>
                    <p className="text-xs text-gray-400 mt-1">{format(record.value)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{record.cost}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      {record.trend === 'down' ? (
                        <>
                          <TrendingDown size={12} className="text-green-400" />
                          <span className="text-[10px] text-green-400">{t('lower')}</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp size={12} className="text-red-400" />
                          <span className="text-[10px] text-red-400">{t('higher')}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-gray-500 text-sm">No records found.</div>
            )}
          </>
        )}
      </div>

      <BottomNav active="History" />
    </div>
  )
}
