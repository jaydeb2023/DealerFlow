'use client'
import Link from 'next/link'
import { api, fmtDateTime, useFetch } from '@/lib/df/client'
import { Button, Empty, ErrorNote, PageHeader, Spinner } from '@/components/df/ui'

export default function NotificationsPage() {
  const { data, error, reload } = useFetch<{ data: any[] }>('/api/df/notifications')
  const mark = async (id?: string) => { await api('/api/df/notifications', { method: 'PATCH', body: id ? { id } : {} }); reload() }
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-16 h-7 w-7" />
  return <div className="mx-auto max-w-3xl"><PageHeader title="Notifications" actions={data.data.some(n => !n.read_at) && <Button onClick={() => mark()}>Mark all read</Button>} />
    {data.data.length ? <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{data.data.map(n => <li key={n.id} className={`flex items-start justify-between gap-3 px-4 py-3 ${n.read_at ? '' : 'bg-df-50/60'}`}>
      <div><div className="text-sm font-medium">{n.link ? <Link href={n.link} onClick={() => !n.read_at && mark(n.id)} className="hover:text-df-700">{n.title}</Link> : n.title}</div>{n.body && <div className="text-xs text-slate-600">{n.body}</div>}<div className="text-[11px] text-slate-400">{fmtDateTime(n.created_at)}</div></div>
      {!n.read_at && <button className="text-xs text-df-700 underline" onClick={() => mark(n.id)}>Mark read</button>}</li>)}</ul> : <Empty>You are all caught up.</Empty>}</div>
}
