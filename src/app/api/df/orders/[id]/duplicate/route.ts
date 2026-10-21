import { NextRequest, NextResponse } from 'next/server'
import { guard, audit, nextNo } from '@/lib/df/server'
import { buildLines, errRes, getDealer, UserError } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'

/** Repeat order: copies the lines of an earlier order into a new DRAFT at today's prices. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales_manager', 'sales_rep', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  try {
    const { data: o } = await db.from('df_orders').select('*').eq('id', params.id).maybeSingle()
    if (!o) throw new UserError('Order not found', 404)
    if (staff.role === 'dealer' && o.dealer_id !== staff.dealer_id) throw new UserError('Order not found', 404)
    if (staff.role === 'sales_rep' && o.rep_id !== staff.id) throw new UserError('Order not found', 404)
    const dealer = await getDealer(db, o.dealer_id)
    if (!dealer || dealer.status !== 'active') throw new UserError('This dealer account is not active.', 403)
    const { data: items } = await db.from('df_order_items').select('product_id,qty').eq('order_id', o.id)
    const { lines, totals } = await buildLines(db, dealer, (items || []).map((i: any) => ({ product_id: i.product_id, qty: i.qty })), staff.role, 0)
    const order_no = await nextNo(db, 'order', 'ORD-', 5)
    const { data: id, error } = await g.raw.rpc('df_insert_order', { p_order: {
      org_id: g.org.id, order_no, dealer_id: dealer.id, rep_id: o.rep_id, status: 'draft', source: o.source, price_list_id: dealer.price_list_id,
      payment_terms_days: dealer.payment_terms_days, shipping_address: o.shipping_address, notes: `Repeat of ${o.order_no}`, created_by: staff.id,
      actor_name: staff.full_name || staff.email, ...totals }, p_items: lines })
    if (error) throw new UserError(error.message, 400)
    await audit(db, staff, 'df_orders', id, 'duplicate', { from: o.order_no })
    return NextResponse.json({ id, order_no })
  } catch (e) { return errRes(e) }
}
