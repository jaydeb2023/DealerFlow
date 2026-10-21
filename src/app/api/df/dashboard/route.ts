import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/df/server'
import { SALES_STATUSES, defaultRange } from '@/lib/df/reports'
import { num, round2, todayISO } from '@/lib/df/util'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Every number here is counted from stored records for the chosen dates. */
export async function GET(req: NextRequest) {
  const g = await guard(['sales_manager', 'sales_rep', 'warehouse', 'finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const sp = req.nextUrl.searchParams
  const { from, to } = defaultRange(sp.get('from'), sp.get('to'))
  const own = staff.role === 'sales_rep'
  const today = todayISO()

  let oq = db.from('df_orders').select('id,order_no,status,order_date,total,dealer_id,rep_id,dealer:df_dealers(name)').neq('status', 'draft').gte('order_date', from).lte('order_date', to).limit(10000)
  if (own) oq = oq.eq('rep_id', staff.id)
  let dq = db.from('df_dealers').select('id,name,status,rep_id').limit(5000)
  if (own) dq = dq.eq('rep_id', staff.id)
  let pq = db.from('df_orders').select('id,order_no,status,total,created_at,dealer:df_dealers(name)').in('status', ['submitted', 'under_review']).order('created_at').limit(10)
  if (own) pq = pq.eq('rep_id', staff.id)
  let aq = db.from('df_orders').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'under_review'])
  let wq = db.from('df_orders').select('id', { count: 'exact', head: true }).in('status', ['approved', 'picking', 'packed', 'partially_fulfilled'])
  if (own) { aq = aq.eq('rep_id', staff.id); wq = wq.eq('rep_id', staff.id) }

  const [{ data: orders }, { data: dealers }, { data: pending }, { count: awaitingApproval }, { count: awaitingDispatch }, { data: bal }, { data: inv }, { data: history }, { data: follow }, { data: prods }, { data: stock }] = await Promise.all([
    oq, dq, pq, aq, wq,
    db.rpc('df_dealer_balances', {}),
    db.from('df_invoices').select('dealer_id,total,paid,due_date').in('status', ['open', 'partial']).limit(20000),
    db.from('df_order_history').select('id,to_status,note,actor_name,created_at,order:df_orders(id,order_no,rep_id)').order('created_at', { ascending: false }).limit(25),
    db.from('df_visits').select('id,notes,next_followup_at,dealer:df_dealers(id,name),rep_id').eq('followup_done', false).not('next_followup_at', 'is', null).lte('next_followup_at', today + 'T23:59:59').order('next_followup_at').limit(8),
    db.from('df_products').select('id,reorder_level').eq('active', true).gt('reorder_level', 0).limit(5000),
    db.from('df_inventory').select('product_id,on_hand,reserved').limit(50000),
  ])

  const dealerIds = new Set((dealers || []).map((d: any) => d.id))
  const sales = (orders || []).filter((o: any) => SALES_STATUSES.includes(o.status))
  const totalSales = round2(sales.reduce((s: number, o: any) => s + num(o.total), 0))

  const trend = new Map<string, number>()
  sales.forEach((o: any) => trend.set(o.order_date, (trend.get(o.order_date) || 0) + num(o.total)))
  const trendRows = Array.from(trend.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, sales: round2(v) }))

  const statusCount = new Map<string, number>(); (orders || []).forEach((o: any) => statusCount.set(o.status, (statusCount.get(o.status) || 0) + 1))

  const byDealer = new Map<string, { name: string; sales: number; orders: number }>()
  sales.forEach((o: any) => { const r = byDealer.get(o.dealer_id) || { name: o.dealer?.name || '-', sales: 0, orders: 0 }; r.sales += num(o.total); r.orders++; byDealer.set(o.dealer_id, r) })
  const topDealers = Array.from(byDealer.values()).sort((a, b) => b.sales - a.sales).slice(0, 5).map(r => ({ ...r, sales: round2(r.sales) }))

  const byProduct = new Map<string, { name: string; sales: number; qty: number }>()
  const ids = sales.map((o: any) => o.id)
  for (let i = 0; i < Math.min(ids.length, 1000); i += 200) {
    const { data: its } = await db.from('df_order_items').select('product_id,name,qty,line_total').in('order_id', ids.slice(i, i + 200)).limit(20000)
    ;(its || []).forEach((it: any) => { const r = byProduct.get(it.product_id) || { name: it.name, sales: 0, qty: 0 }; r.sales += num(it.line_total); r.qty += num(it.qty); byProduct.set(it.product_id, r) })
  }
  const topProducts = Array.from(byProduct.values()).sort((a, b) => b.sales - a.sales).slice(0, 6).map(r => ({ ...r, sales: round2(r.sales) }))

  const mine = (bal || []).filter((b: any) => dealerIds.has(b.dealer_id))
  const receivables = round2(mine.reduce((s: number, b: any) => s + Math.max(0, num(b.balance)), 0))
  const overdueInv = (inv || []).filter((i: any) => dealerIds.has(i.dealer_id) && i.due_date < today)
  const overdueAmt = round2(overdueInv.reduce((s: number, i: any) => s + num(i.total) - num(i.paid), 0))

  const totals = new Map<string, number>(); (stock || []).forEach((r: any) => totals.set(r.product_id, (totals.get(r.product_id) || 0) + num(r.on_hand) - num(r.reserved)))
  const lowStock = (prods || []).filter((p: any) => (totals.get(p.id) ?? 0) <= num(p.reorder_level)).length

  const activity = (history || []).filter((h: any) => !own || h.order?.rep_id === staff.id).slice(0, 8)
  return NextResponse.json({
    period: { from, to }, role: staff.role,
    metrics: { total_sales: totalSales, orders_received: (orders || []).length, awaiting_approval: awaitingApproval || 0, awaiting_dispatch: awaitingDispatch || 0, active_dealers: (dealers || []).filter((d: any) => d.status === 'active').length, receivables, overdue_invoices: overdueInv.length, overdue_amount: overdueAmt, low_stock: lowStock },
    trend: trendRows, status: Array.from(statusCount.entries()).map(([status, count]) => ({ status, count })), top_dealers: topDealers, top_products: topProducts,
    pending_approvals: pending || [], followups: (follow || []).filter((f: any) => !own || f.rep_id === staff.id), activity,
  })
}
