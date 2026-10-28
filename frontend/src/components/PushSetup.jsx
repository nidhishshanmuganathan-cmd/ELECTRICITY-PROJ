import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { updateUserProfile } from '../api'
import { enablePushNotifications, pushEnabled } from '../notifications'

export default function PushSetup() {
  const { user, updateAppUser } = useAuth()
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  if (!user || done || pushEnabled()) return null
  async function save(event) {
    event.preventDefault()
    setBusy(true)
    try { const updated = await updateUserProfile({ phone }); updateAppUser(updated); setMessage('Phone saved. Now enable notifications.') }
    catch { setMessage('Could not save your number. Please retry.') }
    finally { setBusy(false) }
  }
  async function enable() {
    setBusy(true)
    const result = await enablePushNotifications()
    setBusy(false)
    if (result.ok) setDone(true)
    else setMessage(result.message)
  }
  return <section className="mx-auto max-w-[420px] rounded-xl border border-electric/30 bg-dark-800 p-4 text-sm text-white">
    <h2 className="font-semibold">Receive energy alerts on your phone</h2>
    <p className="my-2 text-xs text-gray-300">Install WattWatcher using your browser’s Add to Home Screen option. On iPhone, open the installed app before enabling alerts (iOS 16.4+).</p>
    {!user.appUser?.phone ? <form onSubmit={save}><label>Phone number<input required type="tel" autoComplete="tel" pattern="\+?[0-9 ()-]{10,20}" value={phone} onChange={e => setPhone(e.target.value)} className="my-2 w-full rounded bg-dark-700 p-2" /></label><button disabled={busy} className="text-electric">{busy ? 'Saving…' : 'Save phone number'}</button></form> : <button disabled={busy} onClick={enable} className="rounded bg-electric px-3 py-2 disabled:opacity-50">{busy ? 'Setting up…' : 'Enable notifications'}</button>}
    {message && <p role="status" className="mt-2 text-xs text-gray-300">{message}</p>}
  </section>
}
