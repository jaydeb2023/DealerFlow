import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, notify, nextNo } from '@/lib/df/server'
import { buildLines, errRes, getDealer, UserError } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'
const READ = ['sales_manager', 'sales_rep', 'warehouse', 'finance', 'dealer'] as const

export async function GET(req: NextRequest) {
  const g = await guard([...READ])
  if (!g.ok) return g.res
  const { db, staff } = g
  const sp = req.nextUrl.searchParams
  let q = db.from('df_orders').select('id,order_no,status,source,order_date,requested_delivery,total,stock_reserved,created_at,dealer:df_dealers(id,name,dealer_code),warehouse:df_warehouses(id,name),rep:df_staff!df_orders_rep_id_fkey(id,full_name)', { count: 'exact' })
  if (staff.role === 'dealer') q = q.eq('dealer_id', staff.dealer_id!)
  else if (staff.role === 'sales_rep') q = q.eq('rep_id', staff.id)
  else if (sp.get('dealer_id')) q = q.eq('dealer_id', sp.get('dealer_id')!)
  const st = sp.get('status')
  if (st) q = st === 'open' ? q.in('status', ['submitted', 'under_review', 'approved', 'picking', 'packed', 'partially_fulfilled']) : q.in('status', st.split(','))
  if (sp.get('from')) q = q.gte('order_date', sp.get('from')!)
  if (sp.get('to')) q = q.lte('order_date', sp.get('to')!)
  const term = (sp.get('q') || '').trim().replace(/[,()%]/g, ' ')
  if (term) q = q.ilike('order_no', `%${term}%`)
  const { data, error, count } = await q.order('created_at', { ascending: false }).limit(Math.min(Number(sp.get('limit') || 300), 1000))
  if (error) return fail(error.message, 500)
  return NextResponse.json({ data: data || [], count: count ?? 0 })
}

/** Create an order (draft or submitted). Prices, tax and totals are always computed here. */
export async function POST(req: NextRequest) {
  const g = await guard(['sales_manager', 'sales_rep', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  try {
    const b = await req.json().catch(() => ({}))
    const dealerId = staff.role === 'dealer' ? staff.dealer_id : String(b.dealer_id || '')
    if (!dealerId) throw new UserError('Choose a dealer.')
    const dealer = await getDealer(db, dealerId)
    if (!dealer) throw new UserError('Dealer not found.', 404)
    if (dealer.status !== 'active') throw new UserError(`This dealer account is ${dealer.status}. Orders cannot be placed.`, 403)
    if (staff.role === 'sales_rep' && dealer.rep_id !== staff.id) throw new UserError('This dealer is not assigned to you.', 403)

    const { lines, totals } = await buildLines(db, dealer, b.items, staff.role, Number(b.shipping) || 0)
    const submit = b.submit === true || b.submit === 'true'
    const order_no = await nextNo(db, 'order', 'ORD-', 5)
    const payload = {
      org_id: g.org.id, order_no, dealer_id: dealer.id, rep_id: dealer.rep_id || (staff.role === 'sales_rep' ? staff.id : null),
      status: submit ? 'submitted' : 'draft', source: staff.role === 'dealer' ? 'dealer' : staff.role === 'sales_rep' ? 'rep' : 'admin',
      requested_delivery: b.requested_delivery || null, price_list_id: dealer.price_list_id, payment_terms_days: dealer.payment_terms_days,
      shipping_address: String(b.shipping_address || dealer.shipping_address || dealer.billing_address || '').slice(0, 500) || null,
      notes: String(b.notes || '').slice(0, 1000) || null, internal_notes: staff.role === 'dealer' ? null : (String(b.internal_notes || '').slice(0, 1000) || null),
      warehouse_id: null, created_by: staff.id, actor_name: staff.full_name || staff.email, ...totals,
    }
    const { data: id, error } = await g.raw.rpc('df_insert_order', { p_order: payload, p_items: lines })
    if (error) throw new UserError(error.message, 400)
    await audit(db, staff, 'df_orders', id, 'create', { order_no, total: totals.total, status: payload.status })
    if (submit) await notify(db, { roles: ['admin', 'sales_manager'], kind: 'order_submitted', title: `New order ${order_no}`, body: `${dealer.name}: ${totals.total.toLocaleString('en-IN')} awaiting approval.`, link: `/app/orders/${id}` })
    return NextResponse.json({ id, order_no, status: payload.status, ...totals })
  } catch (e) { return errRes(e) }
}
