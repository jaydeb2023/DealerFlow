import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/df/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(['sales_manager', 'warehouse', 'finance'])
  if (!g.ok) return g.res
  const sp = req.nextUrl.searchParams
  let q = g.db.from('df_dispatches').select('*, order:df_orders(id,order_no,dealer:df_dealers(id,name)), warehouse:df_warehouses(id,name)').order('created_at', { ascending: false }).limit(300)
  if (sp.get('status')) q = q.eq('status', sp.get('status')!)
  const { data, error } = await q
  if (error) return fail(error.message, 500)
  // approved orders still waiting to be dispatched
  const { data: pending } = await g.db.from('df_orders').select('id,order_no,status,total,requested_delivery,dealer:df_dealers(id,name),warehouse:df_warehouses(id,name)').in('status', ['approved', 'picking', 'packed', 'partially_fulfilled']).order('requested_delivery', { ascending: true, nullsFirst: false }).limit(300)
  return NextResponse.json({ data: data || [], pending: pending || [] })
}
