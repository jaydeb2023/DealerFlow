import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/df/server'
import { errRes, lowStockCheck, UserError } from '@/lib/df/domain'
import { num } from '@/lib/df/util'

export const dynamic = 'force-dynamic'

/** Stock by product with a per-warehouse breakdown. available = on hand - reserved for approved orders. */
export async function GET(req: NextRequest) {
  const g = await guard(['sales_manager', 'warehouse', 'finance'])
  if (!g.ok) return g.res
  const { db } = g
  const sp = req.nextUrl.searchParams
  const term = (sp.get('q') || '').trim().replace(/[,()%]/g, ' ')
  let pq = db.from('df_products').select('id,sku,name,unit,reorder_level,active,category:df_categories(name)').order('name').limit(1000)
  if (term) pq = pq.or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  const [{ data: prods, error }, { data: inv }, { data: whs }] = await Promise.all([
    pq,
    db.from('df_inventory').select('product_id,warehouse_id,on_hand,reserved').limit(20000),
    db.from('df_warehouses').select('id,name,code,active').order('name'),
  ])
  if (error) return fail(error.message, 500)
  const by = new Map<string, any[]>()
  ;(inv || []).forEach((r: any) => { const a = by.get(r.product_id) || []; a.push(r); by.set(r.product_id, a) })
  const rows = (prods || []).map((p: any) => {
    const w = by.get(p.id) || []
    const on_hand = w.reduce((s, r) => s + num(r.on_hand), 0), reserved = w.reduce((s, r) => s + num(r.reserved), 0)
    const available = on_hand - reserved
    const status = available <= 0 ? 'out' : (num(p.reorder_level) > 0 && available <= num(p.reorder_level)) ? 'low' : 'ok'
    return { ...p, on_hand, reserved, available, status, by_warehouse: w.map(r => ({ warehouse_id: r.warehouse_id, on_hand: num(r.on_hand), reserved: num(r.reserved) })) }
  })
  const st = sp.get('status')
  return NextResponse.json({ data: st ? rows.filter(r => st === 'attention' ? r.status !== 'ok' : r.status === st) : rows, warehouses: whs || [] })
}

/** body: { action: 'receipt'|'adjustment'|'return'|'transfer', product_id, warehouse_id, to_warehouse_id?, qty, reason } */
export async function POST(req: NextRequest) {
  const g = await guard(['warehouse'])
  if (!g.ok) return g.res
  const { db, staff } = g
  try {
    const b = await req.json().catch(() => ({}))
    const qty = Number(b.qty)
    if (!b.product_id || !b.warehouse_id) throw new UserError('Choose a product and a warehouse.')
    if (!Number.isFinite(qty) || qty === 0) throw new UserError('Enter a quantity.')
    if (b.action === 'adjustment' && !String(b.reason || '').trim()) throw new UserError('A reason is required for a stock adjustment.')
    if (b.action === 'transfer') {
      const { error } = await db.rpc('df_stock_transfer', { p_product: b.product_id, p_from: b.warehouse_id, p_to: b.to_warehouse_id, p_qty: qty, p_reason: b.reason || null, p_user: staff.id })
      if (error) throw new UserError(error.message, 409)
    } else {
      if (!['receipt', 'adjustment', 'return'].includes(b.action)) throw new UserError('Unknown stock action.')
      const { error } = await db.rpc('df_stock_change', { p_product: b.product_id, p_wh: b.warehouse_id, p_kind: b.action, p_qty: qty, p_reason: b.reason || null, p_user: staff.id })
      if (error) throw new UserError(error.message, 409)
    }
    await audit(db, staff, 'df_inventory', b.product_id, b.action, { qty, warehouse_id: b.warehouse_id, to: b.to_warehouse_id, reason: b.reason })
    await lowStockCheck(db, [b.product_id])
    return NextResponse.json({ ok: true })
  } catch (e) { return errRes(e) }
}
