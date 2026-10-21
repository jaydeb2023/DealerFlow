import { NextRequest, NextResponse } from 'next/server'
import { guard, audit, notify } from '@/lib/df/server'
import { errRes, lowStockCheck, UserError } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'

/** Record a dispatch. body: { lines: [{order_item_id, qty}], transporter, vehicle_no, tracking_no, date } */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['warehouse', 'sales_manager'])
  if (!g.ok) return g.res
  const { db, staff } = g
  try {
    const b = await req.json().catch(() => ({}))
    const lines = (Array.isArray(b.lines) ? b.lines : []).map((l: any) => ({ order_item_id: String(l.order_item_id), qty: Number(l.qty) })).filter((l: any) => l.qty > 0)
    if (!lines.length) throw new UserError('Enter the quantity to dispatch for at least one product.')
    const { data: o } = await db.from('df_orders').select('id,order_no,dealer_id,status').eq('id', params.id).maybeSingle()
    if (!o) throw new UserError('Order not found', 404)
    const { data, error } = await db.rpc('df_dispatch_order', {
      p_order: o.id, p_lines: lines, p_transporter: b.transporter || null, p_vehicle: b.vehicle_no || null, p_tracking: b.tracking_no || null,
      p_date: b.date || null, p_user: staff.id,
    })
    if (error) throw new UserError(error.message, 409)
    const res = data as any
    await db.from('df_order_history').insert({ order_id: o.id, from_status: o.status, to_status: res.complete ? 'dispatched' : 'partially_fulfilled', note: `Dispatch ${res.dispatch_no}${b.transporter ? ' via ' + b.transporter : ''}${b.vehicle_no ? ' (' + b.vehicle_no + ')' : ''}`, actor_id: staff.id, actor_name: staff.full_name || staff.email })
    await audit(db, staff, 'df_dispatches', res.dispatch_id, 'create', { order: o.order_no, lines })
    const { data: dl } = await db.from('df_staff').select('id').eq('dealer_id', o.dealer_id).eq('active', true)
    await notify(db, { staffIds: (dl || []).map((r: any) => r.id), kind: 'order_dispatched', title: `Order ${o.order_no} ${res.complete ? 'dispatched' : 'partly dispatched'}`, body: [b.transporter, b.tracking_no && `Tracking ${b.tracking_no}`].filter(Boolean).join(' · ') || undefined, link: `/app/portal/orders/${o.id}` })
    const { data: its } = await db.from('df_order_items').select('product_id').eq('order_id', o.id)
    await lowStockCheck(db, (its || []).map((r: any) => r.product_id))
    return NextResponse.json(res)
  } catch (e) { return errRes(e) }
}
