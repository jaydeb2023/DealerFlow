// Report engine. Every figure comes from stored records; nothing is estimated.
// "Sales" = orders from approval onwards (approved, picking, packed, dispatched, delivered), amounts include GST.
import type { Db } from './server'
import { num, round2, todayISO, addDays, daysBetween } from './util'

export const SALES_STATUSES = ['approved', 'picking', 'packed', 'partially_fulfilled', 'dispatched', 'delivered']

export interface Report {
  title: string
  columns: { key: string; label: string; type?: 'money' | 'number' | 'date' | 'text' | 'pct' }[]
  rows: Record<string, any>[]
  summary?: { label: string; value: string | number }[]
  period?: { from: string; to: string }
  note?: string
}
export interface Scope { role: string; staffId: string }

const dealerMap = async (db: Db, scope?: Scope) => {
  let q = db.from('df_dealers').select('id,name,dealer_code,territory_id,rep_id,status,credit_limit').limit(5000)
  if (scope?.role === 'sales_rep') q = q.eq('rep_id', scope.staffId)
  const { data } = await q
  return new Map<string, any>((data || []).map((d: any) => [d.id, d]))
}

async function salesOrders(db: Db, from: string, to: string, scope?: Scope) {
  let q = db.from('df_orders').select('id,order_no,status,order_date,total,dealer_id,rep_id,approved_at').in('status', SALES_STATUSES).gte('order_date', from).lte('order_date', to).limit(10000)
  if (scope?.role === 'sales_rep') q = q.eq('rep_id', scope.staffId)
  const { data } = await q
  return (data || []) as any[]
}

export function defaultRange(from?: string | null, to?: string | null) {
  const t = to || todayISO()
  return { from: from || addDays(t, -29), to: t }
}

export const REPORT_KINDS = ['sales_trend', 'sales_by_dealer', 'sales_by_product', 'sales_by_territory', 'dealer_frequency', 'fulfilment', 'inventory', 'ageing', 'collections', 'rep_performance'] as const
export type ReportKind = typeof REPORT_KINDS[number]

