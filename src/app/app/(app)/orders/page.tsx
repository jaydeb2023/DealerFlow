'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { Plus } from 'lucide-react'
import { fmtDate, qs, useDebounced, useFetch } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { ORDER_STATUSES, labelize } from '@/lib/df/constants'
import { Badge, Button, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Table, Td } from '@/components/df/ui'
import { useStaff } from '@/components/df/Context'

function Inner() {
  const router = useRouter(); const me = useStaff(); const sp = useSearchParams()
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [status, setStatus] = useState(sp.get('status') || ''); const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const { data, loading, error } = useFetch<{ data: any[]; count: number }>(`/api/df/orders${qs({ q: dq, status, from, to })}`)
  const canCreate = ['admin', 'sales_manager', 'sales_rep'].includes(me.role)
  return <div>
    <PageHeader title="Orders" subtitle="Draft, approve, pick, dispatch and invoice, all in one place" actions={canCreate && <Button variant="primary" onClick={() => router.push('/app/orders/new')}><Plus className="h-4 w-4" />New order</Button>} />
    <div className="mb-3 flex flex-wrap gap-2"><Input className="max-w-xs" placeholder="Search order number" value={q} onChange={e => setQ(e.target.value)} />
      <Select className="w-auto" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="open">Open (in progress)</option><option value="submitted">Awaiting approval</option>{ORDER_STATUSES.map(s => <option key={s} value={s}>{labelize(s)}</option>)}</Select>
      <Input type="date" className="w-auto" value={from} onChange={e => setFrom(e.target.value)} aria-label="From" /><Input type="date" className="w-auto" value={to} onChange={e => setTo(e.target.value)} aria-label="To" /></div>
    {error && <ErrorNote>{error}</ErrorNote>}
    {loading && !data ? <Spinner className="mx-auto my-12 h-6 w-6" /> : !data?.data.length ? <Empty>No orders found.</Empty> :
      <Table head={['Order', 'Dealer', 'Date', 'Wanted by', 'Rep', 'Warehouse', 'Total', 'Status']}>{data.data.map(o => <tr key={o.id} className="cursor-pointer hover:bg-df-50/50" onClick={() => router.push(`/app/orders/${o.id}`)}>
        <Td className="font-medium text-df-700">{o.order_no}</Td><Td>{o.dealer?.name}</Td><Td>{fmtDate(o.order_date)}</Td><Td>{o.requested_delivery ? fmtDate(o.requested_delivery) : '-'}</Td><Td>{o.rep?.full_name || '-'}</Td><Td>{o.warehouse?.name || '-'}</Td><Td className="font-medium">{inr(o.total)}</Td><Td><Badge value={o.status} /></Td></tr>)}</Table>}
  </div>
}
export default function Page() { return <Suspense><Inner /></Suspense> }
