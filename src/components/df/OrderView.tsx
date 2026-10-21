'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { api, ApiError, fmtDate, fmtDateTime, useFetch } from '@/lib/df/client'
import { inr, qtyFmt } from '@/lib/df/util'
import { ORDER_NEXT, ORDER_MOVE_ROLES, labelize, type OrderStatus } from '@/lib/df/constants'
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Textarea } from './ui'
import FormModal from './FormModal'
import OrderBuilder from './OrderBuilder'
import { useStaff } from './Context'

const FLOW: OrderStatus[] = ['draft', 'submitted', 'approved', 'picking', 'packed', 'dispatched', 'delivered']

export default function OrderView({ id, portal = false }: { id: string; portal?: boolean }) {
  const me = useStaff(); const router = useRouter()
  const { data, error, reload } = useFetch<any>(`/api/df/orders/${id}`)
  const whs = useFetch<{ data: any[] }>(portal ? null : '/api/df/r/warehouses?active=true')
  const [busy, setBusy] = useState(false)
  const [approve, setApprove] = useState(false); const [wh, setWh] = useState(''); const [credit, setCredit] = useState<any>(null); const [reason, setReason] = useState(''); const [aerr, setAerr] = useState('')
  const [reject, setReject] = useState(false); const [dispatch, setDispatch] = useState(false); const [dq, setDq] = useState<Record<string, string>>({}); const [dform, setDform] = useState<any>({}); const [derr, setDerr] = useState('')
  const [edit, setEdit] = useState(false)
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-16 h-7 w-7" />
  const { order: o, items, history, dispatches, invoice } = data
  const allowed = (to: OrderStatus) => (ORDER_NEXT[o.status as OrderStatus] || []).includes(to) && (me.role === 'admin' || (ORDER_MOVE_ROLES[to] || []).includes(me.role))
  const canEditDraft = ['draft'].includes(o.status) || (!portal && ['submitted', 'under_review'].includes(o.status) && me.role !== 'warehouse' && me.role !== 'finance')

  const move = async (to: string, extra: any = {}) => {
    setBusy(true)
    try { await api(`/api/df/orders/${id}/action`, { body: { to, ...extra } }); toast.success(`Order ${labelize(to).toLowerCase()}`); setApprove(false); setReject(false); setCredit(null); reload() }
    catch (e: any) { if (e instanceof ApiError && e.code === 'CREDIT_LIMIT') { setCredit(e.data) } if (to === 'approved') setAerr(e.message); else toast.error(e.message) } finally { setBusy(false) }
  }
  const doApprove = () => { setAerr(''); move('approved', { warehouse_id: wh || o.warehouse_id || whs.data?.data?.[0]?.id, ...(credit?.can_override ? { override_credit: true, override_reason: reason } : {}) }) }
  const doDispatch = async () => {
    setDerr('')
    const lines = items.map((i: any) => ({ order_item_id: i.id, qty: Number(dq[i.id] || 0) })).filter((l: any) => l.qty > 0)
    try { await api(`/api/df/orders/${id}/dispatch`, { body: { lines, ...dform } }); toast.success('Dispatch recorded'); setDispatch(false); setDq({}); reload() } catch (e: any) { setDerr(e.message) }
  }
  const invoiceIt = async () => { setBusy(true); try { const r: any = await api(`/api/df/orders/${id}/invoice`, { body: {} }); toast.success(`Invoice ${r.invoice_no} created`); reload() } catch (e: any) { toast.error(e.message) } finally { setBusy(false) } }
  const repeat = async () => { try { const r: any = await api(`/api/df/orders/${id}/duplicate`, { body: {} }); toast.success(`Draft ${r.order_no} created`); router.push(portal ? `/app/portal/orders/${r.id}` : `/app/orders/${r.id}`) } catch (e: any) { toast.error(e.message) } }
  const idx = FLOW.indexOf(o.status === 'partially_fulfilled' ? 'picking' : o.status === 'under_review' ? 'submitted' : o.status)

  return <div className="space-y-4">
    <PageHeader title={`Order ${o.order_no}`} subtitle={`${o.dealer?.name || ''} · placed ${fmtDate(o.order_date)}${o.requested_delivery ? ' · wanted by ' + fmtDate(o.requested_delivery) : ''}`}
      actions={<><Badge value={o.status} className="px-3 py-1 text-sm" />
        {canEditDraft && <Button onClick={() => setEdit(true)}>Edit</Button>}
        {(portal || me.role !== 'warehouse') && me.role !== 'finance' && <Button onClick={repeat}>Repeat order</Button>}
        <Button onClick={() => window.print()}>Print</Button></>} />
    {!['rejected', 'cancelled', 'returned'].includes(o.status) && <ol className="no-print flex flex-wrap gap-1 text-xs">{FLOW.map((s, i) => <li key={s} className={`rounded-full px-3 py-1 ${i <= idx ? 'bg-df-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{labelize(s)}</li>)}</ol>}
    {o.reject_reason && <ErrorNote>Rejected: {o.reject_reason}</ErrorNote>}
    {o.credit_override && !portal && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Credit exception approved: {o.credit_override_reason}</div>}

    {!portal && <div className="no-print flex flex-wrap gap-2">
      {allowed('submitted') && o.status === 'draft' && <Button variant="primary" loading={busy} onClick={() => move('submitted')}>Submit for approval</Button>}
      {allowed('under_review') && o.status === 'submitted' && <Button loading={busy} onClick={() => move('under_review')}>Start review</Button>}
      {allowed('approved') && <Button variant="primary" onClick={() => { setAerr(''); setCredit(null); setApprove(true) }}>Approve</Button>}
      {allowed('rejected') && <Button variant="danger" onClick={() => setReject(true)}>Reject</Button>}
      {allowed('picking') && <Button loading={busy} onClick={() => move('picking')}>Start picking</Button>}
      {allowed('packed') && <Button loading={busy} onClick={() => move('packed')}>Mark packed</Button>}
      {['approved', 'picking', 'packed', 'partially_fulfilled'].includes(o.status) && (me.role === 'admin' || me.role === 'warehouse' || me.role === 'sales_manager') && <Button variant="primary" onClick={() => { setDq(Object.fromEntries(items.map((i: any) => [i.id, String(Number(i.qty) - Number(i.qty_dispatched))]))); setDispatch(true) }}>Dispatch</Button>}
      {allowed('delivered') && <Button loading={busy} onClick={() => move('delivered')}>Mark delivered</Button>}
      {allowed('returned') && <Button loading={busy} onClick={() => confirm('Mark this order as returned? Put the goods back into stock from Inventory > Returned goods.') && move('returned')}>Mark returned</Button>}
      {allowed('cancelled') && <Button loading={busy} onClick={() => confirm('Cancel this order? Reserved stock is released.') && move('cancelled')}>Cancel order</Button>}
      {!invoice && ['approved', 'picking', 'packed', 'partially_fulfilled', 'dispatched', 'delivered'].includes(o.status) && (me.role === 'admin' || me.role === 'finance' || me.role === 'sales_manager') && <Button loading={busy} onClick={invoiceIt}>Create invoice</Button>}
      {invoice && me.role !== 'warehouse' && me.role !== 'sales_rep' && <Link href={`/app/invoices/${invoice.id}`}><Button>View invoice {invoice.invoice_no}</Button></Link>}
    </div>}
    {portal && ['draft', 'submitted'].includes(o.status) && <div className="no-print flex gap-2">{o.status === 'draft' && <Button variant="primary" loading={busy} onClick={() => move('submitted')}>Place order</Button>}<Button variant="danger" loading={busy} onClick={() => confirm('Cancel this order?') && move('cancelled')}>Cancel order</Button></div>}

    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Items" pad={false}><Table className="border-0" head={['Product', 'Qty', 'Price', 'Disc.', 'GST', 'Total', 'Dispatched']}>
          {items.map((i: any) => <tr key={i.id}><Td><div className="font-medium">{i.name}</div><div className="text-xs text-slate-500">{i.sku}</div></Td><Td>{qtyFmt(i.qty)} {i.unit}</Td><Td>{inr(i.unit_price)}</Td><Td>{Number(i.discount_pct) ? `${Number(i.discount_pct)}%` : '-'}</Td><Td>{inr(i.line_tax)} <span className="text-xs text-slate-400">({Number(i.gst_rate)}%)</span></Td><Td className="font-medium">{inr(i.line_total)}</Td><Td>{qtyFmt(i.qty_dispatched)}</Td></tr>)}
        </Table>
          <dl className="ml-auto max-w-xs space-y-1 p-4 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(o.subtotal)}</dd></div>
            {Number(o.discount_total) > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{inr(o.discount_total)}</dd></div>}
            <div className="flex justify-between"><dt>GST</dt><dd>{inr(o.tax_total)}</dd></div>
            {Number(o.shipping) > 0 && <div className="flex justify-between"><dt>Shipping</dt><dd>{inr(o.shipping)}</dd></div>}
            <div className="flex justify-between border-t pt-1 text-base font-bold"><dt>Total</dt><dd>{inr(o.total)}</dd></div>
          </dl></Card>
        {dispatches.length > 0 && <Card title="Dispatches" pad={false}><Table className="border-0" head={['No.', 'Date', 'Transport', 'Vehicle / tracking', 'Status']}>{dispatches.map((d: any) => <tr key={d.id}><Td className="font-medium">{d.dispatch_no}</Td><Td>{fmtDate(d.dispatched_on)}</Td><Td>{d.transporter || '-'}</Td><Td>{[d.vehicle_no, d.tracking_no].filter(Boolean).join(' / ') || '-'}</Td><Td><Badge value={d.status} />{d.pod_url && <a className="ml-2 text-xs text-df-700 underline" href={`/api/df/dispatches/${d.id}/pod`} target="_blank" rel="noreferrer">proof</a>}</Td></tr>)}</Table></Card>}
      </div>
      <div className="space-y-4">
        <Card title="Order details"><dl className="space-y-2 text-sm">
          {[['Dealer', o.dealer?.name], ['Warehouse', o.warehouse?.name], ['Sales rep', o.rep?.full_name], ['Payment terms', o.payment_terms_days != null ? `${o.payment_terms_days} days` : null], ['Ship to', o.shipping_address], ['Dealer notes', o.notes], ...(portal ? [] : [['Internal notes', o.internal_notes]])].map(([k, v]) => <div key={k as string}><dt className="text-xs text-slate-500">{k}</dt><dd>{(v as string) || '-'}</dd></div>)}
        </dl></Card>
        <Card title="History"><ol className="space-y-3 text-sm">{history.map((h: any) => <li key={h.id}><div className="flex items-center gap-2"><Badge value={h.to_status} /><span className="text-xs text-slate-400">{fmtDateTime(h.created_at)}</span></div><div className="text-slate-600">{h.note}{h.actor_name ? <span className="text-xs text-slate-400"> · {h.actor_name}</span> : null}</div></li>)}</ol></Card>
      </div>
    </div>

    <Modal open={approve} onClose={() => setApprove(false)} title={`Approve ${o.order_no}`} footer={<><Button onClick={() => setApprove(false)}>Close</Button><Button variant="primary" loading={busy} onClick={doApprove} disabled={!!credit && !credit.can_override}>{credit?.can_override ? 'Approve credit exception' : 'Approve and reserve stock'}</Button></>}>
      <div className="space-y-3 text-sm"><p>Approving reserves the stock so it cannot be promised to anyone else.</p>
        {(whs.data?.data?.length || 0) > 1 && <Field label="Supplying warehouse"><Select value={wh || o.warehouse_id || ''} onChange={e => setWh(e.target.value)}><option value="">Select...</option>{whs.data!.data.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>}
        {aerr && <ErrorNote>{aerr}</ErrorNote>}
        {credit?.can_override && <Field label="Reason for the credit exception"><Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} /></Field>}
        {credit && !credit.can_override && <p className="text-slate-600">Only the company owner/admin can approve a credit exception. Ask them to approve it, or ask the dealer to pay first.</p>}
      </div>
    </Modal>
    <FormModal open={reject} onClose={() => setReject(false)} title="Reject order" submitLabel="Reject" fields={[{ key: 'reject_reason', label: 'Reason (the dealer will see this)', type: 'textarea', required: true }]} onSubmit={async v => { await move('rejected', v) }} />
    <Modal open={dispatch} onClose={() => setDispatch(false)} wide title="Record dispatch" footer={<><Button onClick={() => setDispatch(false)}>Cancel</Button><Button variant="primary" onClick={doDispatch}>Record dispatch</Button></>}>
      <div className="space-y-3">{derr && <ErrorNote>{derr}</ErrorNote>}
        <Table head={['Product', 'Ordered', 'Already sent', 'Send now']}>{items.map((i: any) => <tr key={i.id}><Td>{i.name}</Td><Td>{qtyFmt(i.qty)}</Td><Td>{qtyFmt(i.qty_dispatched)}</Td><Td><Input type="number" min={0} className="w-24" value={dq[i.id] ?? ''} onChange={e => setDq({ ...dq, [i.id]: e.target.value })} /></Td></tr>)}</Table>
        <div className="grid gap-3 sm:grid-cols-2">{[['transporter', 'Transporter / delivery partner'], ['vehicle_no', 'Vehicle number'], ['tracking_no', 'Tracking / LR number']].map(([k, l]) => <Field key={k} label={l}><Input value={dform[k] || ''} onChange={e => setDform({ ...dform, [k]: e.target.value })} /></Field>)}<Field label="Dispatch date"><Input type="date" value={dform.date || ''} onChange={e => setDform({ ...dform, date: e.target.value })} /></Field></div>
        <p className="text-xs text-slate-500">Sending less than the full quantity records a partial fulfilment; the rest stays reserved for the next dispatch.</p></div>
    </Modal>
    <Modal open={edit} onClose={() => setEdit(false)} wide title={`Edit ${o.order_no}`}>
      <OrderBuilder dealerId={o.dealer_id} isDealer={portal} canDiscount={me.role === 'admin' || me.role === 'sales_manager'} initial={{ id, items: items.map((i: any) => ({ product_id: i.product_id, qty: i.qty, discount_pct: i.discount_pct })), requested_delivery: o.requested_delivery, shipping_address: o.shipping_address, notes: o.notes, shipping: Number(o.shipping) }} onDone={() => { setEdit(false); reload() }} />
    </Modal>
  </div>
}
