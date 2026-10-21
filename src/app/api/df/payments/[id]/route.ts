import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/df/server'
import { companySettings } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'

/** Receipt data for printing. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales_manager', 'finance', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { data: p } = await db.from('df_payments').select('*, dealer:df_dealers(id,name,dealer_code,gstin,billing_address), allocations:df_payment_allocations(amount,invoice:df_invoices(invoice_no,total))').eq('id', params.id).maybeSingle()
  if (!p || (staff.role === 'dealer' && p.dealer_id !== staff.dealer_id)) return fail('Receipt not found', 404)
  const c: any = { ...(await companySettings(db)) }; delete c.bank_details
  return NextResponse.json({ payment: p, company: c })
}
