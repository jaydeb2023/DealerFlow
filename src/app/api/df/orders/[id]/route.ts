import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/df/server'
import { buildLines, errRes, getDealer, UserError } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales_manager', 'sales_rep', 'warehouse', 'finance', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { data: o } = await db.from('df_orders').select('*, dealer:df_dealers(id,name,dealer_code,phone,email,gstin,billing_address,shipping_address,credit_limit,payment_terms_days), warehouse:df_warehouses(id,name), rep:df_staff!df_orders_rep_id_fkey(id,full_name)').eq('id', params.id).maybeSingle()
  if (!o) return fail('Order not found', 404)
  if (staff.role === 'dealer' && o.dealer_id !== staff.dealer_id) return fail('Order not found', 404)
  if (staff.role === 'sales_rep' && o.rep_id !== staff.id) return fail('Order not found', 404)
  const [items, history, disp, inv] = await Promise.all([
    db.from('df_order_items').select('*').eq('order_id', o.id).order('name'),
    db.from('df_order_history').select('*').eq('order_id', o.id).order('created_at'),
    db.from('df_dispatches').select('*, items:df_dispatch_items(qty, order_item_id, product_id)').eq('order_id', o.id).order('created_at'),
    db.from('df_invoices').select('id,invoice_no,status,total,paid,due_date').eq('order_id', o.id).neq('status', 'void').maybeSingle(),
  ])
  if (staff.role === 'dealer') { delete o.internal_notes; delete o.credit_override_reason; delete o.credit_override }
  return NextResponse.json({ order: o, items: items.data || [], history: history.data || [], dispatches: disp.data || [], invoice: inv.data || null })
}

/** Amend an order that has not been approved yet. Every amendment is written to the order history. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales_manager', 'sales_rep', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  try {
    const { data: o } = await db.from('df_orders').select('*').eq('id', params.id).maybeSingle()
    if (!o) throw new UserError('Order not found', 404)
    if (staff.role === 'dealer' && o.dealer_id !== staff.dealer_id) throw new UserError('Order not found', 404)
    if (staff.role === 'sales_rep' && o.rep_id !== staff.id) throw new UserError('Order not found', 404)
    const editable = staff.role === 'dealer' ? ['draft'] : ['draft', 'submitted', 'under_review']
    if (!editable.includes(o.status)) throw new UserError(`An order that is ${o.status.replace('_', ' ')} can no longer be edited.`, 409)
    const b = await req.json().catch(() => ({}))
    const dealer = await getDealer(db, o.dealer_id)
    const { lines, totals } = await buildLines(db, dealer, b.items, staff.role, b.shipping !== undefined ? Number(b.shipping) || 0 : Number(o.shipping))
    const { data: oldItems } = await db.from('df_order_items').select('id').eq('order_id', o.id)
    const { data: ins, error: ie } = await db.from('df_order_items').insert(lines.map(l => ({ ...l, order_id: o.id }))).select('id')
    if (ie) throw new UserError(ie.message, 400)
    const oldIds = (oldItems || []).map((r: any) => r.id).filter((id: string) => !(ins || []).some((n: any) => n.id === id))
    if (oldIds.length) await db.from('df_order_items').delete().in('id', oldIds)
    const patch: Record<string, any> = { ...totals }
    if (b.requested_delivery !== undefined) patch.requested_delivery = b.requested_delivery || null
    if (b.shipping_address !== undefined) patch.shipping_address = String(b.shipping_address || '').slice(0, 500) || null
    if (b.notes !== undefined) patch.notes = String(b.notes || '').slice(0, 1000) || null
    if (b.internal_notes !== undefined && staff.role !== 'dealer') patch.internal_notes = String(b.internal_notes || '').slice(0, 1000) || null
    await db.from('df_orders').update(patch).eq('id', o.id)
    await db.from('df_order_history').insert({ order_id: o.id, from_status: o.status, to_status: o.status, note: `Order amended: ${lines.length} line(s), total ${Number(o.total).toLocaleString('en-IN')} to ${totals.total.toLocaleString('en-IN')}`, actor_id: staff.id, actor_name: staff.full_name || staff.email })
    await audit(db, staff, 'df_orders', o.id, 'amend', { from: o.total, to: totals.total })
    return NextResponse.json({ ok: true, ...totals })
  } catch (e) { return errRes(e) }
}
