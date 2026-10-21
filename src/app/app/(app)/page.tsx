'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtDate, useFetch, qs } from '@/lib/df/client'
import { inr, qtyFmt } from '@/lib/df/util'
import { labelize } from '@/lib/df/constants'
import { Badge, Card, Empty, ErrorNote, Input, PageHeader, Spinner, Stat } from '@/components/df/ui'
import { useStaff } from '@/components/df/Context'

const COLORS = ['#2563eb', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#64748b']

export default function Dashboard() {
  const me = useStaff()
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const { data, error } = useFetch<any>(`/api/df/dashboard${qs({ from, to })}`)
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-16 h-7 w-7" />
  const m = data.metrics
  return <div className="space-y-5">
    <PageHeader title="Dashboard" subtitle={`Figures counted from your records · ${fmtDate(data.period.from)} to ${fmtDate(data.period.to)}`}
      actions={<><Input type="date" className="w-auto" value={from} onChange={e => setFrom(e.target.value)} aria-label="From" /><Input type="date" className="w-auto" value={to} onChange={e => setTo(e.target.value)} aria-label="To" /></>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Total sales" value={inr(m.total_sales)} hint="Approved orders, incl. GST" />
      <Stat label="Orders received" value={m.orders_received} hint="In this period" />
      <Stat label="Awaiting approval" value={m.awaiting_approval} tone={m.awaiting_approval ? 'warn' : undefined} href="/app/orders?status=submitted" />
      <Stat label="Awaiting dispatch" value={m.awaiting_dispatch} href="/app/dispatch" />
      <Stat label="Active dealers" value={m.active_dealers} />
      <Stat label="Outstanding receivables" value={inr(m.receivables)} />
      <Stat label="Overdue invoices" value={m.overdue_invoices} hint={inr(m.overdue_amount)} tone={m.overdue_invoices ? 'bad' : undefined} />
      <Stat label="Low-stock products" value={m.low_stock} tone={m.low_stock ? 'warn' : undefined} href="/app/inventory" />
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Sales trend" className="lg:col-span-2">
        {data.trend.length ? <div className="h-64"><ResponsiveContainer><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1e5 ? `${Math.round(v / 1e5)}L` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v)} /><Tooltip formatter={(v: any) => inr(v)} /><Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div> : <Empty>No approved orders in this period yet.</Empty>}
      </Card>
      <Card title="Order status">
        {data.status.length ? <div className="h-64"><ResponsiveContainer><PieChart><Pie data={data.status.map((s: any) => ({ name: labelize(s.status), value: s.count }))} dataKey="value" innerRadius={45} outerRadius={80} paddingAngle={2}>{data.status.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          <ul className="mt-1 flex flex-wrap gap-x-3 text-xs">{data.status.map((s: any, i: number) => <li key={s.status}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{labelize(s.status)} {s.count}</li>)}</ul></div> : <Empty>No orders yet.</Empty>}
      </Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Top products">{data.top_products.length ? <div className="h-56"><ResponsiveContainer><BarChart data={data.top_products} layout="vertical" margin={{ left: 20 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} /><Tooltip formatter={(v: any) => inr(v)} /><Bar dataKey="sales" fill="#06b6d4" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div> : <Empty>No sales yet.</Empty>}</Card>
      <Card title="Top dealers">{data.top_dealers.length ? <ol className="space-y-2 text-sm">{data.top_dealers.map((d: any, i: number) => <li key={i} className="flex justify-between"><span>{i + 1}. {d.name} <span className="text-xs text-slate-400">({d.orders} orders)</span></span><b>{inr(d.sales)}</b></li>)}</ol> : <Empty>No sales yet.</Empty>}</Card>
      <Card title="Needs your attention">
        <div className="space-y-3 text-sm">
          {data.pending_approvals.length > 0 && <div><div className="mb-1 text-xs font-semibold uppercase text-slate-500">Pending approval</div>{data.pending_approvals.slice(0, 5).map((o: any) => <Link key={o.id} href={`/app/orders/${o.id}`} className="flex justify-between py-0.5 hover:text-df-700"><span>{o.order_no} · {o.dealer?.name}</span><b>{inr(o.total)}</b></Link>)}</div>}
          {data.followups.length > 0 && <div><div className="mb-1 text-xs font-semibold uppercase text-slate-500">Follow-ups due</div>{data.followups.slice(0, 5).map((f: any) => <div key={f.id} className="py-0.5">{f.dealer?.name} <span className="text-xs text-slate-400">· {fmtDate(f.next_followup_at)}</span></div>)}</div>}
          {!data.pending_approvals.length && !data.followups.length && <div className="text-slate-500">Nothing pending. 🎉</div>}
        </div>
      </Card>
    </div>
    <Card title="Recent activity" pad={false}>
      {data.activity.length ? <ul className="divide-y divide-slate-100 text-sm">{data.activity.map((a: any) => <li key={a.id} className="flex items-center justify-between px-4 py-2"><span>{a.order ? <Link href={`/app/orders/${a.order.id}`} className="font-medium text-df-700">{a.order.order_no}</Link> : null} {a.note || ''} <Badge value={a.to_status} /></span><span className="text-xs text-slate-400">{a.actor_name} · {fmtDate(a.created_at)}</span></li>)}</ul> : <div className="p-4"><Empty>Activity will appear here as orders move.</Empty></div>}
    </Card>
    {me.role === 'admin' && !m.active_dealers && <Card title="Get started"><ol className="list-decimal space-y-1 pl-5 text-sm"><li>Add your <Link className="text-df-700 underline" href="/app/settings">warehouse and team</Link>.</li><li>Add <Link className="text-df-700 underline" href="/app/products">products</Link> (or import from Excel) and record opening stock in <Link className="text-df-700 underline" href="/app/inventory">Inventory</Link>.</li><li>Add <Link className="text-df-700 underline" href="/app/dealers">dealers</Link> and give them a portal login.</li></ol></Card>}
    <span className="hidden">{qtyFmt(0)}</span>
  </div>
}
