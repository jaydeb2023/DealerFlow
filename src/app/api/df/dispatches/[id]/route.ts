import { NextRequest, NextResponse } from 'next/server'
import { guard, audit, notify } from '@/lib/df/server'
import { errRes, UserError } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'

/** body: { status: 'delivered' | 'exception', delivered_on?, exception_note?, transporter?, vehicle_no?, tracking_no? } */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['warehouse', 'sales_manager'])
  if (!g.ok) return g.res
  const { db, staff } = g
  try {
    const b = await req.json().catch(() => ({}))
    const { data: d } = await db.from('df_dispatches').select('*').eq('id', params.id).maybeSingle()
    if (!d) throw new UserError('Dispatch not found', 404)
    const patch: Record<string, any> = {}
    for (const k of ['transporter', 'vehicle_no', 'tracking_no']) if (b[k] !== undefined) patch[k] = b[k] || null
    if (b.status) {
      if (!['dispatched', 'delivered', 'exception'].includes(b.status)) throw new UserError('Invalid status')
      patch.status = b.status
      if (b.status === 'delivered') patch.delivered_on = b.delivered_on || new Date().toISOString().slice(0, 10)
      if (b.status === 'exception') { if (!String(b.exception_note || '').trim()) throw new UserError('Describe the shortage, damage or problem.'); patch.exception_note = String(b.exception_note).slice(0, 500) }
    }
    const { error } = await db.from('df_dispatches').update(patch).eq('id', d.id)
    if (error) throw new UserError(error.message, 400)
    await audit(db, staff, 'df_dispatches', d.id, 'update', patch)
    const { data: o } = await db.from('df_orders').select('id,order_no,status,dealer_id').eq('id', d.order_id).single()
    if (b.status === 'delivered' && o) {
      // when every dispatch of a fully dispatched order is delivered, close the order
      const { data: all } = await db.from('df_dispatches').select('status').eq('order_id', o.id)
      if (o.status === 'dispatched' && (all || []).every((x: any) => x.status === 'delivered')) {
        await db.from('df_orders').update({ status: 'delivered' }).eq('id', o.id)
        await db.from('df_order_history').insert({ order_id: o.id, from_status: 'dispatched', to_status: 'delivered', note: 'All dispatches delivered', actor_id: staff.id, actor_name: staff.full_name || staff.email })
        const { data: dl } = await db.from('df_staff').select('id').eq('dealer_id', o.dealer_id).eq('active', true)
        await notify(db, { staffIds: (dl || []).map((r: any) => r.id), kind: 'order_delivered', title: `Order ${o.order_no} delivered`, link: `/app/portal/orders/${o.id}` })
      }
    }
    if (b.status === 'exception' && o) await notify(db, { roles: ['admin', 'sales_manager'], kind: 'delivery_exception', title: `Delivery problem on ${o.order_no}`, body: patch.exception_note, link: `/app/orders/${o.id}` })
    return NextResponse.json({ ok: true })
  } catch (e) { return errRes(e) }
}
