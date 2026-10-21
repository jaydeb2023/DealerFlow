'use client'
import { useRouter } from 'next/navigation'
import { fmtDate, useFetch } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { Badge, Empty, ErrorNote, PageHeader, Spinner, Table, Td } from '@/components/df/ui'

export default function PortalOrders() {
  const router = useRouter(); const { data, error } = useFetch<{ data: any[] }>('/api/df/orders')
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-16 h-7 w-7" />
  return <div><PageHeader title="My orders" subtitle="Track every order from request to delivery" />
    {data.data.length ? <Table head={['Order', 'Date', 'Wanted by', 'Total', 'Status']}>{data.data.map(o => <tr key={o.id} className="cursor-pointer hover:bg-df-50/50" onClick={() => router.push(`/app/portal/orders/${o.id}`)}><Td className="font-medium text-df-700">{o.order_no}</Td><Td>{fmtDate(o.order_date)}</Td><Td>{o.requested_delivery ? fmtDate(o.requested_delivery) : '-'}</Td><Td>{inr(o.total)}</Td><Td><Badge value={o.status} /></Td></tr>)}</Table> : <Empty>You have not placed any orders yet.</Empty>}</div>
}
