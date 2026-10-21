// Server-side order maths. The browser only sends product + quantity (+ optional discount);
// prices, tax and totals are always recomputed here from the database.
import { round2, num } from './util'

export interface PricedLine {
  product_id: string; sku: string; name: string; unit: string
  qty: number; unit_price: number; discount_pct: number; gst_rate: number
  line_subtotal: number; line_discount: number; line_tax: number; line_total: number
}

export function priceLine(p: { id: string; sku: string; name: string; unit: string; gst_rate: any }, unit_price: number, qty: number, discount_pct: number): PricedLine {
  const sub = round2(qty * unit_price)
  const disc = round2(sub * discount_pct / 100)
  const taxable = sub - disc
  const tax = round2(taxable * num(p.gst_rate) / 100)
  return {
    product_id: p.id, sku: p.sku, name: p.name, unit: p.unit, qty, unit_price, discount_pct, gst_rate: num(p.gst_rate),
    line_subtotal: sub, line_discount: disc, line_tax: tax, line_total: round2(taxable + tax),
  }
}

export function totalsOf(lines: PricedLine[], shipping: number) {
  const subtotal = round2(lines.reduce((s, l) => s + l.line_subtotal, 0))
  const discount_total = round2(lines.reduce((s, l) => s + l.line_discount, 0))
  const tax_total = round2(lines.reduce((s, l) => s + l.line_tax, 0))
  const ship = round2(Math.max(0, shipping))
  return { subtotal, discount_total, tax_total, shipping: ship, total: round2(subtotal - discount_total + tax_total + ship) }
}

/** Dealer price: explicit price-list item, else list price less the list's discount %. */
export function resolvePrice(product: { id: string; list_price: any }, items: Map<string, number> | null, listDiscountPct: number): number {
  const explicit = items?.get(product.id)
  if (explicit !== undefined) return round2(explicit)
  return round2(num(product.list_price) * (1 - listDiscountPct / 100))
}
