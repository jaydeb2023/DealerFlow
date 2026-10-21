import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/df/server'
import { availability, getDealer, priceContext } from '@/lib/df/domain'
import { resolvePrice } from '@/lib/df/pricing'
import { num } from '@/lib/df/util'

export const dynamic = 'force-dynamic'

/** Products with the price THIS dealer pays and the stock free to order. Dealers see only their own prices. */
export async function GET(req: NextRequest) {
  const g = await guard(['sales_manager', 'sales_rep', 'finance', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const sp = req.nextUrl.searchParams
  const dealerId = staff.role === 'dealer' ? staff.dealer_id : sp.get('dealer_id')
  const dealer = dealerId ? await getDealer(db, dealerId) : null
  if (staff.role === 'dealer' && !dealer) return fail('Your dealer account is not set up.', 403)
  if (staff.role === 'sales_rep' && dealer && dealer.rep_id !== staff.id) return fail('This dealer is not assigned to you.', 403)

  let q = db.from('df_products').select('id,sku,name,brand,description,unit,image_url,gst_rate,list_price,moq,category:df_categories(id,name)').eq('active', true).order('name').limit(1000)
  const term = (sp.get('q') || '').trim().replace(/[,()%]/g, ' ')
  if (term) q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%,brand.ilike.%${term}%`)
  if (sp.get('category_id')) q = q.eq('category_id', sp.get('category_id')!)
  const { data, error } = await q
  if (error) return fail(error.message, 500)
  const av = await availability(db, (data || []).map((p: any) => p.id))
  const { items, disc } = await priceContext(db, dealer)
  const rows = (data || []).map((p: any) => ({
    ...p, price: resolvePrice(p, items, disc), available: Math.max(0, av.get(p.id) ?? 0),
    list_price: staff.role === 'dealer' ? undefined : p.list_price,
  }))
  return NextResponse.json({ data: rows, dealer: dealer ? { id: dealer.id, name: dealer.name, credit_limit: num(dealer.credit_limit), shipping_address: dealer.shipping_address, payment_terms_days: dealer.payment_terms_days } : null })
}
