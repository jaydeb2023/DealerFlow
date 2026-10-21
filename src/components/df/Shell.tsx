'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import * as Icons from 'lucide-react'
import { Menu, X, LogOut, Bell, Search } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { api, ApiError } from '@/lib/df/client'
import { NAV, ROLE_LABEL, defaultPath, canSee } from '@/lib/df/constants'
import Logo from './Logo'
import { OrgContext, StaffContext, type OrgMe, type StaffMe } from './Context'
import { Spinner, cx } from './ui'

const Icon = ({ name, className }: { name: string; className?: string }) => {
  const C = (Icons as any)[name] || Icons.Circle
  return <C className={className} />
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() || '/app'
  const [me, setMe] = useState<StaffMe | null>(null)
  const [org, setOrg] = useState<OrgMe | null>(null)
  const [dealerName, setDealerName] = useState('')
  const [unread, setUnread] = useState(0)
  const [isSuper, setIsSuper] = useState(false)
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')
  const [deniedMsg, setDeniedMsg] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api<any>('/api/df/me')
      .then(r => {
        setMe(r.staff); setOrg(r.org); setIsSuper(!!r.is_super); setUnread(r.unread || 0); setDealerName(r.dealer?.name || ''); setState('ok')
        if (!r.staff && r.is_super && !pathname.startsWith('/app/platform')) router.replace('/app/platform')
      })
      .catch((e: ApiError) => {
        if (e.status === 401) router.replace(`/app/login?next=${encodeURIComponent(pathname)}`)
        else { setDeniedMsg(e.message); setState('denied') }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // role-based route guard (the server checks are the real protection; this only keeps the UI tidy)
  useEffect(() => {
    if (!me || pathname.startsWith('/app/platform')) return
    const sub = pathname.replace(/^\/app/, '') || ''
    const parts = sub.split('/').filter(Boolean)
    const first = parts.length ? '/' + parts[0] : ''
    const key = first === '/portal' ? (parts[1] ? `/portal/${parts[1]}` : '/portal') : first
    if (me.role === 'dealer' && !first.startsWith('/portal') && first !== '/notifications') router.replace('/app/portal')
    else if (me.role !== 'dealer' && first === '/portal') router.replace(defaultPath(me.role))
    else if (me.role !== 'dealer' && key !== '' && NAV.some(n => n.href === key) && !canSee(me.role, key)) router.replace(defaultPath(me.role))
    else if (me.role !== 'dealer' && key === '' && !canSee(me.role, '')) router.replace(defaultPath(me.role))
  }, [me, pathname, router])

  useEffect(() => { setOpen(false) }, [pathname])
  const signOut = async () => { await supabase.auth.signOut(); router.replace('/app/login') }
  const onPlatform = pathname.startsWith('/app/platform')

  if (state === 'loading') return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>
  if (state === 'denied' || (!me && !(isSuper && onPlatform))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <h1 className="text-lg font-semibold text-slate-900">{deniedMsg.includes('suspended') ? 'Account suspended' : 'No access yet'}</h1>
          <p className="mt-2 text-sm text-slate-600">{deniedMsg || 'Your account is not set up for DealerFlow AI.'}</p>
          <button onClick={signOut} className="mt-4 rounded-lg bg-df-700 px-4 py-2 text-sm font-medium text-white hover:bg-df-800">Sign out</button>
        </div>
      </div>
    )
  }

  const items = me ? NAV.filter(n => n.roles.includes(me.role) || (me.role === 'admin' && !n.href.startsWith('/portal'))) : []
  const seen = new Set<string>()
  const uniq = items.filter(i => { const k = i.href + i.label; if (seen.has(k)) return false; seen.add(k); return true })
  const groups = Array.from(new Set(uniq.map(i => i.group)))
  const isActive = (href: string) => (href === '' ? pathname === '/app' : href === '/portal' ? pathname === '/app/portal' : pathname.startsWith('/app' + href))

  const sidebar = (
    <nav className="flex h-full flex-col bg-df-900 text-df-100">
      <div className="px-5 py-5"><Logo light /></div>
      {org && <div className="mx-4 mb-2 truncate rounded-md bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white">{me?.role === 'dealer' ? dealerName || org.name : org.name}</div>}
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map(g => (
          <div key={g}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-df-300/70">{g}</div>
            {uniq.filter(i => i.group === g).map(i => (
              <Link key={i.href + i.label} href={`/app${i.href}`}
                className={cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition', isActive(i.href) ? 'bg-df-600 font-semibold text-white' : 'text-df-100 hover:bg-white/10')}>
                <Icon name={i.icon} className="h-4 w-4 shrink-0" />{i.label}
                {i.label === 'Notifications' && unread > 0 && <span className="ml-auto rounded-full bg-cyan-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
              </Link>
            ))}
          </div>
        ))}
        {isSuper && (
          <div>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-df-300/70">Evynta</div>
            <Link href="/app/platform" className={cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm', onPlatform ? 'bg-df-600 font-semibold text-white' : 'text-df-100 hover:bg-white/10')}><Icons.ShieldCheck className="h-4 w-4" />Platform (all companies)</Link>
          </div>
        )}
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="truncate px-2 text-sm font-medium text-white">{me ? (me.full_name || me.email) : 'Platform owner'}</div>
        <div className="px-2 pb-2 text-xs text-df-300">{me ? ROLE_LABEL[me.role] : 'Super admin'}</div>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-df-100 hover:bg-white/10"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </nav>
  )

  const trialDays = org?.status === 'trial' && org.trial_ends_at ? Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 864e5) : null

  return (
    <OrgContext.Provider value={org}><StaffContext.Provider value={me as StaffMe}>
      <div className="min-h-screen bg-slate-50 text-slate-900 print:bg-white">
        <aside className="no-print fixed inset-y-0 left-0 hidden w-60 lg:block">{sidebar}</aside>
        {open && (
          <div className="no-print fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
          </div>
        )}
        <div className="lg:pl-60 print:pl-0">
          <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
            <button onClick={() => setOpen(o => !o)} aria-label="Menu" className="rounded-md p-1.5 hover:bg-slate-100 lg:hidden">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            <div className="lg:hidden"><Logo size={26} /></div>
            <div className="ml-auto flex items-center gap-2">
              {me && <Link href="/app/notifications" className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
                <Bell className="h-5 w-5" />{unread > 0 && <span className="absolute right-0.5 top-0 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
              </Link>}
              {me && <div className="hidden text-right sm:block"><div className="text-sm font-medium leading-tight">{me.full_name || me.email}</div><div className="text-[11px] text-slate-500">{ROLE_LABEL[me.role]}</div></div>}
            </div>
          </header>
          {trialDays !== null && me?.role !== 'dealer' && (
            <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
              Free trial: {trialDays > 0 ? `${trialDays} day${trialDays === 1 ? '' : 's'} left` : 'ended'}. To continue after the trial, contact Evynta.
            </div>
          )}
          <main className="mx-auto max-w-[1400px] p-4 sm:p-6 print:p-0">{children}</main>
        </div>
      </div>
    </StaffContext.Provider></OrgContext.Provider>
  )
}
