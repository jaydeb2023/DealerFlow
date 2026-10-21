'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate, qs, useDebounced, useFetch } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { Badge, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Table, Td } from '@/components/df/ui'

export default function InvoicesPage() {
  const router = useRouter(); const [q, setQ] = useState(''); const dq = useDebounced(q); const [status, setStatus] = useState('')
  const { data, loading, error } = useFetch<{ data: any[] }>(`/api/df/invoices${qs({ q: dq, status })}`)
  const today = new Date().toISOString().slice(0, 10)
  return <div>
    <PageHeader title="Invoices" subtitle="Create an invoice from an approved order (open the order and press Create invoice)" />
    <div className="mb-3 flex gap-2"><Input className="max-w-xs" placeholder="Search invoice number" value={q} onChange={e => setQ(e.target.value)} />
      <Select className="w-auto" value={status} onChange={e => setStatus(e.target.value)}><option value="">All</option><option value="unpaid">Unpaid</option><option value="overdue">Overdue</option><option value="partial">Part-paid</option><option value="paid">Paid</option><option value="void">Void</option></Select></div>
    {error && <ErrorNote>{error}</ErrorNote>}
    {loading && !data ? <Spinner className="mx-auto my-12 h-6 w-6" /> : !data?.data.length ? <Empty>No invoices yet.</Empty> :
      <Table head={['Invoice', 'Dealer', 'Order', 'Date', 'Due', 'Total', 'Paid', 'Balance', 'Status']}>{data.data.map(i => <tr key={i.id} className="cursor-pointer hover:bg-df-50/50" onClick={() => router.push(`/app/invoices/${i.id}`)}>
        <Td className="font-medium text-df-700">{i.invoice_no}</Td><Td>{i.dealer?.name}</Td><Td>{i.order?.order_no || '-'}</Td><Td>{fmtDate(i.invoice_date)}</Td><Td>{fmtDate(i.due_date)}</Td><Td>{inr(i.total)}</Td><Td>{inr(i.paid)}</Td><Td className="font-medium">{inr(Number(i.total) - Number(i.paid))}</Td>
        <Td><Badge value={['open', 'partial'].includes(i.status) && i.due_date < today ? 'overdue' : i.status} /></Td></tr>)}</Table>}
  </div>
}
