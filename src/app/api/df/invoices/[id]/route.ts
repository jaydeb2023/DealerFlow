import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/df/server'
import { companySettings } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales_manager', 'finance', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { data: inv } = await db.from('df_invoices').select('*, dealer:df_dealers(id,name,dealer_code,gstin,phone,email,billing_address), order:df_orders(order_no)').eq('id', params.id).maybeSingle()
  if (!inv || (staff.role === 'dealer' && inv.dealer_id !== staff.dealer_id)) return fail('Invoice not found', 404)
  const [items, allocs, company] = await Promise.all([
    db.from('df_invoice_items').select('*').eq('invoice_id', inv.id).order('name'),
    db.from('df_payment_allocations').select('amount, payment:df_payments(receipt_no,paid_on,mode,reference)').eq('invoice_id', inv.id),
    companySettings(db),
  ])
  const c: any = { ...company }; if (staff.role === 'dealer') delete c.bank_details
  return NextResponse.json({ invoice: inv, items: items.data || [], payments: allocs.data || [], company: c })
}

/** Void an invoice that has no payments (the order can then be invoiced again). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { data: inv } = await db.from('df_invoices').select('id,paid,status,invoice_no').eq('id', params.id).maybeSingle()
  if (!inv) return fail('Invoice not found', 404)
  if (inv.status === 'void') return fail('Already void')
  if (Number(inv.paid) > 0) return fail('This invoice has payments recorded, so it cannot be voided.', 409)
  await db.from('df_invoices').update({ status: 'void' }).eq('id', inv.id)
  await audit(db, staff, 'df_invoices', inv.id, 'void', { invoice_no: inv.invoice_no })
  return NextResponse.json({ ok: true })
}
