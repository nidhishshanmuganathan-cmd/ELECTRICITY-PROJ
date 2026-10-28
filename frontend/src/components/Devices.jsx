import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Copy, Cpu, LoaderCircle, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { addDevice, getDevices, provisionDeviceToken } from '../api'
import { BottomNav } from './HomeDashboard'

const initialForm = { device_name: '', device_code: '', location: '', wifi_ssid: '', firmware_version: '' }

export default function Devices() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [token, setToken] = useState(null)
  const [copied, setCopied] = useState(false)

  const loadDevices = async () => {
    try {
      setLoading(true)
      setDevices(await getDevices())
      setError(null)
    } catch (requestError) {
      setError(requestError.message || 'Unable to load your meters.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDevices() }, [])

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim()))
      const device = await addDevice(payload)
      const provisioned = await provisionDeviceToken(device.id)
      setToken(provisioned.device_token)
      setForm(initialForm)
      await loadDevices()
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect this meter.')
    } finally {
      setSaving(false)
    }
  }

  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
    } catch {
      setError('Copy the token manually from this screen.')
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 pb-20">
      <header className="sticky top-0 z-10 glass flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-white" aria-label="Go back"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-semibold text-white">Connect a meter</h1>
        <Cpu size={20} className="ml-auto text-electric" />
      </header>
      <main className="mx-auto max-w-[420px] space-y-5 px-4 py-6">
        <p className="text-sm leading-relaxed text-gray-400">Register your ESP32 meter using the device code configured on it. We will create a secure upload token for that meter.</p>
        {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
        {token && <section className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5"><div className="mb-2 flex items-center gap-2 text-green-300"><Check size={18} /><h2 className="font-semibold">Meter connected</h2></div><p className="mb-3 text-xs text-gray-300">Copy this upload token now. It is shown only once; store it securely in the meter configuration.</p><code className="block break-all rounded-lg bg-dark-900 p-3 text-xs text-white">{token}</code><button onClick={copyToken} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-electric"><Copy size={15} />{copied ? 'Copied' : 'Copy token'}</button></section>}
        <form onSubmit={handleSubmit} className="glass space-y-4 rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Plus size={17} className="text-electric" />New meter</h2>
          <label className="block text-xs text-gray-400">Meter name<input name="device_name" required maxLength="100" value={form.device_name} onChange={update} placeholder="Home main meter" className="mt-1.5 w-full rounded-xl border border-dark-500 bg-dark-700 px-4 py-3 text-sm text-white" /></label>
          <label className="block text-xs text-gray-400">Device code<input name="device_code" required pattern="[A-Za-z0-9_-]+" maxLength="20" value={form.device_code} onChange={update} placeholder="ESP32-001" className="mt-1.5 w-full rounded-xl border border-dark-500 bg-dark-700 px-4 py-3 text-sm text-white" /></label>
          <label className="block text-xs text-gray-400">Location (optional)<input name="location" maxLength="100" value={form.location} onChange={update} placeholder="Apartment 2B" className="mt-1.5 w-full rounded-xl border border-dark-500 bg-dark-700 px-4 py-3 text-sm text-white" /></label>
          <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-electric py-3 font-semibold text-white disabled:opacity-50">{saving && <LoaderCircle size={17} className="animate-spin" />}{saving ? 'Connecting…' : 'Connect meter'}</button>
        </form>
        <section className="glass rounded-2xl p-5"><h2 className="mb-3 text-sm font-semibold text-white">Your meters</h2>{loading ? <LoaderCircle size={20} className="animate-spin text-electric" /> : devices.length ? <div className="space-y-3">{devices.map((device) => <div key={device.id} className="rounded-xl bg-dark-700 p-3"><p className="font-medium text-white">{device.device_name}</p><p className="mt-1 text-xs text-gray-400">{device.device_code} · {device.location || 'No location'} · {device.status}</p></div>)}</div> : <p className="text-sm text-gray-400">No meters connected yet.</p>}</section>
      </main>
      <BottomNav active="" />
    </div>
  )
}
