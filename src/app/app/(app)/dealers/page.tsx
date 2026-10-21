'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, qs, useDebounced, useFetch } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { Badge, Button, ErrorNote, Input, PageHeader, Select, Spinner, Table, Td, Empty } from '@/components/df/ui'
import { DEALER_FIELDS } from '@/components/df/dealerFields'
import FormModal from '@/components/df/FormModal'
import ImportModal from '@/components/df/ImportModal'
import { useStaff } from '@/components/df/Context'

export default function DealersPage() {
  const router = useRouter(); const me = useStaff()
  const canWrite = me.role === 'admin' || me.role === 'sales_manager'
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [only, setOnly] = useState('')
  const { data, loading, error, reload } = useFetch<{ data: any[] }>(`/api/df/dealers/overview${qs({ q: dq, only })}`)
  const [open, setOpen] = useState(false); const [imp, setImp] = useState(false)
  return <div>
    <PageHeader title="Dealers" subtitle="Your dealer and distributor network, with what each one owes" actions={canWrite && <><Button onClick={() => setImp(true)}><Upload className="h-4 w-4" />Import Excel</Button><Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Add dealer</Button></>} />
    <div className="mb-3 flex flex-wrap gap-2"><Input className="max-w-xs" placeholder="Search name, code, phone, GSTIN" value={q} onChange={e => setQ(e.target.value)} />
      <Select className="w-auto" value={only} onChange={e => setOnly(e.target.value)}><option value="">All dealers</option><option value="owing">Owing money</option><option value="overdue">Has overdue invoices</option></Select></div>
    {error && <ErrorNote>{error}</ErrorNote>}
    {loading && !data ? <Spinner className="mx-auto my-12 h-6 w-6" /> : !data?.data.length ? <Empty>No dealers yet. Add your first dealer or import them from Excel.</Empty> :
      <Table head={['Dealer', 'Contact', 'Territory', 'Rep', 'Outstanding', 'Overdue', 'Credit used', 'Status']}>
        {data.data.map(d => <tr key={d.id} className="cursor-pointer hover:bg-df-50/50" onClick={() => router.push(`/app/dealers/${d.id}`)}>
          <Td><div className="font-medium">{d.name}</div><div className="text-xs text-slate-500">{d.dealer_code}</div></Td>
          <Td>{d.contact_person || '-'}<div className="text-xs text-slate-500">{d.phone}</div></Td><Td>{d.territory?.name || '-'}</Td><Td>{d.rep?.full_name || '-'}</Td>
          <Td className="whitespace-nowrap font-medium">{inr(d.balance)}</Td><Td className={d.overdue > 0 ? 'font-medium text-red-600' : ''}>{d.overdue > 0 ? inr(d.overdue) : '-'}</Td>
          <Td>{d.credit_used_pct === null ? <span className="text-slate-400">no limit</span> : <span className={d.credit_used_pct > 100 ? 'font-medium text-red-600' : d.credit_used_pct > 80 ? 'text-amber-600' : ''}>{d.credit_used_pct}%</span>}</Td>
          <Td><Badge value={d.status} /></Td></tr>)}
      </Table>}
    <FormModal open={open} onClose={() => setOpen(false)} title="Add dealer" fields={DEALER_FIELDS} onSubmit={async v => { const r: any = await api('/api/df/r/dealers', { body: v }); toast.success('Dealer added'); reload(); router.push(`/app/dealers/${r.data.id}`) }} />
    <ImportModal open={imp} onClose={() => setImp(false)} kind="dealers" title="Import dealers" onDone={reload}
      columns="name, contact_person, phone, email, gstin, billing_address, shipping_address, category, credit_limit, payment_terms_days, opening_balance, dealer_code, sales_rep, territory, price_list" />
  </div>
}
