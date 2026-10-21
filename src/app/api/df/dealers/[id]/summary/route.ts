import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/df/server'
import { dealerBalance } from '@/lib/df/domain'

export const dynamic = 'force-dynamic'

/** Everything about one dealer: profile, balance, orders, invoices, payments, visits, portal logins, statement. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales_manager', 'sales_rep', 'finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { data: d } = await db.from('df_dealers').select('*, rep:df_staff!df_dealers_rep_id_fkey(id,full_name), territory:df_territories(id,name), price_list:df_price_lists(id,name)').eq('id', params.id).maybeSingle()
  if (!d || (staff.role === 'sales_rep' && d.rep_id !== staff.id)) return fail('Dealer not found', 404)
  const [bal, orders, invoices, payments, visits, logins] = await Promise.all([
    dealerBalance(db, d.id),
    db.from('df_orders').select('id,order_no,status,order_date,total').eq('dealer_id', d.id).order('created_at', { ascending: false }).limit(30),
    db.from('df_invoices').select('id,invoice_no,invoice_date,due_date,total,paid,status').eq('dealer_id', d.id).neq('status', 'void').order('invoice_date', { ascending: false }).limit(50),
    db.from('df_payments').select('id,receipt_no,paid_on,amount,mode,reference').eq('dealer_id', d.id).order('paid_on', { ascending: false }).limit(50),
    staff.role === 'finance' ? Promise.resolve({ data: [] }) : db.from('df_visits').select('id,kind,outcome,notes,visited_at,next_followup_at,followup_done,rep:df_staff!df_visits_rep_id_fkey(full_name)').eq('dealer_id', d.id).order('visited_at', { ascending: false }).limit(30),
    db.from('df_staff').select('id,email,active,user_id').eq('dealer_id', d.id).eq('role', 'dealer'),
  ])
  // statement of account: opening, invoices (debit), payments (credit), running balance
  const lines: any[] = []
  ;(invoices.data || []).forEach((i: any) => lines.push({ date: i.invoice_date, ref: i.invoice_no, type: 'Invoice', debit: Number(i.total), credit: 0 }))
  ;(payments.data || []).forEach((p: any) => lines.push({ date: p.paid_on, ref: p.receipt_no, type: `Payment (${p.mode.replace('_', ' ')})`, debit: 0, credit: Number(p.amount) }))
  lines.sort((a, b) => a.date.localeCompare(b.date))
  let run = Number(d.opening_balance)
  const statement = [{ date: null, ref: '', type: 'Opening balance', debit: 0, credit: 0, balance: run }, ...lines.map(l => ({ ...l, balance: (run += l.debit - l.credit) }))]
  return NextResponse.json({ dealer: d, balance: bal, orders: orders.data || [], invoices: invoices.data || [], payments: payments.data || [], visits: visits.data || [], logins: logins.data || [], statement })
}
