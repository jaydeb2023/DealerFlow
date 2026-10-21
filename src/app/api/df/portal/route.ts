import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, notify } from '@/lib/df/server'
import { dealerBalance } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'

/** Dealer portal home: balance, credit, recent invoices and payments. */
export async function GET() {
  const g = await guard(['dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  if (!staff.dealer_id) return fail('Your dealer account is not set up.', 403)
  const id = staff.dealer_id
  const [{ data: d }, bal, inv, pay, ord, enq] = await Promise.all([
    db.from('df_dealers').select('id,name,dealer_code,credit_limit,payment_terms_days,billing_address,shipping_address,status,rep:df_staff!df_dealers_rep_id_fkey(full_name,mobile,email)').eq('id', id).single(),
    dealerBalance(db, id),
    db.from('df_invoices').select('id,invoice_no,invoice_date,due_date,total,paid,status').eq('dealer_id', id).neq('status', 'void').order('invoice_date', { ascending: false }).limit(50),
    db.from('df_payments').select('id,receipt_no,paid_on,amount,mode,reference').eq('dealer_id', id).order('paid_on', { ascending: false }).limit(50),
    db.from('df_orders').select('id,status').eq('dealer_id', id).neq('status', 'draft').limit(1000),
    db.from('df_enquiries').select('id,kind,message,status,reply,created_at').eq('dealer_id', id).order('created_at', { ascending: false }).limit(20),
  ])
  const open = (ord.data || []).filter((o: any) => !['delivered', 'cancelled', 'rejected', 'returned'].includes(o.status)).length
  return NextResponse.json({ dealer: d, balance: bal, invoices: inv.data || [], payments: pay.data || [], enquiries: enq.data || [], open_orders: open, total_orders: (ord.data || []).length })
}

/** Dealer sends an enquiry or asks for a quotation. */
export async function POST(req: NextRequest) {
  const g = await guard(['dealer'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const b = await req.json().catch(() => ({}))
  const message = String(b.message || '').trim().slice(0, 1000)
  if (message.length < 3) return fail('Please write your message.')
  const kind = b.kind === 'quotation' ? 'quotation' : 'enquiry'
  const { data, error } = await db.from('df_enquiries').insert({ dealer_id: staff.dealer_id, kind, message }).select('id').single()
  if (error) return fail(error.message, 400)
  const { data: dealer } = await db.from('df_dealers').select('name,rep_id').eq('id', staff.dealer_id!).single()
  await notify(db, { roles: ['admin', 'sales_manager'], staffIds: [dealer?.rep_id], kind: 'enquiry', title: `${kind === 'quotation' ? 'Quotation request' : 'Enquiry'} from ${dealer?.name}`, body: message.slice(0, 140), link: '/app/team' })
  await audit(db, staff, 'df_enquiries', data.id, 'create')
  return NextResponse.json({ ok: true })
}
