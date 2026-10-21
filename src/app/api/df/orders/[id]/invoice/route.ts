import { NextRequest, NextResponse } from 'next/server'
import { guard, audit, notify } from '@/lib/df/server'
import { errRes, UserError } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['finance', 'sales_manager'])
  if (!g.ok) return g.res
  const { db, staff } = g
  try {
    const b = await req.json().catch(() => ({}))
    const { data: id, error } = await db.rpc('df_create_invoice', { p_order: params.id, p_user: staff.id, p_date: b.invoice_date || null })
    if (error) throw new UserError(error.message, 409)
    const { data: inv } = await db.from('df_invoices').select('id,invoice_no,total,dealer_id').eq('id', id).single()
    await audit(db, staff, 'df_invoices', id, 'create', { order_id: params.id, total: inv?.total })
    const { data: dl } = await db.from('df_staff').select('id').eq('dealer_id', inv!.dealer_id).eq('active', true)
    await notify(db, { staffIds: (dl || []).map((r: any) => r.id), kind: 'invoice', title: `Invoice ${inv!.invoice_no} issued`, body: `Amount ${Number(inv!.total).toLocaleString('en-IN')}`, link: `/app/portal/account` })
    return NextResponse.json({ id, invoice_no: inv!.invoice_no })
  } catch (e) { return errRes(e) }
}
