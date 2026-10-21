'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api, fmtDate, useFetch } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Stat, Table, Td } from '@/components/df/ui'
import FormModal from '@/components/df/FormModal'

export default function PortalAccount() {
  const { data, error, reload } = useFetch<any>('/api/df/portal'); const [ask, setAsk] = useState<null | 'enquiry' | 'quotation'>(null)
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-16 h-7 w-7" />
  const d = data.dealer, b = data.balance, today = new Date().toISOString().slice(0, 10)
  return <div className="space-y-4">
    <PageHeader title="Invoices & balance" subtitle={`${d.name} · ${d.dealer_code}`} actions={<><Button onClick={() => setAsk('enquiry')}>Send an enquiry</Button><Button variant="primary" onClick={() => setAsk('quotation')}>Request a quotation</Button></>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="You owe" value={inr(Math.max(0, b.balance))} tone={b.balance > 0 ? 'warn' : undefined} hint={b.balance < 0 ? `Advance paid: ${inr(-b.balance)}` : undefined} /><Stat label="Overdue" value={inr(b.overdue)} tone={b.overdue > 0 ? 'bad' : undefined} /><Stat label="Credit limit" value={Number(d.credit_limit) ? inr(d.credit_limit) : 'Not set'} /><Stat label="Open orders" value={data.open_orders} /></div>
    {d.rep && <p className="text-sm text-slate-600">Your sales contact: <b>{d.rep.full_name}</b> {d.rep.mobile ? `· ${d.rep.mobile}` : ''}</p>}
    <Card title="Invoices" pad={false}>{data.invoices.length ? <Table className="border-0" head={['Invoice', 'Date', 'Due', 'Total', 'Paid', 'Status']}>{data.invoices.map((i: any) => <tr key={i.id}><Td><Link className="font-medium text-df-700" href={`/app/portal/account/invoice?id=${i.id}`}>{i.invoice_no}</Link></Td><Td>{fmtDate(i.invoice_date)}</Td><Td>{fmtDate(i.due_date)}</Td><Td>{inr(i.total)}</Td><Td>{inr(i.paid)}</Td><Td><Badge value={['open', 'partial'].includes(i.status) && i.due_date < today ? 'overdue' : i.status} /></Td></tr>)}</Table> : <div className="p-4"><Empty>No invoices yet.</Empty></div>}</Card>
    <Card title="Payments received" pad={false}>{data.payments.length ? <Table className="border-0" head={['Receipt', 'Date', 'Mode', 'Reference', 'Amount']}>{data.payments.map((p: any) => <tr key={p.id}><Td>{p.receipt_no}</Td><Td>{fmtDate(p.paid_on)}</Td><Td>{p.mode.replace('_', ' ')}</Td><Td>{p.reference || '-'}</Td><Td>{inr(p.amount)}</Td></tr>)}</Table> : <div className="p-4"><Empty>No payments yet.</Empty></div>}</Card>
    {data.enquiries.length > 0 && <Card title="Your enquiries">{data.enquiries.map((e: any) => <div key={e.id} className="border-b border-slate-100 py-2 text-sm last:border-0"><div className="flex justify-between"><span>{e.message}</span><Badge value={e.status} /></div>{e.reply && <div className="mt-1 rounded bg-emerald-50 p-2 text-emerald-900">Reply: {e.reply}</div>}</div>)}</Card>}
    <FormModal open={!!ask} onClose={() => setAsk(null)} title={ask === 'quotation' ? 'Request a quotation' : 'Send an enquiry'} submitLabel="Send" fields={[{ key: 'message', label: ask === 'quotation' ? 'Products and quantities you need' : 'Your message', type: 'textarea', required: true }]} onSubmit={async v => { await api('/api/df/portal', { body: { ...v, kind: ask } }); toast.success('Sent. Your sales contact will reply.'); reload() }} />
  </div>
}
