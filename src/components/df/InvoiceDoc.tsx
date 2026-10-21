'use client'
import { fmtDate, useFetch } from '@/lib/df/client'
import { inr, qtyFmt } from '@/lib/df/util'
import { ErrorNote, Spinner, Button } from './ui'
import Logo from './Logo'

/** Printable invoice (use Print > Save as PDF). */
export default function InvoiceDoc({ id, onVoid }: { id: string; onVoid?: () => void }) {
  const { data, error } = useFetch<any>(`/api/df/invoices/${id}`)
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-16 h-7 w-7" />
  const { invoice: v, items, payments, company: c } = data
  const balance = Number(v.total) - Number(v.paid)
  return <div>
    <div className="no-print mb-3 flex justify-end gap-2"><Button onClick={() => window.print()}>Print / Save as PDF</Button>{onVoid && v.status !== 'void' && Number(v.paid) === 0 && <Button variant="danger" onClick={onVoid}>Void invoice</Button>}</div>
    <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 text-sm shadow-sm print:border-0 print:shadow-none">
      <div className="flex items-start justify-between"><div><Logo size={30} home={false} /><div className="mt-3 text-base font-bold">{c.name}</div><div className="whitespace-pre-line text-xs text-slate-600">{c.address}{c.gstin ? `\nGSTIN: ${c.gstin}` : ''}{c.phone ? `\n${c.phone}` : ''}</div></div>
        <div className="text-right"><div className="text-xl font-extrabold tracking-wide text-df-800">TAX INVOICE</div><div className="mt-1 font-semibold">{v.invoice_no}</div><div className="text-xs text-slate-600">Date: {fmtDate(v.invoice_date)}<br />Due: {fmtDate(v.due_date)}{v.order?.order_no ? <><br />Order: {v.order.order_no}</> : null}</div>{v.status === 'void' && <div className="mt-1 font-bold text-red-600">VOID</div>}</div></div>
      <div className="mt-6 grid grid-cols-2 gap-6"><div><div className="text-xs font-semibold uppercase text-slate-500">Bill to</div><div className="font-semibold">{v.dealer?.name}</div><div className="whitespace-pre-line text-xs text-slate-600">{v.bill_to || v.dealer?.billing_address}{v.dealer?.gstin ? `\nGSTIN: ${v.dealer.gstin}` : ''}</div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Ship to</div><div className="whitespace-pre-line text-xs text-slate-600">{v.ship_to || '-'}</div></div></div>
      <table className="mt-6 w-full text-xs"><thead><tr className="border-y border-slate-300 bg-slate-50 text-left"><th className="py-2 pl-2">Item</th><th>HSN</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Disc.</th><th className="text-right">GST</th><th className="py-2 pr-2 text-right">Amount</th></tr></thead>
        <tbody>{items.map((i: any) => <tr key={i.id} className="border-b border-slate-100"><td className="py-1.5 pl-2">{i.name}<div className="text-[10px] text-slate-400">{i.sku}</div></td><td>{i.hsn || '-'}</td><td className="text-right">{qtyFmt(i.qty)} {i.unit}</td><td className="text-right">{inr(i.unit_price)}</td><td className="text-right">{Number(i.discount) ? inr(i.discount) : '-'}</td><td className="text-right">{inr(i.tax)} ({Number(i.gst_rate)}%)</td><td className="pr-2 text-right">{inr(i.line_total)}</td></tr>)}</tbody></table>
      <dl className="ml-auto mt-4 max-w-xs space-y-1"><div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(v.subtotal)}</dd></div>{Number(v.discount_total) > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{inr(v.discount_total)}</dd></div>}<div className="flex justify-between"><dt>GST</dt><dd>{inr(v.tax_total)}</dd></div>{Number(v.shipping) > 0 && <div className="flex justify-between"><dt>Shipping</dt><dd>{inr(v.shipping)}</dd></div>}
        <div className="flex justify-between border-t pt-1 text-base font-bold"><dt>Total</dt><dd>{inr(v.total)}</dd></div><div className="flex justify-between"><dt>Paid</dt><dd>{inr(v.paid)}</dd></div><div className="flex justify-between font-semibold"><dt>Balance due</dt><dd>{inr(balance)}</dd></div></dl>
      {payments.length > 0 && <div className="mt-4 text-xs text-slate-600"><b>Payments:</b> {payments.map((p: any) => `${p.payment?.receipt_no} (${fmtDate(p.payment?.paid_on)}) ${inr(p.amount)}`).join('; ')}</div>}
      <div className="mt-6 grid grid-cols-2 gap-6 text-xs text-slate-600">{c.bank_details && <div><b>Bank details</b><div className="whitespace-pre-line">{c.bank_details}{c.upi_id ? `\nUPI: ${c.upi_id}` : ''}</div></div>}<div><b>Terms</b><div className="whitespace-pre-line">{c.invoice_terms}</div></div></div>
      <p className="mt-6 text-center text-[10px] text-slate-400">Computer-generated invoice. GST treatment (CGST/SGST/IGST) and e-invoicing requirements should be verified with your accountant.</p>
    </div></div>
}
