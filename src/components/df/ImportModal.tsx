'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { api, downloadText } from '@/lib/df/client'
import { Button, ErrorNote, Modal } from './ui'

/** Pick an Excel / CSV file; the first row must hold the column names. */
export default function ImportModal({ open, onClose, kind, title, columns, onDone }: { open: boolean; onClose: () => void; kind: 'dealers' | 'products' | 'stock'; title: string; columns: string; onDone: () => void }) {
  const [rows, setRows] = useState<any[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState('')
  const pick = async (f?: File | null) => {
    if (!f) return
    setErr(''); setRes(null)
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false })
      const norm = data.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).trim().toLowerCase().replace(/[\s-]+/g, '_'), v])))
      if (!norm.length) return setErr('The file has no data rows.')
      setRows(norm); setName(f.name)
    } catch { setErr('Could not read this file. Use .xlsx, .xls or .csv.') }
  }
  const run = async () => {
    if (!rows) return
    setBusy(true); setErr('')
    try { const r = await api('/api/df/import', { body: { kind, rows } }); setRes(r); if (r.created || r.updated) { toast.success(`${r.created} added, ${r.updated} updated`); onDone() } }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const close = () => { setRows(null); setRes(null); setErr(''); setName(''); onClose() }
  const template = () => downloadText(`${kind}-template.csv`, columns.split(',').map(s => s.trim()).join(','))
  return <Modal open={open} onClose={close} title={title} wide footer={<><Button onClick={close}>Close</Button>{!res && <Button variant="primary" loading={busy} disabled={!rows} onClick={run}>Import {rows ? `${rows.length} rows` : ''}</Button>}</>}>
    <div className="space-y-3 text-sm">
      <p>Use a sheet whose first row has these column names:</p>
      <p className="rounded-lg bg-slate-50 p-2 font-mono text-xs">{columns}</p>
      <button onClick={template} className="text-df-700 underline">Download an empty template</button>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={e => pick(e.target.files?.[0])} className="block w-full text-sm" />
      {name && <div className="text-slate-600">{name}: {rows?.length} rows ready.</div>}
      {err && <ErrorNote>{err}</ErrorNote>}
      {res && <div className="space-y-2"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">Added {res.created}, updated {res.updated}{res.errors.length ? `, ${res.errors.length} problem(s)` : ''}.</div>
        {res.errors.length > 0 && <ul className="max-h-48 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">{res.errors.map((e: any, i: number) => <li key={i}>Row {e.row}: {e.error}</li>)}</ul>}</div>}
    </div>
  </Modal>
}
