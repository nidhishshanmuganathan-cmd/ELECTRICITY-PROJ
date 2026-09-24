import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Calculator, IndianRupee, LoaderCircle, Zap } from 'lucide-react'
import { BottomNav } from './HomeDashboard'
import { getAlerts } from '../api'

const UNIT_RATE = 6.5
const FIXED_CHARGE = 50

function currentPeriod() {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date())
}

export default function BillEstimation() {
  const navigate = useNavigate()
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAlerts().then((data) => setUsage(Number(data.current_usage) || 0)).catch(() => setError('Could not load current usage.'))
  }, [])

  const energyCharge = usage === null ? 0 : usage * UNIT_RATE
  const total = energyCharge + FIXED_CHARGE
  const bill = { amount: total.toFixed(2), units: usage || 0, period: currentPeriod() }

  return (
    <div className="min-h-screen bg-dark-900 pb-20">
      <header className="sticky top-0 z-10 glass flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-white"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold text-white">Bill Estimate</h1><Zap size={20} className="ml-auto text-electric" />
      </header>
      <main className="mx-auto max-w-[420px] space-y-5 px-4 py-6">
        {usage === null && !error ? <div className="flex justify-center py-20"><LoaderCircle className="animate-spin text-electric" size={32} /></div> : error ? <div className="glass rounded-2xl p-6 text-center text-sm text-gray-300">{error}</div> : <>
          <section className="glass rounded-2xl p-6 text-center"><IndianRupee size={28} className="mx-auto mb-3 text-electric" /><p className="text-xs uppercase tracking-wider text-gray-400">Estimated amount due</p><p className="mt-2 text-5xl font-extrabold text-white">₹<span className="text-electric">{bill.amount}</span></p><p className="mt-2 text-xs text-gray-500">Billing period: {bill.period}</p></section>
          <section className="glass rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-white">Rate breakdown</h2><Calculator size={16} className="text-electric" /></div><div className="space-y-3 text-sm"><div className="flex justify-between border-b border-dark-500/50 pb-2"><span className="text-gray-400">Current usage</span><span className="text-white">{bill.units.toFixed(2)} kWh</span></div><div className="flex justify-between border-b border-dark-500/50 pb-2"><span className="text-gray-400">Energy charge</span><span className="text-white">₹{UNIT_RATE.toFixed(2)}/kWh</span></div><div className="flex justify-between border-b border-dark-500/50 pb-2"><span className="text-gray-400">Fixed charge</span><span className="text-white">₹{FIXED_CHARGE.toFixed(2)}</span></div><div className="flex justify-between pt-1 font-semibold"><span className="text-white">Estimated total</span><span className="text-electric">₹{bill.amount}</span></div></div><p className="mt-4 text-xs text-gray-500">Estimate based on measured usage and the configured tariff.</p></section>
          <button onClick={() => navigate('/payment', { state: bill })} className="flex w-full items-center justify-center gap-2 rounded-xl bg-electric py-3.5 font-semibold text-white hover:bg-electric-dark">Continue to payment <Zap size={18} /></button>
        </>}
      </main>
      <BottomNav active="Bill" />
    </div>
  )
}
