import { useEffect, useMemo, useState } from 'react'
import { BrainCircuit, Lightbulb, LoaderCircle, ShieldAlert, Sparkles, TrendingUp, TriangleAlert, Zap } from 'lucide-react'
import { BottomNav } from './HomeDashboard'
import { getAlerts, getDevices, getPredictions, getUsageAnomaly, getUsageSummary } from '../api'

const kwh = (value) => `${(Number(value) || 0).toFixed(1)} kWh`

export default function Insights() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const devices = await getDevices()
        if (!devices?.length) throw new Error('No meter is connected yet.')
        const id = devices[0].id
        const [alerts, summary, forecast, anomaly] = await Promise.all([getAlerts(), getUsageSummary(id, '7D'), getPredictions(id, '7D'), getUsageAnomaly(id)])
        if (active) setData({ alerts, summary, forecast, anomaly })
      } catch (loadError) { if (active) setError(loadError.message || 'Unable to load advisor insights.') }
    }
    load()
    return () => { active = false }
  }, [])

  const insights = useMemo(() => {
    if (!data) return null
    const actual = data.forecast.actual?.map(Number) || []
    const predicted = data.forecast.predicted?.map(Number) || []
    const risk = data.alerts.status === 'exceeded' ? 'High' : (data.alerts.status === 'warning' || data.alerts.predicted_will_exceed) ? 'Moderate' : 'Low'
    const recommendations = risk === 'High' ? ['Move heavy appliances to off-peak hours immediately.', 'Reduce AC runtime and set it to 24°C.', 'Inspect water heaters, pumps, and standby loads today.'] : risk === 'Moderate' ? ['Schedule heavy appliances outside peak evening hours.', 'Use timers for water heaters and high-load appliances.', 'Review the daily forecast before adding new loads.'] : ['Maintain your current appliance schedule.', 'Use timers to prevent avoidable standby consumption.', 'Review these insights weekly for unusual usage patterns.']
    return { actual, predicted, risk, recommendations, anomalous: data.anomaly.status === 'anomaly' }
  }, [data])

  return <div className="min-h-screen bg-dark-900 pb-20"><header className="sticky top-0 z-10 glass flex items-center gap-3 px-4 py-3"><BrainCircuit size={21} className="text-electric" /><h1 className="text-lg font-semibold text-white">AI Energy Advisor</h1><Sparkles size={19} className="ml-auto text-electric" /></header><main className="mx-auto max-w-[420px] space-y-5 px-4 py-6">{!data && !error && <div className="flex justify-center py-20"><LoaderCircle size={32} className="animate-spin text-electric" /></div>}{error && <div className="glass rounded-2xl p-6 text-center text-sm text-gray-300">{error}</div>}{data && insights && <><section className={`rounded-2xl border p-5 ${insights.risk === 'High' ? 'border-red-500/30 bg-red-500/10' : insights.risk === 'Moderate' ? 'border-amber-500/30 bg-amber-500/10' : 'glass'}`}><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider text-gray-400">Usage risk</p><p className={`mt-1 text-3xl font-extrabold ${insights.risk === 'High' ? 'text-red-400' : insights.risk === 'Moderate' ? 'text-amber-400' : 'text-green-400'}`}>{insights.risk}</p><p className="mt-1 text-xs text-gray-400">{kwh(data.alerts.current_usage)} of {kwh(data.alerts.monthly_limit)} used</p></div><ShieldAlert size={27} className="text-electric" /></div></section><section className="glass rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Usage trend & forecast</h2><TrendingUp size={16} className="text-electric" /></div><div className="flex h-28 items-end gap-1.5">{(insights.actual.length ? insights.actual : [0]).map((value, index, values) => { const max = Math.max(...[...values, ...insights.predicted], 1); return <div key={index} className="flex-1 rounded-t bg-gradient-to-t from-electric/40 to-electric" style={{ height: `${Math.max((value / max) * 100, 4)}%` }} /> })}{insights.predicted.map((value, index) => { const max = Math.max(...[...insights.actual, ...insights.predicted], 1); return <div key={`forecast-${index}`} className="flex-1 rounded-t border border-amber-400/70 bg-amber-400/20" style={{ height: `${Math.max((value / max) * 100, 4)}%` }} /> })}</div><p className="mt-4 text-xs text-gray-400">Last 7 days: <span className="font-medium text-white">{kwh(data.summary.total_energy)}</span> · Forecast: <span className="font-medium text-white">{kwh(data.alerts.predicted_next_7d_total)}</span></p></section><section className={`rounded-2xl border p-5 ${insights.anomalous ? 'border-amber-500/30 bg-amber-500/10' : 'glass'}`}><div className="flex gap-3"><TriangleAlert size={20} className={insights.anomalous ? 'text-amber-400' : 'text-green-400'} /><div><h2 className="text-sm font-semibold text-white">Isolation Forest anomaly detection</h2><p className="mt-1 text-xs text-gray-400">{data.anomaly.status === 'insufficient_data' ? `Need ${7 - data.anomaly.sample_size} more daily records for detection.` : insights.anomalous ? `Unusual usage detected (score ${(data.anomaly.score * 100).toFixed(0)}%).` : `No unusual usage detected (score ${(data.anomaly.score * 100).toFixed(0)}%).`}</p></div></div></section><section className="glass rounded-2xl p-5"><div className="mb-4 flex items-center gap-2"><Lightbulb size={18} className="text-yellow-400" /><h2 className="text-sm font-semibold text-white">Personalized recommendations</h2></div><div className="space-y-3">{insights.recommendations.map((item) => <div key={item} className="flex gap-3 rounded-xl bg-dark-700/50 p-3"><Zap size={15} className="mt-0.5 shrink-0 text-electric" /><p className="text-xs text-gray-300">{item}</p></div>)}</div></section></>}</main><BottomNav active="Insights" /></div>
}
