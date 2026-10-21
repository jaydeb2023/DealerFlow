'use client'
import { useState } from 'react'
import { Upload } from 'lucide-react'
import ResourcePage from '@/components/df/ResourcePage'
import ImportModal from '@/components/df/ImportModal'
import { Badge, Button, Tabs, Card, Empty } from '@/components/df/ui'
import { useStaff } from '@/components/df/Context'
import { inr } from '@/lib/df/util'
import { UNITS } from '@/lib/df/constants'
import { api, useFetch } from '@/lib/df/client'
import toast from 'react-hot-toast'
import FormModal from '@/components/df/FormModal'

type Tab = 'products' | 'categories' | 'pricelists'

function PriceLists() {
  const { data, reload } = useFetch<{ data: any[] }>('/api/df/r/price_lists')
  const [sel, setSel] = useState<any>(null); const [open, setOpen] = useState(false)
  const items = useFetch<{ data: any[] }>(sel ? `/api/df/r/price_list_items?price_list_id=${sel.id}&limit=1000` : null)
  const [add, setAdd] = useState(false)
  return <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
    <Card title="Price lists" actions={<Button size="sm" variant="primary" onClick={() => setOpen(true)}>New</Button>}>
      {data?.data.length ? <ul className="space-y-1">{data.data.map(p => <li key={p.id}><button onClick={() => setSel(p)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${sel?.id === p.id ? 'bg-df-100 font-semibold' : 'hover:bg-slate-50'}`}>{p.name}<div className="text-xs text-slate-500">{Number(p.discount_pct)}% off list price{p.active ? '' : ' · inactive'}</div></button></li>)}</ul> : <Empty>No price lists. Dealers pay list price.</Empty>}
    </Card>
    <Card title={sel ? `${sel.name}: special prices` : 'Special prices'} actions={sel && <Button size="sm" onClick={() => setAdd(true)}>Set a price</Button>}>
      {!sel ? <p className="text-sm text-slate-500">Choose a list. Products without a special price get list price less the list's discount %.</p> : items.data?.data.length ? <table className="w-full text-sm"><tbody>{items.data.data.map(i => <tr key={i.id} className="border-b border-slate-100"><td className="py-1.5">{i.product?.name} <span className="text-xs text-slate-400">{i.product?.sku}</span></td><td className="text-right">{inr(i.price)}</td><td className="w-10 text-right"><button className="text-xs text-red-500" onClick={async () => { await api(`/api/df/r/price_list_items/${i.id}`, { method: 'DELETE' }); items.reload() }}>remove</button></td></tr>)}</tbody></table> : <p className="text-sm text-slate-500">No special prices yet.</p>}
    </Card>
    <FormModal open={open} onClose={() => setOpen(false)} title="New price list" fields={[{ key: 'name', label: 'Name', required: true }, { key: 'discount_pct', label: 'Discount % off list price', type: 'number', default: 0 }]} onSubmit={async v => { await api('/api/df/r/price_lists', { body: v }); toast.success('Created'); reload() }} />
    <FormModal open={add} onClose={() => setAdd(false)} title="Special price" fields={[{ key: 'product_id', label: 'Product', type: 'select', required: true, options: { remote: 'products', label: (p: any) => `${p.name} (${p.sku}) · list ${inr(p.list_price)}` } }, { key: 'price', label: 'Price (₹, before GST)', type: 'number', required: true }]}
      onSubmit={async v => { await api('/api/df/r/price_list_items', { body: { ...v, price_list_id: sel.id } }); toast.success('Saved'); items.reload() }} />
  </div>
}

export default function ProductsPage() {
  const me = useStaff(); const canWrite = me.role === 'admin' || me.role === 'sales_manager'
  const [tab, setTab] = useState<Tab>('products'); const [imp, setImp] = useState(false)
  return <div>
    <Tabs<Tab> tabs={[{ id: 'products', label: 'Products' }, { id: 'categories', label: 'Categories' }, ...(me.role !== 'warehouse' ? [{ id: 'pricelists' as Tab, label: 'Dealer price lists' }] : [])]} value={tab} onChange={setTab} />
    {tab === 'products' && <ResourcePage title="Products" subtitle="Your catalogue with GST, minimum order and reorder levels" resource="products" canCreate={canWrite} canEdit={canWrite} canDelete={me.role === 'admin'} exportKind="products" createLabel="Add product" searchPlaceholder="Search name, SKU, brand, HSN"
      headerExtra={canWrite && <Button onClick={() => setImp(true)}><Upload className="h-4 w-4" />Import Excel</Button>}
      columns={[{ key: 'sku', label: 'SKU' }, { key: 'name', label: 'Product', render: r => <div><div className="font-medium">{r.name}</div><div className="text-xs text-slate-500">{r.brand || ''}</div></div> }, { key: 'category', label: 'Category', render: r => r.category?.name || '-' }, { key: 'unit', label: 'Unit' }, { key: 'list_price', label: 'List price', render: r => inr(r.list_price) }, { key: 'gst_rate', label: 'GST', render: r => `${Number(r.gst_rate)}%` }, { key: 'moq', label: 'Min qty' }, { key: 'reorder_level', label: 'Reorder at' }, { key: 'active', label: 'Status', render: r => <Badge value={r.active ? 'active' : 'inactive'} /> }]}
      fields={[{ key: 'sku', label: 'SKU / product code', required: true }, { key: 'name', label: 'Product name', required: true }, { key: 'category_id', label: 'Category', type: 'select', options: { remote: 'categories', label: (c: any) => c.name } }, { key: 'brand', label: 'Brand' },
        { key: 'unit', label: 'Unit', type: 'select', options: UNITS.map(u => ({ value: u, label: u })), default: 'pcs' }, { key: 'list_price', label: 'List price (₹, before GST)', type: 'number', default: 0 }, { key: 'gst_rate', label: 'GST rate %', type: 'number', default: 18, help: 'Check the correct rate with your accountant' }, { key: 'hsn', label: 'HSN code' },
        { key: 'moq', label: 'Minimum order quantity', type: 'number', default: 1 }, { key: 'reorder_level', label: 'Reorder level', type: 'number', default: 0, help: 'Alert when free stock falls to this' }, { key: 'image_url', label: 'Image URL' }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'active', label: 'Available for ordering', type: 'checkbox', default: true }]} />}
    {tab === 'categories' && <ResourcePage title="Categories" resource="categories" canCreate={canWrite} canEdit={canWrite} canDelete={canWrite} createLabel="Add category" columns={[{ key: 'name', label: 'Category' }]} fields={[{ key: 'name', label: 'Name', required: true }]} />}
    {tab === 'pricelists' && <PriceLists />}
    <ImportModal open={imp} onClose={() => setImp(false)} kind="products" title="Import products" onDone={() => setTab('products')} columns="sku, name, category, brand, unit, list_price, gst_rate, hsn, moq, reorder_level, description" />
  </div>
}
