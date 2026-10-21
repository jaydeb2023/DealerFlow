import { NextRequest, NextResponse } from 'next/server'
import { guard, audit, notify } from '@/lib/df/server'
import { ORDER_NEXT, ORDER_MOVE_ROLES, type OrderStatus } from '@/lib/df/constants'
import { companySettings, dealerBalance, errRes, lowStockCheck, UserError } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'

/**
 * Move an order through its lifecycle.
 * body: { to, note?, warehouse_id?, reject_reason?, override_credit?, override_reason? }
 * Approving reserves stock (all-or-nothing) and runs the credit check; cancelling/rejecting releases the reservation.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales_manager', 'sales_rep', 'warehouse', 'finance', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff, org } = g
  try {
    const b = await req.json().catch(() => ({}))
    const to = String(b.to || '') as OrderStatus
    const { data: o } = await db.from('df_orders').select('*, dealer:df_dealers(id,name,credit_limit)').eq('id', params.id).maybeSingle()
    if (!o) throw new UserError('Order not found', 404)
    if (staff.role === 'dealer' && o.dealer_id !== staff.dealer_id) throw new UserError('Order not found', 404)
    if (staff.role === 'sales_rep' && o.rep_id !== staff.id) throw new UserError('Order not found', 404)
    if (!(ORDER_NEXT[o.status as OrderStatus] || []).includes(to)) throw new UserError(`An order that is ${o.status.replace('_', ' ')} cannot move to ${to.replace('_', ' ')}.`, 409)
    const allowed = ORDER_MOVE_ROLES[to] || []
    if (staff.role !== 'admin' && !allowed.includes(staff.role)) throw new UserError('You do not have permission for this step.', 403)
    if (staff.role === 'dealer' && !(to === 'submitted' || (to === 'cancelled' && ['draft', 'submitted'].includes(o.status)))) throw new UserError('You do not have permission for this step.', 403)
    if (staff.role === 'sales_rep' && !['submitted', 'cancelled'].includes(to)) throw new UserError('You do not have permission for this step.', 403)

    const patch: Record<string, any> = { status: to }
    let note: string | null = b.note ? String(b.note).slice(0, 500) : null

    if (to === 'submitted') patch.submitted_at = new Date().toISOString()

    if (to === 'approved') {
      const cfg = await companySettings(db)
      // warehouse
      let wh = String(b.warehouse_id || o.warehouse_id || '')
      if (!wh) {
        const { data: whs } = await db.from('df_warehouses').select('id').eq('active', true)
        if (whs?.length === 1) wh = whs[0].id
      }
      if (!wh) throw new UserError('Choose the warehouse that will supply this order.', 400, 'WAREHOUSE_REQUIRED')
      // credit check
      const limit = Number(o.dealer?.credit_limit || 0)
      if (cfg.require_credit_check !== false && limit > 0) {
        const bal = await dealerBalance(db, o.dealer_id)
        // invoiced orders are already inside the balance; only add approved orders that have no live invoice yet
        const { data: invd } = await db.from('df_invoices').select('order_id').eq('dealer_id', o.dealer_id).neq('status', 'void')
        const invoicedIds = new Set((invd || []).map((r: any) => r.order_id))
        const { data: pend2 } = await db.from('df_orders').select('id,total').eq('dealer_id', o.dealer_id).in('status', ['approved', 'picking', 'packed', 'partially_fulfilled', 'dispatched', 'delivered']).neq('id', o.id)
        const open = (pend2 || []).filter((r: any) => !invoicedIds.has(r.id)).reduce((s: number, r: any) => s + Number(r.total), 0)
        const exposure = bal.balance + open + Number(o.total)
        if (exposure > limit) {
          if (!b.override_credit) throw new UserError(`Credit limit exceeded: dealer would owe ${exposure.toLocaleString('en-IN')} against a limit of ${limit.toLocaleString('en-IN')}.`, 409, 'CREDIT_LIMIT', { exposure, limit, can_override: staff.role === 'admin' })
          if (staff.role !== 'admin') throw new UserError('Only the company owner/admin can approve a credit exception.', 403, 'CREDIT_LIMIT')
          if (!String(b.override_reason || '').trim()) throw new UserError('Enter a reason for the credit exception.', 400, 'CREDIT_LIMIT', { can_override: true })
          patch.credit_override = true; patch.credit_override_reason = String(b.override_reason).slice(0, 300)
          note = `Credit exception approved (${patch.credit_override_reason})`
          await audit(db, staff, 'df_orders', o.id, 'credit_override', { exposure, limit, reason: patch.credit_override_reason })
        }
      }
      const { error: re } = await db.rpc('df_reserve_order', { p_order: o.id, p_warehouse: wh })
      if (re) throw new UserError(re.message, 409, 'STOCK')
      patch.approved_at = new Date().toISOString(); patch.approved_by = staff.id
    }

    if (to === 'rejected') {
      if (!String(b.reject_reason || b.note || '').trim()) throw new UserError('Enter the reason for rejecting this order.')
      patch.reject_reason = String(b.reject_reason || b.note).slice(0, 300)
      note = patch.reject_reason
    }
    if (to === 'cancelled' || to === 'rejected') await db.rpc('df_release_order', { p_order: o.id })

    const { error } = await db.from('df_orders').update(patch).eq('id', o.id)
    if (error) throw new UserError(error.message, 400)
    await db.from('df_order_history').insert({ order_id: o.id, from_status: o.status, to_status: to, note, actor_id: staff.id, actor_name: staff.full_name || staff.email })
    await audit(db, staff, 'df_orders', o.id, `status_${to}`, { from: o.status, note })

    // notifications
    const { data: dealerLogins } = await db.from('df_staff').select('id').eq('dealer_id', o.dealer_id).eq('active', true)
    const dealerIds = (dealerLogins || []).map((r: any) => r.id)
    if (to === 'submitted') await notify(db, { roles: ['admin', 'sales_manager'], kind: 'order_submitted', title: `New order ${o.order_no}`, body: `${o.dealer?.name} is awaiting approval.`, link: `/app/orders/${o.id}` })
    if (['approved', 'rejected', 'delivered', 'cancelled'].includes(to) && staff.role !== 'dealer')
      await notify(db, { staffIds: dealerIds, kind: `order_${to}`, title: `Order ${o.order_no} ${to}`, body: to === 'rejected' ? patch.reject_reason : undefined, link: `/app/portal/orders/${o.id}` })
    if (to === 'approved') {
      await notify(db, { roles: ['warehouse'], kind: 'order_approved', title: `Order ${o.order_no} approved`, body: 'Ready for picking.', link: `/app/orders/${o.id}` })
      const { data: its } = await db.from('df_order_items').select('product_id').eq('order_id', o.id)
      await lowStockCheck(db, (its || []).map((r: any) => r.product_id))
    }
    void org
    return NextResponse.json({ ok: true, status: to })
  } catch (e) { return errRes(e) }
}
