'use client'
import { fmtDate, useFetch } from '@/lib/df/client'
import { inr } from '@/lib/df/util'
import { Button, ErrorNote, Spinner } from './ui'

export default function Receipt({ id }: { id: string }) {
  const { data, error } = useFetch<any>(`/api/df/payments/${id}`)
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-8 h-6 w-6" />
  const { payment: p, company: c } = data
  const adv = Number(p.amount) - (p.allocations || []).reduce((s: number, a: any) => s + Number(a.amount), 0)
  return <div className="text-sm">
    <div className="no-print mb-3 flex justify-end"><Button onClick={() => window.print()}>Print receipt</Button></div>
    <div className="rounded-xl border border-slate-200 p-6"><div className="flex justify-between"><div><div className="text-base font-bold">{c.name}</div><div className="text-xs text-slate-500">{c.address}</div></div><div className="text-right"><div className="text-lg font-extrabold text-df-800">PAYMENT RECEIPT</div><div className="font-semibold">{p.receipt_no}</div><div className="text-xs text-slate-500">{fmtDate(p.paid_on)}</div></div></div>
      <p className="mt-5">Received with thanks from <b>{p.dealer?.name}</b> ({p.dealer?.dealer_code}) the sum of <b>{inr(p.amount)}</b> by {p.mode.replace('_', ' ')}{p.reference ? `, reference ${p.reference}` : ''}.</p>
      <ul className="mt-3 text-xs text-slate-600">{(p.allocations || []).map((a: any, i: number) => <li key={i}>Applied to {a.invoice?.invoice_no}: {inr(a.amount)}</li>)}{adv > 0 && <li>Kept as advance: {inr(adv)}</li>}</ul>{p.notes && <p className="mt-2 text-xs text-slate-500">{p.notes}</p>}</div></div>
}
