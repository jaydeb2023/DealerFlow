import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/df/server'
import { num } from '@/lib/df/util'

export const dynamic = 'force-dynamic'

/** Dealer list with outstanding balance, overdue amount and credit use. */
export async function GET(req: NextRequest) {
  const g = await guard(['sales_manager', 'sales_rep', 'finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const sp = req.nextUrl.searchParams
  let q = db.from('df_dealers').select('*, rep:df_staff!df_dealers_rep_id_fkey(id,full_name), territory:df_territories(id,name), price_list:df_price_lists(id,name)', { count: 'exact' })
  if (staff.role === 'sales_rep') q = q.eq('rep_id', staff.id)
  for (const f of ['status', 'rep_id', 'territory_id']) if (sp.get(f)) q = q.eq(f, sp.get(f)!)
  const term = (sp.get('q') || '').trim().replace(/[,()%]/g, ' ')
  if (term) q = q.or(['name', 'dealer_code', 'contact_person', 'phone', 'gstin'].map(c => `${c}.ilike.%${term}%`).join(','))
  const [{ data, error }, { data: bal }] = await Promise.all([q.order('name').limit(1000), db.rpc('df_dealer_balances', {})])
  if (error) return fail(error.message, 500)
  const bm = new Map<string, any>((bal || []).map((r: any) => [r.dealer_id, r]))
  let rows = (data || []).map((d: any) => {
    const b = bm.get(d.id) || {}
    const balance = num(b.balance), limit = num(d.credit_limit)
    return { ...d, balance, overdue: num(b.overdue), credit_used_pct: limit > 0 ? Math.round(Math.max(0, balance) / limit * 100) : null }
  })
  if (sp.get('only') === 'overdue') rows = rows.filter(r => r.overdue > 0)
  if (sp.get('only') === 'owing') rows = rows.filter(r => r.balance > 0)
  return NextResponse.json({ data: rows, count: rows.length })
}