export async function runReport(db: Db, kind: string, p: { from?: string | null; to?: string | null; group?: string | null }, scope?: Scope): Promise<Report> {
  const { from, to } = defaultRange(p.from, p.to)
  const period = { from, to }

  if (kind === 'sales_trend') {
    const orders = await salesOrders(db, from, to, scope)
    const g = p.group === 'month' ? 'month' : p.group === 'week' ? 'week' : 'day'
    const key = (d: string) => g === 'month' ? d.slice(0, 7) : g === 'week' ? (() => { const dt = new Date(d + 'T00:00:00Z'); const day = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - day); return dt.toISOString().slice(0, 10) })() : d
    const m = new Map<string, { orders: number; sales: number }>()
    orders.forEach(o => { const k = key(o.order_date); const r = m.get(k) || { orders: 0, sales: 0 }; r.orders++; r.sales += num(o.total); m.set(k, r) })
    const rows = Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([period_, r]) => ({ period: period_, orders: r.orders, sales: round2(r.sales) }))
    return { title: `Sales by ${g}`, columns: [{ key: 'period', label: g === 'month' ? 'Month' : g === 'week' ? 'Week starting' : 'Date', type: 'text' }, { key: 'orders', label: 'Orders', type: 'number' }, { key: 'sales', label: 'Sales (incl. GST)', type: 'money' }], rows, period,
      summary: [{ label: 'Orders', value: orders.length }, { label: 'Sales', value: round2(orders.reduce((s, o) => s + num(o.total), 0)) }] }
  }

  if (kind === 'sales_by_dealer' || kind === 'sales_by_territory') {
    const [orders, dealers] = await Promise.all([salesOrders(db, from, to, scope), dealerMap(db, scope)])
    const terr = new Map<string, string>(((await db.from('df_territories').select('id,name')).data || []).map((t: any) => [t.id, t.name]))
    const m = new Map<string, any>()
    orders.forEach(o => {
      const d = dealers.get(o.dealer_id); if (!d && scope?.role === 'sales_rep') return
      const k = kind === 'sales_by_dealer' ? o.dealer_id : (d?.territory_id || 'none')
      const r = m.get(k) || { name: kind === 'sales_by_dealer' ? `${d?.name || 'Unknown'}` : (terr.get(k) || 'No territory'), code: d?.dealer_code, orders: 0, sales: 0, dealers: new Set<string>() }
      r.orders++; r.sales += num(o.total); r.dealers.add(o.dealer_id); m.set(k, r)
    })
    const total = Array.from(m.values()).reduce((s, r) => s + r.sales, 0)
    const rows = Array.from(m.values()).sort((a, b) => b.sales - a.sales).map(r => ({ name: r.name, code: r.code, dealers: r.dealers.size, orders: r.orders, sales: round2(r.sales), share: total ? round2(r.sales / total * 100) : 0, avg: r.orders ? round2(r.sales / r.orders) : 0 }))
    const cols: Report['columns'] = kind === 'sales_by_dealer'
      ? [{ key: 'name', label: 'Dealer' }, { key: 'code', label: 'Code' }, { key: 'orders', label: 'Orders', type: 'number' }, { key: 'sales', label: 'Sales (incl. GST)', type: 'money' }, { key: 'avg', label: 'Avg order', type: 'money' }, { key: 'share', label: 'Share %', type: 'pct' }]
      : [{ key: 'name', label: 'Territory' }, { key: 'dealers', label: 'Active dealers', type: 'number' }, { key: 'orders', label: 'Orders', type: 'number' }, { key: 'sales', label: 'Sales (incl. GST)', type: 'money' }, { key: 'share', label: 'Share %', type: 'pct' }]
    return { title: kind === 'sales_by_dealer' ? 'Sales by dealer' : 'Sales by territory', columns: cols, rows, period, summary: [{ label: 'Total sales', value: round2(total) }] }
  }

  if (kind === 'sales_by_product') {
    const orders = await salesOrders(db, from, to, scope)
    const ids = orders.map(o => o.id)
    const m = new Map<string, any>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from('df_order_items').select('product_id,sku,name,unit,qty,line_total').in('order_id', ids.slice(i, i + 200)).limit(20000)
      ;(data || []).forEach((it: any) => { const r = m.get(it.product_id) || { sku: it.sku, name: it.name, unit: it.unit, qty: 0, sales: 0 }; r.qty += num(it.qty); r.sales += num(it.line_total); m.set(it.product_id, r) })
    }
    const total = Array.from(m.values()).reduce((s, r) => s + r.sales, 0)
    const rows = Array.from(m.values()).sort((a, b) => b.sales - a.sales).map(r => ({ ...r, sales: round2(r.sales), share: total ? round2(r.sales / total * 100) : 0 }))
    return { title: 'Sales by product', columns: [{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'Product' }, { key: 'unit', label: 'Unit' }, { key: 'qty', label: 'Qty sold', type: 'number' }, { key: 'sales', label: 'Sales (incl. GST)', type: 'money' }, { key: 'share', label: 'Share %', type: 'pct' }], rows, period, summary: [{ label: 'Total', value: round2(total) }] }
  }

  if (kind === 'dealer_frequency') {
    const dealers = await dealerMap(db, scope)
    const { data: all } = await db.from('df_orders').select('dealer_id,order_date').in('status', SALES_STATUSES).order('order_date', { ascending: false }).limit(20000)
    const last = new Map<string, string>(); const inRange = new Map<string, number>()
    ;(all || []).forEach((o: any) => { if (!last.has(o.dealer_id)) last.set(o.dealer_id, o.order_date); if (o.order_date >= from && o.order_date <= to) inRange.set(o.dealer_id, (inRange.get(o.dealer_id) || 0) + 1) })
    const days = Math.max(1, daysBetween(from, to) + 1)
    const rows = Array.from(dealers.values()).filter(d => d.status === 'active').map(d => {
      const l = last.get(d.id) || null, n = inRange.get(d.id) || 0
      return { name: d.name, code: d.dealer_code, orders: n, per_month: round2(n / days * 30), last_order: l, days_since: l ? daysBetween(l, todayISO()) : null }
    }).sort((a, b) => (b.days_since ?? 99999) - (a.days_since ?? 99999))
    return { title: 'Dealer order frequency', columns: [{ key: 'name', label: 'Dealer' }, { key: 'code', label: 'Code' }, { key: 'orders', label: 'Orders in period', type: 'number' }, { key: 'per_month', label: 'Orders / month', type: 'number' }, { key: 'last_order', label: 'Last order', type: 'date' }, { key: 'days_since', label: 'Days since last order', type: 'number' }], rows, period, note: 'Sorted with the dealers who have not ordered for longest first.' }
  }

  if (kind === 'fulfilment') {
    const { data: os } = await db.from('df_orders').select('id,order_no,status,approved_at,dealer:df_dealers(name)').in('status', SALES_STATUSES).gte('approved_at', from).lte('approved_at', to + 'T23:59:59').limit(5000)
    const ids = (os || []).map((o: any) => o.id)
    const first = new Map<string, string>()
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await db.from('df_dispatches').select('order_id,created_at').in('order_id', ids.slice(i, i + 200)).order('created_at')
      ;(data || []).forEach((d: any) => { if (!first.has(d.order_id)) first.set(d.order_id, d.created_at) })
    }
    const now = Date.now()
    const rows = (os || []).map((o: any) => {
      const a = new Date(o.approved_at).getTime(), f = first.get(o.id) ? new Date(first.get(o.id)!).getTime() : null
      const hours = round2(((f ?? now) - a) / 3600e3)
      return { order_no: o.order_no, dealer: o.dealer?.name, status: o.status, approved: o.approved_at?.slice(0, 10), dispatched: f ? new Date(f).toISOString().slice(0, 10) : null, hours, state: f ? (hours <= 48 ? 'On time' : 'Late') : (hours > 48 ? 'Overdue for dispatch' : 'Waiting') }
    }).sort((a, b) => b.hours - a.hours)
    const done = rows.filter(r => r.dispatched), onTime = done.filter(r => r.hours <= 48).length
    return { title: 'Order fulfilment performance', columns: [{ key: 'order_no', label: 'Order' }, { key: 'dealer', label: 'Dealer' }, { key: 'status', label: 'Status' }, { key: 'approved', label: 'Approved', type: 'date' }, { key: 'dispatched', label: 'First dispatch', type: 'date' }, { key: 'hours', label: 'Hours to dispatch', type: 'number' }, { key: 'state', label: 'Result' }], rows, period,
      summary: [{ label: 'Orders approved', value: rows.length }, { label: 'Dispatched', value: done.length }, { label: 'On time (within 48h)', value: done.length ? `${Math.round(onTime / done.length * 100)}%` : '-' }, { label: 'Overdue for dispatch', value: rows.filter(r => r.state === 'Overdue for dispatch').length }] }
  }

  if (kind === 'inventory') {
    const [{ data: prods }, { data: inv }] = await Promise.all([db.from('df_products').select('id,sku,name,unit,reorder_level').eq('active', true).order('name').limit(5000), db.from('df_inventory').select('product_id,on_hand,reserved').limit(50000)])
    const t = new Map<string, { o: number; r: number }>()
    ;(inv || []).forEach((r: any) => { const x = t.get(r.product_id) || { o: 0, r: 0 }; x.o += num(r.on_hand); x.r += num(r.reserved); t.set(r.product_id, x) })
    const rows = (prods || []).map((p: any) => { const x = t.get(p.id) || { o: 0, r: 0 }; const a = x.o - x.r; return { sku: p.sku, name: p.name, unit: p.unit, on_hand: x.o, reserved: x.r, available: a, reorder_level: num(p.reorder_level), status: a <= 0 ? 'Out of stock' : (num(p.reorder_level) > 0 && a <= num(p.reorder_level)) ? 'Low stock' : 'OK' } })
      .sort((a, b) => (a.status === 'OK' ? 1 : 0) - (b.status === 'OK' ? 1 : 0) || a.available - b.available)
    return { title: 'Inventory and low-stock', columns: [{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'Product' }, { key: 'unit', label: 'Unit' }, { key: 'on_hand', label: 'On hand', type: 'number' }, { key: 'reserved', label: 'Reserved', type: 'number' }, { key: 'available', label: 'Available', type: 'number' }, { key: 'reorder_level', label: 'Reorder level', type: 'number' }, { key: 'status', label: 'Status' }], rows,
      summary: [{ label: 'Low stock', value: rows.filter(r => r.status === 'Low stock').length }, { label: 'Out of stock', value: rows.filter(r => r.status === 'Out of stock').length }], note: 'Stock is a current position, not limited by the date range.' }
  }

  if (kind === 'ageing') {
    const dealers = await dealerMap(db, scope)
    const { data: invs } = await db.from('df_invoices').select('dealer_id,invoice_no,total,paid,due_date').in('status', ['open', 'partial']).limit(20000)
    const today = todayISO(); const m = new Map<string, any>()
    ;(invs || []).forEach((i: any) => {
      const d = dealers.get(i.dealer_id); if (!d) return
      const out = num(i.total) - num(i.paid); const late = daysBetween(i.due_date, today)
      const r = m.get(i.dealer_id) || { name: d.name, code: d.dealer_code, current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, total: 0 }
      if (late <= 0) r.current += out; else if (late <= 30) r.d30 += out; else if (late <= 60) r.d60 += out; else if (late <= 90) r.d90 += out; else r.d90p += out
      r.total += out; m.set(i.dealer_id, r)
    })
    const rows = Array.from(m.values()).sort((a, b) => b.total - a.total).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? round2(v) : v])))
    const sum = (k: string) => round2(rows.reduce((s: number, r: any) => s + r[k], 0))
    return { title: 'Outstanding and ageing', columns: [{ key: 'name', label: 'Dealer' }, { key: 'code', label: 'Code' }, { key: 'current', label: 'Not yet due', type: 'money' }, { key: 'd30', label: '1-30 days late', type: 'money' }, { key: 'd60', label: '31-60', type: 'money' }, { key: 'd90', label: '61-90', type: 'money' }, { key: 'd90p', label: '90+', type: 'money' }, { key: 'total', label: 'Total unpaid', type: 'money' }], rows,
      summary: [{ label: 'Total unpaid invoices', value: sum('total') }, { label: 'Overdue', value: round2(sum('total') - sum('current')) }], note: 'Unpaid invoice balances only. Opening balances and unallocated advances are on each dealer statement.' }
  }

  if (kind === 'collections') {
    const dealers = await dealerMap(db, scope)
    const { data: pays } = await db.from('df_payments').select('receipt_no,dealer_id,amount,mode,paid_on,reference').gte('paid_on', from).lte('paid_on', to).order('paid_on', { ascending: false }).limit(10000)
    const rows = (pays || []).filter((p: any) => dealers.has(p.dealer_id)).map((p: any) => ({ date: p.paid_on, receipt: p.receipt_no, dealer: dealers.get(p.dealer_id)?.name, mode: String(p.mode).replace('_', ' '), reference: p.reference, amount: num(p.amount) }))
    const byMode = new Map<string, number>(); rows.forEach(r => byMode.set(r.mode, (byMode.get(r.mode) || 0) + r.amount))
    return { title: 'Payment collections', columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'receipt', label: 'Receipt' }, { key: 'dealer', label: 'Dealer' }, { key: 'mode', label: 'Mode' }, { key: 'reference', label: 'Reference' }, { key: 'amount', label: 'Amount', type: 'money' }], rows, period,
      summary: [{ label: 'Total collected', value: round2(rows.reduce((s, r) => s + r.amount, 0)) }, ...Array.from(byMode.entries()).map(([k, v]) => ({ label: k, value: round2(v) }))] }
  }

  if (kind === 'rep_performance') {
    const { data: reps } = await db.from('df_staff').select('id,full_name,role').in('role', ['sales_rep', 'sales_manager']).eq('active', true)
    const { data: dealers } = await db.from('df_dealers').select('id,rep_id').limit(5000)
    const repOf = new Map<string, string>((dealers || []).filter((d: any) => d.rep_id).map((d: any) => [d.id, d.rep_id]))
    const orders = await salesOrders(db, from, to)
    const { data: pays } = await db.from('df_payments').select('dealer_id,amount').gte('paid_on', from).lte('paid_on', to).limit(20000)
    const { data: vis } = await db.from('df_visits').select('rep_id').gte('visited_at', from).lte('visited_at', to + 'T23:59:59').limit(20000)
    const month = to.slice(0, 7)
    const { data: tg } = await db.from('df_targets').select('rep_id,sales_target,collection_target').eq('period', month)
    const tgt = new Map<string, any>((tg || []).map((t: any) => [t.rep_id, t]))
    let list = reps || []
    if (scope?.role === 'sales_rep') list = list.filter((r: any) => r.id === scope.staffId)
    const rows = list.map((r: any) => {
      const sales = orders.filter(o => (o.rep_id || repOf.get(o.dealer_id)) === r.id).reduce((s, o) => s + num(o.total), 0)
      const coll = (pays || []).filter((p: any) => repOf.get(p.dealer_id) === r.id).reduce((s: number, p: any) => s + num(p.amount), 0)
      const t = tgt.get(r.id)
      return { name: r.full_name, orders: orders.filter(o => (o.rep_id || repOf.get(o.dealer_id)) === r.id).length, sales: round2(sales), sales_target: num(t?.sales_target), achieved: t?.sales_target ? round2(sales / num(t.sales_target) * 100) : null, collections: round2(coll), collection_target: num(t?.collection_target), visits: (vis || []).filter((v: any) => v.rep_id === r.id).length }
    }).sort((a: any, b: any) => b.sales - a.sales)
    return { title: 'Sales representative performance', columns: [{ key: 'name', label: 'Representative' }, { key: 'orders', label: 'Orders', type: 'number' }, { key: 'sales', label: 'Sales', type: 'money' }, { key: 'sales_target', label: `Target (${month})`, type: 'money' }, { key: 'achieved', label: 'Achieved %', type: 'pct' }, { key: 'collections', label: 'Collections', type: 'money' }, { key: 'collection_target', label: 'Collection target', type: 'money' }, { key: 'visits', label: 'Visits / calls', type: 'number' }], rows, period, note: 'Targets shown are for the month of the end date.' }
  }

  throw new Error('Unknown report')
}
