'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { api, fmtDate, useFetch } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Table, Td } from '@/components/df/ui'
import FormModal from '@/components/df/FormModal'

export default function DispatchPage() {
  const { data, error, reload } = useFetch<{ data: any[]; pending: any[] }>('/api/df/dispatches')
  const [deliver, setDeliver] = useState<any>(null); const [problem, setProblem] = useState<any>(null)
  const upload = async (id: string, f?: File | null) => { if (!f) return; const fd = new FormData(); fd.append('file', f); try { await api(`/api/df/dispatches/${id}/pod`, { form: fd }); toast.success('Proof uploaded'); reload() } catch (e: any) { toast.error(e.message) } }
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-16 h-7 w-7" />
  return <div className="space-y-5">
    <PageHeader title="Dispatch & delivery" subtitle="Orders waiting to go out, and shipments on the way" />
    <Card title={`Waiting to dispatch (${data.pending.length})`} pad={false}>
      {data.pending.length ? <Table className="border-0" head={['Order', 'Dealer', 'Wanted by', 'Status', 'Warehouse', 'Total']}>{data.pending.map(o => <tr key={o.id}><Td><Link className="font-medium text-df-700" href={`/app/orders/${o.id}`}>{o.order_no}</Link></Td><Td>{o.dealer?.name}</Td><Td>{o.requested_delivery ? fmtDate(o.requested_delivery) : '-'}</Td><Td><Badge value={o.status} /></Td><Td>{o.warehouse?.name || '-'}</Td><Td>{inr(o.total)}</Td></tr>)}</Table> : <div className="p-4"><Empty>Nothing waiting. Approved orders appear here.</Empty></div>}
    </Card>
    <Card title="Shipments" pad={false}>
      {data.data.length ? <Table className="border-0" head={['Dispatch', 'Order', 'Dealer', 'Date', 'Transport', 'Status', 'Actions']}>{data.data.map(d => <tr key={d.id}>
        <Td className="font-medium">{d.dispatch_no}</Td><Td><Link className="text-df-700" href={`/app/orders/${d.order?.id}`}>{d.order?.order_no}</Link></Td><Td>{d.order?.dealer?.name}</Td><Td>{fmtDate(d.dispatched_on)}</Td>
        <Td>{d.transporter || '-'}<div className="text-xs text-slate-500">{[d.vehicle_no, d.tracking_no].filter(Boolean).join(' / ')}</div></Td><Td><Badge value={d.status} />{d.exception_note && <div className="mt-1 text-xs text-red-600">{d.exception_note}</div>}</Td>
        <Td><div className="flex flex-wrap items-center gap-1">{d.status === 'dispatched' && <><Button size="sm" variant="primary" onClick={() => setDeliver(d)}>Delivered</Button><Button size="sm" onClick={() => setProblem(d)}>Problem</Button></>}
          <label className="cursor-pointer rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50">{d.pod_url ? 'Replace proof' : 'Upload proof'}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => upload(d.id, e.target.files?.[0])} /></label>
          {d.pod_url && <a className="text-xs text-df-700 underline" href={`/api/df/dispatches/${d.id}/pod`} target="_blank" rel="noreferrer">view</a>}</div></Td></tr>)}</Table> : <div className="p-4"><Empty>No shipments yet.</Empty></div>}
    </Card>
    <FormModal open={!!deliver} onClose={() => setDeliver(null)} title={`Mark ${deliver?.dispatch_no} delivered`} fields={[{ key: 'delivered_on', label: 'Delivered on', type: 'date', default: new Date().toISOString().slice(0, 10) }]} onSubmit={async v => { await api(`/api/df/dispatches/${deliver.id}`, { method: 'PATCH', body: { status: 'delivered', ...v } }); toast.success('Marked delivered'); reload() }} />
    <FormModal open={!!problem} onClose={() => setProblem(null)} title={`Delivery problem: ${problem?.dispatch_no}`} intro="Record a shortage, damage or failed delivery. Managers are notified." fields={[{ key: 'exception_note', label: 'What went wrong', type: 'textarea', required: true }]} onSubmit={async v => { await api(`/api/df/dispatches/${problem.id}`, { method: 'PATCH', body: { status: 'exception', ...v } }); toast.success('Recorded'); reload() }} />
  </div>
}
