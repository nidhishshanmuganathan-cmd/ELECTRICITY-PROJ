import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, ExternalLink, Shield, Zap } from 'lucide-react'

const PAYEE_VPA = import.meta.env.VITE_UPI_PAYEE_VPA
const PAYEE_NAME = import.meta.env.VITE_UPI_PAYEE_NAME || 'WattWatcher'

export default function UpiPayment() {
  const navigate = useNavigate()
  const { state: bill } = useLocation()
  const [opened, setOpened] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  if (!bill?.amount) return <div className="min-h-screen bg-dark-900 p-6 text-center text-gray-300">Open the Bill page first to calculate an amount.<button onClick={() => navigate('/bill')} className="mt-4 block w-full text-electric">Go to Bill</button></div>
  const openUpi = () => {
    if (!PAYEE_VPA) return
    const params = new URLSearchParams({ pa: PAYEE_VPA, pn: PAYEE_NAME, am: bill.amount, cu: 'INR', tn: `Electricity bill ${bill.period}` })
    window.location.assign(`upi://pay?${params.toString()}`)
    setOpened(true)
  }
  if (confirmed) return <div className="min-h-screen bg-dark-900 p-4"><div className="glass mx-auto mt-24 max-w-[420px] rounded-2xl p-8 text-center"><CheckCircle className="mx-auto mb-4 text-green-400" size={48} /><h1 className="text-xl font-bold text-white">Payment marked as completed</h1><p className="mt-3 text-sm text-gray-400">This is a user confirmation. Connect a payment gateway webhook before treating it as verified.</p><button onClick={() => navigate('/bill')} className="mt-6 w-full rounded-xl bg-electric py-3 font-semibold text-white">Back to Bill</button></div></div>
  return <div className="min-h-screen bg-dark-900"><header className="sticky top-0 z-10 glass flex items-center gap-3 px-4 py-3"><button onClick={() => navigate(-1)} className="text-gray-300"><ArrowLeft size={20} /></button><h1 className="text-lg font-semibold text-white">Pay bill</h1><Zap size={20} className="ml-auto text-electric" /></header><main className="mx-auto max-w-[420px] space-y-5 px-4 py-6"><section className="glass rounded-2xl p-6 text-center"><p className="text-xs uppercase tracking-wider text-gray-400">Amount to pay</p><p className="mt-2 text-4xl font-extrabold text-electric">₹{bill.amount}</p><p className="mt-2 text-xs text-gray-500">{Number(bill.units).toFixed(2)} kWh · {bill.period}</p></section><section className="glass rounded-2xl p-5"><h2 className="text-sm font-semibold text-white">UPI payment</h2><p className="mt-2 text-xs text-gray-400">Use any installed UPI app. The amount is passed securely in the UPI request.</p>{PAYEE_VPA ? <button onClick={openUpi} className="mt-5 flex w-full items-center justify-between rounded-xl bg-electric px-4 py-4 text-left text-white"><span><span className="block font-semibold">Open UPI app</span><span className="text-xs text-white/80">Pay to {PAYEE_NAME}</span></span><ExternalLink size={18} /></button> : <p className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">Payment is not configured. Add VITE_UPI_PAYEE_VPA to the frontend .env file with your merchant UPI ID.</p>}</section>{opened && <section className="glass rounded-2xl p-5 text-center"><p className="text-sm text-gray-300">Complete the payment in your UPI app, then return here.</p><button onClick={() => setConfirmed(true)} className="mt-4 w-full rounded-xl border border-green-500/40 py-3 font-semibold text-green-400">I completed payment</button></section>}<p className="flex items-center justify-center gap-2 text-xs text-gray-500"><Shield size={14} /> Payment verification requires a gateway callback in production.</p></main></div>
}
