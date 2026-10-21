'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function DemoForm() {
  const [f, setF] = useState({ name: '', company: '', phone: '', email: '', message: '', hp: '' })
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false)
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true)
    try {
      const r = await fetch('/api/df/public/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Could not send. Please try again.')
      setDone(true)
    } catch (err: any) { toast.error(err.message) } finally { setBusy(false) }
  }
  if (done) return <div className="rounded-2xl bg-white p-8 text-center text-slate-800 shadow-xl"><div className="text-2xl font-bold text-df-800">Thank you!</div><p className="mt-2 text-sm text-slate-600">We have your request and will contact you shortly to schedule your demo.</p></div>
  const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-df-500 focus:outline-none focus:ring-2 focus:ring-df-200'
  return <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-6 text-left shadow-xl">
    <input type="text" tabIndex={-1} autoComplete="off" className="hidden" value={f.hp} onChange={e => set('hp', e.target.value)} aria-hidden />
    <div className="grid gap-3 sm:grid-cols-2"><input required className={inp} placeholder="Your name *" value={f.name} onChange={e => set('name', e.target.value)} /><input className={inp} placeholder="Company" value={f.company} onChange={e => set('company', e.target.value)} />
      <input className={inp} placeholder="Phone (WhatsApp)" inputMode="tel" value={f.phone} onChange={e => set('phone', e.target.value)} /><input className={inp} type="email" placeholder="Email" value={f.email} onChange={e => set('email', e.target.value)} /></div>
    <textarea className={inp} rows={3} placeholder="Tell us about your business (products, number of dealers)" value={f.message} onChange={e => set('message', e.target.value)} />
    <button disabled={busy} className="w-full rounded-lg bg-df-700 px-4 py-3 text-sm font-semibold text-white hover:bg-df-800 disabled:opacity-60">{busy ? 'Sending...' : 'Book my free demo'}</button>
  </form>
}
