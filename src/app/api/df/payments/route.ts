import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, notify } from '@/lib/df/server'
import { errRes, UserError } from '@/lib/df/domain'
import { PAY_MODES } from '@/lib/df/constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(['sales_manager', 'finance', 'dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const sp = req.nextUrl.searchParams
  let q = db.from('df_payments').select('id,receipt_no,amount,mode,reference,paid_on,notes,dealer:df_dealers(id,name,dealer_code),allocations:df_payment_allocations(amount,invoice:df_invoices(invoice_no))', { count: 'exact' })
  if (staff.role === 'dealer') q = q.eq('dealer_id', staff.dealer_id!)
  else if (sp.get('dealer_id')) q = q.eq('dealer_id', sp.get('dealer_id')!)
  if (sp.get('from')) q = q.gte('paid_on', sp.get('from')!)
  if (sp.get('to')) q = q.lte('paid_on', sp.get('to')!)
  const { data, error, count } = await q.order('paid_on', { ascending: false }).order('created_at', { ascending: false }).limit(500)
  if (error) return fail(error.message, 500)
  return NextResponse.json({ data: data || [], count: count ?? 0 })
}

/** body: { dealer_id, amount, mode, reference, paid_on, notes, allocations: [{invoice_id, amount}] } */
export async function POST(req: NextRequest) {
  const g = await guard(['finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  try {
    const b = await req.json().catch(() => ({}))
    if (!b.dealer_id) throw new UserError('Choose a dealer.')
    if (!PAY_MODES.includes(b.mode)) throw new UserError('Choose how the payment was made.')
    const amount = Number(b.amount)
    if (!(amount > 0)) throw new UserError('Enter the amount received.')
    if (['bank_transfer', 'upi', 'cheque', 'card'].includes(b.mode) && !String(b.reference || '').trim()) throw new UserError('Enter the transaction / cheque reference for this payment mode.')
    const allocs = (Array.isArray(b.allocations) ? b.allocations : []).map((a: any) => ({ invoice_id: String(a.invoice_id), amount: Number(a.amount) })).filter((a: any) => a.amount > 0)
    const { data, error } = await db.rpc('df_record_payment', { p_dealer: b.dealer_id, p_amount: amount, p_mode: b.mode, p_ref: b.reference || null, p_date: b.paid_on || null, p_notes: b.notes || null, p_alloc: allocs, p_user: staff.id })
    if (error) throw new UserError(error.message, 409)
    const r = data as any
    await audit(db, staff, 'df_payments', r.payment_id, 'create', { amount, mode: b.mode, receipt_no: r.receipt_no })
    const { data: dl } = await db.from('df_staff').select('id').eq('dealer_id', b.dealer_id).eq('active', true)
    await notify(db, { staffIds: (dl || []).map((x: any) => x.id), kind: 'payment', title: `Payment received: ${r.receipt_no}`, body: `Amount ${amount.toLocaleString('en-IN')}`, link: '/app/portal/account' })
    return NextResponse.json(r)
  } catch (e) { return errRes(e) }
}
