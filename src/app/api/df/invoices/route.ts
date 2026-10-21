import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/df/server'
import { todayISO } from '@/lib/df/util'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(['sales_manager', 'finance', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const sp = req.nextUrl.searchParams
  let q = db.from('df_invoices').select('id,invoice_no,invoice_date,due_date,total,paid,status,order_id,dealer:df_dealers(id,name,dealer_code),order:df_orders(order_no)', { count: 'exact' })
  if (staff.role === 'dealer') q = q.eq('dealer_id', staff.dealer_id!)
  else if (sp.get('dealer_id')) q = q.eq('dealer_id', sp.get('dealer_id')!)
  const st = sp.get('status')
  if (st === 'unpaid') q = q.in('status', ['open', 'partial'])
  else if (st === 'overdue') q = q.in('status', ['open', 'partial']).lt('due_date', todayISO())
  else if (st) q = q.eq('status', st)
  if (sp.get('from')) q = q.gte('invoice_date', sp.get('from')!)
  if (sp.get('to')) q = q.lte('invoice_date', sp.get('to')!)
  const term = (sp.get('q') || '').trim().replace(/[,()%]/g, ' ')
  if (term) q = q.ilike('invoice_no', `%${term}%`)
  const { data, error, count } = await q.order('invoice_date', { ascending: false }).order('created_at', { ascending: false }).limit(500)
  if (error) return fail(error.message, 500)
  return NextResponse.json({ data: data || [], count: count ?? 0 })
}
