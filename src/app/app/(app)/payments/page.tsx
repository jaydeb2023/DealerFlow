'use client'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { api, fmtDate, qs, useFetch } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { PAY_MODES, labelize } from '@/lib/df/constants'
import { Badge, Button, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Textarea } from '@/components/df/ui'
import { useStaff } from '@/components/df/Context'
import Receipt from '@/components/df/Receipt'

function RecordModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState<any>({ mode: 'bank_transfer', paid_on: new Date().toISOString().slice(0, 10) })
  const [alloc, setAlloc] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const dealers = useFetch<{ data: any[] }>(open ? '/api/df/dealers/overview?limit=1000' : null)
  const inv = useFetch<{ data: any[] }>(open && f.dealer_id ? `/api/df/invoices${qs({ dealer_id: f.dealer_id, status: 'unpaid' })}` : null)
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))
  const allocated = Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0); const amount = Number(f.amount) || 0
  const autoFill = () => { let left = amount; const n: Record<string, string> = {}; [...(inv.data?.data || [])].sort((a, b) => a.due_date.localeCompare(b.due_date)).forEach(i => { const due = Number(i.total) - Number(i.paid); const t = Math.min(due, left); if (t > 0) { n[i.id] = String(t); left -= t } }); setAlloc(n) }
  const save = async () => {
    setErr(''); setBusy(true)
    try { const r: any = await api('/api/df/payments', { body: { ...f, allocations: Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([invoice_id, v]) => ({ invoice_id, amount: Number(v) })) } }); toast.success(`Receipt ${r.receipt_no} recorded${r.advance > 0 ? ` (₹${r.advance} kept as advance)` : ''}`); setAlloc({}); setF({ mode: 'bank_transfer', paid_on: f.paid_on }); onDone(); onClose() }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return <Modal open={open} onClose={onClose} wide title="Record payment received" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={save}>Save payment</Button></>}>
    <div className="space-y-3">{err && <ErrorNote>{err}</ErrorNote>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dealer" required><Select value={f.dealer_id || ''} onChange={e => { set('dealer_id', e.target.value); setAlloc({}) }}><option value="">Select...</option>{(dealers.data?.data || []).map(d => <option key={d.id} value={d.id}>{d.name} · owes {inr(d.balance)}</option>)}</Select></Field>
        <Field label="Amount received (₹)" required><Input type="number" min={0} value={f.amount || ''} onChange={e => set('amount', e.target.value)} /></Field>
        <Field label="Payment mode"><Select value={f.mode} onChange={e => set('mode', e.target.value)}>{PAY_MODES.map(m => <option key={m} value={m}>{labelize(m)}</option>)}</Select></Field>
        <Field label="Reference (UTR / cheque no.)"><Input value={f.reference || ''} onChange={e => set('reference', e.target.value)} /></Field>
        <Field label="Date received"><Input type="date" value={f.paid_on} onChange={e => set('paid_on', e.target.value)} /></Field>
        <Field label="Notes"><Input value={f.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
      </div>
      {f.dealer_id && <div><div className="mb-1 flex items-center justify-between"><div className="text-sm font-semibold">Apply to invoices</div><Button size="sm" onClick={autoFill}>Oldest first</Button></div>
        {inv.data?.data.length ? <Table head={['Invoice', 'Due', 'Balance', 'Apply']}>{inv.data.data.map(i => <tr key={i.id}><Td>{i.invoice_no}</Td><Td>{fmtDate(i.due_date)}</Td><Td>{inr(Number(i.total) - Number(i.paid))}</Td><Td><Input type="number" min={0} className="w-28" value={alloc[i.id] || ''} onChange={e => setAlloc({ ...alloc, [i.id]: e.target.value })} /></Td></tr>)}</Table> : <div className="text-sm text-slate-500">No unpaid invoices. The amount will be kept as an advance on the dealer account.</div>}
        <div className={`mt-1 text-xs ${allocated > amount ? 'text-red-600' : 'text-slate-500'}`}>Applied {inr(allocated)} of {inr(amount)}{amount > allocated ? ` · ${inr(amount - allocated)} stays as advance` : ''}</div></div>}
      <p className="text-xs text-slate-500">Posted payments cannot be edited or deleted, which keeps the history trustworthy.</p>
    </div></Modal>
}

function Inner() {
  const me = useStaff(); const sp = useSearchParams()
  const { data, loading, error, reload } = useFetch<{ data: any[] }>('/api/df/payments')
  const [open, setOpen] = useState(false); const [rc, setRc] = useState<string | null>(sp.get('receipt'))
  return <div>
    <PageHeader title="Payments received" subtitle="Receipts are permanent records" actions={(me.role === 'admin' || me.role === 'finance') && <Button variant="primary" onClick={() => setOpen(true)}>Record payment</Button>} />
    {error && <ErrorNote>{error}</ErrorNote>}
    {loading && !data ? <Spinner className="mx-auto my-12 h-6 w-6" /> : !data?.data.length ? <Empty>No payments recorded yet.</Empty> :
      <Table head={['Receipt', 'Date', 'Dealer', 'Mode', 'Reference', 'Applied to', 'Amount']}>{data.data.map(p => <tr key={p.id} className="cursor-pointer hover:bg-df-50/50" onClick={() => setRc(p.id)}>
        <Td className="font-medium text-df-700">{p.receipt_no}</Td><Td>{fmtDate(p.paid_on)}</Td><Td>{p.dealer?.name}</Td><Td><Badge value={p.mode} /></Td><Td>{p.reference || '-'}</Td><Td className="text-xs">{p.allocations?.map((a: any) => a.invoice?.invoice_no).join(', ') || <span className="text-slate-400">advance</span>}</Td><Td className="font-medium">{inr(p.amount)}</Td></tr>)}</Table>}
    <RecordModal open={open} onClose={() => setOpen(false)} onDone={reload} />
    <Modal open={!!rc} onClose={() => setRc(null)} wide title="Receipt">{rc && <Receipt id={rc} />}</Modal>
  </div>
}
export default function Page() { return <Suspense><Inner /></Suspense> }
