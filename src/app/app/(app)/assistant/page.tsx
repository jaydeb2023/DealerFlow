'use client'
import { useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { api } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { Button, Card, Input, PageHeader, Spinner, Table, Td } from '@/components/df/ui'

interface Msg { role: 'user' | 'bot'; text: string; tables?: any[]; mode?: string }
const IDEAS = ['Which dealers have the highest outstanding balances?', 'Which products are below their reorder level?', 'Which dealers have not ordered in the last 60 days?', 'Which products sold the most this month?', 'Which orders are overdue for dispatch?', "Summarize this month's sales performance."]

export default function AssistantPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]); const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const end = useRef<HTMLDivElement>(null)
  const ask = async (text: string) => {
    if (!text.trim() || busy) return
    setMsgs(m => [...m, { role: 'user', text }]); setQ(''); setBusy(true)
    try { const r: any = await api('/api/df/assistant', { body: { question: text } }); setMsgs(m => [...m, { role: 'bot', text: r.answer, tables: r.tables, mode: r.mode }]) }
    catch (e: any) { setMsgs(m => [...m, { role: 'bot', text: e.message }]) } finally { setBusy(false); setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 50) }
  }
  const fmt = (c: any, v: any) => v === null || v === undefined || v === '' ? '-' : c.type === 'money' ? inr(v) : c.type === 'pct' ? `${v}%` : v
  return <div className="mx-auto max-w-4xl">
    <PageHeader title="AI assistant" subtitle="Ask about your business in plain words. It reads your real records and shows the data behind every answer. It cannot change anything." />
    {!msgs.length && <Card title="Try asking"><div className="flex flex-wrap gap-2">{IDEAS.map(i => <button key={i} onClick={() => ask(i)} className="rounded-full border border-df-200 bg-df-50 px-3 py-1.5 text-left text-sm text-df-800 hover:bg-df-100"><Sparkles className="mr-1 inline h-3.5 w-3.5" />{i}</button>)}</div></Card>}
    <div className="space-y-4">{msgs.map((m, i) => <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}><div className={`max-w-full rounded-2xl px-4 py-3 text-sm ${m.role === 'user' ? 'bg-df-700 text-white' : 'border border-slate-200 bg-white'}`}>
      <p className="whitespace-pre-line">{m.text}</p>
      {m.tables?.map((t, k) => <div key={k} className="mt-3"><div className="mb-1 text-xs font-semibold text-slate-500">{t.title}{t.period ? ` · ${t.period}` : ''} · {t.scope}</div>
        {t.rows.length ? <Table head={t.columns.map((c: any) => c.label)}>{t.rows.slice(0, 50).map((r: any, j: number) => <tr key={j}>{t.columns.map((c: any) => <Td key={c.key}>{fmt(c, r[c.key])}</Td>)}</tr>)}</Table> : null}{t.note && <div className="mt-1 text-xs text-slate-500">{t.note}</div>}</div>)}
    </div></div>)}{busy && <Spinner className="h-5 w-5" />}<div ref={end} /></div>
    <form onSubmit={e => { e.preventDefault(); ask(q) }} className="sticky bottom-3 mt-4 flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"><Input className="border-0 focus:ring-0" placeholder="Ask a question about your dealers, stock, orders or payments" value={q} onChange={e => setQ(e.target.value)} /><Button type="submit" variant="primary" disabled={busy}><Send className="h-4 w-4" /></Button></form>
  </div>
}
