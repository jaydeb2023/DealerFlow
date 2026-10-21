'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import ResourcePage from '@/components/df/ResourcePage'
import { Badge, Button, Tabs, Table, Td, Empty } from '@/components/df/ui'
import { api, fmtDate, fmtDateTime, useFetch } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { useStaff } from '@/components/df/Context'

type Tab = 'visits' | 'followups' | 'targets' | 'enquiries' | 'performance'

function Performance() {
  const { data } = useFetch<any>('/api/df/reports/rep_performance')
  if (!data) return null
  return data.rows.length ? <Table head={data.columns.map((c: any) => c.label)}>{data.rows.map((r: any, i: number) => <tr key={i}>{data.columns.map((c: any) => <Td key={c.key}>{c.type === 'money' ? inr(r[c.key]) : c.type === 'pct' ? (r[c.key] === null ? '-' : `${r[c.key]}%`) : r[c.key]}</Td>)}</tr>)}</Table> : <Empty>No data yet.</Empty>
}
function Enquiries() {
  const { data, reload } = useFetch<{ data: any[] }>('/api/df/r/enquiries')
  const [reply, setReply] = useState<Record<string, string>>({})
  const send = async (id: string) => { try { await api(`/api/df/r/enquiries/${id}`, { method: 'PATCH', body: { reply: reply[id], status: 'replied' } }); toast.success('Reply saved. The dealer sees it in their portal.'); reload() } catch (e: any) { toast.error(e.message) } }
  if (!data?.data.length) return <Empty>No dealer enquiries or quotation requests yet.</Empty>
  return <div className="space-y-3">{data.data.map(e => <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
    <div className="flex items-center justify-between"><div className="font-semibold">{e.dealer?.name} <span className="font-normal text-slate-400">· {e.kind} · {fmtDateTime(e.created_at)}</span></div><Badge value={e.status} /></div>
    <p className="mt-1 whitespace-pre-line">{e.message}</p>{e.reply && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-emerald-900">Reply: {e.reply}</p>}
    {e.status !== 'closed' && <div className="mt-2 flex gap-2"><input className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="Write a reply" value={reply[e.id] || ''} onChange={ev => setReply({ ...reply, [e.id]: ev.target.value })} /><Button size="sm" variant="primary" onClick={() => send(e.id)}>Reply</Button>
      <Button size="sm" onClick={async () => { await api(`/api/df/r/enquiries/${e.id}`, { method: 'PATCH', body: { status: 'closed' } }); reload() }}>Close</Button></div>}</div>)}</div>
}

export default function TeamPage() {
  const me = useStaff(); const mgr = me.role === 'admin' || me.role === 'sales_manager'
  const [tab, setTab] = useState<Tab>('visits')
  const dealerOpt = { remote: 'dealers', label: (d: any) => `${d.name} (${d.dealer_code})` }
  return <div>
    <Tabs<Tab> tabs={[{ id: 'visits', label: 'Visits & calls' }, { id: 'followups', label: 'Follow-ups due' }, { id: 'enquiries', label: 'Dealer enquiries' }, ...(mgr ? [{ id: 'targets' as Tab, label: 'Targets' }, { id: 'performance' as Tab, label: 'Performance' }] : [])]} value={tab} onChange={setTab} />
    {tab === 'visits' && <ResourcePage title="Visits & calls" subtitle="What your team did with each dealer" resource="visits" canDelete={mgr} createLabel="Log visit / call" searchPlaceholder="Search notes"
      filters={[{ key: 'kind', label: 'Type', options: [{ value: 'visit', label: 'Visit' }, { value: 'call', label: 'Call' }, { value: 'followup', label: 'Follow-up' }] }]}
      columns={[{ key: 'visited_at', label: 'When', render: r => fmtDateTime(r.visited_at) }, { key: 'dealer', label: 'Dealer', render: r => r.dealer?.name }, { key: 'kind', label: 'Type' }, { key: 'rep', label: 'By', render: r => r.rep?.full_name || '-' }, { key: 'outcome', label: 'Outcome' }, { key: 'notes', label: 'Notes' }, { key: 'next_followup_at', label: 'Follow-up', render: r => r.next_followup_at ? fmtDate(r.next_followup_at) : '-' }]}
      fields={[{ key: 'dealer_id', label: 'Dealer', type: 'select', required: true, options: dealerOpt }, { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'visit', label: 'Visit' }, { value: 'call', label: 'Call' }, { value: 'followup', label: 'Follow-up' }], default: 'visit' }, { key: 'outcome', label: 'Outcome' }, { key: 'next_followup_at', label: 'Next follow-up', type: 'datetime' }, { key: 'notes', label: 'Notes', type: 'textarea' }]} />}
    {tab === 'followups' && <ResourcePage title="Follow-ups due" subtitle="Tick them off when done" resource="visits" canCreate={false} fixedQuery={{ followup_done: 'false' }}
      columns={[{ key: 'next_followup_at', label: 'Due', render: r => r.next_followup_at ? fmtDate(r.next_followup_at) : '-' }, { key: 'dealer', label: 'Dealer', render: r => r.dealer?.name }, { key: 'notes', label: 'Last note' }]}
      fields={[{ key: 'followup_done', label: 'Follow-up done', type: 'checkbox' }]} modalTitle="follow-up" />}
    {tab === 'enquiries' && <Enquiries />}
    {tab === 'targets' && <ResourcePage title="Sales targets" subtitle="Monthly sales and collection targets per representative" resource="targets" canDelete createLabel="Set target"
      columns={[{ key: 'period', label: 'Month' }, { key: 'rep', label: 'Representative', render: r => r.rep?.full_name }, { key: 'sales_target', label: 'Sales target', render: r => inr(r.sales_target) }, { key: 'collection_target', label: 'Collection target', render: r => inr(r.collection_target) }]}
      fields={[{ key: 'rep_id', label: 'Representative', type: 'select', required: true, options: { remote: 'staff', label: (s: any) => s.full_name, filter: (s: any) => ['sales_rep', 'sales_manager'].includes(s.role) } }, { key: 'period', label: 'Month (YYYY-MM)', required: true, default: new Date().toISOString().slice(0, 7) }, { key: 'sales_target', label: 'Sales target (₹)', type: 'number', default: 0 }, { key: 'collection_target', label: 'Collection target (₹)', type: 'number', default: 0 }]} />}
    {tab === 'performance' && <Performance />}
  </div>
}
