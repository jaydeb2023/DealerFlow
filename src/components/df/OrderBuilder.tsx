'use client'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Search, Trash2 } from 'lucide-react'
import { api, useDebounced, useFetch, qs } from '@/lib/df/client'
import { inr, qtyFmt, round2, num } from '@/lib/df/util'
import { Button, Card, Empty, ErrorNote, Field, Input, Select, Spinner, Table, Td, Textarea } from './ui'

interface Line { product_id: string; sku: string; name: string; unit: string; price: number; gst_rate: number; moq: number; available: number; qty: number; discount_pct: number }

/** Shared by the office "New order" screen and the dealer portal. Totals shown here are a preview; the server recomputes them. */
export default function OrderBuilder({ dealerId, isDealer, canDiscount, onDone, initial }: {
  dealerId?: string; isDealer: boolean; canDiscount: boolean; onDone: (r: { id: string; order_no: string; status: string }) => void
  initial?: { id: string; items: { product_id: string; qty: number; discount_pct: number }[]; requested_delivery?: string | null; shipping_address?: string | null; notes?: string | null; shipping?: number }
}) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const { data, loading, error } = useFetch<{ data: any[]; dealer: any }>(isDealer || dealerId ? `/api/df/catalogue${qs({ q: dq, dealer_id: dealerId })}` : null)
  const [lines, setLines] = useState<Record<string, Line>>({})
  const [date, setDate] = useState(initial?.requested_delivery || '')
  const [addr, setAddr] = useState(initial?.shipping_address || '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [ship, setShip] = useState(String(initial?.shipping ?? ''))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { setLines({}) }, [dealerId])
  useEffect(() => { if (data?.dealer && !addr && !initial) setAddr(data.dealer.shipping_address || '') }, [data?.dealer]) // eslint-disable-line
  // when editing, fill quantities once the catalogue has loaded
  useEffect(() => {
    if (!initial || !data) return
    setLines(cur => {
      if (Object.keys(cur).length) return cur
      const next: Record<string, Line> = {}
      initial.items.forEach(it => { const p = data.data.find(x => x.id === it.product_id); if (p) next[p.id] = { product_id: p.id, sku: p.sku, name: p.name, unit: p.unit, price: p.price, gst_rate: Number(p.gst_rate), moq: Number(p.moq), available: p.available, qty: Number(it.qty), discount_pct: Number(it.discount_pct) } })
      return next
    })
  }, [data]) // eslint-disable-line

  const setQty = (p: any, v: string) => setLines(cur => {
    const n = { ...cur }
    const qty = v === '' ? 0 : Number(v)
    if (!(qty > 0)) { delete n[p.id]; return n }
    n[p.id] = { ...(cur[p.id] || { product_id: p.id, sku: p.sku, name: p.name, unit: p.unit, price: p.price, gst_rate: Number(p.gst_rate), moq: Number(p.moq), available: p.available, discount_pct: 0 }), qty }
    return n
  })
  const list = Object.values(lines)
  const totals = useMemo(() => {
    let sub = 0, disc = 0, tax = 0
    list.forEach(l => { const s = round2(l.qty * l.price), d = round2(s * l.discount_pct / 100); sub += s; disc += d; tax += round2((s - d) * l.gst_rate / 100) })
    const sh = canDiscount ? num(ship) : 0
    return { sub, disc, tax, sh, total: round2(sub - disc + tax + sh) }
  }, [list, ship, canDiscount])

  const submit = async (submitNow: boolean) => {
    setErr('')
    if (!list.length) return setErr('Add at least one product.')
    setBusy(true)
    try {
      const body = { dealer_id: dealerId, items: list.map(l => ({ product_id: l.product_id, qty: l.qty, discount_pct: l.discount_pct })), requested_delivery: date || null, shipping_address: addr, notes, shipping: num(ship), submit: submitNow }
      if (initial) { await api(`/api/df/orders/${initial.id}`, { method: 'PUT', body }); if (submitNow) await api(`/api/df/orders/${initial.id}/action`, { body: { to: 'submitted' } }); onDone({ id: initial.id, order_no: '', status: submitNow ? 'submitted' : 'draft' }) }
      else { const r = await api<any>('/api/df/orders', { body }); toast.success(submitNow ? `Order ${r.order_no} submitted` : `Draft ${r.order_no} saved`); onDone(r) }
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  if (!isDealer && !dealerId) return <Empty>Choose a dealer first to see their prices.</Empty>
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="relative mb-3 max-w-sm"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Search products by name, SKU or brand" value={q} onChange={e => setQ(e.target.value)} /></div>
        {error && <ErrorNote>{error}</ErrorNote>}
        {loading && !data ? <Spinner className="mx-auto my-10 h-6 w-6" /> : !data?.data.length ? <Empty>No products found.</Empty> : (
          <Table head={['Product', 'Price', 'Available', 'Min qty', 'Quantity']}>
            {data.data.map(p => {
              const l = lines[p.id]; const short = l && l.qty > p.available
              return <tr key={p.id} className={l ? 'bg-df-50/60' : ''}>
                <Td><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.sku}{p.brand ? ` · ${p.brand}` : ''} · GST {Number(p.gst_rate)}%</div></Td>
                <Td className="whitespace-nowrap">{inr(p.price)} <span className="text-xs text-slate-400">/ {p.unit}</span></Td>
                <Td className={p.available <= 0 ? 'text-red-600' : ''}>{p.available <= 0 ? 'Out of stock' : qtyFmt(p.available)}</Td>
                <Td>{qtyFmt(p.moq)}</Td>
                <Td><Input type="number" min={0} step="any" className="w-24" value={l?.qty ?? ''} onChange={e => setQty(p, e.target.value)} />{short && <div className="mt-0.5 text-[11px] text-amber-600">More than in stock; approval may be delayed</div>}</Td>
              </tr>
            })}
          </Table>
        )}
      </div>
      <div className="space-y-3">
        <Card title={`Order summary (${list.length} item${list.length === 1 ? '' : 's'})`}>
          {list.length === 0 ? <div className="text-sm text-slate-500">Enter quantities to build the order.</div> : <ul className="mb-3 space-y-2 text-sm">
            {list.map(l => <li key={l.product_id} className="flex items-start justify-between gap-2">
              <div><div className="font-medium leading-tight">{l.name}</div><div className="text-xs text-slate-500">{qtyFmt(l.qty)} × {inr(l.price)}</div>
                {canDiscount && <div className="mt-1 flex items-center gap-1 text-xs">Discount % <Input type="number" min={0} max={100} className="h-7 w-16 px-1.5 py-0.5" value={l.discount_pct || ''} onChange={e => setLines(c => ({ ...c, [l.product_id]: { ...c[l.product_id], discount_pct: Number(e.target.value) || 0 } }))} /></div>}</div>
              <div className="flex items-center gap-1"><span className="whitespace-nowrap">{inr(round2(l.qty * l.price * (1 - l.discount_pct / 100)))}</span><button onClick={() => setQty({ id: l.product_id }, '0')} className="text-slate-400 hover:text-red-500" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button></div>
            </li>)}
          </ul>}
          <dl className="space-y-1 border-t border-slate-100 pt-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(totals.sub)}</dd></div>
            {totals.disc > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{inr(totals.disc)}</dd></div>}
            <div className="flex justify-between"><dt>GST</dt><dd>{inr(totals.tax)}</dd></div>
            {canDiscount && <div className="flex items-center justify-between"><dt>Shipping</dt><dd><Input type="number" min={0} className="h-7 w-24 px-1.5 py-0.5 text-right" value={ship} onChange={e => setShip(e.target.value)} /></dd></div>}
            <div className="flex justify-between border-t border-slate-100 pt-1 text-base font-bold"><dt>Total</dt><dd>{inr(totals.total)}</dd></div>
          </dl>
          <p className="mt-1 text-[11px] text-slate-400">Final prices and tax are confirmed by the system when you save.</p>
        </Card>
        <Card title="Delivery">
          <div className="space-y-3">
            <Field label="Requested delivery date"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
            <Field label="Shipping address"><Textarea rows={2} value={addr} onChange={e => setAddr(e.target.value)} /></Field>
            <Field label="Notes"><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          </div>
        </Card>
        {err && <ErrorNote>{err}</ErrorNote>}
        <div className="flex gap-2"><Button className="flex-1" loading={busy} onClick={() => submit(false)}>Save draft</Button><Button variant="primary" className="flex-1" loading={busy} onClick={() => submit(true)}>{isDealer ? 'Place order' : 'Submit order'}</Button></div>
      </div>
    </div>
  )
}
