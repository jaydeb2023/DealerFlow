'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api, fmtDate, fmtDateTime, useFetch } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Stat, Table, Tabs, Td } from '@/components/df/ui'
import FormModal from '@/components/df/FormModal'
import { useStaff } from '@/components/df/Context'
import { DEALER_FIELDS } from '@/components/df/dealerFields'

type Tab = 'orders' | 'invoices' | 'payments' | 'statement' | 'visits' | 'access'

export default function DealerPage({ params }: { params: { id: string } }) {
  const me = useStaff(); const canWrite = me.role === 'admin' || me.role === 'sales_manager'
  const { data, error, reload } = useFetch<any>(`/api/df/dealers/${params.id}/summary`)
  const [tab, setTab] = useState<Tab>('orders'); const [edit, setEdit] = useState(false); const [visit, setVisit] = useState(false); const [login, setLogin] = useState(false)
  const [pwd, setPwd] = useState<string | null>(null)
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-16 h-7 w-7" />
  const d = data.dealer, b = data.balance
  const resetPw = async (id: string) => { if (!confirm('Create a new temporary password for this login?')) return; try { const r: any = await api(`/api/df/dealers/${d.id}/login`, { body: { reset_staff_id: id } }); setPwd(r.temp_password) } catch (e: any) { toast.error(e.message) } }
  return <div className="space-y-4">
    <PageHeader title={d.name} subtitle={`${d.dealer_code}${d.territory ? ' · ' + d.territory.name : ''}${d.rep ? ' · Rep: ' + d.rep.full_name : ''}`}
      actions={<><Badge value={d.status} />{(me.role === 'sales_manager' || me.role === 'admin' || me.role === 'sales_rep') && <Link href={`/app/orders/new?dealer_id=${d.id}`}><Button variant="primary">New order</Button></Link>}{canWrite && <Button onClick={() => setEdit(true)}>Edit</Button>}</>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Outstanding" value={inr(b.balance)} tone={b.balance > 0 ? 'warn' : undefined} hint="Opening + invoices - payments" />
      <Stat label="Overdue" value={inr(b.overdue)} tone={b.overdue > 0 ? 'bad' : undefined} />
      <Stat label="Credit limit" value={Number(d.credit_limit) ? inr(d.credit_limit) : 'Not set'} hint={Number(d.credit_limit) ? `${Math.round(Math.max(0, b.balance) / Number(d.credit_limit) * 100)}% used` : undefined} />
      <Stat label="Payment terms" value={`${d.payment_terms_days} days`} hint={d.price_list?.name ? `Price list: ${d.price_list.name}` : 'List price'} />
    </div>
    <Card title="Details"><dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
      {[['Contact', d.contact_person], ['Phone', d.phone], ['Email', d.email], ['GSTIN', d.gstin], ['Category', d.category], ['Billing address', d.billing_address], ['Shipping address', d.shipping_address]].map(([k, v]) => <div key={k as string}><dt className="text-xs text-slate-500">{k}</dt><dd>{(v as string) || '-'}</dd></div>)}
    </dl></Card>
    <Tabs<Tab> tabs={[{ id: 'orders', label: 'Orders', count: data.orders.length }, { id: 'invoices', label: 'Invoices', count: data.invoices.length }, { id: 'payments', label: 'Payments', count: data.payments.length }, { id: 'statement', label: 'Statement' }, ...(me.role !== 'finance' ? [{ id: 'visits' as Tab, label: 'Visits & calls', count: data.visits.length }] : []), ...(canWrite ? [{ id: 'access' as Tab, label: 'Portal access' }] : [])]} value={tab} onChange={setTab} />
    {tab === 'orders' && (data.orders.length ? <Table head={['Order', 'Date', 'Status', 'Total']}>{data.orders.map((o: any) => <tr key={o.id}><Td><Link className="font-medium text-df-700" href={`/app/orders/${o.id}`}>{o.order_no}</Link></Td><Td>{fmtDate(o.order_date)}</Td><Td><Badge value={o.status} /></Td><Td>{inr(o.total)}</Td></tr>)}</Table> : <Empty>No orders yet.</Empty>)}
    {tab === 'invoices' && (data.invoices.length ? <Table head={['Invoice', 'Date', 'Due', 'Total', 'Paid', 'Status']}>{data.invoices.map((i: any) => <tr key={i.id}><Td><Link className="font-medium text-df-700" href={`/app/invoices/${i.id}`}>{i.invoice_no}</Link></Td><Td>{fmtDate(i.invoice_date)}</Td><Td>{fmtDate(i.due_date)}</Td><Td>{inr(i.total)}</Td><Td>{inr(i.paid)}</Td><Td><Badge value={i.status !== 'paid' && i.due_date < new Date().toISOString().slice(0, 10) ? 'overdue' : i.status} /></Td></tr>)}</Table> : <Empty>No invoices yet.</Empty>)}
    {tab === 'payments' && (data.payments.length ? <Table head={['Receipt', 'Date', 'Mode', 'Reference', 'Amount']}>{data.payments.map((p: any) => <tr key={p.id}><Td><Link className="font-medium text-df-700" href={`/app/payments?receipt=${p.id}`}>{p.receipt_no}</Link></Td><Td>{fmtDate(p.paid_on)}</Td><Td>{p.mode.replace('_', ' ')}</Td><Td>{p.reference || '-'}</Td><Td>{inr(p.amount)}</Td></tr>)}</Table> : <Empty>No payments yet.</Empty>)}
    {tab === 'statement' && <div><div className="mb-2 flex justify-end no-print"><Button onClick={() => window.print()}>Print statement</Button></div><Table head={['Date', 'Reference', 'Type', 'Debit', 'Credit', 'Balance']}>{data.statement.map((l: any, i: number) => <tr key={i}><Td>{l.date ? fmtDate(l.date) : ''}</Td><Td>{l.ref}</Td><Td>{l.type}</Td><Td>{l.debit ? inr(l.debit) : ''}</Td><Td>{l.credit ? inr(l.credit) : ''}</Td><Td className="font-medium">{inr(l.balance)}</Td></tr>)}</Table></div>}
    {tab === 'visits' && <div className="space-y-2"><div className="flex justify-end"><Button variant="primary" onClick={() => setVisit(true)}>Log visit / call</Button></div>
      {data.visits.length ? <Table head={['When', 'Type', 'By', 'Outcome', 'Notes', 'Follow-up']}>{data.visits.map((v: any) => <tr key={v.id}><Td>{fmtDateTime(v.visited_at)}</Td><Td>{v.kind}</Td><Td>{v.rep?.full_name || '-'}</Td><Td>{v.outcome || '-'}</Td><Td>{v.notes || '-'}</Td><Td>{v.next_followup_at ? fmtDate(v.next_followup_at) : '-'}</Td></tr>)}</Table> : <Empty>No visits or calls logged.</Empty>}</div>}
    {tab === 'access' && <Card title="Dealer portal login" actions={<Button variant="primary" size="sm" onClick={() => setLogin(true)}>Create login</Button>}>
      <p className="mb-3 text-sm text-slate-600">A dealer with a login can see their own prices, place orders, track deliveries and view invoices and balance. They see nothing about other dealers.</p>
      {pwd && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">Temporary password (shown once): <b className="font-mono">{pwd}</b> <button className="ml-2 underline" onClick={() => setPwd(null)}>hide</button></div>}
      {data.logins.length ? <ul className="divide-y text-sm">{data.logins.map((l: any) => <li key={l.id} className="flex items-center justify-between py-2"><span>{l.email} {!l.active && <Badge value="inactive" />}</span><Button size="sm" onClick={() => resetPw(l.id)}>Reset password</Button></li>)}</ul> : <div className="text-sm text-slate-500">No login yet.</div>}
    </Card>}
    <FormModal open={edit} onClose={() => setEdit(false)} title="Edit dealer" fields={DEALER_FIELDS} initial={d} onSubmit={async v => { await api(`/api/df/r/dealers/${d.id}`, { method: 'PATCH', body: v }); toast.success('Saved'); reload() }} />
    <FormModal open={visit} onClose={() => setVisit(false)} title="Log visit or call" fields={[{ key: 'kind', label: 'Type', type: 'select', options: [{ value: 'visit', label: 'Visit' }, { value: 'call', label: 'Call' }, { value: 'followup', label: 'Follow-up' }], default: 'visit' }, { key: 'outcome', label: 'Outcome' }, { key: 'notes', label: 'Notes', type: 'textarea' }, { key: 'next_followup_at', label: 'Next follow-up', type: 'datetime' }]}
      onSubmit={async v => { await api('/api/df/r/visits', { body: { ...v, dealer_id: d.id } }); toast.success('Logged'); reload() }} />
    <FormModal open={login} onClose={() => setLogin(false)} title="Create dealer login" submitLabel="Create" intro="Creates a portal login with a temporary password (shown once). Share it with the dealer; they can change it after signing in." fields={[{ key: 'email', label: 'Dealer email', type: 'email', default: d.email, required: true }]}
      onSubmit={async v => { const r: any = await api(`/api/df/dealers/${d.id}/login`, { body: v }); setPwd(r.temp_password); toast.success('Login created'); reload() }} />
  </div>
}
