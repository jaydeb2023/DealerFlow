'use client'
import Logo from '@/components/df/Logo'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { Button, Field, Input } from '@/components/df/ui'

function Form() {
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get('next') || '/app'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [company, setCompany] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Enter email and password')
    if (mode === 'signup' && company.trim().length < 2) return toast.error('Enter your company name')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { company_name: company.trim() } } })
        if (error) throw error
        if (!data.session) { toast.success('Account created. Check your email to confirm, then sign in.'); setMode('login') }
        else router.push(next)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push(next)
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not sign in')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-df-950 via-df-900 to-df-700 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-7 shadow-2xl">
        <div className="text-center">
          <div className="flex justify-center"><Logo size={44} tagline /></div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-gray-400">Dealer &amp; distributor management</div>
        </div>
        {mode === 'signup' && <Field label="Company name"><Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Your company name" /></Field>}
        <Field label="Email"><Input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
        <Field label="Password"><Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></Field>
        <Button type="submit" variant="primary" className="w-full" loading={busy}>{mode === 'login' ? 'Sign in' : 'Start free trial'}</Button>
        <p className="text-center text-xs text-gray-500">
          {mode === 'login' ? 'New company? ' : 'Already have an account? '}
          <button type="button" className="font-medium text-df-700 hover:underline" onClick={() => setMode(m => (m === 'login' ? 'signup' : 'login'))}>
            {mode === 'login' ? 'Start a 14-day free trial' : 'Sign in'}
          </button>
        </p>
        <p className="text-center text-[11px] leading-snug text-gray-400">Creating an account sets up your own private company workspace. You become its admin and add your team under Settings.</p>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><Form /></Suspense>
}
