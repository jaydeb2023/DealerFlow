// Shared business logic for the API routes (server only).
import { type Db, notify } from './server'
import { type DfRole } from './constants'
import { priceLine, resolvePrice, totalsOf, type PricedLine } from './pricing'
import { num, round2 } from './util'

export const OFFICE_DISCOUNT_ROLES: DfRole[] = ['admin', 'sales_manager']

export class UserError extends Error { code?: string; status: number; extra?: any
  constructor(message: string, status = 400, code?: string, extra?: any) { super(message); this.status = status; this.code = code; this.extra = extra } }

export async function getDealer(db: Db, id: string) {
  const { data } = await db.from('df_dealers').select('*').eq('id', id).maybeSingle()
  return data as any
}

/** available = on_hand - reserved, summed over all warehouses (optionally one warehouse). */
export async function availability(db: Db, productIds: string[], warehouseId?: string | null): Promise<Map<string, number>> {
  const m = new Map<string, number>()
  if (!productIds.length) return m
  let q = db.from('df_inventory').select('product_id,on_hand,reserved,warehouse:df_warehouses!inner(active)').in('product_id', productIds)
  if (warehouseId) q = q.eq('warehouse_id', warehouseId)
  const { data } = await q
  ;(data || []).forEach((r: any) => { if (r.warehouse?.active === false) return; m.set(r.product_id, (m.get(r.product_id) || 0) + num(r.on_hand) - num(r.reserved)) })
  return m
}

export async function priceContext(db: Db, dealer: any) {
  let items: Map<string, number> | null = null
  let disc = 0
  if (dealer?.price_list_id) {
    const { data: pl } = await db.from('df_price_lists').select('discount_pct,active').eq('id', dealer.price_list_id).maybeSingle()
    if (pl && pl.active !== false) {
      disc = num(pl.discount_pct)
      const { data: its } = await db.from('df_price_list_items').select('product_id,price').eq('price_list_id', dealer.price_list_id)
      items = new Map((its || []).map((r: any) => [r.product_id, num(r.price)]))
    }
  }
  return { items, disc }
}

/** Turn {product_id, qty, discount_pct?} into priced lines. Everything money-related comes from the database. */
export async function buildLines(db: Db, dealer: any, raw: any[], role: DfRole, shipping: number) {
  if (!Array.isArray(raw) || !raw.length) throw new UserError('Add at least one product.')
  if (raw.length > 200) throw new UserError('An order can have at most 200 lines.')
  const ids = Array.from(new Set(raw.map(r => String(r.product_id))))
  const { data: prods } = await db.from('df_products').select('*').in('id', ids)
  const byId = new Map<string, any>((prods || []).map((p: any) => [p.id, p]))
  const { items, disc } = await priceContext(db, dealer)
  const canDiscount = OFFICE_DISCOUNT_ROLES.includes(role)
  const lines: PricedLine[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    const p = byId.get(String(r.product_id))
    if (!p) throw new UserError('A product in this order no longer exists.')
    if (!p.active) throw new UserError(`${p.name} is not available for ordering.`)
    if (seen.has(p.id)) throw new UserError(`${p.name} is listed twice. Combine the quantities.`)
    seen.add(p.id)
    const qty = num(r.qty)
    if (!(qty > 0)) throw new UserError(`Enter a quantity for ${p.name}.`)
    if (qty < num(p.moq)) throw new UserError(`${p.name}: minimum order quantity is ${p.moq}.`)
    const d = canDiscount ? Math.min(100, Math.max(0, num(r.discount_pct))) : 0
    lines.push(priceLine(p, resolvePrice(p, items, disc), qty, d))
  }
  return { lines, totals: totalsOf(lines, canDiscount ? shipping : 0) }
}

export async function dealerBalance(db: Db, dealerId: string) {
  const { data } = await db.rpc('df_dealer_balances', {})
  const row = (data || []).find((r: any) => r.dealer_id === dealerId)
  return { opening: num(row?.opening), invoiced: num(row?.invoiced), received: num(row?.received), overdue: num(row?.overdue), balance: num(row?.balance) }
}

export async function companySettings(db: Db) {
  const { data } = await db.from('df_settings').select('value').eq('key', 'company').maybeSingle()
  return { approval_required: true, require_credit_check: true, low_stock_alerts: true, default_payment_terms_days: 30, ...((data?.value as any) || {}) }
}

/** Alert managers when a product's free stock falls to its reorder level (one alert per product per day). */
export async function lowStockCheck(db: Db, productIds: string[]) {
  try {
    const cfg = await companySettings(db)
    if (cfg.low_stock_alerts === false || !productIds.length) return
    const { data: prods } = await db.from('df_products').select('id,name,sku,reorder_level,unit').in('id', productIds).gt('reorder_level', 0)
    if (!prods?.length) return
    const av = await availability(db, prods.map((p: any) => p.id))
    const since = new Date(Date.now() - 864e5).toISOString()
    for (const p of prods as any[]) {
      const a = av.get(p.id) ?? 0
      if (a > num(p.reorder_level)) continue
      const title = `Low stock: ${p.name}`
      const { data: ex } = await db.from('df_notifications').select('id').eq('title', title).gte('created_at', since).limit(1)
      if (ex?.length) continue
      await notify(db, { roles: ['admin', 'warehouse', 'sales_manager'], kind: 'low_stock', title, body: `${p.sku}: ${a} ${p.unit} available (reorder level ${p.reorder_level}).`, link: '/app/inventory' })
    }
  } catch (e) { console.error('[df lowStock]', e) }
}

export const fail2 = (e: any) => e instanceof UserError ? { error: e.message, status: e.status, code: e.code, extra: e.extra } : null

/** DB function errors (raise exception) arrive as plain messages; show them to the user as-is. */
export function rpcError(e: { message: string }): UserError { return new UserError(e.message, 409) }

export { round2, num }

import { NextResponse } from 'next/server'
export function errRes(e: any): NextResponse {
  if (e instanceof UserError) return NextResponse.json({ error: e.message, code: e.code, ...(e.extra || {}) }, { status: e.status })
  console.error('[df]', e)
  return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
}
