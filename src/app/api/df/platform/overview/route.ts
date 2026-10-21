import { NextResponse } from 'next/server'
import { guardSuper } from '@/lib/df/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardSuper()
  if (!g.ok) return g.res
  const c = (t: string, f?: (q: any) => any) => { const q = g.raw.from(t).select('id', { count: 'exact', head: true }); return (f ? f(q) : q).then((r: any) => r.count || 0) }
  const since = new Date(Date.now() - 7 * 864e5).toISOString()
  const [orgs, trial, active, suspended, users, new7, dealers, orders, demos] = await Promise.all([
    c('df_orgs'), c('df_orgs', q => q.eq('status', 'trial')), c('df_orgs', q => q.eq('status', 'active')), c('df_orgs', q => q.eq('status', 'suspended')),
    c('df_staff'), c('df_orgs', q => q.gte('created_at', since)), c('df_dealers'), c('df_orders'), c('df_demo_requests', q => q.eq('status', 'new')),
  ])
  return NextResponse.json({ orgs, trial, active, suspended, users, new_companies_7d: new7, dealers, orders, new_demo_requests: demos })
}
