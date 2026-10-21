'use client'
import { useState } from 'react'
import { Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtDateTime, qs, useDebounced, useFetch } from '@/lib/df/client'
import { qtyFmt } from '@/lib/df/util'
import { Badge, Button, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Table, Tabs, Td } from '@/components/df/ui'
import FormModal from '@/components/df/FormModal'
import ImportModal from '@/components/df/ImportModal'
import { useStaff } from '@/components/df/Context'

type Tab = 'stock' | 'moves'

export default function InventoryPage() {
  const me = useStaff(); const canWrite = me.role === 'admin' || me.role === 'warehouse'
  const [tab, setTab] = useState<Tab>('stock'); const [q, setQ] = useState(''); const dq = useDebounced(q); const [status, setStatus] = useState('')
  const { data, loading, error, reload } = useFetch<{ data: any[]; warehouses: any[] }>(`/api/df/inventory${qs({ q: dq, status })}`)
  const moves = useFetch<{ data: any[] }>(tab === 'moves' ? '/api/df/r/stock_movements?limit=300' : null)
  const [act, setAct] = useState<null | { kind: string; product?: any }>(null); const [imp, setImp] = useState(false)
  const whOpts = (data?.warehouses || []).filter(w => w.active).map(w => ({ value: w.id, label: w.name }))
  const prodOpts = (data?.data || []).map(p => ({ value: p.id, label: `${p.name} (${p.sku})` }))
  const cfg: Record<string, { title: string; fields: any[]; intro?: string }> = {
    receipt: { title: 'Goods receipt', intro: 'Stock received from a supplier or production.', fields: [{ key: 'product_id', label: 'Product', type: 'select', options: prodOpts, required: true }, { key: 'warehouse_id', label: 'Warehouse', type: 'select', options: whOpts, required: true, default: whOpts[0]?.value }, { key: 'qty', label: 'Quantity received', type: 'number', required: true }, { key: 'reason', label: 'Reference / note', placeholder: 'Supplier, invoice no.' }] },
    adjustment: { title: 'Stock adjustment', intro: 'Use a positive number to add stock and a negative number to remove it (damage, count correction). A reason is required.', fields: [{ key: 'product_id', label: 'Product', type: 'select', options: prodOpts, required: true }, { key: 'warehouse_id', label: 'Warehouse', type: 'select', options: whOpts, required: true, default: whOpts[0]?.value }, { key: 'qty', label: 'Change (+ / -)', type: 'number', required: true }, { key: 'reason', label: 'Reason', required: true }] },
    transfer: { title: 'Transfer between warehouses', fields: [{ key: 'product_id', label: 'Product', type: 'select', options: prodOpts, required: true }, { key: 'warehouse_id', label: 'From warehouse', type: 'select', options: whOpts, required: true }, { key: 'to_warehouse_id', label: 'To warehouse', type: 'select', options: whOpts, required: true }, { key: 'qty', label: 'Quantity', type: 'number', required: true }, { key: 'reason', label: 'Note' }] },
    return: { title: 'Returned goods back into stock', fields: [{ key: 'product_id', label: 'Product', type: 'select', options: prodOpts, required: true }, { key: 'warehouse_id', label: 'Warehouse', type: 'select', options: whOpts, required: true, default: whOpts[0]?.value }, { key: 'qty', label: 'Quantity', type: 'number', required: true }, { key: 'reason', label: 'Reason / order no.' }] },
  }
  const a = act ? cfg[act.kind] : null
  return <div>
    <PageHeader title="Inventory" subtitle="Available = on hand minus stock reserved for approved orders. The system will not let you promise the same stock twice."
      actions={canWrite && <><Button onClick={() => setImp(true)}><Upload className="h-4 w-4" />Import opening stock</Button><Button onClick={() => setAct({ kind: 'transfer' })}>Transfer</Button><Button onClick={() => setAct({ kind: 'adjustment' })}>Adjust</Button><Button variant="primary" onClick={() => setAct({ kind: 'receipt' })}>Goods receipt</Button></>} />
    <Tabs<Tab> tabs={[{ id: 'stock', label: 'Stock levels' }, { id: 'moves', label: 'Movement history' }]} value={tab} onChange={setTab} />
    {tab === 'stock' && <>
      <div className="mb-3 flex flex-wrap gap-2"><Input className="max-w-xs" placeholder="Search product or SKU" value={q} onChange={e => setQ(e.target.value)} /><Select className="w-auto" value={status} onChange={e => setStatus(e.target.value)}><option value="">All products</option><option value="attention">Needs attention</option><option value="low">Low stock</option><option value="out">Out of stock</option></Select></div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data ? <Spinner className="mx-auto my-12 h-6 w-6" /> : !data?.data.length ? <Empty>No products yet. Add products first, then record stock with a goods receipt.</Empty> :
        <Table head={['Product', 'On hand', 'Reserved', 'Available', 'Reorder at', 'By warehouse', 'Status']}>
          {data.data.map(p => <tr key={p.id}><Td><div className="font-medium">{p.name}</div><div className="text-xs text-slate-500">{p.sku}</div></Td><Td>{qtyFmt(p.on_hand)} {p.unit}</Td><Td>{qtyFmt(p.reserved)}</Td><Td className="font-semibold">{qtyFmt(p.available)}</Td><Td>{qtyFmt(p.reorder_level)}</Td>
            <Td className="text-xs text-slate-600">{p.by_warehouse.map((w: any) => `${data.warehouses.find(x => x.id === w.warehouse_id)?.name || '?'}: ${qtyFmt(w.on_hand)}`).join(' · ') || '-'}</Td><Td><Badge value={p.status} /></Td></tr>)}
        </Table>}
    </>}
    {tab === 'moves' && (moves.data?.data.length ? <Table head={['When', 'Product', 'Warehouse', 'Type', 'Change', 'Balance after', 'Reason']}>{moves.data.data.map(m => <tr key={m.id}><Td>{fmtDateTime(m.created_at)}</Td><Td>{m.product?.name}</Td><Td>{m.warehouse?.name}</Td><Td>{m.kind.replace('_', ' ')}</Td><Td className={m.qty < 0 ? 'text-red-600' : 'text-emerald-700'}>{m.qty > 0 ? '+' : ''}{qtyFmt(m.qty)}</Td><Td>{qtyFmt(m.balance_after)}</Td><Td>{m.reason || '-'}</Td></tr>)}</Table> : <Empty>No stock movements yet.</Empty>)}
    {a && <FormModal open title={a.title} intro={a.intro} fields={a.fields} initial={act?.product ? { product_id: act.product.id } : undefined} onClose={() => setAct(null)} onSubmit={async v => { await api('/api/df/inventory', { body: { ...v, action: act!.kind } }); toast.success('Stock updated'); reload() }} />}
    <ImportModal open={imp} onClose={() => setImp(false)} kind="stock" title="Import opening stock" onDone={reload} columns="sku, warehouse, qty" />
  </div>
}
