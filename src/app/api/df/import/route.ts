import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, nextNo } from '@/lib/df/server'
import { isGstin, normMobile, num } from '@/lib/df/util'
import { lowStockCheck } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Bulk import from Excel/CSV (the browser parses the file and sends rows).
 * body: { kind: 'dealers' | 'products' | 'stock', rows: [...] }  -> { created, updated, skipped, errors: [{row, error}] }
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const kind = String(b.kind || '')
  const g = await guard(kind === 'stock' ? ['warehouse'] : ['sales_manager'])
  if (!g.ok) return g.res
  const { db, staff, org } = g
  const rows: any[] = Array.isArray(b.rows) ? b.rows.slice(0, 2000) : []
  if (!rows.length) return fail('The file has no rows.')
  const out = { created: 0, updated: 0, skipped: 0, errors: [] as { row: number; error: string }[] }
  const S = (v: any) => (v === undefined || v === null ? '' : String(v).trim())

  if (kind === 'dealers') {
    if (org.max_dealers) {
      const { count } = await db.from('df_dealers').select('id', { count: 'exact', head: true })
      if ((count || 0) + rows.length > org.max_dealers) return fail(`Your plan allows ${org.max_dealers} dealers; this file would exceed it.`, 403)
    }
    const { data: reps } = await db.from('df_staff').select('id,full_name,email').neq('role', 'dealer')
    const { data: terrs } = await db.from('df_territories').select('id,name')
    const { data: pls } = await db.from('df_price_lists').select('id,name')
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const n = i + 2
      const name = S(r.name || r.business_name)
      if (!name) { out.errors.push({ row: n, error: 'Business name is missing' }); continue }
      const gstin = S(r.gstin).toUpperCase()
      if (gstin && !isGstin(gstin)) { out.errors.push({ row: n, error: `GSTIN ${gstin} is not valid` }); continue }
      const phone = S(r.phone)
      if (phone && phone.replace(/\D/g, '').length < 10) { out.errors.push({ row: n, error: 'Phone number looks too short' }); continue }
      if (phone) { const { data: dup } = await db.from('df_dealers').select('id').eq('phone_norm', normMobile(phone)).limit(1); if (dup?.length) { out.skipped++; out.errors.push({ row: n, error: `Skipped: a dealer with phone ${phone} already exists` }); continue } }
      const rep = S(r.sales_rep) ? (reps || []).find((x: any) => [x.full_name, x.email].some((v: string) => (v || '').toLowerCase() === S(r.sales_rep).toLowerCase())) : null
      const terr = S(r.territory) ? (terrs || []).find((x: any) => x.name.toLowerCase() === S(r.territory).toLowerCase()) : null
      const pl = S(r.price_list) ? (pls || []).find((x: any) => x.name.toLowerCase() === S(r.price_list).toLowerCase()) : null
      const row: any = {
        name, contact_person: S(r.contact_person) || null, phone: phone || null, phone_norm: phone ? normMobile(phone) : null, email: S(r.email) || null,
        billing_address: S(r.billing_address) || null, shipping_address: S(r.shipping_address) || null, gstin: gstin || null, category: S(r.category) || null,
        credit_limit: Math.max(0, num(r.credit_limit)), payment_terms_days: Math.max(0, Math.round(num(r.payment_terms_days, 30))), opening_balance: num(r.opening_balance),
        rep_id: rep?.id ?? null, territory_id: terr?.id ?? null, price_list_id: pl?.id ?? null,
      }
      row.dealer_code = S(r.dealer_code) || await nextNo(db, 'dealer', 'DLR-', 4)
      const { error } = await db.from('df_dealers').insert(row)
      if (error) out.errors.push({ row: n, error: error.code === '23505' ? `Dealer code ${row.dealer_code} already exists` : error.message }); else out.created++
    }
  } else if (kind === 'products' || kind === 'stock') {
    const { data: cats } = await db.from('df_categories').select('id,name')
    const catMap = new Map<string, string>((cats || []).map((c: any) => [c.name.toLowerCase(), c.id]))
    const { data: whs } = await db.from('df_warehouses').select('id,name').eq('active', true)
    const whDefault = whs?.length === 1 ? whs[0].id : null
    const { data: existing } = await db.from('df_products').select('id,sku')
    const skuMap = new Map<string, string>((existing || []).map((p: any) => [String(p.sku).toLowerCase(), p.id]))
    const touched: string[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]; const n = i + 2
      const sku = S(r.sku)
      if (!sku) { out.errors.push({ row: n, error: 'SKU is missing' }); continue }
      if (kind === 'products') {
        const name = S(r.name)
        if (!name) { out.errors.push({ row: n, error: 'Product name is missing' }); continue }
        const price = num(r.list_price ?? r.price, NaN)
        if (!Number.isFinite(price) || price < 0) { out.errors.push({ row: n, error: 'List price must be a number' }); continue }
        let category_id: string | null = null
        if (S(r.category)) {
          const key = S(r.category).toLowerCase()
          if (!catMap.has(key)) { const { data: c } = await db.from('df_categories').insert({ name: S(r.category) }).select('id').single(); if (c) catMap.set(key, c.id) }
          category_id = catMap.get(key) ?? null
        }
        const row: any = { sku, name, category_id, brand: S(r.brand) || null, description: S(r.description) || null, unit: S(r.unit) || 'pcs', hsn: S(r.hsn) || null,
          gst_rate: Math.min(100, Math.max(0, num(r.gst_rate, 18))), list_price: price, moq: num(r.moq, 1) > 0 ? num(r.moq, 1) : 1, reorder_level: Math.max(0, num(r.reorder_level)) }
        const id = skuMap.get(sku.toLowerCase())
        if (id) { const { error } = await db.from('df_products').update(row).eq('id', id); if (error) out.errors.push({ row: n, error: error.message }); else out.updated++ }
        else { const { data, error } = await db.from('df_products').insert(row).select('id').single(); if (error) out.errors.push({ row: n, error: error.message }); else { out.created++; skuMap.set(sku.toLowerCase(), data.id) } }
      } else {
        const pid = skuMap.get(sku.toLowerCase())
        if (!pid) { out.errors.push({ row: n, error: `No product with SKU ${sku}` }); continue }
        const wh = S(r.warehouse) ? (whs || []).find((w: any) => w.name.toLowerCase() === S(r.warehouse).toLowerCase())?.id : whDefault
        if (!wh) { out.errors.push({ row: n, error: S(r.warehouse) ? `Unknown warehouse ${S(r.warehouse)}` : 'Warehouse is required (you have more than one)' }); continue }
        const qty = num(r.qty ?? r.quantity, NaN)
        if (!(qty > 0)) { out.errors.push({ row: n, error: 'Quantity must be more than zero' }); continue }
        const { error } = await db.rpc('df_stock_change', { p_product: pid, p_wh: wh, p_kind: 'receipt', p_qty: qty, p_reason: 'Opening stock import', p_user: staff.id })
        if (error) out.errors.push({ row: n, error: error.message }); else { out.created++; touched.push(pid) }
      }
    }
    if (touched.length) await lowStockCheck(db, touched)
  } else return fail('Unknown import type')

  await audit(db, staff, 'df_import', null, `import_${kind}`, { created: out.created, updated: out.updated, errors: out.errors.length })
  return NextResponse.json(out)
}
