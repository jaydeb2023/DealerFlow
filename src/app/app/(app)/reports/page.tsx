'use client'
import { useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { downloadText, fmtDate, qs, useFetch } from '@/lib/df/client'
import { inr, toCsv, todayISO, addDays } from '@/lib/df/util'
import { Button, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Table, Td } from '@/components/df/ui'
import { useStaff } from '@/components/df/Context'

const ALL = [
  ['sales_trend', 'Sales trend', ['sales_manager', 'finance']], ['sales_by_dealer', 'Sales by dealer', ['sales_manager', 'finance']], ['sales_by_product', 'Sales by product', ['sales_manager']],
  ['sales_by_territory', 'Sales by territory', ['sales_manager']], ['dealer_frequency', 'Dealer order frequency', ['sales_manager']], ['fulfilment', 'Order fulfilment', ['sales_manager', 'warehouse']],
  ['inventory', 'Inventory & low stock', ['sales_manager', 'warehouse', 'finance']], ['ageing', 'Outstanding & ageing', ['sales_manager', 'finance']], ['collections', 'Payment collections', ['sales_manager', 'finance']], ['rep_performance', 'Sales rep performance', ['sales_manager']],
] as const

export default function ReportsPage() {
  const me = useStaff()
  const kinds = ALL.filter(k => me.role === 'admin' || (k[2] as readonly string[]).includes(me.role))
  const [kind, setKind] = useState<string>(kinds[0]?.[0] || 'inventory'); const [from, setFrom] = useState(addDays(todayISO(), -29)); const [to, setTo] = useState(todayISO()); const [group, setGroup] = useState('day')
  const { data, loading, error } = useFetch<any>(`/api/df/reports/${kind}${qs({ from, to, group })}`)
  const fmt = (c: any, v: any) => v === null || v === undefined || v === '' ? '-' : c.type === 'money' ? inr(v) : c.type === 'pct' ? `${v}%` : c.type === 'date' ? fmtDate(v) : v
  const csv = () => data && downloadText(`${kind}-${todayISO()}.csv`, toCsv(data.rows, data.columns.map((c: any) => ({ key: c.key, label: c.label }))))
  return <div>
    <PageHeader title="Reports" subtitle="Calculated from your orders, invoices, payments and stock. Sales include GST." actions={<><Button onClick={csv} disabled={!data}><Download className="h-4 w-4" />CSV / Excel</Button><Button onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button></>} />
    <div className="no-print mb-4 flex flex-wrap gap-2"><Select className="w-auto" value={kind} onChange={e => setKind(e.target.value)}>{kinds.map(k => <option key={k[0]} value={k[0]}>{k[1]}</option>)}</Select>
      {!['inventory', 'ageing'].includes(kind) && <><Input type="date" className="w-auto" value={from} onChange={e => setFrom(e.target.value)} /><Input type="date" className="w-auto" value={to} onChange={e => setTo(e.target.value)} /></>}
      {kind === 'sales_trend' && <Select className="w-auto" value={group} onChange={e => setGroup(e.target.value)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></Select>}</div>
    {error && <ErrorNote>{error}</ErrorNote>}
    {loading && !data ? <Spinner className="mx-auto my-12 h-6 w-6" /> : data && <div className="space-y-3">
      <h2 className="text-lg font-bold">{data.title} {data.period && <span className="text-sm font-normal text-slate-500">· {fmtDate(data.period.from)} to {fmtDate(data.period.to)}</span>}</h2>
      {data.summary && <div className="flex flex-wrap gap-3">{data.summary.map((s: any) => <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><div className="text-xs text-slate-500">{s.label}</div><div className="text-lg font-bold">{typeof s.value === 'number' && /sales|total|collected|overdue|unpaid/i.test(s.label) ? inr(s.value) : s.value}</div></div>)}</div>}
      {data.rows.length ? <Table head={data.columns.map((c: any) => c.label)}>{data.rows.map((r: any, i: number) => <tr key={i}>{data.columns.map((c: any) => <Td key={c.key} className={c.type === 'money' || c.type === 'number' || c.type === 'pct' ? 'whitespace-nowrap' : ''}>{fmt(c, r[c.key])}</Td>)}</tr>)}</Table> : <Empty>No data for these dates.</Empty>}
      {data.note && <p className="text-xs text-slate-500">{data.note}</p>}</div>}
  </div>
}
